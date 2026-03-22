import Job from "../models/Job.js";
import Cv from "../models/Cv.js";
import { jobsMultiSearch, cvMatchJobs } from "../services/pythonAiService.js";
// The jobAggregatorService import has been removed to keep the
// controller CRUD-only. External job synchronisation should be handled
// by a separate service or script.


// List jobs with basic filtering and pagination
// Supports optional full-text search across title and company fields.
const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { company: new RegExp(search, "i") },
      ];
    }
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const jobs = await Job.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ postedAt: -1 });
    const total = await Job.countDocuments(query);
    return res.json({ jobs, total });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

// Fetch single job by ID
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json({ job });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch job" });
  }
};

// Create a job (admin only). For demonstration, jobs can be added manually.
const createJob = async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    return res.status(201).json({ job });
  } catch (err) {
    return res.status(400).json({ error: "Failed to create job", details: err.message });
  }
};

// NOTE: The syncExternalJobs function has been removed. This controller
// no longer performs any network calls or synchronises jobs from
// external APIs. Jobs must be created manually via the POST /api/jobs
// endpoint or through a separate ingestion service.

// Search for jobs via Python multi-search, upsert to MongoDB, optionally score with CV
const searchAndIngest = async (req, res) => {
  try {
    const { query, where, limit, min_results, providers } = req.body || {};

    // Fetch from Python multi-search
    const pyResult = await jobsMultiSearch({ query, where, limit, min_results, providers });
    const rawJobs = pyResult?.jobs || pyResult?.data?.jobs || [];

    // Upsert each job into MongoDB by URL
    const savedJobs = [];
    for (const j of rawJobs) {
      const url = j.job_url || j.apply_url || j.url || "";
      let doc;
      if (url) {
        doc = await Job.findOneAndUpdate(
          { url },
          {
            $setOnInsert: {
              title: j.title || "",
              company: j.company || "",
              location: j.location || "",
              description: j.description || j.description_snippet || "",
              url,
              source: j.source || "multi-search",
              country: j.country || "",
              postedAt: j.posted_at ? new Date(j.posted_at) : new Date(),
            },
          },
          { upsert: true, new: true },
        );
      } else {
        doc = { ...j, _id: null };
      }
      savedJobs.push({ ...(doc?.toObject ? doc.toObject() : doc), ...j });
    }

    // If user is authenticated and has a CV, add match scores
    const userId = req.user?._id || req.user?.id;
    let jobsWithScores = savedJobs;

    if (userId && savedJobs.length > 0) {
      try {
        const cv = await Cv.findOne({ userId }).sort({ createdAt: -1 });
        if (cv?.extractedText) {
          const matchPayload = savedJobs.map((j) => ({
            title: j.title || "",
            company: j.company || "",
            description_snippet: j.description || j.description_snippet || "",
          }));
          const matchResult = await cvMatchJobs({
            cv_text: cv.extractedText,
            jobs: matchPayload,
          });
          const matchedJobs = matchResult?.jobs || [];
          jobsWithScores = savedJobs.map((job, i) => ({
            ...job,
            match_score: matchedJobs[i]?.match_score ?? null,
            match_percent: matchedJobs[i]?.match_percent ?? null,
          }));
        }
      } catch (matchErr) {
        console.warn("CV match scoring failed (non-fatal):", matchErr.message);
      }
    }

    return res.json({ jobs: jobsWithScores, total: jobsWithScores.length });
  } catch (err) {
    console.error("searchAndIngest error:", err);
    return res.status(500).json({ error: "Failed to search and ingest jobs", details: err.message });
  }
};

// Match a provided list of jobs against the user's latest CV
const matchJobsForUser = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { jobs } = req.body || {};
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: "jobs array is required" });
    }

    const cv = await Cv.findOne({ userId }).sort({ createdAt: -1 });
    if (!cv?.extractedText) {
      return res.status(404).json({ error: "No CV found for this user" });
    }

    const result = await cvMatchJobs({ cv_text: cv.extractedText, jobs });
    return res.json(result); // { jobs: [..., match_score, match_percent] }
  } catch (err) {
    console.error("matchJobsForUser error:", err);
    return res.status(err?.status || 500).json({ error: "Failed to match jobs", details: err.message });
  }
};

export default {
  getJobs,
  getJobById,
  createJob,
  searchAndIngest,
  matchJobsForUser,
  // syncExternalJobs is intentionally omitted.
};
import Job from "../models/Job.js";

// List jobs with basic filtering and pagination
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
    return res
      .status(400)
      .json({ error: "Failed to create job", details: err.message });
  }
};

export default {
  getJobs,
  getJobById,
  createJob,
};

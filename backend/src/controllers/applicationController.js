// src/controllers/applicationController.js
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import py from "../services/pythonAiService.js";

// Create/save an application (add to pipeline) - legacy (jobId only)
const saveApplication = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { jobId } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Be tolerant to either schema: (user, job) OR (userId, jobId)
    const existing =
      (await Application.findOne({ user: userId, job: jobId })) ||
      (await Application.findOne({ userId, jobId }));

    if (existing)
      return res
        .status(409)
        .json({ error: "Application already exists", application: existing });

    const application =
      (await Application.create({
        user: userId,
        job: jobId,
        status: "saved",
      })) ||
      (await Application.create({
        userId,
        jobId: job._id,
        status: "saved",
        appliedAt: null,
      }));

    return res.status(201).json({ application });
  } catch (err) {
    console.error("saveApplication error:", err);
    return res.status(500).json({ error: "Failed to save application" });
  }
};

// List current user's applications
const getApplications = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Support both schema variants
    const apps = await Application.find({
      $or: [{ user: userId }, { userId }],
    })
      .populate("job")
      .sort({ createdAt: -1 });

    return res.json({ applications: apps });
  } catch (err) {
    console.error("getApplications error:", err);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
};

// ✅ GET application by id
const getApplicationById = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!id) return res.status(400).json({ error: "Missing application id" });

    const app = await Application.findOne({
      _id: id,
      $or: [{ user: userId }, { userId }],
    }).populate("job");

    if (!app) return res.status(404).json({ error: "Application not found" });

    return res.json({ application: app });
  } catch (err) {
    console.error("getApplicationById error:", err);
    return res.status(500).json({ error: "Failed to fetch application" });
  }
};

// ✅ DELETE application
const deleteApplication = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!id) return res.status(400).json({ error: "Missing application id" });

    const deleted = await Application.findOneAndDelete({
      _id: id,
      $or: [{ user: userId }, { userId }],
    });

    if (!deleted)
      return res.status(404).json({ error: "Application not found" });

    return res.json({
      ok: true,
      message: "Application deleted",
      application: deleted,
    });
  } catch (err) {
    console.error("deleteApplication error:", err);
    return res.status(500).json({ error: "Failed to delete application" });
  }
};

// Update application status
const updateApplicationStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const validStatuses = [
      "saved",
      "queued",
      "applied",
      "interview",
      "offer",
      "rejected",
    ];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const application = await Application.findOneAndUpdate(
      {
        _id: id,
        $or: [{ user: userId }, { userId }],
      },
      {
        status,
        $push: {
          timeline: {
            action: "status_update",
            description: `Status changed to ${status}`,
          },
        },
      },
      { new: true },
    ).populate("job");

    if (!application)
      return res.status(404).json({ error: "Application not found" });

    // Fire-and-forget email via Python service
    py.post("/notify/application-status", {
      email: application.user?.email || "",
      jobTitle: application.job?.title,
      company: application.job?.company,
      status,
    }).catch(() => {});

    return res.json({ application });
  } catch (err) {
    console.error("updateApplicationStatus error:", err);
    return res.status(500).json({ error: "Failed to update application" });
  }
};

// Create application (jobId OR jobData)

const createApplication = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { jobId, jobData, externalJob } = req.body;
    const data = jobData || externalJob;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let job = null;

    // A) If you passed a jobId (already in DB)
    if (jobId) job = await Job.findById(jobId);

    // B) If you passed jobData/externalJob (from search)
    if (!job && data && typeof data === "object") {
      const normalizedUrl =
        data.apply_url ||
        data.applyUrl ||
        data.job_url ||
        data.jobUrl ||
        data.url ||
        "";

      if (normalizedUrl) job = await Job.findOne({ url: normalizedUrl });

      if (!job) {
        job = await Job.findOne({
          title: data.title || "",
          company: data.company || "",
          location: data.location || "",
        });
      }

      if (!job) {
        job = await Job.create({
          title: data.title || "",
          company: data.company || "",
          location: data.location || "",
          description:
            data.description ||
            data.description_snippet ||
            data.descriptionSnippet ||
            "",
          url: normalizedUrl,
          source: data.source || "adzuna",
          country: data.country || "",
        });
      }
    }

    if (!job) return res.status(404).json({ error: "Job not found" });

    const existing =
      (await Application.findOne({ user: userId, job: job._id })) ||
      (await Application.findOne({ userId, jobId: job._id }));

    if (existing) {
      return res.status(409).json({
        error: "You already saved this job",
        application: existing,
      });
    }

    const application = await Application.create({
      user: userId,
      job: job._id,
      userId,
      jobId: job._id,
      status: "saved",
      appliedAt: null,
      timeline: [{ action: "created", description: "Saved to pipeline" }],
    });

    return res.status(201).json({
      message: "Application created successfully",
      application,
      job,
    });
  } catch (error) {
    console.error("createApplication error:", error);
    return res.status(500).json({ error: "Failed to save application" });
  }
};

export default {
  saveApplication,
  getApplications,
  getApplicationById,
  deleteApplication,
  updateApplicationStatus,
  createApplication,
};

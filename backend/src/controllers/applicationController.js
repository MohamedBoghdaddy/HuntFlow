import Application from "../models/Application.js";
import Job from "../models/Job.js";
// AI-related integrations (ATS application, email outreach and interview prep)
// have been removed from this controller. The remaining functions implement
// simple CRUD operations for job applications. If you need to implement
// automatic applications or recruiter outreach, create separate modules
// outside of this CRUD layer.

// Create/save an application (add to pipeline)
const saveApplication = async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const existing = await Application.findOne({ user: req.user.id, job: jobId });
    if (existing) {
      return res.status(400).json({ error: "Application already exists" });
    }
    const application = new Application({ user: req.user.id, job: jobId, status: "saved" });
    await application.save();
    return res.status(201).json({ application });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save application" });
  }
};

// List current user's applications
const getApplications = async (req, res) => {
  try {
    const apps = await Application.find({ user: req.user.id })
      .populate("job")
      .sort({ createdAt: -1 });
    return res.json({ applications: apps });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
};

// Update application status
const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["saved", "queued", "applied", "interview", "offer", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const application = await Application.findOneAndUpdate(
      { _id: id, user: req.user.id },
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
    );
    if (!application) return res.status(404).json({ error: "Application not found" });
    return res.json({ application });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update application" });
  }
};

const createApplication = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { jobId, jobData } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let job = null;

    if (jobId) {
      job = await Job.findById(jobId);
    }

    if (!job && jobData) {
      const normalizedUrl = jobData.apply_url || jobData.url;

      job = await Job.findOne({
        $or: [
          ...(normalizedUrl ? [{ url: normalizedUrl }] : []),
          {
            title: jobData.title,
            company: jobData.company,
            location: jobData.location || "",
          },
        ],
      });

      if (!job) {
        job = await Job.create({
          title: jobData.title || "",
          company: jobData.company || "",
          location: jobData.location || "",
          description: jobData.description || jobData.description_snippet || "",
          url: normalizedUrl || "",
          source: jobData.source || "unknown",
          country: jobData.country || "",
        });
      }
    }

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const existingApplication = await Application.findOne({
      userId,
      jobId: job._id,
    });

    if (existingApplication) {
      return res.status(409).json({
        error: "You already saved this job",
        application: existingApplication,
      });
    }

    const application = await Application.create({
      userId,
      jobId: job._id,
      status: "saved",
      appliedAt: null,
    });

    return res.status(201).json({
      message: "Application created successfully",
      application,
      job,
    });
  } catch (error) {
    console.error("createApplication error:", error);
    return res.status(500).json({
      error: "Failed to save application",
      details: error.message,
    });
  }
};

export default {
  saveApplication,
  getApplications,
  updateApplicationStatus,
  createApplication,
};
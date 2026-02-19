import Application from "../models/Application.js";
import Job from "../models/Job.js";

// Create/save an application (add to pipeline)
const saveApplication = async (req, res) => {
  try {
    const { jobId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const existing = await Application.findOne({
      user: req.user.id,
      job: jobId,
    });

    if (existing) {
      return res.status(400).json({ error: "Application already exists" });
    }

    const application = new Application({
      user: req.user.id,
      job: jobId,
      status: "saved",
    });

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

    const validStatuses = [
      "saved",
      "queued",
      "applied",
      "interview",
      "offer",
      "rejected",
    ];

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

    if (!application)
      return res.status(404).json({ error: "Application not found" });

    return res.json({ application });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update application" });
  }
};

export default {
  saveApplication,
  getApplications,
  updateApplicationStatus,
};

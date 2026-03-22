// src/routes/applicationRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware/authMiddleware.js";
import applicationController from "../controllers/applicationController.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";

const router = express.Router();

// Create a new application OR save external job into pipeline
router.post("/", authenticateToken, applicationController.createApplication);

// List all applications for the authenticated user
router.get("/", authenticateToken, applicationController.getApplications);

// Get one application by id
router.get("/:id", authenticateToken, applicationController.getApplicationById);

// Update an application's status (PUT or PATCH both accepted)
router.put(
  "/:id",
  authenticateToken,
  applicationController.updateApplicationStatus,
);
router.patch(
  "/:id",
  authenticateToken,
  applicationController.updateApplicationStatus,
);

// Delete an application
router.delete(
  "/:id",
  authenticateToken,
  applicationController.deleteApplication,
);


// in src/routes/applicationRoutes.js
router.post("/:id/apply", authenticateToken, (req, res) =>
  res.status(501).json({ error: "Apply automation removed in CRUD-only backend" }),
);

router.post("/:id/contact", authenticateToken, (req, res) =>
  res.status(501).json({ error: "Recruiter contact removed in CRUD-only backend" }),
);

router.get("/:id/interview-prep", authenticateToken, (req, res) =>
  res.status(501).json({ error: "Interview prep moved to AI service" }),
);

// POST /api/applications/report — no auth middleware, validates token from body
// Used by the Chrome extension to report an application event.
router.post("/report", async (req, res) => {
  try {
    const { jobUrl, jobTitle, company, status, userToken } = req.body || {};

    if (!userToken) {
      return res.status(401).json({ error: "userToken is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(userToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = decoded?.id || decoded?._id || decoded?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Token does not contain a user id" });
    }

    // Find or create the job
    let job = null;
    if (jobUrl) {
      job = await Job.findOne({ url: jobUrl });
    }
    if (!job && (jobTitle || company)) {
      job = await Job.findOne({ title: jobTitle || "", company: company || "" });
    }
    if (!job) {
      job = await Job.create({
        title: jobTitle || "",
        company: company || "",
        url: jobUrl || "",
        source: "extension",
      });
    }

    // Upsert application with status "applied"
    const application = await Application.findOneAndUpdate(
      { $or: [{ user: userId, job: job._id }, { userId, jobId: job._id }] },
      {
        $set: { status: status || "applied" },
        $setOnInsert: {
          user: userId,
          job: job._id,
          userId,
          jobId: job._id,
          appliedAt: new Date(),
        },
        $push: {
          timeline: {
            action: "extension_report",
            description: `Status set to ${status || "applied"} via extension`,
          },
        },
      },
      { upsert: true, new: true },
    );

    return res.json({ ok: true, application });
  } catch (err) {
    console.error("report application error:", err);
    return res.status(500).json({ error: "Failed to report application", details: err.message });
  }
});

export default router;

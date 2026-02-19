import express from "express";

import applicationController from "../controllers/applicationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Save a job as an application (add to pipeline)
router.post("/", authenticateToken, applicationController.saveApplication);

// List applications for the current user
router.get("/", authenticateToken, applicationController.getApplications);

// Update application status by ID
router.put(
  "/:id",
  authenticateToken,
  applicationController.updateApplicationStatus,
);

export default router;

import express from "express";
import applicationController from "../controllers/applicationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new application (add a job to the pipeline)
router.post("/", authenticateToken, applicationController.saveApplication);

// List all applications for the authenticated user
router.get("/", authenticateToken, applicationController.getApplications);

// The following routes have been removed: complex applications, ATS apply,
// recruiter contact and interview prep. The CRUD-only backend exposes
// endpoints for saving applications, listing them and updating status.

// Update an application's status
router.put(
  "/:id",
  authenticateToken,
  applicationController.updateApplicationStatus,
);

export default router;
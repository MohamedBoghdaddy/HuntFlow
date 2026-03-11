import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import applicationController from "../controllers/applicationController.js";

const router = express.Router();

// Create a new application or save a searched job into applications
router.post("/", authenticateToken, applicationController.saveApplication);

// List all applications for the authenticated user
router.get("/", authenticateToken, applicationController.getApplications);

// Get one application by id
router.get("/:id", authenticateToken, applicationController.getApplicationById);

// Update an application's status
router.put(
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

// Optional: trigger apply flow if your controller supports it
router.post("/:id/apply", authenticateToken, applicationController.applyToJob);

export default router;

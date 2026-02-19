import express from "express";

import jobController from "../controllers/jobController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// List jobs with optional search and pagination
router.get("/", jobController.getJobs);

// Get a specific job by ID
router.get("/:id", jobController.getJobById);

// Create a new job (requires authentication, ideally admin)
router.post("/", authenticateToken, jobController.createJob);

export default router;

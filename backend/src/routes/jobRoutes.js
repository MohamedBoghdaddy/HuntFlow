import express from "express";
import jobController from "../controllers/jobController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// External job synchronization has been disabled. Jobs can only be
// created manually via the POST /api/jobs endpoint. To import jobs from
// external sources, implement a separate service outside of this CRUD layer.

// List jobs with optional search and pagination
router.get("/", jobController.getJobs);

// Create a new job (requires authentication, ideally admin)
router.post("/", authenticateToken, jobController.createJob);

// Search + ingest jobs from Python multi-search (auth optional — scores added when user has CV)
router.post("/search-ingest", authenticateToken, jobController.searchAndIngest);

// Match a list of jobs against the authenticated user's CV
router.post("/match", authenticateToken, jobController.matchJobsForUser);

// Get a specific job by ID. Keep this last so more specific routes above
// take precedence.
router.get("/:id", jobController.getJobById);

export default router;
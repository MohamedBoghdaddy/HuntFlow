import express from "express";
import cvController from "../controllers/cvController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new CV
router.post("/", authenticateToken, cvController.createCv);

// List all CVs for the authenticated user
router.get("/", authenticateToken, cvController.getCvs);

// Get a single CV
router.get("/:id", authenticateToken, cvController.getCvById);

// Update a CV
router.put("/:id", authenticateToken, cvController.updateCv);

// Delete a CV
router.delete("/:id", authenticateToken, cvController.deleteCv);

export default router;
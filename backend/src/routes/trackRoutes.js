import express from "express";
import trackController from "../controllers/trackController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new track
router.post("/", authenticateToken, trackController.createTrack);

// List all tracks
router.get("/", authenticateToken, trackController.getTracks);

// Get a single track
router.get("/:id", authenticateToken, trackController.getTrackById);

// Update a track
router.put("/:id", authenticateToken, trackController.updateTrack);

// Delete a track
router.delete("/:id", authenticateToken, trackController.deleteTrack);

export default router;
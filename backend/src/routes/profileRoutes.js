import express from "express";

import profileController from "../controllers/profileController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get the current user's profile
router.get("/", authenticateToken, profileController.getProfile);

// Update the current user's profile
router.put("/", authenticateToken, profileController.updateProfile);

export default router;

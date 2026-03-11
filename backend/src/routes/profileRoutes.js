import express from "express";
import {
  getMyProfile,
  createOrUpdateProfile,
  deleteMyProfile,
} from "../controllers/profileController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", requireAuth, getMyProfile);
router.post("/", requireAuth, createOrUpdateProfile);
router.put("/", requireAuth, createOrUpdateProfile);
router.delete("/", requireAuth, deleteMyProfile);

export default router;

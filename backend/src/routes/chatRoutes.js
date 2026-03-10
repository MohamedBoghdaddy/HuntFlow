import express from "express";
import { sendCareerCoachMessage } from "../controllers/chatController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/send", authMiddleware, sendCareerCoachMessage);

export default router;

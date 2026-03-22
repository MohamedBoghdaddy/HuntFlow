import express from "express";
import { sendCareerCoachMessage, getChatHistory } from "../controllers/chatController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/send", authMiddleware, sendCareerCoachMessage);
router.get("/history", authMiddleware, getChatHistory);

export default router;

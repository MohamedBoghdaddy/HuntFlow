import express from "express";
import chatController from "../controllers/chatController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new chat (optionally with initial messages)
router.post("/", authenticateToken, chatController.createChat);

// List all chats for the authenticated user
router.get("/", authenticateToken, chatController.getChats);

// Get a specific chat
router.get("/:id", authenticateToken, chatController.getChatById);

// Append a message to a chat
router.post("/:id/messages", authenticateToken, chatController.addMessage);

// Delete a chat
router.delete("/:id", authenticateToken, chatController.deleteChat);

export default router;
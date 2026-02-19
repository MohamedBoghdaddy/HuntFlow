import express from "express";
import authController from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticateToken, authController.getMe);

export default router;

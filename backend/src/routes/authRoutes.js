// src/routes/authRoutes.js (REPLACED)
// - Wires the real controller
// - Includes /me, /logout, and optional /refresh + /me PATCH
import express from "express";
import authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.post("/register", authController.register);
router.post("/login", authController.login);

// Optional refresh (needs cookie-parser + jwtRefreshSecret)
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// Private
router.get("/me", requireAuth, authController.getMe);
router.patch("/me", requireAuth, authController.updateMe);

router.post("/change-password", requireAuth, authController.changePassword);

export default router;

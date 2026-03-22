// backend/src/routes/cvRoutes.js
import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  uploadCv,
  getLatestCv,
  analyzeCv,
  generateCoverLetter,
} from "../controllers/cvController.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ accept common field names to avoid "Unexpected field"
const cvUploadFields = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "cv", maxCount: 1 },
  { name: "resume", maxCount: 1 },
  { name: "document", maxCount: 1 },
]);

router.post("/upload", authenticateToken, upload.any(), uploadCv);
router.get("/latest", authenticateToken, getLatestCv);
router.post("/analyze", authenticateToken, analyzeCv);
router.post("/cover-letter", authenticateToken, generateCoverLetter);

export default router;

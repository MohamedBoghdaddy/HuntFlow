import express from "express";

// Profile routes placeholder. A real implementation would expose endpoints
// for retrieving and updating user profiles, resumes, etc. Currently
// returns a 501 response for all requests.
const router = express.Router();

router.get("/", (req, res) => {
  res.status(501).json({ error: "Profile retrieval is not implemented." });
});

router.put("/", (req, res) => {
  res.status(501).json({ error: "Profile update is not implemented." });
});

export default router;
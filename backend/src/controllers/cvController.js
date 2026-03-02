import Cv from "../models/Cv.js";

// Create a new CV for the authenticated user.
const createCv = async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const cv = new Cv({ user: req.user.id, title, content });
    await cv.save();
    return res.status(201).json({ cv });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create CV" });
  }
};

// List all CVs for the authenticated user.
const getCvs = async (req, res) => {
  try {
    const cvs = await Cv.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json({ cvs });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch CVs" });
  }
};

// Get a specific CV by ID (must belong to the user).
const getCvById = async (req, res) => {
  try {
    const { id } = req.params;
    const cv = await Cv.findOne({ _id: id, user: req.user.id });
    if (!cv) return res.status(404).json({ error: "CV not found" });
    return res.json({ cv });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch CV" });
  }
};

// Update a CV's title or content.
const updateCv = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;
    const cv = await Cv.findOneAndUpdate(
      { _id: id, user: req.user.id },
      update,
      { new: true },
    );
    if (!cv) return res.status(404).json({ error: "CV not found" });
    return res.json({ cv });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update CV" });
  }
};

// Delete a CV by ID.
const deleteCv = async (req, res) => {
  try {
    const { id } = req.params;
    const cv = await Cv.findOneAndDelete({ _id: id, user: req.user.id });
    if (!cv) return res.status(404).json({ error: "CV not found" });
    return res.json({ message: "CV deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete CV" });
  }
};

export default {
  createCv,
  getCvs,
  getCvById,
  updateCv,
  deleteCv,
};
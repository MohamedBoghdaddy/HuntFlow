import Track from "../models/Track.js";

// Create a new track for the authenticated user.
const createTrack = async (req, res) => {
  try {
    const { name, description, applications } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const track = new Track({
      user: req.user.id,
      name,
      description,
      applications: Array.isArray(applications) ? applications : [],
    });
    await track.save();
    return res.status(201).json({ track });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create track" });
  }
};

// List all tracks for the authenticated user.
const getTracks = async (req, res) => {
  try {
    const tracks = await Track.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json({ tracks });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch tracks" });
  }
};

// Get a specific track by ID.
const getTrackById = async (req, res) => {
  try {
    const { id } = req.params;
    const track = await Track.findOne({ _id: id, user: req.user.id }).populate("applications");
    if (!track) return res.status(404).json({ error: "Track not found" });
    return res.json({ track });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch track" });
  }
};

// Update a track's name, description or applications array.
const updateTrack = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, applications } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (applications !== undefined && Array.isArray(applications)) {
      update.applications = applications;
    }
    const track = await Track.findOneAndUpdate(
      { _id: id, user: req.user.id },
      update,
      { new: true },
    ).populate("applications");
    if (!track) return res.status(404).json({ error: "Track not found" });
    return res.json({ track });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update track" });
  }
};

// Delete a track by ID.
const deleteTrack = async (req, res) => {
  try {
    const { id } = req.params;
    const track = await Track.findOneAndDelete({ _id: id, user: req.user.id });
    if (!track) return res.status(404).json({ error: "Track not found" });
    return res.json({ message: "Track deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete track" });
  }
};

export default {
  createTrack,
  getTracks,
  getTrackById,
  updateTrack,
  deleteTrack,
};
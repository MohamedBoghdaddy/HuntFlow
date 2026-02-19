import User from "../models/User.js";

const profileController = {
  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ profile: user.profile || {} });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const updates = req.body;

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { profile: updates },
        { new: true, runValidators: true },
      ).select("-password");

      return res.json({ profile: user?.profile || {} });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  },
};

export default profileController;

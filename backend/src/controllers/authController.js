import jwt from "jsonwebtoken";
import User from "../models/User.js";
import config from "../config/index.js";

// Helper to generate JWT token
function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, config.jwtSecret, {
    expiresIn: "7d",
  });
}

const authController = {
  register: async (req, res) => {
    try {
      const { email, password, name } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = new User({ email, password, name });
      await user.save();

      const token = generateToken(user);

      return res.status(201).json({
        user: { id: user._id, email: user.email, name: user.name },
        token,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Registration failed" });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const token = generateToken(user);

      return res.json({
        user: { id: user._id, email: user.email, name: user.name },
        token,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Login failed" });
    }
  },

  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select("-password");
      return res.json({ user });
    } catch (err) {
      return res.status(500).json({ error: "Unable to fetch user" });
    }
  },
};

export default authController;

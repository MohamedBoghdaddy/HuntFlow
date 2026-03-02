// src/controllers/authController.js 
// - Stronger validation + consistent errors
// - Case-insensitive email handling
// - Safer JWT payload (id + roles)
// - Optional refresh token flow (cookie) ready, but not required
// - getMe returns a clean public user shape
// - Update profile endpoint (useful for your job agent preferences)

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import config from "../config/index.js";

const JWT_EXPIRES_IN = config.jwtExpiresIn || "7d";
const JWT_REFRESH_EXPIRES_IN = config.jwtRefreshExpiresIn || "30d";

// ------------ helpers ------------
const toEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(v || "")
      .trim()
      .toLowerCase(),
  );

const isStrongEnoughPassword = (pw) => String(pw || "").length >= 8;

const publicUser = (u) => ({
  id: u._id,
  email: u.email,
  name: u.name || "",
  roles: u.roles || ["user"],
  profile: u.profile || {},
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      roles: user.roles || ["user"],
    },
    config.jwtSecret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function signRefreshToken(user) {
  if (!config.jwtRefreshSecret) return null;
  return jwt.sign(
    {
      id: user._id,
      tokenType: "refresh",
    },
    config.jwtRefreshSecret,
    { expiresIn: JWT_REFRESH_EXPIRES_IN },
  );
}

function setRefreshCookie(res, refreshToken) {
  if (!refreshToken) return;

  // Works locally and on prod.
  // If you're on HTTP locally, secure must be false.
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/api/auth",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refresh_token", { path: "/api/auth" });
}

function error(res, status, msg, meta) {
  return res.status(status).json({
    error: msg,
    ...(meta ? { meta } : {}),
  });
}

// ------------ controller ------------
const authController = {
  register: async (req, res) => {
    try {
      const email = toEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const name = String(req.body?.name || "").trim();

      if (!email || !password)
        return error(res, 400, "Email and password are required");
      if (!isEmail(email)) return error(res, 400, "Invalid email format");
      if (!isStrongEnoughPassword(password))
        return error(res, 400, "Password must be at least 8 characters");

      const existing = await User.findOne({ email });
      if (existing) return error(res, 400, "Email already registered");

      // Create user
      const user = new User({
        email,
        password,
        name,
        roles: ["user"],
        profile:
          req.body?.profile && typeof req.body.profile === "object"
            ? req.body.profile
            : undefined,
      });

      await user.save();

      const token = signAccessToken(user);

      // Optional refresh token cookie (only if jwtRefreshSecret exists)
      const refresh = signRefreshToken(user);
      if (refresh) setRefreshCookie(res, refresh);

      return res.status(201).json({
        user: publicUser(user),
        token,
      });
    } catch (err) {
      // Handle duplicate key just in case (race condition)
      if (err?.code === 11000)
        return error(res, 400, "Email already registered");
      console.error(err);
      return error(res, 500, "Registration failed");
    }
  },

  login: async (req, res) => {
    try {
      const email = toEmail(req.body?.email);
      const password = String(req.body?.password || "");

      if (!email || !password)
        return error(res, 400, "Email and password are required");

      const user = await User.findOne({ email });
      if (!user) return error(res, 400, "Invalid credentials");

      const isMatch = await user.comparePassword(password);
      if (!isMatch) return error(res, 400, "Invalid credentials");

      const token = signAccessToken(user);

      const refresh = signRefreshToken(user);
      if (refresh) setRefreshCookie(res, refresh);

      return res.json({
        user: publicUser(user),
        token,
      });
    } catch (err) {
      console.error(err);
      return error(res, 500, "Login failed");
    }
  },

  // Call this if you enable refresh tokens (cookie-based)
  refresh: async (req, res) => {
    try {
      if (!config.jwtRefreshSecret)
        return error(res, 501, "Refresh tokens are not configured");

      const rt = req.cookies?.refresh_token;
      if (!rt) return error(res, 401, "Missing refresh token");

      let payload;
      try {
        payload = jwt.verify(rt, config.jwtRefreshSecret);
      } catch {
        clearRefreshCookie(res);
        return error(res, 401, "Invalid refresh token");
      }

      if (payload?.tokenType !== "refresh")
        return error(res, 401, "Invalid refresh token");

      const user = await User.findById(payload.id);
      if (!user) {
        clearRefreshCookie(res);
        return error(res, 401, "Invalid refresh token");
      }

      const token = signAccessToken(user);
      const refresh = signRefreshToken(user); // rotate
      if (refresh) setRefreshCookie(res, refresh);

      return res.json({ token, user: publicUser(user) });
    } catch (err) {
      console.error(err);
      return error(res, 500, "Refresh failed");
    }
  },

  logout: async (req, res) => {
    clearRefreshCookie(res);
    return res.json({ ok: true });
  },

  getMe: async (req, res) => {
    try {
      if (!req.user?.id) return error(res, 401, "Unauthorized");
      const user = await User.findById(req.user.id).select("-password");
      if (!user) return error(res, 404, "User not found");
      return res.json({ user: publicUser(user) });
    } catch (err) {
      console.error(err);
      return error(res, 500, "Unable to fetch user");
    }
  },

  // Useful for HuntFlow: user updates job preferences & profile
  updateMe: async (req, res) => {
    try {
      if (!req.user?.id) return error(res, 401, "Unauthorized");

      const patch = {};
      if (typeof req.body?.name === "string") patch.name = req.body.name.trim();

      // Only allow safe profile fields
      if (req.body?.profile && typeof req.body.profile === "object") {
        patch.profile = req.body.profile;
      }

      const user = await User.findByIdAndUpdate(req.user.id, patch, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) return error(res, 404, "User not found");
      return res.json({ user: publicUser(user) });
    } catch (err) {
      console.error(err);
      return error(res, 500, "Unable to update user");
    }
  },
};

export default authController;

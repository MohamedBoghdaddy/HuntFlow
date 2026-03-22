// src/controllers/authController.js
// Updated + fixed + enhanced
// Fixes: user.comparePassword is not a function (supports lean/plain objects)
// Enhancements: consistent validation, optional refresh cookies, safe profile patch, change password, better errors

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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

const VALID_PROFILE_KEYS = new Set([
  "title",
  "seniority",
  "locations",
  "links",
  "authorization",
  "salaryExpectation",
  "preferences",
]);

function pickProfilePatch(profile) {
  if (!profile || typeof profile !== "object") return undefined;

  const out = {};
  for (const [k, v] of Object.entries(profile)) {
    if (!VALID_PROFILE_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, roles: user.roles || ["user"] },
    config.jwtSecret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function signRefreshToken(user) {
  if (!config.jwtRefreshSecret) return null;
  return jwt.sign(
    { id: user._id, tokenType: "refresh" },
    config.jwtRefreshSecret,
    { expiresIn: JWT_REFRESH_EXPIRES_IN },
  );
}

function setRefreshCookie(req, res, refreshToken) {
  if (!refreshToken) return;

  const isProd = process.env.NODE_ENV === "production";
  const isHttps =
    isProd ||
    String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https";

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isHttps,
    path: "/api/auth",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refresh_token", { path: "/api/auth" });
}

function error(res, status, msg, meta) {
  return res.status(status).json({ error: msg, ...(meta ? { meta } : {}) });
}

async function verifyPassword(user, candidate) {
  // Works for:
  // - real mongoose doc with method
  // - plain object (lean/aggregate) without method
  if (user && typeof user.comparePassword === "function") {
    return user.comparePassword(candidate);
  }
  return bcrypt.compare(candidate, user.password);
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
      if (existing) return error(res, 409, "Email already registered");

      const profilePatch = pickProfilePatch(req.body?.profile);

      const user = new User({
        email,
        password,
        name,
        roles: ["user"],
        ...(profilePatch ? { profile: profilePatch } : {}),
      });

      await user.save();

      const token = signAccessToken(user);
      const refresh = signRefreshToken(user);
      if (refresh) setRefreshCookie(req, res, refresh);

      return res.status(201).json({ user: publicUser(user), token });
    } catch (err) {
      if (err?.code === 11000)
        return error(res, 409, "Email already registered");
      console.error("register error:", err);
      return error(res, 500, "Registration failed");
    }
  },

  login: async (req, res) => {
    try {
      const email = toEmail(req.body?.email);
      const password = String(req.body?.password || "");

      if (!email || !password)
        return error(res, 400, "Email and password are required");

      // IMPORTANT: do NOT add .lean() here
      const user = await User.findOne({ email });
      if (!user) return error(res, 400, "Invalid credentials");

      const isMatch = await verifyPassword(user, password);
      if (!isMatch) return error(res, 400, "Invalid credentials");

      const token = signAccessToken(user);
      const refresh = signRefreshToken(user);
      if (refresh) setRefreshCookie(req, res, refresh);

      return res.json({ user: publicUser(user), token });
    } catch (err) {
      console.error("login error:", err);
      return error(res, 500, "Login failed");
    }
  },

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

      if (payload?.tokenType !== "refresh") {
        clearRefreshCookie(res);
        return error(res, 401, "Invalid refresh token");
      }

      const user = await User.findById(payload.id);
      if (!user) {
        clearRefreshCookie(res);
        return error(res, 401, "Invalid refresh token");
      }

      const token = signAccessToken(user);
      const refresh = signRefreshToken(user);
      if (refresh) setRefreshCookie(req, res, refresh);

      return res.json({ token, user: publicUser(user) });
    } catch (err) {
      console.error("refresh error:", err);
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
      console.error("getMe error:", err);
      return error(res, 500, "Unable to fetch user");
    }
  },

  updateMe: async (req, res) => {
    try {
      if (!req.user?.id) return error(res, 401, "Unauthorized");

      const patch = {};
      if (typeof req.body?.name === "string") patch.name = req.body.name.trim();

      const profilePatch = pickProfilePatch(req.body?.profile);
      if (profilePatch) patch.profile = profilePatch;

      const user = await User.findByIdAndUpdate(req.user.id, patch, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) return error(res, 404, "User not found");
      return res.json({ user: publicUser(user) });
    } catch (err) {
      console.error("updateMe error:", err);
      return error(res, 500, "Unable to update user");
    }
  },

  // Optional: change password (handy for MVP)
  changePassword: async (req, res) => {
    try {
      if (!req.user?.id) return error(res, 401, "Unauthorized");

      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");

      if (!currentPassword || !newPassword) {
        return error(res, 400, "currentPassword and newPassword are required");
      }
      if (!isStrongEnoughPassword(newPassword)) {
        return error(res, 400, "Password must be at least 8 characters");
      }

      const user = await User.findById(req.user.id);
      if (!user) return error(res, 404, "User not found");

      const ok = await verifyPassword(user, currentPassword);
      if (!ok) return error(res, 400, "Invalid current password");

      user.password = newPassword; // pre-save hook will hash
      await user.save();

      return res.json({ ok: true });
    } catch (err) {
      console.error("changePassword error:", err);
      return error(res, 500, "Unable to change password");
    }
  },
};

export default authController;

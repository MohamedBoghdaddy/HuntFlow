// src/middleware/authMiddleware.js (ADD THIS if you don't have it)

import jwt from "jsonwebtoken";
import config from "../config/index.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.id, email: payload.email, roles: payload.roles || ["user"] };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
import jwt from "jsonwebtoken";
import config from "../config/index.js";

// Middleware to validate JWT token and attach user info to request object
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

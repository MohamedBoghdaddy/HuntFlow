import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import MongoStore from "connect-mongo";

import config from "./config/index.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

const app = express();

if (!config.sessionSecret) {
  throw new Error("SESSION_SECRET is missing. Set it in Render env vars.");
}
if (!config.mongoUrl) {
  throw new Error("MONGO_URL is missing. Set it in Render env vars.");
}

// Enable CORS for all origins by default; customise for production.
app.use(
  cors({
    origin: ["http://localhost:5173", "https://hunterflow.netlify.app"],
    credentials: true,
  }),
);
// Logging HTTP requests in development.
if (config.env !== "test") {
  app.use(morgan("dev"));
}

// Parse JSON and urlencoded bodies.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session management. Uses MongoDB-backed session store for persistence.
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    proxy: true,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: config.mongoUrl, // <-- uses MONGO_URL from .env via config
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "none", // cross-site cookies (Netlify -> Render)
      secure: true, // required when sameSite is none
    },
  }),
);

// Mount application routes.
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);

// Health check endpoint.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Catch-all handler for unknown routes.
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// Generic error handler.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  console.error("ERROR:", {
    status,
    message,
    stack: err.stack,
  });

  res.status(status).json({ error: message });
});

export default app;

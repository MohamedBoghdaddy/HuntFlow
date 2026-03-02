import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import config from "./config/index.js";
import cookieParser from "cookie-parser";

// Route handlers – in a real application these would contain full
// implementations for authentication and user profile management. They are
// stubbed here for completeness.
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import cvRoutes from "./routes/cvRoutes.js";
import trackRoutes from "./routes/trackRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();
app.use(cookieParser());

// Ensure critical config values are present. This is validated in
// config/index.js but an additional check is left here for clarity.
if (!config.sessionSecret) {
  throw new Error("SESSION_SECRET is missing. Set it in your environment.");
}
if (!config.mongoUrl) {
  throw new Error("MONGO_URL is missing. Set it in your environment.");
}

// Configure CORS. Allow the configured frontend origin plus common local
// development hosts. Origin matching is exact: no trailing slashes.
const CLIENT_URL = process.env.CLIENT_URL || config.clientUrl;
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://hunterflow.netlify.app",
  CLIENT_URL,
].filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    // Allow server‑to‑server/Postman/curl (no origin)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "Expires",
    "x-request-id",
    "Accept",
    "X-Requested-With",
  ],
  exposedHeaders: ["Content-Disposition", "Content-Type"],
};
app.use(cors(corsOptions));
// Preflight requests (use SAME options)
app.options("*", cors(corsOptions));

// Logging
if (config.env !== "test") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session management (Mongo-backed)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    proxy: true,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: config.mongoUrl }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      sameSite: "none", // allow cross-site cookies for frontend
      secure: true, // required when sameSite is none
    },
  }),
);

// Register API routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
// CRUD endpoints for CVs
app.use("/api/cvs", cvRoutes);
// CRUD endpoints for tracks
app.use("/api/tracks", trackRoutes);
// CRUD endpoints for chats with the career coach AI
app.use("/api/chats", chatRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// 404 handler
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  console.error("ERROR:", { status, message, stack: err.stack });
  res.status(status).json({ error: message });
});

export default app;
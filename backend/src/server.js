import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import config from "./config/index.js";

import applicationRoutes from "./routes/applicationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import cvRoutes from "./routes/cvRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import trackRoutes from "./routes/trackRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cookieParser());

// Validate critical env/config values
if (!config.sessionSecret) {
  throw new Error("SESSION_SECRET is missing. Set it in your environment.");
}

if (!config.mongoUrl) {
  throw new Error("MONGO_URL is missing. Set it in your environment.");
}

// CORS setup
const CLIENT_URL = process.env.CLIENT_URL || config.clientUrl;
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://hunterflow.netlify.app",
  CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
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
app.options("*", cors(corsOptions));

// Logging
if (config.env !== "test") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static uploads
app.use("/uploads", express.static("uploads"));

// Session management
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    proxy: true,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: config.mongoUrl }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    },
  }),
);

// Routes
app.use("/api/applications", applicationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/cv", cvRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/tracks", trackRoutes);

// Health check
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

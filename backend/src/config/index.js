import dotenv from "dotenv";

// Load environment variables from a `.env` file into process.env
// This allows configuration to be specified outside of code and keeps
// sensitive values such as database URIs and secrets out of source control.
dotenv.config();

// A set of environment variables that must be present at runtime. If any of
// these are missing the application will exit immediately with a clear
// error message. This prevents the server from starting in an invalid
// configuration state.
const required = ["MONGO_URL", "SESSION_SECRET", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

// Centralised configuration object. Exposes key values used throughout the
// backend. Computed properties fall back to sensible defaults when not
// provided.
const config = {
  // Node environment (development, production, etc.)
  env: process.env.NODE_ENV || "development",
  // Port the Express server listens on. Render sets `PORT`; locally
  // default to 4000.
  port: Number(process.env.PORT) || 4000,
  // Public URL of the backend. Useful for logs/links and constructed
  // automatically when running locally. Can be overridden via BACKEND_URL.
  backendUrl:
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://huntflow-up9r.onrender.com"
      : `http://localhost:${Number(process.env.PORT) || 4000}`),
  // Frontend origin permitted via CORS. When deploying set CLIENT_URL to
  // the Netlify/Render frontend; otherwise fallback to local dev port 5173.
  clientUrl:
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://hunterflow.netlify.app"
      : "http://localhost:5173"),
  // MongoDB connection string. Required and validated above.
  mongoUrl: process.env.MONGO_URL,
  // JWT secret used to sign and verify authentication tokens.
  jwtSecret: process.env.JWT_SECRET,
  // Session secret used by express-session to sign session identifiers.
  sessionSecret: process.env.SESSION_SECRET,
  // Redis connection string used by queues or caching. Default to local
  // Redis instance if not provided.
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export default config;
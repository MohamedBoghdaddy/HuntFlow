import dotenv from "dotenv";
dotenv.config();

const required = ["MONGO_URL", "SESSION_SECRET", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const config = {
  env: process.env.NODE_ENV || "development",

  // Render sets PORT; locally default to 4000
  port: Number(process.env.PORT) || 4000,

  // Public URL of backend (optional but useful for logs/links)
  // Set BACKEND_URL on Render to: https://huntflow-up9r.onrender.com
  backendUrl:
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://huntflow-up9r.onrender.com"
      : `http://localhost:${Number(process.env.PORT) || 4000}`),

  // CORS allowed frontend origin (optional but recommended)
  // Set CLIENT_URL on Render to: https://hunterflow.netlify.app
  clientUrl:
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://hunterflow.netlify.app"
      : "http://localhost:5173"),

  mongoUrl: process.env.MONGO_URL,
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET,

  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export default config;

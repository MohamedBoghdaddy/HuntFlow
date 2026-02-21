import dotenv from "dotenv";
dotenv.config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  
  mongoUrl: process.env.MONGO_URL, // <-- IMPORTANT
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET,

  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

const required = ["MONGO_URL", "SESSION_SECRET", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export default config;

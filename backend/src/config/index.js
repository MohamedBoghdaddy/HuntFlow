import dotenv from "dotenv";
dotenv.config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 4000,

  mongoUrl: process.env.MONGO_URL, // <-- IMPORTANT
  jwtSecret: process.env.JWT_SECRET ,
  sessionSecret: process.env.SESSION_SECRET,

  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

if (!config.mongoUrl) {
  console.warn("⚠️  Missing MONGO_URL in .env");
}

export default config;

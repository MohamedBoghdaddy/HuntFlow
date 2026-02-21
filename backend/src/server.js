/*
 * Entry point for the backend service. Connects to MongoDB and starts
 * the Express server.
 */

import mongoose from "mongoose";
import app from "./app.js";
import config from "./config/index.js";

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

async function startServer() {
  try {
    const mongoUrl =
      config.mongoUrl || process.env.MONGO_URL || process.env.MONGODB_URI;
    if (!mongoUrl) {
      throw new Error(
        "Missing Mongo connection string. Set MONGO_URL (Render env var).",
      );
    }

    const port = Number(process.env.PORT) || Number(config.port) || 4000;

    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB");

    app.listen(port, "0.0.0.0", () => {
      console.log(
        `Server running in ${config.env || process.env.NODE_ENV || "production"} mode on port ${port}`,
      );
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

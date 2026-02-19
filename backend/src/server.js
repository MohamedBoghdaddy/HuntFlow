/*
 * Entry point for the backend service. Connects to MongoDB and starts
 * the Express server. Also initialises background job queue(s).
 */

import mongoose from "mongoose";
import app from "./app.js";
import config from "./config/index.js";

async function startServer() {
  try {
    if (!config.mongoUrl) {
      throw new Error("MONGO_URL is missing in .env");
    }

    // Connect to MongoDB
    await mongoose.connect(config.mongoUrl);
    console.log("Connected to MongoDB");

    // Start HTTP server
    app.listen(config.port, () => {
      console.log(
        `Server running in ${config.env} mode on port ${config.port}`,
      );
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

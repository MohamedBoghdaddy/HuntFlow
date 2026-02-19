import Queue from "bull";
import config from "../config/index.js";

/**
 * Application queue handles asynchronous submission of job applications
 * via official ATS APIs or AI-assisted browser automation. Jobs enqueued
 * here should contain the application ID, target job, and any required
 * authentication/metadata to perform the submission. Workers will handle
 * network calls, retries with backoff and update application status on
 * completion or failure.
 */
const applicationQueue = new Queue("application-submission", config.redisUrl);

export default applicationQueue;

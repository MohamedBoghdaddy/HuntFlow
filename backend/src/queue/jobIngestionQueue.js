import Queue from "bull";
import config from "../config/index.js";

/**
 * Job ingestion queue for pulling jobs from external sources and ATS boards.
 * Workers listening on this queue should perform data fetch, normalize
 * the job schema, dedupe and persist into the database. This queue runs
 * on Redis, enabling horizontal scaling and delayed retries.
 */
const jobIngestionQueue = new Queue("job-ingestion", config.redisUrl);

// Example job processor registration (to be implemented in separate worker)
// jobIngestionQueue.process(async (job) => {
//   const { source } = job.data;
//   // Fetch jobs from the specified source and save to DB
// });

export default jobIngestionQueue;

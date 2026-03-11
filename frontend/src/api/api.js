import React, { useEffect, useRef, useState } from "react";
import { api, nodeClient, normalizeApiError } from "../api/api";

export default function JobSearch() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const jobsCacheRef = useRef({});

  const loadCache = () => {
    if (Object.keys(jobsCacheRef.current).length > 0) return;

    const raw = sessionStorage.getItem("jobsCache");
    if (!raw) return;

    try {
      jobsCacheRef.current = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("jobsCache");
      jobsCacheRef.current = {};
    }
  };

  const saveCache = () => {
    sessionStorage.setItem("jobsCache", JSON.stringify(jobsCacheRef.current));
  };

  const clearCache = () => {
    jobsCacheRef.current = {};
    sessionStorage.removeItem("jobsCache");
  };

  const fetchJobs = async (forcedSearch = search) => {
    setLoading(true);
    setMessage("");

    try {
      loadCache();

      const cacheKey = (forcedSearch || "").trim().toLowerCase();

      if (jobsCacheRef.current[cacheKey]) {
        setJobs(jobsCacheRef.current[cacheKey]);
        return;
      }

      const payload = {
        query: forcedSearch?.trim() || "software engineer",
        limit: 20,
      };

      const response = await api.py.jobs.search(payload);

      const result =
        response?.data?.jobs || response?.data?.results || response?.data || [];

      const normalizedJobs = Array.isArray(result) ? result : [];

      setJobs(normalizedJobs);
      jobsCacheRef.current[cacheKey] = normalizedJobs;
      saveCache();
    } catch (err) {
      console.error("Failed to fetch jobs", err);
      setJobs([]);
      setMessage(normalizeApiError(err) || "Error fetching jobs");
    } finally {
      setLoading(false);
    }
  };

  const syncJobs = async () => {
    setSyncing(true);
    setMessage("Syncing jobs...");

    try {
      const response = await nodeClient.post("/jobs/sync");
      const created = response?.data?.created || 0;

      setMessage(`Imported ${created} new jobs`);
      clearCache();
      await fetchJobs(search);
    } catch (err) {
      console.error("Failed to sync jobs", err);
      setMessage(normalizeApiError(err) || "Error syncing jobs");
    } finally {
      setSyncing(false);
    }
  };

  const saveJob = async (jobId) => {
    try {
      const response = await nodeClient.post("/applications", { jobId });

      if (response?.status >= 200 && response?.status < 300) {
        setMessage("Job saved to your applications");
      } else {
        setMessage("Error saving job");
      }
    } catch (err) {
      console.error("Failed to save job", err);
      setMessage(normalizeApiError(err) || "Error saving job");
    }
  };

  useEffect(() => {
    fetchJobs("");
  }, []);

  return (
    <div>
      <h2>Job Search</h2>

      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs"
        />

        <button onClick={() => fetchJobs(search)} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>

        <button onClick={syncJobs} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync External Jobs"}
        </button>
      </div>

      {message && <p>{message}</p>}

      {loading ? (
        <p>Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p>No jobs found.</p>
      ) : (
        <table width="100%" border="1" cellPadding="4" cellSpacing="0">
          <thead>
            <tr>
              <th>Title</th>
              <th>Company</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => (
              <tr key={job._id || job.id || `${job.title}-${index}`}>
                <td>{job.title || "-"}</td>
                <td>{job.company || "-"}</td>
                <td>{job.location || "-"}</td>
                <td>
                  <button
                    onClick={() => saveJob(job._id || job.id)}
                    disabled={!job._id && !job.id}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

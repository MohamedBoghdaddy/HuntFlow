import React, { useEffect, useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Component for searching jobs and saving them to applications.
export default function JobSearch() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // In‑memory cache for job results keyed by search term. Persisted to
  // sessionStorage so that reloading the page does not require re-fetching
  // previously loaded results. Keys are the search string (empty string
  // represents the default "all" search). Values are arrays of job objects.
  const jobsCacheRef = useRef({});

  // Fetch jobs from the API based on the current search query.
  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Determine cache key. Use empty string for no search term.
      const cacheKey = search || '';
      // Load cache from sessionStorage on first use
      if (Object.keys(jobsCacheRef.current).length === 0) {
        const raw = sessionStorage.getItem('jobsCache');
        if (raw) {
          try {
            jobsCacheRef.current = JSON.parse(raw);
          } catch (err) {
            // If parsing fails, clear the stored cache
            sessionStorage.removeItem('jobsCache');
            jobsCacheRef.current = {};
          }
        }
      }
      // Return cached data if available
      if (jobsCacheRef.current[cacheKey]) {
        setJobs(jobsCacheRef.current[cacheKey]);
        return;
      }
      const url = new URL(`${API_BASE}/jobs`);
      if (search) {
        url.searchParams.set('search', search);
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      const result = data.jobs || [];
      setJobs(result);
      // Store in cache
      jobsCacheRef.current[cacheKey] = result;
      sessionStorage.setItem('jobsCache', JSON.stringify(jobsCacheRef.current));
    } catch (err) {
      console.error('Failed to fetch jobs', err);
      setMessage('Error fetching jobs');
    } finally {
      setLoading(false);
    }
  };

  // Synchronise jobs from external sources (e.g. Remotive) into the backend.
  const syncJobs = async () => {
    setMessage('Syncing jobs...');
    try {
      const res = await fetch(`${API_BASE}/jobs/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      setMessage(`Imported ${data.created || 0} new jobs`);
      // Clear the local cache when new jobs are imported, then re-fetch
      jobsCacheRef.current = {};
      sessionStorage.removeItem('jobsCache');
      await fetchJobs();
    } catch (err) {
      console.error('Failed to sync jobs', err);
      setMessage('Error syncing jobs');
    }
  };

  // Save a job as an application. Requires an auth token in localStorage.
  const saveJob = async (jobId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('You must be logged in to save jobs');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Job saved to your applications');
      } else {
        setMessage(data.error || 'Error saving job');
      }
    } catch (err) {
      console.error('Failed to save job', err);
      setMessage('Error saving job');
    }
  };

  // Fetch jobs on initial load
  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div>
      <h2>Job Search</h2>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs"
        />
        <button onClick={() => fetchJobs()}>Search</button>
        <button onClick={() => syncJobs()}>Sync External Jobs</button>
      </div>
      {message && <p>{message}</p>}
      {loading ? (
        <p>Loading jobs...</p>
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
            {jobs.map((job) => (
              <tr key={job._id}>
                <td>{job.title}</td>
                <td>{job.company}</td>
                <td>{job.location || '-'}</td>
                <td>
                  <button onClick={() => saveJob(job._id)}>Save</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
// frontend/src/pages/JobDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Container, Typography, Paper, Button, Stack } from "@mui/material";
import { api, normalizeApiError } from "../api/api";

function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  const cacheKey = useMemo(
    () => `hf_job_${decodeURIComponent(id || "")}`,
    [id],
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const raw =
          typeof window !== "undefined"
            ? sessionStorage.getItem(cacheKey)
            : null;
        if (raw) {
          const cached = JSON.parse(raw);
          if (alive) setJob(cached);
        } else {
          if (alive) setJob(null);
        }
      } catch {
        if (alive) setJob(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [cacheKey]);

  const getJobId = (j) =>
    j?.job_url || j?.apply_url || j?.url || decodeURIComponent(id || "");

  const handleSave = async () => {
    try {
      const jobId = getJobId(job);
      await api.node.applications.create({ jobId });
      alert("Job saved to your pipeline");
    } catch (err) {
      alert(normalizeApiError(err));
    }
  };

  const handleApply = async () => {
    const url = job?.apply_url || job?.job_url || job?.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    alert("Apply link not available for this job yet");
  };

  return (
    <Container maxWidth="md">
      {loading ? (
        <Typography>Loading...</Typography>
      ) : !job ? (
        <Typography>Job not found</Typography>
      ) : (
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            {job.title || "Job"}
          </Typography>

          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {job.company || ""}
            {job.location ? ` - ${job.location}` : ""}
          </Typography>

          {job.posted_at && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Posted: {job.posted_at}
            </Typography>
          )}

          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", mb: 2 }}>
            {job.description ||
              job.description_snippet ||
              "No description provided."}
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleApply}>
              Apply
            </Button>
          </Stack>
        </Paper>
      )}
    </Container>
  );
}

export default JobDetail;

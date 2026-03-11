import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Container, Grid, Paper, Typography, Button } from "@mui/material";
import apiClient, { normalizeApiError, api as hfApi } from "../api/api";

function Dashboard() {
  const [jobCount, setJobCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function fetchData() {
      try {
        const jobsRes = await hfApi.py.jobs.search({
          query: "software",
          countries: ["eg", "ae", "sa", "eu"],
          pages: 1,
          results_per_page: 5,
          remote_only: false,
        });

        const jobsCount =
          jobsRes?.data?.count ??
          jobsRes?.count ??
          jobsRes?.data?.jobs?.length ??
          jobsRes?.jobs?.length ??
          0;

        const appsRes = await apiClient.get("/applications");

        const apps =
          appsRes?.data?.applications ||
          appsRes?.data?.items ||
          appsRes?.data?.data?.applications ||
          appsRes?.data ||
          [];

        if (!alive) return;

        setJobCount(jobsCount);
        setApplicationCount(Array.isArray(apps) ? apps.length : 0);
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
        if (alive) {
          alert(normalizeApiError(err));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchData();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h5">{jobCount}</Typography>
              <Typography variant="body2" gutterBottom>
                Jobs Found
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/jobs"
                size="small"
              >
                Discover
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h5">{applicationCount}</Typography>
              <Typography variant="body2" gutterBottom>
                Applications
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/applications"
                size="small"
              >
                View
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h5">Profile</Typography>
              <Typography variant="body2" gutterBottom>
                Update your details
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/profile"
                size="small"
              >
                Edit
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h5">Docs</Typography>
              <Typography variant="body2" gutterBottom>
                Manage resumes
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/profile"
                size="small"
              >
                View
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

export default Dashboard;

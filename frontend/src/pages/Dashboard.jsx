import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Grid, Paper, Typography, Button, Box } from '@mui/material';
import api from '../api/api';

/**
 * Dashboard summarises the user's activity: number of jobs available,
 * applications saved/applied and quick navigation actions. This page
 * fetches counts from the backend API when mounted.
 */
function Dashboard() {
  const [jobCount, setJobCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch total jobs (we only need the count)
        const jobsRes = await api.get('/jobs', { params: { limit: 1 } });
        setJobCount(jobsRes.data.total || 0);
        // Fetch applications for this user
        const appsRes = await api.get('/applications');
        setApplicationCount(appsRes.data.applications.length);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h5">{jobCount}</Typography>
              <Typography variant="body2" gutterBottom>
                Jobs Available
              </Typography>
              <Button variant="contained" component={RouterLink} to="/jobs" size="small">
                Discover
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h5">{applicationCount}</Typography>
              <Typography variant="body2" gutterBottom>
                Applications
              </Typography>
              <Button variant="contained" component={RouterLink} to="/applications" size="small">
                View
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h5">Profile</Typography>
              <Typography variant="body2" gutterBottom>
                Update your details
              </Typography>
              <Button variant="contained" component={RouterLink} to="/profile" size="small">
                Edit
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h5">Docs</Typography>
              <Typography variant="body2" gutterBottom>
                Manage resumes
              </Typography>
              <Button variant="contained" component={RouterLink} to="/profile" size="small">
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
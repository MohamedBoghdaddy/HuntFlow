import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Box,
} from '@mui/material';
import api from '../api/api';

/**
 * ApplicationTracker displays the user's applications grouped by their
 * current status (saved, queued, applied, interview, offer, rejected).
 * Users can advance the status of an application via buttons. Drag
 * and drop could be added in a future iteration.
 */
function ApplicationTracker() {
  const statuses = ['saved', 'queued', 'applied', 'interview', 'offer', 'rejected'];
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApps() {
      try {
        const res = await api.get('/applications');
        setApplications(res.data.applications);
      } catch (err) {
        console.error('Failed to fetch applications', err);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, []);

  // Update an application's status and refresh state
  const moveToStatus = async (applicationId, newStatus) => {
    try {
      await api.put(`/applications/${applicationId}`, { status: newStatus });
      setApplications((prev) =>
        prev.map((app) => (app._id === applicationId ? { ...app, status: newStatus } : app)),
      );
    } catch (err) {
      console.error('Failed to update application status', err);
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  // Group applications by status
  const grouped = statuses.reduce((acc, status) => {
    acc[status] = applications.filter((app) => app.status === status);
    return acc;
  }, {});

  // Determine the next status in the pipeline for a given status
  const nextStatus = (status) => {
    const idx = statuses.indexOf(status);
    return idx >= 0 && idx < statuses.length - 1 ? statuses[idx + 1] : null;
  };

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" gutterBottom>
        Applications Tracker
      </Typography>
      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <Grid container spacing={2}>
          {statuses.map((status) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={status}>
              <Paper elevation={3} sx={{ p: 2, minHeight: '60vh' }}>
                <Typography variant="h6" align="center" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {status}
                </Typography>
                <Stack spacing={1}>
                  {grouped[status].length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center">
                      None
                    </Typography>
                  ) : (
                    grouped[status].map((app) => (
                      <Box key={app._id} sx={{ border: '1px solid #eee', borderRadius: 1, p: 1 }}>
                        <Typography variant="subtitle2">{app.job?.title || 'Unknown'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {app.job?.company}
                        </Typography>
                        {nextStatus(app.status) && (
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            sx={{ mt: 1 }}
                            onClick={() => moveToStatus(app._id, nextStatus(app.status))}
                          >
                            Move to {nextStatus(app.status)}
                          </Button>
                        )}
                      </Box>
                    ))
                  )}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default ApplicationTracker;
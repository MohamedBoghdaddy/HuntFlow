import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Button,
  Box,
  Stack,
} from '@mui/material';
import api from '../api/api';

/**
 * JobDetail shows the full details of a selected job. Users can save
 * it to their applications pipeline or proceed to an apply flow (not
 * implemented yet).
 */
function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await api.get(`/jobs/${id}`);
        setJob(res.data.job);
      } catch (err) {
        console.error('Failed to fetch job', err);
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [id]);

  const handleSave = async () => {
    try {
      await api.post('/applications', { jobId: id });
      alert('Job saved to your pipeline');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save application';
      alert(msg);
    }
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
            {job.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {job.company} {job.location ? `- ${job.location}` : ''}
          </Typography>
          {job.salary && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Salary: {job.salary?.min || ''}–{job.salary?.max || ''} {job.salary?.currency || ''}
            </Typography>
          )}
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
            {job.description || 'No description provided.'}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={() => alert('Apply flow not implemented')}>Apply</Button>
          </Stack>
        </Paper>
      )}
    </Container>
  );
}

export default JobDetail;
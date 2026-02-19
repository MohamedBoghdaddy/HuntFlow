import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Pagination,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

/**
 * JobFeed page lists available jobs with a simple search bar. Users can
 * browse through pages and save interesting roles to their pipeline.
 */
function JobFeed() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/jobs', { params: { page, search, limit: 12 } });
      setJobs(res.data.jobs);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchJobs();
  };

  const handleSave = async (jobId) => {
    try {
      await api.post('/applications', { jobId });
      alert('Job saved to your pipeline');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save application';
      alert(msg);
    }
  };

  const pageCount = Math.ceil(total / 12);

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Discover Jobs
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Search by title or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
        />
        <Button variant="contained" onClick={handleSearch}>
          Search
        </Button>
      </Stack>
      {loading ? (
        <Typography>Loading...</Typography>
      ) : jobs.length === 0 ? (
        <Typography>No jobs found</Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {jobs.map((job) => (
              <Grid item key={job._id} xs={12} sm={6} md={4}>
                <Paper elevation={2} sx={{ p: 2, cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} onClick={() => navigate(`/jobs/${job._id}`)}>
                  <div>
                    <Typography variant="h6">{job.title}</Typography>
                    <Typography variant="subtitle2" color="text.secondary">
                      {job.company}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {job.location || 'Remote'}
                    </Typography>
                  </div>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave(job._id);
                    }}
                    sx={{ mt: 1 }}
                  >
                    Save
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
          {pageCount > 1 && (
            <Stack alignItems="center" sx={{ mt: 3 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}
    </Container>
  );
}

export default JobFeed;
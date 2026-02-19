import React from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Landing page serves as the marketing site entry point. It briefly
 * explains the product value proposition and provides calls to action
 * for registration and login.
 */
function Landing() {
  return (
    <Container maxWidth="md" sx={{ textAlign: 'center', py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Streamline Your Job Search with AI
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        HuntFlow helps you discover, evaluate and apply to roles faster. Upload
        your resume, set your preferences and let our AI do the heavy
        lifting—while you stay in control.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
        <Button variant="contained" color="primary" component={RouterLink} to="/register">
          Get Started
        </Button>
        <Button variant="outlined" color="primary" component={RouterLink} to="/login">
          Sign In
        </Button>
      </Stack>
    </Container>
  );
}

export default Landing;
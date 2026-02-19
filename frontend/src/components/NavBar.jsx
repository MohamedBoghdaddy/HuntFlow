import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * NavBar renders a responsive top navigation bar using Material UI. It
 * adapts based on whether the user is authenticated, showing
 * appropriate links (dashboard, jobs, applications, profile) or just
 * login/register. It also provides a logout button.
 */
function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static" color="primary" sx={{ mb: 2 }}>
      <Toolbar>
        <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
          HuntFlow
        </Typography>
        {user ? (
          <Stack direction="row" spacing={2}>
            <Button color="inherit" component={RouterLink} to="/dashboard">
              Dashboard
            </Button>
            <Button color="inherit" component={RouterLink} to="/jobs">
              Discover Jobs
            </Button>
            <Button color="inherit" component={RouterLink} to="/applications">
              Applications
            </Button>
            <Button color="inherit" component={RouterLink} to="/profile">
              Profile
            </Button>
            <Button color="inherit" onClick={handleLogout}>
              Logout
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={2}>
            <Button color="inherit" component={RouterLink} to="/login">
              Login
            </Button>
            <Button color="inherit" component={RouterLink} to="/register">
              Register
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default NavBar;
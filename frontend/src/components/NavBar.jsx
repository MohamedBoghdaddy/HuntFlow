import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
      setMobileOpen(false);
    }
  };

  const authLinks = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Discover Jobs", to: "/jobs" },
    { label: "Career Coach", to: "/career-coach" },
    { label: "Applications", to: "/applications" },
    { label: "Profile", to: "/profile" },
  ];

  const guestLinks = [
    { label: "Login", to: "/login" },
    { label: "Register", to: "/register" },
  ];

  const links = user ? authLinks : guestLinks;

  const navButtonSx = {
    color: "inherit",
    borderRadius: 2,
    px: 1.5,
    "&.active": {
      bgcolor: "rgba(255,255,255,0.16)",
    },
  };

  const drawerContent = (
    <Box sx={{ width: 260 }} role="presentation" onClick={handleDrawerToggle}>
      <Box sx={{ px: 2, py: 2 }}>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            textDecoration: "none",
            color: "text.primary",
            fontWeight: 700,
          }}
        >
          HuntFlow
        </Typography>
      </Box>

      <Divider />

      <List>
        {links.map((link) => (
          <ListItemButton key={link.to} component={RouterLink} to={link.to}>
            <ListItemText primary={link.label} />
          </ListItemButton>
        ))}

        {user && (
          <ListItemButton onClick={handleLogout}>
            <ListItemText primary="Logout" />
          </ListItemButton>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" color="primary" elevation={1} sx={{ mb: 3 }}>
        <Toolbar sx={{ minHeight: 70 }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              color: "inherit",
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            HuntFlow
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            {links.map((link) => (
              <Button
                key={link.to}
                component={NavLink}
                to={link.to}
                sx={navButtonSx}
              >
                {link.label}
              </Button>
            ))}

            {user && (
              <Button
                color="inherit"
                onClick={handleLogout}
                sx={{
                  borderRadius: 2,
                  px: 1.5,
                  ml: 1,
                  border: "1px solid rgba(255,255,255,0.25)",
                }}
              >
                Logout
              </Button>
            )}
          </Stack>

          <IconButton
            color="inherit"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ display: { xs: "inline-flex", md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        sx={{ display: { xs: "block", md: "none" } }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}

export default NavBar;

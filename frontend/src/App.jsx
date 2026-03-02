// App.jsx (MERGED)
// - Combines your simple nav+routes app with the bigger auth + navbar app
// - Public routes: /, /login, /register, /search
// - Private routes: /dashboard, /jobs, /jobs/:id, /applications, /profile
// - Keeps NavBar and AuthContext PrivateRoute
// - Adds a small Loading screen while auth is resolving

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import NavBar from "./components/NavBar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import JobFeed from "./pages/JobFeed";
import JobDetail from "./pages/JobDetail";
import ApplicationTracker from "./pages/ApplicationTracker";
import Profile from "./pages/Profile";
import JobSearch from "./pages/JobSearch.jsx";

import { useAuth } from "./contexts/AuthContext";

// Private route wrapper
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Loading...</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>Checking your session</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div>
      <NavBar />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/search" element={<JobSearch />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Private */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/jobs"
          element={
            <PrivateRoute>
              <JobFeed />
            </PrivateRoute>
          }
        />

        <Route
          path="/jobs/:id"
          element={
            <PrivateRoute>
              <JobDetail />
            </PrivateRoute>
          }
        />

        <Route
          path="/applications"
          element={
            <PrivateRoute>
              <ApplicationTracker />
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

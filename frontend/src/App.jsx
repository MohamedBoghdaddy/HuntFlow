import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import NavBar from './components/NavBar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import JobFeed from './pages/JobFeed';
import JobDetail from './pages/JobDetail';
import ApplicationTracker from './pages/ApplicationTracker';
import Profile from './pages/Profile';
import { useAuth } from './contexts/AuthContext';

// A private route wrapper that redirects unauthenticated users to the login page.
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <div>
      <NavBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
        {/* Catch-all: redirect unknown routes to dashboard or landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
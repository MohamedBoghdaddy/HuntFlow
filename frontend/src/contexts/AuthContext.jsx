import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/api';

// Create a context to hold authentication state and actions.
const AuthContext = createContext();

/**
 * useAuth returns the context value for authentication. Use this hook
 * throughout the app to access the current user, token and auth actions.
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider wraps the app and provides authentication state and
 * functions. It persists the token in localStorage and fetches the
 * current user on mount.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // On mount or when token changes, attempt to fetch the current user.
  useEffect(() => {
    async function fetchUser() {
      if (token) {
        try {
          const res = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(res.data.user);
        } catch (err) {
          console.warn('Failed to fetch user:', err.response?.data || err.message);
          setToken(null);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    }
    fetchUser();
  }, [token]);

  // Perform login with email/password.
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.data.token);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  // Perform registration and auto-login.
  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    setToken(res.data.token);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  // Log the user out by clearing local state and storage.
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const value = { user, token, loading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
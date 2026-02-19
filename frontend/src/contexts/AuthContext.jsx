import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/api";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // If token changes, ensure axios interceptor will use latest token.
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // On mount, attempt to fetch the current user (if token exists)
  useEffect(() => {
    let isMounted = true;

    async function fetchUser() {
      try {
        if (!token) {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Interceptor already injects Authorization from localStorage
        const res = await api.get("/auth/me");

        if (isMounted) setUser(res.data.user);
      } catch (err) {
        console.warn(
          "Failed to fetch user:",
          err.response?.data || err.message,
        );

        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const register = async (name, email, password) => {
    const res = await api.post("/auth/register", { name, email, password });
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = { user, token, loading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.auth.login({ email, password });
    const { token: t, user: u } = res.data;
    await AsyncStorage.setItem("token", t);
    await AsyncStorage.setItem("user", JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const res = await api.auth.register({ name, email, password });
    const { token: t, user: u } = res.data;
    await AsyncStorage.setItem("token", t);
    await AsyncStorage.setItem("user", JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;

import axios from "axios";

const hostname = typeof window !== "undefined" ? window.location.hostname : "";

// 1) Prefer explicit env var override (Netlify/Vite)
const ENV_ORIGIN = import.meta?.env?.VITE_API_URL;

// 2) Fallback to hostname-based routing
const HOST_ORIGIN =
  hostname === "localhost"
    ? "http://localhost:4000"
    : hostname.includes("render")
      ? "https://huntflow-up9r.onrender.com"  
      : "https://huntflow-up9r.onrender.com";

export const API_ORIGIN = ENV_ORIGIN || HOST_ORIGIN;

// HuntFlow backend routes are mounted under /api
export const API_BASE_URL = `${API_ORIGIN}/api`;

// ✅ robust token getter (supports multiple storage formats)
const getToken = () => {
  if (typeof window === "undefined") return null;

  // 1) direct token key
  const direct =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  if (direct) return direct;

  // 2) user object (common pattern)
  const rawUser =
    localStorage.getItem("user") || sessionStorage.getItem("user");
  if (rawUser) {
    try {
      const u = JSON.parse(rawUser);
      return u?.token || u?.accessToken || u?.jwt || null;
    } catch {
      // ignore
    }
  }

  return null;
};

const clearToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("user");
};

function attachInterceptors(client) {
  client.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error),
  );

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401 && getToken()) {
        clearToken();
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const apiClient = attachInterceptors(
  axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 20000,
  }),
);

export function normalizeApiError(err) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    "Request failed"
  );
}

export default apiClient;

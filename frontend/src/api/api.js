// frontend/src/api/api.js
import axios from "axios";

const hostname = typeof window !== "undefined" ? window.location.hostname : "";

// Local defaults
const LOCAL_NODE = "http://localhost:4000";
const LOCAL_PY = "http://127.0.0.1:8000";

// Optional env overrides (Vite)
// VITE_NODE_API_URL=http://localhost:4000
// VITE_PY_API_URL=http://127.0.0.1:8000
const ENV_NODE = import.meta?.env?.VITE_NODE_API_URL;
const ENV_PY = import.meta?.env?.VITE_PY_API_URL;

// Production origin (Render)
const PROD_ORIGIN = "https://huntflow-up9r.onrender.com";

// Pick origins
export const NODE_ORIGIN =
  hostname === "localhost" ? ENV_NODE || LOCAL_NODE : PROD_ORIGIN;

export const PY_ORIGIN =
  hostname === "localhost" ? ENV_PY || LOCAL_PY : PROD_ORIGIN;

// Node routes mounted under /api, FastAPI routes are direct (/jobs, /cv, /health)
export const NODE_BASE_URL = `${NODE_ORIGIN}/api`;
export const PY_BASE_URL = PY_ORIGIN;

// Token helpers
const getToken = () => {
  if (typeof window === "undefined") return null;

  const direct =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  if (direct) return direct;

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

// Node client (auth, applications)
export const nodeClient = attachInterceptors(
  axios.create({
    baseURL: NODE_BASE_URL,
    withCredentials: true,
    timeout: 20000,
  }),
);

// Python client (jobs, cv)
export const pyClient = attachInterceptors(
  axios.create({
    baseURL: PY_BASE_URL,
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

// Convenience wrappers
export const api = {
  node: {
    auth: {
      login: (payload) => nodeClient.post("/auth/login", payload),
      register: (payload) => nodeClient.post("/auth/register", payload),
      me: () => nodeClient.get("/auth/me"),
      logout: () => nodeClient.post("/auth/logout"),
    },
    applications: {
      list: () => nodeClient.get("/applications"),
      create: (payload) => nodeClient.post("/applications", payload),
      update: (id, payload) => nodeClient.put(`/applications/${id}`, payload),
    },
  },

  py: {
    health: () => pyClient.get("/health"),
    jobs: {
      search: (payload) => pyClient.post("/jobs/search", payload),
      extract: (payload) => pyClient.post("/jobs/extract", payload),
    },
    cv: {
      atsScore: (payload) => pyClient.post("/cv/ats-score", payload),
      enhance: (payload) => pyClient.post("/cv/enhance", payload),
      resume: (payload) => pyClient.post("/cv/resume", payload),
      coach: (payload) => pyClient.post("/cv/coach", payload),
    },
  },
};

// Keep default export as the Node client for existing imports
export default nodeClient;

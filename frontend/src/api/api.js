// frontend/src/api/api.js
import axios from "axios";

const hostname = typeof window !== "undefined" ? window.location.hostname : "";

const LOCAL_NODE = "http://localhost:4000";
const LOCAL_PY = "http://127.0.0.1:8000";

const ENV_NODE = import.meta?.env?.VITE_NODE_API_URL;
const ENV_PY = import.meta?.env?.VITE_PY_API_URL;

const PROD_NODE =
  import.meta?.env?.VITE_PROD_NODE_API_URL ||
  "https://huntflow-up9r.onrender.com";

const PROD_PY =
  import.meta?.env?.VITE_PROD_PY_API_URL ||
  "https://huntflow-up9r.onrender.com";

const isLocalhost =
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";

export const NODE_ORIGIN = isLocalhost ? ENV_NODE || LOCAL_NODE : PROD_NODE;
export const PY_ORIGIN = isLocalhost ? ENV_PY || LOCAL_PY : PROD_PY;

export const NODE_BASE_URL = `${NODE_ORIGIN}/api`;
export const PY_BASE_URL = PY_ORIGIN;

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
      return null;
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

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

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

export const nodeClient = attachInterceptors(
  axios.create({
    baseURL: NODE_BASE_URL,
    withCredentials: true,
    timeout: 20000,
    headers: {
      "Content-Type": "application/json",
    },
  }),
);

export const pyClient = attachInterceptors(
  axios.create({
    baseURL: PY_BASE_URL,
    withCredentials: true,
    timeout: 20000,
    headers: {
      "Content-Type": "application/json",
    },
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
    jobs: {
      sync: () => nodeClient.post("/jobs/sync"),
    },
    profile: {
      get: () => nodeClient.get("/profile"),
      update: (payload) => nodeClient.put("/profile", payload),
    },
    chat: {
      send: (payload) => nodeClient.post("/chat/send", payload),
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

export default nodeClient;

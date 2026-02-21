import axios from "axios";

const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://huntflow-up9r.onrender.com"
    : "http://localhost:4000");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

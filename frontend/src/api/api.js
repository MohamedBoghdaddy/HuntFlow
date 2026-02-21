import axios from "axios";

const isProd = import.meta.env.PROD;

// If you want to override without code changes, you can set VITE_API_URL in Netlify/locally.
const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (isProd ? "https://huntflow-up9r.onrender.com" : "http://localhost:4000");

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

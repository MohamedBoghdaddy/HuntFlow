import axios from 'axios';

// Create an axios instance configured with the base URL pointing to the
// backend API. You can override the URL via Vite's environment variables
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
});

// Automatically attach the JWT token stored in localStorage to each
// request for authenticated endpoints. Axios interceptors allow us to
// modify config before the request is sent.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
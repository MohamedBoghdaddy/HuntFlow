import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NODE_BASE =
  process.env.EXPO_PUBLIC_NODE_API_URL ||
  "https://huntflow-up9r.onrender.com/api";

const PY_BASE =
  process.env.EXPO_PUBLIC_PY_API_URL ||
  "https://huntflow-bf7h.onrender.com";

const getToken = async () => {
  try {
    return (await AsyncStorage.getItem("token")) || null;
  } catch {
    return null;
  }
};

function attachInterceptors(client) {
  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  return client;
}

export const nodeClient = attachInterceptors(
  axios.create({
    baseURL: NODE_BASE,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
  }),
);

export const pyClient = attachInterceptors(
  axios.create({
    baseURL: PY_BASE,
    timeout: 60000,
    headers: { "Content-Type": "application/json" },
  }),
);

export const api = {
  auth: {
    login: (payload) => nodeClient.post("/auth/login", payload),
    register: (payload) => nodeClient.post("/auth/register", payload),
    me: () => nodeClient.get("/auth/me"),
  },
  jobs: {
    search: (payload) => pyClient.post("/jobs/search", payload),
    searchIngest: (payload) => nodeClient.post("/jobs/search-ingest", payload),
    match: (jobs) => nodeClient.post("/jobs/match", { jobs }),
  },
  applications: {
    list: () => nodeClient.get("/applications"),
    create: (payload) => nodeClient.post("/applications", payload),
    update: (id, payload) => nodeClient.put(`/applications/${id}`, payload),
    delete: (id) => nodeClient.delete(`/applications/${id}`),
  },
  cv: {
    latest: () => nodeClient.get("/cv/latest"),
    analyze: (payload) => nodeClient.post("/cv/analyze", payload),
    coverLetter: (payload) => nodeClient.post("/cv/cover-letter", payload),
    coach: (payload) => pyClient.post("/cv/coach", payload),
  },
  profile: {
    get: () => nodeClient.get("/profile"),
    update: (payload) => nodeClient.put("/profile", payload),
  },
};

export default nodeClient;

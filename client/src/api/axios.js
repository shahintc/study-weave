import axios from "axios";

// This instance will be the base for all API calls
const instance = axios.create({
  baseURL: "http://localhost:5200", // backend base URL
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

instance.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      const message = String(error.response?.data?.message || "").toLowerCase();
      if (message.includes("jwt expired") || message.includes("token") || message.includes("unauthorized")) {
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default instance;

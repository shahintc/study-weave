import axios from "axios";

// This instance will be the base for all API calls
const instance = axios.create({
  baseURL: "http://localhost:5200",  // backend base URL
  withCredentials: false,
  headers: { "Content-Type": "application/json" }
});

export default instance;

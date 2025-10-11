import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:5000",  // backend base URL
  withCredentials: false,
  headers: { "Content-Type": "application/json" }
});

export default instance;

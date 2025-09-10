import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // if backend requires cookies/auth
});

export default axiosInstance;

import axios from 'axios';

// Fallback to localhost if the env variable isn't found
let API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Force HTTPS in production to prevent mixed content errors
if (API_URL.startsWith("http://") && !API_URL.includes("localhost") && !API_URL.includes("127.0.0.1")) {
  API_URL = API_URL.replace("http://", "https://");
}

// Create the centralized Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

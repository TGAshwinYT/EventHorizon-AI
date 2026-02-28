import axios from 'axios';

// Fallback to localhost if the env variable isn't found
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create the centralized Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

import axios from 'axios';

// Resolves base URL dynamically:
// - Direct dev port (5173) maps to localhost:8000.
// - Gateway port (80) uses relative routing passes.
const API_BASE = window.location.port === '5173' ? 'http://localhost:8000' : '';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to dynamically inject the bearer JWT token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

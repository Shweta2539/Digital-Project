import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

// Attach auth token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('verijob_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  },
);

export default api;

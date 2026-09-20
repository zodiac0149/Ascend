import axios from 'axios';
import { supabase, getAccessToken } from './authService';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5001';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 60_000,         // 60s for long LLM calls
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token on every request
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// Global error normalisation
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message: string =
      (err.response?.data as { error?: string } | undefined)?.error ??
      err.message ??
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

export default api;

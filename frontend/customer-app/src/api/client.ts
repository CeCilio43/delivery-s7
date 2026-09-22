import axios from 'axios';
import { getStoredToken } from '../lib/token';

export const API_GATEWAY_URL: string =
  import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL: API_GATEWAY_URL });

// The gateway proxies these straight to user-service without requiring a JWT.
const PUBLIC_PATHS = ['/login', '/register'];

apiClient.interceptors.request.use((config) => {
  const isPublicPath = PUBLIC_PATHS.some((path) => config.url?.startsWith(path));
  if (!isPublicPath) {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

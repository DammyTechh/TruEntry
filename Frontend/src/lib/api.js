import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://tru-entry.vercel.app/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send/receive the httpOnly refresh cookie
  // Without a timeout a stalled request (serverless cold start, dropped
  // connection) never settles, and any screen waiting on it hangs forever.
  timeout: 20000,
});

const TOKEN_KEY = 'tru_access_token';
const REFRESH_KEY = 'tru_refresh_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Transparent refresh on 401. Queues concurrent requests during a refresh.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const isAuthRoute = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = api
            .post('/auth/refresh', { refreshToken: tokenStore.getRefresh() })
            .then((r) => {
              const tokens = r.data?.data?.tokens;
              tokenStore.set(tokens?.accessToken, tokens?.refreshToken);
              return tokens?.accessToken;
            })
            .finally(() => {
              refreshing = null;
            });
        }
        const newToken = await refreshing;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        // Refresh failed: drop the session and let the route guards redirect.
        tokenStore.clear();
        window.dispatchEvent(new Event('truentry:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

// Pull a human-readable message out of any API error.
export function errMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Please check your connection and try again.';
  }
  if (error?.message === 'Network Error') {
    return 'Could not reach the server. Please check your connection.';
  }
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.code ||
    error?.message ||
    fallback
  );
}

// Field-level validation errors -> { field: message }
export function fieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (Array.isArray(details)) {
    return details.reduce((acc, d) => {
      if (d.field) acc[d.field] = d.message;
      return acc;
    }, {});
  }
  return {};
}

export default api;

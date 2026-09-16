import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://tru-entry.vercel.app/api/v1' || 'https://api.truentry.org/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send/receive the httpOnly refresh cookie
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
        tokenStore.clear();
        if (!location.pathname.startsWith('/login')) {
          location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Pull a human-readable message out of any API error.
export function errMessage(error, fallback = 'Something went wrong. Please try again.') {
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

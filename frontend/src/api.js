import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && !['login/', 'token/refresh/'].includes(config.url) && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing;
api.interceptors.response.use((response) => response, async (error) => {
  const config = error.config;
  if (error.response?.status !== 401 || !config || config._retried
      || ['login/', 'token/refresh/'].includes(config.url)) return Promise.reject(error);
  config._retried = true;
  const refresh = localStorage.getItem('refreshToken');
  if (refresh) {
    try {
      refreshing ||= axios.post(`${api.defaults.baseURL.replace(/\/$/, '')}/token/refresh/`, { refresh })
        .then(({ data }) => {
          localStorage.setItem('accessToken', data.access);
          if (data.refresh) localStorage.setItem('refreshToken', data.refresh);
          return data.access;
        }).finally(() => { refreshing = null; });
      const token = await refreshing;
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    } catch (refreshError) {
      if (!refreshError.response || refreshError.response.status >= 500) return Promise.reject(refreshError);
    }
  }
  ['accessToken', 'refreshToken', 'userRole'].forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new Event('auth-expired'));
  return Promise.reject(error);
});

export default api;

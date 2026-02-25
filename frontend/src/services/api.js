import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
};

// Conversations API
export const conversationsAPI = {
  list: () => api.get('/conversations'),
  get: (id) => api.get(`/conversations/${id}`),
  create: (data) => api.post('/conversations', data),
  updateStatus: (id, status) => api.patch(`/conversations/${id}/status`, { status }),
  search: (term) => api.get(`/conversations/search/${term}`)
};

// Messages API
export const messagesAPI = {
  getByConversation: (conversationId) => api.get(`/messages/${conversationId}`),
  get: (conversationId) => api.get(`/messages/${conversationId}`),
  send: (conversationId, data) => api.post(`/messages/${conversationId}`, data),
  searchInConversation: (conversationId, term) =>
    api.get(`/messages/${conversationId}/search/${term}`)
};

// Summaries API
export const summariesAPI = {
  get: (conversationId) => api.get(`/summaries/${conversationId}`),
  generate: (conversationId) => api.post(`/summaries/${conversationId}/generate`),
  list: () => api.get('/summaries')
};

// Search API
export const searchAPI = {
  search: (query) => api.get(`/search?q=${encodeURIComponent(query)}`)
};

export default api;

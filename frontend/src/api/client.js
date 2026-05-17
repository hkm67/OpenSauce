import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (normalizedPath.startsWith('/oauth/') && API_BASE_URL === '/api') {
    return normalizedPath
  }
  return `${API_BASE_URL.replace(/\/$/, '')}${normalizedPath}`
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default client

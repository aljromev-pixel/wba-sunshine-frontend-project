import { apiClient } from './apiClient'

export const authService = {
  changePassword: (details) => apiClient.post('v1/auth/password', details),
  login: ({ portal = 'staff', ...credentials }) => apiClient.post(portal === 'admin' ? 'v1/auth/admin/login' : 'v1/auth/login', credentials),
  me: (options) => apiClient.get('v1/auth/me', options),
  logout: () => apiClient.post('v1/auth/logout'),
}

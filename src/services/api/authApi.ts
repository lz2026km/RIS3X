import { api } from './client'
import type { ApiResponse } from './types'

// Authentication API
// Auto-generated from NestJS @Controller('auth')

export const authApi = {
  login: (data: Record<string, unknown>) => api.post<unknown>('/auth/login', data),
  refresh: (data: Record<string, unknown>) => api.post<unknown>('/auth/refresh', data),
  totpVerify: (data: Record<string, unknown>) => api.post<unknown>('/auth/totp/verify', data),
  totpSetup: (data: Record<string, unknown>) => api.post<unknown>('/auth/totp/setup', data),
  totpDisable: (data: Record<string, unknown>) => api.post<unknown>('/auth/totp/disable', data),
  me: () => api.get<unknown>('/auth/me'),
  logout: (data: Record<string, unknown>) => api.post<unknown>('/auth/logout', data),
  change_password: (data: Record<string, unknown>) => api.post<unknown>('/auth/change-password', data),
}

export default authApi

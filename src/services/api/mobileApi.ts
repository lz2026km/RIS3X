import { api } from './client'
import type { ApiResponse } from './types'

// Mobile API
// Auto-generated from NestJS @Controller('mobile')

export const mobileApi = {
  jscode2session: () => api.get<unknown>('/mobile/jscode2session'),
}

export default mobileApi

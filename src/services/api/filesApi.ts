import { api } from './client'
import type { ApiResponse } from './types'

// File upload API
// Auto-generated from NestJS @Controller('files')

export const filesApi = {
  upload_url: () => api.get<unknown>('/files/upload-url'),
  upload_complete: (data: Record<string, unknown>) => api.post<unknown>('/files/upload-complete', data),
}

export default filesApi

import { api } from './api/client'
import type { ApiResponse } from './api/types'

export interface DocumentUploadData {
  criticalValueId: string
  file: File
  name: string
}

export const documentService = {
  async upload(data: DocumentUploadData): Promise<ApiResponse<{ id: string; url: string }>> {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('criticalValueId', data.criticalValueId)
    formData.append('name', data.name)
    return api.post<{ id: string; url: string }>('/files/upload', formData)
  },
}

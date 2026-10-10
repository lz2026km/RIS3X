import { api } from './api/client'
import type { ApiResponse } from './api/types'

export interface FollowUpData {
  patientId: string
  criticalValueId: string
  followUpDate: string
  notes?: string
}

export const followUpService = {
  async create(data: FollowUpData): Promise<ApiResponse<{ id: string }>> {
    return api.post('/followups', data)
  },
}

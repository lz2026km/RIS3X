import { api } from './client'

export interface HealthCheckResponse {
  status: string
  version: string
  timestamp: number
}

export interface HealthReadyResponse {
  status: string
  db: boolean
  cache: boolean
  queues: Record<string, boolean>
  version: string
}

export const healthApi = {
  check: () =>
    api.get<HealthCheckResponse>('/health'),

  ready: () =>
    api.get<HealthReadyResponse>('/health/ready'),
}

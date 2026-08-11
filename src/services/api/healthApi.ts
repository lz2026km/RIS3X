import { api } from './client'

// [v3.0.6.11-88] 健康检查基建 (保留): 后端有 /health、/health/ready 路由
// (backend/src/health), 供 System 运维页/启动探活/测试使用; 当前无页面直接引用。
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

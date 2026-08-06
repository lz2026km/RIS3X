import { api } from './client'


/**
 * G005 RIS v3.0.6.11-75 - mobileApi 与后端 /mobile 对齐
 * 真实后端端点 (backend/src/mobile/mobile.controller.ts):
 *   GET  /mobile/jscode2session         (微信登录换 token, @Public)
 *   GET  /mobile/today-summary          (今日概览)
 *   GET  /mobile/worklist?status=       (工作列表, status: pending|reading|reported)
 *   GET  /mobile/critical-values        (危急值列表)
 *   POST /mobile/critical-values/:id/ack (危急值确认)
 *   GET  /mobile/reports/latest?limit=  (最新报告)
 *   POST /mobile/device-token           (设备 token 注册)
 */

export interface WorklistItem {
  id: string
  accessionNumber: string
  patientId: string
  patientName: string
  gender: string | null
  age: number | null
  modality: string
  bodyPart: string
  status: 'pending' | 'reading' | 'reported' | string
  state: string
  urgency: 'critical' | 'urgent' | 'routine' | string
  scheduledAt: string | null
}

export interface TodaySummary {
  examsToday: number
  pendingExams: number
  inProgressExams: number
  criticalValues: number
  reportsToday: number
  signedReportsToday: number
  date: string
}

export interface CriticalValueItem {
  id: string
  patientName: string
  gender: string | null
  age: number | null
  description: string
  severity: string
  state: string
  method: string | null
  notifiedTo: string | null
  accessionNumber: string | null
  modality: string | null
  createdAt: string | null
  ackedAt: string | null
}

export interface AckResult {
  id: string
  state: string
  ackedAt: string | null
  ackedBy?: string | null
}

export interface LatestReportItem {
  id: string
  patientName: string
  gender: string | null
  modality: string | null
  bodyPart: string | null
  accessionNumber: string | null
  state: string
  isCritical: boolean
  impression: string | null
  conclusion: string | null
  findings: string | null
  radiologistName: string | null
  signedAt: string | null
  createdAt: string | null
}

export interface DeviceTokenPayload {
  token: string
  platform?: 'android' | 'ios' | 'web'
  deviceId?: string
  userId?: string
}

export interface DeviceTokenResult {
  success: boolean
  token: string
  platform: string
  total: number
}

// ── 兼容别名 (历史类型名保持可用)
export type DoctorWorklistItem = WorklistItem
export type DoctorStats = TodaySummary

export const mobileApi = {
  jscode2session: (code: string) =>
    api.get<Record<string, unknown>>(`/mobile/jscode2session?code=${encodeURIComponent(code)}`),

  getTodaySummary: () =>
    api.get<TodaySummary>('/mobile/today-summary'),

  getWorklist: (params?: { status?: string }) =>
    api.get<WorklistItem[]>(`/mobile/worklist${params?.status ? `?status=${encodeURIComponent(params.status)}` : ''}`),

  getCriticalValues: () =>
    api.get<CriticalValueItem[]>('/mobile/critical-values'),

  ackCriticalValue: (id: string, ackedBy?: string) =>
    api.post<AckResult>(`/mobile/critical-values/${encodeURIComponent(id)}/ack`, { ackedBy }),

  getReportsLatest: (limit = 10) =>
    api.get<LatestReportItem[]>(`/mobile/reports/latest?limit=${limit}`),

  registerDeviceToken: (dto: DeviceTokenPayload) =>
    api.post<DeviceTokenResult>('/mobile/device-token', dto),

  // ── 兼容别名 (历史调用方): 医生工作台 = worklist; 医生统计 = today-summary
  getDoctorWorklist: (params?: { status?: string; search?: string }) =>
    mobileApi.getWorklist({ status: params?.status }),

  getDoctorStats: () =>
    mobileApi.getTodaySummary(),
}

export default mobileApi

import { api } from './client'

// Department Dashboard (科室看板) API
// Backend: /dept-dashboard/*

export interface DeptDashboardSummary {
  departmentId: string
  departmentName: string
  date: string
  totalPatients: number
  totalStudies: number
  totalReports: number
  avgReportTime: number
  avgTurnaroundTime: number
  pendingReports: number
  criticalValues: number
  equipmentUtilization: number
}

export interface DeptDashboardWorkload {
  doctorId: string
  doctorName: string
  reportCount: number
  avgTime: number
  qualityScore: number
}

export interface DeptDashboardEquipment {
  deviceId: string
  deviceName: string
  status: 'online' | 'offline' | 'maintenance'
  utilization: number
  studyCount: number
  avgStudyTime: number
}

export interface DeptDashboardTrend {
  date: string
  studyCount: number
  reportCount: number
  avgTurnaround: number
  utilization: number
}

export interface DeptDashboardQueryParams {
  departmentId?: string
  startDate?: string
  endDate?: string
}

export const deptDashboardApi = {
  getSummary: (params?: DeptDashboardQueryParams) =>
    api.get<DeptDashboardSummary>(`/dept-dashboard/summary?${new URLSearchParams(params ?? {}).toString()}`),

  getWorkload: (params?: DeptDashboardQueryParams) =>
    api.get<DeptDashboardWorkload[]>(`/dept-dashboard/workload?${new URLSearchParams(params ?? {}).toString()}`),

  getEquipment: (params?: { departmentId?: string }) =>
    api.get<DeptDashboardEquipment[]>(`/dept-dashboard/equipment?${new URLSearchParams(params ?? {}).toString()}`),

  getTrend: (params?: DeptDashboardQueryParams & { days?: number }) =>
    api.get<DeptDashboardTrend[]>(`/dept-dashboard/trend?${new URLSearchParams(params ?? {}).toString()}`),

  getAlerts: (params?: { departmentId?: string; limit?: number }) =>
    api.get<{ id: string; type: string; message: string; severity: string; createdAt: string }[]>(`/dept-dashboard/alerts?${new URLSearchParams(params ?? {}).toString()}`),
}

import { api } from './client'

export interface ComplianceReport {
  status: string
  compliant: boolean
  score: number
  checks: Array<{ id: string; name: string; passed: boolean; detail?: string }>
  generatedAt: string
}

export interface TenantFeatures {
  aiOrchestration: boolean
  biDashboard: boolean
  doseManagement: boolean
  vna: boolean
  similarCases: boolean
  environmentReport: boolean
  mobileApp: boolean
  teleRadiology: boolean
}

export interface TenantProfile {
  id: string
  code: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  license: string
  maxUsers: number
  maxStorageGb: number
  maxExams: number
  features: TenantFeatures
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TenantUsage {
  users: number
  patients: number
  exams: number
  reports: number
  storageBytes: number
  storageLimitBytes: number
  examLimit: number
  userLimit: number
}

export const tenantApi = {
  getComplianceReport: () =>
    api.get<ComplianceReport>('/compliance/report'),

  // ─────────── 当前租户 ───────────
  getCurrent: () =>
    api.get<TenantProfile>('/tenant/current'),
  getUsage: () =>
    api.get<TenantUsage>('/tenant/usage'),
  updateProfile: (body: Partial<Pick<TenantProfile, 'name' | 'license' | 'maxUsers' | 'maxStorageGb' | 'config'>>) =>
    api.put<TenantProfile>('/tenant/profile', body),
  getFeatures: () =>
    api.get<TenantFeatures>('/tenant/features'),
  updateFeatures: (body: Partial<TenantFeatures>) =>
    api.put<TenantFeatures>('/tenant/features', body),

  // ─────────── 平台管理（管理员） ───────────
  listTenants: () =>
    api.get<TenantProfile[]>('/tenant/list'),
  createTenant: (body: { code: string; name: string; license?: string; maxUsers?: number; maxStorageGb?: number }) =>
    api.post<TenantProfile>('/tenant', body),
  updateTenantStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    api.put<TenantProfile>(`/tenant/${id}/status`, { status }),
}

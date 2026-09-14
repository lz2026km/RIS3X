import { api } from './client'

// [v3.0.6.11-104 Wave 3C] 知情同意落库绑定: patientId/examId 外键 + 扩展类型 + 状态 + 见证人

export type ConsentStatus = 'pending' | 'signed' | 'refused' | 'expired'

export interface ConsentRecord {
  id: string
  patientId: string | null
  patient: string
  examId: string | null
  type: string
  procedure: string
  signedAt: string | null
  status: ConsentStatus
  witness: string | null
  witnessName: string | null
  signedBy?: string
  createdAt: string
  updatedAt?: string
}

export interface ConsentListFilter {
  patientId?: string
  examId?: string
  status?: string
  type?: string
}

export interface ConsentVerification {
  examId: string
  type: string | null
  signed: boolean
  required: boolean
  status: ConsentStatus | null
  recordId: string | null
  checkedAt: string
}

export interface CreateConsentInput {
  patient?: string
  patientId?: string
  examId?: string
  type?: string
  procedure?: string
  witnessName?: string
}

export interface SignConsentInput {
  signer?: string
  witnessName?: string
}

export interface EducationMaterialDto {
  id: string
  title: string
  lang: string
  category: string
  pages: number
  views: number
  format: string
  content?: string
  summary?: string
  createdAt: string
}

function buildQuery(filter?: ConsentListFilter): string {
  if (!filter) return ''
  const params = new URLSearchParams()
  if (filter.patientId) params.set('patientId', filter.patientId)
  if (filter.examId) params.set('examId', filter.examId)
  if (filter.status) params.set('status', filter.status)
  if (filter.type) params.set('type', filter.type)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// [v3.0.6.11-88 Round10] 补封装 records(5) + education-materials(3) 新路径
//   与后端 consent-education.controller 对齐: 前端现有 /consents /materials 别名保留兼容
export const consentEducationApi = {
  // ===== Records (后端新路径 /consent-education/records*) =====
  listRecords: (filter?: ConsentListFilter) =>
    api.get<ConsentRecord[]>(`/consent-education/records${buildQuery(filter)}`),

  createRecord: (data: CreateConsentInput) =>
    api.post<ConsentRecord>('/consent-education/records', data),

  getRecord: (id: string) => api.get<ConsentRecord>(`/consent-education/records/${id}`),

  updateRecord: (id: string, data: Partial<ConsentRecord>) =>
    api.patch<ConsentRecord>(`/consent-education/records/${id}`, data),

  // 兼容旧签名 signRecord(id, signer?) 与新签名 signRecord(id, { signer, witnessName })
  signRecord: (id: string, signerOrPayload?: string | SignConsentInput) => {
    const payload: SignConsentInput =
      typeof signerOrPayload === 'string' ? { signer: signerOrPayload } : (signerOrPayload ?? {})
    return api.post<ConsentRecord>(`/consent-education/records/${id}/sign`, payload)
  },

  // GET /consent-education/verify?examId=&type= — 增强检查/对比剂注射前同意校验
  verify: (examId: string, type?: string) => {
    const params = new URLSearchParams({ examId })
    if (type) params.set('type', type)
    return api.get<ConsentVerification>(`/consent-education/verify?${params.toString()}`)
  },

  // ===== Education Materials (后端新路径 /consent-education/education-materials*) =====
  listEducationMaterials: () => api.get<EducationMaterialDto[]>('/consent-education/education-materials'),

  getEducationMaterial: (id: string) =>
    api.get<EducationMaterialDto>(`/consent-education/education-materials/${id}`),

  createEducationMaterial: (data: Partial<EducationMaterialDto>) =>
    api.post<EducationMaterialDto>('/consent-education/education-materials', data),

  updateEducationMaterial: (id: string, data: Partial<EducationMaterialDto>) =>
    api.patch<EducationMaterialDto>(`/consent-education/education-materials/${id}`, data),

  // ===== 兼容别名 (consents / materials) =====
  listConsents: (filter?: ConsentListFilter) =>
    api.get<ConsentRecord[]>(`/consent-education/consents${buildQuery(filter)}`),

  createConsent: (data: CreateConsentInput) =>
    api.post<ConsentRecord>('/consent-education/consents', data),

  updateConsent: (id: string, data: Partial<ConsentRecord>) =>
    api.patch<ConsentRecord>(`/consent-education/consents/${id}`, data),

  listMaterials: () => api.get<EducationMaterialDto[]>('/consent-education/materials'),

  createMaterial: (data: Partial<EducationMaterialDto>) =>
    api.post<EducationMaterialDto>('/consent-education/materials', data),
}

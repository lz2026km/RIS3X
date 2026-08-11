import { api } from './client'

export interface ConsentRecord {
  id: string
  patient: string
  type: string
  procedure: string
  signedAt: string | null
  status: 'signed' | 'pending' | 'refused'
  witness: string | null
  createdAt: string
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

// [v3.0.6.11-88 Round10] 补封装 records(5) + education-materials(3) 新路径
//   与后端 consent-education.controller 对齐: 前端现有 /consents /materials 别名保留兼容
export const consentEducationApi = {
  // ===== Records (后端新路径 /consent-education/records*) =====
  listRecords: () => api.get<ConsentRecord[]>('/consent-education/records'),

  createRecord: (data: { patient?: string; type?: string; procedure?: string }) =>
    api.post<ConsentRecord>('/consent-education/records', data),

  getRecord: (id: string) => api.get<ConsentRecord>(`/consent-education/records/${id}`),

  updateRecord: (id: string, data: Partial<ConsentRecord>) =>
    api.patch<ConsentRecord>(`/consent-education/records/${id}`, data),

  signRecord: (id: string, signer?: string) =>
    api.post<ConsentRecord>(`/consent-education/records/${id}/sign`, { signer }),

  // ===== Education Materials (后端新路径 /consent-education/education-materials*) =====
  listEducationMaterials: () => api.get<EducationMaterialDto[]>('/consent-education/education-materials'),

  getEducationMaterial: (id: string) =>
    api.get<EducationMaterialDto>(`/consent-education/education-materials/${id}`),

  createEducationMaterial: (data: Partial<EducationMaterialDto>) =>
    api.post<EducationMaterialDto>('/consent-education/education-materials', data),

  updateEducationMaterial: (id: string, data: Partial<EducationMaterialDto>) =>
    api.patch<EducationMaterialDto>(`/consent-education/education-materials/${id}`, data),

  // ===== 兼容别名 (consents / materials) =====
  listConsents: () => api.get<ConsentRecord[]>('/consent-education/consents'),

  createConsent: (data: { patient: string; type: string; procedure: string }) =>
    api.post<ConsentRecord>('/consent-education/consents', data),

  updateConsent: (id: string, data: Partial<ConsentRecord>) =>
    api.patch<ConsentRecord>(`/consent-education/consents/${id}`, data),

  listMaterials: () => api.get<EducationMaterialDto[]>('/consent-education/materials'),

  createMaterial: (data: Partial<EducationMaterialDto>) =>
    api.post<EducationMaterialDto>('/consent-education/materials', data),
}

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

export const consentEducationApi = {
  listConsents: () => api.get<ConsentRecord[]>('/consent-education/consents'),

  createConsent: (data: { patient: string; type: string; procedure: string }) =>
    api.post<ConsentRecord>('/consent-education/consents', data),

  updateConsent: (id: string, data: Partial<ConsentRecord>) =>
    api.patch<ConsentRecord>(`/consent-education/consents/${id}`, data),

  listMaterials: () => api.get<EducationMaterialDto[]>('/consent-education/materials'),

  createMaterial: (data: Partial<EducationMaterialDto>) =>
    api.post<EducationMaterialDto>('/consent-education/materials', data),
}

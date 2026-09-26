import { api, invalidateApiCache } from './client'
import type { ReportCertificateDto, ReportSignatureDto, ReportSignatureVerificationDto } from './reportApi'

// [G005 W8-Report] 证书中心 API — 后端 backend/src/modules/report-sign-v2/report-signing.controller.ts
//   certificates list/get/revoke; crl; signatures stats/get/verify

export interface CertificateListEnvelope {
  source: 'demo' | 'database'
  generatedAt: string
  total: number
  data: ReportCertificateDto[]
}

export interface CrlViewDto {
  issuer: string
  algorithm: string
  thisUpdate: string
  nextUpdate: string
  entryCount: number
  entries: Array<{ serial: string; revocationDate: string; reason: string }>
}

export interface SignatureListEnvelope {
  reportId: string
  signed: boolean
  signature: ReportSignatureDto | null
  history: ReportSignatureDto[]
}

export interface SignatureStatsDto {
  total: number
  valid: number
  superseded: number
  revoked: number
  reports: number
}

export const certificateApi = {
  listCertificates: (params?: { status?: 'valid' | 'revoked'; keyword?: string }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.keyword) sp.set('keyword', params.keyword)
    return api.get<CertificateListEnvelope>(`/report-signing/certificates${sp.toString() ? `?${sp.toString()}` : ''}`)
  },

  getCertificate: (serial: string) => api.get<ReportCertificateDto>(`/report-signing/certificates/${encodeURIComponent(serial)}`),

  revokeCertificate: async (serial: string, reason: string) => {
    const res = await api.post<ReportCertificateDto>(`/report-signing/certificates/${encodeURIComponent(serial)}/revoke`, { reason })
    await invalidateApiCache('/report-signing/certificates')
    return res
  },

  getCrl: () => api.get<CrlViewDto>('/report-signing/crl'),

  getSignatureStats: () => api.get<SignatureStatsDto>('/report-signing/signatures/stats'),

  getSignatures: (reportId: string) => api.get<SignatureListEnvelope>(`/report-signing/signatures/${encodeURIComponent(reportId)}`),

  verify: (reportId: string, body?: { signatureId?: string }) =>
    api.post<ReportSignatureVerificationDto>(`/report-signing/signatures/${encodeURIComponent(reportId)}/verify`, body ?? {}),
}

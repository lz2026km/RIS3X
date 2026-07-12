import { api } from './client'

export type SignatureAlgorithm = 'RSA-SHA256' | 'SM2-SM3'
export type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'revoked'

export interface CACertificateDto {
  id: string
  certId: string
  holderName: string
  holderTitle: string
  holderIdNumber: string
  algorithm: SignatureAlgorithm
  issuer: string
  validFrom: string
  validTo: string
  status: CertificateStatus
  serialNumber: string
  fingerprint: string
  usageCount: number
  lastUsedAt?: string
}

export interface SignDocumentRequest {
  reportId: string
  certId: string
  algorithm: SignatureAlgorithm
}

export interface SignDocumentResult {
  reportId: string
  verificationCode: string
  signedAt: string
  algorithm: SignatureAlgorithm
}

export interface VerifySignatureRequest {
  reportId: string
  verificationCode: string
}

export interface VerifySignatureResult {
  valid: boolean
  reportId: string
  signerName: string
  signedAt: string
  algorithm: SignatureAlgorithm
  certStatus: CertificateStatus
}

export interface SignatureRecord {
  id: string
  reportId: string
  certId: string
  holderName: string
  algorithm: SignatureAlgorithm
  signedAt: string
  verificationCode: string
}

export interface CaConfig {
  defaultAlgorithm: SignatureAlgorithm
  autoTimestamp: boolean
  requireCertChain: boolean
  blockchainAnchor: boolean
  maxSignaturesPerDay: number
}

export interface CaHistoryEntry {
  id: string
  action: string
  operator: string
  target: string
  detail: string
  createdAt: string
}

export const caApi = {
  listCertificates: () =>
    api.get<CACertificateDto[]>('/ca/certificates'),

  uploadCertificate: (data: Partial<CACertificateDto>) =>
    api.post<CACertificateDto>('/ca/certificates', data),

  revokeCertificate: (id: string) =>
    api.delete<void>(`/ca/certificates/${id}`),

  signDocument: (data: SignDocumentRequest) =>
    api.post<SignDocumentResult>('/ca/sign', data),

  listSignatures: () =>
    api.get<SignatureRecord[]>('/ca/signatures'),

  verifySignature: (data: VerifySignatureRequest) =>
    api.post<VerifySignatureResult>('/ca/verify', data),

  getCaConfig: () =>
    api.get<CaConfig>('/ca/config'),

  updateCaConfig: (data: CaConfig) =>
    api.put<CaConfig>('/ca/config', data),

  getCaHistory: () =>
    api.get<CaHistoryEntry[]>('/ca/history'),
}

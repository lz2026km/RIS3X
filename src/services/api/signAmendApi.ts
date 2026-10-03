// [v3.0.6.8-49] PR5: CA 签名 + 修订 API client
import { api } from './client';

// ============= CA 签名 =============
export interface CertificateDto {
  id: string;
  serialNumber: string;
  subject: {
    commonName: string;
    userId: string;
    department: string;
    title: string;
  };
  issuer: string;
  validFrom: string;
  validTo: string;
  status: 'valid' | 'expired' | 'revoked' | 'suspended';
  algorithm: 'SM2' | 'RSA-2048' | 'RSA-4096' | 'ECDSA-P256';
  usage: 'signing' | 'encryption' | 'both';
}

export const signApi = {
  listCertificates: (params?: { status?: string; pageSize?: number }) =>
    api.get<CertificateDto[]>(`/sign/certs?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  requestCertificate: (data: { commonName: string; userId: string; department: string; title: string; algorithm?: string }) =>
    api.post<CertificateDto>('/sign/certs', data),

  revokeCertificate: (id: string, data: { reason: string }) =>
    api.post<{ id: string; status: 'revoked' }>(`/sign/certs/${id}/revoke`, data),

  // 用证书签名报告
  signReport: (reportId: string, data: { certificateId: string; reportHash: string }) =>
    api.post<{ reportId: string; signatureHash: string; signedAt: string }>(`/sign/reports/${reportId}/sign`, data),

  verifySignature: (signatureHash: string) =>
    api.get<{ valid: boolean; signer: string; signedAt: string; reportId?: string }>(`/sign/verify/${signatureHash}`),

  // 时间戳
  issueTimestamp: (data: { dataHash: string; reportId?: string }) =>
    api.post<{ timestamp: string; tsaSig: string; tsaId: string }>('/sign/timestamp', data),

  // 区块链存证
  getBlockchainProof: (reportId: string) =>
    api.get<{ reportId: string; txHash: string; blockNumber: number; chain: string; createdAt: string }>(`/sign/blockchain/proofs?reportId=${reportId}`),
};

// ============= 修订 =============
export interface AmendmentDto {
  id: string;
  reportId: string;
  version: number;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'rejected' | 'archived';
  reason: string;
  changes?: string;
  authorId: string;
  authorName: string;
  reviewerId?: string;
  startTime: string;
  completedTime?: string;
}

export const amendApi = {
  listAmendments: (params?: { status?: string; reportId?: string; pageSize?: number }) =>
    api.get<AmendmentDto[]>(`/amend?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getAmendment: (id: string) =>
    api.get<AmendmentDto>(`/amend/${id}`),

  startAmendment: (reportId: string, data: { reason: string }) =>
    api.post<AmendmentDto>('/amend/start', { reportId, ...data }),

  // [G005 W4A] 报告补发: 创建与父报告关联的独立文档
  createSupplement: (data: { parentReportId: string; reportId?: string; reason: string; changes?: string }) =>
    api.post<AmendmentDto & { linkedTo?: string }>('/amend/supplement', data),

  // [G005 W4A] 查询某父报告下的补发记录
  listSupplements: (parentReportId: string) =>
    api.get<AmendmentDto[]>(`/amend/supplements/${encodeURIComponent(parentReportId)}`),

  updateAmendment: (id: string, data: { changes?: string; status?: string }) =>
    api.put<AmendmentDto>(`/amend/${id}`, data),

  completeAmendment: (id: string, data: { finalReason: string; changes: string }) =>
    api.post<AmendmentDto>(`/amend/${id}/complete`, data),

  approveAmendment: (id: string, data: { comment?: string }) =>
    api.post<AmendmentDto>(`/amend/${id}/approve`, data),

  rejectAmendment: (id: string, data: { reason: string }) =>
    api.post<AmendmentDto>(`/amend/${id}/reject`, data),

  getAmendmentHistory: (reportId: string) =>
    api.get<{ reportId: string; history: AmendmentDto[] }>(`/amend?reportId=${reportId}`),
};

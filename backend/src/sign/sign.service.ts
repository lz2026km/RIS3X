import { Injectable } from '@nestjs/common'

// ── [G005-P1] 在用孤儿补齐: CA 签章模块 (seed) ──
// 说明: 无 Prisma 证书模型, 采用内存 seed(风格与 MSW signHandlers 一致), 标注 demo 级数据。
// 签署任务可视为 state=SIGNING 的 Report, 此处以 seed 证书 + 状态流转模拟。

export interface Certificate {
  id: string
  serialNumber: string
  subject: { commonName: string; userId: string; department: string; title: string }
  issuer: string
  validFrom: string
  validTo: string
  status: 'valid' | 'expired' | 'revoked' | 'suspended'
  algorithm: 'SM2' | 'RSA-2048' | 'RSA-4096' | 'ECDSA-P256'
  usage: 'signing' | 'encryption' | 'both'
}

const ISSUER = 'G005-Hospital Root CA v1'
const now = () => new Date().toISOString()
const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

const SEED_CERTIFICATES: Certificate[] = [
  { id: 'cert-001', serialNumber: '3A7F-9D2C-1145-E0B8', subject: { commonName: '张明远', userId: 'D001', department: '放射科', title: '主任医师' }, issuer: ISSUER, validFrom: '2025-06-01T00:00:00.000Z', validTo: '2027-06-01T00:00:00.000Z', status: 'valid', algorithm: 'SM2', usage: 'both' },
  { id: 'cert-002', serialNumber: '8C1E-4B7A-93DF-2206', subject: { commonName: '李慧敏', userId: 'D002', department: '放射科', title: '副主任医师' }, issuer: ISSUER, validFrom: '2025-08-15T00:00:00.000Z', validTo: '2026-08-15T00:00:00.000Z', status: 'valid', algorithm: 'RSA-2048', usage: 'signing' },
  { id: 'cert-003', serialNumber: '2F4D-8E1B-A039-7C58', subject: { commonName: '赵雪琴', userId: 'D006', department: '超声科', title: '主任医师' }, issuer: ISSUER, validFrom: '2024-09-01T00:00:00.000Z', validTo: '2025-09-01T00:00:00.000Z', status: 'expired', algorithm: 'SM2', usage: 'both' },
  { id: 'cert-004', serialNumber: '6B5A-0FCE-7731-D49A', subject: { commonName: '王建华', userId: 'D003', department: '放射科', title: '主治医师' }, issuer: ISSUER, validFrom: '2025-04-10T00:00:00.000Z', validTo: '2027-04-10T00:00:00.000Z', status: 'valid', algorithm: 'RSA-4096', usage: 'signing' },
]

const SEED_SIGNED_REPORTS: Record<string, { signatureHash: string; signedAt: string; certificateId: string }> = {
  RP20260601001: { signatureHash: 'SIG-3A7F-20260602-140812', signedAt: '2026-06-02T14:08:12.000Z', certificateId: 'cert-002' },
}

@Injectable()
export class SignService {
  async listCertificates(params: { status?: string; pageSize?: number }) {
    let data = SEED_CERTIFICATES
    if (params.status) data = data.filter(c => c.status === params.status)
    if (params.pageSize) data = data.slice(0, params.pageSize)
    return { success: true, data }
  }

  async requestCertificate(body: { commonName: string; userId: string; department: string; title: string; algorithm?: string }) {
    const item: Certificate = {
      id: `cert-${Date.now()}`,
      serialNumber: `SER-${Date.now().toString(16).toUpperCase()}`,
      subject: { commonName: body.commonName, userId: body.userId, department: body.department, title: body.title },
      issuer: ISSUER,
      validFrom: now(),
      validTo: daysFromNow(730),
      status: 'valid',
      algorithm: (body.algorithm as Certificate['algorithm']) ?? 'RSA-2048',
      usage: 'signing',
    }
    SEED_CERTIFICATES.unshift(item)
    return { success: true, data: item }
  }

  async revokeCertificate(id: string, body: { reason: string }) {
    const item = SEED_CERTIFICATES.find(c => c.id === id)
    if (item) item.status = 'revoked'
    return { success: true, data: { id, status: 'revoked' as const, reason: body.reason, revokedAt: now() } }
  }

  async signReport(reportId: string, body: { certificateId: string; reportHash: string }) {
    const cert = SEED_CERTIFICATES.find(c => c.id === body.certificateId)
    const signatureHash = `SIG-${reportId}-${Date.now().toString(16).toUpperCase()}`
    const signedAt = now()
    if (cert) {
      SEED_SIGNED_REPORTS[reportId] = { signatureHash, signedAt, certificateId: cert.id }
    }
    return { success: true, data: { reportId, signatureHash, signedAt, signedBy: cert?.subject.commonName ?? null } }
  }

  async verifySignature(signatureHash: string) {
    const entry = Object.entries(SEED_SIGNED_REPORTS).find(([, v]) => v.signatureHash === signatureHash)
    if (!entry) {
      return { success: true, data: { valid: false, signer: '', signedAt: '', reportId: undefined } }
    }
    const [reportId, record] = entry
    const cert = SEED_CERTIFICATES.find(c => c.id === record.certificateId)
    return { success: true, data: { valid: true, signer: cert?.subject.commonName ?? '', signedAt: record.signedAt, reportId } }
  }

  async issueTimestamp(body: { dataHash: string; reportId?: string }) {
    return {
      success: true,
      data: {
        timestamp: now(),
        tsaSig: `TSA-${body.dataHash.slice(0, 8).toUpperCase()}-${Date.now().toString(16)}`,
        tsaId: 'G005-TSA-01',
        reportId: body.reportId ?? null,
      },
    }
  }

  async getBlockchainProof(reportId: string) {
    const data = [
      { reportId, txHash: `0x${'a3f5b7c9'.repeat(8)}`, blockNumber: 18429501, chain: 'G005-hospital-chain', createdAt: '2026-06-02T14:09:00.000Z' },
    ]
    return { success: true, data }
  }
}

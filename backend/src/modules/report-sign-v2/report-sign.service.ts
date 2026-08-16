// [G005 v3.0.6.11-101 Wave 6A F8] 电子签名 V2 服务 — 签名申请/审批/记录 + 状态流转
// 状态机: pending → approved(含 sign 记录) | rejected | cancelled; 记录含 签署人/时间/报告哈希
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ReportWatermarkService } from './report-watermark.service'

export type SignKind = 'doctor' | 'reviewer' | 'co-signer'
export type SignStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface SignRecord {
  id: string
  action: 'apply' | 'approve' | 'reject' | 'cancel' | 'sign'
  actorId: string
  actorName: string
  note: string
  at: string
}

export interface SignRequest {
  id: string
  reportId: string
  reportTitle: string
  kind: SignKind
  applicantId: string
  applicantName: string
  signerId: string
  signerName: string
  reason: string
  status: SignStatus
  reportHash: string
  signedAt?: string
  signedById?: string
  signedByName?: string
  approveNote?: string
  rejectReason?: string
  createdAt: string
  updatedAt: string
  records: SignRecord[]
}

export interface SignStats {
  total: number
  byStatus: Record<string, number>
  pending: number
  approved: number
  rejected: number
  cancelled: number
  signedToday: number
}

const SIGN_KINDS: SignKind[] = ['doctor', 'reviewer', 'co-signer']
const SIGN_STATUSES: SignStatus[] = ['pending', 'approved', 'rejected', 'cancelled']

export const SIGNER_USERS = [
  { id: 'u-001', name: '张主任' },
  { id: 'u-002', name: '李医生' },
  { id: 'u-003', name: '王技师' },
  { id: 'u-004', name: '赵审核' },
]

export const SEED_SIGN_REPORTS = [
  { id: 'RPT-1001', title: '胸部 CT 平扫增强' },
  { id: 'RPT-1002', title: '头颅 MRI 平扫' },
  { id: 'RPT-1003', title: '腹部超声' },
  { id: 'RPT-1004', title: '乳腺钼靶' },
]

@Injectable()
export class ReportSignService {
  private readonly logger = new Logger(ReportSignService.name)
  private signs: SignRequest[] = []
  private idCounter = 0

  constructor(
    private readonly watermark: ReportWatermarkService,
    private readonly prisma?: PrismaService,
  ) {
    this.seed()
  }

  private seed(): void {
    const now = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()
    const mk = (id: string, p: Omit<SignRequest, 'id' | 'records' | 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }, records: SignRecord[]): SignRequest => ({
      id,
      ...p,
      createdAt: p.createdAt ?? now(300),
      updatedAt: p.updatedAt ?? now(300),
      records,
    })
    this.signs = [
      mk(
        'sg-001',
        {
          reportId: 'RPT-1001',
          reportTitle: '胸部 CT 平扫增强',
          kind: 'co-signer',
          applicantId: 'u-002',
          applicantName: '李医生',
          signerId: 'u-001',
          signerName: '张主任',
          reason: '疑难病例双签名',
          status: 'approved',
          reportHash: this.watermark.hashReportText('RPT-1001', '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影。'),
          signedAt: now(60),
          signedById: 'u-001',
          signedByName: '张主任',
          approveNote: '同意, 建议 6 个月后复查。',
          createdAt: now(240),
          updatedAt: now(60),
        },
        [
          { id: 'rec-001', action: 'apply', actorId: 'u-002', actorName: '李医生', note: '提交双签名申请', at: now(240) },
          { id: 'rec-002', action: 'approve', actorId: 'u-001', actorName: '张主任', note: '同意', at: now(90) },
          { id: 'rec-003', action: 'sign', actorId: 'u-001', actorName: '张主任', note: '已完成电子签名', at: now(60) },
        ],
      ),
      mk(
        'sg-002',
        {
          reportId: 'RPT-1002',
          reportTitle: '头颅 MRI 平扫',
          kind: 'reviewer',
          applicantId: 'u-002',
          applicantName: '李医生',
          signerId: 'u-004',
          signerName: '赵审核',
          reason: '终审签名',
          status: 'pending',
          reportHash: this.watermark.hashReportText('RPT-1002', '左侧基底节区见腔隙性梗死灶。'),
          createdAt: now(45),
          updatedAt: now(45),
        },
        [{ id: 'rec-004', action: 'apply', actorId: 'u-002', actorName: '李医生', note: '提交终审签名', at: now(45) }],
      ),
      mk(
        'sg-003',
        {
          reportId: 'RPT-1003',
          reportTitle: '腹部超声',
          kind: 'doctor',
          applicantId: 'u-003',
          applicantName: '王技师',
          signerId: 'u-002',
          signerName: '李医生',
          reason: '补充签名',
          status: 'rejected',
          reportHash: this.watermark.hashReportText('RPT-1003', '肝内见数个无回声区。'),
          rejectReason: '报告内容需补充胆囊描述',
          createdAt: now(500),
          updatedAt: now(420),
        },
        [
          { id: 'rec-005', action: 'apply', actorId: 'u-003', actorName: '王技师', note: '提交签名申请', at: now(500) },
          { id: 'rec-006', action: 'reject', actorId: 'u-002', actorName: '李医生', note: '报告内容需补充胆囊描述', at: now(420) },
        ],
      ),
    ]
    this.idCounter = 100
  }

  private nextId(): string {
    this.idCounter += 1
    return `sg-${this.idCounter}`
  }

  private nextRecordId(): string {
    return `rec-${this.idCounter}-${this.signs.length + 1}`
  }

  private cloneSign(s: SignRequest): SignRequest {
    return { ...s, records: s.records.map((r) => ({ ...r })) }
  }

  private findSign(id: string): SignRequest {
    const sign = this.signs.find((s) => s.id === id)
    if (!sign) throw new NotFoundException(`签名申请 ${id} 不存在`)
    return sign
  }

  private async persistAudit(action: string, detail: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma?.auditLog.create({ data: { action, resource: 'report-sign', detail: detail as Prisma.InputJsonValue, tenantId: 'tenant-demo' } })
    } catch (err) {
      this.logger.warn(`[ReportSign] persist ${action} failed (seed 回退): ${(err as Error).message}`)
    }
  }

  private now(): string {
    return new Date().toISOString()
  }

  list(reportId?: string): { source: 'database' | 'demo'; generatedAt: string; data: SignRequest[] } {
    const data = this.signs
      .filter((s) => !reportId || s.reportId === reportId)
      .map((s) => this.cloneSign(s))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { source: 'demo', generatedAt: this.now(), data }
  }

  get(id: string): SignRequest {
    return this.cloneSign(this.findSign(id))
  }

  apply(body: {
    reportId: string
    reportTitle?: string
    kind: SignKind
    applicantId?: string
    applicantName?: string
    signerId: string
    reason?: string
    reportText?: string
  }): SignRequest {
    if (!body.reportId?.trim()) throw new BadRequestException('reportId 不能为空')
    if (!SIGN_KINDS.includes(body.kind)) throw new BadRequestException(`签名类型必须为 ${SIGN_KINDS.join('|')}`)
    const signer = SIGNER_USERS.find((u) => u.id === body.signerId) ?? SIGNER_USERS[1]!
    const applicant = SIGNER_USERS.find((u) => u.id === body.applicantId) ?? SIGNER_USERS[0]!
    const reportTitle =
      body.reportTitle?.trim() ||
      SEED_SIGN_REPORTS.find((r) => r.id === body.reportId)?.title ||
      '放射诊断报告'
    const now = this.now()
    const sign: SignRequest = {
      id: this.nextId(),
      reportId: body.reportId.trim(),
      reportTitle,
      kind: body.kind,
      applicantId: applicant.id,
      applicantName: applicant.name,
      signerId: signer.id,
      signerName: signer.name,
      reason: body.reason?.trim() || '',
      status: 'pending',
      reportHash: this.watermark.hashReportText(body.reportId.trim(), body.reportText ?? reportTitle),
      createdAt: now,
      updatedAt: now,
      records: [{ id: this.nextRecordId(), action: 'apply', actorId: applicant.id, actorName: applicant.name, note: '提交签名申请', at: now }],
    }
    this.signs.push(sign)
    void this.persistAudit('apply', { signId: sign.id, reportId: sign.reportId, kind: sign.kind })
    return this.cloneSign(sign)
  }

  approve(id: string, body: { note?: string; actorId?: string; actorName?: string }): SignRequest {
    const sign = this.findSign(id)
    if (sign.status !== 'pending') throw new BadRequestException(`当前状态 ${sign.status} 不可审批, 仅 pending 可审批`)
    const actor = SIGNER_USERS.find((u) => u.id === body.actorId) ?? SIGNER_USERS[0]!
    const now = this.now()
    sign.status = 'approved'
    sign.approveNote = body.note?.trim() || '同意'
    sign.signedAt = now
    sign.signedById = sign.signerId
    sign.signedByName = sign.signerName
    sign.updatedAt = now
    sign.records.push(
      { id: this.nextRecordId(), action: 'approve', actorId: actor.id, actorName: actor.name, note: body.note?.trim() || '审批通过', at: now },
      { id: this.nextRecordId(), action: 'sign', actorId: sign.signerId, actorName: sign.signerName, note: '已完成电子签名 (含报告哈希)', at: now },
    )
    void this.persistAudit('approve', { signId: sign.id, reportHash: sign.reportHash, signedAt: now })
    return this.cloneSign(sign)
  }

  reject(id: string, body: { reason: string; actorId?: string; actorName?: string }): SignRequest {
    const sign = this.findSign(id)
    if (sign.status !== 'pending') throw new BadRequestException(`当前状态 ${sign.status} 不可驳回`)
    if (!body.reason?.trim()) throw new BadRequestException('驳回原因不能为空')
    const actor = SIGNER_USERS.find((u) => u.id === body.actorId) ?? SIGNER_USERS[0]!
    const now = this.now()
    sign.status = 'rejected'
    sign.rejectReason = body.reason.trim()
    sign.updatedAt = now
    sign.records.push({ id: this.nextRecordId(), action: 'reject', actorId: actor.id, actorName: actor.name, note: body.reason.trim(), at: now })
    void this.persistAudit('reject', { signId: sign.id, reason: sign.rejectReason })
    return this.cloneSign(sign)
  }

  cancel(id: string, body: { reason?: string; actorId?: string; actorName?: string }): SignRequest {
    const sign = this.findSign(id)
    if (sign.status !== 'pending') throw new BadRequestException(`当前状态 ${sign.status} 不可撤销`)
    const actor = SIGNER_USERS.find((u) => u.id === body.actorId) ?? SIGNER_USERS[0]!
    const now = this.now()
    sign.status = 'cancelled'
    sign.updatedAt = now
    sign.records.push({ id: this.nextRecordId(), action: 'cancel', actorId: actor.id, actorName: actor.name, note: body.reason?.trim() || '申请已撤销', at: now })
    void this.persistAudit('cancel', { signId: sign.id })
    return this.cloneSign(sign)
  }

  getStats(): { source: 'database' | 'demo'; generatedAt: string; data: SignStats } {
    const byStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
    let signedToday = 0
    const today = new Date().toISOString().slice(0, 10)
    for (const s of this.signs) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
      if (s.status === 'approved' && s.signedAt?.slice(0, 10) === today) signedToday += 1
    }
    return {
      source: 'demo',
      generatedAt: this.now(),
      data: {
        total: this.signs.length,
        byStatus,
        pending: byStatus['pending'] ?? 0,
        approved: byStatus['approved'] ?? 0,
        rejected: byStatus['rejected'] ?? 0,
        cancelled: byStatus['cancelled'] ?? 0,
        signedToday,
      },
    }
  }
}

export { SIGN_KINDS, SIGN_STATUSES }

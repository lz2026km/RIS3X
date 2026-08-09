import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ============================================================
// [G005 Wave1A] Insurance Audits — 医保审核模块 (InsuranceAudit 表派生 + seed 回退 + 写操作)
// 前端 insuranceApi (InsuranceAuditPage): /insurance-audits
// GET list / GET :id / POST create / POST :id/approve / POST :id/reject
// ============================================================

export interface InsuranceAuditDto {
  id: string
  examId: string
  patientId: string
  patientName: string
  examItem: string
  contrastAgent?: string
  anticoagulant?: string
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  amount?: number
  auditedBy?: string
  auditedAt?: string
}

export interface InsuranceAuditInput {
  examId?: string
  patientId?: string
  patientName?: string
  examItem?: string
  contrastAgent?: string
  anticoagulant?: string
  amount?: number
  reason?: string
}

const SEED_AUDITS: InsuranceAuditDto[] = [
  { id: 'IA-001', examId: 'EXAM-001', patientId: 'P100001', patientName: '张伟', examItem: '胸部CT增强扫描', contrastAgent: '碘海醇 100ml', anticoagulant: undefined, status: 'pending', amount: 680, reason: '对比剂使用指征待核' },
  { id: 'IA-002', examId: 'EXAM-002', patientId: 'P100002', patientName: '李娜', examItem: '冠脉CTA', contrastAgent: '碘帕醇 90ml', anticoagulant: '阿司匹林', status: 'pending', amount: 1260, reason: '抗凝药物使用情况待核' },
  { id: 'IA-003', examId: 'EXAM-003', patientId: 'P100003', patientName: '王芳', examItem: '头颅MRI增强', contrastAgent: '钆喷酸葡胺 15ml', anticoagulant: undefined, status: 'approved', amount: 980, auditedBy: '医保办·王主任', auditedAt: '2026-08-06T10:00:00Z' },
  { id: 'IA-004', examId: 'EXAM-004', patientId: 'P100004', patientName: '陈丽', examItem: '腹部CT增强扫描', contrastAgent: '碘克沙醇 110ml', anticoagulant: undefined, status: 'rejected', reason: '缺临床适应症记录', amount: 720, auditedBy: '医保办·王主任', auditedAt: '2026-08-05T15:30:00Z' },
]

const memAudits: InsuranceAuditDto[] = []

function toDto(row: {
  id: string
  patientId: string | null
  invoiceId: string | null
  finding: string
  amount: unknown
  status: string
  auditor: string | null
  auditedAt: Date | null
  resolution: string | null
}): InsuranceAuditDto {
  const status = (row.status ?? 'PENDING').toUpperCase()
  return {
    id: row.id,
    examId: row.invoiceId ?? row.id,
    patientId: row.patientId ?? '',
    patientName: row.finding ? String(row.finding).split('·')[0] ?? '未知患者' : '未知患者',
    examItem: row.finding || '待核项目',
    status: status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'pending',
    reason: row.resolution ?? undefined,
    amount: typeof row.amount === 'number' ? row.amount : undefined,
    auditedBy: row.auditor ?? undefined,
    auditedAt: row.auditedAt ? new Date(row.auditedAt).toISOString() : undefined,
  }
}

@Injectable()
export class InsuranceAuditsService {
  private readonly logger = new Logger(InsuranceAuditsService.name)

  constructor(private readonly prisma: PrismaService) {}

  // GET /insurance-audits — 列表 (可按状态筛选)
  async list(status?: string): Promise<InsuranceAuditDto[]> {
    const mem = [...memAudits]
    try {
      const rows = await this.prisma.insuranceAudit.findMany({
        where: { tenantId: currentTenantId() },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      const db = rows.map(toDto)
      // 合并去重 (内存态优先, 覆盖同 id 的 DB 行)
      const byId = new Map<string, InsuranceAuditDto>()
      for (const a of [...db, ...mem]) byId.set(a.id, a)
      const combined = Array.from(byId.values())
      const filtered = status ? combined.filter((a) => a.status === status.toLowerCase()) : combined
      if (filtered.length === 0 && rows.length === 0) return this.seedList(status)
      return filtered
    } catch (err) {
      this.logger.warn(`[InsuranceAudits] DB query failed, fallback to seed: ${(err as Error).message}`)
      const filtered = status ? mem.filter((a) => a.status === status.toLowerCase()) : mem
      return filtered.length > 0 ? filtered : this.seedList(status)
    }
  }

  // GET /insurance-audits/:id
  async getById(id: string): Promise<InsuranceAuditDto> {
    const found = memAudits.find((a) => a.id === id) ?? (await this.list()).find((a) => a.id === id)
    if (!found) throw new NotFoundException(`医保审核记录 ${id} 不存在`)
    return found
  }

  // POST /insurance-audits — 创建审核记录
  async create(input: InsuranceAuditInput): Promise<InsuranceAuditDto> {
    const record: InsuranceAuditDto = {
      id: `IA-${Date.now().toString(36)}`,
      examId: input.examId ?? `EXAM-${Date.now()}`,
      patientId: input.patientId ?? '',
      patientName: input.patientName ?? '未知患者',
      examItem: input.examItem ?? '待核项目',
      contrastAgent: input.contrastAgent,
      anticoagulant: input.anticoagulant,
      status: 'pending',
      reason: input.reason,
      amount: input.amount,
    }
    memAudits.unshift(record)
    try {
      await this.prisma.insuranceAudit.create({
        data: {
          tenantId: currentTenantId(),
          patientId: record.patientId || null,
          invoiceId: record.examId,
          auditType: 'CONTRAST',
          finding: `${record.patientName}·${record.examItem}`,
          amount: (record.amount ?? 0) as never,
          status: 'PENDING',
          resolution: record.reason ?? null,
          metadata: { contrastAgent: record.contrastAgent, anticoagulant: record.anticoagulant } as never,
        } as never,
      })
    } catch (err) {
      this.logger.warn(`[InsuranceAudits] persist failed, keep in memory: ${(err as Error).message}`)
    }
    return record
  }

  // POST /insurance-audits/:id/approve
  async approve(id: string, auditor?: string): Promise<InsuranceAuditDto> {
    const record = await this.getById(id)
    record.status = 'approved'
    record.auditedBy = auditor || '医保办'
    record.auditedAt = new Date().toISOString()
    try {
      await this.prisma.insuranceAudit.update({
        where: { id },
        data: { status: 'APPROVED', auditor: record.auditedBy, auditedAt: new Date(), resolution: record.reason ?? null },
      })
    } catch (err) {
      this.logger.warn(`[InsuranceAudits] approve persist failed: ${(err as Error).message}`)
    }
    return record
  }

  // POST /insurance-audits/:id/reject
  async reject(id: string, reason: string, auditor?: string): Promise<InsuranceAuditDto> {
    const record = await this.getById(id)
    record.status = 'rejected'
    record.reason = reason
    record.auditedBy = auditor || '医保办'
    record.auditedAt = new Date().toISOString()
    try {
      await this.prisma.insuranceAudit.update({
        where: { id },
        data: { status: 'REJECTED', resolution: reason, auditor: record.auditedBy, auditedAt: new Date() },
      })
    } catch (err) {
      this.logger.warn(`[InsuranceAudits] reject persist failed: ${(err as Error).message}`)
    }
    return record
  }

  private seedList(status?: string): InsuranceAuditDto[] {
    const seeds = SEED_AUDITS.map((a) => ({ ...a }))
    return status ? seeds.filter((a) => a.status === status.toLowerCase()) : seeds
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

// ── [G005-P1] 报告修订模块 (seed) ──
// 说明: 无 Prisma 修订模型, 采用内存持久 (实例级, DB-less-safe)。
// [G005 W8-Report] 增强:
//   1) actor 来自请求 (非硬编码 D001)
//   2) supplement (补发) 为与父报告关联的独立文档 (parentReportId), 而非计数器
//   3) 记录 amendedReportId / parentReportId 关联

export type AmendmentKind = 'amend' | 'supplement'

export interface Amendment {
  id: string
  /** 修订/补发文档自身 ID (补发为独立文档) */
  documentId: string
  kind: AmendmentKind
  reportId: string
  /** 补发文档挂接的父报告 ID */
  parentReportId?: string
  version: number
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'rejected' | 'archived'
  reason: string
  changes?: string
  authorId: string
  authorName: string
  reviewerId?: string
  reviewerName?: string
  startTime: string
  completedTime?: string
  /** 修订完成后重新签署的报告签名 ID (关联) */
  resignedSignatureId?: string
}

export interface AmendActor {
  id: string
  name?: string
}

const now = () => new Date().toISOString()

const SEED_AMENDMENTS: Amendment[] = [
  { id: 'amend-001', documentId: 'DOC-AMD-001', kind: 'amend', reportId: 'RP20260601001', version: 1, status: 'in_progress', reason: '原报告遗漏右肺下叶磨玻璃结节', changes: '补充右肺下叶 5mm 磨玻璃结节描述', authorId: 'D001', authorName: '张明远', startTime: '2026-06-05T08:30:00.000Z' },
  { id: 'amend-002', documentId: 'DOC-AMD-002', kind: 'amend', reportId: 'RP20260602008', version: 1, status: 'pending', reason: '病理回报: 腺癌,需修订原报告', authorId: 'D002', authorName: '李慧敏', startTime: '2026-06-03T15:30:00.000Z' },
  { id: 'amend-003', documentId: 'DOC-AMD-003', kind: 'amend', reportId: 'RP20260603003', version: 1, status: 'completed', reason: '左右位置描述错误', changes: '更正为右肺上叶', authorId: 'D003', authorName: '王建华', reviewerId: 'D001', reviewerName: '张明远', startTime: '2026-06-04T14:00:00.000Z', completedTime: '2026-06-04T16:20:00.000Z' },
  { id: 'amend-004', documentId: 'DOC-AMD-004', kind: 'amend', reportId: 'RP20260605007', version: 2, status: 'rejected', reason: '临床补充病史后修订', changes: '补充高血压病史与用药史', authorId: 'D002', authorName: '李慧敏', reviewerId: 'D001', reviewerName: '张明远', startTime: '2026-06-06T09:00:00.000Z', completedTime: '2026-06-06T11:00:00.000Z' },
  { id: 'amend-005', documentId: 'DOC-SUP-005', kind: 'supplement', reportId: 'DOC-SUP-005', parentReportId: 'RP20260601001', version: 1, status: 'completed', reason: '补发: 增加复查建议', changes: '建议 6 个月后复查胸部 CT', authorId: 'D001', authorName: '张明远', startTime: '2026-06-07T10:00:00.000Z', completedTime: '2026-06-07T10:30:00.000Z' },
]

let seq = 100

@Injectable()
export class AmendService {
  private readonly amendments: Amendment[] = SEED_AMENDMENTS.map((a) => ({ ...a }))

  async listAmendments(params: { status?: string; reportId?: string; kind?: AmendmentKind; pageSize?: number }) {
    let data = this.amendments
    if (params.status) data = data.filter((a) => a.status === params.status)
    if (params.reportId) data = data.filter((a) => a.reportId === params.reportId)
    if (params.kind) data = data.filter((a) => a.kind === params.kind)
    if (params.pageSize) data = data.slice(0, params.pageSize)
    return { success: true, data: data.map((a) => ({ ...a })) }
  }

  async getAmendment(id: string) {
    const item = this.amendments.find((a) => a.id === id)
    return { success: true, data: item ? { ...item } : null }
  }

  /** 发起修订 (actor 来自请求) */
  async startAmendment(body: { reportId: string; reason: string }, actor: AmendActor = { id: 'unknown' }) {
    if (!body.reportId?.trim()) throw new BadRequestException('reportId 不能为空')
    if (!body.reason?.trim()) throw new BadRequestException('修订原因不能为空')
    seq += 1
    const item: Amendment = {
      id: `amend-${seq}`,
      documentId: `DOC-AMD-${seq}`,
      kind: 'amend',
      reportId: body.reportId.trim(),
      version: this.nextVersion(body.reportId.trim()),
      status: 'in_progress',
      reason: body.reason.trim(),
      authorId: actor.id,
      authorName: actor.name?.trim() || actor.id,
      startTime: now(),
    }
    this.amendments.unshift(item)
    return { success: true, data: { ...item } }
  }

  /**
   * 补发: 创建与父报告关联的**独立文档** (parentReportId), 不是计数器。
   */
  async createSupplement(body: { parentReportId: string; reportId?: string; reason: string; changes?: string }, actor: AmendActor = { id: 'unknown' }) {
    if (!body.parentReportId?.trim()) throw new BadRequestException('parentReportId 不能为空')
    if (!body.reason?.trim()) throw new BadRequestException('补发原因不能为空')
    seq += 1
    const documentId = body.reportId?.trim() || `DOC-SUP-${seq}`
    const item: Amendment = {
      id: `supp-${seq}`,
      documentId,
      kind: 'supplement',
      reportId: documentId,
      parentReportId: body.parentReportId.trim(),
      version: 1,
      status: 'completed',
      reason: body.reason.trim(),
      changes: body.changes?.trim() || body.reason.trim(),
      authorId: actor.id,
      authorName: actor.name?.trim() || actor.id,
      startTime: now(),
      completedTime: now(),
    }
    this.amendments.unshift(item)
    return { success: true, data: { ...item }, linkedTo: body.parentReportId.trim() }
  }

  async updateAmendment(id: string, body: { changes?: string; status?: string }, actor?: AmendActor) {
    const item = this.amendments.find((a) => a.id === id)
    if (!item) return { success: true, data: null }
    if (body.changes !== undefined) item.changes = body.changes
    if (body.status !== undefined) item.status = body.status as Amendment['status']
    if (actor && item.authorId === 'D001') item.authorId = actor.id
    return { success: true, data: { ...item } }
  }

  async completeAmendment(id: string, body: { finalReason: string; changes: string }, actor: AmendActor = { id: 'unknown' }) {
    const item = this.amendments.find((a) => a.id === id)
    if (!item) throw new NotFoundException(`修订 ${id} 不存在`)
    item.status = 'completed'
    item.reason = body.finalReason
    item.changes = body.changes
    item.completedTime = now()
    item.reviewerId = actor.id
    item.reviewerName = actor.name?.trim() || actor.id
    return { success: true, data: { ...item } }
  }

  async approveAmendment(id: string, body: { comment?: string }, actor: AmendActor = { id: 'unknown' }) {
    const item = this.amendments.find((a) => a.id === id)
    if (item) {
      item.status = 'completed'
      item.reviewerId = actor.id
      item.reviewerName = actor.name?.trim() || actor.id
      item.completedTime = now()
    }
    return { success: true, data: { id, status: 'completed' as const, comment: body.comment ?? '', reviewerId: actor.id } }
  }

  async rejectAmendment(id: string, body: { reason: string }, actor: AmendActor = { id: 'unknown' }) {
    const item = this.amendments.find((a) => a.id === id)
    if (item) {
      item.status = 'rejected'
      item.reviewerId = actor.id
      item.reviewerName = actor.name?.trim() || actor.id
    }
    return { success: true, data: { id, status: 'rejected' as const, reason: body.reason, reviewerId: actor.id } }
  }

  /** 关联修订文档所依附的父报告 (补发为独立文档) */
  async listSupplements(parentReportId: string) {
    const data = this.amendments.filter((a) => a.kind === 'supplement' && a.parentReportId === parentReportId)
    return { success: true, data: data.map((a) => ({ ...a })) }
  }

  private nextVersion(reportId: string): number {
    const versions = this.amendments.filter((a) => a.reportId === reportId && a.kind === 'amend').map((a) => a.version)
    return versions.length > 0 ? Math.max(...versions) + 1 : 1
  }
}

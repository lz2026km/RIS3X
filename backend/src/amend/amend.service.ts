import { Injectable } from '@nestjs/common'

// ── [G005-P1] 在用孤儿补齐: 报告修订模块 (seed) ──
// 说明: 无 Prisma 修订模型, 采用内存 seed(风格与 MSW amendHandlers 一致), 标注 demo 级数据。
// 修订任务可视为 state=AMENDING 的 Report, 此处以内存修订单模拟状态流转。

export interface Amendment {
  id: string
  reportId: string
  version: number
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'rejected' | 'archived'
  reason: string
  changes?: string
  authorId: string
  authorName: string
  reviewerId?: string
  startTime: string
  completedTime?: string
}

const now = () => new Date().toISOString()

const SEED_AMENDMENTS: Amendment[] = [
  { id: 'amend-001', reportId: 'RP20260601001', version: 1, status: 'in_progress', reason: '原报告遗漏右肺下叶磨玻璃结节', changes: '补充右肺下叶 5mm 磨玻璃结节描述', authorId: 'D001', authorName: '张明远', startTime: '2026-06-05T08:30:00.000Z' },
  { id: 'amend-002', reportId: 'RP20260602008', version: 1, status: 'pending', reason: '病理回报: 腺癌,需修订原报告', authorId: 'D002', authorName: '李慧敏', startTime: '2026-06-03T15:30:00.000Z' },
  { id: 'amend-003', reportId: 'RP20260603003', version: 1, status: 'completed', reason: '左右位置描述错误', changes: '更正为右肺上叶', authorId: 'D003', authorName: '王建华', reviewerId: 'D001', startTime: '2026-06-04T14:00:00.000Z', completedTime: '2026-06-04T16:20:00.000Z' },
  { id: 'amend-004', reportId: 'RP20260605007', version: 2, status: 'rejected', reason: '临床补充病史后修订', changes: '补充高血压病史与用药史', authorId: 'D002', authorName: '李慧敏', reviewerId: 'D001', startTime: '2026-06-06T09:00:00.000Z', completedTime: '2026-06-06T11:00:00.000Z' },
]

@Injectable()
export class AmendService {
  async listAmendments(params: { status?: string; reportId?: string; pageSize?: number }) {
    let data = SEED_AMENDMENTS
    if (params.status) data = data.filter(a => a.status === params.status)
    if (params.reportId) data = data.filter(a => a.reportId === params.reportId)
    if (params.pageSize) data = data.slice(0, params.pageSize)
    return { success: true, data }
  }

  async getAmendment(id: string) {
    const item = SEED_AMENDMENTS.find(a => a.id === id)
    return { success: true, data: item ?? null }
  }

  async startAmendment(body: { reportId: string; reason: string }) {
    const item: Amendment = {
      id: `amend-${Date.now()}`,
      reportId: body.reportId,
      version: 1,
      status: 'in_progress',
      reason: body.reason,
      authorId: 'D001',
      authorName: '张明远',
      startTime: now(),
    }
    SEED_AMENDMENTS.unshift(item)
    return { success: true, data: item }
  }

  async updateAmendment(id: string, body: { changes?: string; status?: string }) {
    const item = SEED_AMENDMENTS.find(a => a.id === id)
    if (!item) return { success: true, data: null }
    if (body.changes !== undefined) item.changes = body.changes
    if (body.status !== undefined) item.status = body.status as Amendment['status']
    return { success: true, data: item }
  }

  async completeAmendment(id: string, body: { finalReason: string; changes: string }) {
    const item = SEED_AMENDMENTS.find(a => a.id === id)
    if (!item) return { success: true, data: null }
    item.status = 'completed'
    item.reason = body.finalReason
    item.changes = body.changes
    item.completedTime = now()
    item.reviewerId = 'D002'
    return { success: true, data: item }
  }

  async approveAmendment(id: string, body: { comment?: string }) {
    const item = SEED_AMENDMENTS.find(a => a.id === id)
    if (item) item.status = 'completed'
    return { success: true, data: { id, status: 'completed' as const, comment: body.comment ?? '' } }
  }

  async rejectAmendment(id: string, body: { reason: string }) {
    const item = SEED_AMENDMENTS.find(a => a.id === id)
    if (item) item.status = 'rejected'
    return { success: true, data: { id, status: 'rejected' as const, reason: body.reason } }
  }
}

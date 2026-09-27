/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (report-peer-review) - 报告互评 (F9)
 *
 * 孤儿模块 (纯内存 + seed 回退, 无 DB 依赖, 可无 DB 启动):
 *   1. 互评任务分配: 按科室随机确定性分配 (hash(reportId+department) 恒同) 或指定评审人
 *   2. 评分维度: 准确性 / 完整性 / 规范性 (5 分制, 整数 1-5)
 *   3. 评语 + 状态: 待评 pending / 已评 reviewed / 超时 overdue (读取时派生)
 *   4. 互评统计: 平均分 (各维度+总体) / 分数分布 / 完成率 / 按科室
 */
import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { hashString } from '../../common/utils/deterministic-hash'
import { DefectLibraryService } from '../defect-library/defect-library.service'
import type { DefectItem } from '../defect-library/defect-library.types'

// ================= 类型定义 =================

export type ScoreDimension = 'accuracy' | 'completeness' | 'normativity'
export type PeerReviewStatus = 'pending' | 'reviewed' | 'overdue'

export interface PeerScores {
  accuracy: number
  completeness: number
  normativity: number
}

export interface PeerReviewTask {
  id: string
  reportId: string
  patientName: string
  modality: string
  department: string
  reviewerId: string
  reviewerName: string
  assignedAt: string
  dueAt: string
  status: PeerReviewStatus
  scores?: PeerScores
  comment?: string
  reviewedAt?: string
  /** true = 确定性自动分配 */
  autoAssigned: boolean
  /** [W9-QC] 关联规范化缺陷库编码 (relational) */
  defectCodes: string[]
}

export interface PeerReviewStats {
  total: number
  reviewedCount: number
  pendingCount: number
  overdueCount: number
  completionRate: number
  avgScores: PeerScores & { overall: number }
  scoreDistribution: Array<{ score: number; count: number }>
  byDepartment: Array<{
    department: string
    total: number
    reviewed: number
    avgOverall: number
  }>
}

export interface AssignPeerReviewInput {
  reportId: string
  patientName?: string
  modality?: string
  department: string
  reviewerId?: string
  dueDays?: number
}

const REVIEWER_POOL = [
  { id: 'u-r1', name: '王霞', department: '放射科' },
  { id: 'u-r2', name: '李强', department: '放射科' },
  { id: 'u-r3', name: '张磊', department: '放射科' },
  { id: 'u-r4', name: '刘敏', department: '心内科' },
  { id: 'u-r5', name: '陈静', department: '神经外科' },
  { id: 'u-r6', name: '赵军', department: '胸外科' },
  { id: 'u-r7', name: '孙丽', department: '呼吸内科' },
  { id: 'u-r8', name: '周涛', department: '骨科' },
  { id: 'u-r9', name: '吴丹', department: '肿瘤科' },
  { id: 'u-r10', name: '郑华', department: '放射科' },
]

const DIMENSION_LABEL: Record<ScoreDimension, string> = {
  accuracy: '准确性',
  completeness: '完整性',
  normativity: '规范性',
}

export const SCORE_MIN = 1
export const SCORE_MAX = 5

const now = () => new Date().toISOString()

/** 确定性评审人选取: 同 (reportId, department) 恒同; 优先本科室成员 */
function pickReviewer(reportId: string, department: string): { reviewerId: string; reviewerName: string } {
  const h = hashString(`peer:${reportId}:${department}`)
  const inDept = REVIEWER_POOL.filter((r) => r.department === department)
  const pool = inDept.length > 0 ? inDept : REVIEWER_POOL
  const hit = pool[h % pool.length]!
  return { reviewerId: hit.id, reviewerName: hit.name }
}

function validScores(scores: PeerScores): boolean {
  return (Object.values(scores) as number[]).every((v) => Number.isInteger(v) && v >= SCORE_MIN && v <= SCORE_MAX)
}

// ================= 种子数据 (seed 回退) =================

function seedTasks(): PeerReviewTask[] {
  const base = Date.now()
  const day = 24 * 3600_000
  const tasks: PeerReviewTask[] = [
    {
      id: 'PR-SEED-001',
      reportId: 'RPT-SEED-001',
      patientName: '张三',
      modality: 'CT',
      department: '放射科',
      ...pickReviewer('RPT-SEED-001', '放射科'),
      assignedAt: new Date(base - 8 * day).toISOString(),
      dueAt: new Date(base - 1 * day).toISOString(),
      status: 'pending',
      autoAssigned: true,
      defectCodes: ['ST-01', 'TM-01'],
    },
    {
      id: 'PR-SEED-002',
      reportId: 'RPT-SEED-002',
      patientName: '李四',
      modality: 'MR',
      department: '神经外科',
      ...pickReviewer('RPT-SEED-002', '神经外科'),
      assignedAt: new Date(base - 6 * day).toISOString(),
      dueAt: new Date(base + 1 * day).toISOString(),
      status: 'pending',
      autoAssigned: true,
      defectCodes: ['AC-01'],
    },
    {
      id: 'PR-SEED-003',
      reportId: 'RPT-SEED-003',
      patientName: '王五',
      modality: 'CT',
      department: '胸外科',
      ...pickReviewer('RPT-SEED-003', '胸外科'),
      assignedAt: new Date(base - 5 * day).toISOString(),
      dueAt: new Date(base - 2 * day).toISOString(),
      status: 'reviewed',
      scores: { accuracy: 4, completeness: 5, normativity: 4 },
      comment: '所见与结论一致, 描述完整, 建议补充随访周期。',
      reviewedAt: new Date(base - 2 * day).toISOString(),
      autoAssigned: true,
      defectCodes: ['ST-03'],
    },
    {
      id: 'PR-SEED-004',
      reportId: 'RPT-SEED-004',
      patientName: '赵六',
      modality: 'DR',
      department: '骨科',
      ...pickReviewer('RPT-SEED-004', '骨科'),
      assignedAt: new Date(base - 4 * day).toISOString(),
      dueAt: new Date(base - 3 * day).toISOString(),
      status: 'reviewed',
      scores: { accuracy: 3, completeness: 4, normativity: 3 },
      comment: '骨折描述基本准确, 欠缺对位对线表述。',
      reviewedAt: new Date(base - 3 * day).toISOString(),
      autoAssigned: true,
      defectCodes: ['TM-03'],
    },
  ]
  return tasks
}

@Injectable()
export class ReportPeerReviewService {
  private tasks: PeerReviewTask[] = []
  private seq = 0

  constructor(@Optional() private readonly defectLibrary?: DefectLibraryService) {
    this.tasks = seedTasks()
  }

  private nextId(): string {
    this.seq += 1
    return `PR-${Date.now().toString(36)}-${this.seq}`
  }

  // ================= 任务分配 =================

  /** POST /report-peer-review/assign — 分配互评任务 (指定或按科室确定性分配) */
  assign(input: AssignPeerReviewInput): PeerReviewTask {
    const reportId = (input.reportId ?? '').trim()
    const department = (input.department ?? '').trim()
    if (!reportId) throw new BadRequestException('reportId 不能为空')
    if (!department) throw new BadRequestException('department 不能为空')
    const nowIso = now()
    const dueDays = Math.max(1, Math.min(30, input.dueDays ?? 7))
    const dueAt = new Date(Date.now() + dueDays * 24 * 3600_000).toISOString()
    const existing = this.tasks.find((t) => t.reportId === reportId)
    if (existing) return this.cloneTask(existing)
    let reviewer: { reviewerId: string; reviewerName: string }
    let autoAssigned: boolean
    if (input.reviewerId) {
      const pool = REVIEWER_POOL.find((r) => r.id === input.reviewerId)
      if (!pool) throw new BadRequestException(`评审人 ${input.reviewerId} 不在评审人池中`)
      reviewer = { reviewerId: pool.id, reviewerName: pool.name }
      autoAssigned = false
    } else {
      reviewer = pickReviewer(reportId, department)
      autoAssigned = true
    }
    const task: PeerReviewTask = {
      id: this.nextId(),
      reportId,
      patientName: input.patientName ?? '未知患者',
      modality: input.modality ?? 'CT',
      department,
      reviewerId: reviewer.reviewerId,
      reviewerName: reviewer.reviewerName,
      assignedAt: nowIso,
      dueAt,
      status: 'pending',
      autoAssigned,
      defectCodes: [],
    }
    this.tasks.unshift(task)
    return this.cloneTask(task)
  }

  /** GET /report-peer-review/tasks — 任务列表 (status 过滤, overdue 派生) */
  listTasks(params: { status?: string } = {}): PeerReviewTask[] {
    let tasks = this.tasks.map((t) => this.withDerivedStatus(t))
    if (params.status) tasks = tasks.filter((t) => t.status === params.status)
    return tasks.map((t) => this.cloneTask(t))
  }

  /** GET /report-peer-review/tasks/:id — 任务详情 */
  getTask(id: string): PeerReviewTask {
    return this.cloneTask(this.withDerivedStatus(this.findTask(id)))
  }

  // ================= 评分 =================

  /** POST /report-peer-review/tasks/:id/score — 提交评分 (5 分制 + 评语) */
  score(id: string, body: { scores: PeerScores; comment?: string; reviewerId?: string }): PeerReviewTask {
    const task = this.findTask(id)
    if (!body.scores) throw new BadRequestException('scores 不能为空')
    if (!validScores(body.scores)) {
      throw new BadRequestException(`评分必须为 ${SCORE_MIN}-${SCORE_MAX} 的整数 (准确性/完整性/规范性)`)
    }
    task.scores = { ...body.scores }
    task.comment = body.comment?.trim() || ''
    task.status = 'reviewed'
    task.reviewedAt = now()
    return this.cloneTask(task)
  }

  // ================= 统计 =================

  /** GET /report-peer-review/stats — 互评统计 (平均分/分布) */
  getStats(): PeerReviewStats {
    const tasks = this.tasks.map((t) => this.withDerivedStatus(t))
    const reviewed = tasks.filter((t) => t.status === 'reviewed' && t.scores)
    const distCounts = new Map<number, number>()
    let sumAcc = 0
    let sumComp = 0
    let sumNorm = 0
    for (const t of reviewed) {
      const s = t.scores!
      sumAcc += s.accuracy
      sumComp += s.completeness
      sumNorm += s.normativity
      const overall = Math.round(((s.accuracy + s.completeness + s.normativity) / 3) * 10) / 10
      const bucket = Math.round(overall)
      distCounts.set(bucket, (distCounts.get(bucket) ?? 0) + 1)
    }
    const n = reviewed.length
    const deptMap = new Map<string, { total: number; reviewed: number; sum: number }>()
    for (const t of tasks) {
      const entry = deptMap.get(t.department) ?? { total: 0, reviewed: 0, sum: 0 }
      entry.total += 1
      if (t.status === 'reviewed' && t.scores) {
        entry.reviewed += 1
        entry.sum += (t.scores.accuracy + t.scores.completeness + t.scores.normativity) / 3
      }
      deptMap.set(t.department, entry)
    }
    const avg = (v: number) => (n > 0 ? Math.round((v / n) * 10) / 10 : 0)
    return {
      total: tasks.length,
      reviewedCount: n,
      pendingCount: tasks.filter((t) => t.status === 'pending').length,
      overdueCount: tasks.filter((t) => t.status === 'overdue').length,
      completionRate: tasks.length > 0 ? Math.round((n / tasks.length) * 1000) / 10 : 0,
      avgScores: {
        accuracy: avg(sumAcc),
        completeness: avg(sumComp),
        normativity: avg(sumNorm),
        overall: n > 0 ? Math.round(((sumAcc + sumComp + sumNorm) / (3 * n)) * 10) / 10 : 0,
      },
      scoreDistribution: Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => ({
        score: SCORE_MIN + i,
        count: distCounts.get(SCORE_MIN + i) ?? 0,
      })),
      byDepartment: Array.from(deptMap.entries()).map(([department, e]) => ({
        department,
        total: e.total,
        reviewed: e.reviewed,
        avgOverall: e.reviewed > 0 ? Math.round((e.sum / e.reviewed) * 10) / 10 : 0,
      })),
    }
  }

  /** 维度标签 (供前端展示) */
  getDimensions(): Array<{ key: ScoreDimension; label: string; min: number; max: number }> {
    return (Object.keys(DIMENSION_LABEL) as ScoreDimension[]).map((key) => ({
      key,
      label: DIMENSION_LABEL[key],
      min: SCORE_MIN,
      max: SCORE_MAX,
    }))
  }

  // ================= 内部工具 =================

  /** overdue 派生: pending 且已过 dueAt → overdue (读取时计算) */
  private withDerivedStatus(t: PeerReviewTask): PeerReviewTask {
    if (t.status === 'pending' && Date.parse(t.dueAt) < Date.now()) {
      return { ...t, status: 'overdue' }
    }
    return t
  }

  private findTask(id: string): PeerReviewTask {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new NotFoundException(`互评任务 ${id} 不存在`)
    return task
  }

  private cloneTask(t: PeerReviewTask): PeerReviewTask {
    return { ...t, scores: t.scores ? { ...t.scores } : undefined, defectCodes: [...(t.defectCodes ?? [])] }
  }

  // ================= [W9-QC] 缺陷库关联 (relational) =================

  /** POST /report-peer-review/tasks/:id/defects — 关联缺陷库编码 (校验存在) */
  linkDefects(id: string, body: { defectCodes: string[] }): PeerReviewTask {
    const task = this.findTask(id)
    const codes = Array.isArray(body.defectCodes) ? body.defectCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean) : []
    if (codes.length === 0) throw new BadRequestException('defectCodes 不能为空')
    if (this.defectLibrary) {
      for (const code of codes) {
        const exists = this.defectLibrary.listItems().some((i) => i.code === code)
        if (!exists) throw new BadRequestException(`缺陷编码 ${code} 不在缺陷库中`)
      }
    }
    task.defectCodes = Array.from(new Set([...(task.defectCodes ?? []), ...codes]))
    return this.cloneTask(task)
  }

  /** GET /report-peer-review/tasks/:id/defects — 任务关联缺陷明细 */
  listTaskDefects(id: string): DefectItem[] {
    const task = this.findTask(id)
    const all = this.defectLibrary ? this.defectLibrary.listItems() : []
    const codes = new Set(task.defectCodes ?? [])
    return all.filter((i) => codes.has(i.code)).map((i) => ({ ...i }))
  }

  /** GET /report-peer-review/defect-stats — 互评缺陷聚合 (按缺陷编码/类别) */
  defectStats(): {
    totalLinks: number
    byCode: Array<{ code: string; count: number }>
    byCategory: Array<{ categoryCode: string; count: number }>
    bySeverity: Array<{ severity: string; count: number }>
  } {
    const all = this.defectLibrary ? this.defectLibrary.listItems() : []
    const itemByCode = new Map(all.map((i) => [i.code, i]))
    const codeCount = new Map<string, number>()
    for (const t of this.tasks) {
      for (const code of t.defectCodes ?? []) codeCount.set(code, (codeCount.get(code) ?? 0) + 1)
    }
    const catCount = new Map<string, number>()
    const sevCount = new Map<string, number>()
    let totalLinks = 0
    for (const [code, count] of codeCount) {
      totalLinks += count
      const item = itemByCode.get(code)
      const cat = item?.categoryCode ?? 'UNKNOWN'
      const sev = item?.severity ?? 'medium'
      catCount.set(cat, (catCount.get(cat) ?? 0) + count)
      sevCount.set(sev, (sevCount.get(sev) ?? 0) + count)
    }
    return {
      totalLinks,
      byCode: [...codeCount.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
      byCategory: [...catCount.entries()].map(([categoryCode, count]) => ({ categoryCode, count })),
      bySeverity: [...sevCount.entries()].map(([severity, count]) => ({ severity, count })),
    }
  }
}

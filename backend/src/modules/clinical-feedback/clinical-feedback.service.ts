/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3C (临床反馈闭环) - 服务
 *
 * 孤儿模块 (纯内存 + seed 回退, 无 DB 依赖, 可无 DB 启动):
 *   1. 临床医生对报告提异议 / 补充 / 更正申请 (reportId / patientId / 类型 / 内容 / 提交人 / 科室)
 *   2. 放射科回应 (回应内容 / 处理人)
 *   3. 关闭 (关联报告修订 amend 时记录 amendId)
 *   4. 状态机门禁: SUBMITTED → RESPONDED → RESOLVED | REJECTED (非法跳转 400)
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

// ================= 类型定义 =================

/** 反馈类型: 异议 / 补充 / 更正 */
export type FeedbackType = 'objection' | 'supplement' | 'correction'

/** 状态机: 已提交 → 已回应 → 已关闭 | 已驳回 */
export type FeedbackStatus = 'SUBMITTED' | 'RESPONDED' | 'RESOLVED' | 'REJECTED'

export const FEEDBACK_TYPES: FeedbackType[] = ['objection', 'supplement', 'correction']
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['SUBMITTED', 'RESPONDED', 'RESOLVED', 'REJECTED']

/** 合法流转表 (门禁) */
export const FEEDBACK_TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  SUBMITTED: ['RESPONDED', 'REJECTED'],
  RESPONDED: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
}

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  objection: '异议',
  supplement: '补充',
  correction: '更正',
}

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  SUBMITTED: '已提交',
  RESPONDED: '已回应',
  RESOLVED: '已关闭',
  REJECTED: '已驳回',
}

export interface FeedbackResponse {
  content: string
  responder: string
  department?: string
  respondedAt: string
}

export interface FeedbackResolution {
  content?: string
  resolver: string
  /** 导致报告修订时记录 amendId */
  amendId?: string
  resolvedAt: string
}

export interface ClinicalFeedback {
  id: string
  reportId: string
  patientId: string | null
  patientName?: string
  examId?: string | null
  type: FeedbackType
  content: string
  submittedBy: string
  department: string
  status: FeedbackStatus
  createdAt: string
  updatedAt: string
  response?: FeedbackResponse
  resolution?: FeedbackResolution
}

export interface CreateFeedbackInput {
  reportId: string
  patientId?: string
  patientName?: string
  examId?: string
  type: FeedbackType
  content: string
  submittedBy: string
  department: string
}

export interface RespondFeedbackInput {
  content: string
  responder: string
  department?: string
}

export interface ResolveFeedbackInput {
  content?: string
  resolver: string
  amendId?: string
}

export interface RejectFeedbackInput {
  reason: string
  resolver: string
}

export interface ListFeedbackFilter {
  status?: string
  reportId?: string
  department?: string
  type?: string
  page?: number
  pageSize?: number
}

export interface PaginatedFeedback {
  items: ClinicalFeedback[]
  total: number
  page: number
  pageSize: number
}

const now = () => new Date().toISOString()
const DAY = 24 * 3600_000

// ================= 种子数据 (seed 回退) =================

function seedFeedbacks(): ClinicalFeedback[] {
  const base = Date.now()
  return [
    {
      id: 'CF-SEED-001',
      reportId: 'RPT-SEED-001',
      patientId: 'P-SEED-001',
      patientName: '张三',
      examId: 'EX-SEED-001',
      type: 'objection',
      content: '报告中“右肺下叶结节”大小与我院 3 个月前 CT 不符，请核对并说明。',
      submittedBy: '周临床',
      department: '呼吸内科',
      status: 'SUBMITTED',
      createdAt: new Date(base - 1 * DAY).toISOString(),
      updatedAt: new Date(base - 1 * DAY).toISOString(),
    },
    {
      id: 'CF-SEED-002',
      reportId: 'RPT-SEED-002',
      patientId: 'P-SEED-002',
      patientName: '李四',
      examId: 'EX-SEED-002',
      type: 'supplement',
      content: '补充临床信息：患者既往有肺结核病史，请结合考虑。',
      submittedBy: '陈临床',
      department: '感染科',
      status: 'RESPONDED',
      createdAt: new Date(base - 3 * DAY).toISOString(),
      updatedAt: new Date(base - 2 * DAY).toISOString(),
      response: {
        content: '已收到补充信息，将结合既往结核史重新审阅影像并在报告中提示。',
        responder: '王放射',
        department: '放射科',
        respondedAt: new Date(base - 2 * DAY).toISOString(),
      },
    },
    {
      id: 'CF-SEED-003',
      reportId: 'RPT-SEED-003',
      patientId: 'P-SEED-003',
      patientName: '王五',
      examId: 'EX-SEED-003',
      type: 'correction',
      content: '报告结论中左右侧描述疑似写反，请核实并更正后重新签发。',
      submittedBy: '赵临床',
      department: '神经外科',
      status: 'RESOLVED',
      createdAt: new Date(base - 6 * DAY).toISOString(),
      updatedAt: new Date(base - 4 * DAY).toISOString(),
      response: {
        content: '经复核确为左右侧笔误，已发起报告修订。',
        responder: '刘放射',
        department: '放射科',
        respondedAt: new Date(base - 5 * DAY).toISOString(),
      },
      resolution: {
        content: '报告已修订并重新签发。',
        resolver: '刘放射',
        amendId: 'AMEND-SEED-001',
        resolvedAt: new Date(base - 4 * DAY).toISOString(),
      },
    },
    {
      id: 'CF-SEED-004',
      reportId: 'RPT-SEED-004',
      patientId: 'P-SEED-004',
      patientName: '陈丽',
      examId: null,
      type: 'objection',
      content: '对报告中的良性判断存疑，要求会诊。',
      submittedBy: '孙临床',
      department: '肿瘤科',
      status: 'REJECTED',
      createdAt: new Date(base - 8 * DAY).toISOString(),
      updatedAt: new Date(base - 7 * DAY).toISOString(),
      response: {
        content: '经科内复核影像与病理，原判断依据充分，维持原报告结论，建议临床随访。',
        responder: '吴放射',
        department: '放射科',
        respondedAt: new Date(base - 7 * DAY).toISOString(),
      },
      resolution: {
        content: '驳回：原报告结论依据充分。',
        resolver: '吴放射',
        resolvedAt: new Date(base - 7 * DAY).toISOString(),
      },
    },
  ]
}

@Injectable()
export class ClinicalFeedbackService {
  private feedbacks: ClinicalFeedback[] = []
  private seq = 0

  constructor() {
    this.feedbacks = seedFeedbacks()
  }

  private nextId(): string {
    this.seq += 1
    return `CF-${Date.now().toString(36)}-${this.seq}`
  }

  private clone(f: ClinicalFeedback): ClinicalFeedback {
    return {
      ...f,
      response: f.response ? { ...f.response } : undefined,
      resolution: f.resolution ? { ...f.resolution } : undefined,
    }
  }

  private find(id: string): ClinicalFeedback {
    const f = this.feedbacks.find((x) => x.id === id)
    if (!f) throw new NotFoundException(`临床反馈 ${id} 不存在`)
    return f
  }

  /** 状态机门禁: 校验 from → to 是否合法 */
  private assertTransition(from: FeedbackStatus, to: FeedbackStatus, id: string): void {
    const allowed = FEEDBACK_TRANSITIONS[from] ?? []
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `INVALID_TRANSITION: 临床反馈 ${id} ${from} → ${to} 不允许 (合法流转: ${from} → ${allowed.length > 0 ? allowed.join('/') : '终态'})`,
      )
    }
  }

  // ================= 提交 / 列表 / 详情 =================

  /** POST /clinical-feedback — 临床医生提交报告异议/补充/更正申请 */
  create(input: CreateFeedbackInput): ClinicalFeedback {
    const reportId = (input.reportId ?? '').trim()
    const content = (input.content ?? '').trim()
    const submittedBy = (input.submittedBy ?? '').trim()
    const department = (input.department ?? '').trim()
    if (!reportId) throw new BadRequestException('reportId 不能为空')
    if (!content) throw new BadRequestException('反馈内容不能为空')
    if (!submittedBy) throw new BadRequestException('提交人不能为空')
    if (!department) throw new BadRequestException('科室不能为空')
    if (!FEEDBACK_TYPES.includes(input.type)) throw new BadRequestException(`反馈类型不合法: ${input.type}`)
    const ts = now()
    const record: ClinicalFeedback = {
      id: this.nextId(),
      reportId,
      patientId: input.patientId?.trim() || null,
      patientName: input.patientName?.trim() || undefined,
      examId: input.examId?.trim() || null,
      type: input.type,
      content,
      submittedBy,
      department,
      status: 'SUBMITTED',
      createdAt: ts,
      updatedAt: ts,
    }
    this.feedbacks.unshift(record)
    return this.clone(record)
  }

  /** GET /clinical-feedback — 列表 (状态/报告/科室筛选 + 分页) */
  list(filter: ListFeedbackFilter = {}): PaginatedFeedback {
    let items = this.feedbacks.slice()
    if (filter.status) items = items.filter((f) => f.status === filter.status)
    if (filter.reportId) items = items.filter((f) => f.reportId === filter.reportId)
    if (filter.department) items = items.filter((f) => f.department === filter.department)
    if (filter.type) items = items.filter((f) => f.type === filter.type)
    const total = items.length
    const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 20))
    const page = Math.max(1, filter.page ?? 1)
    const start = (page - 1) * pageSize
    return {
      items: items.slice(start, start + pageSize).map((f) => this.clone(f)),
      total,
      page,
      pageSize,
    }
  }

  /** GET /clinical-feedback/:id — 详情 */
  get(id: string): ClinicalFeedback {
    return this.clone(this.find(id))
  }

  // ================= 闭环流转 =================

  /** POST /clinical-feedback/:id/respond — 放射科回应 (SUBMITTED → RESPONDED) */
  respond(id: string, input: RespondFeedbackInput): ClinicalFeedback {
    const record = this.find(id)
    const content = (input.content ?? '').trim()
    const responder = (input.responder ?? '').trim()
    if (!content) throw new BadRequestException('回应内容不能为空')
    if (!responder) throw new BadRequestException('处理人不能为空')
    this.assertTransition(record.status, 'RESPONDED', id)
    const ts = now()
    record.status = 'RESPONDED'
    record.response = { content, responder, department: input.department?.trim() || undefined, respondedAt: ts }
    record.updatedAt = ts
    return this.clone(record)
  }

  /** POST /clinical-feedback/:id/resolve — 关闭 (RESPONDED → RESOLVED, 可记录 amendId) */
  resolve(id: string, input: ResolveFeedbackInput): ClinicalFeedback {
    const record = this.find(id)
    const resolver = (input.resolver ?? '').trim()
    if (!resolver) throw new BadRequestException('处理人不能为空')
    this.assertTransition(record.status, 'RESOLVED', id)
    const ts = now()
    record.status = 'RESOLVED'
    record.resolution = { content: input.content?.trim() || undefined, resolver, amendId: input.amendId?.trim() || undefined, resolvedAt: ts }
    record.updatedAt = ts
    return this.clone(record)
  }

  /** POST /clinical-feedback/:id/reject — 驳回 (SUBMITTED/RESPONDED → REJECTED) */
  reject(id: string, input: RejectFeedbackInput): ClinicalFeedback {
    const record = this.find(id)
    const reason = (input.reason ?? '').trim()
    const resolver = (input.resolver ?? '').trim()
    if (!reason) throw new BadRequestException('驳回原因不能为空')
    if (!resolver) throw new BadRequestException('处理人不能为空')
    this.assertTransition(record.status, 'REJECTED', id)
    const ts = now()
    record.status = 'REJECTED'
    record.resolution = { content: reason, resolver, resolvedAt: ts }
    record.updatedAt = ts
    return this.clone(record)
  }

  // ================= 元数据 =================

  /** 类型/状态/流转元数据 (供前端展示) */
  getMeta(): {
    types: Array<{ key: FeedbackType; label: string }>
    statuses: Array<{ key: FeedbackStatus; label: string }>
    transitions: Record<FeedbackStatus, FeedbackStatus[]>
  } {
    return {
      types: FEEDBACK_TYPES.map((key) => ({ key, label: FEEDBACK_TYPE_LABEL[key] })),
      statuses: FEEDBACK_STATUSES.map((key) => ({ key, label: FEEDBACK_STATUS_LABEL[key] })),
      transitions: FEEDBACK_TRANSITIONS,
    }
  }
}

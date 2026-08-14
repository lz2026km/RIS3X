// ============================================================
// G005 状态值统一映射层 (P0)
// 后端真实枚举:
//   - Exam.state (String): SCHEDULED / ARRIVED / IN_PROGRESS / COMPLETED / CANCELLED
//     (backend/prisma/schema.prisma model Exam.state, 默认 SCHEDULED)
//   - ReportState (enum, 22 态): backend/prisma/schema.prisma enum ReportState
// 原则: 内部统一存英文状态值, 展示经 display* 转中文, 过滤用英文值。
// ============================================================

export const EXAM_STATUS_MAP: Record<string, string> = {
  SCHEDULED: '已登记',
  ARRIVED: '已报到',
  IN_PROGRESS: '检查中',
  // [v3.0.6.11-95 Wave 1A P1] 暂停态 (backend WORKLIST_STATES.PAUSED, POST /worklist/:id/pause)
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  // [v3.0.6.11-92 Wave2A P1] 影像质控扩展态 (backend WORKLIST_STATES, PATCH /worklist/:id/state)
  IMAGE_READY: '图像可用',
  QC_REJECT: '质控退回',
  QC_PASS: '质控通过',
  PENDING_REPORT: '待报告',
}

/** 历史中文状态 / 旧 mock 状态机 / 报告态 → 规范英文状态 (迁移期兼容) */
export const EXAM_STATUS_ALIASES: Record<string, string> = {
  待登记: 'SCHEDULED',
  已登记: 'SCHEDULED',
  待检查: 'SCHEDULED',
  已报到: 'ARRIVED',
  检查中: 'IN_PROGRESS',
  已暂停: 'PAUSED',
  待报告: 'COMPLETED',
  已报告: 'COMPLETED',
  已发布: 'COMPLETED',
  已归档: 'COMPLETED',
  已取消: 'CANCELLED',
  质控退回: 'COMPLETED',
  检查异常: 'COMPLETED',
  // 旧 mock worklist 状态机
  pending: 'SCHEDULED',
  checkedIn: 'ARRIVED',
  inProgress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  // mock EXAM_REPORT_PRE 报告态 (对应检查已完成)
  draft: 'SCHEDULED',
  submitted: 'COMPLETED',
  reviewed: 'COMPLETED',
  cosigned: 'COMPLETED',
  published: 'COMPLETED',
}

export const EXAM_STATUS_TO_CN: Record<string, string> = { ...EXAM_STATUS_MAP }

export function normalizeExamStatus(s: string | undefined | null): string {
  if (!s) return 'SCHEDULED'
  return EXAM_STATUS_ALIASES[s] ?? s
}

export function displayExamStatus(s: string | undefined | null): string {
  const normalized = normalizeExamStatus(s)
  return EXAM_STATUS_TO_CN[normalized] ?? String(normalized ?? '-')
}

/** 报告 22 态 → 中文 (backend/prisma/schema.prisma enum ReportState) */
export const REPORT_STATUS_MAP: Record<string, string> = {
  PENDING_ASSIGNMENT: '待分配',
  ASSIGNED: '已分配',
  WRITING: '书写中',
  SUBMITTED: '已提交',
  INITIAL_REVIEW: '初审中',
  FINAL_REVIEW: '终审中',
  CO_SIGN_REVIEW: '双签审核',
  REVIEWED: '已审核',
  SIGNING: '签发中',
  SIGNED: '已签发',
  PUBLISHED: '已发布',
  AMENDING: '修订中',
  AMENDED: '已修订',
  WITHDRAWN: '已撤回',
  REJECTED: '已驳回',
  ESCALATED: '已升级',
  ARCHIVED: '已归档',
  RECTIFYING: '整改中',
  SUPPLEMENTING: '补充中',
  SUPPLEMENTED: '已补充',
  REDISTRIBUTING: '重新分配中',
}

export const REPORT_STATUS_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_STATUS_MAP).map(([en, cn]) => [cn, en]),
)

export function displayReportStatus(s: string | undefined | null): string {
  if (!s) return '-'
  return REPORT_STATUS_MAP[s] ?? REPORT_STATUS_TO_EN[s] ?? String(s)
}

import { z } from 'zod'

// [v3.0.6.11-99 Wave3B] 状态机扩展: 计划/已提醒/进行中/已完成/已失访/已取消 (OVERDUE 为派生态, 允许查询)
export const FollowUpStatusEnum = z.enum([
  'PENDING',
  'REMINDED',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'CANCELLED',
  'OVERDUE',
])

export const CreateFollowUpPlanSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  planDate: z.string().min(1),
  intervalDays: z.number().int().positive().default(30),
  status: FollowUpStatusEnum.optional(),
  note: z.string().optional(),
  reminderEnabled: z.boolean().default(true),
  // [v3.0.6.11-92 Wave1B P0] 报告→随访关联: 可选来源报告/检查 (报告详情"创建随访"入口带入)
  reportId: z.string().optional(),
  examId: z.string().optional(),
  // [v3.0.6.11-99 Wave3B] 来源模板 (模板库 apply / 检查联动 from-exam 带入)
  templateId: z.string().optional(),
})

export const UpdateFollowUpPlanSchema = CreateFollowUpPlanSchema.partial()

// [v3.0.6.11-104 Wave 1C] 列表补齐分页参数 (page/pageSize, 上限 200)
export const ListFollowUpQuerySchema = z.object({
  status: FollowUpStatusEnum.optional(),
  date: z.string().optional(),
  patientId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
})

// [v3.0.6.11-104 Wave 1C] 随访模板写入校验 (此前 @Body() 未走 zod)
export const CreateFollowUpTemplateSchema = z.object({
  name: z.string().min(1).max(128),
  category: z.string().max(64).optional(),
  intervals: z.array(z.number().int().positive()).max(50).optional(),
  items: z.array(z.string().max(200)).max(100).optional(),
  active: z.boolean().optional(),
})

export const UpdateFollowUpTemplateSchema = CreateFollowUpTemplateSchema.partial()

// [v3.0.6.11-99 Wave3B] 失访/取消: 必填原因
export const MissFollowUpSchema = z.object({
  reason: z.string().min(1, '请填写失访原因'),
})

export const CancelFollowUpSchema = z.object({
  reason: z.string().min(1, '请填写取消原因'),
})

// [v3.0.6.11-99 Wave3B] 检查联动: 检查完成 → 自动创建随访计划 (可选模板批量生成)
export const FromExamFollowUpSchema = z.object({
  examId: z.string().min(1),
  templateId: z.string().optional(),
  note: z.string().optional(),
})

// [v3.0.6.11-103 Wave 13] 随访自动触发强化: 报告手动补建 (报告发布后/人工触发, 关键词规则匹配)
export const FromReportFollowUpSchema = z.object({
  reportId: z.string().min(1),
  reason: z.string().optional(),
})

// [v3.0.6.11-104 Wave 3D] 随访结构化结果 (随访完成时录入): 转归结果 + 描述
export const FollowUpResultEnum = z.enum(['improved', 'stable', 'worsened', 'deceased', 'unknown'])
export type FollowUpResult = z.infer<typeof FollowUpResultEnum>

export const RecordFollowUpResultSchema = z.object({
  result: FollowUpResultEnum,
  outcome: z.string().max(1000).optional(),
})

// [v3.0.6.11-99 Wave3B] 模板应用到患者
export const ApplyTemplateSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  planDate: z.string().min(1),
  reportId: z.string().optional(),
  examId: z.string().optional(),
  note: z.string().optional(),
})

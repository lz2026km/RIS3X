/**
 * [v3.0.6.11-100 Wave2C (报告工作站 P3)] 报告→随访自动触发规则 (内存 + seed)
 * 报告提交 (SUBMITTED) 时按 impression/findings 关键词匹配规则 → 自动创建随访计划 (调 followup.service)
 * GET /followup-trigger-rules 供前端展示 (书写页「建议随访」卡片)
 */

export type FollowUpTriggerMode = 'auto' | 'hint'

export interface FollowUpTriggerRule {
  id: string
  keyword: string
  label: string
  description: string
  templateId: string
  templateName: string
  intervals: number[]
  /** 建议提示文案 (仅提示模式) */
  hint: string
  active: boolean
}

/** [v3.0.6.11-100 Wave2C P3] 触发规则 seed (10 条) — 内存 + seed, 对齐随访模板库 demoTemplates id */
export const SEED_FOLLOWUP_TRIGGER_RULES: FollowUpTriggerRule[] = [
  { id: 'FTR-001', keyword: '肺结节', label: '肺结节', description: '肺结节检出后按 3/6/12 个月复查 CT 对比大小', templateId: 'tpl-nodule', templateName: '肺结节随访', intervals: [90, 180, 360], hint: '建议 3/6/12 个月复查薄层 CT, 对比结节大小变化', active: true },
  { id: 'FTR-002', keyword: '磨玻璃', label: '磨玻璃影', description: '磨玻璃影随访: 短期复查评估吸收或进展', templateId: 'tpl-nodule', templateName: '肺结节随访', intervals: [90, 180, 360], hint: '磨玻璃影建议 3/6/12 个月随访复查', active: true },
  { id: 'FTR-003', keyword: '乳腺', label: '乳腺占位', description: '乳腺占位/结节按 6/12 个月随访影像复查', templateId: 'tpl-breast-ca', templateName: '乳腺癌术后随访', intervals: [90, 180, 360], hint: '建议 6/12 个月乳腺钼靶/超声随访', active: true },
  { id: 'FTR-004', keyword: '乳腺癌', label: '乳腺癌', description: '乳腺癌术后按 6/12 个月随访评估', templateId: 'tpl-breast-ca', templateName: '乳腺癌术后随访', intervals: [90, 180, 360], hint: '乳腺癌术后建议 6/12 个月随访 (影像 + 肿瘤标志物)', active: true },
  { id: 'FTR-005', keyword: '骨折', label: '骨折', description: '骨折愈合按 1/3 个月复查 X 线评估愈合', templateId: 'tpl-fracture', templateName: '骨科随访(骨折)', intervals: [30, 90], hint: '骨折建议 1/3 个月复查 X 线评估骨痂形成', active: true },
  { id: 'FTR-006', keyword: '肝癌', label: '肝癌/肝脏占位', description: '肝癌介入/术后按 3/6 个月随访复查', templateId: 'tpl-onc-ct', templateName: '肿瘤术后复查(CT)', intervals: [90, 180], hint: '肝癌建议 3/6 个月影像随访复查', active: true },
  { id: 'FTR-007', keyword: '甲状腺结节', label: '甲状腺结节', description: '甲状腺结节按 6/12 个月超声随访', templateId: 'tpl-thyroid-benign', templateName: '甲状腺良性结节随访', intervals: [180, 360], hint: '甲状腺结节建议 6/12 个月超声随访', active: true },
  { id: 'FTR-008', keyword: '冠脉支架', label: '冠脉支架术后', description: '冠脉支架术后按 1/3/6/12 个月随访', templateId: 'tpl-stent', templateName: '冠脉支架术后随访', intervals: [30, 90, 180, 360], hint: '冠脉支架术后建议 1/3/6/12 个月随访复查', active: true },
  { id: 'FTR-009', keyword: '椎间盘突出', label: '椎间盘突出', description: '腰椎退变/椎间盘突出按 3/6/12 个月随访', templateId: 'tpl-spine-fusion', templateName: '脊柱融合术后随访', intervals: [90, 180, 360], hint: '腰椎病变建议 3/6/12 个月随访复查', active: true },
  { id: 'FTR-010', keyword: '动脉瘤', label: '脑动脉瘤', description: '脑动脉瘤按 3/6/12 个月随访评估', templateId: 'tpl-aneurysm', templateName: '脑动脉瘤随访', intervals: [90, 180, 360], hint: '脑动脉瘤建议 3/6/12 个月随访复查', active: true },
]

export interface FollowUpTriggerMatch {
  rule: FollowUpTriggerRule
  matchedText: string
}

/** 匹配报告文本 (impression/findings) 中的触发规则 — 关键词命中返回规则列表 */
export function matchFollowUpTriggerRules(text: string | null | undefined): FollowUpTriggerMatch[] {
  if (!text || text.trim().length === 0) return []
  const haystack = String(text)
  const out: FollowUpTriggerMatch[] = []
  for (const rule of SEED_FOLLOWUP_TRIGGER_RULES) {
    if (!rule.active) continue
    if (haystack.includes(rule.keyword)) {
      out.push({ rule, matchedText: rule.keyword })
    }
  }
  return out
}

/** 前端「建议随访」卡片: 客户端匹配 (与后端同种子规则, 书写页无需请求即可提示) */
export function listFollowUpTriggerRules(): FollowUpTriggerRule[] {
  return SEED_FOLLOWUP_TRIGGER_RULES.map((r) => ({ ...r, intervals: [...r.intervals] }))
}

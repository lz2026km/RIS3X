// [G005 W8-Report] 分级审核规则引擎 — 类型定义
// 依据 模态/部位(可选) + RADS 分级 + 严重程度 + 危急征象 + 作者资历, 判定所需审核链:
//   none < initial(初核) < final(终核) < dual-sign(双签) < dual-read(双阅)
export type ReviewTier = 'none' | 'initial' | 'final' | 'dual-sign' | 'dual-read'
export type AuthorSeniority = 'resident' | 'attending' | 'senior' | 'chief'
export type CaseSeverity = 'low' | 'normal' | 'high' | 'critical'

export interface ReviewTierRule {
  id: string
  code: string
  name: string
  description: string
  /** 命中后要求的最低审核等级 */
  tier: ReviewTier
  enabled: boolean
  priority: number
  /** 命中条件 (全部满足) */
  when: {
    modalities?: string[]
    /** RADS 分类 >= 该值时命中 */
    radsCategoryGte?: number
    severities?: CaseSeverity[]
    isCritical?: boolean
    /** 作者资历在列表内时命中 (低资历需更严) */
    authorSeniorityIn?: AuthorSeniority[]
  }
  reason: string
}

export interface ReviewTierInput {
  reportId?: string
  modality?: string
  radsCategory?: number
  severity?: CaseSeverity
  isCritical?: boolean
  authorSeniority?: AuthorSeniority
  authorId?: string
}

export interface ReviewTierStep {
  order: number
  step: 'initial' | 'final' | 'co-sign' | 'peer-read'
  role: string
  label: string
  reason: string
}

export interface ReviewTierMatch {
  ruleId: string
  code: string
  name: string
  tier: ReviewTier
  reason: string
}

export interface ReviewTierResolution {
  source: 'demo'
  generatedAt: string
  reportId?: string
  input: ReviewTierInput
  requiredTier: ReviewTier
  tierLabel: string
  steps: ReviewTierStep[]
  matchedRules: ReviewTierMatch[]
  /** 是否触发危急征象链路 */
  critical: boolean
}

export const REVIEW_TIERS: ReviewTier[] = ['none', 'initial', 'final', 'dual-sign', 'dual-read']
export const AUTHOR_SENIORITIES: AuthorSeniority[] = ['resident', 'attending', 'senior', 'chief']
export const CASE_SEVERITIES: CaseSeverity[] = ['low', 'normal', 'high', 'critical']

export const TIER_LABELS: Record<ReviewTier, string> = {
  none: '免审',
  initial: '初核',
  final: '终核',
  'dual-sign': '双签',
  'dual-read': '双阅',
}

const TIER_RANK: Record<ReviewTier, number> = { none: 0, initial: 1, final: 2, 'dual-sign': 3, 'dual-read': 4 }

/** 取较严格 (较高) 的审核等级 */
export function maxTier(a: ReviewTier, b: ReviewTier): ReviewTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b
}

export function tierRank(t: ReviewTier): number {
  return TIER_RANK[t]
}

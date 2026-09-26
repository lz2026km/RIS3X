// [G005 W8-Report] 分级审核规则引擎服务 — 规则 CRUD (seed + 内存) + resolve 审核链判定。
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { BUILTIN_REVIEW_TIER_RULES } from './review-tier.rules'
import type {
  ReviewTier,
  ReviewTierInput,
  ReviewTierMatch,
  ReviewTierResolution,
  ReviewTierRule,
  ReviewTierStep,
} from './review-tier.types'
import { AUTHOR_SENIORITIES, CASE_SEVERITIES, maxTier, REVIEW_TIERS, tierRank, TIER_LABELS } from './review-tier.types'

@Injectable()
export class ReviewTierService {
  private readonly logger = new Logger(ReviewTierService.name)
  private rules: ReviewTierRule[] = []
  private customCounter = 0

  constructor(private readonly prisma?: PrismaService) {
    this.seed()
  }

  private seed(): void {
    this.rules = BUILTIN_REVIEW_TIER_RULES.map((r) => ({ ...r, when: { ...r.when, modalities: r.when.modalities ? [...r.when.modalities] : undefined, severities: r.when.severities ? [...r.when.severities] : undefined, authorSeniorityIn: r.when.authorSeniorityIn ? [...r.when.authorSeniorityIn] : undefined } }))
    this.customCounter = 0
  }

  private clone(r: ReviewTierRule): ReviewTierRule {
    return { ...r, when: { ...r.when, modalities: r.when.modalities ? [...r.when.modalities] : undefined, severities: r.when.severities ? [...r.when.severities] : undefined, authorSeniorityIn: r.when.authorSeniorityIn ? [...r.when.authorSeniorityIn] : undefined } }
  }

  listRules(): { source: 'demo'; generatedAt: string; total: number; data: ReviewTierRule[] } {
    const data = this.rules
      .map((r) => this.clone(r))
      .sort((a, b) => (b.priority - a.priority) || a.code.localeCompare(b.code))
    return { source: 'demo', generatedAt: new Date().toISOString(), total: data.length, data }
  }

  private validateTier(tier: ReviewTier): void {
    if (!REVIEW_TIERS.includes(tier)) throw new BadRequestException(`审核等级必须为 ${REVIEW_TIERS.join('|')}`)
  }

  async createRule(body: Partial<ReviewTierRule> & { name: string; tier: ReviewTier }): Promise<ReviewTierRule> {
    if (!body.name?.trim()) throw new BadRequestException('规则名称不能为空')
    this.validateTier(body.tier)
    if (body.when?.severities) {
      for (const s of body.when.severities) if (!CASE_SEVERITIES.includes(s)) throw new BadRequestException(`严重级别必须为 ${CASE_SEVERITIES.join('|')}`)
    }
    if (body.when?.authorSeniorityIn) {
      for (const s of body.when.authorSeniorityIn) if (!AUTHOR_SENIORITIES.includes(s)) throw new BadRequestException(`作者资历必须为 ${AUTHOR_SENIORITIES.join('|')}`)
    }
    this.customCounter += 1
    const rule: ReviewTierRule = {
      id: `rtier-c-${String(this.customCounter).padStart(3, '0')}`,
      code: body.code?.trim() || `RT-CUSTOM-${this.customCounter}`,
      name: body.name.trim(),
      description: body.description?.trim() || '',
      tier: body.tier,
      enabled: body.enabled ?? true,
      priority: Number.isFinite(body.priority) ? Number(body.priority) : 30,
      when: body.when ? { ...body.when } : {},
      reason: body.reason?.trim() || '自定义分级审核规则',
    }
    this.rules.push(rule)
    void this.persistAudit('create', { ruleId: rule.id, code: rule.code, tier: rule.tier })
    return this.clone(rule)
  }

  async updateRule(id: string, body: Partial<ReviewTierRule>): Promise<ReviewTierRule> {
    const rule = this.rules.find((r) => r.id === id)
    if (!rule) throw new NotFoundException(`分级审核规则 ${id} 不存在`)
    if (body.tier !== undefined) {
      this.validateTier(body.tier)
      rule.tier = body.tier
    }
    if (body.name !== undefined && body.name.trim()) rule.name = body.name.trim()
    if (body.description !== undefined) rule.description = body.description
    if (body.enabled !== undefined) rule.enabled = body.enabled
    if (body.priority !== undefined && Number.isFinite(body.priority)) rule.priority = Number(body.priority)
    if (body.reason !== undefined && body.reason.trim()) rule.reason = body.reason.trim()
    if (body.when !== undefined) rule.when = { ...body.when }
    if (body.code !== undefined && body.code.trim()) rule.code = body.code.trim()
    void this.persistAudit('update', { ruleId: rule.id })
    return this.clone(rule)
  }

  async deleteRule(id: string): Promise<{ id: string; deleted: boolean }> {
    const rule = this.rules.find((r) => r.id === id)
    if (!rule) throw new NotFoundException(`分级审核规则 ${id} 不存在`)
    if (rule.id.startsWith('rtier-b-')) throw new BadRequestException('内置规则不可删除, 可停用')
    this.rules = this.rules.filter((r) => r.id !== id)
    void this.persistAudit('delete', { ruleId: id })
    return { id, deleted: true }
  }

  /** 判定所需审核链 */
  resolve(input: ReviewTierInput): ReviewTierResolution {
    const modality = input.modality?.trim().toUpperCase()
    const matchedRules: ReviewTierMatch[] = []
    let requiredTier: ReviewTier = 'none'

    const enabled = this.rules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority)
    for (const rule of enabled) {
      if (!this.matches(rule, input, modality)) continue
      matchedRules.push({ ruleId: rule.id, code: rule.code, name: rule.name, tier: rule.tier, reason: rule.reason })
      requiredTier = maxTier(requiredTier, rule.tier)
    }
    if (matchedRules.length === 0) requiredTier = 'initial'

    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      reportId: input.reportId,
      input: { ...input },
      requiredTier,
      tierLabel: TIER_LABELS[requiredTier],
      steps: this.buildSteps(requiredTier, matchedRules),
      matchedRules: matchedRules.sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || a.code.localeCompare(b.code)),
      critical: Boolean(input.isCritical) || input.severity === 'critical' || matchedRules.some((m) => m.code === 'RT-CRIT-01' || m.code === 'RT-SEV-CRIT'),
    }
  }

  private matches(rule: ReviewTierRule, input: ReviewTierInput, modality?: string): boolean {
    const w = rule.when
    if (w.modalities?.length) {
      if (!modality || !w.modalities.map((m) => m.toUpperCase()).includes(modality)) return false
    }
    if (w.radsCategoryGte !== undefined) {
      if (typeof input.radsCategory !== 'number' || input.radsCategory < w.radsCategoryGte) return false
    }
    if (w.severities?.length) {
      if (!input.severity || !w.severities.includes(input.severity)) return false
    }
    if (w.isCritical !== undefined) {
      if (Boolean(input.isCritical) !== w.isCritical) return false
    }
    if (w.authorSeniorityIn?.length) {
      if (!input.authorSeniority || !w.authorSeniorityIn.includes(input.authorSeniority)) return false
    }
    return true
  }

  private buildSteps(tier: ReviewTier, matched: ReviewTierMatch[]): ReviewTierStep[] {
    const topReason = matched[0]?.reason ?? ''
    switch (tier) {
      case 'none':
        return []
      case 'initial':
        return [{ order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: topReason || '常规初核' }]
      case 'final':
        return [
          { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
          { order: 2, step: 'final', role: 'senior-reviewer', label: '终核', reason: topReason || '须终核' },
        ]
      case 'dual-sign':
        return [
          { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
          { order: 2, step: 'final', role: 'senior-reviewer', label: '终核', reason: '终核通过' },
          { order: 3, step: 'co-sign', role: 'co-signer', label: '双签', reason: topReason || '须双人签名' },
        ]
      case 'dual-read':
        return [
          { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
          { order: 2, step: 'peer-read', role: 'peer-reader', label: '双阅', reason: topReason || '须双人阅片' },
          { order: 3, step: 'final', role: 'senior-reviewer', label: '终核', reason: '终核通过' },
        ]
      default:
        return []
    }
  }

  private async persistAudit(action: string, detail: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma?.auditLog.create({ data: { action: `REVIEW_TIER_${action.toUpperCase()}`, resource: 'review-tier-rule', detail: detail as Prisma.InputJsonValue, tenantId: 'tenant-demo' } })
    } catch (err) {
      this.logger.warn(`[ReviewTier] persist ${action} failed (seed 回退): ${(err as Error).message}`)
    }
  }
}

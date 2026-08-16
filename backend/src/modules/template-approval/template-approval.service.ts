/**
 * G005 放射RIS系统 v3.0.6.11-101 - 模板审批流 V2 (Wave 6C, F7, 孤儿模块)
 *
 * 能力:
 *  1. 模板状态机: 草稿 → 提交审批 → 审批中 → 通过/驳回 → 发布;
 *     非法流转 (如未提交直接通过 / 已发布再提交) 一律拒绝。
 *  2. 版本管理: 每次修改内容生成新版本 (version+1 + 版本历史快照)。
 *  3. 审批人分配 (按科室/角色), 审批记录 (意见/时间)。
 *  4. 模板收藏 / 使用统计。
 *
 * 孤儿模块模式 + seed 回退: 不注册进 app.module, spec 直接注入测试;
 * DB 可用时联动 reportTemplate/auditLog, 不可用时纯内存 seed 仍可用。
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ================= 类型 =================

export type TemplateStateV2 = 'draft' | 'pending' | 'approved' | 'rejected' | 'published'
export type ApprovalActionV2 = 'submit' | 'approve' | 'reject' | 'publish' | 'rework'

export interface TemplateVersionV2 {
  version: number
  name: string
  content: string
  category: string
  bodyPart: string
  changedBy: string
  note: string
  at: string
}

export interface TemplateApprovalRecordV2 {
  id: string
  templateId: string
  action: ApprovalActionV2
  actorName: string
  comment?: string
  at: string
}

export interface ApproverAssignmentV2 {
  dept: string
  role: string
  approverName: string
}

export interface ReportTemplateV2 {
  id: string
  name: string
  category: string
  modality?: string
  bodyPart: string
  content: string
  state: TemplateStateV2
  version: number
  versions: TemplateVersionV2[]
  approvals: TemplateApprovalRecordV2[]
  assignee?: ApproverAssignmentV2
  favoriteCount: number
  usageCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TemplateApprovalStatsV2 {
  total: number
  byState: Record<TemplateStateV2, number>
  pendingCount: number
  publishedCount: number
  totalVersions: number
  avgApprovalHours: number
  totalFavorites: number
  totalUsage: number
}

// ================= 状态机 =================

// 合法流转: draft→pending(提交) / pending→approved(通过)/rejected(驳回) /
// approved→published(发布)/draft(退回) / rejected→draft(修改后重新提交)
const TRANSITIONS: Record<TemplateStateV2, Partial<Record<ApprovalActionV2, TemplateStateV2>>> = {
  draft: { submit: 'pending' },
  pending: { approve: 'approved', reject: 'rejected' },
  approved: { publish: 'published', rework: 'draft' },
  rejected: { submit: 'pending', rework: 'draft' },
  published: {},
}

const STATE_LABEL: Record<TemplateStateV2, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  published: '已发布',
}

// ================= Seed (确定性) =================

function seedVersion(version: number, name: string, content: string, category: string, bodyPart: string, changedBy: string, note: string, at: string): TemplateVersionV2 {
  return { version, name, content, category, bodyPart, changedBy, note, at }
}

const TEMPLATE_SEED: ReportTemplateV2[] = [
  {
    id: 'tpa-001', name: '头颅CT平扫报告模板', category: 'CT', modality: 'CT', bodyPart: '头颅',
    content: '头颅CT平扫: 脑实质密度未见异常, 中线结构居中, 脑室系统大小形态正常。',
    state: 'published', version: 3,
    versions: [
      seedVersion(1, '头颅CT平扫报告模板', '头颅CT平扫: 未见明显异常。', 'CT', '头颅', '张伟', '创建', '2026-07-01T02:00:00.000Z'),
      seedVersion(2, '头颅CT平扫报告模板', '头颅CT平扫: 脑实质密度未见异常。', 'CT', '头颅', '张伟', '补充脑室描述', '2026-07-10T03:30:00.000Z'),
      seedVersion(3, '头颅CT平扫报告模板', '头颅CT平扫: 脑实质密度未见异常, 中线结构居中, 脑室系统大小形态正常。', 'CT', '头颅', '张伟', '发布前最终修订', '2026-07-15T01:00:00.000Z'),
    ],
    approvals: [
      { id: 'tpa-a1', templateId: 'tpa-001', action: 'submit', actorName: '张伟', comment: '提交科室模板库', at: '2026-07-10T04:00:00.000Z' },
      { id: 'tpa-a2', templateId: 'tpa-001', action: 'approve', actorName: '王浩', comment: '内容规范, 同意发布', at: '2026-07-11T02:00:00.000Z' },
      { id: 'tpa-a3', templateId: 'tpa-001', action: 'publish', actorName: '王浩', comment: '发布至科室模板库', at: '2026-07-11T02:30:00.000Z' },
    ],
    assignee: { dept: '放射科', role: 'DIRECTOR', approverName: '王浩' },
    favoriteCount: 12, usageCount: 68,
    createdBy: '张伟', createdAt: '2026-07-01T02:00:00.000Z', updatedAt: '2026-07-15T01:00:00.000Z',
  },
  {
    id: 'tpa-002', name: '胸部CT增强(肺结节随访)', category: 'CT', modality: 'CT', bodyPart: '胸部',
    content: '右肺上叶磨玻璃结节影, 大小约1.2cm, 建议6个月后复查。',
    state: 'pending', version: 2,
    versions: [
      seedVersion(1, '胸部CT增强(肺结节随访)', '右肺上叶磨玻璃结节影。', 'CT', '胸部', '李明', '创建', '2026-08-01T01:00:00.000Z'),
      seedVersion(2, '胸部CT增强(肺结节随访)', '右肺上叶磨玻璃结节影, 大小约1.2cm, 建议6个月后复查。', 'CT', '胸部', '李明', '补充随访建议', '2026-08-05T02:00:00.000Z'),
    ],
    approvals: [{ id: 'tpa-a4', templateId: 'tpa-002', action: 'submit', actorName: '李明', comment: '提交审批', at: '2026-08-06T01:00:00.000Z' }],
    assignee: { dept: '放射科', role: 'DOCTOR', approverName: '王浩' },
    favoriteCount: 5, usageCount: 21,
    createdBy: '李明', createdAt: '2026-08-01T01:00:00.000Z', updatedAt: '2026-08-06T01:00:00.000Z',
  },
  {
    id: 'tpa-003', name: '腰椎MR平扫模板', category: 'MR', modality: 'MR', bodyPart: '腰椎',
    content: '腰椎生理曲度存在, 椎体信号未见异常, 椎间盘未见明显突出。',
    state: 'draft', version: 1,
    versions: [
      seedVersion(1, '腰椎MR平扫模板', '腰椎生理曲度存在, 椎体信号未见异常, 椎间盘未见明显突出。', 'MR', '腰椎', '赵敏', '创建', '2026-08-10T05:00:00.000Z'),
    ],
    approvals: [],
    favoriteCount: 0, usageCount: 3,
    createdBy: '赵敏', createdAt: '2026-08-10T05:00:00.000Z', updatedAt: '2026-08-10T05:00:00.000Z',
  },
  {
    id: 'tpa-004', name: '腹部CT平扫(泌尿系)模板', category: 'CT', modality: 'CT', bodyPart: '腹部',
    content: '双肾大小形态正常, 未见结石及积水, 输尿管未见扩张。',
    state: 'rejected', version: 2,
    versions: [
      seedVersion(1, '腹部CT平扫(泌尿系)模板', '双肾未见异常。', 'CT', '腹部', '周婷', '创建', '2026-07-20T06:00:00.000Z'),
      seedVersion(2, '腹部CT平扫(泌尿系)模板', '双肾大小形态正常, 未见结石及积水, 输尿管未见扩张。', 'CT', '腹部', '周婷', '细化描述', '2026-07-25T03:00:00.000Z'),
    ],
    approvals: [
      { id: 'tpa-a5', templateId: 'tpa-004', action: 'submit', actorName: '周婷', comment: '提交审批', at: '2026-07-26T02:00:00.000Z' },
      { id: 'tpa-a6', templateId: 'tpa-004', action: 'reject', actorName: '王浩', comment: '泌尿系描述需补充输尿管情况', at: '2026-07-27T01:00:00.000Z' },
    ],
    assignee: { dept: '放射科', role: 'DIRECTOR', approverName: '王浩' },
    favoriteCount: 1, usageCount: 9,
    createdBy: '周婷', createdAt: '2026-07-20T06:00:00.000Z', updatedAt: '2026-07-27T01:00:00.000Z',
  },
  {
    id: 'tpa-005', name: '乳腺钼靶BI-RADS模板', category: 'MG', modality: 'MG', bodyPart: '乳腺',
    content: '左乳外上象限结节伴毛刺, BI-RADS 4B 类, 建议穿刺活检。',
    state: 'approved', version: 1,
    versions: [
      seedVersion(1, '乳腺钼靶BI-RADS模板', '左乳外上象限结节伴毛刺, BI-RADS 4B 类, 建议穿刺活检。', 'MG', '乳腺', '王芳', '创建', '2026-08-12T02:00:00.000Z'),
    ],
    approvals: [
      { id: 'tpa-a7', templateId: 'tpa-005', action: 'submit', actorName: '王芳', comment: '提交审批', at: '2026-08-13T01:00:00.000Z' },
      { id: 'tpa-a8', templateId: 'tpa-005', action: 'approve', actorName: '陈雅芝', comment: '分类描述准确', at: '2026-08-14T01:30:00.000Z' },
    ],
    assignee: { dept: '乳腺影像组', role: 'DIRECTOR', approverName: '陈雅芝' },
    favoriteCount: 8, usageCount: 32,
    createdBy: '王芳', createdAt: '2026-08-12T02:00:00.000Z', updatedAt: '2026-08-14T01:30:00.000Z',
  },
]

// 审批人分配规则 (按科室/角色)
const ASSIGNMENT_RULES: ApproverAssignmentV2[] = [
  { dept: '放射科', role: 'DIRECTOR', approverName: '王浩' },
  { dept: '放射科', role: 'DOCTOR', approverName: '王浩' },
  { dept: '乳腺影像组', role: 'DIRECTOR', approverName: '陈雅芝' },
  { dept: '神经影像组', role: 'DIRECTOR', approverName: '刘建国' },
  { dept: '通用', role: 'ADMIN', approverName: '系统管理员' },
]

// 模板类别 → 审批科室
const CATEGORY_TO_DEPT: Record<string, string> = {
  CT: '放射科',
  DR: '放射科',
  US: '放射科',
  MR: '神经影像组',
  MG: '乳腺影像组',
  DBT: '乳腺影像组',
  PET: '放射科',
  DSA: '放射科',
}

@Injectable()
export class TemplateApprovalService {
  private readonly logger = new Logger(TemplateApprovalService.name)

  private readonly templates: ReportTemplateV2[] = TEMPLATE_SEED.map((t) => ({
    ...t,
    versions: [...t.versions],
    approvals: [...t.approvals],
  }))

  private readonly favorites = new Map<string, Set<string>>()

  private readonly idCounter = { n: 1000 }

  constructor(private readonly prisma: PrismaService) {}

  // ================= 模板 CRUD =================

  listTemplates(filter?: { state?: TemplateStateV2; category?: string; keyword?: string }): ReportTemplateV2[] {
    let list = [...this.templates]
    if (filter?.state) list = list.filter((t) => t.state === filter.state)
    if (filter?.category) list = list.filter((t) => t.category === filter.category)
    if (filter?.keyword?.trim()) {
      const q = filter.keyword.trim().toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q))
    }
    return list
  }

  getTemplate(id: string): ReportTemplateV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    return { ...t, versions: [...t.versions], approvals: [...t.approvals] }
  }

  createTemplate(dto: {
    name: string
    category: string
    modality?: string
    bodyPart: string
    content: string
    createdBy: string
  }): ReportTemplateV2 {
    if (!dto.name?.trim()) throw new BadRequestException('模板名称不能为空')
    if (!dto.content?.trim()) throw new BadRequestException('模板内容不能为空')
    const now = new Date().toISOString()
    const template: ReportTemplateV2 = {
      id: `tpa-${String(this.idCounter.n++).padStart(3, '0')}`,
      name: dto.name.trim(),
      category: dto.category?.trim() || '通用',
      modality: dto.modality,
      bodyPart: dto.bodyPart?.trim() || '通用',
      content: dto.content.trim(),
      state: 'draft',
      version: 1,
      versions: [seedVersion(1, dto.name.trim(), dto.content.trim(), dto.category?.trim() || '通用', dto.bodyPart?.trim() || '通用', dto.createdBy, '创建', now)],
      approvals: [],
      favoriteCount: 0,
      usageCount: 0,
      createdBy: dto.createdBy,
      createdAt: now,
      updatedAt: now,
    }
    this.templates.unshift(template)
    void this.persistTemplate(template)
    return { ...template, versions: [...template.versions], approvals: [] }
  }

  /**
   * 修改内容 → 生成新版本 (version+1 + 历史快照)。
   * 仅草稿/已驳回可修改; 审批中/已通过/已发布禁止直接修改 (需走状态机)。
   */
  updateContent(id: string, dto: { name?: string; content?: string; bodyPart?: string; changedBy: string; note?: string }): ReportTemplateV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    if (t.state === 'pending') throw new BadRequestException('审批中模板不可修改, 请等待审批结果或先撤回')
    if (t.state === 'published') throw new BadRequestException('已发布模板不可直接修改, 请克隆为新草稿')
    if (t.state === 'approved') throw new BadRequestException('已通过模板请先发布或退回草稿后再修改')
    if (!dto.content?.trim() && !dto.name?.trim()) throw new BadRequestException('修改内容为空')
    const nextVersion = t.version + 1
    t.name = dto.name?.trim() || t.name
    t.content = dto.content?.trim() || t.content
    t.bodyPart = dto.bodyPart?.trim() || t.bodyPart
    t.version = nextVersion
    t.versions.push(seedVersion(nextVersion, t.name, t.content, t.category, t.bodyPart, dto.changedBy, dto.note?.trim() || '内容修改', new Date().toISOString()))
    t.updatedAt = new Date().toISOString()
    // 修改后回落草稿 (状态机要求重新提交审批)
    if (t.state === 'rejected') {
      t.state = 'draft'
      t.assignee = undefined
      t.approvals.push({ id: this.nextApprovalId(), templateId: t.id, action: 'rework', actorName: dto.changedBy, comment: dto.note, at: t.updatedAt })
    }
    void this.persistTemplate(t)
    return { ...t, versions: [...t.versions], approvals: [...t.approvals] }
  }

  getVersions(id: string): TemplateVersionV2[] {
    return [...this.getTemplate(id).versions].sort((a, b) => b.version - a.version)
  }

  getApprovals(id: string): TemplateApprovalRecordV2[] {
    return [...this.getTemplate(id).approvals].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }

  // ================= 状态机 =================

  /**
   * 通用状态机流转。非法流转 (未提交直接审批/已发布再提交/重复操作) → BadRequestException。
   * 每次流转记录审批记录 (动作/意见/时间)。
   */
  private transition(id: string, action: ApprovalActionV2, actorName: string, comment?: string): ReportTemplateV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    const allowed = TRANSITIONS[t.state]
    const target = allowed[action]
    if (!target) {
      throw new BadRequestException(
        `非法状态流转: ${STATE_LABEL[t.state]} 模板不能执行「${action}」 (合法动作: ${Object.keys(allowed).join('/') || '无'})`,
      )
    }
    if (action === 'approve' && t.assignee && t.assignee.approverName !== actorName) {
      throw new BadRequestException(`审批人非当前分配人 (应为 ${t.assignee.approverName})`)
    }
    t.state = target
    t.updatedAt = new Date().toISOString()
    t.approvals.push({ id: this.nextApprovalId(), templateId: t.id, action, actorName, comment: comment?.trim(), at: t.updatedAt })
    void this.persistTemplate(t)
    return { ...t, versions: [...t.versions], approvals: [...t.approvals] }
  }

  submit(id: string, dto: { submittedBy: string; comment?: string }): ReportTemplateV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    if (t.state === 'pending') throw new BadRequestException('模板已在审批中, 请勿重复提交')
    const updated = this.transition(id, 'submit', dto.submittedBy, dto.comment ?? '提交审批')
    // 提交时自动按科室/角色分配审批人 (未手动分配时)
    if (!t.assignee) {
      const dept = CATEGORY_TO_DEPT[t.category] ?? '放射科'
      const rule = ASSIGNMENT_RULES.find((r) => r.dept === dept) ?? ASSIGNMENT_RULES.find((r) => r.dept === '通用')!
      t.assignee = { ...rule }
      updated.assignee = { ...rule }
    }
    return updated
  }

  assignApprover(id: string, dto: { dept: string; role: string; approverName: string }): ReportTemplateV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    if (t.state !== 'draft' && t.state !== 'pending') throw new BadRequestException('仅草稿/审批中模板可调整审批人')
    if (!dto.approverName?.trim()) throw new BadRequestException('审批人不能为空')
    t.assignee = { dept: dto.dept || '放射科', role: dto.role || 'DIRECTOR', approverName: dto.approverName.trim() }
    return { ...t, versions: [...t.versions], approvals: [...t.approvals] }
  }

  approve(id: string, dto: { approvedBy: string; comment?: string }): ReportTemplateV2 {
    return this.transition(id, 'approve', dto.approvedBy, dto.comment ?? '审批通过')
  }

  reject(id: string, dto: { rejectedBy: string; reason: string }): ReportTemplateV2 {
    if (!dto.reason?.trim()) throw new BadRequestException('驳回原因不能为空')
    return this.transition(id, 'reject', dto.rejectedBy, dto.reason.trim())
  }

  publish(id: string, dto: { publishedBy: string; comment?: string }): ReportTemplateV2 {
    return this.transition(id, 'publish', dto.publishedBy, dto.comment ?? '发布至模板库')
  }

  rework(id: string, dto: { by: string; comment?: string }): ReportTemplateV2 {
    return this.transition(id, 'rework', dto.by, dto.comment ?? '退回修改')
  }

  // ================= 收藏 / 使用统计 =================

  toggleFavorite(id: string, userId: string): { favorite: boolean; favorites: string[] } {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    const key = userId || 'u-001'
    let set = this.favorites.get(key)
    if (!set) {
      set = new Set<string>()
      this.favorites.set(key, set)
    }
    if (set.has(id)) {
      set.delete(id)
      t.favoriteCount = Math.max(0, t.favoriteCount - 1)
      return { favorite: false, favorites: Array.from(set) }
    }
    set.add(id)
    t.favoriteCount += 1
    return { favorite: true, favorites: Array.from(set) }
  }

  listFavorites(userId: string): ReportTemplateV2[] {
    const set = this.favorites.get(userId || 'u-001') ?? new Set<string>()
    return this.templates.filter((t) => set.has(t.id))
  }

  recordUsage(id: string, usedBy?: string): ReportTemplateV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    if (t.state === 'published' || t.state === 'approved') {
      t.usageCount += 1
    }
    return { ...t, versions: [...t.versions], approvals: [...t.approvals] }
  }

  // ================= 统计 =================

  stats(): TemplateApprovalStatsV2 {
    const byState: Record<TemplateStateV2, number> = { draft: 0, pending: 0, approved: 0, rejected: 0, published: 0 }
    for (const t of this.templates) byState[t.state] += 1
    const approvedLogs: { at: string; submitted: string }[] = []
    for (const t of this.templates) {
      const submitLog = t.approvals.find((a) => a.action === 'submit')
      const approveLog = t.approvals.find((a) => a.action === 'approve')
      if (submitLog && approveLog) {
        approvedLogs.push({ at: approveLog.at, submitted: submitLog.at })
      }
    }
    const totalHours = approvedLogs.reduce((s, l) => s + Math.max(0, (new Date(l.at).getTime() - new Date(l.submitted).getTime()) / 3600_000), 0)
    return {
      total: this.templates.length,
      byState,
      pendingCount: byState.pending,
      publishedCount: byState.published,
      totalVersions: this.templates.reduce((s, t) => s + t.version, 0),
      avgApprovalHours: approvedLogs.length ? Math.round((totalHours / approvedLogs.length) * 10) / 10 : 0,
      totalFavorites: this.templates.reduce((s, t) => s + t.favoriteCount, 0),
      totalUsage: this.templates.reduce((s, t) => s + t.usageCount, 0),
    }
  }

  // ================= 内部 =================

  private nextApprovalId(): string {
    return `tpa-log-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`
  }

  /** 联动 DB: 写入 reportTemplate (DB 不可用时静默跳过, seed 回退) */
  private async persistTemplate(t: ReportTemplateV2): Promise<void> {
    try {
      await this.prisma.reportTemplate.create({
        data: {
          tenantId: currentTenantId(),
          name: t.name,
          category: t.category,
          modality: t.modality ?? null,
          bodyPart: t.bodyPart,
          body: t.content,
          status: t.state === 'published' ? 'approved' : t.state,
          version: t.version,
          createdById: t.createdBy,
          tags: [],
        } as never,
      })
      await this.prisma.auditLog.create({
        data: {
          action: 'TEMPLATE_APPROVAL_V2',
          resource: 'template-approval',
          resourceId: t.id,
          detail: { state: t.state, version: t.version } as never,
          tenantId: currentTenantId(),
        },
      })
    } catch (err) {
      this.logger.debug(`[TemplateApproval] persist skipped: ${(err as Error).message}`)
    }
  }
}

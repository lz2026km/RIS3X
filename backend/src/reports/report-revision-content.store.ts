// [G005 W8-Report] 内容版本快照存储 (DB-less-safe, 内存 + seed)。
// 目的: ReportRevision 仅记录状态迁移, 无内容; 本 store 按修订版本持久化
//       findings/impression/conclusion/diagnosis/recommendations/qualityScore,
//       使 POST/GET /reports/:id/revisions[/:versionId/diff] 返回真实前后差异。
import { Injectable } from '@nestjs/common'

export interface ReportRevisionContent {
  id: string
  reportId: string
  versionNumber: number
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
  qualityScore: number | null
  actorId: string
  fromState: string
  toState: string
  reason?: string
  createdAt: string
}

export interface RevisionContentDiff {
  reportId: string
  fromVersionId: string | null
  toVersionId: string
  fromVersionNumber: number | null
  toVersionNumber: number
  changedFields: string[]
  fields: Array<{ field: string; label: string; before: string; after: string; changed: boolean }>
  before: ReportRevisionContent | null
  after: ReportRevisionContent
}

const CONTENT_FIELDS: Array<{ field: keyof ReportRevisionContent; label: string }> = [
  { field: 'findings', label: '影像所见' },
  { field: 'diagnosis', label: '诊断' },
  { field: 'impression', label: '印象' },
  { field: 'conclusion', label: '结论' },
  { field: 'recommendations', label: '建议' },
]

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()

const SEED: ReportRevisionContent[] = [
  {
    id: 'rrc-RPT-000001-1',
    reportId: 'RPT-000001',
    versionNumber: 1,
    findings: '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影, 边缘光滑。',
    impression: '右肺上叶磨玻璃结节, 建议随访。',
    conclusion: '右肺上叶磨玻璃结节, 建议 6 个月后复查。',
    diagnosis: '右肺上叶磨玻璃结节',
    recommendations: '建议 6 个月后复查胸部 CT。',
    qualityScore: 88,
    actorId: 'D001',
    fromState: 'WRITING',
    toState: 'SUBMITTED',
    reason: '首次提交',
    createdAt: iso(60 * 24 * 3),
  },
  {
    id: 'rrc-RPT-000001-2',
    reportId: 'RPT-000001',
    versionNumber: 2,
    findings: '双肺纹理清晰, 右肺上叶见 6mm 磨玻璃结节影, 边缘欠光滑, 可见分叶。',
    impression: '右肺上叶磨玻璃结节 (较前增大), 考虑肿瘤性病变待排。',
    conclusion: '右肺上叶磨玻璃结节较前增大, 建议 3 个月后复查或进一步检查。',
    diagnosis: '右肺上叶磨玻璃结节, 考虑肿瘤性病变待排',
    recommendations: '建议 3 个月后复查胸部 CT, 必要时 PET-CT。',
    qualityScore: 82,
    actorId: 'D001',
    fromState: 'SUBMITTED',
    toState: 'INITIAL_REVIEW',
    reason: '初审通过',
    createdAt: iso(60 * 24),
  },
  {
    id: 'rrc-RPT-000001-3',
    reportId: 'RPT-000001',
    versionNumber: 3,
    findings: '双肺纹理清晰, 右肺上叶见 6mm 磨玻璃结节影, 边缘欠光滑, 可见分叶及胸膜牵拉。',
    impression: '右肺上叶磨玻璃结节, 考虑肿瘤性病变, 建议进一步检查。',
    conclusion: '右肺上叶磨玻璃结节, 考虑肿瘤性病变, 建议 3 个月后复查或穿刺活检。',
    diagnosis: '右肺上叶磨玻璃结节, 考虑肿瘤性病变',
    recommendations: '建议 3 个月后复查胸部 CT, 必要时 PET-CT 或穿刺活检。',
    qualityScore: 90,
    actorId: 'D002',
    fromState: 'INITIAL_REVIEW',
    toState: 'FINAL_REVIEW',
    reason: '终核修订: 补充胸膜牵拉征象',
    createdAt: iso(60 * 12),
  },
  {
    id: 'rrc-RPT-1001-1',
    reportId: 'RPT-1001',
    versionNumber: 1,
    findings: '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影。',
    impression: '右肺上叶磨玻璃结节, 建议随访。',
    conclusion: '右肺上叶磨玻璃结节, 建议随访。',
    diagnosis: '右肺上叶磨玻璃结节',
    recommendations: '建议 6 个月后复查。',
    qualityScore: 85,
    actorId: 'D001',
    fromState: 'WRITING',
    toState: 'SUBMITTED',
    createdAt: iso(60 * 30),
  },
  {
    id: 'rrc-RPT-1001-2',
    reportId: 'RPT-1001',
    versionNumber: 2,
    findings: '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影, 边界清晰, 密度均匀。',
    impression: '右肺上叶磨玻璃结节, 良性可能大, 建议年度随访。',
    conclusion: '右肺上叶磨玻璃结节, 良性可能大, 建议年度随访。',
    diagnosis: '右肺上叶磨玻璃结节',
    recommendations: '建议 12 个月后复查胸部 CT。',
    qualityScore: 92,
    actorId: 'D002',
    fromState: 'INITIAL_REVIEW',
    toState: 'FINAL_REVIEW',
    reason: '终核修订: 完善结节描述',
    createdAt: iso(60 * 20),
  },
]

@Injectable()
export class ReportRevisionContentStore {
  private readonly store = new Map<string, ReportRevisionContent[]>()
  private seq = 0

  constructor() {
    this.seed()
  }

  private seed(): void {
    for (const item of SEED) {
      const list = this.store.get(item.reportId) ?? []
      list.push({ ...item })
      this.store.set(item.reportId, list)
    }
    for (const list of this.store.values()) list.sort((a, b) => a.versionNumber - b.versionNumber)
    this.seq = 1000
  }

  /** 追加内容快照 (与 ReportRevision 一一对应) */
  append(input: Omit<ReportRevisionContent, 'id' | 'versionNumber' | 'createdAt'> & { versionNumber?: number; createdAt?: string }): ReportRevisionContent {
    const list = this.store.get(input.reportId) ?? []
    const nextVersion = input.versionNumber ?? (list.length > 0 ? list[list.length - 1]!.versionNumber + 1 : 1)
    const record: ReportRevisionContent = {
      id: `rrc-${input.reportId}-${++this.seq}`,
      reportId: input.reportId,
      versionNumber: nextVersion,
      findings: input.findings ?? '',
      impression: input.impression ?? '',
      conclusion: input.conclusion ?? '',
      diagnosis: input.diagnosis ?? '',
      recommendations: input.recommendations ?? '',
      qualityScore: input.qualityScore ?? null,
      actorId: input.actorId ?? 'unknown',
      fromState: input.fromState ?? '',
      toState: input.toState ?? '',
      reason: input.reason,
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
    list.push(record)
    this.store.set(input.reportId, list)
    return { ...record }
  }

  /** 报告全部内容快照 (按版本升序) */
  list(reportId: string): ReportRevisionContent[] {
    return (this.store.get(reportId) ?? []).map((r) => ({ ...r }))
  }

  latest(reportId: string): ReportRevisionContent | null {
    const list = this.store.get(reportId) ?? []
    return list.length > 0 ? { ...list[list.length - 1]! } : null
  }

  getByVersionId(reportId: string, versionId: string): ReportRevisionContent | null {
    const list = this.store.get(reportId) ?? []
    const found = list.find((r) => r.id === versionId || String(r.versionNumber) === versionId)
    return found ? { ...found } : null
  }

  count(reportId: string): number {
    return (this.store.get(reportId) ?? []).length
  }

  /** 版本差异: 指定版本 vs 其前一版本; 若不指定则最新 vs 前一版本 */
  diff(reportId: string, versionId?: string): RevisionContentDiff | null {
    const list = this.store.get(reportId) ?? []
    if (list.length === 0) return null
    let toIdx = list.length - 1
    if (versionId) {
      const idx = list.findIndex((r) => r.id === versionId || String(r.versionNumber) === versionId)
      if (idx < 0) return null
      toIdx = idx
    }
    const fromIdx = toIdx - 1
    return this.buildDiff(reportId, fromIdx >= 0 ? list[fromIdx]! : null, list[toIdx]!)
  }

  /** 两个任意快照的差异 */
  diffBetween(reportId: string, fromId: string, toId: string): RevisionContentDiff | null {
    const list = this.store.get(reportId) ?? []
    const from = list.find((r) => r.id === fromId || String(r.versionNumber) === fromId) ?? null
    const to = list.find((r) => r.id === toId || String(r.versionNumber) === toId) ?? null
    if (!to) return null
    return this.buildDiff(reportId, from, to)
  }

  private buildDiff(reportId: string, before: ReportRevisionContent | null, after: ReportRevisionContent): RevisionContentDiff {
    const fields = CONTENT_FIELDS.map(({ field, label }) => {
      const b = before ? String(before[field] ?? '') : ''
      const a = String(after[field] ?? '')
      return { field: String(field), label, before: b, after: a, changed: b !== a }
    })
    fields.sort((x, y) => {
      const rank = (f: { field: string; before: string; after: string; changed: boolean }) =>
        f.changed ? 0 : f.after ? 1 : 2
      return rank(x) - rank(y)
    })
    const changedFields = fields.filter((f) => f.changed).map((f) => f.field)
    return {
      reportId,
      fromVersionId: before?.id ?? null,
      toVersionId: after.id,
      fromVersionNumber: before?.versionNumber ?? null,
      toVersionNumber: after.versionNumber,
      changedFields,
      fields,
      before: before ? { ...before } : null,
      after: { ...after },
    }
  }
}

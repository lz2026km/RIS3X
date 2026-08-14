/**
 * G005 放射RIS系统 v3.0.6.11-99 Wave 2A (报告批注) - 报告批注服务
 * 内存 + 种子 (报告协作批注: 引用段落 / 回复 / 解决 / 重开 / 按作者统计)
 * 端点:
 *   - GET    /report-annotations?reportId=   批注列表
 *   - POST   /report-annotations             新建批注
 *   - PATCH  /report-annotations/:id         编辑批注
 *   - DELETE /report-annotations/:id         删除批注
 *   - POST   /report-annotations/:id/reply   回复 (嵌套 1 层)
 *   - POST   /report-annotations/:id/resolve 解决
 *   - POST   /report-annotations/:id/reopen  重开
 *   - GET    /report-annotations/stats?reportId= 统计 (总数/未解决/按作者)
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'

export type ReportAnnotationStatus = 'open' | 'resolved'

export interface ReportAnnotationReply {
  id: string
  annotationId: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

export interface ReportAnnotation {
  id: string
  reportId: string
  authorId: string
  authorName: string
  content: string
  quote: string | null
  status: ReportAnnotationStatus
  createdAt: string
  updatedAt: string
  editedAt: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolution: string | null
  replies: ReportAnnotationReply[]
}

export interface ReportAnnotationStats {
  reportId: string
  total: number
  open: number
  resolved: number
  byAuthor: Array<{ authorId: string; authorName: string; count: number; open: number }>
}

export interface CreateReportAnnotationDto {
  reportId: string
  content: string
  quote?: string
  authorName?: string
}

export interface UpdateReportAnnotationDto {
  content: string
}

export interface ReportAnnotationActor {
  id: string
  name: string
}

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()

const SEED_REPORT_IDS = ['RPT-000001', 'RPT-000002', 'RPT-000100', 'RPT-000101', 'RPT-20260122-00001']

const SEED_ANNOTATIONS: ReportAnnotation[] = [
  {
    id: 'RA-001',
    reportId: 'RPT-000001',
    authorId: 'D001',
    authorName: '张海涛',
    content: '右肺中叶结节建议补充测量值 (长径/短径) 与密度描述, 便于随访对比。',
    quote: '右肺中叶见约1.5cm结节影，边缘毛糙。',
    status: 'open',
    createdAt: iso(180),
    updatedAt: iso(180),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [
      {
        id: 'RAR-001',
        annotationId: 'RA-001',
        authorId: 'D002',
        authorName: '王秀峰',
        content: '已补充测量: 1.5×1.2cm, 密度欠均匀, 建议增强进一步评估。',
        createdAt: iso(150),
      },
    ],
  },
  {
    id: 'RA-002',
    reportId: 'RPT-000001',
    authorId: 'D003',
    authorName: '李建国',
    content: '临床病史与检查所见吻合, 建议补充既往手术史说明。',
    quote: '临床病史: 咳嗽咳痰 1 月余, 无发热。',
    status: 'resolved',
    createdAt: iso(60 * 26),
    updatedAt: iso(60 * 24),
    editedAt: null,
    resolvedAt: iso(60 * 24),
    resolvedBy: 'D001',
    resolution: '已补充既往史, 前后对比未见明显改变。',
    replies: [],
  },
  {
    id: 'RA-003',
    reportId: 'RPT-000002',
    authorId: 'D004',
    authorName: '陈海涛',
    content: '印象与诊断意见表述重复, 建议精简。',
    quote: '诊断意见: 左肺上叶磨玻璃结节, 建议随访。',
    status: 'open',
    createdAt: iso(90),
    updatedAt: iso(90),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [],
  },
  {
    id: 'RA-004',
    reportId: 'RPT-000100',
    authorId: 'D001',
    authorName: '张海涛',
    content: '危急值报告需在 30 分钟内电话确认并留档。',
    quote: '⚠ 危急值: 右侧基底节区急性脑梗死。',
    status: 'open',
    createdAt: iso(30),
    updatedAt: iso(30),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [
      {
        id: 'RAR-002',
        annotationId: 'RA-004',
        authorId: 'D002',
        authorName: '王秀峰',
        content: '已电话确认值班医师并记录, 电话录音已归档。',
        createdAt: iso(20),
      },
    ],
  },
  {
    id: 'RA-005',
    reportId: 'RPT-000101',
    authorId: 'D003',
    authorName: '李建国',
    content: '建议补充检查技术参数 (层厚/重建算法)。',
    quote: '',
    status: 'open',
    createdAt: iso(60 * 3),
    updatedAt: iso(60 * 3),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [],
  },
  {
    id: 'RA-101',
    reportId: 'RPT-20260122-00001',
    authorId: 'D001',
    authorName: '张海涛',
    content: '所见中建议补充结节密度 (实性/磨玻璃) 描述, 便于分级。',
    quote: '右肺中叶见约 8mm 磨玻璃结节影，边界欠清。',
    status: 'open',
    createdAt: iso(60 * 4),
    updatedAt: iso(60 * 4),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [],
  },
  {
    id: 'RA-102',
    reportId: 'RPT-20260122-00001',
    authorId: 'D002',
    authorName: '王秀峰',
    content: '临床病史信息不足, 建议补充吸烟史与既往胸部影像对比。',
    quote: '临床病史: 体检发现肺结节 1 周。',
    status: 'resolved',
    createdAt: iso(60 * 30),
    updatedAt: iso(60 * 20),
    editedAt: null,
    resolvedAt: iso(60 * 20),
    resolvedBy: 'D001',
    resolution: '已补充吸烟史 (30 年) 与 1 年前基线片对比。',
    replies: [],
  },
]

@Injectable()
export class ReportAnnotationService {
  private annotations: ReportAnnotation[] = SEED_ANNOTATIONS.map((a) => ({
    ...a,
    replies: a.replies.map((r) => ({ ...r })),
  }))

  // ================= 查询 =================

  list(reportId: string): ReportAnnotation[] {
    return this.annotations
      .filter((a) => a.reportId === reportId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  stats(reportId: string): ReportAnnotationStats {
    const items = this.annotations.filter((a) => a.reportId === reportId)
    const byAuthorMap = new Map<string, { authorId: string; authorName: string; count: number; open: number }>()
    for (const a of items) {
      const key = a.authorId || a.authorName
      const cur = byAuthorMap.get(key) ?? { authorId: a.authorId, authorName: a.authorName, count: 0, open: 0 }
      cur.count += 1
      if (a.status === 'open') cur.open += 1
      byAuthorMap.set(key, cur)
    }
    return {
      reportId,
      total: items.length,
      open: items.filter((a) => a.status === 'open').length,
      resolved: items.filter((a) => a.status === 'resolved').length,
      byAuthor: Array.from(byAuthorMap.values()).sort((a, b) => b.count - a.count),
    }
  }

  // ================= 创建 / 编辑 / 删除 =================

  create(dto: CreateReportAnnotationDto, actor: ReportAnnotationActor): ReportAnnotation {
    const reportId = String(dto.reportId ?? '').trim()
    const content = String(dto.content ?? '').trim()
    if (!reportId) throw new BadRequestException('reportId 必填')
    if (content.length < 2) throw new BadRequestException('content 至少 2 个字符')
    const now = new Date().toISOString()
    const item: ReportAnnotation = {
      id: `RA-${Date.now()}`,
      reportId,
      authorId: actor.id,
      authorName: (dto.authorName && String(dto.authorName).trim()) || actor.name || '当前用户',
      content,
      quote: dto.quote && String(dto.quote).trim() ? String(dto.quote).trim().slice(0, 500) : null,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
      replies: [],
    }
    this.annotations.unshift(item)
    return { ...item, replies: [] }
  }

  update(id: string, dto: UpdateReportAnnotationDto): ReportAnnotation {
    const hit = this.findOrThrow(id)
    const content = String(dto.content ?? '').trim()
    if (content.length < 2) throw new BadRequestException('content 至少 2 个字符')
    hit.content = content
    hit.editedAt = new Date().toISOString()
    hit.updatedAt = hit.editedAt
    return this.clone(hit)
  }

  remove(id: string): void {
    const idx = this.annotations.findIndex((a) => a.id === id)
    if (idx < 0) throw new NotFoundException(`ReportAnnotation ${id} not found`)
    this.annotations.splice(idx, 1)
  }

  // ================= 回复 (嵌套 1 层) =================

  reply(id: string, contentRaw: string, actor: ReportAnnotationActor): ReportAnnotation {
    const hit = this.findOrThrow(id)
    const content = String(contentRaw ?? '').trim()
    if (content.length < 2) throw new BadRequestException('content 至少 2 个字符')
    hit.replies.push({
      id: `RAR-${Date.now()}-${hit.replies.length}`,
      annotationId: id,
      authorId: actor.id,
      authorName: actor.name || '当前用户',
      content,
      createdAt: new Date().toISOString(),
    })
    hit.updatedAt = new Date().toISOString()
    return this.clone(hit)
  }

  // ================= 解决 / 重开 =================

  resolve(id: string, resolution: string | undefined, actor: ReportAnnotationActor): ReportAnnotation {
    const hit = this.findOrThrow(id)
    if (hit.status === 'resolved') return this.clone(hit)
    hit.status = 'resolved'
    hit.resolvedAt = new Date().toISOString()
    hit.resolvedBy = actor.name || actor.id || '当前用户'
    hit.resolution = resolution && String(resolution).trim() ? String(resolution).trim().slice(0, 500) : null
    hit.updatedAt = hit.resolvedAt
    return this.clone(hit)
  }

  reopen(id: string): ReportAnnotation {
    const hit = this.findOrThrow(id)
    if (hit.status === 'open') return this.clone(hit)
    hit.status = 'open'
    hit.resolvedAt = null
    hit.resolvedBy = null
    hit.resolution = null
    hit.updatedAt = new Date().toISOString()
    return this.clone(hit)
  }

  // ================= 内部 =================

  private findOrThrow(id: string): ReportAnnotation {
    const hit = this.annotations.find((a) => a.id === id)
    if (!hit) throw new NotFoundException(`ReportAnnotation ${id} not found`)
    return hit
  }

  private clone(a: ReportAnnotation): ReportAnnotation {
    return { ...a, replies: a.replies.map((r) => ({ ...r })) }
  }

  seedReportIds(): string[] {
    return [...SEED_REPORT_IDS]
  }
}

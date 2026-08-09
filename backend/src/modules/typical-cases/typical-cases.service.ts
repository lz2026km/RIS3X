// [G005 Wave1B P1] 典型病例库 (Typical Cases) — 孤儿模块
// 数据源: Exam/Report 派生 + 确定性 seed 回退 + 进程内存 CRUD
// 响应形状: { source: 'database'|'demo', generatedAt, data } (与 MSW typicalCaseHandlers 对齐)
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface TypicalCase {
  id: string
  patientName: string
  age: number
  gender: string
  examType: string
  examName: string
  bodyPart: string
  disease: string
  diagnosis: string
  findings: string
  impression: string
  findingsList: string[]
  tags: string[]
  teaching?: boolean
  images: { thumbnail: string; description: string }[]
  annotations: { id: string; x: number; y: number; type: string; label: string; description: string }[]
  discussions: { id: string; user: string; avatar: string; content: string; time: string; likes: number; liked: boolean }[]
  likeCount: number
  viewCount: number
  createdAt: string
  createdBy: string
  status: '已审核' | '待审核' | '编辑中'
  verified?: boolean
}

export interface TypicalCaseStats {
  total: number
  teaching: number
  pending: number
  views: number
  likes: number
  source: string
}

const DISEASE_HINTS: Array<[string, string]> = [
  ['肺结节', '肺结节'],
  ['肺炎', '肺炎'],
  ['脑梗死', '脑梗死'],
  ['骨折', '骨折'],
  ['肝占位', '肝占位'],
  ['椎间盘突出', '椎间盘突出'],
]

const SEED_CASES: TypicalCase[] = [
  { id: 'TC001', patientName: '张志刚', age: 62, gender: '男', examType: 'CT', examName: '冠脉CTA', bodyPart: '心脏', disease: '冠心病', diagnosis: '左主干开口狭窄约85%，前降支近段狭窄约90%', findings: '冠脉CTA扫描显示：左主干开口可见重度狭窄，约85%，可见混合斑块形成。前降支近段可见重度狭窄，约90%。', impression: '1. 左主干开口重度狭窄\n2. 前降支近段重度狭窄\n3. 建议行CAG+PCI治疗', findingsList: ['左主干开口狭窄约85%', '前降支近段狭窄约90%'], tags: ['冠心病', '冠脉狭窄', '教学病例'], teaching: true, images: [{ thumbnail: 'coronary', description: '冠脉CTA VR重建' }], annotations: [{ id: 'A1', x: 35, y: 45, type: 'stenosis', label: '左主干开口狭窄', description: '狭窄约85%，混合斑块' }], discussions: [{ id: 'D1', user: '李明辉', avatar: 'LMH', content: '非常典型的左主干加三支病变病例。', time: '2026-04-28 14:30', likes: 12, liked: false }], likeCount: 45, viewCount: 1230, createdAt: '2026-04-25', createdBy: '李明辉', status: '已审核', verified: true },
  { id: 'TC002', patientName: '李秀英', age: 55, gender: '女', examType: 'MR', examName: '头颅MR平扫', bodyPart: '头颅', disease: '脑转移瘤', diagnosis: '右侧额叶占位，考虑转移瘤', findings: '颅脑MR平扫：右侧额叶见约2.1×1.8cm异常信号，T1WI等低信号，T2WI高信号，周围大片水肿。增强扫描明显不均匀强化。', impression: '1. 右侧额叶占位，考虑转移瘤\n2. 建议进一步查找原发灶', findingsList: ['右侧额叶约2.1×1.8cm占位', '病灶周围大片水肿'], tags: ['脑肿瘤', '转移瘤', '教学病例'], teaching: true, images: [{ thumbnail: 'brain', description: 'T1WI增强扫描' }], annotations: [{ id: 'A1', x: 45, y: 35, type: 'mass', label: '额叶占位', description: '2.1×1.8cm，明显强化' }], discussions: [{ id: 'D1', user: '刘芳', avatar: 'LF', content: '环形强化+大片水肿是转移瘤的典型表现。', time: '2026-04-26 10:00', likes: 15, liked: true }], likeCount: 38, viewCount: 980, createdAt: '2026-04-26', createdBy: '刘芳', status: '已审核', verified: true },
  { id: 'TC003', patientName: '王建国', age: 58, gender: '男', examType: 'CT', examName: '胸部CT平扫', bodyPart: '胸部', disease: '肺癌', diagnosis: '右肺上叶周围型肺癌', findings: '胸部CT平扫：右肺上叶尖段见约3.5×2.8cm团块影，边缘毛刺状，可见分叶，密度不均匀。纵隔淋巴结肿大。', impression: '1. 右肺上叶周围型肺癌（建议穿刺活检）\n2. 纵隔淋巴结肿大', findingsList: ['右肺上叶团块影3.5×2.8cm', '边缘毛刺状'], tags: ['肺癌', '周围型肺癌', '教学病例'], teaching: true, images: [{ thumbnail: 'lung', description: '胸部CT肺窗' }], annotations: [{ id: 'A1', x: 40, y: 30, type: 'mass', label: '右上叶团块', description: '3.5×2.8cm，边缘毛刺' }], discussions: [{ id: 'D1', user: '王秀峰', avatar: 'WXF', content: '典型周围型肺癌表现。', time: '2026-04-27 09:00', likes: 20, liked: false }], likeCount: 52, viewCount: 1450, createdAt: '2026-04-27', createdBy: '王秀峰', status: '已审核', verified: true },
  { id: 'TC004', patientName: '赵晓敏', age: 45, gender: '女', examType: 'CT', examName: '头颅CT平扫', bodyPart: '头颅', disease: '硬膜下血肿', diagnosis: '左侧额颞顶部硬膜下血肿', findings: '颅脑CT平扫：左侧额颞顶部颅骨内板下方见新月形高密度影，厚度约8mm。中线结构右偏约5mm。', impression: '1. 左侧额颞顶部硬膜下血肿\n2. 中线结构右偏约5mm', findingsList: ['左侧额颞顶部新月形高密度影', '中线结构右偏约5mm'], tags: ['硬膜下血肿', '外伤', '急诊'], teaching: false, images: [{ thumbnail: 'brain', description: '颅脑CT平扫' }], annotations: [{ id: 'A1', x: 35, y: 40, type: 'hematoma', label: '硬膜下血肿', description: '左侧额颞顶部，厚度8mm' }], discussions: [], likeCount: 25, viewCount: 780, createdAt: '2026-04-27', createdBy: '张海涛', status: '已审核', verified: true },
  { id: 'TC005', patientName: '周玉芬', age: 52, gender: '女', examType: 'CT', examName: '腹部CT平扫+增强', bodyPart: '腹部', disease: '肝血管瘤', diagnosis: '肝右叶血管瘤', findings: '上腹部CT增强：肝右叶约4.5×3.8cm低密度影，动脉期边缘结节样强化，门脉期及延迟期对比剂逐渐向内填充。', impression: '1. 肝右叶血管瘤\n2. 符合良性病变影像学表现', findingsList: ['肝右叶约4.5×3.8cm低密度影', '"快进慢出"强化模式'], tags: ['肝血管瘤', '良性肿瘤', '鉴别诊断'], teaching: true, images: [{ thumbnail: 'liver', description: '动脉期' }], annotations: [{ id: 'A1', x: 50, y: 45, type: 'mass', label: '肝血管瘤', description: '4.5×3.8cm，边缘强化' }], discussions: [], likeCount: 33, viewCount: 890, createdAt: '2026-04-28', createdBy: '李明辉', status: '已审核', verified: true },
  { id: 'TC006', patientName: '孙伟', age: 35, gender: '男', examType: 'MR', examName: '腰椎MR平扫', bodyPart: '脊柱', disease: '腰椎间盘突出', diagnosis: 'L4/5椎间盘向左后突出', findings: '腰椎MR平扫：L4/5椎间盘向后突出约0.6cm，压迫硬膜囊前缘。', impression: '1. L4/5椎间盘突出（旁中型）\n2. L5/S1椎间盘未见异常', findingsList: ['L4/5椎间盘向后突出约0.6cm', '硬膜囊前缘受压'], tags: ['椎间盘突出', '腰椎', '退行性病变'], teaching: false, images: [{ thumbnail: 'spine', description: 'T2WI矢状位' }], annotations: [{ id: 'A1', x: 50, y: 50, type: 'herniation', label: 'L4/5突出', description: '向后突出0.6cm' }], discussions: [], likeCount: 28, viewCount: 650, createdAt: '2026-04-29', createdBy: '刘芳', status: '已审核', verified: true },
]

// 进程内存: 前端创建/编辑的病例
const memCases: TypicalCase[] = []

function deterministicHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function envelope<T>(source: 'database' | 'demo', data: T): { source: 'database' | 'demo'; generatedAt: string; data: T } {
  return { source, generatedAt: new Date().toISOString(), data }
}

@Injectable()
export class TypicalCasesService {
  private readonly logger = new Logger(TypicalCasesService.name)

  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: TypicalCase[] }> {
    const derived = await this.listFromDb()
    if (derived.length > 0) return envelope('database', [...memCases, ...derived])
    return envelope('demo', [...memCases, ...SEED_CASES])
  }

  async get(id: string): Promise<TypicalCase> {
    const all = (await this.list()).data
    const found = all.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`Typical case ${id} not found`)
    return found
  }

  create(dto: Partial<TypicalCase>): TypicalCase {
    const record: TypicalCase = {
      id: dto.id ?? `TC-${Date.now().toString(36)}`,
      patientName: dto.patientName ?? '新病例',
      age: dto.age ?? 0,
      gender: dto.gender ?? '男',
      examType: dto.examType ?? 'CT',
      examName: dto.examName ?? '',
      bodyPart: dto.bodyPart ?? '头颅',
      disease: dto.disease ?? '',
      diagnosis: dto.diagnosis ?? '',
      findings: dto.findings ?? '',
      impression: dto.impression ?? '',
      findingsList: dto.findingsList ?? [],
      tags: dto.tags ?? [],
      teaching: dto.teaching ?? false,
      images: dto.images ?? [],
      annotations: dto.annotations ?? [],
      discussions: dto.discussions ?? [],
      likeCount: dto.likeCount ?? 0,
      viewCount: dto.viewCount ?? 0,
      createdAt: dto.createdAt ?? new Date().toISOString().slice(0, 10),
      createdBy: dto.createdBy ?? '当前用户',
      status: (dto.status as TypicalCase['status']) ?? '待审核',
      verified: dto.verified ?? false,
    }
    memCases.unshift(record)
    return record
  }

  update(id: string, dto: Partial<TypicalCase>): TypicalCase {
    const existing = memCases.find((c) => c.id === id) ?? this.seedClone(id)
    if (!existing) throw new NotFoundException(`Typical case ${id} not found`)
    Object.assign(existing, dto)
    if (!memCases.includes(existing)) memCases.unshift(existing)
    return existing
  }

  delete(id: string): void {
    const idx = memCases.findIndex((c) => c.id === id)
    if (idx === -1 && !SEED_CASES.some((c) => c.id === id)) throw new NotFoundException(`Typical case ${id} not found`)
    if (idx !== -1) memCases.splice(idx, 1)
  }

  categories(): Array<{ name: string; count: number }> {
    const all = [...memCases, ...SEED_CASES]
    const byExam = new Map<string, number>()
    for (const c of all) byExam.set(c.examName || c.examType, (byExam.get(c.examName || c.examType) ?? 0) + 1)
    return Array.from(byExam.entries()).map(([name, count]) => ({ name, count }))
  }

  async stats(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: TypicalCaseStats }> {
    const all = (await this.list()).data
    const source: 'database' | 'demo' = all.some((c) => c.id.startsWith('tc-db-')) ? 'database' : 'demo'
    const stats: TypicalCaseStats = {
      total: all.length,
      teaching: all.filter((c) => c.teaching).length,
      pending: all.filter((c) => c.status === '待审核').length,
      views: all.reduce((s, c) => s + (c.viewCount ?? 0), 0),
      likes: all.reduce((s, c) => s + (c.likeCount ?? 0), 0),
      source,
    }
    return envelope(source, stats)
  }

  // Exam/Report 派生: 阳性报告 → 典型病例候选
  private async listFromDb(): Promise<TypicalCase[]> {
    try {
      const rows = await this.prisma.report.findMany({
        where: { findings: { not: '' } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          exam: { select: { modality: true, bodyPart: true } },
          patient: { select: { name: true, gender: true, birthDate: true } },
        },
      })
      if (rows.length === 0) return []
      return rows.map((r, i) => {
        const disease = DISEASE_HINTS.find(([d]) => r.diagnosis.includes(d) || r.impression.includes(d))?.[1] ?? (r.diagnosis.slice(0, 12) || '待定诊断')
        const hash = deterministicHash(r.id)
        return {
          id: `tc-db-${r.id.slice(-8)}`,
          patientName: r.patient?.name ?? '未知患者',
          age: 0,
          gender: r.patient?.gender === 'FEMALE' ? '女' : r.patient?.gender === 'MALE' ? '男' : '其他',
          examType: r.exam?.modality ?? 'CT',
          examName: `${r.exam?.modality ?? 'CT'} ${r.exam?.bodyPart ?? ''}`.trim(),
          bodyPart: r.exam?.bodyPart ?? '未指定',
          disease,
          diagnosis: r.diagnosis || r.impression.slice(0, 30),
          findings: r.findings,
          impression: r.impression,
          findingsList: r.findings.split(/[。；\n]/).filter(Boolean).slice(0, 4),
          tags: [r.exam?.modality ?? 'CT', disease, r.isCritical ? '危急值' : '常规'],
          teaching: r.isCritical || hash % 3 === 0,
          images: [],
          annotations: [],
          discussions: [],
          likeCount: hash % 60,
          viewCount: 200 + (hash % 900),
          createdAt: r.createdAt.toISOString().slice(0, 10),
          createdBy: '系统归档',
          status: '已审核',
          verified: true,
        }
      })
    } catch (err) {
      this.logger.warn(`[TypicalCases] DB query failed, fallback to seed: ${(err as Error).message}`)
      return []
    }
  }

  private seedClone(id: string): TypicalCase | undefined {
    const seed = SEED_CASES.find((c) => c.id === id)
    return seed ? { ...seed } : undefined
  }
}

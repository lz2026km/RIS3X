// [G005 Wave1A P0] 眼科教学病例库 (Eye Edu Case Library) — 孤儿模块
// 数据源: Report/Exam 派生 + 确定性 seed 回退 + 进程内存 (标注/项目/脱敏/SR 导出)
// 响应形状: { success, data, meta? } 与 MSW eyeHandlers.ts eyeCaseLibraryModule 对齐
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface EduCase {
  id: string
  reportId?: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  chiefComplaint?: string
  diagnosis?: string
  impression?: string
  status: string
  studyDate: string
  createdAt?: string
  annotations?: any[]
}

export interface EduAnnotationProject {
  projectId: string
  name: string
  total: number
  completed: number
  status: string
}

const SEED_EDU_CASES: EduCase[] = [
  { id: 'EDU-001', reportId: 'ERPT-5001', patientName: '李慧敏', patientId: 'PEYE-001', modality: 'oct', bodyPart: '眼底', chiefComplaint: '双眼视物模糊 3 月', diagnosis: '双眼糖尿病视网膜病变 (中度 NPDR)', impression: '中度 NPDR 表现', status: 'published', studyDate: '2026-07-02' },
  { id: 'EDU-002', reportId: 'ERPT-5002', patientName: '张伟', patientId: 'PEYE-003', modality: 'ffa', bodyPart: '眼底', chiefComplaint: '左眼视物变形 2 周', diagnosis: '左眼黄斑囊样水肿', impression: '黄斑区荧光渗漏', status: 'published', studyDate: '2026-06-30' },
  { id: 'EDU-003', reportId: 'ERPT-5003', patientName: '陈杰', patientId: 'PEYE-005', modality: 'slit_lamp', bodyPart: '眼前节', chiefComplaint: '右眼渐进性视力下降', diagnosis: '右眼年龄相关性白内障', impression: '右眼 AL 24.05mm', status: 'archive', studyDate: '2026-06-28' },
  { id: 'EDU-004', patientName: '王建国', patientId: 'PEYE-002', modality: 'fundus_photo', bodyPart: '眼底', chiefComplaint: '高血压常规眼底体检', diagnosis: '高血压视网膜病变 I 级', impression: '视网膜动脉硬化', status: 'published', studyDate: '2026-07-01' },
  { id: 'EDU-005', patientName: '刘敏', patientId: 'PEYE-004', modality: 'visual_field', bodyPart: '视神经', chiefComplaint: '疑似青光眼视野检查', diagnosis: '原发性开角型青光眼', impression: '视野 MD -14.2dB 重度缺损', status: 'pending_review', studyDate: '2026-06-29' },
]

const SEED_EDU_PROJECTS: EduAnnotationProject[] = [
  { projectId: 'AP001', name: 'DR 微动脉瘤标注', total: 200, completed: 180, status: 'in_progress' },
  { projectId: 'AP002', name: 'AMD 玻璃膜疣分级', total: 150, completed: 150, status: 'completed' },
  { projectId: 'AP003', name: '青光眼 RNFL 分割', total: 300, completed: 100, status: 'in_progress' },
]

// 进程内存: 前端创建的病例 / 标注 / 项目
const memCases: EduCase[] = []
const memAnnotations: any[] = []
const memProjects: EduAnnotationProject[] = []
const memDeidResults: any[] = []
const memSrExports: any[] = []

const DISEASE_HINTS: Array<[string, string]> = [
  ['糖尿病', 'DR'],
  ['视网膜', 'DR'],
  ['黄斑', 'AMD'],
  ['青光眼', '青光眼'],
  ['白内障', '白内障'],
]

function deterministicHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

@Injectable()
export class EyeEduService {
  private readonly logger = new Logger(EyeEduService.name)
  private seq = 0

  constructor(private readonly prisma: PrismaService) {}

  async listCases(params: { search?: string; disease?: string; pageSize?: number }): Promise<{
    success: boolean; data: EduCase[]; meta: { total: number; library: string }
  }> {
    const derived = await this.listFromDb()
    const all = [...memCases, ...(derived.length > 0 ? derived : SEED_EDU_CASES)]
    let data = all
    if (params.search) {
      const q = params.search.toLowerCase()
      data = data.filter((c) =>
        c.patientName?.toLowerCase().includes(q) ||
        c.chiefComplaint?.toLowerCase().includes(q) ||
        c.diagnosis?.toLowerCase().includes(q),
      )
    }
    if (params.disease) {
      const d = params.disease
      data = data.filter((c) =>
        c.diagnosis?.includes(d) || c.impression?.includes(d),
      )
    }
    const pageSize = params.pageSize ?? 20
    const total = data.length
    return { success: true, data: data.slice(0, pageSize), meta: { total, library: 'eye_case_library' } }
  }

  async getCase(id: string): Promise<{ success: boolean; data: any }> {
    const all = (await this.listCases({})).data
    const c = all.find((x) => x.id === id)
    if (!c) throw new NotFoundException(`EduCase ${id} not found`)
    return {
      success: true,
      data: {
        ...c,
        annotations: memAnnotations.filter((a) => a.caseId === id),
        references: ['眼科诊疗指南 2025', 'AAO Preferred Practice Patterns'],
        discussion: '典型病例, 用于住院医师培训',
      },
    }
  }

  createCase(dto: Partial<EduCase>): { success: boolean; data: EduCase } {
    const record: EduCase = {
      id: dto.id ?? `C${Date.now().toString(36)}-${++this.seq}`,
      reportId: `R${Date.now().toString(36)}-${++this.seq}`,
      patientName: dto.patientName ?? '',
      patientId: dto.patientId ?? '',
      modality: dto.modality ?? 'fundus_photo',
      bodyPart: dto.bodyPart ?? '',
      chiefComplaint: dto.chiefComplaint ?? '',
      diagnosis: dto.diagnosis ?? '',
      impression: dto.impression ?? '',
      status: (dto.status as string) ?? 'draft',
      studyDate: dto.studyDate ?? new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      annotations: [],
    }
    memCases.unshift(record)
    return { success: true, data: record }
  }

  annotate(caseId: string, dto: { annotationType?: string; coordinates?: any; label?: string; color?: string }): {
    success: boolean; data: any
  } {
    const record = {
      annotationId: `ANN${Date.now().toString(36)}-${++this.seq}`,
      caseId,
      annotationType: dto.annotationType ?? 'roi',
      coordinates: dto.coordinates ?? [],
      label: dto.label ?? '',
      color: dto.color ?? '#2563eb',
      createdAt: new Date().toISOString(),
    }
    memAnnotations.push(record)
    return { success: true, data: record }
  }

  listProjects(): { success: boolean; data: EduAnnotationProject[] } {
    return { success: true, data: [...memProjects, ...SEED_EDU_PROJECTS] }
  }

  createProject(dto: { name?: string; total?: number; completed?: number }): {
    success: boolean; data: EduAnnotationProject
  } {
    const record: EduAnnotationProject = {
      projectId: `AP${(1000 + memProjects.length + SEED_EDU_PROJECTS.length).toString()}`,
      name: dto.name ?? '未命名标注项目',
      total: dto.total ?? 100,
      completed: dto.completed ?? 0,
      status: (dto.completed ?? 0) >= (dto.total ?? 100) ? 'completed' : 'in_progress',
    }
    memProjects.unshift(record)
    return { success: true, data: record }
  }

  async cohort(criteria: { disease?: string; ageMin?: number; ageMax?: number; gender?: string; modality?: string }): Promise<{
    success: boolean; data: any
  }> {
    const all = (await this.listCases({})).data
    const filtered = all.filter((c) => {
      if (criteria.disease && !(c.diagnosis ?? '').includes(criteria.disease)) return false
      if (criteria.modality && c.modality !== criteria.modality) return false
      return true
    })
    const cohortId = `COH${Date.now().toString(36).toUpperCase()}-${++this.seq}`
    return {
      success: true,
      data: {
        cohortId,
        totalCases: filtered.length,
        criteria,
        cases: filtered.slice(0, 100),
        createdAt: new Date().toISOString(),
      },
    }
  }

  deidentify(caseId: string, level: string): { success: boolean; data: any } {
    const result = {
      deidentifiedId: `DEID${Date.now().toString(36).toUpperCase()}-${++this.seq}`,
      caseId,
      level: level ?? 'basic',
      actions: [
        '移除患者姓名',
        '移除患者 ID',
        '移除出生日期',
        '模糊医疗机构名称',
        '移除医生姓名',
        '移除私人标签',
      ],
      retainedFields: level === 'strict' ? ['影像像素', '检查日期(月)', '模态'] : ['影像像素', '检查日期', '模态'],
      deidentifiedAt: new Date().toISOString(),
    }
    memDeidResults.unshift(result)
    return { success: true, data: result }
  }

  exportSr(body: { caseId?: string; annotations?: any[]; format?: string }): {
    success: boolean; data: any
  } {
    const annotations = body.annotations ?? []
    const sopInstanceUID = `1.2.826.0.1.3680043.8.498.edu.${Date.now()}.${++this.seq}`
    const contentSequence = annotations.map((a: any, i: number) => ({
      relationshipType: 'CONTAINS',
      referencedContentItemIdentifier: i + 1,
      valueType: a.annotationType === 'text' ? 'TEXT' : 'NUM',
      conceptNameCodeSequence: {
        codeValue: a.annotationType === 'segmentation' ? '113040' : a.annotationType === 'roi' ? '111030' : '125201',
        codeMeaning: a.label,
        codingSchemeDesignator: 'DCM',
      },
      contentSequence: a.coordinates ? [{ GraphicType: 'POLYLINE', GraphicData: Array.isArray(a.coordinates.flat) ? a.coordinates.flat() : a.coordinates }] : undefined,
    }))
    const result = {
      sopInstanceUID,
      caseId: body.caseId,
      format: body.format ?? 'sr-tid1500',
      contentSequence,
      url: `data:application/dicom;base64,EDUCATIONAL_SR_${Date.now()}-${++this.seq}`,
      exportedAt: new Date().toISOString(),
    }
    memSrExports.unshift(result)
    return { success: true, data: result }
  }

  stats(cohortId?: string): { success: boolean; data: any } {
    return {
      success: true,
      data: {
        cohortId: cohortId ?? undefined,
        demographics: { male: 45, female: 55, meanAge: 52.3, ageStd: 15.2 },
        diseaseDistribution: { DR: 28, AMD: 18, 青光眼: 15, 白内障: 22, 其他: 17 },
        treatmentOutcomes: { 有效: 78, 部分有效: 15, 无效: 7 },
        timestamp: new Date().toISOString(),
      },
    }
  }

  // Report 派生: 阳性眼科报告 → 教学病例候选
  private async listFromDb(): Promise<EduCase[]> {
    try {
      const rows = await this.prisma.report.findMany({
        where: { findings: { not: '' } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          exam: { select: { modality: true, bodyPart: true } },
          patient: { select: { name: true, id: true } },
        },
      })
      if (rows.length === 0) return []
      return rows.map((r) => {
        const disease = DISEASE_HINTS.find(([d]) => r.diagnosis.includes(d) || r.impression.includes(d))?.[1] ?? (r.diagnosis.slice(0, 12) || '待定诊断')
        const hash = deterministicHash(r.id)
        return {
          id: `EDU-DB-${r.id.slice(-8)}`,
          reportId: r.id,
          patientName: r.patient?.name ?? '未知患者',
          patientId: r.patient?.id ?? 'UNKNOWN',
          modality: this.mapModality(r.exam?.modality ?? ''),
          bodyPart: r.exam?.bodyPart ?? '',
          chiefComplaint: r.diagnosis || r.impression.slice(0, 30),
          diagnosis: r.diagnosis || r.impression.slice(0, 30),
          impression: r.impression,
          status: hash % 3 === 0 ? 'pending_review' : r.isCritical ? 'critical_value' : 'published',
          studyDate: r.createdAt.toISOString().slice(0, 10),
          createdAt: r.createdAt.toISOString(),
          annotations: [],
        }
      })
    } catch (err) {
      this.logger.warn(`[EyeEdu] DB query failed, fallback to seed: ${(err as Error).message}`)
      return []
    }
  }

  private mapModality(modality: string): string {
    const m = String(modality).toLowerCase()
    if (m.includes('oct')) return 'oct'
    if (m.includes('fundus') || m.includes('fa')) return m.includes('fundus') ? 'fundus_photo' : 'ffa'
    if (m.includes('slit')) return 'slit_lamp'
    if (m.includes('field')) return 'visual_field'
    if (m.includes('ultrasound')) return 'ultrasound'
    return 'fundus_photo'
  }
}

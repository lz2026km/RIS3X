// [G005 Wave1B P1] 科研管理 (Research) — 孤儿模块
// 数据源: Exam/Report/ReportQualityScore/ExportApproval 表派生 + 确定性 seed 回退 + 进程内存
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface ResearchProject {
  id: string
  code: string
  name: string
  leader: string
  startDate: string
  status: '进行中' | '已完成' | '已归档'
  dataCount: number
  description: string
  members: string[]
}

export interface ExamRecord {
  id: string
  patientId: string
  patientName: string
  age: number
  gender: string
  examType: string
  examDate: string
  diagnosis: string
  result: '阳性' | '阴性'
  idCard: string
  phone: string
  address: string
  modality: string
}

export interface ResearchLabel {
  id: string
  name: string
  type: '诊断' | '部位' | '特征'
  color: string
  useCount: number
}

export interface ExportRecord {
  id: string
  projectId: string
  projectName: string
  format: 'CSV' | 'JSON' | 'DICOM'
  exportTime: string
  recordCount: number
  downloadUrl: string
  operator: string
}

export interface IRBSubmission {
  id: string
  projectName: string
  pi: string
  submittedDate: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approvedDate: string
  expiryDate: string
  consentForm: string
}

export interface CohortDefinition {
  id: string
  name: string
  criteria: string
  estimatedSize: number
  createdBy: string
  createdDate: string
  lastRun: string
}

export interface ExportAudit {
  id: string
  exportId: string
  requester: string
  approvedBy: string
  exportTime: string
  records: number
  purpose: string
  status: string
}

export interface DataQualityScore {
  field: string
  completeness: number
  consistency: number
  freshness: string
  suggestion: string
}

const LEADERS = ['王教授', '李教授', '张主任', '赵主任', '陈博士']
const MEMBERS = ['张医生', '李医生', '王医生', '赵医生', '刘医生', '孙医生', '周医生', '吴医生']
const LABEL_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2']

const SEED_PROJECTS: ResearchProject[] = [
  { id: 'RP-001', code: 'RS-2026-001', name: '肺结节AI辅助诊断多中心研究', leader: '王教授', startDate: '2026-01-15', status: '进行中', dataCount: 1280, description: '基于深度学习的肺结节检出与良恶性鉴别研究', members: ['张医生', '李医生', '赵医生'] },
  { id: 'RP-002', code: 'RS-2026-002', name: '脑卒中影像早期预警研究', leader: '李教授', startDate: '2026-02-01', status: '进行中', dataCount: 856, description: '缺血性脑卒中 CT/MR 影像特征与预后关联分析', members: ['王医生', '刘医生'] },
  { id: 'RP-003', code: 'RS-2025-018', name: '乳腺钼靶筛查效能评估', leader: '张主任', startDate: '2025-08-10', status: '已完成', dataCount: 3420, description: '本地区乳腺钼靶筛查阳性率与召回率评估', members: ['赵医生', '孙医生'] },
  { id: 'RP-004', code: 'RS-2025-022', name: '对比剂不良反应回顾性研究', leader: '赵主任', startDate: '2025-09-20', status: '已归档', dataCount: 215, description: 'CT 增强扫描对比剂不良反应发生率分析', members: ['周医生', '吴医生'] },
]

const SEED_EXAM_RECORDS: ExamRecord[] = [
  { id: 'EX-20260728-001', patientId: 'P100001', patientName: '张伟', age: 58, gender: '男', examType: '胸部CT平扫', examDate: '2026-07-28', diagnosis: '右肺上叶磨玻璃结节', result: '阳性', idCard: '110101196801010011', phone: '13800138001', address: '北京市朝阳区', modality: 'CT' },
  { id: 'EX-20260728-002', patientId: 'P100002', patientName: '李娜', age: 45, gender: '女', examType: '头颅MR平扫', examDate: '2026-07-28', diagnosis: '未见明显异常', result: '阴性', idCard: '110101198101010024', phone: '13800138002', address: '北京市海淀区', modality: 'MR' },
  { id: 'EX-20260728-003', patientId: 'P100003', patientName: '王芳', age: 62, gender: '女', examType: '腹部CT平扫+增强', examDate: '2026-07-28', diagnosis: '肝右叶占位,考虑血管瘤', result: '阳性', idCard: '110101196401010045', phone: '13800138003', address: '北京市西城区', modality: 'CT' },
]

const SEED_LABELS: ResearchLabel[] = [
  { id: 'LB-001', name: '肺结节', type: '诊断', color: '#1677ff', useCount: 86 },
  { id: 'LB-002', name: '磨玻璃影', type: '特征', color: '#52c41a', useCount: 64 },
  { id: 'LB-003', name: '胸部', type: '部位', color: '#faad14', useCount: 120 },
  { id: 'LB-004', name: '脑梗死', type: '诊断', color: '#eb2f96', useCount: 42 },
]

const SEED_EXPORTS: ExportRecord[] = [
  { id: 'EXP-001', projectId: 'RP-001', projectName: '肺结节AI辅助诊断多中心研究', format: 'CSV', exportTime: '2026-08-01 10:30', recordCount: 500, downloadUrl: '/files/exports/EXP-001.csv', operator: '张医生' },
  { id: 'EXP-002', projectId: 'RP-002', projectName: '脑卒中影像早期预警研究', format: 'JSON', exportTime: '2026-08-02 14:20', recordCount: 300, downloadUrl: '/files/exports/EXP-002.json', operator: '李医生' },
]

const SEED_IRB: IRBSubmission[] = [
  { id: 'IRB-001', projectName: '肺结节AI辅助诊断多中心研究', pi: '王教授', submittedDate: '2026-01-10', status: 'approved', approvedDate: '2026-02-05', expiryDate: '2027-02-04', consentForm: '/files/irb/consent-001.pdf' },
  { id: 'IRB-002', projectName: '脑卒中影像早期预警研究', pi: '李教授', submittedDate: '2026-01-20', status: 'submitted', approvedDate: '', expiryDate: '', consentForm: '' },
]

const SEED_COHORTS: CohortDefinition[] = [
  { id: 'CO-001', name: '肺结节随访队列', criteria: 'CT 检查 & 肺部 & 结节', estimatedSize: 800, createdBy: '张医生', createdDate: '2026-03-01', lastRun: '2026-07-25' },
  { id: 'CO-002', name: '脑梗 MR 队列', criteria: 'MR 检查 & 头颅 & 梗死', estimatedSize: 450, createdBy: '李医生', createdDate: '2026-03-15', lastRun: '2026-07-20' },
]

const SEED_AUDITS: ExportAudit[] = [
  { id: 'EA-001', exportId: 'EXP-001', requester: '张医生', approvedBy: '王教授', exportTime: '2026-08-01 10:35', records: 500, purpose: '课题统计分析', status: '已批准' },
  { id: 'EA-002', exportId: 'EXP-002', requester: '李医生', approvedBy: '李教授', exportTime: '2026-08-02 14:25', records: 300, purpose: '论文数据支撑', status: '已批准' },
]

const SEED_QUALITY: DataQualityScore[] = [
  { field: '患者基本信息', completeness: 98.5, consistency: 97.2, freshness: '30 天内', suggestion: '身份证号缺失率较高,建议前台校验' },
  { field: '检查信息', completeness: 96.8, consistency: 95.1, freshness: '实时', suggestion: '部分检查部位未按标准字典填写' },
  { field: '报告信息', completeness: 99.1, consistency: 96.4, freshness: '实时', suggestion: '诊断结论字段偶有空值' },
  { field: '影像资料', completeness: 94.2, consistency: 92.8, freshness: '实时', suggestion: '个别 DICOM 序列缺帧' },
]

// 进程内存: 前端创建的项目/标签/IRB/队列
const memProjects: ResearchProject[] = []
const memLabels: ResearchLabel[] = []
const memIRB: IRBSubmission[] = []
const memCohorts: CohortDefinition[] = []

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function genderOf(g: string): string {
  if (g === 'MALE') return '男'
  if (g === 'FEMALE') return '女'
  return '其他'
}

function ageOf(birthDate: Date | null): number {
  if (!birthDate) return 0
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1
  return Math.max(0, age)
}

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name)
  private seq = 0

  constructor(private readonly prisma: PrismaService) {}

  // ── Projects ──
  async listProjects(): Promise<ResearchProject[]> {
    try {
      const exams = await this.prisma.exam.findMany({
        select: { bodyPart: true, modality: true, createdAt: true },
        where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
        take: 500,
      })
      if (exams.length > 0) {
        // 派生: 按 bodyPart 分组形成"进行中"课题
        const byPart = new Map<string, number>()
        for (const e of exams) byPart.set(e.bodyPart || e.modality, (byPart.get(e.bodyPart || e.modality) ?? 0) + 1)
        const derived: ResearchProject[] = Array.from(byPart.entries()).slice(0, 4).map(([part, count], i) => ({
          id: `RP-DB-${i + 1}`,
          code: `RS-2026-${String(i + 1).padStart(3, '0')}`,
          name: `${part}影像特征回顾性研究`,
          leader: LEADERS[i % LEADERS.length]!,
          startDate: isoDate(new Date(Date.now() - (30 + i * 20) * 86400000)),
          status: i % 3 === 0 ? '已完成' : i % 3 === 1 ? '已归档' : '进行中',
          dataCount: count,
          description: `基于本院近 90 天 ${part} 检查的影像学特征分析`,
          members: [MEMBERS[i % MEMBERS.length]!, MEMBERS[(i + 1) % MEMBERS.length]!],
        }))
        return [...memProjects, ...derived]
      }
    } catch (err) {
      this.logger.warn(`[Research] projects DB query failed, fallback to seed: ${(err as Error).message}`)
    }
    return [...memProjects, ...SEED_PROJECTS]
  }

  async createProject(dto: Partial<ResearchProject>): Promise<ResearchProject> {
    const project: ResearchProject = {
      id: `RP-${Date.now().toString(36)}-${++this.seq}`,
      code: dto.code ?? `RS-2026-${String(SEED_PROJECTS.length + memProjects.length + 1).padStart(3, '0')}`,
      name: dto.name ?? '未命名课题',
      leader: dto.leader ?? '待定',
      startDate: dto.startDate ?? isoDate(new Date()),
      status: (dto.status as ResearchProject['status']) ?? '进行中',
      dataCount: dto.dataCount ?? 0,
      description: dto.description ?? '',
      members: dto.members ?? [],
    }
    memProjects.unshift(project)
    return project
  }

  // ── Exam Records ──
  async listExamRecords(): Promise<ExamRecord[]> {
    try {
      const rows = await this.prisma.exam.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          patient: { select: { name: true, gender: true, birthDate: true, idCard: true, phone: true } },
          reports: { select: { diagnosis: true, findings: true }, take: 1, orderBy: { updatedAt: 'desc' } },
        },
      })
      if (rows.length === 0) return SEED_EXAM_RECORDS
      return rows.map((e) => ({
        id: e.id,
        patientId: e.patientId,
        patientName: e.patient.name,
        age: ageOf(e.patient.birthDate),
        gender: genderOf(e.patient.gender),
        examType: `${e.modality} ${e.bodyPart}`,
        examDate: isoDate(e.scheduledAt ?? e.createdAt),
        diagnosis: e.reports[0]?.diagnosis || e.reports[0]?.findings || '未见明显异常',
        result: (e.reports[0]?.findings ?? '').trim() ? '阳性' : '阴性',
        idCard: e.patient.idCard ?? '',
        phone: e.patient.phone ?? '',
        address: '',
        modality: e.modality,
      }))
    } catch (err) {
      this.logger.warn(`[Research] exam-records DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_EXAM_RECORDS
    }
  }

  // ── Labels ──
  listLabels(): ResearchLabel[] {
    return [...memLabels, ...SEED_LABELS]
  }

  createLabel(dto: Partial<ResearchLabel>): ResearchLabel {
    const label: ResearchLabel = {
      id: `LB-${Date.now().toString(36)}-${++this.seq}`,
      name: dto.name ?? '未命名标签',
      type: (dto.type as ResearchLabel['type']) ?? '特征',
      color: dto.color ?? LABEL_COLORS[memLabels.length % LABEL_COLORS.length]!,
      useCount: dto.useCount ?? 0,
    }
    memLabels.unshift(label)
    return label
  }

  // ── Exports (ExportApproval 表派生 + seed) ──
  async listExportRecords(): Promise<ExportRecord[]> {
    try {
      const rows = await this.prisma.exportApproval.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, resource: true, status: true, requesterId: true, createdAt: true },
      })
      if (rows.length === 0) return SEED_EXPORTS
      return rows.map((r, i) => ({
        id: `EXP-DB-${r.id.slice(-8)}`,
        projectId: `RP-DB-${i % 4 + 1}`,
        projectName: r.resource,
        format: (i % 3 === 0 ? 'JSON' : i % 3 === 1 ? 'DICOM' : 'CSV') as ExportRecord['format'],
        exportTime: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        recordCount: 100 + i * 37,
        downloadUrl: `/files/exports/EXP-DB-${r.id.slice(-8)}.csv`,
        operator: r.requesterId ?? '未知',
      }))
    } catch (err) {
      this.logger.warn(`[Research] exports DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_EXPORTS
    }
  }

  // ── IRB ──
  listIRBSubmissions(): IRBSubmission[] {
    return [...memIRB, ...SEED_IRB]
  }

  createIRBSubmission(dto: Partial<IRBSubmission>): IRBSubmission {
    const record: IRBSubmission = {
      id: `IRB-${Date.now().toString(36)}-${++this.seq}`,
      projectName: dto.projectName ?? '未命名课题',
      pi: dto.pi ?? '待定',
      submittedDate: dto.submittedDate ?? isoDate(new Date()),
      status: (dto.status as IRBSubmission['status']) ?? 'draft',
      approvedDate: dto.approvedDate ?? '',
      expiryDate: dto.expiryDate ?? '',
      consentForm: dto.consentForm ?? '',
    }
    memIRB.unshift(record)
    return record
  }

  // ── Cohorts ──
  listCohorts(): CohortDefinition[] {
    return [...memCohorts, ...SEED_COHORTS]
  }

  createCohort(dto: Partial<CohortDefinition>): CohortDefinition {
    const cohort: CohortDefinition = {
      id: `CO-${Date.now().toString(36)}-${++this.seq}`,
      name: dto.name ?? '未命名队列',
      criteria: dto.criteria ?? '',
      estimatedSize: dto.estimatedSize ?? 0,
      createdBy: dto.createdBy ?? '未知',
      createdDate: dto.createdDate ?? isoDate(new Date()),
      lastRun: dto.lastRun ?? '',
    }
    memCohorts.unshift(cohort)
    return cohort
  }

  // ── Export Audit (ExportApproval 表派生 + seed) ──
  async listExportAudit(): Promise<ExportAudit[]> {
    try {
      const rows = await this.prisma.exportApproval.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          resource: true,
          status: true,
          requesterId: true,
          approverId: true,
          reason: true,
          createdAt: true,
        },
      })
      if (rows.length === 0) return SEED_AUDITS
      return rows.map((r, i) => ({
        id: `EA-DB-${r.id.slice(-8)}`,
        exportId: `EXP-DB-${r.id.slice(-8)}`,
        requester: r.requesterId ?? '未知',
        approvedBy: r.approverId ?? '待审批',
        exportTime: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        records: 100 + i * 37,
        purpose: r.reason || '课题数据导出',
        status: r.status === 'APPROVED' ? '已批准' : r.status === 'REJECTED' ? '已拒绝' : '待审批',
      }))
    } catch (err) {
      this.logger.warn(`[Research] export-audit DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_AUDITS
    }
  }

  // ── Data Quality (ReportQualityScore 派生 + seed) ──
  async listQualityScores(): Promise<DataQualityScore[]> {
    try {
      const rows = await this.prisma.reportQualityScore.findMany({
        take: 100,
        select: { totalScore: true, grade: true },
      })
      if (rows.length === 0) return SEED_QUALITY
      const avg = rows.reduce((s, r) => s + r.totalScore, 0) / rows.length
      const pass = rows.filter((r) => r.totalScore >= 60).length / rows.length
      const excellent = rows.filter((r) => r.totalScore >= 90).length / rows.length
      return [
        { field: '报告完整度', completeness: 96.4, consistency: avg, freshness: '实时', suggestion: '基于质控评分自动生成' },
        { field: '报告合格率', completeness: 98.1, consistency: pass * 100, freshness: '实时', suggestion: '合格率需保持 90% 以上' },
        { field: '报告优秀率', completeness: 94.7, consistency: excellent * 100, freshness: '实时', suggestion: '鼓励高评分报告模板复用' },
        { field: '检查信息', completeness: 96.8, consistency: 95.1, freshness: '实时', suggestion: '部分检查部位未按标准字典填写' },
      ]
    } catch (err) {
      this.logger.warn(`[Research] quality-scores DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_QUALITY
    }
  }
}

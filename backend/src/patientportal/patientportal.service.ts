import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export interface CreatePortalAppointmentDto {
  patientId: string
  modality: string
  bodyPart?: string
  scheduledAt: string | Date
  deviceId?: string
}

export interface CreatePortalFeedbackDto {
  patientId?: string
  patientName?: string
  rating: number
  category?: string
  comment?: string
}

export interface CreatePortalEducationDto {
  title: string
  category: 'pre_exam' | 'post_exam' | 'condition' | 'medication' | 'general'
  contentType: 'text' | 'video' | 'audio' | 'pdf' | 'image'
  content: string
  summary?: string
  modality?: string
  bodyPart?: string
  duration?: number
  tags?: string[]
  language?: 'zh-CN' | 'en'
}

// ===== 无数据 seed 演示 (数据库为空时返回, 保证患者门户可演示) =====
const SEED_APPOINTMENTS = [
  { id: 'AP-P001-001', patientId: 'P001', patientName: '张三', modality: 'CT', bodyPart: '胸部', scheduledAt: '2026-08-04T09:00:00+08:00', state: 'CONFIRMED' },
  { id: 'AP-P001-002', patientId: 'P001', patientName: '张三', modality: 'MR', bodyPart: '颅脑', scheduledAt: '2026-08-05T14:30:00+08:00', state: 'SCHEDULED' },
  { id: 'AP-P001-003', patientId: 'P001', patientName: '张三', modality: 'DR', bodyPart: '胸部', scheduledAt: '2026-08-06T10:00:00+08:00', state: 'SCHEDULED' },
  { id: 'AP-P002-001', patientId: 'P002', patientName: '李四', modality: 'DR', bodyPart: '腰椎', scheduledAt: '2026-08-04T10:30:00+08:00', state: 'CHECKED_IN' },
]

const SEED_REPORTS = [
  {
    id: 'RPT-P001-001', patientId: 'P001', patientName: '张三', modality: 'CT', bodyPart: '胸部',
    examDate: '2026-07-20T10:00:00+08:00', state: 'PUBLISHED', signedAt: '2026-07-20T15:32:00+08:00',
    findings: '双肺纹理清晰，未见明显实变影。纵隔结构居中，未见明显肿大淋巴结。',
    diagnosis: '双肺未见明显异常',
    impression: '胸部CT平扫未见明显异常。',
    recommendations: '建议定期体检随访。',
    conclusion: '未见明显异常',
    isCritical: false,
  },
  {
    id: 'RPT-P001-002', patientId: 'P001', patientName: '张三', modality: 'MR', bodyPart: '颅脑',
    examDate: '2026-06-15T09:30:00+08:00', state: 'PUBLISHED', signedAt: '2026-06-15T17:20:00+08:00',
    findings: '脑实质内未见明显异常信号灶，脑室系统形态正常，中线结构居中。',
    diagnosis: '头颅MR平扫未见明显异常',
    impression: '头颅MR平扫未见明显异常。',
    recommendations: '无明显异常，如症状持续建议神经内科门诊随访。',
    conclusion: '未见明显异常',
    isCritical: false,
  },
]

const SEED_STUDY = (studyUid: string) => ({
  studyInstanceUid: studyUid,
  studyDate: '2026-07-20T10:00:00+08:00',
  modality: 'CT',
  description: '胸部平扫',
  series: [
    {
      seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202607201000001',
      modality: 'CT',
      seriesNumber: 2,
      instanceCount: 120,
      wadoRs: {
        instances: `/api/dicom-web/studies/${studyUid}/series/1.2.826.0.1.3680043.8.498.202607201000001/instances`,
      },
    },
    {
      seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202607201000002',
      modality: 'CT',
      seriesNumber: 3,
      instanceCount: 1,
      wadoRs: {
        instances: `/api/dicom-web/studies/${studyUid}/series/1.2.826.0.1.3680043.8.498.202607201000002/instances`,
      },
    },
  ],
  wadoRs: { study: `/api/dicom-web/studies/${studyUid}` },
})

function mapAppointment(a: any) {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patient?.name,
    modality: a.modality,
    scheduledAt: a.scheduledAt,
    state: a.state,
    createdAt: a.createdAt,
  }
}

function mapReport(r: any) {
  return {
    id: r.id,
    patientId: r.patientId,
    examId: r.examId,
    state: r.state,
    modality: r.exam?.modality,
    bodyPart: r.exam?.bodyPart,
    examDate: r.exam?.completedAt ?? r.createdAt,
    signedAt: r.signedAt,
    findings: r.findings,
    diagnosis: r.diagnosis,
    impression: r.impression,
    recommendations: r.recommendations,
    conclusion: r.conclusion,
    isCritical: r.isCritical,
  }
}

// [G005 W1-C] 临床数据映射: 前端 PortalClinicalDataDto 契约
const REPORT_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: '已出报告',
  AMENDED: '已出报告',
  SIGNED: '已出报告',
  REVIEWED: '审核中',
  SUBMITTED: '审核中',
  INITIAL_REVIEW: '审核中',
  FINAL_REVIEW: '审核中',
  CO_SIGN_REVIEW: '审核中',
  WRITING: '书写中',
  ASSIGNED: '待书写',
  PENDING_ASSIGNMENT: '待分配',
}

function mapClinicalData(r: any) {
  return {
    id: r.id,
    patientId: r.patientId,
    patientName: r.patient?.name,
    examType: r.exam ? `${r.exam.modality}${r.exam.bodyPart ? `-${r.exam.bodyPart}` : ''}` : '影像检查',
    examDate: (r.exam?.completedAt ?? r.createdAt)?.toISOString?.()?.slice(0, 10) ?? null,
    bodyPart: r.exam?.bodyPart ?? null,
    modality: r.exam?.modality ?? null,
    findings: r.findings,
    diagnosis: r.diagnosis,
    reportStatus: REPORT_STATUS_LABEL[r.state] ?? r.state,
  }
}

const SEED_CLINICAL_DATA = [
  { id: 'CD001', patientId: 'P001', patientName: '张三', examType: '胸部CT平扫', examDate: '2026-07-20', bodyPart: '胸部', modality: 'CT', findings: '双肺纹理清晰，未见明显实变影。纵隔结构居中，未见明显肿大淋巴结。心影大小正常。', diagnosis: '双肺未见明显异常', reportStatus: '已出报告' },
  { id: 'CD002', patientId: 'P001', patientName: '张三', examType: '头颅MR平扫', examDate: '2026-06-15', bodyPart: '颅脑', modality: 'MR', findings: '脑实质内未见明显异常信号灶，脑室系统形态正常，中线结构居中。', diagnosis: '头颅MR平扫未见明显异常', reportStatus: '已出报告' },
  { id: 'CD003', patientId: 'P002', patientName: '李四', examType: '腰椎DR正侧位', examDate: '2026-07-08', bodyPart: '腰椎', modality: 'DR', findings: '腰椎生理曲度存在，各椎体形态规整，椎间隙未见明显变窄。', diagnosis: '腰椎DR未见明显异常', reportStatus: '已出报告' },
]

@Injectable()
export class PatientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async listPortalPatients() {
    const data = await this.prisma.patient.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getPortalPatient(id: string) {
    const data = await this.prisma.patient.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listClinicalData() {
    const data = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { patient: true, exam: true },
    })
    if (data.length === 0) return { data: SEED_CLINICAL_DATA }
    return { data: data.map(mapClinicalData) }
  }

  async getClinicalData(id: string) {
    const data = await this.prisma.report.findUnique({
      where: { id },
      include: { patient: true, exam: true },
    })
    if (!data) {
      const seed = SEED_CLINICAL_DATA.find(d => d.id === id)
      return { data: seed ? [seed] : [] }
    }
    return { data: [mapClinicalData(data)] }
  }

  async listEducation() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'education_' } } })
    return { data }
  }

  async getEducation(id: string) {
    const data = await this.prisma.systemConfig.findUnique({ where: { key: id } })
    return { data: data ? [data] : [] }
  }

  // [W5] 宣教资料写入: 落库 education_<key> SystemConfig 行 (与 listEducation 前缀读取对齐)
  async createEducation(dto: CreatePortalEducationDto) {
    const key = `education_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    const record = {
      id: key,
      title: dto.title,
      category: dto.category,
      contentType: dto.contentType,
      content: dto.content,
      summary: dto.summary ?? '',
      modality: dto.modality,
      bodyPart: dto.bodyPart,
      duration: dto.duration,
      tags: dto.tags ?? [],
      language: dto.language ?? 'zh-CN',
      createdAt: now,
      updatedAt: now,
    }
    await this.prisma.systemConfig.create({
      data: { key, value: record as any },
    })
    return { data: { key, ...record } }
  }

  async deleteEducation(key: string) {
    if (!key?.startsWith('education_')) {
      throw new NotFoundException(`Invalid education key: ${key}`)
    }
    const existing = await this.prisma.systemConfig.findUnique({ where: { key } })
    if (!existing) throw new NotFoundException(`Education ${key} not found`)
    await this.prisma.systemConfig.delete({ where: { key } })
    return { data: { deleted: true, key } }
  }

  async getPatientMobile() {
    const data = await this.prisma.patient.findMany({ take: 20, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getDoctorMobile() {
    const data = await this.prisma.user.findMany({ where: { role: 'DOCTOR' }, take: 20 })
    return { data }
  }

  async getNurseMobile() {
    const data = await this.prisma.user.findMany({ where: { role: 'NURSE' }, take: 20 })
    return { data }
  }

  async getTechMobile() {
    const data = await this.prisma.user.findMany({ where: { role: 'TECHNICIAN' }, take: 20 })
    return { data }
  }

  // ===== 患者门户 v3.1: 自助预约 / 报告 / 影像 / 反馈 =====

  async listAppointments(patientId?: string) {
    const tenantId = getCurrentTenantId()
    const where: any = { tenantId }
    if (patientId) where.patientId = patientId
    const items = await this.prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: 50,
      include: { patient: true },
    })
    if (items.length === 0) {
      const data = patientId
        ? SEED_APPOINTMENTS.filter(a => a.patientId === patientId)
        : SEED_APPOINTMENTS
      return { data }
    }
    return { data: items.map(mapAppointment) }
  }

  async createAppointment(dto: CreatePortalAppointmentDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } })
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`)
    const scheduledAt = new Date(dto.scheduledAt)
    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId: getCurrentTenantId(),
        patientId: dto.patientId,
        patientName: patient.name,
        modality: dto.modality,
        deviceId: dto.deviceId,
        scheduledAt,
        state: 'SCHEDULED',
      },
      include: { patient: true },
    })
    return { data: { ...mapAppointment(appointment), bodyPart: dto.bodyPart } }
  }

  async listReports(patientId?: string) {
    const tenantId = getCurrentTenantId()
    const where: any = { tenantId, state: { in: ['PUBLISHED', 'AMENDED'] } }
    if (patientId) where.patientId = patientId
    const items = await this.prisma.report.findMany({
      where,
      orderBy: { signedAt: 'desc' },
      take: 50,
      include: { exam: true },
    })
    if (items.length === 0) {
      const data = patientId
        ? SEED_REPORTS.filter(r => r.patientId === patientId)
        : SEED_REPORTS
      return { data }
    }
    return { data: items.map(mapReport) }
  }

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { exam: true },
    })
    if (!report) {
      const seed = SEED_REPORTS.find(r => r.id === id)
      return { data: seed ?? null }
    }
    return { data: mapReport(report) }
  }

  async listImages(studyUid: string) {
    let instances: any[] = []
    try {
      instances = await this.prisma.dicomInstance.findMany({
        where: { studyInstanceUid: studyUid, tenantId: getCurrentTenantId() },
        take: 500,
      })
    } catch {
      instances = []
    }
    if (instances.length === 0) return { data: SEED_STUDY(studyUid) }
    const groups = new Map<string, any[]>()
    for (const inst of instances) {
      const key = inst.seriesInstanceUid
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(inst)
    }
    const series = Array.from(groups.entries()).map(([seriesInstanceUid, list]) => ({
      seriesInstanceUid,
      modality: list[0]?.modality ?? 'OT',
      instanceCount: list.length,
      wadoRs: {
        instances: `/api/dicom-web/studies/${studyUid}/series/${seriesInstanceUid}/instances`,
        frames: `/api/dicom-web/studies/${studyUid}/series/${seriesInstanceUid}/frames`,
      },
    }))
    return {
      data: {
        studyInstanceUid: studyUid,
        modality: series[0]?.modality,
        series,
        wadoRs: { study: `/api/dicom-web/studies/${studyUid}` },
      },
    }
  }

  async createFeedback(dto: CreatePortalFeedbackDto) {
    const record = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      patientId: dto.patientId,
      patientName: dto.patientName,
      rating: dto.rating,
      category: dto.category ?? 'general',
      comment: dto.comment ?? '',
      createdAt: new Date().toISOString(),
    }
    await this.prisma.systemConfig.create({
      data: { key: record.id, value: record as any },
    })
    return { data: record }
  }
}

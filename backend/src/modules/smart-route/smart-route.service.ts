import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'

export interface RoutingRule {
  id: string
  name: string
  modality: string
  bodyPart: string
  patientStatus: string
  maxLoad: number
  priority: number
  enabled: boolean
}

export interface Assignment {
  id: string
  studyId: string
  patientName: string
  modality: string
  assignedTo: string
  ruleName: string
  assignedAt: string
  stage: 'qualification' | 'load-balance' | 'priority' | 'fallback'
  qualification?: string
  reason?: string
}

export interface DoctorQualification {
  doctorId: string
  name: string
  subspecialty: string
  modality: string[]
  bodyParts: string[]
  qualifications: string[]
  currentLoad: number
  maxLoad: number
  priority: number
}

const DEFAULT_RULES: RoutingRule[] = [
  { id: 'rr-001', name: 'CT Chest - Senior', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10, priority: 1, enabled: true },
  { id: 'rr-002', name: 'MR Brain - Specialist', modality: 'MR', bodyPart: 'Brain', patientStatus: 'Any', maxLoad: 8, priority: 2, enabled: true },
  { id: 'rr-003', name: 'DX Routine', modality: 'DX', bodyPart: 'Any', patientStatus: 'Outpatient', maxLoad: 20, priority: 3, enabled: true },
  { id: 'rr-004', name: 'CT Emergency', modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5, priority: 0, enabled: true },
]

const DEFAULT_HISTORY: Assignment[] = [
  { id: 'as-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', assignedTo: 'Dr. Wang', ruleName: 'CT Chest - Senior', assignedAt: '2026-07-10T08:30:00Z', stage: 'load-balance', qualification: '胸部影像', reason: '资质匹配→负载均衡' },
  { id: 'as-002', studyId: 'STU002', patientName: 'Li Si', modality: 'MR', assignedTo: 'Dr. Li', ruleName: 'MR Brain - Specialist', assignedAt: '2026-07-10T09:00:00Z', stage: 'qualification', qualification: '神经影像', reason: '资质匹配' },
]

// 医生亚专科资质表 (无 Prisma 模型,内存 seed)
const DEFAULT_QUALIFICATIONS: DoctorQualification[] = [
  { doctorId: 'doc-001', name: 'Dr. Wang', subspecialty: '胸部影像', modality: ['CT', 'DX'], bodyParts: ['Chest', '胸部'], qualifications: ['CT 高级资质', '胸部亚专科'], currentLoad: 3, maxLoad: 10, priority: 1 },
  { doctorId: 'doc-002', name: 'Dr. Li', subspecialty: '神经影像', modality: ['MR', 'CT'], bodyParts: ['Brain', '头部', '头颅'], qualifications: ['MR 神经专科', '造影资质'], currentLoad: 2, maxLoad: 8, priority: 2 },
  { doctorId: 'doc-003', name: 'Dr. Zhang', subspecialty: '急诊影像', modality: ['CT', 'DX'], bodyParts: ['Any'], qualifications: ['急诊资质', '危急值处理'], currentLoad: 5, maxLoad: 5, priority: 0 },
  { doctorId: 'doc-004', name: 'Dr. Liu', subspecialty: '腹部影像', modality: ['MR', 'CT', 'US'], bodyParts: ['Abdomen', '腹部'], qualifications: ['腹部亚专科'], currentLoad: 6, maxLoad: 12, priority: 3 },
  { doctorId: 'doc-005', name: 'Dr. Chen', subspecialty: '骨科影像', modality: ['DX', 'CT'], bodyParts: ['Any'], qualifications: ['骨科亚专科'], currentLoad: 4, maxLoad: 20, priority: 4 },
]

@Injectable()
export class SmartRouteService {
  private fallbackRules: RoutingRule[] = [...DEFAULT_RULES]
  private history: Assignment[] = [...DEFAULT_HISTORY]
  private qualifications: DoctorQualification[] = DEFAULT_QUALIFICATIONS.map(q => ({ ...q, modality: [...q.modality], bodyParts: [...q.bodyParts], qualifications: [...q.qualifications] }))

  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: { id: string; name: string; priority: number; condition: unknown; action: unknown; enabled: boolean; order: number }): RoutingRule {
    const condition = (row.condition ?? {}) as { modality?: string; bodyPart?: string; patientStatus?: string; maxLoad?: number }
    return {
      id: row.id,
      name: row.name,
      modality: condition.modality ?? 'Any',
      bodyPart: condition.bodyPart ?? 'Any',
      patientStatus: condition.patientStatus ?? 'Any',
      maxLoad: condition.maxLoad ?? 10,
      priority: row.priority,
      enabled: row.enabled,
    }
  }

  private conditionOf(r: RoutingRule): { modality: string; bodyPart: string; patientStatus: string; maxLoad: number } {
    return { modality: r.modality, bodyPart: r.bodyPart, patientStatus: r.patientStatus, maxLoad: r.maxLoad }
  }

  private async ensureSeeded(): Promise<void> {
    const count = await this.prisma.smartRouteRule.count()
    if (count > 0) return
    await this.prisma.smartRouteRule.createMany({
      data: DEFAULT_RULES.map((r, i) => ({
        id: r.id,
        name: r.name,
        priority: r.priority,
        condition: this.conditionOf(r),
        action: {},
        enabled: r.enabled,
        order: i,
      })),
      skipDuplicates: true,
    })
  }

  /**
   * 三级路由: 规则匹配 → 资质匹配 → 负载均衡/优先级
   * 1) 规则匹配: modality/bodyPart/patientStatus 命中 → 取 priority 最小规则
   * 2) 资质匹配: 亚专科资质表过滤出可接诊医生
   * 3) 负载均衡: 取 currentLoad < maxLoad 且负载最低者;全部满载时按医生 priority 兜底
   */
  async assign(studyId: string, patientName: string, modality: string, bodyPart: string, patientStatus: string): Promise<Assignment> {
    let rules: RoutingRule[]
    try {
      await this.ensureSeeded()
      const rows = await this.prisma.smartRouteRule.findMany({ orderBy: { order: 'asc' } })
      rules = rows.map(r => this.toDto(r))
    } catch {
      rules = this.fallbackRules
    }
    const matched = rules
      .filter(r => r.enabled && (r.modality === modality || r.modality === 'Any') && (r.bodyPart === bodyPart || r.bodyPart === 'Any') && (r.patientStatus === patientStatus || r.patientStatus === 'Any'))
      .sort((a, b) => a.priority - b.priority)
    const rule = matched[0] || rules[0]

    // 资质匹配: 优先 模态+部位 精确匹配, 其次仅模态匹配 (通用资质兜底)
    const byBodyPart = this.qualifications.filter(q =>
      q.modality.includes(modality) && (q.bodyParts.includes(bodyPart) || q.bodyParts.includes('Any')),
    )
    const byModalityOnly = this.qualifications.filter(q => q.modality.includes(modality) && !byBodyPart.includes(q))
    const qualified = byBodyPart.length > 0 ? byBodyPart : byModalityOnly
    const available = qualified.filter(q => q.currentLoad < q.maxLoad)
    const pool = available.length > 0 ? available : qualified
    let doctor: DoctorQualification | undefined
    let stage: Assignment['stage'] = 'fallback'
    let reason = '无匹配资质,按规则兜底分配'
    if (pool.length > 0) {
      const sorted = [...pool].sort((a, b) => a.currentLoad - b.currentLoad || a.priority - b.priority)
      doctor = sorted[0]
      doctor.currentLoad += 1
      if (available.length > 0) {
        stage = 'load-balance'
        reason = `资质匹配(${doctor.subspecialty})→负载均衡(${doctor.currentLoad - 1}/${doctor.maxLoad})`
      } else {
        stage = 'priority'
        reason = `资质匹配(${doctor.subspecialty})→满载,按优先级(${doctor.priority})`
      }
    }

    const assignment: Assignment = {
      id: `as-${uuid().slice(0, 6)}`, studyId, patientName, modality,
      assignedTo: doctor ? doctor.name : `Dr. ${['Wang', 'Li', 'Zhang', 'Liu', 'Chen'][Math.floor(Math.random() * 5)]}`,
      ruleName: rule.name, assignedAt: new Date().toISOString(),
      stage,
      qualification: doctor?.subspecialty,
      reason,
    }
    this.history.push(assignment)
    return assignment
  }

  /** 医生亚专科资质列表 (内存 seed) */
  getQualifications(): DoctorQualification[] {
    return this.qualifications.map(q => ({ ...q, modality: [...q.modality], bodyParts: [...q.bodyParts], qualifications: [...q.qualifications] }))
  }

  async getRules(): Promise<RoutingRule[]> {
    try {
      await this.ensureSeeded()
      const rows = await this.prisma.smartRouteRule.findMany({ orderBy: { order: 'asc' } })
      return rows.map(r => this.toDto(r))
    } catch {
      return this.fallbackRules.map(r => ({ ...r }))
    }
  }

  async updateRules(newRules: RoutingRule[]): Promise<RoutingRule[]> {
    try {
      await this.prisma.smartRouteRule.deleteMany({})
      await this.prisma.smartRouteRule.createMany({
        data: newRules.map((r, i) => ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          condition: this.conditionOf(r),
          action: {},
          enabled: r.enabled,
          order: i,
        })),
      })
      const rows = await this.prisma.smartRouteRule.findMany({ orderBy: { order: 'asc' } })
      return rows.map(r => this.toDto(r))
    } catch {
      this.fallbackRules = newRules.map(r => ({ ...r }))
      return this.fallbackRules.map(r => ({ ...r }))
    }
  }

  getHistory(): Assignment[] {
    return this.history
  }

  stats() {
    const total = this.history.length
    const byModality: Record<string, number> = {}
    const byDoctor: Record<string, number> = {}
    this.history.forEach(h => {
      byModality[h.modality] = (byModality[h.modality] || 0) + 1
      byDoctor[h.assignedTo] = (byDoctor[h.assignedTo] || 0) + 1
    })
    return { total, byModality, byDoctor }
  }
}

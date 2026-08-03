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
}

const DEFAULT_RULES: RoutingRule[] = [
  { id: 'rr-001', name: 'CT Chest - Senior', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10, priority: 1, enabled: true },
  { id: 'rr-002', name: 'MR Brain - Specialist', modality: 'MR', bodyPart: 'Brain', patientStatus: 'Any', maxLoad: 8, priority: 2, enabled: true },
  { id: 'rr-003', name: 'DX Routine', modality: 'DX', bodyPart: 'Any', patientStatus: 'Outpatient', maxLoad: 20, priority: 3, enabled: true },
  { id: 'rr-004', name: 'CT Emergency', modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5, priority: 0, enabled: true },
]

const DEFAULT_HISTORY: Assignment[] = [
  { id: 'as-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', assignedTo: 'Dr. Wang', ruleName: 'CT Chest - Senior', assignedAt: '2026-07-10T08:30:00Z' },
  { id: 'as-002', studyId: 'STU002', patientName: 'Li Si', modality: 'MR', assignedTo: 'Dr. Li', ruleName: 'MR Brain - Specialist', assignedAt: '2026-07-10T09:00:00Z' },
]

@Injectable()
export class SmartRouteService {
  private fallbackRules: RoutingRule[] = [...DEFAULT_RULES]
  private history: Assignment[] = [...DEFAULT_HISTORY]

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
    const assignment: Assignment = {
      id: `as-${uuid().slice(0, 6)}`, studyId, patientName, modality,
      assignedTo: `Dr. ${['Wang', 'Li', 'Zhang', 'Liu', 'Chen'][Math.floor(Math.random() * 5)]}`,
      ruleName: rule.name, assignedAt: new Date().toISOString(),
    }
    this.history.push(assignment)
    return assignment
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

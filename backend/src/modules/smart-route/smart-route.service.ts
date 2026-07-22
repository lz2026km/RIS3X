import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

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

@Injectable()
export class SmartRouteService {
  private rules: RoutingRule[] = [
    { id: 'rr-001', name: 'CT Chest - Senior', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10, priority: 1, enabled: true },
    { id: 'rr-002', name: 'MR Brain - Specialist', modality: 'MR', bodyPart: 'Brain', patientStatus: 'Any', maxLoad: 8, priority: 2, enabled: true },
    { id: 'rr-003', name: 'DX Routine', modality: 'DX', bodyPart: 'Any', patientStatus: 'Outpatient', maxLoad: 20, priority: 3, enabled: true },
    { id: 'rr-004', name: 'CT Emergency', modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5, priority: 0, enabled: true },
  ]

  private history: Assignment[] = [
    { id: 'as-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', assignedTo: 'Dr. Wang', ruleName: 'CT Chest - Senior', assignedAt: '2026-07-10T08:30:00Z' },
    { id: 'as-002', studyId: 'STU002', patientName: 'Li Si', modality: 'MR', assignedTo: 'Dr. Li', ruleName: 'MR Brain - Specialist', assignedAt: '2026-07-10T09:00:00Z' },
  ]

  assign(studyId: string, patientName: string, modality: string, bodyPart: string, patientStatus: string): Assignment {
    const matched = this.rules
      .filter(r => r.enabled && (r.modality === modality || r.modality === 'Any') && (r.bodyPart === bodyPart || r.bodyPart === 'Any') && (r.patientStatus === patientStatus || r.patientStatus === 'Any'))
      .sort((a, b) => a.priority - b.priority)
    const rule = matched[0] || this.rules[0]
    const assignment: Assignment = {
      id: `as-${uuid().slice(0, 6)}`, studyId, patientName, modality,
      assignedTo: `Dr. ${['Wang', 'Li', 'Zhang', 'Liu', 'Chen'][Math.floor(Math.random() * 5)]}`,
      ruleName: rule.name, assignedAt: new Date().toISOString(),
    }
    this.history.push(assignment)
    return assignment
  }

  getRules(): RoutingRule[] {
    return this.rules
  }

  updateRules(newRules: RoutingRule[]): RoutingRule[] {
    this.rules = newRules
    return this.rules
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

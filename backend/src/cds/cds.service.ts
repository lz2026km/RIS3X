import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface RuleEvaluateRequest {
  patientId?: string
  examType?: string
  modality?: string
  age?: number
  gender?: string
  clinicalInfo?: string
  priorFindings?: string
}

export interface RulePriorityRequest {
  ruleId: string
  priority: number
}

export interface RuleEvaluateResult {
  ruleId: string
  ruleName: string
  priority: number
  triggered: boolean
  severity: 'info' | 'warning' | 'critical'
  message: string
  suggestions: string[]
  source: string
}

@Injectable()
export class CdsService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateRule(req: RuleEvaluateRequest): Promise<{ cards: any[]; systemActions: any[] }> {
    const cards: any[] = []

    const contrastTriggered = req.examType?.includes('增强') ?? false
    if (contrastTriggered) {
      cards.push({
        uuid: 'contrast-001',
        summary: '造影剂适应症检查',
        indicator: 'warning',
        detail: '增强检查需确认肾功能正常',
        source: { label: 'ACR Manual on Contrast Media' },
        suggestions: [{
          label: '检查血清肌酐水平',
          actions: [{ type: 'create', description: 'Order serum creatinine lab', resource: { resourceType: 'ServiceRequest' } }],
        }, {
          label: '确认eGFR > 30 mL/min/1.73m²',
          actions: [{ type: 'create', description: 'Check eGFR before contrast' }],
        }],
      })
    }

    const doseTriggered = req.modality === 'CT' && (req.age ?? 0) < 18
    if (doseTriggered) {
      cards.push({
        uuid: 'dose-001',
        summary: '辐射剂量优化',
        indicator: 'warning',
        detail: '儿童CT检查建议使用低剂量协议',
        source: { label: 'Image Gently Campaign' },
        suggestions: [{
          label: '启用儿童低剂量协议',
          actions: [{ type: 'update', description: 'Switch to pediatric low-dose protocol' }],
        }, {
          label: '考虑MRI替代检查',
          actions: [{ type: 'create', description: 'Order MRI instead', resource: { resourceType: 'ServiceRequest' } }],
        }],
      })
    }

    cards.push({
      uuid: 'protocol-001',
      summary: '检查协议匹配',
      indicator: 'info',
      detail: `推荐检查方案: ${req.examType ?? '常规'}扫描`,
      source: { label: 'RSNA Radiology Protocols' },
      suggestions: [{
        label: '标准扫描序列',
        actions: [{ type: 'update', description: 'Apply standard scan protocol' }],
      }],
    })

    return { cards, systemActions: [] }
  }

  async updateRulePriority(req: RulePriorityRequest): Promise<{ success: boolean }> {
    return { success: true }
  }

  async listGuidelines() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_guideline_' } } })
    return { data }
  }

  async getGuideline(id: string) {
    const data = await this.prisma.systemConfig.findUnique({ where: { key: id } })
    return { data: data ? [data] : [] }
  }

  async createGuideline(body: Record<string, unknown>) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cds_guideline_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async listAlerts() {
    const data = await this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async acknowledgeAlert(body: Record<string, unknown>) {
    const { id, ...rest } = body
    const data = await this.prisma.notification.update({ where: { id }, data: { read: true, ...rest } })
    return { data: [data] }
  }

  async getDoseMonitoring() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'cds-dose' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getCdsStatistics() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: { startsWith: 'cds-' } }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async listCdsRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_rule_' } } })
    return { data }
  }

  async createCdsRule(body: Record<string, unknown>) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cds_rule_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async getCdsManagement() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_' } } })
    return { data }
  }
}

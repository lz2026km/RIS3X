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

  async evaluateRule(req: RuleEvaluateRequest): Promise<{ results: RuleEvaluateResult[] }> {
    const results: RuleEvaluateResult[] = [
      {
        ruleId: 'contrast-001',
        ruleName: '造影剂适应症检查',
        priority: 1,
        triggered: req.examType?.includes('增强') ?? false,
        severity: 'warning',
        message: req.examType?.includes('增强') ? '增强检查需确认肾功能正常' : '无需增强',
        suggestions: ['检查血清肌酐水平', '确认eGFR > 30 mL/min/1.73m²'],
        source: 'ACR Manual on Contrast Media',
      },
      {
        ruleId: 'dose-001',
        ruleName: '辐射剂量优化',
        priority: 2,
        triggered: req.modality === 'CT' && (req.age ?? 0) < 18,
        severity: 'warning',
        message: (req.age ?? 0) < 18 ? '儿童CT检查建议使用低剂量协议' : '剂量在正常范围',
        suggestions: ['启用儿童低剂量协议', '考虑MRI替代检查'],
        source: 'Image Gently Campaign',
      },
      {
        ruleId: 'protocol-001',
        ruleName: '检查协议匹配',
        priority: 3,
        triggered: true,
        severity: 'info',
        message: `推荐检查方案: ${req.examType ?? '常规'}扫描`,
        suggestions: ['标准扫描序列', '如需增强请添加对比剂'],
        source: 'RSNA Radiology Protocols',
      },
    ]
    return { results }
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

  async createGuideline(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cds_guideline_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async listAlerts() {
    const data = await this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async acknowledgeAlert(body: any) {
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

  async createCdsRule(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cds_rule_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async getCdsManagement() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_' } } })
    return { data }
  }
}

import type { QualityMetric, ContrastUsageReport, ComplianceReport, RegulatoryCheck } from './types'

export interface IQualityComplianceService {
  getQualityMetrics(startDate: string, endDate: string): Promise<QualityMetric[]>
  getContrastUsageReport(startDate: string, endDate: string): Promise<ContrastUsageReport>
  getAdverseEventRate(startDate: string, endDate: string): Promise<{ totalExams: number; adverseEvents: number; rate: number }>
  getProtocolAdherence(): Promise<{ totalExams: number; adhered: number; rate: number; details: { protocolId: string; protocolName: string; adhered: number; total: number }[] }>
  getRegulatoryCompliance(): Promise<RegulatoryCheck[]>
  generateComplianceReport(reportType: 'monthly' | 'quarterly' | 'annual'): Promise<ComplianceReport>
}

const MOCK_METRICS: QualityMetric[] = [
  { id: 'qm-001', name: '造影剂使用总量', category: 'usage', currentValue: 2850, targetValue: 3000, unit: 'mL', trend: 'up', periodStart: '2025-06-01', periodEnd: '2025-06-30', details: '本月碘海醇使用量占比65%' },
  { id: 'qm-002', name: '不良事件发生率', category: 'safety', currentValue: 1.2, targetValue: 2.0, unit: '%', trend: 'down', periodStart: '2025-06-01', periodEnd: '2025-06-30', details: '轻度1例，中度1例' },
  { id: 'qm-003', name: '方案依从率', category: 'adherence', currentValue: 94.5, targetValue: 95.0, unit: '%', trend: 'stable', periodStart: '2025-06-01', periodEnd: '2025-06-30', details: '85/90例使用标准方案' },
  { id: 'qm-004', name: '肾功能评估率', category: 'regulatory', currentValue: 97.8, targetValue: 100, unit: '%', trend: 'up', periodStart: '2025-06-01', periodEnd: '2025-06-30', details: '注射造影剂前eGFR评估率' },
  { id: 'qm-005', name: '知情同意签署率', category: 'regulatory', currentValue: 100, targetValue: 100, unit: '%', trend: 'stable', periodStart: '2025-06-01', periodEnd: '2025-06-30', details: '对比剂使用知情同意书签署率' },
  { id: 'qm-006', name: '不良事件上报率', category: 'safety', currentValue: 100, targetValue: 100, unit: '%', trend: 'stable', periodStart: '2025-06-01', periodEnd: '2025-06-30', details: '所有不良事件均已上报' },
]

const MOCK_REGULATORY_CHECKS: RegulatoryCheck[] = [
  { checkId: 'rc-001', name: '造影剂使用登记', regulation: '《药品管理法》', status: 'pass', details: '所有批次登记完整', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-002', name: '不良事件上报', regulation: '《医疗器械不良事件监测和再评价管理办法》', status: 'pass', details: '本月2例不良事件均已上报', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-003', name: '过期造影剂处理', regulation: '《医疗机构药事管理规定》', status: 'pass', details: '无过期造影剂', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-004', name: 'eGFR评估', regulation: '《对比剂使用指南》', status: 'pass', details: '97.8%患者注射前完成eGFR评估', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-005', name: '知情同意', regulation: '《医疗纠纷预防和处理条例》', status: 'pass', details: '知情同意签署率100%', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-006', name: '温湿度记录', regulation: '《药品经营质量管理规范》', status: 'fail', details: '6月15日造影剂储存冰箱温度超标（8.5°C）', checkedAt: '2025-06-30T00:00:00Z' },
]

class MockQualityComplianceService implements IQualityComplianceService {
  async getQualityMetrics(_startDate: string, _endDate: string): Promise<QualityMetric[]> {
    return MOCK_METRICS
  }

  async getContrastUsageReport(startDate: string, endDate: string): Promise<ContrastUsageReport> {
    return {
      totalContrastExams: 90, totalVolumeMl: 2850,
      byAgentType: { iodinated: { exams: 78, volumeMl: 2650 }, gadolinium: { exams: 12, volumeMl: 200 }, ultrasound: { exams: 0, volumeMl: 0 }, barium: { exams: 0, volumeMl: 0 }, other: { exams: 0, volumeMl: 0 } },
      byModality: { CT: { exams: 78, volumeMl: 2650 }, MR: { exams: 12, volumeMl: 200 } },
      averageVolumePerExam: 31.7, periodStart: startDate, periodEnd: endDate,
    }
  }

  async getAdverseEventRate(_startDate: string, _endDate: string): Promise<{ totalExams: number; adverseEvents: number; rate: number }> {
    return { totalExams: 90, adverseEvents: 2, rate: 2.2 }
  }

  async getProtocolAdherence(): Promise<{ totalExams: number; adhered: number; rate: number; details: { protocolId: string; protocolName: string; adhered: number; total: number }[] }> {
    return {
      totalExams: 90, adhered: 85, rate: 94.5,
      details: [
        { protocolId: 'ip-001', protocolName: '胸部CT增强标准方案', adhered: 42, total: 45 },
        { protocolId: 'ip-002', protocolName: '腹部CT增强双期方案', adhered: 30, total: 31 },
        { protocolId: 'ip-003', protocolName: 'MRI钆增强标准方案', adhered: 13, total: 14 },
      ],
    }
  }

  async getRegulatoryCompliance(): Promise<RegulatoryCheck[]> { return MOCK_REGULATORY_CHECKS }

  async generateComplianceReport(reportType: 'monthly' | 'quarterly' | 'annual'): Promise<ComplianceReport> {
    const now = new Date()
    return {
      id: `cr-${Date.now()}`, reportType, periodStart: '2025-06-01', periodEnd: '2025-06-30',
      generatedAt: now.toISOString(), generatedBy: 'system',
      metrics: MOCK_METRICS,
      usageReport: await this.getContrastUsageReport('2025-06-01', '2025-06-30'),
      adverseEventRate: 2.2, protocolAdherenceRate: 94.5,
      regulatoryChecks: MOCK_REGULATORY_CHECKS,
      summary: '本月造影剂使用管理整体良好。不良事件发生率1.2%低于目标2.0%。方案依从率94.5%接近目标95%。需关注：6月15日储存冰箱温度超标，已整改。',
    }
  }
}

let _instance: IQualityComplianceService | null = null

export function getQualityComplianceService(): IQualityComplianceService {
  if (!_instance) _instance = new MockQualityComplianceService()
  return _instance
}

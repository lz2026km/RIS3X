// [G005 W7] 演示数据补齐 handlers — 对比剂质量与合规 (/contrast/quality-compliance)
// 供 ContrastQualityCompliancePage 走真实 service 层 (contrastSafetyApi.getQualityCompliance),
// MSW 在 demo 模式下提供确定性演示数据 (source: 'demo')。
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

interface DemoMetric {
  id: string
  name: string
  category: 'usage' | 'safety' | 'adherence' | 'regulatory'
  currentValue: number
  targetValue: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  details: string
}

const DEMO_METRICS: DemoMetric[] = [
  { id: 'qm-001', name: '造影剂使用总量', category: 'usage', currentValue: 2850, targetValue: 3000, unit: 'mL', trend: 'up', details: '本月碘海醇使用量占比65%' },
  { id: 'qm-002', name: '不良事件发生率', category: 'safety', currentValue: 1.2, targetValue: 2.0, unit: '%', trend: 'down', details: '轻度1例，中度1例' },
  { id: 'qm-003', name: '方案依从率', category: 'adherence', currentValue: 94.5, targetValue: 95.0, unit: '%', trend: 'stable', details: '85/90例使用标准方案' },
  { id: 'qm-004', name: '肾功能评估率', category: 'regulatory', currentValue: 97.8, targetValue: 100, unit: '%', trend: 'up', details: '注射造影剂前eGFR评估率' },
  { id: 'qm-005', name: '知情同意签署率', category: 'regulatory', currentValue: 100, targetValue: 100, unit: '%', trend: 'stable', details: '对比剂使用知情同意书签署率' },
  { id: 'qm-006', name: '不良事件上报率', category: 'safety', currentValue: 100, targetValue: 100, unit: '%', trend: 'stable', details: '所有不良事件均已上报' },
]

const DEMO_CHECKS = [
  { checkId: 'rc-001', name: '造影剂使用登记', regulation: '《药品管理法》', status: 'pass', details: '所有批次登记完整', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-002', name: '不良事件上报', regulation: '《医疗器械不良事件监测和再评价管理办法》', status: 'pass', details: '本月2例不良事件均已上报', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-003', name: '过期造影剂处理', regulation: '《医疗机构药事管理规定》', status: 'pass', details: '无过期造影剂', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-004', name: 'eGFR评估', regulation: '《对比剂使用指南》', status: 'pass', details: '97.8%患者注射前完成eGFR评估', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-005', name: '知情同意', regulation: '《医疗纠纷预防和处理条例》', status: 'pass', details: '知情同意签署率100%', checkedAt: '2025-06-30T00:00:00Z' },
  { checkId: 'rc-006', name: '温湿度记录', regulation: '《药品经营质量管理规范》', status: 'fail', details: '6月15日造影剂储存冰箱温度超标（8.5°C）', checkedAt: '2025-06-30T00:00:00Z' },
]

export const w7MockHandlers = [
  http.get(`${API_BASE}/contrast/quality-compliance`, async ({ request }) => {
    await delay(60)
    const sp = new URL(request.url).searchParams
    const periodStart = sp.get('start') || '2025-06-01'
    const periodEnd = sp.get('end') || '2025-06-30'
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        periodStart,
        periodEnd,
        metrics: DEMO_METRICS.map((m) => ({ ...m, periodStart, periodEnd })),
        regulatoryChecks: DEMO_CHECKS,
      },
    })
  }),
]

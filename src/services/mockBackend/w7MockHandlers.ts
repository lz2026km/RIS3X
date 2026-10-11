// [G005 W7] 演示数据补齐 handlers — 对比剂质量与合规 (/contrast/quality-compliance)
// 供 ContrastQualityCompliancePage 走真实 service 层 (contrastSafetyApi.getQualityCompliance),
// MSW 在 demo 模式下提供确定性演示数据 (source: 'demo')。
// [G005] 对比剂使用记录 (/contrast/administrations): 50 条, 挂接 store 检查主脊
//   (patientId → PATIENT_MASTER, examId → store exams, deviceId → DEVICE_MASTER)。
import { http, HttpResponse, delay } from 'msw'
import { list } from './store'
import { CONTRAST_AGENTS } from '../../data/contrastProtocols'
import { DEVICES_BY_MODALITY, DEVICE_BY_ID, PATIENT_BY_ID } from '../../data/master'
import { resolvePatientId } from '../../data/master/idAlias'

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

// ==================== 对比剂使用记录 (store exams → 50 条) ====================
interface AdministrationExam {
  id?: string
  reportId?: string
  accessionNumber?: string
  patientId?: string
  patientName?: string
  modality?: string
  bodyPart?: string
  examItem?: string
  examItemName?: string
  examDate?: string
  examAt?: string
  deviceId?: string
  deviceName?: string
}

export interface ContrastAdministrationRecord {
  id: string
  examId: string
  accessionNumber?: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
  examItem: string
  agentId: string
  agentName: string
  genericName: string
  concentration: string
  volumeMl: number
  route: '静脉' | '动脉' | '口服'
  injectionRateMls: number
  adverseEvent: boolean
  adverseEventSeverity: '轻度' | '中度' | '重度' | null
  deviceId: string
  deviceName: string
  administeredAt: string
}

const ADMINISTRATION_TOTAL = 50
// 仅采用同步种子检查 id (排除异步懒加载 unified-exams), 保证抽样确定性
const STABLE_EXAM_ID = /^(RPT-\d{8}-\d{5}|RAD-EX\d{3,})$/
const IODINE_AGENTS = CONTRAST_AGENTS.filter((a) => a.type === '碘' && !/口服|硫酸钡/.test(a.name))
const ORAL_AGENTS = CONTRAST_AGENTS.filter((a) => /口服|硫酸钡/.test(a.name))
const GADOLINIUM_AGENTS = CONTRAST_AGENTS.filter((a) => a.type === '钆')
const ADVERSE_SEVERITIES: Array<ContrastAdministrationRecord['adverseEventSeverity']> = ['轻度', '中度', '重度']

let adminSeq = 0x5eed1234
const adminRng = () => {
  adminSeq = (adminSeq * 1103515245 + 12345) % 2147483648
  return adminSeq / 2147483648
}

const examKey = (e: AdministrationExam) => String(e.id ?? e.reportId ?? '')
const examDay = (e: AdministrationExam) => {
  const raw = e.examDate ?? e.examAt ?? ''
  return raw ? raw.slice(0, 10) : ''
}
const examLabel = (e: AdministrationExam) => String(e.examItemName ?? e.examItem ?? '')
const isEnhancedExam = (e: AdministrationExam) =>
  /增强|CTA|MRA|造影|栓塞|灌注|血管/.test(examLabel(e))

const adminDevice = (
  examModality: string,
  deviceId: string | undefined,
  index: number,
): { id: string; name: string } => {
  const master = deviceId ? DEVICE_BY_ID[deviceId] : undefined
  if (master) return { id: master.id, name: `${master.brand} ${master.model}` }
  const pool =
    examModality === 'MR'
      ? DEVICES_BY_MODALITY.MR
      : examModality === 'DSA'
        ? DEVICES_BY_MODALITY.DSA
        : DEVICES_BY_MODALITY.CT
  const fallback = pool[index % pool.length]
  return fallback
    ? { id: fallback.id, name: `${fallback.brand} ${fallback.model}` }
    : { id: '', name: '未知设备' }
}

let administrationCache: ContrastAdministrationRecord[] | null = null

const buildAdministrations = (): ContrastAdministrationRecord[] => {
  if (administrationCache) return administrationCache
  adminSeq = 0x5eed1234
  const exams = list<AdministrationExam>('exams').filter(
    (e) =>
      (e.modality === 'CT' || e.modality === 'MR' || e.modality === 'DSA') &&
      STABLE_EXAM_ID.test(examKey(e)) &&
      !!e.patientId &&
      !!examDay(e),
  )
  const cmp = (a: AdministrationExam, b: AdministrationExam) => {
    const da = examDay(a)
    const db = examDay(b)
    if (da !== db) return db.localeCompare(da)
    return examKey(a).localeCompare(examKey(b))
  }
  // 增强/造影类检查优先, 其余补齐; 日期降序 + 等距抽样保证确定性与时间跨度
  const ordered = [...exams.filter(isEnhancedExam).sort(cmp), ...exams.filter((e) => !isEnhancedExam(e)).sort(cmp)]
  const stride = Math.max(1, Math.floor(ordered.length / ADMINISTRATION_TOTAL))
  const picked: AdministrationExam[] = []
  for (let i = 0; picked.length < ADMINISTRATION_TOTAL && i < ordered.length; i += stride) {
    const item = ordered[i]
    if (item !== undefined && !picked.includes(item)) picked.push(item)
  }
  administrationCache = picked.map((e, i) => {
    const examModality = String(e.modality ?? 'CT')
    const examId = examKey(e)
    const patientId = resolvePatientId(String(e.patientId ?? ''))
    const patient = PATIENT_BY_ID[patientId]
    const label = examLabel(e)
    const isOral = /口服/.test(label)
    const route: ContrastAdministrationRecord['route'] = isOral
      ? '口服'
      : examModality === 'DSA'
        ? '动脉'
        : '静脉'
    const agentPool =
      route === '口服' ? ORAL_AGENTS : examModality === 'MR' ? GADOLINIUM_AGENTS : IODINE_AGENTS
    const agent = agentPool[Math.floor(adminRng() * agentPool.length)] ?? IODINE_AGENTS[0]!
    const volumeMl =
      examModality === 'MR'
        ? +(10 + adminRng() * 10).toFixed(1)
        : examModality === 'DSA'
          ? +(40 + adminRng() * 110).toFixed(1)
          : isOral
            ? +(250 + adminRng() * 250).toFixed(1)
            : +(60 + adminRng() * 40).toFixed(1)
    const injectionRateMls = isOral
      ? 0
      : +((examModality === 'MR' ? 1 + adminRng() : 2 + adminRng() * 1.5)).toFixed(1)
    const adverseEvent = adminRng() < 0.06
    const device = adminDevice(examModality, e.deviceId, i)
    const hour = 8 + Math.floor(adminRng() * 9)
    const minute = Math.floor(adminRng() * 60)
    return {
      id: `CADM-${String(i + 1).padStart(3, '0')}`,
      examId,
      accessionNumber: e.accessionNumber,
      patientId,
      patientName: patient?.name ?? e.patientName ?? patientId,
      modality: examModality,
      bodyPart: String(e.bodyPart ?? patient?.bodyPart ?? '未指定'),
      examItem: label || `${examModality} 检查`,
      agentId: agent.id,
      agentName: agent.name,
      genericName: agent.genericName,
      concentration: agent.concentration,
      volumeMl,
      route,
      injectionRateMls,
      adverseEvent,
      adverseEventSeverity: adverseEvent
        ? ADVERSE_SEVERITIES[Math.floor(adminRng() * ADVERSE_SEVERITIES.length)] ?? '轻度'
        : null,
      deviceId: device.id,
      deviceName: device.name,
      administeredAt: `${examDay(e)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    }
  })
  return administrationCache
}

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

  // [G005] 对比剂使用记录 50 条 (对照剂/体积/途径/流速/不良事件), 关联真实检查与患者
  http.get(`${API_BASE}/contrast/administrations`, async ({ request }) => {
    await delay(80)
    const sp = new URL(request.url).searchParams
    let items = buildAdministrations()
    const patientId = sp.get('patientId')
    const examId = sp.get('examId')
    const modality = sp.get('modality')
    const adverseEvent = sp.get('adverseEvent')
    if (patientId) items = items.filter((r) => r.patientId === patientId)
    if (examId) items = items.filter((r) => r.examId === examId)
    if (modality) items = items.filter((r) => r.modality === modality)
    if (adverseEvent === 'true') items = items.filter((r) => r.adverseEvent)
    if (adverseEvent === 'false') items = items.filter((r) => !r.adverseEvent)
    return HttpResponse.json({ success: true, data: { items, total: items.length, source: 'demo' } })
  }),
]

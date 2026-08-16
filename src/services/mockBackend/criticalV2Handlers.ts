// [G005 Wave 6C v3.0.6.11-101] /api/v1/critical-v2 MSW handlers
// 对齐后端 critical-v2.module + criticalV2Api (规则库 + 评估/判定 + 触发记录 + 通知闭环 + 统计)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/critical-v2`

type CriticalLevelV2 = 'critical' | 'urgent' | 'warning'
type CompareOpV2 = '>' | '>=' | '<' | '<=' | 'contains' | 'notContains'
type TriggerStatusV2 = 'triggered' | 'notified' | 'confirmed' | 'rejected' | 'resolved'
type NotifyChannelV2 = 'phone' | 'sms' | 'message'

interface RuleV2 {
  id: string
  code: string
  name: string
  category: string
  modality: string
  examType: string
  itemKey: string
  item: string
  operator: CompareOpV2
  threshold?: number
  thresholdText?: string
  unit?: string
  level: CriticalLevelV2
  description: string
  suggestion: string
  responseDeadlineMin: number
  enabled: boolean
  createdAt: string
}

interface TriggerV2 {
  id: string
  ruleId: string
  ruleCode: string
  ruleName: string
  level: CriticalLevelV2
  patientId?: string
  patientName: string
  examType?: string
  modality?: string
  matchedItem?: string
  matchedValue?: string
  matchedText: string
  description: string
  suggestion: string
  status: TriggerStatusV2
  notifiedAt?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmDecision?: 'accepted' | 'rejected'
  confirmComment?: string
  responseMinutes?: number
  createdAt: string
}

interface NotificationV2 {
  id: string
  triggerId: string
  channel: NotifyChannelV2
  recipientName: string
  recipientDept?: string
  recipientPhone?: string
  content: string
  status: 'sent' | 'failed' | 'accepted' | 'rejected'
  sentAt?: string
  confirmedAt?: string
  createdAt: string
}

const RULES: RuleV2[] = [
  {
    id: 'cv2-r-001', code: 'CR-001', name: '白细胞过低', category: '血常规', modality: 'CT', examType: 'CT 平扫',
    itemKey: 'wbc', item: '白细胞计数', operator: '<', threshold: 2.0, unit: '×10⁹/L', level: 'critical',
    description: 'WBC < 2.0×10⁹/L 提示严重骨髓抑制', suggestion: '立即复查并通知临床', responseDeadlineMin: 10, enabled: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'cv2-r-002', code: 'CR-002', name: '肌钙蛋白升高', category: '心肌标志物', modality: 'CT', examType: '冠脉 CTA',
    itemKey: 'troponin', item: '肌钙蛋白', operator: '>', threshold: 0.5, unit: 'ng/mL', level: 'critical',
    description: 'cTnI > 0.5 ng/mL 提示急性心肌损伤', suggestion: '心电图 + 心内科急会诊', responseDeadlineMin: 10, enabled: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'cv2-r-003', code: 'CR-003', name: '血钾过高', category: '电解质', modality: 'CT', examType: 'CT 平扫',
    itemKey: 'potassium', item: '血钾', operator: '>', threshold: 6.5, unit: 'mmol/L', level: 'critical',
    description: 'K+ > 6.5 mmol/L 有心脏骤停风险', suggestion: '急查心电图并紧急降钾', responseDeadlineMin: 5, enabled: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'cv2-r-004', code: 'CR-004', name: '空腹血糖过高', category: '生化', modality: 'CT', examType: 'CT 平扫',
    itemKey: 'glucose', item: '空腹血糖', operator: '>=', threshold: 16.7, unit: 'mmol/L', level: 'urgent',
    description: '血糖 ≥ 16.7 mmol/L 提示高渗状态', suggestion: '监测酮体并通知内分泌科', responseDeadlineMin: 15, enabled: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'cv2-r-005', code: 'CR-005', name: '血红蛋白过低', category: '血常规', modality: 'CT', examType: 'CT 平扫',
    itemKey: 'hemoglobin', item: '血红蛋白', operator: '<', threshold: 60, unit: 'g/L', level: 'critical',
    description: 'Hb < 60 g/L 重度贫血', suggestion: '紧急备血并通知临床', responseDeadlineMin: 10, enabled: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'cv2-r-006', code: 'CR-006', name: '报警提示词', category: '文本匹配', modality: 'MR', examType: 'MRI 平扫',
    itemKey: 'description', item: '检查描述', operator: 'contains', thresholdText: '脑出血', level: 'urgent',
    description: '描述包含"脑出血"关键词', suggestion: '复核影像并尽快出具报告', responseDeadlineMin: 15, enabled: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
]

const TRIGGERS: TriggerV2[] = [
  {
    id: 'cv2-t-001', ruleId: 'cv2-r-001', ruleCode: 'CR-001', ruleName: '白细胞过低', level: 'critical',
    patientId: 'P1001', patientName: '张建国', examType: 'CT 平扫', modality: 'CT',
    matchedItem: '白细胞计数', matchedValue: '1.2', matchedText: 'WBC 1.2×10⁹/L',
    description: 'WBC < 2.0×10⁹/L 提示严重骨髓抑制', suggestion: '立即复查并通知临床',
    status: 'confirmed', confirmedBy: 'u-021', confirmedAt: '2026-08-16T08:05:00.000Z', confirmDecision: 'accepted',
    responseMinutes: 5, createdAt: '2026-08-16T08:00:00.000Z', notifiedAt: '2026-08-16T08:00:30.000Z',
  },
  {
    id: 'cv2-t-002', ruleId: 'cv2-r-003', ruleCode: 'CR-003', ruleName: '血钾过高', level: 'critical',
    patientId: 'P1003', patientName: '王德发', examType: 'CT 平扫', modality: 'CT',
    matchedItem: '血钾', matchedValue: '6.8', matchedText: 'K+ 6.8 mmol/L',
    description: 'K+ > 6.5 mmol/L 有心脏骤停风险', suggestion: '急查心电图并紧急降钾',
    status: 'triggered', createdAt: '2026-08-16T08:20:00.000Z',
  },
  {
    id: 'cv2-t-003', ruleId: 'cv2-r-006', ruleCode: 'CR-006', ruleName: '报警提示词', level: 'urgent',
    patientId: 'P1002', patientName: '李秀英', examType: 'MRI 平扫', modality: 'MR',
    matchedItem: '检查描述', matchedValue: '脑出血', matchedText: '描述包含关键词: 脑出血',
    description: '描述包含"脑出血"关键词', suggestion: '复核影像并尽快出具报告',
    status: 'resolved', createdAt: '2026-08-15T10:00:00.000Z', notifiedAt: '2026-08-15T10:00:30.000Z',
  },
]

const NOTIFICATIONS: NotificationV2[] = [
  {
    id: 'cv2-n-001', triggerId: 'cv2-t-001', channel: 'phone',
    recipientName: '值班医生刘', recipientDept: '血液科', recipientPhone: '138****1234',
    content: '危急值: 张建国 WBC 1.2×10⁹/L (CR-001)', status: 'accepted',
    sentAt: '2026-08-16T08:00:30.000Z', confirmedAt: '2026-08-16T08:05:00.000Z', createdAt: '2026-08-16T08:00:00.000Z',
  },
  {
    id: 'cv2-n-002', triggerId: 'cv2-t-001', channel: 'message',
    recipientName: '值班医生刘', recipientDept: '血液科',
    content: '危急值: 张建国 WBC 1.2×10⁹/L (CR-001)', status: 'sent',
    sentAt: '2026-08-16T08:00:30.000Z', createdAt: '2026-08-16T08:00:00.000Z',
  },
]

let rules = [...RULES]
let triggers: TriggerV2[] = [...TRIGGERS]
let notifications: NotificationV2[] = [...NOTIFICATIONS]
let ruleSeq = 100
let triggerSeq = 100
let notifSeq = 100

function applyRule(rule: RuleV2, item: { key: string; name?: string; value: number | string; unit?: string }): boolean {
  const v = item.value
  if (rule.operator === 'contains' || rule.operator === 'notContains') {
    const has = String(v).includes(rule.thresholdText ?? '')
    return rule.operator === 'contains' ? has : !has
  }
  if (typeof v !== 'number') return false
  const t = rule.threshold ?? 0
  switch (rule.operator) {
    case '>': return v > t
    case '>=': return v >= t
    case '<': return v < t
    case '<=': return v <= t
    default: return false
  }
}

export const criticalV2Handlers = [
  http.get(`${API}/rules`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const modality = url.searchParams.get('modality')
    const keyword = url.searchParams.get('keyword')
    const enabled = url.searchParams.get('enabled')
    let items = rules
    if (category) items = items.filter((r) => r.category === category)
    if (modality) items = items.filter((r) => r.modality === modality)
    if (enabled !== null) items = items.filter((r) => r.enabled === (enabled === 'true'))
    if (keyword) items = items.filter((r) => r.name.includes(keyword) || r.code.includes(keyword))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/rules`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as Record<string, unknown>
    const rule: RuleV2 = {
      id: `cv2-r-${ruleSeq++}`,
      code: String(body.code ?? `CR-${ruleSeq}`),
      name: String(body.name ?? ''),
      category: String(body.category ?? '自定义'),
      modality: String(body.modality ?? 'CT'),
      examType: String(body.examType ?? ''),
      itemKey: String(body.itemKey ?? ''),
      item: String(body.item ?? ''),
      operator: (body.operator ?? '>') as CompareOpV2,
      threshold: body.threshold !== undefined ? Number(body.threshold) : undefined,
      thresholdText: body.thresholdText ? String(body.thresholdText) : undefined,
      unit: body.unit ? String(body.unit) : undefined,
      level: (body.level ?? 'warning') as CriticalLevelV2,
      description: String(body.description ?? ''),
      suggestion: String(body.suggestion ?? ''),
      responseDeadlineMin: Number(body.responseDeadlineMin ?? 15),
      enabled: body.enabled !== false,
      createdAt: new Date().toISOString(),
    }
    rules.unshift(rule)
    return HttpResponse.json({ success: true, data: rule })
  }),

  http.patch(`${API}/rules/:id`, async ({ params, request }) => {
    await delay(50)
    const patch = (await request.json()) as Record<string, unknown>
    const rule = rules.find((r) => r.id === params.id)
    if (!rule) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `rule ${params.id} not found` } }, { status: 404 })
    Object.assign(rule, patch)
    return HttpResponse.json({ success: true, data: rule })
  }),

  http.post(`${API}/evaluate`, async ({ request }) => {
    await delay(70)
    const input = (await request.json()) as { patientId?: string; patientName?: string; examType?: string; modality?: string; items?: Array<{ key: string; name?: string; value: number | string; unit?: string }>; description?: string }
    const items = (input?.items ?? []) as Array<{ key: string; name?: string; value: number | string; unit?: string }>
    const found: TriggerV2[] = []
    for (const rule of rules.filter((r) => r.enabled)) {
      let matched = false
      if (rule.itemKey === 'description') {
        matched = applyRule(rule, { key: 'description', value: input?.description ?? '' })
      } else {
        const item = items.find((it) => it.key === rule.itemKey || (rule.itemKey === 'all' && true))
        if (item) matched = applyRule(rule, item)
      }
      if (matched) {
        const item = items.find((it) => it.key === rule.itemKey)
        const now = new Date().toISOString()
        found.push({
          id: `cv2-t-${triggerSeq++}`,
          ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, level: rule.level,
          patientId: input?.patientId, patientName: input?.patientName ?? '演示患者',
          examType: input?.examType, modality: input?.modality,
          matchedItem: rule.itemKey === 'description' ? '检查描述' : rule.item,
          matchedValue: rule.itemKey === 'description' ? String(input?.description ?? '') : String(item?.value ?? ''),
          matchedText: rule.itemKey === 'description' ? `描述包含关键词: ${rule.thresholdText ?? ''}` : `${rule.item} ${rule.operator} ${rule.threshold}${rule.unit ?? ''} (实测 ${item?.value ?? '-'})`,
          description: rule.description, suggestion: rule.suggestion,
          status: 'triggered', createdAt: now,
        })
      }
    }
    return HttpResponse.json({ success: true, data: { evaluatedAt: new Date().toISOString(), triggers: found } })
  }),

  http.post(`${API}/judge`, async ({ request }) => {
    await delay(70)
    const input = (await request.json()) as { patientId?: string; patientName?: string; examType?: string; modality?: string; items?: Array<{ key: string; name?: string; value: number | string; unit?: string }>; description?: string; recipients?: Array<{ name: string; dept?: string; phone?: string; channels?: NotifyChannelV2[] }> }
    const items = (input?.items ?? []) as Array<{ key: string; name?: string; value: number | string; unit?: string }>
    const found: TriggerV2[] = []
    for (const rule of rules.filter((r) => r.enabled)) {
      let matched = false
      if (rule.itemKey === 'description') {
        matched = applyRule(rule, { key: 'description', value: input?.description ?? '' })
      } else {
        const item = items.find((it) => it.key === rule.itemKey)
        if (item) matched = applyRule(rule, item)
      }
      if (matched) {
        const item = items.find((it) => it.key === rule.itemKey)
        const now = new Date().toISOString()
        const trigger: TriggerV2 = {
          id: `cv2-t-${triggerSeq++}`,
          ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, level: rule.level,
          patientId: input?.patientId, patientName: input?.patientName ?? '演示患者',
          examType: input?.examType, modality: input?.modality,
          matchedItem: rule.itemKey === 'description' ? '检查描述' : rule.item,
          matchedValue: rule.itemKey === 'description' ? String(input?.description ?? '') : String(item?.value ?? ''),
          matchedText: rule.itemKey === 'description' ? `描述包含关键词: ${rule.thresholdText ?? ''}` : `${rule.item} ${rule.operator} ${rule.threshold}${rule.unit ?? ''} (实测 ${item?.value ?? '-'})`,
          description: rule.description, suggestion: rule.suggestion,
          status: 'triggered', createdAt: now,
        }
        found.push(trigger)
        const recipients = input?.recipients ?? [{ name: '值班医生', dept: '急诊科' }]
        for (const r of recipients.slice(0, 2)) {
          const channel: NotifyChannelV2 = (r.channels ?? ['phone'])[0] ?? 'phone'
          notifications.unshift({
            id: `cv2-n-${notifSeq++}`, triggerId: trigger.id, channel,
            recipientName: r.name, recipientDept: r.dept, recipientPhone: r.phone,
            content: `危急值: ${trigger.patientName} ${trigger.matchedText} (${rule.code})`,
            status: 'sent', sentAt: now, createdAt: now,
          })
        }
        triggers.unshift(trigger)
      }
    }
    return HttpResponse.json({ success: true, data: found })
  }),

  http.get(`${API}/triggers`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const level = url.searchParams.get('level')
    const patientName = url.searchParams.get('patientName')
    let items = triggers
    if (status) items = items.filter((t) => t.status === status)
    if (level) items = items.filter((t) => t.level === level)
    if (patientName) items = items.filter((t) => t.patientName.includes(patientName))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.get(`${API}/triggers/:id`, async ({ params }) => {
    await delay(40)
    const item = triggers.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `trigger ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/triggers/:id/notify`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { recipients?: Array<{ name: string; dept?: string; phone?: string; channels?: NotifyChannelV2[] }> }
    const trigger = triggers.find((t) => t.id === params.id)
    if (!trigger) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `trigger ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    trigger.status = 'notified'
    trigger.notifiedAt = now
    const recipients = body?.recipients ?? [{ name: '值班医生', dept: '急诊科' }]
    const sent: NotificationV2[] = []
    for (const r of recipients.slice(0, 2)) {
      const channel: NotifyChannelV2 = (r.channels ?? ['phone'])[0] ?? 'phone'
      const n: NotificationV2 = {
        id: `cv2-n-${notifSeq++}`, triggerId: trigger.id, channel,
        recipientName: r.name, recipientDept: r.dept, recipientPhone: r.phone,
        content: `危急值: ${trigger.patientName} ${trigger.matchedText} (${trigger.ruleCode})`,
        status: 'sent', sentAt: now, createdAt: now,
      }
      sent.push(n)
      notifications.unshift(n)
    }
    return HttpResponse.json({ success: true, data: sent })
  }),

  http.post(`${API}/triggers/:id/resolve`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { comment?: string }
    const trigger = triggers.find((t) => t.id === params.id)
    if (!trigger) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `trigger ${params.id} not found` } }, { status: 404 })
    trigger.status = 'resolved'
    trigger.confirmComment = String(body?.comment ?? '')
    trigger.responseMinutes = Math.round((Date.now() - new Date(trigger.createdAt).getTime()) / 60000)
    return HttpResponse.json({ success: true, data: trigger })
  }),

  http.get(`${API}/notifications`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const triggerId = url.searchParams.get('triggerId')
    const items = triggerId ? notifications.filter((n) => n.triggerId === triggerId) : notifications
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/notifications/:id/confirm`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { decision?: 'accepted' | 'rejected'; comment?: string; confirmedBy?: string }
    const n = notifications.find((x) => x.id === params.id)
    if (!n) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `notification ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    n.status = body?.decision === 'rejected' ? 'rejected' : 'accepted'
    n.confirmedAt = now
    const trigger = triggers.find((t) => t.id === n.triggerId)
    if (trigger) {
      trigger.status = body?.decision === 'rejected' ? 'rejected' : 'confirmed'
      trigger.confirmedBy = String(body?.confirmedBy ?? 'u-001')
      trigger.confirmedAt = now
      trigger.confirmDecision = body?.decision === 'rejected' ? 'rejected' : 'accepted'
      trigger.confirmComment = String(body?.comment ?? '')
      trigger.responseMinutes = Math.round((Date.now() - new Date(trigger.createdAt).getTime()) / 60000)
    }
    return HttpResponse.json({ success: true, data: { notification: n, trigger } })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const totalEvaluations = triggers.length + 12
    const totalTriggers = triggers.length
    const confirmed = triggers.filter((t) => t.status === 'confirmed' || t.status === 'resolved').length
    const rejected = triggers.filter((t) => t.status === 'rejected').length
    const byLevel = (['critical', 'urgent', 'warning'] as const).map((lv) => ({ level: lv, count: triggers.filter((t) => t.level === lv).length }))
    const topRulesMap = new Map<string, { ruleId: string; ruleCode: string; ruleName: string; count: number }>()
    for (const t of triggers) {
      const entry = topRulesMap.get(t.ruleId) ?? { ruleId: t.ruleId, ruleCode: t.ruleCode, ruleName: t.ruleName, count: 0 }
      entry.count += 1
      topRulesMap.set(t.ruleId, entry)
    }
    return HttpResponse.json({
      success: true,
      data: {
        totalEvaluations,
        totalTriggers,
        triggerRate: Math.round(totalTriggers / Math.max(1, totalEvaluations) * 1000) / 10,
        confirmedCount: confirmed,
        rejectedCount: rejected,
        onTimeConfirmRate: Math.round((confirmed / Math.max(1, totalTriggers)) * 1000) / 10,
        timeoutCount: 2,
        timeoutRate: Math.round(2 / Math.max(1, totalTriggers) * 1000) / 10,
        avgResponseMinutes: 8,
        byLevel,
        topRules: [...topRulesMap.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      },
    })
  }),
]

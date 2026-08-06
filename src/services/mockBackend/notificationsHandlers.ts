// [G005 W1-1] 通知中心 MSW handlers: /api/v1/notifications/*
// 与后端 backend/src/notifications 端点一致:
//   unread/:userId  history/:userId  stats/:userId  read/:id  read-all/:userId
//   DELETE :id  POST /  POST /broadcast  push-subscribe  push-unsubscribe
//   vapid-public-key  push-send (仅 ADMIN 前端控制)
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

interface MockNotification {
  id: string
  userId: string
  type: 'CRITICAL' | 'REPORT' | 'TASK' | 'SYSTEM' | 'APPOINTMENT'
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  title: string
  content: string
  link?: string
  read: boolean
  readAt?: string
  targetId?: string
  createdAt: string
}

const TEMPLATES: Array<Pick<MockNotification, 'type' | 'severity' | 'title' | 'content'>> = [
  { type: 'REPORT', severity: 'INFO', title: '报告已完成', content: '患者张志刚的冠脉CTA报告已完成，正在等待审核。' },
  { type: 'REPORT', severity: 'INFO', title: '报告已发布', content: '患者李秀英的头颅MR平扫报告已审核通过并发布。' },
  { type: 'CRITICAL', severity: 'CRITICAL', title: '危急值通知', content: '患者赵晓敏的头颅CT平扫发现硬膜下血肿，中线右偏约8mm，请立即处理！' },
  { type: 'CRITICAL', severity: 'WARN', title: '危急值已接收', content: '患者周玉芬的腹部CT增强发现肝右叶占位，疑似恶性肿瘤，临床已接收危急值通知。' },
  { type: 'SYSTEM', severity: 'INFO', title: '系统更新提示', content: 'RIS系统将于今晚22:00-23:00进行例行维护，届时部分功能可能暂时无法使用。' },
  { type: 'SYSTEM', severity: 'INFO', title: '数据备份完成', content: '系统已完成今日数据备份，备份文件已同步至灾备中心。' },
  { type: 'APPOINTMENT', severity: 'INFO', title: '预约提醒', content: '患者吴婷的乳腺钼靶检查将于明日上午10:00开始，请提前做好准备。' },
  { type: 'APPOINTMENT', severity: 'WARN', title: '预约变更', content: '患者郑丽的胸部CT平扫预约时间已从14:00调整至15:00。' },
  { type: 'TASK', severity: 'INFO', title: '会诊请求', content: '神经内科提交了一例疑难病例会诊请求，请尽快查看并回复。' },
  { type: 'TASK', severity: 'INFO', title: '会诊已回复', content: '您申请的MDT会诊已有心内科回复，建议行CAG+PCI治疗。' },
]

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

function buildSeed(): MockNotification[] {
  const seed: MockNotification[] = []
  for (let i = 0; i < 24; i++) {
    const tpl = TEMPLATES[i % TEMPLATES.length]!
    const isRead = i % 4 !== 0
    seed.push({
      id: `notif-${String(i + 1).padStart(3, '0')}`,
      userId: 'current',
      ...tpl,
      read: isRead,
      readAt: isRead ? isoAgo(i * 5 - 1) : undefined,
      targetId: `REL-${String(1000 + i)}`,
      createdAt: isoAgo(i * 5),
    })
  }
  return seed
}

const state: { items: MockNotification[] } = { items: buildSeed() }

function toDto(n: MockNotification) {
  return { ...n }
}

export const notificationsHandlers = [
  http.get(`${API_BASE}/notifications/unread/:userId`, async ({ params }) => {
    await delay(60)
    const userId = params.userId as string
    const unread = state.items.filter((n) => (userId === 'current' ? n.userId === 'current' : true) && !n.read).length
    return HttpResponse.json({ userId, unread })
  }),

  http.get(`${API_BASE}/notifications/history/:userId`, async ({ request, params }) => {
    await delay(100)
    const userId = params.userId as string
    const url = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 500)
    const items = state.items
      .filter((n) => (userId === 'current' ? true : n.userId === userId))
      .slice(0, limit)
    return HttpResponse.json(items.map(toDto))
  }),

  http.get(`${API_BASE}/notifications/stats/:userId`, async ({ params }) => {
    await delay(60)
    const userId = params.userId as string
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const items = state.items
    return HttpResponse.json({
      userId,
      total: items.length,
      unread: items.filter((n) => !n.read).length,
      today: items.filter((n) => new Date(n.createdAt) >= dayStart).length,
      critical: items.filter((n) => n.severity === 'CRITICAL' && !n.read).length,
    })
  }),

  http.post(`${API_BASE}/notifications/read/:id`, async ({ params }) => {
    await delay(60)
    const id = params.id as string
    const item = state.items.find((n) => n.id === id)
    if (!item) return HttpResponse.json(null)
    item.read = true
    item.readAt = new Date().toISOString()
    return HttpResponse.json(toDto(item))
  }),

  http.post(`${API_BASE}/notifications/read-all/:userId`, async ({ params }) => {
    await delay(80)
    const userId = params.userId as string
    const now = new Date().toISOString()
    const targets = state.items.filter((n) => (userId === 'current' ? true : n.userId === userId) && !n.read)
    for (const n of targets) {
      n.read = true
      n.readAt = now
    }
    return HttpResponse.json({ userId, count: targets.length })
  }),

  http.delete(`${API_BASE}/notifications/:id`, async ({ params }) => {
    await delay(60)
    const id = params.id as string
    const before = state.items.length
    state.items = state.items.filter((n) => n.id !== id)
    return HttpResponse.json({ id, deleted: state.items.length < before })
  }),

  http.post(`${API_BASE}/notifications`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as Record<string, unknown>
    const item: MockNotification = {
      id: `notif-${Date.now()}`,
      userId: String(body.userId ?? 'current'),
      type: (body.type as MockNotification['type']) ?? 'SYSTEM',
      severity: (body.severity as MockNotification['severity']) ?? 'INFO',
      title: String(body.title ?? '通知'),
      content: String(body.content ?? ''),
      link: body.link ? String(body.link) : undefined,
      targetId: body.targetId ? String(body.targetId) : undefined,
      read: false,
      createdAt: new Date().toISOString(),
    }
    state.items.unshift(item)
    return HttpResponse.json(toDto(item), { status: 201 })
  }),

  http.post(`${API_BASE}/notifications/broadcast`, async ({ request }) => {
    await delay(120)
    const body = (await request.json()) as Record<string, unknown>
    const userIds = (body.userIds as string[]) ?? []
    const items = userIds.map((userId) => {
      const item: MockNotification = {
        id: `notif-${Date.now()}-${userId}`,
        userId,
        type: (body.type as MockNotification['type']) ?? 'SYSTEM',
        severity: (body.severity as MockNotification['severity']) ?? 'INFO',
        title: String(body.title ?? '广播通知'),
        content: String(body.content ?? ''),
        link: body.link ? String(body.link) : undefined,
        targetId: body.targetId ? String(body.targetId) : undefined,
        read: false,
        createdAt: new Date().toISOString(),
      }
      state.items.unshift(item)
      return item
    })
    return HttpResponse.json({ count: items.length, items: items.map(toDto) }, { status: 201 })
  }),

  http.get(`${API_BASE}/notifications/vapid-public-key`, async () => {
    await delay(50)
    return HttpResponse.json({
      publicKey: 'BK-yELa-ndXqb0Qr5gdFEnEtYjaPWadKr25P1ApwdgNcbgtPIAaWdTwdwyy1eyP8ntlQSWM-XH5GK2Lk6S1hb88',
    })
  }),

  http.post(`${API_BASE}/notifications/push-subscribe`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { userId?: string; endpoint?: string }
    return HttpResponse.json({
      success: true,
      userId: body.userId ?? 'current',
      endpoint: body.endpoint ?? 'mock-endpoint',
      total: 1,
    }, { status: 201 })
  }),

  http.post(`${API_BASE}/notifications/push-unsubscribe`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { endpoint?: string }
    return HttpResponse.json({ success: true, endpoint: body.endpoint ?? 'mock-endpoint', total: 0 })
  }),

  http.post(`${API_BASE}/notifications/push-send`, async ({ request }) => {
    await delay(120)
    const body = (await request.json()) as { userId?: string; title?: string; content?: string }
    return HttpResponse.json({
      success: true,
      userId: body.userId ?? 'current',
      delivered: 1,
      total: 1,
    })
  }),
]

/**
 * G005 RIS - 移动审批 Mock 端点 (v3.0.6.11-100 Wave 4A)
 *  - GET  /mobile-approval/pending  待审批列表 (逾期优先)
 *  - POST /mobile-approval/:id/approve | reject | delegate
 *  - GET  /mobile-approval/history   已审批历史
 *  - GET  /mobile-approval/stats     待审/已审/委派中/逾期
 */
import { http, HttpResponse, delay } from 'msw'
import { API_BASE } from '../api/client'

type MobileApprovalType = '报告签发' | '报告发布' | '危急值处置' | '费用审批' | '请假审批'
type MobileApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated'

interface MobileApprovalItem {
  id: string
  type: MobileApprovalType
  title: string
  applicant: string
  submittedAt: string
  dueAt: string
  status: MobileApprovalStatus
  assignee: string
  detail: Record<string, unknown>
  comment?: string
  reason?: string
  delegatedTo?: string
  processedAt?: string | null
  processedBy?: string | null
}

function isoAgo(days: number, hours = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(d.getHours() - hours)
  return d.toISOString()
}

function isoAhead(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

let items: MobileApprovalItem[] = [
  {
    id: 'ma-001', type: '报告签发', title: 'CT 胸部平扫报告签发 · 患者王秀兰',
    applicant: '李医生 (D1001)', submittedAt: isoAgo(0, 5), dueAt: isoAhead(1), status: 'pending', assignee: '质控组',
    detail: { patient: '王秀兰', examNo: 'EX202608150012', reportId: 'rpt-038', modality: 'CT', finding: '右肺上叶磨玻璃影' },
  },
  {
    id: 'ma-002', type: '报告发布', title: 'MRI 头颅平扫报告发布 · 患者张建国',
    applicant: '王医生 (D1002)', submittedAt: isoAgo(0, 8), dueAt: isoAhead(2), status: 'pending', assignee: '报告组',
    detail: { patient: '张建国', examNo: 'EX202608150021', reportId: 'rpt-127', modality: 'MR', finding: '脑白质少许缺血灶' },
  },
  {
    id: 'ma-003', type: '危急值处置', title: '危急值: 脑出血 · 需 30 分钟内处置确认',
    applicant: '急诊科 陈护士 (N1003)', submittedAt: isoAgo(0, 2), dueAt: isoAhead(1), status: 'pending', assignee: '值班医生',
    detail: { patient: '刘桂芳', examNo: 'EX202608150045', reportId: 'rpt-221', criticalLevel: 'A', value: '右侧基底节区脑出血' },
  },
  {
    id: 'ma-004', type: '费用审批', title: '造影剂费用补录审批 · ¥2,860',
    applicant: '技师 赵强 (T1005)', submittedAt: isoAgo(1, 3), dueAt: isoAhead(3), status: 'pending', assignee: '财务科',
    detail: { amount: 2860, item: '碘海醇注射液 350mgI/ml 100ml x2', feeNo: 'FEE-202608-0934' },
  },
  {
    id: 'ma-005', type: '请假审批', title: '年假申请 (3 天) · 2026-08-20 ~ 2026-08-22',
    applicant: '技师 孙丽 (T1002)', submittedAt: isoAgo(2, 2), dueAt: isoAhead(5), status: 'pending', assignee: '科主任',
    detail: { days: 3, startDate: '2026-08-20', endDate: '2026-08-22', leaveType: '年假' },
  },
  {
    id: 'ma-006', type: '危急值处置', title: '危急值: 急性主动脉夹层 · 处置确认逾期',
    applicant: '急诊科 刘护士 (N1007)', submittedAt: isoAgo(2, 4), dueAt: isoAgo(1, 2), status: 'pending', assignee: '值班医生',
    detail: { patient: '钱卫东', examNo: 'EX202608130098', reportId: 'rpt-305', criticalLevel: 'A', value: '主动脉内膜瓣影, 提示夹层' },
  },
  {
    id: 'ma-007', type: '报告签发', title: 'DR 胸部正位报告签发 · 患者周敏',
    applicant: '李医生 (D1001)', submittedAt: isoAgo(3, 1), dueAt: isoAgo(0, 1), status: 'pending', assignee: '质控组',
    detail: { patient: '周敏', examNo: 'EX202608120034', reportId: 'rpt-176', modality: 'DR', finding: '双肺纹理增粗' },
  },
  {
    id: 'ma-101', type: '报告发布', title: 'CT 腹部增强报告发布 · 患者吴桂英',
    applicant: '王医生 (D1002)', submittedAt: isoAgo(4, 2), dueAt: isoAgo(3, 2), status: 'approved', assignee: '报告组',
    detail: { patient: '吴桂英', examNo: 'EX202608110077', reportId: 'rpt-201', modality: 'CT' },
    comment: '报告完整, 同意发布', processedAt: isoAgo(4, 1), processedBy: '科主任 (D002)',
  },
  {
    id: 'ma-102', type: '费用审批', title: '高值耗材采购审批 · ¥12,400',
    applicant: '技师 赵强 (T1005)', submittedAt: isoAgo(5, 3), dueAt: isoAgo(4, 3), status: 'rejected', assignee: '财务科',
    detail: { amount: 12400, item: '血管内造影导管 6F x40', feeNo: 'FEE-202608-0871' },
    reason: '请补充科室用量说明后再提交', processedAt: isoAgo(4, 5), processedBy: '财务科 周会计 (F1001)',
  },
  {
    id: 'ma-103', type: '请假审批', title: '病假申请 (1 天) · 2026-08-12',
    applicant: '护士 陈琳 (N1003)', submittedAt: isoAgo(6, 1), dueAt: isoAgo(5, 1), status: 'approved', assignee: '科主任',
    detail: { days: 1, startDate: '2026-08-12', endDate: '2026-08-12', leaveType: '病假' },
    comment: '同意, 注意轮班安排', processedAt: isoAgo(6), processedBy: '科主任 (D002)',
  },
  {
    id: 'ma-104', type: '危急值处置', title: '危急值: 大量心包积液 · 处置完成确认',
    applicant: '急诊科 陈护士 (N1003)', submittedAt: isoAgo(7, 2), dueAt: isoAgo(6, 2), status: 'approved', assignee: '值班医生',
    detail: { patient: '郑海燕', examNo: 'EX202608080066', reportId: 'rpt-154', criticalLevel: 'B', value: '大量心包积液' },
    comment: '已床边超声确认并处置, 记录完整', processedAt: isoAgo(6, 3), processedBy: '值班医生 (D1005)',
  },
  {
    id: 'ma-105', type: '报告签发', title: '超声肝胆胰脾报告签发 · 患者胡文静',
    applicant: '李医生 (D1001)', submittedAt: isoAgo(8, 1), dueAt: isoAgo(7, 1), status: 'delegated', assignee: '质控组',
    detail: { patient: '胡文静', examNo: 'EX202608070052', reportId: 'rpt-098', modality: 'US' },
    delegatedTo: 'D1008', processedAt: isoAgo(7, 4), processedBy: '质控组长 (D003)',
  },
  {
    id: 'ma-106', type: '费用审批', title: '移动阅片流量补贴审批 · ¥500',
    applicant: '医生 王芳 (D1002)', submittedAt: isoAgo(9, 2), dueAt: isoAgo(8, 2), status: 'rejected', assignee: '财务科',
    detail: { amount: 500, item: '远程会诊流量补贴 8 月', feeNo: 'FEE-202608-0655' },
    reason: '补贴标准调整为 300 元, 请重新申请', processedAt: isoAgo(8, 3), processedBy: '财务科 周会计 (F1001)',
  },
]

const TYPE_COLORS: Record<MobileApprovalType, string> = {
  报告签发: 'blue', 报告发布: 'geekblue', 危急值处置: 'red', 费用审批: 'gold', 请假审批: 'purple',
}

function listPayload(itemsList: unknown[], total?: number) {
  return { success: true, data: { items: itemsList, total: total ?? itemsList.length } }
}

export const mobileApprovalHandlers = [
  http.get(`${API_BASE}/mobile-approval/pending`, async () => {
    await delay(200)
    const sorted = [...items]
      .filter((i) => i.status === 'pending' || i.status === 'delegated')
      .sort((a, b) => {
        const aOverdue = new Date(a.dueAt) < new Date() ? 1 : 0
        const bOverdue = new Date(b.dueAt) < new Date() ? 1 : 0
        if (aOverdue !== bOverdue) return bOverdue - aOverdue
        return a.submittedAt < b.submittedAt ? 1 : -1
      })
    return HttpResponse.json(listPayload(sorted))
  }),

  http.get(`${API_BASE}/mobile-approval/history`, async () => {
    await delay(200)
    const sorted = [...items]
      .filter((i) => i.status === 'approved' || i.status === 'rejected')
      .sort((a, b) => ((a.processedAt ?? '') < (b.processedAt ?? '') ? 1 : -1))
    return HttpResponse.json(listPayload(sorted))
  }),

  http.get(`${API_BASE}/mobile-approval/stats`, async () => {
    await delay(150)
    const pendingList = items.filter((i) => i.status === 'pending' || i.status === 'delegated')
    const overdue = pendingList.filter((i) => new Date(i.dueAt) < new Date()).length
    const byType = (['报告签发', '报告发布', '危急值处置', '费用审批', '请假审批'] as const).map((type) => ({
      type,
      count: pendingList.filter((i) => i.type === type).length,
    }))
    return HttpResponse.json({
      success: true,
      data: {
        pending: items.filter((i) => i.status === 'pending').length,
        approved: items.filter((i) => i.status === 'approved').length,
        rejected: items.filter((i) => i.status === 'rejected').length,
        delegated: items.filter((i) => i.status === 'delegated').length,
        overdue,
        byType,
      },
    })
  }),

  http.post(`${API_BASE}/mobile-approval/:id/approve`, async ({ request, params }) => {
    await delay(250)
    const id = String(params.id)
    const item = items.find((i) => i.id === id)
    if (!item) return HttpResponse.json({ success: false, error: { message: `审批事项不存在: ${id}` } }, { status: 404 })
    if (item.status !== 'pending' && item.status !== 'delegated') {
      return HttpResponse.json({ success: false, error: { message: `审批事项已处理 (${item.status})` } }, { status: 400 })
    }
    const body = (await request.json()) as { comment?: string }
    item.status = 'approved'
    item.comment = body?.comment?.trim() || undefined
    item.processedAt = new Date().toISOString()
    item.processedBy = '当前审批人 (current)'
    return HttpResponse.json({ success: true, data: { ...item } })
  }),

  http.post(`${API_BASE}/mobile-approval/:id/reject`, async ({ request, params }) => {
    await delay(250)
    const id = String(params.id)
    const item = items.find((i) => i.id === id)
    if (!item) return HttpResponse.json({ success: false, error: { message: `审批事项不存在: ${id}` } }, { status: 404 })
    if (item.status !== 'pending' && item.status !== 'delegated') {
      return HttpResponse.json({ success: false, error: { message: `审批事项已处理 (${item.status})` } }, { status: 400 })
    }
    const body = (await request.json()) as { reason?: string }
    const reason = (body?.reason ?? '').trim()
    if (!reason) return HttpResponse.json({ success: false, error: { message: '驳回原因(reason)必填' } }, { status: 400 })
    item.status = 'rejected'
    item.reason = reason
    item.processedAt = new Date().toISOString()
    item.processedBy = '当前审批人 (current)'
    return HttpResponse.json({ success: true, data: { ...item } })
  }),

  http.post(`${API_BASE}/mobile-approval/:id/delegate`, async ({ request, params }) => {
    await delay(250)
    const id = String(params.id)
    const item = items.find((i) => i.id === id)
    if (!item) return HttpResponse.json({ success: false, error: { message: `审批事项不存在: ${id}` } }, { status: 404 })
    if (item.status !== 'pending' && item.status !== 'delegated') {
      return HttpResponse.json({ success: false, error: { message: `审批事项已处理 (${item.status})` } }, { status: 400 })
    }
    const body = (await request.json()) as { toUserId?: string }
    const toUserId = (body?.toUserId ?? '').trim()
    if (!toUserId) return HttpResponse.json({ success: false, error: { message: '被委派人(toUserId)必填' } }, { status: 400 })
    item.status = 'delegated'
    item.delegatedTo = toUserId
    item.processedAt = new Date().toISOString()
    item.processedBy = '当前审批人 (current)'
    return HttpResponse.json({ success: true, data: { ...item } })
  }),
]

export { TYPE_COLORS }

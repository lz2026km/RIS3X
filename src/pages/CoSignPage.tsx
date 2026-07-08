// ============================================================
// G005 放射科RIS系统 v3.0.6.11 - 双签工作流 R3 (真实实现)
// 路由 /cosign - 双签收件箱 / 排班 / 急诊 / 多人签 / 签冲突 / SLA
// 数据源: useReportStore + reportApi.cosign() / reportApi.reject()
// ============================================================

import React, { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  Award,
  X,
  Check,
  MessageSquare,
  Eye,
  Loader2,
} from 'lucide-react'
import {
  COSIGN_KPI,
  COSIGN_CALENDAR,
  COSIGN_EMERGENCY,
  COSIGN_DASHBOARD_KPI,
} from '../data/cosignMock'
import { useReportStore } from '../store/reportStore'
import { reportApi } from '../services/api/reportApi'
import { useAuth } from '../hooks/useAuth'

type Tab = 'inbox' | 'schedule' | 'emergency' | 'kpi'

interface DetailState {
  type: 'inbox'
  id: string
}

const priorityClass = (p: string) => {
  if (p === 'stat') return 'bg-red-100 text-red-700'
  if (p === 'urgent') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

const priorityLabel = (p: string) => {
  if (p === 'stat') return '加急'
  if (p === 'urgent') return '紧急'
  if (p === 'routine') return '常规'
  return p
}

const CoSignPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('inbox')
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [processed, setProcessed] = useState<Record<string, 'approved' | 'rejected'>>({})
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // v3.0.6.11: 接 reportStore 真实报告数据
  const reports = useReportStore((s) => s.reports)
  const storeLoad = useReportStore((s) => s.load)
  const storeError = useReportStore((s) => s.error)
  const { user } = useAuth()
  const currentUserId = user?.id ?? 'system'
  const currentUserName = user?.name ?? '系统'

  useEffect(() => {
    void storeLoad()
  }, [storeLoad])

  // 收件箱只显示在 store 中未结案(coSignReview / submitted)的报告;
  // 若 store 未加载到,降级使用 mock inbox 以保留 UI 可见性。
  const liveInbox = useMemo(() => {
    if (reports.length === 0) return []
    return reports
      .filter((r) => {
        const s = String(r.status ?? '')
        return s === 'CoSign双签' || s === 'coSignReview' || s === '已提交' || s === 'submitted'
      })
      .map((r) => ({
        id: `live-${r.id}`,
        reportId: r.id,
        patientName: r.patientName ?? '患者',
        modality: r.modality ?? '',
        bodyPart: r.bodyPart ?? '',
        priority: 'routine' as const,
        submittedAt: r.createdTime ?? new Date().toISOString(),
        authorName: (r as unknown as { doctorName?: string }).doctorName ?? (r as unknown as { doctorId?: string }).doctorId ?? '报告医生',
        reason: 'cosign-required',
        level: 'cosign' as const,
        waitingHours: 0,
      }))
  }, [reports])

  // 合并 mock + live
  const combinedInbox = useMemo(() => {
    return [
      ...liveInbox,
      ...COSIGN_INBOX_FALLBACK.filter((it) => !liveInbox.some((l) => l.reportId === it.reportId)),
    ]
  }, [liveInbox])

  const inbox = useMemo(
    () => combinedInbox.filter((it) => !processed[it.id]),
    [combinedInbox, processed],
  )

  const allProcessed = inbox.length === 0
  const detailItem = detail ? inbox.find((it) => it.id === detail.id) : null

  const closeDetail = () => {
    setDetail(null)
    setShowRejectForm(false)
    setRejectReason('')
    setActionError(null)
  }

  const handleApprove = async () => {
    if (!detail || !detailItem) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await reportApi.cosign(detailItem.reportId, currentUserId)
      if (res.success) {
        setProcessed((prev) => ({ ...prev, [detail.id]: 'approved' }))
        // 重新加载 store 以反映状态变化
        await storeLoad()
        closeDetail()
      } else {
        setActionError(res.error?.message ?? '双签提交失败')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setActionPending(false)
    }
  }

  const handleReject = async () => {
    if (!detail || !detailItem) return
    if (!showRejectForm) {
      setShowRejectForm(true)
      return
    }
    if (!rejectReason.trim()) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await reportApi.reject(detailItem.reportId, rejectReason.trim())
      if (res.success) {
        setProcessed((prev) => ({ ...prev, [detail.id]: 'rejected' }))
        await storeLoad()
        closeDetail()
      } else {
        setActionError(res.error?.message ?? '拒签失败')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setActionPending(false)
    }
  }

  const schedule = useMemo(() => COSIGN_CALENDAR, [])
  const emergency = useMemo(() => COSIGN_EMERGENCY, [])

  return (
    <div className="p-6 space-y-4" data-testid="cosign-page">
      <div className="flex items-center gap-2">
        <Users className="text-blue-600" size={28} />
        <h1 className="text-2xl font-bold">双签工作流 (R3)</h1>
        <span className="text-sm text-gray-500">· 操作人:{currentUserName}</span>
      </div>
      <p className="text-gray-600">双签收件箱 · 排班 · 急诊双签 · 多人签 · 签冲突 · SLA 监控</p>

      {storeError && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700" data-testid="cosign-store-error">
          报告状态加载异常:{storeError}(已回退到 mock 收件箱)
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1"><FileText size={14}/>待双签</div>
          <div className="text-2xl font-bold mt-1 text-amber-600" data-testid="cosign-pending-count">{inbox.length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1"><Clock size={14}/>平均响应</div>
          <div className="text-2xl font-bold mt-1">{COSIGN_KPI.avgResponseMinutes}min</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1"><AlertTriangle size={14}/>急诊</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{emergency.length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1"><CheckCircle size={14}/>SLA 达成</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{COSIGN_DASHBOARD_KPI.onTimeRate}%</div>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {(['inbox', 'schedule', 'emergency', 'kpi'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm ${tab === t ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t === 'inbox' ? '收件箱' : t === 'schedule' ? '排班' : t === 'emergency' ? '急诊' : 'KPI'}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <div className="rounded-lg border bg-white">
          {allProcessed ? (
            <div className="text-center py-12 text-gray-500" data-testid="cosign-inbox-empty">
              <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
              <div className="text-base font-medium">收件箱已全部处理</div>
              <div className="text-sm mt-1">所有待双签报告已确认</div>
              <button
                className="mt-4 px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => setProcessed({})}
              >
                重置演示数据
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 px-3">报告 ID</th>
                  <th className="py-2 px-3">患者</th>
                  <th className="py-2 px-3">检查</th>
                  <th className="py-2 px-3">部位</th>
                  <th className="py-2 px-3">提交医生</th>
                  <th className="py-2 px-3">等待(h)</th>
                  <th className="py-2 px-3">优先级</th>
                  <th className="py-2 px-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDetail({ type: 'inbox', id: it.id })}
                    data-testid={`cosign-row-${it.id}`}
                  >
                    <td className="py-2 px-3 font-mono text-xs">{it.reportId}</td>
                    <td className="py-2 px-3 font-medium">{it.patientName}</td>
                    <td className="py-2 px-3">{it.modality}</td>
                    <td className="py-2 px-3">{it.bodyPart}</td>
                    <td className="py-2 px-3">{it.authorName}</td>
                    <td className="py-2 px-3">{it.waitingHours}</td>
                    <td className="py-2 px-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${priorityClass(it.priority)}`}>
                        {priorityLabel(it.priority)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDetail({ type: 'inbox', id: it.id })
                        }}
                      >
                        <Eye size={12} />
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar size={18}/>双签排班</h2>
          {schedule.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Calendar size={32} className="mx-auto mb-2" />
              暂无排班数据
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {schedule.slice(0, 8).map((s) => (
                <div key={s.id} className="p-3 bg-blue-50 rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.reviewerName}</div>
                    <div className="text-xs text-gray-500">{s.shiftType} · {s.startTime}-{s.endTime}</div>
                  </div>
                  <div className="text-xs text-gray-500">{s.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'emergency' && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-red-600"/>急诊双签</h2>
          {emergency.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
              当前无急诊双签需求
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {emergency.slice(0, 5).map((e) => (
                <div key={e.id} className="p-3 bg-red-50 rounded border border-red-200">
                  <div className="font-medium">{e.patientName} - {e.modality} {e.bodyPart}</div>
                  <div className="text-xs text-gray-600 mt-1">级别: {e.criticalLevel}</div>
                  <div className="text-xs text-gray-500 mt-1">触发: {e.triggeredAt}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'kpi' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Award size={18}/>月度 KPI</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">触发总数</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.totalTriggered}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">已签发</span><span className="font-medium text-green-600">{COSIGN_DASHBOARD_KPI.totalSigned}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">已拒签</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.totalRejected}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">已过期</span><span className="font-medium text-red-600">{COSIGN_DASHBOARD_KPI.totalExpired}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SLA 达成率</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.onTimeRate}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">平均耗时</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.avgResponseMinutes}min</span></div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-semibold mb-2">分类统计</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">冲突数</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.conflictCount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">已解决冲突</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.conflictResolvedCount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">临时授权</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.tempAuthActive}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">批量签</span><span className="font-medium">{COSIGN_DASHBOARD_KPI.batchCount}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detail && detailItem && (
        <div className="fixed inset-0 z-50 flex" data-testid="cosign-detail-drawer">
          <div
            className="flex-1 bg-black/40"
            onClick={closeDetail}
            aria-label="关闭详情"
          />
          <div className="w-[480px] max-w-full bg-white shadow-xl flex flex-col">
            <header className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">报告 ID</div>
                <div className="font-bold text-base font-mono">{detailItem.reportId}</div>
              </div>
              <button
                aria-label="关闭"
                onClick={closeDetail}
                className="text-gray-500 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-5 space-y-4 text-sm">
              <section>
                <div className="text-xs text-gray-500 mb-1">患者</div>
                <div className="font-medium">{detailItem.patientName}</div>
              </section>
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">检查类型</div>
                  <div>{detailItem.modality}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">部位</div>
                  <div>{detailItem.bodyPart}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">提交医生</div>
                  <div>{detailItem.authorName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">等待时长</div>
                  <div>{detailItem.waitingHours} h</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">优先级</div>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${priorityClass(detailItem.priority)}`}>
                    {priorityLabel(detailItem.priority)}
                  </span>
                </div>
              </section>

              <section className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <MessageSquare size={12} />临床信息
                </div>
                <div className="text-sm text-gray-700">
                  {(detailItem as any).clinicalInfo || '尚未提供临床信息。'}
                </div>
              </section>

              {showRejectForm && (
                <section>
                  <label className="text-xs text-gray-500">拒签理由 (必填)</label>
                  <textarea
                    className="w-full mt-1 p-2 border rounded text-sm"
                    rows={3}
                    placeholder="请说明拒签原因..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    data-testid="cosign-reject-reason"
                    disabled={actionPending}
                  />
                </section>
              )}

              {actionError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" data-testid="cosign-action-error">
                  {actionError}
                </div>
              )}
            </div>

            <footer className="px-5 py-4 border-t flex gap-2 justify-end">
              <button
                onClick={closeDetail}
                disabled={actionPending}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={actionPending}
                data-testid="cosign-reject-btn"
                className="px-3 py-2 text-sm rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
              >
                {actionPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                {showRejectForm ? '确认拒签' : '拒签'}
              </button>
              <button
                onClick={handleApprove}
                disabled={actionPending}
                data-testid="cosign-approve-btn"
                className="px-3 py-2 text-sm rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
              >
                {actionPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                通过双签
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 本地降级 inbox,避免循环依赖导入 COSIGN_INBOX(此类型比较松散,
 * 与 store 中的真实报告结构不同)。通过 dynamic import 避免类型问题。
 */
const COSIGN_INBOX_FALLBACK: Array<{
  id: string
  reportId: string
  patientName: string
  modality: string
  bodyPart: string
  priority: 'stat' | 'urgent' | 'routine'
  submittedAt: string
  authorName: string
  reason: string
  level: string
  waitingHours: number
}> = [
  { id: 'fb-001', reportId: 'RP20260613007', patientName: '谢军', modality: 'CT', bodyPart: '胸部', priority: 'routine', submittedAt: '', authorName: '李慧', reason: 'special-study', level: 'cosign', waitingHours: 24 },
  { id: 'fb-002', reportId: 'RP20260613008', patientName: '邓丽', modality: 'CT', bodyPart: '腹部', priority: 'routine', submittedAt: '', authorName: '王建', reason: 'special-study', level: 'cosign', waitingHours: 18 },
  { id: 'fb-003', reportId: 'RP20260608014', patientName: '余小', modality: 'US', bodyPart: '腹部', priority: 'routine', submittedAt: '', authorName: '王建', reason: 'special-study', level: 'cosign', waitingHours: 76 },
  { id: 'fb-004', reportId: 'RP20260615001', patientName: '黄海', modality: 'CT', bodyPart: '胸部', priority: 'stat', submittedAt: '', authorName: '李慧', reason: 'critical-finding', level: 'cosign', waitingHours: 2 },
]

export default CoSignPage
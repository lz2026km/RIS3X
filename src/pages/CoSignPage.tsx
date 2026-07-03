// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 双签工作流 R3
// 路由 /cosign - 双签收件箱 / 排班 / 急诊 / 多人签 / 签冲突 / SLA
// 数据源 cosignMock.ts
// ============================================================

import React, { useMemo, useState } from 'react'
import { Users, Clock, AlertTriangle, CheckCircle, FileText, Calendar, Award } from 'lucide-react'
import {
  COSIGN_INBOX,
  COSIGN_KPI,
  COSIGN_CALENDAR,
  COSIGN_EMERGENCY,
  COSIGN_DASHBOARD_KPI,
} from '../data/cosignMock'

type Tab = 'inbox' | 'schedule' | 'emergency' | 'kpi'

const CoSignPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('inbox')

  const inbox = useMemo(() => COSIGN_INBOX, [])
  const schedule = useMemo(() => COSIGN_CALENDAR, [])
  const emergency = useMemo(() => COSIGN_EMERGENCY, [])

  return (
    <div className="p-6 space-y-4" data-testid="cosign-page">
      <div className="flex items-center gap-2">
        <Users className="text-blue-600" size={28} />
        <h1 className="text-2xl font-bold">双签工作流 (R3)</h1>
      </div>
      <p className="text-gray-600">双签收件箱 · 排班 · 急诊双签 · 多人签 · 签冲突 · SLA 监控</p>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1"><FileText size={14}/>待双签</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{inbox.length}</div>
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
              </tr>
            </thead>
            <tbody>
              {inbox.map((it) => (
                <tr key={it.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-mono text-xs">{it.reportId}</td>
                  <td className="py-2 px-3 font-medium">{it.patientName}</td>
                  <td className="py-2 px-3">{it.modality}</td>
                  <td className="py-2 px-3">{it.bodyPart}</td>
                  <td className="py-2 px-3">{it.authorName}</td>
                  <td className="py-2 px-3">{it.waitingHours}</td>
                  <td className="py-2 px-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${
                      it.priority === 'stat' ? 'bg-red-100 text-red-700' :
                      it.priority === 'urgent' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {it.priority === 'stat' ? '加急' : it.priority === 'urgent' ? '紧急' : it.priority === 'routine' ? '常规' : it.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar size={18}/>双签排班</h2>
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
        </div>
      )}

      {tab === 'emergency' && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-red-600"/>急诊双签</h2>
          <div className="space-y-2 text-sm">
            {emergency.slice(0, 5).map((e) => (
              <div key={e.id} className="p-3 bg-red-50 rounded border border-red-200">
                <div className="font-medium">{e.patientName} - {e.modality} {e.bodyPart}</div>
                <div className="text-xs text-gray-600 mt-1">级别: {e.criticalLevel}</div>
                <div className="text-xs text-gray-500 mt-1">触发: {e.triggeredAt}</div>
              </div>
            ))}
          </div>
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
    </div>
  )
}

export default CoSignPage

// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 危急值中心 R3
// 路由 /critical-value-center - 危急值统一入口
// 聚合 CriticalValuePage / CriticalValueRulePage / CriticalValueStatsPage
// ============================================================

import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, Bell, BarChart3, Settings, Activity, TrendingUp, ShieldAlert, Save, Plus, Edit3, Trash2, RefreshCw } from 'lucide-react'
import { message, Switch, Modal, Input, Select, Popconfirm } from 'antd'
import { CRITICAL_RULES } from '../data/criticalValueMock'
import { criticalApi, type CriticalStatsDto } from '../services/api/criticalApi'
import { criticalExtApi, type CriticalChannelDto, type CriticalExtRuleDto, type CriticalExtTimelineDto } from '../services/api'
import { invalidateApiCache } from '../services/api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// [W2-A] 列表双形状归一化: MSW 裸数组 / 后端 { items, total }
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.timeline)) return obj.timeline as T[]
  }
  return []
}

const SEVERITY_OPTIONS = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW']

const CriticalValueCenterPage: React.FC = () => {
  const [stats, setStats] = useState<CriticalStatsDto | null>(null)
  const [rulesCount, setRulesCount] = useState(CRITICAL_RULES.length)
  // [W5] 通知通道开关配置
  const [channels, setChannels] = useState<CriticalChannelDto[]>([])
  const [savingChannels, setSavingChannels] = useState(false)
  // [W2-A] 规则完整 CRUD (createRule/updateRule/deleteRule)
  const [rules, setRules] = useState<CriticalExtRuleDto[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleModal, setRuleModal] = useState<{ open: boolean; editing: CriticalExtRuleDto | null }>({ open: false, editing: null })
  const [ruleForm, setRuleForm] = useState({ name: '', condition: '', action: '', severity: 'HIGH', enabled: true })
  const [ruleSaving, setRuleSaving] = useState(false)
  // [W2-A] 统计: getSummary / getTimeline
  const [summary, setSummary] = useState<{ todayCount?: number; weeklyCount?: number; monthlyCount?: number; avgResponseTime?: number } | null>(null)
  const [timeline, setTimeline] = useState<CriticalExtTimelineDto[]>([])

  const loadRules = useCallback(async () => {
    setRulesLoading(true)
    try {
      const res = await criticalExtApi.listRules()
      if (res.success) {
        const items = asList<CriticalExtRuleDto>(res.data)
        setRules(items)
        setRulesCount(items.length)
      }
    } catch { /* 保持 mock 兜底 */ }
    setRulesLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const [summaryRes, timelineRes] = await Promise.all([
        criticalExtApi.getSummary(),
        criticalExtApi.getTimeline(),
      ])
      if (summaryRes.success && summaryRes.data && typeof summaryRes.data === 'object') {
        const s = summaryRes.data as unknown as Record<string, unknown>
        if (s.items) {
          // 后端形状 { items, total } → 本周/本月按时间窗粗算兜底
          const items = asList<Record<string, unknown>>(s.items)
          const now = new Date()
          const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          setSummary({
            weeklyCount: items.filter((i) => new Date(String(i.triggeredAt ?? i.createdAt ?? '')).getTime() >= startOfWeek.getTime()).length,
            monthlyCount: items.filter((i) => new Date(String(i.triggeredAt ?? i.createdAt ?? '')).getTime() >= startOfMonth.getTime()).length,
          })
        } else {
          setSummary({
            todayCount: typeof s.todayCount === 'number' ? s.todayCount : undefined,
            weeklyCount: typeof s.weeklyCount === 'number' ? s.weeklyCount : undefined,
            monthlyCount: typeof s.monthlyCount === 'number' ? s.monthlyCount : undefined,
            avgResponseTime: typeof s.avgResponseTime === 'number' ? s.avgResponseTime : undefined,
          })
        }
      }
      if (timelineRes.success) {
        const items = asList<CriticalExtTimelineDto>(timelineRes.data)
        setTimeline(items.map((t) => {
          const raw = t as CriticalExtTimelineDto & Record<string, unknown>
          return {
            date: String(raw.time ?? raw.date ?? ''),
            count: Number(raw.count ?? 0),
            resolved: Number(raw.resolved ?? 0),
            escalated: Number(raw.escalated ?? 0),
          }
        }).filter((t) => t.date))
      }
    } catch { /* 统计不可用时保持空态 */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [statsRes, rulesRes] = await Promise.all([
          criticalApi.getStats(),
          criticalExtApi.listRules(),
        ])
        if (cancelled) return
        if (statsRes.success && statsRes.data) setStats(statsRes.data)
        // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
        const rules = Array.isArray(rulesRes.data) ? rulesRes.data : (rulesRes.data?.items ?? [])
        if (rulesRes.success) { setRules(rules as CriticalExtRuleDto[]); setRulesCount(rules.length) }
      } catch {
        // 保持 mock 常量兜底
      }
    })()
    void (async () => {
      try {
        const res = await criticalExtApi.getChannels()
        if (cancelled || !res.success) return
        const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        setChannels(items)
      } catch { /* 通道配置加载失败时保持空态 */ }
    })()
    void loadStats()
    return () => { cancelled = true }
  }, [loadStats])

  // [W2-A] 规则保存: 新增 createRule / 编辑 updateRule
  const handleSaveRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.condition.trim()) {
      message.warning('规则名称与触发条件不能为空')
      return
    }
    setRuleSaving(true)
    try {
      const payload = { name: ruleForm.name.trim(), condition: ruleForm.condition.trim(), action: ruleForm.action.trim(), severity: ruleForm.severity, enabled: ruleForm.enabled }
      const res = ruleModal.editing
        ? await criticalExtApi.updateRule(ruleModal.editing.id, payload)
        : await criticalExtApi.createRule(payload)
      if (res.success) {
        message.success(ruleModal.editing ? '规则已更新' : '规则已创建')
        setRuleModal({ open: false, editing: null })
        // [W2-A] 失效 GET 缓存 (api client 内存缓存 60s), 确保列表刷新
        await invalidateApiCache('/critical-ext/rules')
        await loadRules()
      } else {
        message.error(res.error?.message ?? '保存失败')
      }
    } catch {
      message.error('保存规则失败')
    }
    setRuleSaving(false)
  }

  // [W2-A] 规则删除
  const handleDeleteRule = async (rule: CriticalExtRuleDto) => {
    try {
      const res = await criticalExtApi.deleteRule(rule.id)
      if (res.success) {
        message.success('规则已删除')
        await invalidateApiCache('/critical-ext/rules')
        await loadRules()
      } else {
        message.error(res.error?.message ?? '删除失败')
      }
    } catch {
      message.error('删除规则失败')
    }
  }

  // [W5] 保存通知通道开关 → PUT /critical-ext/channels (落库 critical_channel_*)
  const handleSaveChannels = async () => {
    setSavingChannels(true)
    try {
      const res = await criticalExtApi.saveChannels(channels)
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        setChannels(items)
        message.success('通知通道配置已保存')
      } else {
        message.error(res.error?.message || '保存通道配置失败')
      }
    } catch {
      message.error('保存通道配置失败')
    }
    setSavingChannels(false)
  }

  const toggleChannel = (channel: string, enabled: boolean) => {
    setChannels(prev => prev.map(c => (c.channel === channel ? { ...c, enabled } : c)))
  }

  const pending = stats?.pending ?? 0
  const notified = stats?.notified ?? 0
  const resolved = stats?.resolved ?? 0
  const escalated = stats?.escalated ?? 0

  return (
    <div className="p-6 space-y-4" data-testid="critical-value-center-page">
      <div className="flex items-center gap-2">
        <ShieldAlert className="text-red-600" size={28} />
        <h1 className="text-2xl font-bold">危急值中心 (R3)</h1>
      </div>
      <p className="text-gray-600">危急值全生命周期管理 · 闭环监控 · 升级通知 · 统计分析</p>

      <div className="grid grid-cols-4 gap-4">
        <Link to="/critical-value" className="rounded-lg border bg-white p-4 hover:shadow-md transition">
          <AlertOctagon className="text-red-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">待处理</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{pending}</div>
          <div className="text-xs text-gray-400 mt-1">→ 危急值管理</div>
        </Link>
        <Link to="/critical-value" className="rounded-lg border bg-white p-4 hover:shadow-md transition">
          <Bell className="text-amber-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">已通知</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{notified}</div>
          <div className="text-xs text-gray-400 mt-1">→ 通知状态</div>
        </Link>
        <Link to="/critical-value" className="rounded-lg border bg-white p-4 hover:shadow-md transition">
          <Activity className="text-blue-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">已闭环</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{resolved}</div>
          <div className="text-xs text-gray-400 mt-1">→ 闭环趋势</div>
        </Link>
        <Link to="/critical-value" className="rounded-lg border bg-white p-4 hover:shadow-md transition">
          <TrendingUp className="text-orange-600 mb-2" size={24} />
          <div className="text-sm text-gray-500">超时</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{escalated}</div>
          <div className="text-xs text-gray-400 mt-1">→ 升级处理</div>
        </Link>
      </div>

      {/* [W2-A] 汇总统计: getSummary 卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">今日危急值</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{summary?.todayCount ?? stats?.todayCount ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">本周危急值</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{summary?.weeklyCount ?? '-'}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">本月危急值</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{summary?.monthlyCount ?? '-'}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">平均响应 (分钟)</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{summary?.avgResponseTime ?? '-'}</div>
        </div>
      </div>

      {/* [W2-A] 趋势图: getTimeline */}
      {timeline.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">危急值趋势 ({timeline.length} 天)</h2>
            <button onClick={() => void loadStats()} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
              <RefreshCw size={12} /> 刷新
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="count" name="触发" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="resolved" name="已处理" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="escalated" name="已升级" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Link to="/critical-value" className="rounded-lg border bg-white p-5 hover:shadow-md transition flex items-start gap-3">
          <AlertOctagon className="text-red-600 flex-shrink-0" size={28} />
          <div>
            <h3 className="font-semibold">危急值管理</h3>
            <p className="text-sm text-gray-500 mt-1">发现 → 通知 → 确认 → 处理 → 升级 → 闭环</p>
          </div>
        </Link>
        <Link to="/critical-value-rule" className="rounded-lg border bg-white p-5 hover:shadow-md transition flex items-start gap-3">
          <Settings className="text-blue-600 flex-shrink-0" size={28} />
          <div>
            <h3 className="font-semibold">危急值规则</h3>
            <p className="text-sm text-gray-500 mt-1">规则库配置 · 分级 · 通知链 · 升级策略</p>
          </div>
        </Link>
        <Link to="/critical-value-stats" className="rounded-lg border bg-white p-5 hover:shadow-md transition flex items-start gap-3">
          <BarChart3 className="text-green-600 flex-shrink-0" size={28} />
          <div>
            <h3 className="font-semibold">危急值统计</h3>
            <p className="text-sm text-gray-500 mt-1">响应时效 · 闭环率 · 部门对比 · 趋势</p>
          </div>
        </Link>
      </div>

      {/* [W2-A] 规则库完整 CRUD: listRules / createRule / updateRule / deleteRule */}
      <div className="rounded-lg border bg-white p-4" data-testid="critical-rule-crud">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">危急值规则库 ({rulesCount} 条)</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setRuleModal({ open: true, editing: null }); setRuleForm({ name: '', condition: '', action: '', severity: 'HIGH', enabled: true }) }}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={12} /> 新增规则
            </button>
            <button onClick={() => void loadRules()} disabled={rulesLoading} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} /> {rulesLoading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>
        {rules.length > 0 ? (
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-slate-200">
                <th className="py-2 pr-2 font-semibold">规则名称</th>
                <th className="py-2 pr-2 font-semibold">触发条件</th>
                <th className="py-2 pr-2 font-semibold">处置动作</th>
                <th className="py-2 pr-2 font-semibold">严重度</th>
                <th className="py-2 pr-2 font-semibold">状态</th>
                <th className="py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium text-slate-800">{r.name}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-600">{r.condition}</td>
                  <td className="py-2 pr-2 text-xs text-slate-600">{r.action || '-'}</td>
                  <td className="py-2 pr-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${String(r.severity).includes('CRITICAL') ? 'bg-red-100 text-red-700' : String(r.severity).includes('URGENT') ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>{r.severity || 'HIGH'}</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.enabled ? '已启用' : '已停用'}</span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRuleModal({ open: true, editing: r }); setRuleForm({ name: r.name, condition: r.condition, action: r.action ?? '', severity: r.severity || 'HIGH', enabled: r.enabled }) }}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        <Edit3 size={11} /> 编辑
                      </button>
                      <Popconfirm title="删除规则" description={`确定删除规则 "${r.name}" 吗?`} onConfirm={() => void handleDeleteRule(r)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                        <button className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                          <Trash2 size={11} /> 删除
                        </button>
                      </Popconfirm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-xs text-gray-400 py-3">规则库为空或加载中,点击"新增规则"创建第一条规则...</div>
        )}
      </div>

      {/* 规则编辑/新增 Modal */}
      <Modal
        title={ruleModal.editing ? `编辑规则 - ${ruleModal.editing.name}` : '新增危急值规则'}
        open={ruleModal.open}
        onOk={() => void handleSaveRule()}
        onCancel={() => setRuleModal({ open: false, editing: null })}
        confirmLoading={ruleSaving}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <div className="space-y-3 py-1">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">规则名称 *</div>
            <Input value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} placeholder="如: WBC 白细胞危急值" />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">触发条件 *</div>
            <Input value={ruleForm.condition} onChange={(e) => setRuleForm((f) => ({ ...f, condition: e.target.value }))} placeholder="如: WBC > 30 x10^9/L" />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">处置动作</div>
            <Input value={ruleForm.action} onChange={(e) => setRuleForm((f) => ({ ...f, action: e.target.value }))} placeholder="如: 立即电话通知临床医生" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">严重度</div>
              <Select
                className="w-full"
                value={ruleForm.severity}
                onChange={(v) => setRuleForm((f) => ({ ...f, severity: v }))}
                options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">启用状态</div>
              <Switch checked={ruleForm.enabled} onChange={(v) => setRuleForm((f) => ({ ...f, enabled: v }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* [W5] 通知通道开关配置: 落库 critical_channel_<CHANNEL>, 后端据此判定投递结果 */}
      <div className="rounded-lg border bg-white p-4" data-testid="critical-channel-config">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">通知通道配置</h2>
          <button
            onClick={() => void handleSaveChannels()}
            disabled={savingChannels}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={12} /> {savingChannels ? '保存中...' : '保存'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {channels.map((c) => (
            <div key={c.channel} className="flex items-center justify-between rounded border p-3 bg-slate-50">
              <div>
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="text-xs text-gray-400 font-mono">{c.channel}</div>
              </div>
              <Switch size="small" checked={c.enabled} onChange={(v) => toggleChannel(c.channel, v)} />
            </div>
          ))}
          {channels.length === 0 && (
            <div className="text-xs text-gray-400 col-span-full py-2">通道配置加载中或不可用...</div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          关闭的通道将不再投递危急值通知（投递状态判定为 FAILED），配置保存至系统配置表 critical_channel_* 键。
        </p>
      </div>
    </div>
  )
}

export default CriticalValueCenterPage

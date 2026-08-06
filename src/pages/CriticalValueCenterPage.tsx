// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 危急值中心 R3
// 路由 /critical-value-center - 危急值统一入口
// 聚合 CriticalValuePage / CriticalValueRulePage / CriticalValueStatsPage
// ============================================================

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, Bell, BarChart3, Settings, Activity, TrendingUp, ShieldAlert, Save } from 'lucide-react'
import { message, Switch } from 'antd'
import { CRITICAL_RULES } from '../data/criticalValueMock'
import { criticalApi, type CriticalStatsDto } from '../services/api/criticalApi'
import { criticalExtApi, type CriticalChannelDto } from '../services/api'

const CriticalValueCenterPage: React.FC = () => {
  const [stats, setStats] = useState<CriticalStatsDto | null>(null)
  const [rulesCount, setRulesCount] = useState(CRITICAL_RULES.length)
  // [W5] 通知通道开关配置
  const [channels, setChannels] = useState<CriticalChannelDto[]>([])
  const [savingChannels, setSavingChannels] = useState(false)

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
        if (rulesRes.success) setRulesCount(rules.length)
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
    return () => { cancelled = true }
  }, [])

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

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-3">危急值规则库 ({rulesCount} 条)</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {CRITICAL_RULES.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 bg-red-50 rounded">
              <span className="rounded bg-red-600 text-white text-xs px-1.5 py-0.5 font-mono">{r.code}</span>
              <span className="truncate flex-1">{r.name}</span>
              <span className="text-xs text-gray-500">{r.level}</span>
            </div>
          ))}
        </div>
      </div>

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

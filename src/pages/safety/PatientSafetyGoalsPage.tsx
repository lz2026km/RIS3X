import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Target, CheckCircle, TrendingUp, BarChart3, AlertTriangle, Plus } from 'lucide-react'
import { getPatientSafetyGoals, type PatientSafetyGoal } from '../../services/api/safetyApi'

const CATEGORIES = ['身份识别', '手术安全', '用药安全', '危急值管理', '患者安全', '感染控制', '辐射安全', '服务品质']
const STATUS_CONFIG = {
  'on-track': { label: '正常推进', color: '#22c55e' },
  'at-risk': { label: '存在风险', color: '#f59e0b' },
  behind: { label: '落后计划', color: '#ef4444' },
  achieved: { label: '已完成', color: '#3b82f6' },
}

export default function PatientSafetyGoalsPage() {
  const [goals, setGoals] = useState<PatientSafetyGoal[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => { getPatientSafetyGoals().then(setGoals) }, [])

  const filtered = categoryFilter === 'all' ? goals : goals.filter(g => g.category === categoryFilter)

  const progressData = goals.map(g => ({
    name: g.title.length > 10 ? g.title.slice(0, 10) + '...' : g.title,
    current: g.current,
    target: g.target,
    unit: g.unit,
    progress: g.unit === '%' ? Math.round(g.current / g.target * 100) : g.target === 0 ? Math.max(0, 100 - g.current * 20) : Math.round((1 - g.current / g.target) * 100),
  }))

  Object.entries(STATUS_CONFIG).map(([k, v]) => ({
    name: v.label,
    value: goals.filter(g => g.status === k).length,
    color: v.color,
  }));

  const categoryCompData = CATEGORIES.map(c => ({
    category: c,
    passed: goals.filter(g => g.category === c && (g.status === 'on-track' || g.status === 'achieved')).length,
    failed: goals.filter(g => g.category === c && (g.status === 'at-risk' || g.status === 'behind')).length,
  }))

  const overallProgress = Math.round(goals.filter(g => g.status === 'on-track' || g.status === 'achieved').length / goals.length * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>患者安全目标</span>
        </div>
        <button style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />新建目标
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: '总目标数', value: goals.length, icon: Target, color: '#3b82f6' },
            { title: '正常推进', value: goals.filter(g => g.status === 'on-track').length, icon: CheckCircle, color: '#22c55e' },
            { title: '存在风险', value: goals.filter(g => g.status === 'at-risk').length, icon: AlertTriangle, color: '#f59e0b' },
            { title: '已完成', value: goals.filter(g => g.status === 'achieved').length, icon: CheckCircle, color: '#3b82f6' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="#3b82f6" />目标进度概览
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: overallProgress >= 80 ? '#22c55e' : overallProgress >= 60 ? '#f59e0b' : '#ef4444' }}>{overallProgress}%</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>整体达标率</div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={progressData.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="progress" fill="#3b82f6" radius={[0, 4, 4, 0]} name="完成度(%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />各类别推进情况
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryCompData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="passed" fill="#22c55e" radius={[4, 4, 0, 0]} name="达标" stackId="a" />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="未达标" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setCategoryFilter('all')} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${categoryFilter === 'all' ? '#2563eb' : '#30363d'}`, background: categoryFilter === 'all' ? '#2563eb20' : 'transparent', color: categoryFilter === 'all' ? '#2563eb' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>全部</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${categoryFilter === c ? '#2563eb' : '#30363d'}`, background: categoryFilter === c ? '#2563eb20' : 'transparent', color: categoryFilter === c ? '#2563eb' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>{c}</button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>目标</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>类别</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>基线值</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>当前值</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>目标值</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>负责人</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const cfg = STATUS_CONFIG[g.status]
                return (
                  <tr key={g.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                      <div style={{ fontSize: 13 }}>{g.title}</div>
                      <div style={{ fontSize: 12, color: '#6e7681' }}>{g.description}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{g.category}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{g.baseline}{g.unit}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', fontWeight: 600 }}>{g.current}{g.unit}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#22c55e' }}>{g.target}{g.unit}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{g.owner}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

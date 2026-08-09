import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { TrendingUp, CheckCircle, Target, Plus, BarChart3, Activity } from 'lucide-react'
import {
  getCqiDashboard, createCqiProject, closeCqiProject,
  type CqiProject, type CqiStatus,
} from '../../services/api/safetyApi'

const STATUS_LABELS: Record<CqiStatus, string> = {
  planning: '规划中',
  active: '进行中',
  sustaining: '维持中',
  closed: '已关闭',
}

const STATUS_COLORS: Record<CqiStatus, string> = {
  planning: '#8b949e',
  active: '#3b82f6',
  sustaining: '#22c55e',
  closed: '#6e7681',
}

export default function CQIPage() {
  const [projects, setProjects] = useState<CqiProject[]>([])
  const [selectedProject, setSelectedProject] = useState<CqiProject | null>(null)
  const [filter, setFilter] = useState<CqiStatus | 'all'>('all')

  useEffect(() => { getCqiDashboard().then(setProjects) }, [])

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)
  const statusData = Object.entries(STATUS_LABELS).map(([k, v]) => ({
    name: v, count: projects.filter(p => p.status === k).length,
  }))
  const indicatorData = projects.flatMap(p => p.indicators.map(ind => ({
    project: p.title.length > 8 ? p.title.slice(0, 8) + '..' : p.title,
    indicator: ind.name,
    current: ind.currentValue,
    target: ind.targetValue,
    baseline: ind.baselineValue,
  })))

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>持续质量改进 (CQI)</span>
        </div>
        <button onClick={() => {
          createCqiProject({
            title: '新改进项目',
            description: '待填写项目描述',
            aim: '待设定改进目标',
            indicators: [],
            pdsaCycles: [],
            sponsor: '当前用户',
            teamMembers: [],
            startDate: new Date().toISOString().slice(0, 10),
            targetEndDate: '',
          }).then(() => getCqiDashboard().then(setProjects))
        }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />新建CQI
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: 'CQI项目', value: projects.length, icon: Target, color: '#0891b2' },
            { title: '进行中', value: projects.filter(p => p.status === 'active').length, icon: Activity, color: '#3b82f6' },
            { title: '维持中', value: projects.filter(p => p.status === 'sustaining').length, icon: CheckCircle, color: '#22c55e' },
            { title: 'PDSA周期', value: projects.reduce((s, p) => s + p.pdsaCycles.length, 0), icon: BarChart3, color: '#8b5cf6' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}><span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span><k.icon size={20} style={{ color: k.color }} /></div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {selectedProject ? (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedProject.title}</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{selectedProject.id} · {selectedProject.startDate} ~ {selectedProject.targetEndDate || '待定'}</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[selectedProject.status]}20`, color: STATUS_COLORS[selectedProject.status] }}>{STATUS_LABELS[selectedProject.status]}</span>
            </div>
            <div style={{ marginBottom: 16, color: '#8b949e', fontSize: 13 }}>{selectedProject.description}</div>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#0d1117', borderRadius: 6, border: '1px solid #21262d' }}>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>改进目标</div>
              <div style={{ fontSize: 14, color: '#f0f6fc' }}>{selectedProject.aim}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>指标</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {selectedProject.indicators.map((ind, i) => (
                  <div key={i} style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #21262d' }}>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>{ind.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: ind.trend === 'up' ? '#22c55e' : ind.trend === 'down' ? '#ef4444' : '#f59e0b' }}>
                      {ind.currentValue}{ind.unit}
                    </div>
                    <div style={{ fontSize: 12, color: '#6e7681' }}>基线: {ind.baselineValue} → 目标: {ind.targetValue}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>PDSA循环</div>
              {selectedProject.pdsaCycles.length > 0 ? selectedProject.pdsaCycles.map((pd, i) => (
                <div key={i} style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #21262d', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>PDSA #{pd.cycle}</span>
                    <span style={{ fontSize: 12, color: '#6e7681' }}>{pd.startDate} ~ {pd.endDate}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: '#3b82f6' }}>计划：</span> {pd.plan}</div>
                    <div><span style={{ color: '#22c55e' }}>执行：</span> {pd.do_}</div>
                    <div><span style={{ color: '#f59e0b' }}>研究：</span> {pd.study}</div>
                    <div><span style={{ color: '#8b5cf6' }}>处理：</span> {pd.act}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: pd.success ? '#22c55e' : '#ef4444' }}>
                    {pd.outcome} {pd.success ? '✅' : '❌'}
                  </div>
                </div>
              )) : (
                <div style={{ color: '#8b949e', fontSize: 13 }}>尚未开始PDSA循环</div>
              )}
            </div>

            {selectedProject.status !== 'closed' && (
              <div style={{ marginTop: 16 }}>
                <button onClick={async () => {
                  await closeCqiProject(selectedProject.id, '项目取得预期效果', '持续监测并定期回顾')
                  const data = await getCqiDashboard()
                  setProjects(data)
                  setSelectedProject(null)
                }} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0891b2', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  关闭项目
                </button>
                <button onClick={() => setSelectedProject(null)} style={{ marginLeft: 8, padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13 }}>
                  返回
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={16} color="#3b82f6" />CQI项目状态
                </div>
                <ChartContainer height={200} state={statusData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无CQI状态数据">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} name="数量" />
                  </BarChart>
                </ChartContainer>
              </div>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} color="#22c55e" />指标达成情况
                </div>
                <ChartContainer height={200} state={indicatorData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无指标达成数据">
                  <BarChart data={indicatorData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="indicator" tick={{ fontSize: 8, fill: '#8b949e' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="baseline" fill="#6e7681" radius={[4, 4, 0, 0]} name="基线" />
                    <Bar dataKey="current" fill="#22c55e" radius={[4, 4, 0, 0]} name="当前" />
                    <Bar dataKey="target" fill="#3b82f6" radius={[4, 4, 0, 0]} name="目标" />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['all', 'planning', 'active', 'sustaining', 'closed'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#0891b2' : '#30363d'}`, background: filter === s ? '#0891b220' : 'transparent', color: filter === s ? '#0891b2' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
                  {s === 'all' ? '全部' : STATUS_LABELS[s as CqiStatus]}
                </button>
              ))}
            </div>

            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>项目</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>目标</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>状态</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>PDSA</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>指标</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>负责人</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{p.title}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.aim}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status] }}>{STATUS_LABELS[p.status]}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{p.pdsaCycles.length}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{p.indicators.length}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{p.sponsor}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                        <button onClick={() => setSelectedProject(p)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

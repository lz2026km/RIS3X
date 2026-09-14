// @deprecated [v3.0.6.11-104 Wave 5C] 已收敛至 OperationsCenterPage (/operations-center); 旧路由 /ops/dashboard redirect 兼容。文件保留供回滚参考。
import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend,
} from 'recharts'
import {
  Activity, TrendingUp, Clock, Monitor, Users, RefreshCw,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { getOpsAnalyticsService } from '../../services/ops'
import { Card } from 'antd'
import { ChartContainer } from '../../components/charts'

const svc = getOpsAnalyticsService()

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' },
  header: { background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: 12 },
  headerText: { fontSize: 20, fontWeight: 600 },
  content: { padding: '20px 24px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 },
  panel: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 },
  panelTitle: { fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 },
  kpiCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 },
}

function KpiCard({ title, value, unit, icon: Icon, trend, color }: {
  title: string; value: string | number; unit?: string; icon: typeof Activity; trend?: 'up' | 'down'; color: string
}) {
  return (
    <Card bordered={false} style={s.kpiCard} styles={{ body: { padding: 0 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#8b949e' }}>{title}</span>
        <Icon size={20} style={{ color }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc', marginBottom: 4 }}>
        {value}{unit && <span style={{ fontSize: 14, fontWeight: 400, color: '#6e7681', marginLeft: 4 }}>{unit}</span>}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trend === 'up' ? '#22c55e' : '#ef4444' }}>
          {trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}较昨日
        </div>
      )}
    </Card>
  )
}

export default function OpsDashboardPage() {
  const [days, setDays] = useState(14)
  const [workload, setWorkload] = useState<Array<{ date: string; exams: number; previousExams: number }>>([])
  const [modUtil, setModUtil] = useState<Array<{ modality: string; utilizationPercent: number }>>([])
  const [operators, setOperators] = useState<Array<{ operatorName: string; examsCompleted: number; avgExamTimeMin: number }>>([])
  const [peakData, setPeakData] = useState<Array<{ hour: number; examCount: number; label: string }>>([])
  // [G005 Wave4A P1] 数据源: statsApi 真实优先, 失败回退 mock 服务 (演示徽标); P50 从真实 workload avgTime 派生
  const [dataMode, setDataMode] = useState<'real' | 'demo'>('demo')
  const [p50, setP50] = useState(32)

  const median = (nums: number[]) => {
    if (!nums.length) return undefined
    const sorted = [...nums].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!
  }

  const load = async () => {
    try {
      const { statsApi } = await import('../../services/api/statsApi')
      const [trendRes, modRes, workloadRes] = await Promise.all([
        statsApi.getTrend(days),
        statsApi.getByModality(),
        statsApi.getWorkload(),
      ])
      const trendData: any[] = trendRes.success ? (trendRes.data ?? []) : []
      const modData: any = modRes.success ? modRes.data : null
      const wlData: any[] = workloadRes.success ? (workloadRes.data ?? []) : []
      if (trendData.length === 0 && wlData.length === 0) throw new Error('stats api empty')

      setWorkload(trendData.map((p: any) => ({
        date: p.date ?? p.day ?? '',
        exams: Number(p.examCount ?? p.exams ?? 0),
        previousExams: Number(p.previousExams ?? p.prevExamCount ?? Math.round(Number(p.examCount ?? 0) * 0.9)),
      })))

      if (modData && typeof modData === 'object') {
        setModUtil(Object.entries(modData).map(([modality, v]) => {
          const st = (v ?? {}) as { total?: number; days?: number; avg?: number }
          return { modality, utilizationPercent: Math.min(100, Math.round(Number(st.avg ?? 0) * 100 / 12)) }
        }))
      }

      if (wlData.length > 0) {
        setOperators(wlData.map((w: any) => ({
          operatorName: w.doctorName ?? w.doctor ?? '未分配',
          examsCompleted: Number(w.examCount ?? 0),
          avgExamTimeMin: Math.round(Number(w.avgTime ?? 0)),
        })))
        const times = wlData.map((w: any) => Number(w.avgTime)).filter((n: number) => Number.isFinite(n) && n > 0)
        const med = median(times)
        if (med !== undefined) setP50(med)
      }

      setDataMode('real')
      // 高峰时段无真实端点, 保留服务端模拟数据 (面板标题已标注)
      svc.getPeakHourAnalysis().then(d => setPeakData(d.hourlyData))
    } catch {
      // 回退 mock 服务
      svc.getWorkloadTrend(days).then(setWorkload)
      svc.getModalityUtilization().then(d => setModUtil(d))
      svc.getOperatorProductivity('today').then(setOperators)
      svc.getPeakHourAnalysis().then(d => setPeakData(d.hourlyData))
      setDataMode('demo')
      setP50(32)
    }
  }

  useEffect(() => { void load() }, [days])

  const totalExams = workload.reduce((s, d) => s + d.exams, 0)
  const avgUtil = modUtil.length ? Math.round(modUtil.reduce((s, m) => s + m.utilizationPercent, 0) / modUtil.length) : 0

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerTitle}><Activity size={24} /><span style={s.headerText}>运营指挥中心</span>
          {/* [G005 Wave4A P1] 数据源徽标 */}
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: dataMode === 'real' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.25)',
            color: dataMode === 'real' ? '#4ade80' : '#fbbf24',
            border: `1px solid ${dataMode === 'real' ? '#22c55e' : '#f59e0b'}`,
          }}>
            {dataMode === 'real' ? '真实数据' : '演示数据'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={16} style={{ color: '#8b949e', cursor: 'pointer' }} onClick={() => void load()} title="刷新数据" />
          <span style={{ fontSize: 12, color: '#8b949e' }}>自动刷新 60s</span>
        </div>
      </div>

      <div style={s.content}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KpiCard title="选定周期总检查" value={totalExams} icon={TrendingUp} trend="up" color="#3b82f6" />
          <KpiCard title="平均设备利用率" value={avgUtil} unit="%" icon={Monitor} trend="up" color="#22c55e" />
          <KpiCard title="平均周转时间(P50)" value={p50} unit="min" icon={Clock} color="#f59e0b" />
          <KpiCard title="活跃技师" value={operators.length} icon={Users} color="#8b5cf6" />
        </div>

        <div style={s.grid2}>
          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><TrendingUp size={16} color="#3b82f6" />检查工作量趋势</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #30363d', background: days === d ? '#1e40af' : 'transparent', color: '#f0f6fc', cursor: 'pointer', fontSize: 12 }}>
                  {d}天
                </button>
              ))}
            </div>
            <ChartContainer height={240} state={workload.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无工作量数据">
              <LineChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="exams" stroke="#3b82f6" strokeWidth={2} dot={false} name="本周期" />
                <Line type="monotone" dataKey="previousExams" stroke="#6e7681" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="上一周期" />
              </LineChart>
            </ChartContainer>
          </Card>

          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><Monitor size={16} color="#22c55e" />设备利用率</div>
            <ChartContainer height={260} state={modUtil.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备利用率数据">
              <BarChart data={modUtil}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="modality" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} unit="%" />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`${v}%`, '利用率']} />
                <Bar dataKey="utilizationPercent" fill="#22c55e" radius={[4, 4, 0, 0]} name="利用率" />
              </BarChart>
            </ChartContainer>
          </Card>
        </div>

        <div style={s.grid2}>
          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><Clock size={16} color="#f59e0b" />高峰时段分析 (每小时检查量) <span style={{ fontSize: 11, color: '#6e7681' }}>(模拟)</span></div>
            <ChartContainer height={220} state={peakData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无高峰时段数据">
              <BarChart data={peakData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="examCount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="检查量" />
              </BarChart>
            </ChartContainer>
          </Card>

          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><Users size={16} color="#8b5cf6" />技师生产力排行</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>姓名</th>
                    <th style={{ textAlign: 'right', padding: '8px 8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>检查数</th>
                    <th style={{ textAlign: 'right', padding: '8px 8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>平均耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((o, i) => (
                    <tr key={o.operatorName}>
                      <td style={{ padding: '8px 8px', borderBottom: '1px solid #21262d', color: i < 3 ? '#f59e0b' : '#8b949e', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '8px 8px', borderBottom: '1px solid #21262d', color: '#f0f6fc' }}>{o.operatorName}</td>
                      <td style={{ padding: '8px 8px', borderBottom: '1px solid #21262d', textAlign: 'right', fontWeight: 600 }}>{o.examsCompleted}</td>
                      <td style={{ padding: '8px 8px', borderBottom: '1px solid #21262d', textAlign: 'right', color: '#8b949e' }}>{o.avgExamTimeMin} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

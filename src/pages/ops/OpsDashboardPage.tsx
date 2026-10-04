// @deprecated [v3.0.6.11-104 Wave 5C] 已收敛至 OperationsCenterPage (/operations-center); 旧路由 /ops/dashboard redirect 兼容。文件保留供回滚参考。
import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend,
} from 'recharts'
import {
  Activity, TrendingUp, Clock, Monitor, Users, RefreshCw,
} from 'lucide-react'
import { getOpsAnalyticsService } from '../../services/ops'
import { Card } from 'antd'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { StatCard } from '../../components/common'
import { DataTable } from '../../components/common/DataTable'
import { StatusTag } from '../../components/common/StatusTag'
import { t } from '../../i18n/appI18n'

const svc = getOpsAnalyticsService()

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' },
  header: { background: 'linear-gradient(135deg,var(--color-primary-800),var(--color-primary-900))', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: 12 },
  headerText: { fontSize: 20, fontWeight: 600 },
  content: { padding: '20px 24px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 24 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 },
  panel: { background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 8px)', padding: 16 },
  panelTitle: { fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 },
  kpiCard: { background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 8px)', padding: '16px 20px', flex: 1, minWidth: 180 },
}

function KpiCard({ title, value, unit, icon: Icon, trend, color }: {
  title: string; value: string | number; unit?: string; icon: typeof Activity; trend?: 'up' | 'down'; color: string
}) {
  const c = ({
    '#dc2626': 'error', '#ef4444': 'error', '#ff4d4f': 'error', '#cf1322': 'error',
    '#f59e0b': 'warning', '#faad14': 'warning', '#fa8c16': 'warning', '#ed8936': 'warning',
    '#16a34a': 'success', '#22c55e': 'success', '#52c41a': 'success', '#10b981': 'success',
    '#2563eb': 'primary', '#1890ff': 'primary', '#1d4ed8': 'primary',
  } as Record<string, string>)[color] ?? color
  return <StatCard title={title} value={value} suffix={unit} icon={<Icon size={20} />} trend={trend} color={c} />
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const median = (nums: number[]) => {
    if (!nums.length) return undefined
    const sorted = [...nums].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!
  }

  const load = async () => {
    setLoading(true)
    setLoadError(null)
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
          operatorName: w.doctorName ?? w.doctor ?? t('opsDashboard.unassigned'),
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
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('w2d.loadFailed'))
      // 回退 mock 服务
      svc.getWorkloadTrend(days).then(setWorkload)
      svc.getModalityUtilization().then(d => setModUtil(d))
      svc.getOperatorProductivity('today').then(setOperators)
      svc.getPeakHourAnalysis().then(d => setPeakData(d.hourlyData))
      setDataMode('demo')
      setP50(32)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [days])

  const totalExams = workload.reduce((s, d) => s + d.exams, 0)
  const avgUtil = modUtil.length ? Math.round(modUtil.reduce((s, m) => s + m.utilizationPercent, 0) / modUtil.length) : 0

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerTitle}><Activity size={24} /><span style={s.headerText}>{t('opsDashboard.title')}</span>
          {/* [G005 Wave4A P1] 数据源徽标 */}
          <StatusTag status={dataMode === 'real' ? 'success' : 'warning'} dot>
            {dataMode === 'real' ? t('opsDashboard.realData') : t('opsDashboard.demoData')}
          </StatusTag>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span title={t('opsDashboard.refreshTitle')} style={{ cursor: 'pointer', display: 'inline-flex' }} onClick={() => void load()}>
            <RefreshCw size={16} style={{ color: 'var(--text-secondary)' }} />
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsDashboard.autoRefresh')}</span>
        </div>
      </div>

      <div style={s.content}>
        {loadError && (
          <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning-500)', fontSize: 12 }}>
            {t('w2d.loadFailed')}: {loadError}
          </div>
        )}
        <StateView loading={loading} skeletonRows={6}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KpiCard title={t('opsDashboard.kpiTotalExams')} value={totalExams} icon={TrendingUp} trend="up" color="var(--color-primary-500)" />
          <KpiCard title={t('opsDashboard.kpiAvgUtil')} value={avgUtil} unit="%" icon={Monitor} trend="up" color="var(--color-success-500)" />
          <KpiCard title={t('opsDashboard.kpiTurnaround')} value={p50} unit="min" icon={Clock} color="var(--color-warning-500)" />
          <KpiCard title={t('opsDashboard.kpiActiveTechs')} value={operators.length} icon={Users} color="var(--color-modality-mr)" />
        </div>

        <div style={s.grid2}>
          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><TrendingUp size={16} color="var(--color-primary-500)" />{t('opsDashboard.workloadTrend')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border-default)', background: days === d ? 'var(--color-primary-800)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>
                  {t('opsDashboard.days', { d })}
                </button>
              ))}
            </div>
            <ChartContainer height={240} state={workload.length === 0 ? 'empty' : 'ready'} emptyDescription={t('opsDashboard.noWorkloadData')}>
              <LineChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="exams" stroke="#3b82f6" strokeWidth={2} dot={false} name={t('opsDashboard.thisPeriod')} />
                <Line type="monotone" dataKey="previousExams" stroke="#6e7681" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name={t('opsDashboard.prevPeriod')} />
              </LineChart>
            </ChartContainer>
          </Card>

          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><Monitor size={16} color="var(--color-success-500)" />{t('opsDashboard.deviceUtilization')}</div>
            <ChartContainer height={260} state={modUtil.length === 0 ? 'empty' : 'ready'} emptyDescription={t('opsDashboard.noDeviceUtilData')}>
              <BarChart data={modUtil}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="modality" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`${v}%`, t('opsDashboard.utilization')]} />
                <Bar dataKey="utilizationPercent" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('opsDashboard.utilization')} />
              </BarChart>
            </ChartContainer>
          </Card>
        </div>

        <div style={s.grid2}>
          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><Clock size={16} color="var(--color-warning-500)" />{t('opsDashboard.peakTitle')} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('opsDashboard.simulated')}</span></div>
            <ChartContainer height={220} state={peakData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('opsDashboard.noPeakData')}>
              <BarChart data={peakData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="examCount" fill="#f59e0b" radius={[4, 4, 0, 0]} name={t('opsDashboard.examVolume')} />
              </BarChart>
            </ChartContainer>
          </Card>

          <Card bordered={false} style={s.panel} styles={{ body: { padding: 0 } }}>
            <div style={s.panelTitle}><Users size={16} color="var(--color-modality-mr)" />{t('opsDashboard.techRanking')}</div>
            <DataTable
              dataSource={operators}
              rowKey={(o) => o.operatorName}
              pagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                {
                  title: '#',
                  key: 'rank',
                  width: 48,
                  render: (_v, _r, i) => (
                    <span style={{ color: i < 3 ? 'var(--color-warning-500)' : 'var(--text-secondary)', fontWeight: 700 }}>{i + 1}</span>
                  ),
                },
                { title: t('opsDashboard.colName'), dataIndex: 'operatorName', key: 'operatorName' },
                {
                  title: t('opsDashboard.colExamCount'),
                  dataIndex: 'examsCompleted',
                  key: 'examsCompleted',
                  align: 'right' as const,
                  render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
                },
                {
                  title: t('opsDashboard.colAvgTime'),
                  dataIndex: 'avgExamTimeMin',
                  key: 'avgExamTimeMin',
                  align: 'right' as const,
                  render: (v: number) => <span style={{ color: 'var(--text-secondary)' }}>{v} min</span>,
                },
              ]}
            />
          </Card>
        </div>
        </StateView>
      </div>
    </div>
  )
}

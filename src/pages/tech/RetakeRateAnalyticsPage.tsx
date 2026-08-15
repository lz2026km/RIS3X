/**
 * G005 v3.0.6.11-100 Wave 1B - 重拍率统计 + 原因分类
 * 数据源: GET /worklist/retake-stats?from&to&dimension (tech|modality|reason)
 * 视图: 趋势折线 (recharts) + 原因饼图 + 技师/模态热力图 + 维度切换
 */
import { Alert, Button, Card, Col, Empty, Radio, Row, Space, Statistic, Tag, Tooltip } from 'antd'
import { BarChart3, Camera, Database, PieChart as PieIcon, RefreshCw, TrendingUp, Wrench } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from 'recharts'
import { worklistApi, type RetakeStatsDto } from '../../services/api/worklistApi'

const REASON_COLORS: Record<string, string> = {
  motion_artifact: '#ef4444', positioning: '#f59e0b', wrong_protocol: '#8b5cf6',
  contrast_issue: '#06b6d4', equipment: '#3b82f6', other: '#94a3b8',
}
const MODALITY_COLORS: Record<string, string> = {
  CT: '#2563eb', MR: '#7c3aed', DR: '#0d9488', US: '#db2777', MG: '#9333ea', DSA: '#dc2626',
}

const DIMENSION_OPTIONS = [
  { label: '原因分类', value: 'reason' },
  { label: '按技师', value: 'tech' },
  { label: '按模态', value: 'modality' },
]
const RANGE_OPTIONS = [
  { label: '近 7 天', value: 7 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 },
]

const rateColor = (rate: number): string => {
  if (rate <= 5) return '#10b981'
  if (rate <= 15) return '#84cc16'
  if (rate <= 25) return '#f59e0b'
  return '#dc2626'
}

const heatBg = (rate: number): string => {
  if (rate <= 5) return 'rgba(16,185,129,0.12)'
  if (rate <= 15) return 'rgba(132,204,22,0.18)'
  if (rate <= 25) return 'rgba(245,158,11,0.22)'
  return 'rgba(220,38,38,0.24)'
}

export default function RetakeRateAnalyticsPage() {
  const [dimension, setDimension] = useState<'tech' | 'modality' | 'reason'>('reason')
  const [rangeDays, setRangeDays] = useState(30)
  const [stats, setStats] = useState<RetakeStatsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'api' | 'demo'>('api')

  const load = useCallback(async (dim: string, days: number) => {
    setLoading(true)
    setError('')
    try {
      const to = new Date()
      const from = new Date(to.getTime() - (days - 1) * 86400000)
      const res = await worklistApi.getRetakeStats({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        dimension: dim as 'tech' | 'modality' | 'reason',
      })
      if (res.success && res.data) {
        setStats(res.data)
        setSource('api')
      } else {
        setError(res.error?.message ?? '重拍统计加载失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '重拍统计加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(dimension, rangeDays)
  }, [dimension, rangeDays, load])

  // 趋势图数据: 重拍率折线 + 重拍次数柱
  const trendChart = useMemo(() => {
    if (!stats) return []
    return stats.trend.map((t) => ({
      date: t.date.slice(5),
      rate: t.rate,
      retakes: t.retakes,
      completed: t.completed,
    }))
  }, [stats])

  // 原因分布饼图 (reason 维度) / 技师或模态 → 条形
  const pieData = useMemo(() => {
    if (!stats) return []
    return stats.breakdown.map((b) => ({
      name: b.label,
      value: b.retakes,
      color: dimension === 'reason' ? REASON_COLORS[b.key] ?? '#94a3b8' : MODALITY_COLORS[b.key] ?? '#3b82f6',
    })).filter((p) => p.value > 0)
  }, [stats, dimension])

  const heatRows = useMemo(() => stats?.breakdown ?? [], [stats])

  const palette = (key: string): string => {
    if (dimension === 'reason') return REASON_COLORS[key] ?? '#94a3b8'
    if (dimension === 'modality') return MODALITY_COLORS[key] ?? '#3b82f6'
    return '#3b82f6'
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <BarChart3 size={20} color="#7c3aed" />
        <span style={{ fontSize: 18, fontWeight: 700 }}>重拍率统计与分析</span>
        <Tag color="purple">v3.0.6.11-100 Wave 1B</Tag>
        <Tag color="geekblue">趋势 / 原因分类 / 技师模态热力</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load(dimension, rangeDays)}>刷新</Button>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={DIMENSION_OPTIONS}
          value={dimension}
          onChange={(e) => setDimension(e.target.value as 'tech' | 'modality' | 'reason')}
        />
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={RANGE_OPTIONS as never}
          value={rangeDays}
          onChange={(e) => setRangeDays(e.target.value as number)}
        />
        {stats && <span style={{ fontSize: 12, color: '#94a3b8' }}>统计区间 {stats.from.slice(0, 10)} ~ {stats.to.slice(0, 10)}</span>}
      </Space>

      {error && (
        <Alert type="warning" showIcon message="统计加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load(dimension, rangeDays)}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="完成检查数" value={stats?.summary.totalCompleted ?? 0} loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="重拍次数" value={stats?.summary.totalRetakes ?? 0} prefix={<Camera size={14} />} loading={loading} styles={{ content: { color: '#dc2626' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="重拍率" value={stats?.summary.retakeRate ?? 0} suffix="%" precision={1} loading={loading} styles={{ content: { color: rateColor(stats?.summary.retakeRate ?? 0) } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="重拍检查数" value={stats?.summary.examRetakeCount ?? 0} loading={loading} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card size="small" title={<Space><TrendingUp size={14} />重拍率趋势 (按日)</Space>} extra={<Tag>{trendChart.length} 天</Tag>} style={{ marginBottom: 16 }}>
            {loading && !stats ? (
              <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
            ) : trendChart.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChart} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="rate" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="rate" type="monotone" dataKey="rate" name="重拍率 %" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="count" type="monotone" dataKey="retakes" name="重拍次数" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" title={<Space><PieIcon size={14} />{dimension === 'reason' ? '原因分布' : `${dimension === 'tech' ? '技师' : '模态'}重拍占比`}</Space>} style={{ marginBottom: 16 }}>
            {loading && !stats ? (
              <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
            ) : pieData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无重拍记录" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(p) => `${p.name} ${p.value}`} labelLine={false} fontSize={11}>
                      {pieData.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {pieData.map((p) => (
                    <span key={p.name} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, display: 'inline-block' }} />
                      {p.name} {p.value}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card size="small" title={<Space><BarChart3 size={14} />{dimension === 'reason' ? '原因维度明细' : dimension === 'tech' ? '技师维度明细' : '模态维度明细'}</Space>} extra={<Tag>{heatRows.length} 项</Tag>} style={{ marginBottom: 16 }}>
            {loading && !stats ? (
              <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
            ) : heatRows.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, heatRows.length * 44)}>
                <BarChart data={heatRows} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="完成数" fill="#cbd5e1" barSize={14} />
                  <Bar dataKey="retakes" name="重拍数" fill={palette('')} barSize={14} radius={[0, 3, 3, 0]}>
                    {heatRows.map((b) => <Cell key={b.key} fill={palette(b.key)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" title={<Space><Wrench size={14} />{dimension === 'reason' ? '原因热力图' : dimension === 'tech' ? '技师热力图' : '模态热力图'} (重拍率)</Space>} style={{ marginBottom: 16 }}>
            {loading && !stats ? (
              <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
            ) : heatRows.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无热力数据" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {heatRows.map((b) => (
                  <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 90, fontSize: 12, color: '#475569', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
                    <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                      {[0, 1, 2, 3, 4].map((i) => {
                        const threshold = (i + 1) * 20
                        const active = b.rate >= threshold
                        const base = palette(b.key)
                        return (
                          <Tooltip key={i} title={`${b.label}: 重拍率 ${b.rate}%`}>
                            <div style={{
                              flex: 1, height: 26, borderRadius: 4,
                              background: active ? heatBg(b.rate) : 'var(--bg-deep)',
                              border: `1px solid ${active ? base : 'var(--border-color)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {i === 2 && <span style={{ fontSize: 10, fontWeight: 700, color: rateColor(b.rate) }}>{b.rate}%</span>}
                            </div>
                          </Tooltip>
                        )
                      })}
                    </div>
                    <span style={{ width: 96, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
                      {b.completed} 检 / {b.retakes} 重
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
                  低
                  {[0, 20, 40, 60, 80, 100].map((v) => (
                    <span key={v} style={{ width: 14, height: 12, borderRadius: 2, background: heatBg(v), border: '1px solid var(--border-color)' }} />
                  ))}
                  高 (重拍率阈值 0/20/40/60/80/100%)
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 数据源徽标 */}
      <Card size="small">
        <Space>
          <Database size={14} color={source === 'api' ? '#10b981' : '#f59e0b'} />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {source === 'api'
              ? '数据源: GET /worklist/retake-stats (后端聚合) · 维度 ' + (dimension === 'tech' ? '技师' : dimension === 'modality' ? '模态' : '原因')
              : '数据源: 演示回退 (接口不可用, 基于 seed 派生)'}
          </span>
        </Space>
      </Card>
    </div>
  )
}

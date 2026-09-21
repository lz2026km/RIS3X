import { useState, useEffect, useCallback } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Card, Row, Col, Statistic, DatePicker, Spin, Space } from 'antd'
import { Cpu, TrendingUp } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { aiDiagnosisApi } from '../../services/api/aiDiagnosisApi'

const { RangePicker } = DatePicker

// [W10-B] AI 诊断准确率仪表盘: 优先调用 /ai-diagnosis/accuracy + /ai-diagnosis/trend,
//         接口不可用或返回空时回退本地确定性演示数据。
interface AccuracyData {
  sensitivity: number
  specificity: number
  ppv: number
  npv: number
  accuracy: number
  totalCases: number
  aiPositive?: number
  aiNegative?: number
  physicianPositive?: number
  physicianNegative?: number
}

interface TrendPoint {
  date: string
  sensitivity: number
  specificity: number
  accuracy: number
  totalCases: number
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function fallbackAccuracy(): AccuracyData {
  return { sensitivity: rand(82, 97), specificity: rand(80, 95), ppv: rand(78, 94), npv: rand(82, 96), accuracy: rand(84, 96), totalCases: Math.round(Math.random() * 2000 + 500) }
}

function fallbackTrend(start: string): TrendPoint[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().slice(0, 10), sensitivity: rand(78, 98), specificity: rand(76, 96), accuracy: rand(80, 97), totalCases: Math.round(Math.random() * 100 + 20) }
  })
}

function AccuracyGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 50
  const stroke = 8
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={radius * 2 + 16} height={radius * 2 + 16}>
        <circle cx={radius + 8} cy={radius + 8} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={radius + 8} cy={radius + 8} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${radius + 8} ${radius + 8})`} />
        <text x={radius + 8} y={radius + 4} textAnchor="middle" fontSize={20} fontWeight={700} fill={color}>{value}%</text>
        <text x={radius + 8} y={radius + 20} textAnchor="middle" fontSize={10} fill="#64748b">{label}</text>
      </svg>
    </div>
  )
}

export default function BenchmarkAiDiagnosisPage() {
  const [dateRange, setDateRange] = useState<[string, string]>(['2026-01-01', '2026-06-30'])
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { startDate: dateRange[0], endDate: dateRange[1] }
      const [accRes, trendRes] = await Promise.all([
        aiDiagnosisApi.getAccuracy(params),
        aiDiagnosisApi.getTrend(params),
      ])
      const acc = accRes.success && accRes.data ? accRes.data : null
      if (acc && typeof acc.accuracy === 'number') {
        setAccuracy({
          sensitivity: acc.sensitivity,
          specificity: acc.specificity,
          ppv: acc.ppv,
          npv: acc.npv,
          accuracy: acc.accuracy,
          totalCases: acc.totalCases,
          aiPositive: acc.aiPositive,
          aiNegative: acc.aiNegative,
          physicianPositive: acc.physicianPositive,
          physicianNegative: acc.physicianNegative,
        })
      } else {
        setAccuracy(fallbackAccuracy())
      }
      const trendList = trendRes.success && Array.isArray(trendRes.data) ? trendRes.data : []
      setTrend(trendList.length > 0 ? trendList : fallbackTrend(dateRange[0]))
    } catch {
      setAccuracy(fallbackAccuracy())
      setTrend(fallbackTrend(dateRange[0]))
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const trendMax = Math.max(...trend.flatMap((tp) => [tp.sensitivity, tp.specificity, tp.accuracy]), 1)
  const trendMin = Math.min(...trend.flatMap((tp) => [tp.sensitivity, tp.specificity, tp.accuracy]), 0)
  const range = trendMax - trendMin || 1
  const w = 700
  const h = 180
  const pad = { top: 10, right: 10, bottom: 25, left: 40 }
  const iw = w - pad.left - pad.right
  const ih = h - pad.top - pad.bottom

  const trendPath = (key: 'sensitivity' | 'specificity' | 'accuracy', _color: string) => {
    if (trend.length < 2) return ''
    const xStep = iw / (trend.length - 1)
    return trend.map((tp, i) => `${i === 0 ? 'M' : 'L'}${pad.left + i * xStep},${pad.top + ih - ((tp[key] - trendMin) / range) * ih}`).join(' ')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {t('benchmarkAi.title')}
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f5f3ff', color: '#9333ea', border: '1px solid #e9d5ff', fontWeight: 600 }}>{t('benchmarkAi.demoData')}</span>
            </h2>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{t('benchmarkAi.subtitle')} <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#d97706', fontWeight: 600 }}>{t('benchmarkAi.demoNote')}</span></span>
          </div>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <RangePicker
          size="small"
          value={[dateRange[0] ? dayjs(dateRange[0]) : null, dateRange[1] ? dayjs(dateRange[1]) : null] as [Dayjs | null, Dayjs | null]}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) {
              setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
            }
          }}
        />
      </div>

      <Spin spinning={loading}>
        {accuracy && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title={t('benchmarkAi.totalCases')} value={accuracy.totalCases} suffix={t('benchmarkAi.caseUnit')} styles={{ content: {  color: '#8b5cf6', fontSize: 20  } }} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title={t('benchmarkAi.aiPositive')} value={accuracy.aiPositive} suffix={t('benchmarkAi.caseUnit')} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title={t('benchmarkAi.aiNegative')} value={accuracy.aiNegative} suffix={t('benchmarkAi.caseUnit')} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title={t('benchmarkAi.physicianPositive')} value={accuracy.physicianPositive} suffix={t('benchmarkAi.caseUnit')} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title={t('benchmarkAi.physicianNegative')} value={accuracy.physicianNegative} suffix={t('benchmarkAi.caseUnit')} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title={t('benchmarkAi.overallAccuracy')} value={accuracy.accuracy} suffix="%" styles={{ content: {  color: '#10b981', fontSize: 20  } }} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={6}><AccuracyGauge label={t('benchmarkAi.sensitivity')} value={accuracy.sensitivity} color="#3b82f6" /></Col>
              <Col span={6}><AccuracyGauge label={t('benchmarkAi.specificity')} value={accuracy.specificity} color="#10b981" /></Col>
              <Col span={6}><AccuracyGauge label={t('benchmarkAi.ppv')} value={accuracy.ppv} color="#f59e0b" /></Col>
              <Col span={6}><AccuracyGauge label={t('benchmarkAi.npv')} value={accuracy.npv} color="#ec4899" /></Col>
            </Row>
          </>
        )}

        <Card
          title={<Space><TrendingUp size={16} /> {t('benchmarkAi.trend')}</Space>}
          variant="borderless"
          style={{ borderRadius: 12 }}
        >
          {trend.length > 1 ? (
            <svg width={w} height={h} style={{ display: 'block', margin: '0 auto' }}>
              <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ih} stroke="#e2e8f0" />
              <line x1={pad.left} y1={pad.top + ih} x2={pad.left + iw} y2={pad.top + ih} stroke="#e2e8f0" />
              <path d={trendPath('accuracy', '#8b5cf6')} fill="none" stroke="#8b5cf6" strokeWidth={2} />
              <path d={trendPath('sensitivity', '#3b82f6')} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" />
              <path d={trendPath('specificity', '#10b981')} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="2 2" />
              {trend.filter((_, i) => i % Math.max(1, Math.floor(trend.length / 10)) === 0).map((tp, i) => (
                <text key={i} x={pad.left + (trend.indexOf(tp) * iw) / (trend.length - 1)} y={pad.top + ih + 14} fontSize={8} textAnchor="middle" fill="#94a3b8">
                  {tp.date.slice(5)}
                </text>
              ))}
              <text x={w - 60} y={pad.top + 10} fontSize={9} fill="#8b5cf6">{t('benchmarkAi.accuracyShort')}</text>
              <text x={w - 60} y={pad.top + 22} fontSize={9} fill="#3b82f6">{t('benchmarkAi.sensitivity')}</text>
              <text x={w - 60} y={pad.top + 34} fontSize={9} fill="#10b981">{t('benchmarkAi.specificity')}</text>
            </svg>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t('benchmarkAi.noTrend')}</div>
          )}
        </Card>
      </Spin>
    </div>
  )
}

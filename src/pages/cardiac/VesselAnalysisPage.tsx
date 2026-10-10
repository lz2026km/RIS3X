/**
 * G005 RIS v3.0.6.11-88 Wave6A - 血管分析工作台 (cardiac 域扩展)
 * 病例列表 (cardiacAiApi.listResults 真实) + 冠脉分段图 (简化 SVG 血管树 LAD/LCX/RCA)
 * + 狭窄/钙化列表 (vessel.segments 派生) + 数据源徽标 (真实/演示回退)
 * 注: cardiacAiApi 无独立 vessel 字段 → 从 stenosis 结果派生血管数据 (标注)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Select, Spin, Tag } from 'antd'
import { Activity, AlertTriangle, Heart, HeartPulse, RefreshCw, Stethoscope } from 'lucide-react'
import { cardiacAiApi, type CardiacAiResult, type CardiacStenosis } from '../../services/api/cardiacAiApi'
import { t } from '../../i18n/appI18n'
import { severityColor } from '../../theme/statusTokens'

// 演示回退数据 (仅当真实接口不可用时)
const DEMO_RESULTS: CardiacAiResult[] = [
  {
    id: 'cardiac-demo-1', studyId: 'STU-2001', patientName: '张伟', modality: 'CT',
    measurements: [
      { id: 'm1', studyId: 'STU-2001', parameter: '冠状动脉钙化积分', value: 286, unit: 'Agatston', normalRange: { min: 0, max: 100 }, abnormal: true },
    ],
    ejectionFraction: 61, lvVolume: 118, lvMass: 138, cadRads: '2',
    stenosis: [
      { vessel: 'LAD', segment: '近段', stenosisPercent: 65, severity: 'moderate', calcified: true },
      { vessel: 'LAD', segment: '中段', stenosisPercent: 30, severity: 'mild', calcified: true },
      { vessel: 'LCX', segment: '近段', stenosisPercent: 45, severity: 'mild', calcified: false },
      { vessel: 'RCA', segment: '中段', stenosisPercent: 80, severity: 'severe', calcified: true },
    ],
    overallAssessment: 'LAD 近段中重度狭窄, RCA 中段重度狭窄, 建议冠脉造影评估', recommendation: '心内科会诊, 必要时行 CAG',
    modelVersion: 'demo-v1', status: 'reviewed', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'cardiac-demo-2', studyId: 'STU-2002', patientName: '李芳', modality: 'CT',
    measurements: [
      { id: 'm2', studyId: 'STU-2002', parameter: '冠状动脉钙化积分', value: 96, unit: 'Agatston', normalRange: { min: 0, max: 100 }, abnormal: false },
    ],
    ejectionFraction: 65, lvVolume: 105, lvMass: 121, cadRads: '1',
    stenosis: [
      { vessel: 'LAD', segment: '近段', stenosisPercent: 25, severity: 'mild', calcified: true },
      { vessel: 'LCX', segment: '远段', stenosisPercent: 15, severity: 'mild', calcified: false },
    ],
    overallAssessment: '轻度冠脉粥样硬化, 无明显血流动力学意义狭窄', recommendation: '控制危险因素, 定期随访',
    modelVersion: 'demo-v1', status: 'auto', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'cardiac-demo-3', studyId: 'STU-2003', patientName: '王强', modality: 'CT',
    measurements: [],
    ejectionFraction: 58, lvVolume: 122, lvMass: 142, cadRads: '0',
    stenosis: [],
    overallAssessment: '未见明确冠状动脉狭窄', recommendation: '常规随访',
    modelVersion: 'demo-v1', status: 'confirmed', createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
]

// 血管树 SVG 布局 (简化: LAD 左前降支 / LCX 左旋支 / RCA 右冠)
const VESSEL_PATHS: Array<{ vessel: string; d: string; labelX: number; labelY: number }> = [
  { vessel: 'LM', d: 'M 300 120 C 260 150, 240 180, 240 210', labelX: 240, labelY: 100 },
  { vessel: 'LAD', d: 'M 240 210 C 250 270, 260 330, 250 400', labelX: 265, labelY: 280 },
  { vessel: 'LCX', d: 'M 240 210 C 200 240, 170 270, 150 330', labelX: 100, labelY: 330 },
  { vessel: 'RCA', d: 'M 360 120 C 400 180, 420 240, 410 360', labelX: 435, labelY: 200 },
]

const SEVERITY_COLOR: Record<string, string> = {
  normal: severityColor('normal'), mild: severityColor('warning'), moderate: severityColor('urgent'), severe: severityColor('critical'), occluded: severityColor('life_threatening'),
}

const SEVERITY_LABEL: Record<string, string> = {
  normal: t('vesselAnalysis.severityNormal'), mild: t('vesselAnalysis.severityMild'), moderate: t('vesselAnalysis.severityModerate'), severe: t('vesselAnalysis.severitySevere'), occluded: t('vesselAnalysis.severityOccluded'),
}

const STATUS_LABEL: Record<string, string> = {
  reviewed: t('vesselAnalysis.statusReviewed'), auto: t('vesselAnalysis.statusAuto'), confirmed: t('vesselAnalysis.statusConfirmed'),
}

function maxSeverity(lesions: CardiacStenosis[]): { pct: number; color: string } {
  let pct = 0
  for (const l of lesions) pct = Math.max(pct, l.stenosisPercent ?? 0)
  if (pct >= 90) return { pct, color: SEVERITY_COLOR.occluded! }
  if (pct >= 70) return { pct, color: SEVERITY_COLOR.severe! }
  if (pct >= 50) return { pct, color: SEVERITY_COLOR.moderate! }
  if (pct >= 25) return { pct, color: SEVERITY_COLOR.mild! }
  return { pct, color: SEVERITY_COLOR.normal! }
}

// 从 stenosis 派生: 每个 vessel 的病灶列表 + 钙化派生积分 (calcified 病灶 × 100, 标注)
// [Wave1B P2] 血管名归一化: 后端 vessel 名可能是中文 (如 '左前降支(LAD)') → 提取括号内缩写或映射中文名 → SVG 树键 (LAD/LCX/RCA/LM)
function normalizeVesselKey(name: string | undefined | null): string {
  const raw = (name ?? '').trim()
  if (!raw) return 'OTHER'
  const code = raw.match(/\(([A-Z]{2,4})\)/)
  if (code?.[1]) return code[1]
  const CN_MAP: Array<[string, string]> = [
    ['左前降支', 'LAD'], ['前降支', 'LAD'],
    ['左旋支', 'LCX'], ['左回旋支', 'LCX'], ['回旋支', 'LCX'], ['旋支', 'LCX'],
    ['右冠状动脉', 'RCA'], ['右冠', 'RCA'],
    ['左主干', 'LM'], ['左冠主干', 'LM'],
  ]
  for (const [cn, code2] of CN_MAP) {
    if (raw.includes(cn)) return code2
  }
  const upper = raw.toUpperCase()
  if (['LAD', 'LCX', 'RCA', 'LM'].includes(upper)) return upper
  return 'OTHER'
}

function deriveVessels(r: CardiacAiResult): Record<string, CardiacStenosis[]> {
  const map: Record<string, CardiacStenosis[]> = {}
  for (const s of r.stenosis ?? []) {
    const key = normalizeVesselKey(s.vessel)
    if (!map[key]) map[key] = []
    map[key].push(s)
  }
  return map
}

const VesselAnalysisPage: React.FC = () => {
  const [results, setResults] = useState<CardiacAiResult[]>([])
  const [dataSource, setDataSource] = useState<'real' | 'demo'>('demo')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await cardiacAiApi.listResults()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setResults(res.data)
        setDataSource('real')
        setSelectedId(res.data[0]?.id ?? '')
      } else {
        // 真实接口为空 → 演示回退
        setResults(DEMO_RESULTS)
        setDataSource('demo')
        setSelectedId(DEMO_RESULTS[0]?.id ?? '')
      }
    } catch (e) {
      setResults(DEMO_RESULTS)
      setDataSource('demo')
      setSelectedId(DEMO_RESULTS[0]?.id ?? '')
      setError((e as Error)?.message ?? t('vesselAnalysis.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => results.find((r) => r.id === selectedId) ?? results[0] ?? null, [results, selectedId])
  const vessels = useMemo(() => (selected ? deriveVessels(selected) : {}), [selected])
  const lesions = useMemo(() => selected?.stenosis ?? [], [selected])
  const calciumDerived = useMemo(() => {
    if (!selected) return 0
    return (selected.stenosis ?? []).filter((s) => s.calcified).length * 100
  }, [selected])
  const severeCount = useMemo(() => lesions.filter((l) => (l.stenosisPercent ?? 0) >= 70).length, [lesions])

  return (
    <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Heart size={22} color="#dc2626" /> {t('vesselAnalysis.title')}
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
              background: dataSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
              color: dataSource === 'real' ? '#16a34a' : '#1e40af',
              border: `1px solid ${dataSource === 'real' ? 'var(--color-success-border)' : 'var(--color-pending-border)'}` }}>
              {dataSource === 'real' ? t('vesselAnalysis.realData') : t('vesselAnalysis.demoData')}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('vesselAnalysis.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            style={{ width: 240 }}
            placeholder={t('vesselAnalysis.selectCase')}
            value={selectedId}
            onChange={setSelectedId}
            options={results.map((r) => ({ value: r.id, label: `${r.patientName} · ${r.studyId}` }))}
          />
          <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void load()}>{t('common.action.refresh')}</Button>
        </div>
      </div>

      {error && (
        <Alert style={{ marginBottom: 16 }} type="warning" showIcon
          title={t('vesselAnalysis.realUnavailable')}
          description={error}
          action={<Button size="small" icon={<RefreshCw size={14} />} onClick={() => void load()}>{t('vesselAnalysis.retry')}</Button>}
        />
      )}

      <Spin spinning={loading}>
        {!selected ? (
          <Empty description={t('vesselAnalysis.noCases')} style={{ padding: 60 }} image={<HeartPulse size={48} style={{ opacity: 0.4 }} />} />
        ) : (
          <>
            {/* KPI 行 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: t('vesselAnalysis.lesionCount'), value: String(lesions.length), color: '#ea580c', icon: AlertTriangle },
                { label: t('vesselAnalysis.severeStenosis'), value: String(severeCount), color: '#dc2626', icon: AlertTriangle },
                { label: t('vesselAnalysis.calciumScore'), value: String(calciumDerived), color: '#7c3aed', icon: Activity },
                { label: 'CAD-RADS', value: selected.cadRads ?? 'N', color: '#0891b2', icon: Stethoscope },
              ].map((k) => {
                const Icon = k.icon
                return (
                  <div key={k.label} style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${k.color}15`, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{k.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 16 }}>
              {/* 冠脉分段图: 简化 SVG 血管树 */}
              <Card title={t('vesselAnalysis.coronarySegments')} size="small" style={{ border: '1px solid var(--border-color)' }}>
                <svg viewBox="0 0 480 460" width="100%" style={{ background: 'var(--content-bg)', borderRadius: 10 }} data-testid="vessel-tree-svg">
                  {VESSEL_PATHS.map((v) => {
                    const vs = vessels[v.vessel] ?? []
                    const { pct, color } = maxSeverity(vs)
                    return (
                      <g key={v.vessel}>
                        <path d={v.d} fill="none" stroke={color} strokeWidth={pct >= 70 ? 9 : 7} strokeLinecap="round" opacity={vs.length === 0 ? 0.25 : 0.95} />
                        <circle cx={v.vessel === 'LM' ? 240 : v.vessel === 'RCA' ? 410 : v.vessel === 'LCX' ? 150 : 250} cy={v.vessel === 'LM' ? 210 : v.vessel === 'RCA' ? 360 : v.vessel === 'LCX' ? 330 : 400} r={6} fill={color} />
                        <text x={v.labelX} y={v.labelY} fill="#94a3b8" fontSize="14" fontWeight={600}>
                          {v.vessel}
                        </text>
                        <text x={v.labelX} y={v.labelY + 18} fill={color} fontSize="13" fontWeight={700}>
                          {vs.length > 0 ? `最重 ${pct}% (${vs.length} 处)` : t('vesselAnalysis.noLesion')}
                        </text>
                      </g>
                    )
                  })}
                  <circle cx={300} cy={90} r={34} fill="none" stroke="#64748b" strokeWidth={3} />
                  <text x={300} y={95} textAnchor="middle" fill="#94a3b8" fontSize="13">{t('vesselAnalysis.aorta')}</text>
                  <text x={240} y={440} fill="#64748b" fontSize="12">{t('vesselAnalysis.legend')}</text>
                </svg>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
                    <span key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 5, background: color }} /> {SEVERITY_LABEL[sev] ?? sev}
                    </span>
                  ))}
                </div>
              </Card>

              {/* 狭窄/钙化列表 (vessel.segments 派生) */}
              <Card title={`狭窄 / 钙化列表 (${lesions.length})`} size="small" style={{ border: '1px solid var(--border-color)' }}>
                {lesions.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('vesselAnalysis.noLesionCase')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflow: 'auto' }}>
                    {lesions.map((l, i) => {
                      const severityColor = SEVERITY_COLOR[l.severity] ?? '#64748b'
                      return (
                        <div key={`${l.vessel}-${l.segment}-${i}`} style={{ background: 'var(--content-bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{l.vessel} {l.segment}</span>
                            <Tag color="error" style={{ margin: 0 }}>{SEVERITY_LABEL[l.severity] ?? l.severity}</Tag>
                            {l.calcified && <Tag color="purple" style={{ margin: 0 }}>{t('vesselAnalysis.calcified')}</Tag>}
                            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: severityColor }}>{l.stenosisPercent}%</span>
                          </div>
                          <div style={{ marginTop: 6, height: 6, background: 'rgba(148,163,184,0.2)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${Math.min(100, l.stenosisPercent)}%`, background: severityColor, borderRadius: 3 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                  {t('vesselAnalysis.calciumNote')} · {t('vesselAnalysis.dataSource')}: {dataSource === 'real' ? t('vesselAnalysis.realResult') : t('vesselAnalysis.demoFallback')}
                </div>
              </Card>
            </div>

            {/* 病例总体评估 */}
            <Card title={t('vesselAnalysis.overallAssessment')} size="small" style={{ marginTop: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6 }}>
                <strong>{t('vesselAnalysis.findings')}</strong> {selected.overallAssessment || '--'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                <strong>{t('vesselAnalysis.recommendation')}</strong> {selected.recommendation || '--'}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag>{t('vesselAnalysis.model')} {selected.modelVersion}</Tag>
                <Tag color="blue">EF {selected.ejectionFraction ?? '--'}%</Tag>
                <Tag color="geekblue">{t('vesselAnalysis.status')} {STATUS_LABEL[selected.status] ?? selected.status}</Tag>
                <Tag>{new Date(selected.createdAt ?? '').toLocaleDateString('zh-CN')}</Tag>
              </div>
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}

export default VesselAnalysisPage

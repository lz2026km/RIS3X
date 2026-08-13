// [v3.0.6.11-54] Phase 2: DICOM Viewer Pro 独立页面 (真实 QIDO 检查/序列选择)
// [W2-2] 支持 URL 参数 ?studyUid=&examId= 直达指定检查 (报告书写页影像入口)
// [G005 v3.0.6.11-85 Wave 4B]
//   - G-12: AI 二次检出叠加阅片 (AI 结果开关 → aiDiagnosisApi.listResults → 视口检出标记 + Popover)
//   - G-17: Auto-hanging 落地 (挂片协议下拉/自动挂片 → 多视口布局 + 序列分配)
import DicomViewerProComponent from '../../components/dicom/DicomViewerPro'
import ViewerSelector from '../../components/common/ViewerSelector'
import { dicomWebApi, type DicomWebStudy, type DicomWebSeries } from '../../services/api/dicomApi'
import {
  Select, Space, Tag, Button, Spin, Alert, Empty, Row, Col, Typography, Segmented, message,
} from 'antd'
import { MonitorPlay, RefreshCw, Layers, User, CalendarDays, Brain, Wand2, LayoutGrid, X, PenLine } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { DICOM_SAMPLES, type DicomSample } from '../../data/dicomSamples'
import {
  HANGING_PROTOCOL_PRESETS, matchHangingProtocol, guessBodyPartFromDescription,
  type HangingProtocolPreset,
} from '../../constants/hangingProtocols'
import AiFindingsOverlay from '../../components/dicom/AiFindingsOverlay'
import { loadAiFindings, type AiFinding } from './aiFindings'

const { Text } = Typography

const MODALITY_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: 'CT', value: 'CT' },
  { label: 'MR', value: 'MR' },
  { label: 'DR', value: 'DR' },
  { label: 'CBCT', value: 'CBCT' },
  { label: 'MG', value: 'MG' },
]

/** 挂片网格中非主动视口的合成帧占位 (无真实影像时的视觉闭环) */
function SyntheticFrame() {
  return (
    <div
      style={{
        position: 'relative',
        width: '68%',
        height: '82%',
        borderRadius: 8,
        background: 'radial-gradient(circle at 50% 42%, #1b2a42 0%, #101a2e 55%, #0a1120 100%)',
      }}
    >
      <div style={{ position: 'absolute', left: '16%', top: '26%', width: '30%', height: '40%', borderRadius: '50%', background: 'radial-gradient(circle, #0f1c30 58%, rgba(15,28,48,0) 72%)' }} />
      <div style={{ position: 'absolute', right: '16%', top: '26%', width: '30%', height: '40%', borderRadius: '50%', background: 'radial-gradient(circle, #0f1c30 58%, rgba(15,28,48,0) 72%)' }} />
      <div style={{ position: 'absolute', left: '49%', top: '16%', width: 3, height: '66%', background: '#22354f' }} />
      <div style={{ position: 'absolute', left: '38%', bottom: '8%', width: '24%', height: 3, borderRadius: 2, background: '#22354f' }} />
    </div>
  )
}

/** 挂片视口单元: 序列分配 + 对应样本 */
interface HangingCell {
  sample?: DicomSample
  series?: DicomWebSeries
}

/** 已应用的挂片协议状态 */
interface HangingState {
  protocolId: string
  name: string
  rows: number
  cols: number
  cells: HangingCell[]
}

const DicomViewerProPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetStudyUid = searchParams.get('studyUid') ?? undefined
  const presetExamId = searchParams.get('examId') ?? undefined
  const [studies, setStudies] = useState<DicomWebStudy[]>([])
  const [seriesList, setSeriesList] = useState<DicomWebSeries[]>([])
  const [studyUid, setStudyUid] = useState<string>()
  const [seriesUid, setSeriesUid] = useState<string>()
  const [modality, setModality] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [loadingSeries, setLoadingSeries] = useState(false)
  const [error, setError] = useState('')
  const frameCount = 30

  const loadStudies = useCallback(async (mod = modality) => {
    setLoading(true)
    setError('')
    try {
      const res = await dicomWebApi.searchStudies(
        mod === 'ALL' ? { limit: 50 } : { Modality: mod, limit: 50 },
      )
      if (res.success) {
        const list = res.data ?? []
        setStudies(list)
        const matched =
          presetStudyUid
            ? list.find((s) => s.studyInstanceUID === presetStudyUid)
            : presetExamId
              ? list.find((s) => s.patientID === presetExamId || s.studyInstanceUID === presetExamId)
              : undefined
        const first = matched ?? list[0]
        if (first) {
          setStudyUid(first.studyInstanceUID)
        } else {
          setStudyUid(presetStudyUid ?? undefined)
          if (!presetStudyUid) setSeriesList([])
        }
      } else {
        setError(res.error?.message ?? '检查列表加载失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '检查列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [modality, presetStudyUid, presetExamId])

  useEffect(() => {
    void loadStudies()
  }, [loadStudies])

  const loadSeries = useCallback(async (uid: string) => {
    setLoadingSeries(true)
    try {
      const res = await dicomWebApi.searchSeries(uid)
      if (res.success) {
        const series = res.data ?? []
        setSeriesList(series)
        const first = series[0]
        if (first) setSeriesUid(first.seriesInstanceUID)
        else setSeriesUid(undefined)
      }
    } catch {
      setSeriesList([])
      setSeriesUid(undefined)
    } finally {
      setLoadingSeries(false)
    }
  }, [])

  useEffect(() => {
    if (studyUid) void loadSeries(studyUid)
    else {
      setSeriesList([])
      setSeriesUid(undefined)
    }
  }, [studyUid, loadSeries])

  const selectedStudy = useMemo(
    () => studies.find((s) => s.studyInstanceUID === studyUid),
    [studies, studyUid],
  )
  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.seriesInstanceUID === seriesUid),
    [seriesList, seriesUid],
  )

  const viewerHeight = typeof window !== 'undefined' ? window.innerHeight - 210 : 600

  // ───────────────────────── G-12: AI 二次检出叠加 ─────────────────────────
  // [G005 v3.0.6.11-86 Wave 4B (D)] CAD 页「去阅片叠加」入口 → ?ai=1 自动开启叠加
  const aiPresetOn = searchParams.get('ai') === '1'
  const [aiEnabled, setAiEnabled] = useState(aiPresetOn)
  const [aiFindings, setAiFindings] = useState<AiFinding[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSelected, setAiSelected] = useState<AiFinding | null>(null)

  const currentModality = selectedStudy?.modalitiesInStudy[0] ?? modality

  useEffect(() => {
    let cancelled = false
    if (!aiEnabled) {
      setAiFindings([])
      setAiSelected(null)
      setAiError('')
      return
    }
    setAiLoading(true)
    setAiError('')
    void loadAiFindings(selectedStudy, currentModality)
      .then((list) => {
        if (cancelled) return
        setAiFindings(list)
        setAiSelected(null)
        if (list.length === 0) setAiError('当前检查无 AI 检出结果 (可能无匹配模型)')
      })
      .catch(() => {
        if (!cancelled) setAiError('AI 检出加载失败')
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false)
      })
    return () => { cancelled = true }
  }, [aiEnabled, selectedStudy, currentModality])

  // ───────────────────────── G-17: Auto-hanging 挂片 ─────────────────────────
  const [hanging, setHanging] = useState<HangingState | null>(null)

  const hangSampleFor = useCallback((mod: string, index: number): DicomSample | undefined => {
    const pool = DICOM_SAMPLES.filter((s) => s.modality === mod)
    return pool[index % pool.length]
  }, [])

  const buildHanging = useCallback((preset: HangingProtocolPreset): HangingState | null => {
    if (!selectedStudy) return null
    const mod = selectedStudy.modalitiesInStudy[0] ?? 'CT'
    const total = preset.layout.rows * preset.layout.cols
    const cells: HangingCell[] = Array.from({ length: total }, (_, i) => {
      const order = preset.layout.seriesOrder?.[i]
      const series = order
        ? seriesList.find((s) => s.seriesDescription.includes(order) || order.includes(s.seriesDescription)) ?? seriesList[i]
        : seriesList[i]
      return { sample: hangSampleFor(mod, i), series }
    })
    // 主视口加载首个分配序列 (现有序列导航复用)
    const first = cells[0]?.series ?? seriesList[0]
    if (first) setSeriesUid(first.seriesInstanceUID)
    return { protocolId: preset.id, name: preset.name, rows: preset.layout.rows, cols: preset.layout.cols, cells }
  }, [selectedStudy, seriesList, hangSampleFor])

  // 检查/序列变化时按已选协议重建分配
  useEffect(() => {
    if (!hanging) return
    const preset = HANGING_PROTOCOL_PRESETS.find((p) => p.id === hanging.protocolId)
    if (preset) setHanging(buildHanging(preset))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyUid, seriesList])

  const applyProtocolById = useCallback((id: string) => {
    if (!id || id === 'none') {
      setHanging(null)
      return
    }
    const preset = HANGING_PROTOCOL_PRESETS.find((p) => p.id === id)
    if (preset) setHanging(buildHanging(preset))
  }, [buildHanging])

  const autoApplyHanging = useCallback(() => {
    const mod = selectedStudy?.modalitiesInStudy[0] ?? modality
    const bodyPart = guessBodyPartFromDescription(selectedStudy?.studyDescription)
    const preset = matchHangingProtocol(mod, bodyPart)
    if (!preset) {
      message.info('当前模态无匹配挂片协议')
      return
    }
    message.success(`已应用挂片协议: ${preset.name} (${preset.layout.rows}×${preset.layout.cols})`)
    setHanging(buildHanging(preset))
  }, [selectedStudy, modality, buildHanging])

  const hpOptions = useMemo(() => {
    const mod = selectedStudy?.modalitiesInStudy[0] ?? modality
    const bodyPart = guessBodyPartFromDescription(selectedStudy?.studyDescription)
    const suggestedId = matchHangingProtocol(mod, bodyPart)?.id ?? null
    return [
      { value: 'none', label: '无挂片 (单视口)' },
      ...HANGING_PROTOCOL_PRESETS.map((p) => ({
        value: p.id,
        label: (
          <span>
            {p.name} ({p.layout.rows}×{p.layout.cols})
            {p.id === suggestedId && <Tag color="green" style={{ marginLeft: 6 }}>推荐</Tag>}
          </span>
        ),
      })),
    ]
  }, [selectedStudy, modality])

  const multiViewport = !!hanging && hanging.rows * hanging.cols > 1
  const cellHeight = hanging ? (viewerHeight - (hanging.rows - 1) * 8) / hanging.rows : viewerHeight

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220' }}>
      <ViewerSelector current="pro" />
      <div style={{ padding: '8px 16px', background: '#101a30', borderBottom: '1px solid #1e2b45' }}>
        <Row gutter={[12, 8]} align="middle">
          <Col flex="auto">
            <Space size={12} wrap>
              <MonitorPlay size={18} color="#3b82f6" />
              <Text strong style={{ color: '#e2e8f0', fontSize: 15 }}>DICOM 专业版查看器</Text>
              <Segmented
                size="small"
                options={MODALITY_OPTIONS}
                value={modality}
                onChange={(v) => { setModality(String(v)); void loadStudies(String(v)) }}
              />
              <Select
                size="small"
                style={{ minWidth: 260 }}
                placeholder="选择检查"
                loading={loading}
                value={studyUid}
                onChange={(v) => setStudyUid(v)}
                options={studies.map((s) => ({
                  value: s.studyInstanceUID,
                  label: `${s.studyDescription} | ${s.patientName} (${s.patientID})`,
                }))}
              />
              <Select
                size="small"
                style={{ minWidth: 200 }}
                placeholder="选择序列"
                loading={loadingSeries}
                value={seriesUid}
                onChange={(v) => setSeriesUid(v)}
                options={seriesList.map((s) => ({
                  value: s.seriesInstanceUID,
                  label: `#${s.seriesNumber} ${s.seriesDescription} (${s.numberOfSeriesRelatedInstances}帧)`,
                }))}
              />
              <Button
                size="small"
                icon={<RefreshCw size={12} />}
                onClick={() => void loadStudies()}
                loading={loading}
              >
                刷新
              </Button>
              {/* G-12: AI 检出叠加开关 */}
              <Button
                size="small"
                type={aiEnabled ? 'primary' : 'default'}
                icon={<Brain size={12} />}
                onClick={() => setAiEnabled((v) => !v)}
                data-testid="ai-overlay-toggle"
              >
                AI 结果
              </Button>
              {/* G-17: 挂片协议选择 + 自动挂片 */}
              <Select
                size="small"
                style={{ minWidth: 190 }}
                placeholder="挂片协议"
                value={hanging?.protocolId ?? 'none'}
                onChange={applyProtocolById}
                options={hpOptions}
                data-testid="hp-select"
              />
              <Button
                size="small"
                icon={<Wand2 size={12} />}
                onClick={autoApplyHanging}
                data-testid="hp-auto-apply"
              >
                自动挂片
              </Button>
              {/* [G005 放射流程P0] 阅片→报告: 从当前 study 直达完整书写页 */}
              <Button
                size="small"
                type="primary"
                icon={<PenLine size={12} />}
                onClick={() => navigate(`/reports/v3-write?examId=${encodeURIComponent(presetExamId ?? selectedStudy?.patientID ?? '')}&studyUid=${encodeURIComponent(studyUid ?? '')}`)}
                data-testid="viewer-write-report"
              >
                写报告
              </Button>
            </Space>
          </Col>
          <Col>
            {selectedStudy && (
              <Space size={8} wrap>
                <Tag icon={<User size={10} />} style={{ color: '#93c5fd' }}>
                  {selectedStudy.patientName} · {selectedStudy.patientID}
                </Tag>
                <Tag icon={<CalendarDays size={10} />} style={{ color: '#93c5fd' }}>
                  {selectedStudy.studyDate}
                </Tag>
                <Tag icon={<Layers size={10} />} style={{ color: '#93c5fd' }}>
                  {selectedStudy.modalitiesInStudy.join('/')} · {selectedStudy.numberOfStudyRelatedSeries} 序列
                </Tag>
              </Space>
            )}
          </Col>
        </Row>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ margin: 12 }}
          message={error}
          action={<Button size="small" onClick={() => void loadStudies()}><RefreshCw size={14} /> 重试</Button>}
        />
      )}

      {aiEnabled && aiError && (
        <Alert type="warning" showIcon style={{ margin: '8px 16px 0' }} message={aiError} />
      )}

      <div style={{ padding: 8 }}>
        <Spin spinning={loading && studies.length === 0}>
          {studies.length === 0 && !loading ? (
            <Empty image={<Inbox size={56} style={{opacity:0.4}}/>} description="暂无检查数据" style={{ padding: 60, color: '#64748b' }} />
          ) : (
            <div style={{ position: 'relative' }} data-testid="pro-viewer-area">
              {multiViewport ? (
                <div
                  data-testid="hanging-grid"
                  style={{
                    display: 'grid',
                    gap: 8,
                    gridTemplateColumns: `repeat(${hanging!.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${hanging!.rows}, 1fr)`,
                    height: viewerHeight,
                  }}
                >
                  {hanging!.cells.map((cell, i) => (
                    i === 0 ? (
                      <DicomViewerProComponent
                        key={`hp-main-${studyUid}`}
                        height={cellHeight}
                        showThumbnails={false}
                        modality={currentModality}
                        sample={cell.sample}
                        elementId="hp-main-viewport"
                      />
                    ) : (
                      <div
                        key={`hp-tile-${i}-${cell.sample?.id ?? 'empty'}`}
                        data-testid="hanging-viewport-tile"
                        role="button"
                        tabIndex={0}
                        onClick={() => { if (cell.series) setSeriesUid(cell.series.seriesInstanceUID) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && cell.series) setSeriesUid(cell.series.seriesInstanceUID) }}
                        title={cell.series ? `点击在主动视口加载: ${cell.series.seriesDescription}` : '无匹配序列'}
                        style={{
                          position: 'relative',
                          background: '#0a0a0a',
                          borderRadius: 8,
                          overflow: 'hidden',
                          cursor: cell.series ? 'pointer' : 'default',
                          border: '1px solid #1e2b45',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <SyntheticFrame />
                        <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>
                          {i + 1}. {cell.series?.seriesDescription ?? '无匹配序列'}
                        </div>
                        <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, color: '#64748b' }}>
                          {cell.series?.numberOfSeriesRelatedInstances ?? 0} 帧
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <DicomViewerProComponent
                  height={viewerHeight}
                  showThumbnails
                  modality={currentModality}
                  key={`${studyUid}-${seriesUid ?? 'all'}`}
                />
              )}

              {/* G-12: AI 检出叠加层 (覆盖视口) */}
              {aiEnabled && (
                <AiFindingsOverlay
                  findings={aiFindings}
                  loading={aiLoading}
                  selected={aiSelected}
                  onSelect={setAiSelected}
                />
              )}

              {/* G-17: 挂片状态徽标 */}
              {hanging && (
                <div
                  data-testid="hanging-badge"
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(15,23,42,0.92)',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                >
                  <LayoutGrid size={12} color="#3b82f6" />
                  <span>挂片: <b>{hanging.name}</b> ({hanging.rows}×{hanging.cols})</span>
                  <button
                    onClick={() => setHanging(null)}
                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: 2 }}
                    aria-label="退出挂片"
                    data-testid="hp-exit"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </Spin>
      </div>

      {selectedSeries && (
        <div style={{ padding: '4px 16px 10px', color: '#64748b', fontSize: 12 }}>
          当前序列: {selectedSeries.seriesDescription} · 实例数 {selectedSeries.numberOfSeriesRelatedInstances} ·
          层厚 {selectedSeries.sliceThickness ?? '-'}mm · 帧数 {frameCount}
        </div>
      )}
    </div>
  )
}

export default DicomViewerProPage

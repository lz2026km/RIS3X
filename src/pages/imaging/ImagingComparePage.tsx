/**
 * [G005 v3.0.6.11-101 Wave 2A] 影像对比 (imaging-compare) 页
 * - 左侧: 患者检查选择 (多选序列组 → 创建 2-4 序列对比会话)
 * - 右侧: 2x2 对比视口 (每格独立选序列) + 同步控制条 + 差异面板
 * - 差异指标与后端 imaging-compare 模块像素算法一致 (确定性 seed 派生)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { message, Button, Checkbox, Input, Select, Switch, Tag, Tooltip, Table, Slider } from 'antd'
import {
  Columns2, GitCompare, Layers, Lock, LockOpen, MonitorUp, MousePointerClick, RotateCw, Sun, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react'
import { t } from '../../i18n/appI18n'
import {
  imagingCompareApi,
  type CompareSessionDto,
  type CompareSyncState,
  type DifferenceMetrics,
  type PatientListItem,
  type PatientStudyDto,
} from '../../services/api/imagingCompareApi'

const BLUE = '#3b82f6'
const CYAN = '#22d3ee'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'

interface ViewState { zoom: number; panX: number; panY: number }
interface WWL { ww: number; wl: number }
interface CellState {
  seriesInstanceUid: string | null
  label: string
  frame: number
  wwl: WWL
  view: ViewState
}
interface SessionOption { value: string; label: string; modality: string }

const CELL_LABELS = ['A', 'B', 'C', 'D']

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

const MODALITY_BASE: Record<string, number> = {
  CT: 240, PT: 120, MR: 380, DR: 210, US: 140, XA: 260,
}

/** 与后端 generatePixelMatrix 完全一致的确定性像素生成 (差异面板与视口吻合) */
function generatePixelMatrix(seedKey: string, size: number, modality: string): number[][] {
  const base = MODALITY_BASE[modality] ?? 200
  const data: number[][] = []
  const cy = size / 2
  const cx = size / 2
  const radial = 28 + hashString(`${seedKey}:r`) * 26
  const wobble = 3 + hashString(`${seedKey}:w`) * 4
  const freq = 0.02 + hashString(`${seedKey}:f`) * 0.012
  const phase = hashString(`${seedKey}:p`) * 3
  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      const a = Math.atan2(dy, dx)
      let v = base + Math.sin(d * freq) * 90
      v += Math.cos(a * wobble) * 34
      v += Math.sin(x * 0.05 + phase + y * 0.03) * 26
      if (modality === 'PT') v += 260 * Math.exp(-(d * d) / (2 * radial * radial))
      if (modality === 'MR') v += 120 * Math.sin(d * 0.03) * Math.cos(a * 2)
      row.push(Math.max(0, Math.min(4095, Math.round(v))))
    }
    data.push(row)
  }
  return data
}

function applyWWL(data: number[][], ww: number, wl: number): ImageData {
  const size = data.length
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2
  const min = wl - half
  const range = ww || 1
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = ((data[y]![x]! - min) / range) * 255
      v = Math.max(0, Math.min(255, Math.round(v)))
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = 255
    }
  }
  return imgData
}

const DEFAULT_WWL: WWL = { ww: 1200, wl: 400 }

function defaultView(): ViewState { return { zoom: 1, panX: 0, panY: 0 } }

function makeEmptyCell(): CellState {
  return { seriesInstanceUid: null, label: '未选择', frame: 0, wwl: { ...DEFAULT_WWL }, view: defaultView() }
}

/** 视口画布: 确定性像素 + WWL + 平移缩放, 支持点击选中激活 */
const CompareCell: React.FC<{
  cell: CellState
  active: boolean
  modality: string
  onActivate: () => void
  onWheel: (e: React.WheelEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  dragging: boolean
}> = ({ cell, active, modality, onActivate, onWheel, onMouseDown, onMouseMove, onMouseUp, dragging }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    ctx.clearRect(0, 0, w, h)
    if (!cell.seriesInstanceUid) {
      ctx.fillStyle = '#0a1120'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#334155'
      ctx.font = '13px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t('imagingCompare.cellEmpty'), w / 2, h / 2)
      ctx.textAlign = 'left'
      return
    }
    const pixels = generatePixelMatrix(`${cell.seriesInstanceUid}:s${cell.frame}`, 256, modality)
    const imgData = applyWWL(pixels, cell.wwl.ww, cell.wwl.wl)
    ctx.save()
    ctx.translate(w / 2 + cell.view.panX, h / 2 + cell.view.panY)
    ctx.scale(cell.view.zoom, cell.view.zoom)
    ctx.translate(-imgData.width / 2, -imgData.height / 2)
    ctx.putImageData(imgData, 0, 0)
    ctx.restore()
    ctx.fillStyle = 'rgba(2,6,23,0.75)'
    ctx.fillRect(4, 4, 210, 46)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px ui-monospace, monospace'
    ctx.fillText(cell.label, 10, 20)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`${modality}  S:${cell.frame}  WW:${cell.wwl.ww}  WL:${cell.wwl.wl}`, 10, 38)
    if (active) {
      ctx.strokeStyle = CYAN
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, w - 2, h - 2)
    }
    if (dragging) {
      ctx.strokeStyle = 'rgba(34,211,238,0.6)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w / 2, h)
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [cell, modality, active, dragging])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: active ? 'crosshair' : 'pointer', imageRendering: 'pixelated' }}
      onClick={onActivate}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  )
}

export default function ImagingComparePage() {
  // ── 患者/检查/序列选择 ──
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [patientKeyword, setPatientKeyword] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null)
  const [studies, setStudies] = useState<PatientStudyDto[]>([])
  const [studiesSource, setStudiesSource] = useState<'db' | 'seed'>('seed')
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set())
  const [sessionName, setSessionName] = useState('')

  // ── 会话 ──
  const [sessions, setSessions] = useState<CompareSessionDto[]>([])
  const [session, setSession] = useState<CompareSessionDto | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)

  // ── 同步控制 ──
  const [sync, setSync] = useState<CompareSyncState>({ panZoom: true, wwwl: true, frame: true })
  const [activeCell, setActiveCell] = useState(0)

  // ── 视口 ──
  const [cells, setCells] = useState<CellState[]>(() => [0, 1, 2, 3].map(makeEmptyCell))
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0, ww: 0, wl: 0 })

  // ── 差异面板 ──
  const [diffA, setDiffA] = useState<string | null>(null)
  const [diffB, setDiffB] = useState<string | null>(null)
  const [diffMetrics, setDiffMetrics] = useState<DifferenceMetrics | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const sessionOptions: SessionOption[] = useMemo(
    () => session?.seriesGroups.map((g) => ({ value: g.seriesInstanceUid, label: g.label, modality: g.modality })) ?? [],
    [session],
  )

  const allSeries = useMemo(() => {
    const list: { uid: string; label: string; modality: string; studyDate: string }[] = []
    for (const study of studies) {
      for (const s of study.series) {
        list.push({ uid: s.seriesInstanceUid, label: `${s.seriesDescription} (${s.instanceCount} 帧)`, modality: s.modality, studyDate: s.studyDate })
      }
    }
    return list
  }, [studies])

  // ── 数据加载 ──
  const loadPatients = useCallback(async (keyword?: string) => {
    const res = await imagingCompareApi.listPatients(keyword)
    if (res.success && Array.isArray(res.data)) setPatients(res.data)
  }, [])

  useEffect(() => { void loadPatients() }, [loadPatients])

  const loadSessions = useCallback(async () => {
    const res = await imagingCompareApi.listSessions()
    if (res.success && Array.isArray(res.data)) setSessions(res.data)
  }, [])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const handleSelectPatient = useCallback(async (patient: PatientListItem) => {
    setSelectedPatient(patient)
    setSelectedSeries(new Set())
    setSession(null)
    setDiffMetrics(null)
    setCells([0, 1, 2, 3].map(makeEmptyCell))
    const res = await imagingCompareApi.getPatientStudies(patient.patientId)
    if (res.success && res.data) {
      setStudies(res.data.studies)
      setStudiesSource(res.data.source)
      if (res.data.studies.length > 0) {
        const first = res.data.studies[0]!
        const firstSeries = first.series[0]
        if (firstSeries) {
          setCells(prev => {
            const next = [...prev]
            next[0] = {
              seriesInstanceUid: firstSeries.seriesInstanceUid,
              label: `${first.modality} · ${firstSeries.seriesDescription}`,
              frame: 0,
              wwl: { ...DEFAULT_WWL },
              view: defaultView(),
            }
            return next
          })
        }
      }
    }
  }, [])

  const handlePatientSearch = useCallback(async () => {
    await loadPatients(patientKeyword.trim() || undefined)
  }, [patientKeyword, loadPatients])

  const toggleSeries = useCallback((uid: string, checked: boolean) => {
    setSelectedSeries(prev => {
      const next = new Set(prev)
      if (checked) next.add(uid)
      else next.delete(uid)
      return next
    })
  }, [])

  const createSession = useCallback(async () => {
    if (!selectedPatient) {
      message.warning(t('imagingCompare.needPatient'))
      return
    }
    if (selectedSeries.size < 2 || selectedSeries.size > 4) {
      message.warning(t('imagingCompare.needSeries'))
      return
    }
    const groups: { seriesInstanceUid: string; label: string; modality: string }[] = []
    for (const item of allSeries) {
      if (selectedSeries.has(item.uid)) {
        const label = item.studyDate ? `${item.modality} ${item.studyDate.slice(5)}` : item.label
        groups.push({ seriesInstanceUid: item.uid, label, modality: item.modality })
      }
    }
    setSessionLoading(true)
    try {
      const res = await imagingCompareApi.createSession({
        patientId: selectedPatient.patientId,
        name: sessionName.trim() || undefined,
        seriesGroups: groups,
      })
      if (res.success && res.data) {
        setSession(res.data)
        setSync(res.data.sync)
        setCells(res.data.seriesGroups.map((g) => ({
          seriesInstanceUid: g.seriesInstanceUid,
          label: g.label,
          frame: 0,
          wwl: { ...DEFAULT_WWL },
          view: defaultView(),
        })))
        setDiffA(res.data.seriesGroups[0]?.seriesInstanceUid ?? null)
        setDiffB(res.data.seriesGroups[1]?.seriesInstanceUid ?? null)
        message.success(t('imagingCompare.sessionCreated'))
        await loadSessions()
      } else {
        message.error(res.error?.message ?? t('imagingCompare.sessionCreateFailed'))
      }
    } finally {
      setSessionLoading(false)
    }
  }, [selectedPatient, selectedSeries, sessionName, allSeries, loadSessions])

  const loadSession = useCallback(async (id: string) => {
    setSessionLoading(true)
    try {
      const [sRes, syncRes] = await Promise.all([
        imagingCompareApi.getSession(id),
        imagingCompareApi.getSyncState(id),
      ])
      const s = sRes.success && sRes.data ? sRes.data : null
      if (!s) {
        message.error(sRes.error?.message ?? t('imagingCompare.sessionLoadFailed'))
        return
      }
      setSession(s)
      setSync(syncRes.success && syncRes.data ? syncRes.data.sync : s.sync)
      setCells(s.seriesGroups.map((g) => ({
        seriesInstanceUid: g.seriesInstanceUid,
        label: g.label,
        frame: 0,
        wwl: { ...DEFAULT_WWL },
        view: defaultView(),
      })))
      setDiffA(s.seriesGroups[0]?.seriesInstanceUid ?? null)
      setDiffB(s.seriesGroups[1]?.seriesInstanceUid ?? null)
      setDiffMetrics(null)
      if (s.patientId) {
        const pRes = await imagingCompareApi.getPatientStudies(s.patientId)
        if (pRes.success && pRes.data) {
          setStudies(pRes.data.studies)
          setStudiesSource(pRes.data.source)
          setSelectedPatient(patients.find((p) => p.patientId === s.patientId) ?? null)
        }
      }
    } finally {
      setSessionLoading(false)
    }
  }, [patients])

  const deleteSession = useCallback(async (id: string) => {
    const res = await imagingCompareApi.deleteSession(id)
    if (res.success) {
      message.success(t('imagingCompare.sessionDeleted'))
      if (session?.id === id) {
        setSession(null)
        setDiffMetrics(null)
        setCells([0, 1, 2, 3].map(makeEmptyCell))
      }
      await loadSessions()
    } else {
      message.error(res.error?.message ?? t('imagingCompare.sessionDeleteFailed'))
    }
  }, [session, loadSessions])

  // ── 同步开关 ──
  const updateSync = useCallback(async (key: keyof CompareSyncState, value: boolean) => {
    setSync(prev => {
      const next = { ...prev, [key]: value }
      if (session) void imagingCompareApi.updateSyncState(session.id, { [key]: value })
      return next
    })
  }, [session])

  // ── 视口交互 ──
  const assignCellSeries = useCallback((index: number, uid: string) => {
    const option = sessionOptions.find((o) => o.value === uid)
    setCells(prev => {
      const next = [...prev]
      next[index] = {
        ...next[index]!,
        seriesInstanceUid: uid,
        label: option?.label ?? uid,
        wwl: { ...DEFAULT_WWL },
        view: defaultView(),
      }
      return next
    })
  }, [sessionOptions])

  const applyFrame = useCallback((delta: number) => {
    setCells(prev => prev.map((c, i) => {
      if (c.seriesInstanceUid === null) return c
      if (!sync.frame && i !== activeCell) return c
      const maxFrame = 127
      return { ...c, frame: Math.max(0, Math.min(maxFrame, c.frame + delta)) }
    }))
  }, [sync.frame, activeCell])

  const handleCellWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey) {
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      setCells(prev => prev.map((c, i) => {
        if (i !== activeCell && !sync.panZoom) return c
        return { ...c, view: { ...c.view, zoom: Math.max(0.2, Math.min(5, c.view.zoom * factor)) } }
      }))
      return
    }
    applyFrame(e.deltaY > 0 ? -1 : 1)
  }, [activeCell, sync.panZoom, applyFrame])

  const handleCellMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const cell = cells[activeCell]
    setDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      panX: cell?.view.panX ?? 0,
      panY: cell?.view.panY ?? 0,
      ww: cell?.wwl.ww ?? DEFAULT_WWL.ww,
      wl: cell?.wwl.wl ?? DEFAULT_WWL.wl,
    })
  }, [activeCell, cells])

  const handleCellMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (e.shiftKey) {
      setCells(prev => prev.map((c, i) => {
        if (i !== activeCell && !sync.panZoom) return c
        return { ...c, view: { ...c.view, panX: dragStart.panX + dx, panY: dragStart.panY + dy } }
      }))
    } else {
      setCells(prev => prev.map((c, i) => {
        if (i !== activeCell && !sync.wwwl) return c
        return { ...c, wwl: { ww: Math.max(100, dragStart.ww + dx), wl: Math.max(-1000, dragStart.wl + dy) } }
      }))
    }
  }, [dragging, dragStart, activeCell, sync.panZoom, sync.wwwl])

  const handleCellMouseUp = useCallback(() => setDragging(false), [])

  const zoomIn = useCallback(() => {
    setCells(prev => prev.map((c, i) => (i !== activeCell && !sync.panZoom ? c : { ...c, view: { ...c.view, zoom: Math.min(5, c.view.zoom * 1.2) } })))
  }, [activeCell, sync.panZoom])

  const zoomOut = useCallback(() => {
    setCells(prev => prev.map((c, i) => (i !== activeCell && !sync.panZoom ? c : { ...c, view: { ...c.view, zoom: Math.max(0.2, c.view.zoom / 1.2) } })))
  }, [activeCell, sync.panZoom])

  const resetView = useCallback(() => {
    setCells(prev => prev.map((c, i) => {
      if (i !== activeCell && !sync.panZoom && !sync.wwwl) return c
      return { ...c, wwl: { ...DEFAULT_WWL }, view: defaultView() }
    }))
  }, [activeCell, sync.panZoom, sync.wwwl])

  // ── 差异指标 ──
  const computeDifference = useCallback(async () => {
    if (!session || !diffA || !diffB) {
      message.warning(t('imagingCompare.needPair'))
      return
    }
    setDiffLoading(true)
    try {
      const activeFrame = cells[activeCell]?.frame ?? 0
      const res = await imagingCompareApi.computeDifference(session.id, { seriesA: diffA, seriesB: diffB, sliceIndex: activeFrame })
      if (res.success && res.data) setDiffMetrics(res.data)
      else message.error(res.error?.message ?? t('imagingCompare.diffFailed'))
    } finally {
      setDiffLoading(false)
    }
  }, [session, diffA, diffB, cells, activeCell])

  // 本地回退: 后端不可达时前端直接算 (算法与后端一致)
  const computeLocalDiff = useCallback(() => {
    if (!diffA || !diffB) return
    const activeFrame = cells[activeCell]?.frame ?? 0
    const mA = sessionOptions.find((o) => o.value === diffA)?.modality ?? 'CT'
    const mB = sessionOptions.find((o) => o.value === diffB)?.modality ?? 'CT'
    const a = generatePixelMatrix(`${diffA}:s${activeFrame}`, 256, mA)
    const b = generatePixelMatrix(`${diffB}:s${activeFrame}`, 256, mB)
    const bins = 64
    const min = Math.min(...a.flat(), ...b.flat())
    const max = Math.max(...a.flat(), ...b.flat())
    const range = max - min || 1
    const histA = new Array<number>(bins).fill(0)
    const histB = new Array<number>(bins).fill(0)
    let sumA = 0
    let sumB = 0
    let hot = 0
    const threshold = 24
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const va = a[y]![x]!
        const vb = b[y]![x]!
        sumA += va
        sumB += vb
        const binA = Math.min(bins - 1, Math.max(0, Math.floor(((va - min) / range) * bins)))
        const binB = Math.min(bins - 1, Math.max(0, Math.floor(((vb - min) / range) * bins)))
        histA[binA] = (histA[binA] ?? 0) + 1
        histB[binB] = (histB[binB] ?? 0) + 1
        if (Math.abs(va - vb) > threshold) hot += 1
      }
    }
    const n = 256 * 256
    const meanA = sumA / n
    const meanB = sumB / n
    let sqA = 0
    let sqB = 0
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const da = a[y]![x]! - meanA
        const db = b[y]![x]! - meanB
        sqA += da * da
        sqB += db * db
      }
    }
    const varianceA = sqA / n
    const varianceB = sqB / n
    let histDiff = 0
    const histogram = Array.from({ length: bins }, (_, b) => {
      histDiff += Math.abs(histA[b]! / n - histB[b]! / n)
      return { bin: b, value: Math.round((min + ((b + 0.5) / bins) * range) * 10) / 10, countA: histA[b]!, countB: histB[b]! }
    })
    setDiffMetrics({
      seriesA: diffA, seriesB: diffB, sliceIndex: activeFrame, width: 256, height: 256,
      pixelCount: n, meanA: Math.round(meanA * 100) / 100, meanB: Math.round(meanB * 100) / 100,
      meanDiff: Math.round((meanA - meanB) * 100) / 100,
      varianceA: Math.round(varianceA * 100) / 100, varianceB: Math.round(varianceB * 100) / 100,
      varianceDiff: Math.round((varianceA - varianceB) * 100) / 100,
      stdDevA: Math.round(Math.sqrt(varianceA) * 100) / 100, stdDevB: Math.round(Math.sqrt(varianceB) * 100) / 100,
      histogramDiff: Math.round((histDiff / 2) * 10000) / 10000,
      hotRegionRatio: Math.round((hot / n) * 10000) / 10000,
      threshold, changedPixelCount: hot, source: 'seed', histogram,
    })
  }, [diffA, diffB, sessionOptions, cells, activeCell])

  useEffect(() => {
    if (diffMetrics && session) {
      // 帧变化后自动刷新差异指标 (与视口同步)
      const timer = setTimeout(() => { void computeDifference() }, 600)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [cells, activeCell]) // eslint-disable-line react-hooks/exhaustive-deps

  const groupTypeTag = useMemo(() => {
    if (!session) return null
    const meta: Record<string, { color: string; label: string }> = {
      'multi-timepoint': { color: 'blue', label: t('imagingCompare.multiTimepoint') },
      'multi-series': { color: 'purple', label: t('imagingCompare.multiSeries') },
      'multi-modality': { color: 'cyan', label: t('imagingCompare.multiModality') },
    }
    const m = meta[session.groupType]
    return m ? <Tag color={m.color}>{m.label}</Tag> : null
  }, [session])

  const maxHistCount = useMemo(() => {
    if (!diffMetrics) return 1
    return Math.max(1, ...diffMetrics.histogram.map((h) => Math.max(h.countA, h.countB)))
  }, [diffMetrics])

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4,
    padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
  }

  return (
    <div data-testid="imaging-compare-page" style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      {/* ── 顶栏 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Columns2 size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('nav.imagingCompare')}</span>
        {groupTypeTag}
        <span style={{ fontSize: 11, color: '#64748b' }}>{t('imagingCompare.subtitle')}</span>
        <div style={{ flex: 1 }} />
        <Button size="small" onClick={() => { setPatientKeyword(''); void loadPatients() }}>{t('imagingCompare.refreshPatients')}</Button>
      </div>

      <div style={{ display: 'flex', gap: 10, height: 'calc(100vh - 150px)', minHeight: 480 }}>
        {/* ── 左: 患者/检查/序列选择 ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ background: PANEL_BG, borderRadius: 6, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              {t('imagingCompare.patientSelect')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Input
                size="small" placeholder={t('imagingCompare.patientSearchPlaceholder')}
                value={patientKeyword}
                onChange={(e) => setPatientKeyword(e.target.value)}
                onPressEnter={handlePatientSearch}
                style={{ flex: 1 }}
              />
              <Button size="small" onClick={handlePatientSearch}>{t('imagingCompare.search')}</Button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 170, overflowY: 'auto' }}>
              {patients.map((p) => (
                <button
                  key={p.patientId}
                  onClick={() => void handleSelectPatient(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer',
                    background: selectedPatient?.patientId === p.patientId ? '#3b82f622' : '#0f172a',
                    border: `1px solid ${selectedPatient?.patientId === p.patientId ? '#3b82f688' : '#334155'}`,
                    borderRadius: 6, padding: '6px 8px', color: '#cbd5e1', fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, color: CYAN }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>{p.patientId}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{p.studyCount}{t('imagingCompare.studyUnit')}</span>
                </button>
              ))}
              {patients.length === 0 && (
                <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: 8 }}>{t('imagingCompare.noPatient')}</div>
              )}
            </div>
          </div>

          {selectedPatient && (
            <div style={{ background: PANEL_BG, borderRadius: 6, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{t('imagingCompare.studyList')}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{selectedPatient.name}</span>
                <div style={{ flex: 1 }} />
                {studiesSource === 'seed' && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#ea580c22', color: '#ea580c', border: '1px solid #ea580c55' }}>{t('imagingCompare.seedData')}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {studies.map((study) => (
                  <div key={study.studyInstanceUid} style={{ background: '#0f172a', borderRadius: 6, padding: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag color="geekblue" style={{ marginRight: 0, fontSize: 10 }}>{study.modality}</Tag>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{study.bodyPart}</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{study.studyDate || study.accessionNumber}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                      {study.series.map((s) => (
                        <label key={s.seriesInstanceUid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, background: selectedSeries.has(s.seriesInstanceUid) ? '#22d3ee11' : 'transparent' }}>
                          <Checkbox
                            checked={selectedSeries.has(s.seriesInstanceUid)}
                            onChange={(e) => toggleSeries(s.seriesInstanceUid, e.target.checked)}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.seriesDescription}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{s.instanceCount}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {studies.length === 0 && (
                  <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: 12 }}>{t('imagingCompare.noStudy')}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Input
                  size="small" placeholder={t('imagingCompare.sessionNamePlaceholder')}
                  value={sessionName} onChange={(e) => setSessionName(e.target.value)} style={{ flex: 1 }}
                />
                <Button
                  size="small" type="primary" loading={sessionLoading}
                  disabled={selectedSeries.size < 2 || selectedSeries.size > 4}
                  onClick={() => void createSession()}
                >
                  {t('imagingCompare.createSession')}
                </Button>
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                {t('imagingCompare.seriesCount')}: {selectedSeries.size}/4
              </div>
            </div>
          )}

          <div style={{ background: PANEL_BG, borderRadius: 6, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
              {t('imagingCompare.sessionList')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11,
                    background: session?.id === s.id ? '#3b82f622' : '#0f172a',
                    border: `1px solid ${session?.id === s.id ? '#3b82f688' : '#334155'}`,
                    borderRadius: 6, padding: '6px 8px',
                  }}
                  onClick={() => void loadSession(s.id)}
                >
                  <GitCompare size={13} color={CYAN} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{s.patientName} · {s.seriesGroups.length} 序列</div>
                  </div>
                  <Tooltip title={t('imagingCompare.deleteSession')}>
                    <Button
                      size="small" type="text" danger
                      icon={<Trash2 size={12} />}
                      onClick={(e) => { e.stopPropagation(); void deleteSession(s.id) }}
                    />
                  </Tooltip>
                </div>
              ))}
              {sessions.length === 0 && (
                <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: 8 }}>{t('imagingCompare.noSession')}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── 右: 2x2 视口 + 同步控制条 + 差异面板 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {/* 同步控制条 */}
          <div style={{ background: PANEL_BG, borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {sync.panZoom && sync.wwwl && sync.frame ? <Lock size={13} color={BLUE} /> : <LockOpen size={13} color="#94a3b8" />}
              {t('imagingCompare.sync')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
              <MousePointerClick size={12} />
              {t('imagingCompare.panZoom')}
              <Switch size="small" checked={sync.panZoom} onChange={(v) => void updateSync('panZoom', v)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
              <Sun size={12} />
              {t('imagingCompare.wwwl')}
              <Switch size="small" checked={sync.wwwl} onChange={(v) => void updateSync('wwwl', v)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
              <Layers size={12} />
              {t('imagingCompare.frame')}
              <Switch size="small" checked={sync.frame} onChange={(v) => void updateSync('frame', v)} />
            </div>
            <div style={{ width: 1, height: 18, background: '#334155' }} />
            <Tooltip title={t('imagingCompare.zoomIn')}>
              <button style={btnStyle} onClick={zoomIn} aria-label={t('imagingCompare.zoomIn')}><ZoomIn size={12} /></button>
            </Tooltip>
            <Tooltip title={t('imagingCompare.zoomOut')}>
              <button style={btnStyle} onClick={zoomOut} aria-label={t('imagingCompare.zoomOut')}><ZoomOut size={12} /></button>
            </Tooltip>
            <Tooltip title={t('imagingCompare.resetView')}>
              <button style={btnStyle} onClick={resetView} aria-label={t('imagingCompare.resetView')}><RotateCw size={12} /></button>
            </Tooltip>
            <div style={{ width: 1, height: 18, background: '#334155' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {t('imagingCompare.slice')} {cells[activeCell]?.frame ?? 0}/127
              </span>
              <Slider
                min={0} max={127} value={cells[activeCell]?.frame ?? 0}
                onChange={(v) => setCells(prev => prev.map((c, i) => (i !== activeCell && !sync.frame ? c : { ...c, frame: v })))}
                style={{ flex: 1, margin: 0 }}
              />
            </div>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {t('imagingCompare.activeCell')}: {CELL_LABELS[activeCell]}
            </span>
          </div>

          {/* 2x2 视口 */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8, minHeight: 0 }}>
            {cells.map((cell, i) => {
              const option = sessionOptions.find((o) => o.value === cell.seriesInstanceUid)
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative', background: CARD_BG, borderRadius: 6, overflow: 'hidden',
                    border: `1px solid ${activeCell === i ? '#22d3ee88' : '#1e293b'}`,
                  }}
                >
                  {session && (
                    <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: '62%' }}>
                      <Select
                        size="small" variant="filled"
                        value={cell.seriesInstanceUid ?? undefined}
                        placeholder={`${CELL_LABELS[i]} · ${t('imagingCompare.selectSeries')}`}
                        options={sessionOptions}
                        onChange={(uid) => assignCellSeries(i, uid)}
                        style={{ width: '100%', fontSize: 11 }}
                        popupMatchSelectWidth={false}
                      />
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: activeCell === i ? CYAN : '#64748b',
                      background: '#020617cc', borderRadius: 4, padding: '2px 6px',
                    }}>
                      {CELL_LABELS[i]}
                    </span>
                    {option && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{option.modality}</Tag>}
                  </div>
                  <CompareCell
                    cell={cell}
                    modality={option?.modality ?? 'CT'}
                    active={activeCell === i}
                    onActivate={() => setActiveCell(i)}
                    onWheel={handleCellWheel}
                    onMouseDown={handleCellMouseDown}
                    onMouseMove={handleCellMouseMove}
                    onMouseUp={handleCellMouseUp}
                    dragging={dragging}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 差异面板 ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ background: PANEL_BG, borderRadius: 6, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MonitorUp size={14} color={CYAN} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{t('imagingCompare.diffPanel')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 24 }}>A</span>
                <Select
                  size="small" style={{ flex: 1 }} placeholder={t('imagingCompare.seriesA')}
                  value={diffA ?? undefined} options={sessionOptions}
                  onChange={(v) => { setDiffA(v); setDiffMetrics(null) }}
                  popupMatchSelectWidth={false}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 24 }}>B</span>
                <Select
                  size="small" style={{ flex: 1 }} placeholder={t('imagingCompare.seriesB')}
                  value={diffB ?? undefined} options={sessionOptions}
                  onChange={(v) => { setDiffB(v); setDiffMetrics(null) }}
                  popupMatchSelectWidth={false}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" type="primary" block loading={diffLoading} onClick={() => void computeDifference()}>
                  {t('imagingCompare.computeDiff')}
                </Button>
                <Button size="small" onClick={computeLocalDiff}>{t('imagingCompare.localFallback')}</Button>
              </div>
            </div>

            {diffMetrics && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{t('imagingCompare.hotRegion')}</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: diffMetrics.hotRegionRatio > 0.3 ? '#ef4444' : diffMetrics.hotRegionRatio > 0.1 ? '#facc15' : '#22c55e' }}>
                    {(diffMetrics.hotRegionRatio * 100).toFixed(2)}%
                  </span>
                  <div style={{ flex: 1 }} />
                  {diffMetrics.source === 'derived' ? (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#16a34a22', color: '#16a34a', border: '1px solid #16a34a55' }}>{t('imagingCompare.realData')}</span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#ea580c22', color: '#ea580c', border: '1px solid #ea580c55' }}>{t('imagingCompare.seedData')}</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                  {t('imagingCompare.changedPixels')}: {diffMetrics.changedPixelCount.toLocaleString()} / {diffMetrics.pixelCount.toLocaleString()} (S{diffMetrics.sliceIndex}, Δ&gt;{diffMetrics.threshold})
                </div>

                {/* 直方图差异 */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                    {t('imagingCompare.histogramDiff')}: <span style={{ color: CYAN }}>{diffMetrics.histogramDiff.toFixed(4)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 56, background: '#0f172a', borderRadius: 4, padding: '4px 2px' }}>
                    {diffMetrics.histogram.filter((_, i) => i % 2 === 0).map((h) => (
                      <div key={h.bin} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1 }}>
                        <div style={{ height: `${(h.countB / maxHistCount) * 100}%`, background: '#facc15aa', borderRadius: 1 }} />
                        <div style={{ height: `${(h.countA / maxHistCount) * 100}%`, background: '#3b82f6aa', borderRadius: 1 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 10, color: '#64748b' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#3b82f6', display: 'inline-block' }} /> A</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#facc15', display: 'inline-block' }} /> B</span>
                  </div>
                </div>

                {/* 统计表 */}
                <Table
                  size="small" pagination={false} rowKey="key"
                  dataSource={[
                    { key: 'mean', name: t('imagingCompare.mean'), a: diffMetrics.meanA.toFixed(1), b: diffMetrics.meanB.toFixed(1), diff: diffMetrics.meanDiff.toFixed(1) },
                    { key: 'variance', name: t('imagingCompare.variance'), a: diffMetrics.varianceA.toFixed(1), b: diffMetrics.varianceB.toFixed(1), diff: diffMetrics.varianceDiff.toFixed(1) },
                    { key: 'stddev', name: t('imagingCompare.stdDev'), a: diffMetrics.stdDevA.toFixed(1), b: diffMetrics.stdDevB.toFixed(1), diff: (diffMetrics.stdDevA - diffMetrics.stdDevB).toFixed(1) },
                    { key: 'hist', name: t('imagingCompare.histogramDiff'), a: '-', b: '-', diff: diffMetrics.histogramDiff.toFixed(4) },
                  ]}
                  columns={[
                    { title: '', dataIndex: 'name', width: 86, render: (v: string) => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span> },
                    { title: 'A', dataIndex: 'a', width: 64, render: (v: string) => <span style={{ fontSize: 11, color: '#3b82f6' }}>{v}</span> },
                    { title: 'B', dataIndex: 'b', width: 64, render: (v: string) => <span style={{ fontSize: 11, color: '#facc15' }}>{v}</span> },
                    { title: 'Δ', dataIndex: 'diff', render: (v: string) => <span style={{ fontSize: 11, fontWeight: 700, color: CYAN }}>{v}</span> },
                  ]}
                />
                <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                  {t('imagingCompare.diffHint')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 10, color: '#475569', textAlign: 'center' }}>
        {t('imagingCompare.hint')}
      </div>
    </div>
  )
}

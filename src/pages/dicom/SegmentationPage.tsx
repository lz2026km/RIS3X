// [v3.0.6.11-101 Wave 2C] 影像分割深化 — 分割工作台 (SegmentationPage v2)
// 5 算法选择 + 参数面板 (种子点模式点击选点) + mask 半透明彩色叠加 (标签/体积显示)
// + 分割结果管理 (切换显示/删除/改标签/器官分类) + 测量联动 (体积→等效球直径→病灶追踪)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, Row, Col, Select, InputNumber, Button, Tag, Spin, message, Empty, Slider, Space, Divider, Alert, Popconfirm, Modal, Input, Radio, Tooltip,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  Scan, Box, Activity, History, Trash2, Eye, EyeOff, PenLine, Ruler, MousePointerClick, Layers, Database, Boxes,
} from 'lucide-react'
import { volumeApi, type VolumeSeriesDto } from '../../services/api/volumeApi'
import {
  segmentationV2Api,
  decodeRle,
  extractPlaneMask,
  equivalentDiameterMm,
  type SegmentationV2Algorithm,
  type SegmentationV2SegmentDto,
  type SegmentSummaryDto,
  type SegmentationV2HistoryItemDto,
  type AlgorithmParams,
  type OrganClass,
  type ThresholdMode,
  type SeedPoint,
} from '../../services/api/segmentationV2Api'
import { decodeInt16Base64, decodeRgbaBase64, applyWWL, drawImageDataCentered } from './volumeReal'
import { PageContainer, StatCard, StatCardGrid, DataTable } from '../../components/common'
import { t } from '../../i18n/appI18n'

const ALGORITHMS: Array<{ value: SegmentationV2Algorithm; labelKey: string; color: string; descKey: string }> = [
  { value: 'region_grow', labelKey: 'segmentationV2.algo.region_grow', color: '#ff4d4f', descKey: 'segmentationV2.algoDesc.region_grow' },
  { value: 'threshold', labelKey: 'segmentationV2.algo.threshold', color: '#fa8c16', descKey: 'segmentationV2.algoDesc.threshold' },
  { value: 'edge_canny', labelKey: 'segmentationV2.algo.edge_canny', color: 'var(--color-primary-600)', descKey: 'segmentationV2.algoDesc.edge_canny' },
  { value: 'kmeans', labelKey: 'segmentationV2.algo.kmeans', color: '#722ed1', descKey: 'segmentationV2.algoDesc.kmeans' },
  { value: 'active_contour', labelKey: 'segmentationV2.algo.active_contour', color: '#52c41a', descKey: 'segmentationV2.algoDesc.active_contour' },
]

// [W-D7] 算法列表数据源 (label/desc 为 i18n key, render 时翻译)
interface AlgoListRow {
  key: string
  algoKey: SegmentationV2Algorithm
  labelKey: string
  descKey: string
  color: string
}
const ALGORITHM_LIST_ROWS: AlgoListRow[] = ALGORITHMS.map((a) => ({
  key: a.value,
  algoKey: a.value,
  labelKey: a.labelKey,
  descKey: a.descKey,
  color: a.color,
}))

const ORGAN_CLASSES: OrganClass[] = ['结节', '骨骼', '肝脏', '肺', '血管', '软组织', '其他']
const ORGAN_LABEL_KEYS: Record<string, string> = {
  '结节': 'w9dOrgan.nodule', '骨骼': 'w9dOrgan.bone', '肝脏': 'w9dOrgan.liver',
  '肺': 'w9dOrgan.lung', '血管': 'w9dOrgan.vessel', '软组织': 'w9dOrgan.softTissue', '其他': 'w9dOrgan.other',
}
const RELABEL_COLORS = ['#ff4d4f', '#fa8c16', '#52c41a', 'var(--color-primary-600)', '#722ed1', '#eb2f96', '#13c2c2', '#f5222d']
const PLANES: Array<{ value: 'axial' | 'sagittal' | 'coronal'; label: string }> = [
  { value: 'axial', label: 'axial' },
  { value: 'sagittal', label: 'sagittal' },
  { value: 'coronal', label: 'coronal' },
]
const organLabel = (k: string) => t(ORGAN_LABEL_KEYS[k] ?? k)

function blankImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  return ctx.createImageData(canvas.width, canvas.height)
}

interface OverlaySource {
  id: string
  label: string
  color: string
  volumeCm3: number
  mask3d: Uint8Array | null
  dims: { width: number; height: number; depth: number }
  sliceThickness: number
  pixelSpacing: [number, number]
}

/** 底层 MPR 灰度 + 多个分割掩码半透明彩色叠加 + 种子点选点 + 图例 (标签/体积) */
const SegmentationOverlayCanvas: React.FC<{
  jobId: string | null
  plane: 'axial' | 'sagittal' | 'coronal'
  index: number
  depth: number
  overlays: OverlaySource[]
  seed: SeedPoint | null
  pickMode: boolean
  onPick: (voxel: { x: number; y: number; z: number }) => void
  ww: number
  wl: number
}> = ({ jobId, plane, index, depth, overlays, seed, pickMode, onPick, ww, wl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgCacheRef = useRef<Map<string, ImageData>>(new Map())
  const baseDimsRef = useRef<{ width: number; height: number }>({ width: 512, height: 512 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cancelled = false

    const render = (img: ImageData) => {
      if (cancelled || !canvasRef.current) return
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const tmp = document.createElement('canvas')
      tmp.width = img.width
      tmp.height = img.height
      const tctx = tmp.getContext('2d')
      if (!tctx) return
      tctx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      const scale = Math.min(w / img.width, h / img.height)
      const ox = (w - img.width * scale) / 2
      const oy = (h - img.height * scale) / 2
      ctx.drawImage(tmp, ox, oy, img.width * scale, img.height * scale)

      // 分割掩码叠加 (半透明彩色)
      for (const ov of overlays) {
        if (!ov.mask3d) continue
        const planeMask = extractPlaneMask(ov.mask3d, ov.dims.width, ov.dims.height, ov.dims.depth, plane, index, ov.sliceThickness, ov.pixelSpacing)
        if (!planeMask) continue
        const color = ov.color
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)
        const ovImg = tctx.createImageData(planeMask.width, planeMask.height)
        for (let i = 0; i < planeMask.width * planeMask.height; i++) {
          if (planeMask.data[i]) {
            ovImg.data[i * 4] = r
            ovImg.data[i * 4 + 1] = g
            ovImg.data[i * 4 + 2] = b
            ovImg.data[i * 4 + 3] = 120
          }
        }
        tctx.putImageData(ovImg, 0, 0)
        ctx.drawImage(tmp, ox, oy, img.width * scale, img.height * scale)
      }

      // 种子点标记 (十字 + 圆圈)
      if (seed && plane === 'axial') {
        const px = ox + seed.x * scale
        const py = oy + seed.y * scale
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px, py, 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = '#ff4d4f'
        ctx.beginPath()
        ctx.moveTo(px - 12, py)
        ctx.lineTo(px + 12, py)
        ctx.moveTo(px, py - 12)
        ctx.lineTo(px, py + 12)
        ctx.stroke()
        ctx.fillStyle = '#ff4d4f'
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText(t('w9d.seg.seedLabel', { x: seed.x, y: seed.y, z: seed.z }), px + 14, py - 10)
      }

      // 图例: 标签 + 体积
      let ly = 12
      ctx.font = '12px sans-serif'
      for (const ov of overlays) {
        if (!ov.mask3d) continue
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        const text = `${ov.label} · ${ov.volumeCm3.toFixed(2)} cm³`
        ctx.fillRect(8, ly - 9, 6, 14)
        ctx.fillStyle = ov.color
        ctx.fillRect(10, ly - 7, 6, 10)
        ctx.fillStyle = '#fff'
        ctx.fillText(text, 22, ly + 2)
        ly += 18
      }
      if (pickMode) {
        ctx.fillStyle = '#faad14'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(t('w9d.seg.pickMode'), 10, canvas.height / devicePixelRatio - 10)
      }
    }

    const key = `${plane}:${index}:${ww}:${wl}`
    const cached = imgCacheRef.current.get(key)
    if (!jobId) {
      const img = cached ?? blankImage(512, 512)
      imgCacheRef.current.set(key, img)
      render(img)
      return
    }
    volumeApi.mprSlice(jobId, plane, index).then((res) => {
      if (!res.success || cancelled) return
      const pd = res.data.pixelData ?? {
        dataBase64: (res.data as { pixelDataBase64?: string }).pixelDataBase64 ?? '',
        bitsAllocated: 16,
        signed: true,
        width: res.data.dimensions?.width ?? 512,
        height: res.data.dimensions?.height ?? 512,
      }
      baseDimsRef.current = { width: pd.width, height: pd.height }
      const img = cached ?? (pd.dataBase64
        ? applyWWL(decodeInt16Base64(pd.dataBase64), pd.width, pd.height, ww, wl)
        : blankImage(512, 512))
      imgCacheRef.current.set(key, img)
      render(img)
    })
    return () => { cancelled = true }
  }, [jobId, plane, index, overlays, seed, pickMode, ww, wl])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pickMode) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const { width: imgW, height: imgH } = baseDimsRef.current
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    const scale = Math.min(w / imgW, h / imgH)
    const ox = (w - imgW * scale) / 2
    const oy = (h - imgH * scale) / 2
    const px = Math.floor((clickX - ox) / scale)
    const py = Math.floor((clickY - oy) / scale)
    if (px < 0 || px >= imgW || py < 0 || py >= imgH) return
    if (plane === 'axial') {
      onPick({ x: px, y: py, z: index })
    } else if (plane === 'sagittal') {
      const outH = Math.max(1, imgH)
      onPick({ x: index, y: px, z: Math.min(depth - 1, Math.max(0, Math.floor((py / outH) * depth))) })
    } else {
      const outH = Math.max(1, imgH)
      onPick({ x: px, y: index, z: Math.min(depth - 1, Math.max(0, Math.floor((py / outH) * depth))) })
    }
  }, [pickMode, plane, index, depth, onPick])

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', cursor: pickMode ? 'crosshair' : 'default' }}
    />
  )
}

const SegmentationPage: React.FC = () => {
  const [series, setSeries] = useState<VolumeSeriesDto[]>([])
  const [selectedUid, setSelectedUid] = useState<string>()
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobSource, setJobSource] = useState<'real' | 'synthetic' | null>(null)

  // 算法 + 参数
  const [algorithm, setAlgorithm] = useState<SegmentationV2Algorithm>('threshold')
  const [thMode, setThMode] = useState<ThresholdMode>('manual')
  const [thLo, setThLo] = useState<number | null>(40)
  const [thHi, setThHi] = useState<number | null>(160)
  const [seed, setSeed] = useState<SeedPoint | null>(null)
  const [pickMode, setPickMode] = useState(false)
  const [sigma, setSigma] = useState<number | null>(1)
  const [edgeLow, setEdgeLow] = useState<number | null>(null)
  const [edgeHigh, setEdgeHigh] = useState<number | null>(null)
  const [iterations, setIterations] = useState<number | null>(2)
  const [minVoxels, setMinVoxels] = useState<number | null>(null)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 结果管理
  const [list, setList] = useState<SegmentSummaryDto[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [details, setDetails] = useState<Map<string, SegmentationV2SegmentDto>>(new Map())
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string>()
  const [history, setHistory] = useState<SegmentationV2HistoryItemDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // [W-D7] 3D 后处理 (MPR/MIP/VR) — POST /volume/mpr|mip|vr
  const [postKind, setPostKind] = useState<'mpr' | 'mip' | 'vr' | null>(null)
  const [postLoading, setPostLoading] = useState(false)
  const [postInfo, setPostInfo] = useState<{ kind: 'mpr' | 'mip' | 'vr'; meta: Array<{ label: string; value: string }> } | null>(null)
  const [postImageData, setPostImageData] = useState<ImageData | null>(null)
  const postCanvasRef = useRef<HTMLCanvasElement>(null)

  // 显示
  const [plane, setPlane] = useState<'axial' | 'sagittal' | 'coronal'>('axial')
  const [sliceIndex, setSliceIndex] = useState(0)
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)

  // 标注 / 联动弹窗
  const [relabelOpen, setRelabelOpen] = useState(false)
  const [relabelTarget, setRelabelTarget] = useState<SegmentSummaryDto | null>(null)
  const [relabelForm, setRelabelForm] = useState<{ label: string; color: string; organClass: OrganClass }>({ label: '', color: '#ff4d4f', organClass: '结节' })
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<SegmentSummaryDto | null>(null)
  const [linkForm, setLinkForm] = useState<{ mode: 'existing' | 'new'; patientId: string; lesionId: string; sizeMm: number | null; notes: string }>({ mode: 'new', patientId: '', lesionId: '', sizeMm: null, notes: '' })
  const [linkLoading, setLinkLoading] = useState(false)

  useEffect(() => {
    volumeApi.series().then((res) => {
      if (res.success) setSeries(res.data)
    })
  }, [])

  const ensureJob = useCallback(async (uid: string): Promise<string | null> => {
    try {
      const res = await volumeApi.reconstruct(uid)
      if (res.success) {
        setJobId(res.data.jobId)
        setJobSource(res.data.source)
        return res.data.jobId
      }
    } catch { /* 忽略, 无底层图像 */ }
    setJobId(null)
    setJobSource(null)
    return null
  }, [])

  const refreshAll = useCallback(async (uid: string) => {
    setListLoading(true)
    setHistoryLoading(true)
    const [listRes, histRes] = await Promise.all([
      segmentationV2Api.list(uid),
      segmentationV2Api.history(uid),
    ])
    const items = listRes.success ? listRes.data : []
    setList(items)
    setHistory(histRes.success ? histRes.data : [])
    setVisibleIds(new Set(items.map((s) => s.id)))
    setSelectedId((prev) => (prev && items.some((s) => s.id === prev) ? prev : items[0]?.id))
    setListLoading(false)
    setHistoryLoading(false)
  }, [])

  const selectSeries = useCallback((uid: string) => {
    setSelectedUid(uid)
    setSeed(null)
    setPickMode(false)
    setSelectedId(undefined)
    setDetails(new Map())
    setSliceIndex(0)
    void ensureJob(uid)
    void refreshAll(uid)
  }, [ensureJob, refreshAll])

  const selected = useMemo(() => {
    if (!selectedId) return undefined
    return details.get(selectedId) ?? list.find((s) => s.id === selectedId)
  }, [selectedId, details, list])

  const selectedDetail = selected && 'rle3d' in selected ? selected as SegmentationV2SegmentDto : undefined

  // 可见分割详情 (含 3D 掩码) 预取
  useEffect(() => {
    if (!selectedUid) return
    const need = [...visibleIds].filter((id) => !details.has(id))
    if (need.length === 0) return
    let cancelled = false
    Promise.all(need.map((id) => segmentationV2Api.get(id))).then((results) => {
      if (cancelled) return
      setDetails((prev) => {
        const next = new Map(prev)
        for (const r of results) if (r.success) next.set(r.data.id, r.data)
        return next
      })
    })
    return () => { cancelled = true }
  }, [selectedUid, visibleIds, details])

  const handleRun = useCallback(async () => {
    if (!selectedUid) { message.warning(t('segmentationV2.selectSeriesFirst')); return }
    const params: AlgorithmParams = { minVoxels: minVoxels ?? undefined }
    if (algorithm === 'threshold') {
      params.thresholdMode = thMode
      if (thMode === 'otsu') {
        if (thHi !== null && thHi !== undefined) params.thresholdHi = thHi
      } else {
        if (thLo !== null && thLo !== undefined) params.thresholdLo = thLo
        if (thHi !== null && thHi !== undefined) params.thresholdHi = thHi
      }
    } else if (algorithm === 'region_grow') {
      if (thLo !== null && thLo !== undefined) params.thresholdLo = thLo
      if (thHi !== null && thHi !== undefined) params.thresholdHi = thHi
      params.seed = seed
    } else if (algorithm === 'edge_canny') {
      if (sigma !== null && sigma !== undefined) params.sigma = sigma
      if (edgeLow !== null && edgeLow !== undefined) params.edgeLow = edgeLow
      if (edgeHigh !== null && edgeHigh !== undefined) params.edgeHigh = edgeHigh
    } else if (algorithm === 'kmeans') {
      if (thLo !== null && thLo !== undefined) params.thresholdLo = thLo
      if (thHi !== null && thHi !== undefined) params.thresholdHi = thHi
      if (iterations !== null && iterations !== undefined) params.iterations = iterations
    } else if (algorithm === 'active_contour') {
      if (thLo !== null && thLo !== undefined) params.thresholdLo = thLo
      if (thHi !== null && thHi !== undefined) params.thresholdHi = thHi
      if (iterations !== null && iterations !== undefined) params.iterations = iterations
    }
    setRunning(true)
    setError(null)
    try {
      const res = await segmentationV2Api.run({ seriesUID: selectedUid, algorithm, params })
      if (!res.success) {
        setError(res.error?.message ?? t('segmentationV2.runFailed'))
        message.error(res.error?.message ?? t('segmentationV2.runFailed'))
        return
      }
      const seg = res.data
      if (!jobId) void ensureJob(selectedUid)
      setDetails((prev) => {
        const next = new Map(prev)
        next.set(seg.id, seg)
        return next
      })
      setSelectedId(seg.id)
      setSliceIndex(Math.round(seg.stats.bbox.z + seg.stats.bbox.d / 2))
      message.success(t('segmentationV2.runDone', { algo: seg.algorithmLabel, voxels: seg.stats.voxelCount.toLocaleString(), volume: seg.stats.volumeCm3.toFixed(2) }) + (seg.usedFallback ? t('segmentationV2.runFallback') : ''))
      void refreshAll(selectedUid)
    } catch (e) {
      setError((e as Error).message)
      message.error(t('segmentationV2.runError'))
    } finally {
      setRunning(false)
    }
  }, [selectedUid, algorithm, thMode, thLo, thHi, seed, sigma, edgeLow, edgeHigh, iterations, minVoxels, jobId, ensureJob, refreshAll])

  const toggleVisible = useCallback((id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const res = await segmentationV2Api.remove(id)
    if (res.success) {
      message.success(t('segmentationV2.deleted2'))
      setDetails((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      if (selectedUid) void refreshAll(selectedUid)
    } else {
      message.error(res.error?.message ?? t('segmentationV2.deleteFailed'))
    }
  }, [selectedUid, refreshAll])

  const openRelabel = useCallback((item: SegmentSummaryDto) => {
    setRelabelTarget(item)
    setRelabelForm({ label: item.label, color: item.color, organClass: item.organClass })
    setRelabelOpen(true)
  }, [])

  const handleRelabel = useCallback(async () => {
    if (!relabelTarget) return
    if (!relabelForm.label.trim()) { message.warning(t('segmentationV2.labelRequired')); return }
    const res = await segmentationV2Api.annotate(relabelTarget.id, relabelForm)
    if (res.success) {
      message.success(t('segmentationV2.labelUpdated'))
      setRelabelOpen(false)
      setDetails((prev) => {
        const next = new Map(prev)
        const old = next.get(relabelTarget.id)
        if (old) next.set(relabelTarget.id, { ...old, label: res.data.label, color: res.data.color, organClass: res.data.organClass })
        return next
      })
      if (selectedUid) void refreshAll(selectedUid)
    } else {
      message.error(res.error?.message ?? t('segmentationV2.updateFailed'))
    }
  }, [relabelTarget, relabelForm, selectedUid, refreshAll])

  const openLink = useCallback((item: SegmentSummaryDto) => {
    setLinkTarget(item)
    setLinkForm({ mode: 'new', patientId: '', lesionId: '', sizeMm: null, notes: '' })
    setLinkOpen(true)
  }, [])

  const handleLink = useCallback(async () => {
    if (!linkTarget) return
    setLinkLoading(true)
    try {
      const dto: { patientId?: string; lesionId?: string; sizeMm?: number; notes?: string } = {}
      if (linkForm.mode === 'new') {
        if (!linkForm.patientId.trim()) { message.warning(t('segmentationV2.patientIdRequired')); return }
        dto.patientId = linkForm.patientId.trim()
      } else {
        if (!linkForm.lesionId.trim()) { message.warning(t('segmentationV2.lesionIdRequired')); return }
        dto.lesionId = linkForm.lesionId.trim()
      }
      if (linkForm.sizeMm !== null && linkForm.sizeMm !== undefined && linkForm.sizeMm > 0) dto.sizeMm = linkForm.sizeMm
      if (linkForm.notes.trim()) dto.notes = linkForm.notes.trim()
      const res = await segmentationV2Api.linkMeasurement(linkTarget.id, dto)
      if (res.success) {
        const linked = res.data.linkedMeasurement
        message.success(t('segmentationV2.linkSuccess', { size: linked?.diameterMm ?? '—' }) + (linked?.lesionId ? t('segmentationV2.linkToLesionSuffix', { id: linked.lesionId }) : ''))
        setLinkOpen(false)
        setDetails((prev) => {
          const next = new Map(prev)
          next.set(linkTarget.id, res.data)
          return next
        })
        if (selectedUid) void refreshAll(selectedUid)
      } else {
        message.error(res.error?.message ?? t('segmentationV2.linkFailed'))
      }
    } catch {
      message.error(t('segmentationV2.linkError'))
    } finally {
      setLinkLoading(false)
    }
  }, [linkTarget, linkForm, selectedUid, refreshAll])

  const overlays = useMemo<OverlaySource[]>(() => {
    return list
      .filter((s) => visibleIds.has(s.id))
      .map((s) => {
        const det = details.get(s.id)
        return {
          id: s.id,
          label: s.label,
          color: s.color,
          volumeCm3: s.stats.volumeCm3,
          mask3d: det ? decodeRle(det.rle3d, det.dims.width * det.dims.height * det.dims.depth) : null,
          dims: det ? det.dims : { width: 512, height: 512, depth: 32 },
          sliceThickness: det?.sliceThickness ?? 5,
          pixelSpacing: det?.pixelSpacing ?? [0.7, 0.7],
        }
      })
  }, [list, visibleIds, details])

  const algoMeta = ALGORITHMS.find((a) => a.value === algorithm)

  const algoListColumns: TableColumnsType<AlgoListRow> = [
    {
      title: t('common.table.name'),
      dataIndex: 'labelKey',
      key: 'label',
      render: (v: unknown, r: AlgoListRow) => (
        <Space size={6}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
          {t(String(v))}
        </Space>
      ),
    },
    { title: t('common.table.type'), dataIndex: 'algoKey', key: 'algoKey', width: 130 },
    { title: t('common.table.description'), dataIndex: 'descKey', key: 'desc', render: (v: unknown) => t(String(v)) },
  ]
  const stats = selected ? (selected as SegmentSummaryDto).stats : null
  const planeTotal = useMemo(() => {
    if (!selectedDetail) return 1
    const { width: W, height: H, depth: D } = selectedDetail.dims
    if (plane === 'axial') return D
    if (plane === 'sagittal') return W
    return H
  }, [selectedDetail, plane])
  const clampedIndex = Math.max(0, Math.min(planeTotal - 1, sliceIndex))

  // [W-D7] 3D 后处理: MPR / MIP / VR → 后端重建结果预览 + 元数据
  const runPostProcessing = useCallback(
    async (kind: 'mpr' | 'mip' | 'vr') => {
      if (!selectedUid) {
        message.warning(t('segmentationV2.selectSeriesFirst'))
        return
      }
      let jid = jobId
      if (!jid) jid = await ensureJob(selectedUid)
      if (!jid) {
        message.warning(t('segmentationV2.selectSeriesFirst'))
        return
      }
      setPostKind(kind)
      setPostLoading(true)
      setPostInfo(null)
      setPostImageData(null)
      try {
        if (kind === 'mpr') {
          const res = await volumeApi.mprSlice(jid, plane, clampedIndex)
          if (!res.success) {
            message.error(res.error?.message ?? t('segmentationV2.runFailed'))
            return
          }
          const legacy = res.data as unknown as { pixelDataBase64?: string; width?: number; height?: number }
          const payload = res.data.pixelData ?? {
            dataBase64: legacy.pixelDataBase64 ?? '',
            width: legacy.width ?? res.data.dimensions?.width ?? 512,
            height: legacy.height ?? res.data.dimensions?.height ?? 512,
          }
          setPostInfo({
            kind,
            meta: [
              { label: t(`segmentationV2.plane.${plane}`), value: `${clampedIndex + 1}` },
              { label: t('segmentationV2.fldSource'), value: res.data.source ?? jobSource ?? '-' },
              { label: 'WW/WL', value: `${res.data.windowWidth ?? ww}/${res.data.windowLevel ?? wl}` },
              { label: 'px', value: `${payload.width}×${payload.height}` },
            ],
          })
          if (payload.dataBase64) setPostImageData(applyWWL(decodeInt16Base64(payload.dataBase64), payload.width, payload.height, ww, wl))
        } else if (kind === 'mip') {
          const res = await volumeApi.mipProjection(jid, plane)
          if (!res.success) {
            message.error(res.error?.message ?? t('segmentationV2.runFailed'))
            return
          }
          const legacy = res.data as unknown as { pixelDataBase64?: string; width?: number; height?: number }
          const payload = res.data.pixelData ?? {
            dataBase64: legacy.pixelDataBase64 ?? '',
            width: legacy.width ?? 512,
            height: legacy.height ?? 512,
          }
          setPostInfo({
            kind,
            meta: [
              { label: t(`segmentationV2.plane.${res.data.direction}`), value: t('dcm.mip') },
              { label: t('segmentationV2.fldSource'), value: res.data.source ?? jobSource ?? '-' },
              { label: 'WW/WL', value: `${res.data.windowWidth ?? ww}/${res.data.windowLevel ?? wl}` },
              { label: 'px', value: `${payload.width}×${payload.height}` },
            ],
          })
          if (payload.dataBase64) setPostImageData(applyWWL(decodeInt16Base64(payload.dataBase64), payload.width, payload.height, ww, wl))
        } else {
          const res = await volumeApi.vrImage(jid, { preset: 'softTissue' })
          if (!res.success) {
            message.error(res.error?.message ?? t('segmentationV2.runFailed'))
            return
          }
          const b64 = res.data.pixelData?.dataBase64 ?? (res.data as unknown as { pixelDataBase64?: string }).pixelDataBase64 ?? ''
          setPostInfo({
            kind,
            meta: [
              { label: t('dcm.vr'), value: t('vr.preset.softTissue') },
              { label: t('segmentationV2.fldSource'), value: res.data.source ?? jobSource ?? '-' },
              { label: 'px', value: `${res.data.width}×${res.data.height}` },
            ],
          })
          if (b64) setPostImageData(new ImageData(decodeRgbaBase64(b64), res.data.width, res.data.height))
        }
        message.success(t('common.success') + ` · ${kind.toUpperCase()}`)
      } catch (e) {
        message.error((e as Error).message || t('segmentationV2.runError'))
      } finally {
        setPostLoading(false)
      }
    },
    [selectedUid, jobId, ensureJob, plane, clampedIndex, ww, wl, jobSource],
  )

  useEffect(() => {
    const canvas = postCanvasRef.current
    if (!canvas || !postImageData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    canvas.width = w * devicePixelRatio
    canvas.height = h * devicePixelRatio
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    drawImageDataCentered(ctx, postImageData, w, h)
  }, [postImageData])

  return (
    <PageContainer padding={16}>
      <Space style={{ marginBottom: 'var(--space-3, 12px)' }} wrap>
        <Scan size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('segmentationV2.title')}</span>
        <Tag color="cyan">{t('segmentationV2.tagAlgos')}</Tag>
        <Tag color="geekblue">{t('segmentationV2.tagOtsu')}</Tag>
        <Tag color="purple">{t('segmentationV2.tagLink')}</Tag>
        {jobSource && <Tag color={jobSource === 'real' ? 'green' : 'default'}>{jobSource === 'real' ? t('segmentationV2.realDicom') : t('segmentationV2.synthetic')}</Tag>}
      </Space>

      <Row gutter={12}>
        <Col span={5}>
          <Card size="small" title={<Space><Activity size={14} /><span>{t('segmentationV2.paramsTitle')}</span></Space>} style={{ marginBottom: 'var(--space-3, 12px)' }}>
            <div style={{ marginBottom: 'var(--space-2, 8px)', fontWeight: 500 }}>{t('segmentationV2.seriesLabel')}</div>
            <Select
              style={{ width: '100%', marginBottom: 'var(--space-2, 8px)' }}
              placeholder={t('segmentationV2.selectSeries')}
              value={selectedUid}
              onChange={selectSeries}
              options={series.map((s) => {
                const slices = s.slices ?? (s as { sliceCount?: number }).sliceCount ?? 0
                const instances = s.instanceCount ?? slices
                const uid = s.seriesInstanceUid ?? (s as { seriesUid?: string }).seriesUid ?? ''
                return { value: uid, label: `${s.modality} ${s.rows}×${s.columns}×${slices} (${instances})` }
              })}
            />
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ marginBottom: 'var(--space-2, 8px)', fontWeight: 500 }}>{t('segmentationV2.algorithmLabel')}</div>
            <Select
              style={{ width: '100%', marginBottom: 6 }}
              value={algorithm}
              onChange={(v) => { setAlgorithm(v); setSeed(null); setPickMode(false) }}
              options={ALGORITHMS.map((a) => ({ value: a.value, label: t(a.labelKey) }))}
            />
            <Tag color={algoMeta?.color} style={{ marginBottom: 10 }}>{t(algoMeta?.descKey ?? '')}</Tag>

            {(algorithm === 'threshold' || algorithm === 'region_grow' || algorithm === 'active_contour' || algorithm === 'kmeans') && (
              <>
                {algorithm === 'threshold' && (
                  <>
                    <div style={{ marginBottom: 'var(--space-2, 8px)', fontWeight: 500 }}>{t('segmentationV2.thresholdMode')}</div>
                    <Radio.Group
                      size="small"
                      value={thMode}
                      onChange={(e) => setThMode(e.target.value as ThresholdMode)}
                      style={{ marginBottom: 'var(--space-2, 8px)' }}
                      options={[
                        { value: 'otsu', label: t('segmentationV2.otsu') },
                        { value: 'manual', label: t('segmentationV2.manual') },
                      ]}
                      optionType="button"
                    />
                  </>
                )}
                <div style={{ marginBottom: 'var(--space-2, 8px)', fontWeight: 500 }}>
                  {thMode === 'otsu' && algorithm === 'threshold' ? t('segmentationV2.otsuUpper') : t('segmentationV2.rangeLabel')}
                </div>
                <Space>
                  <InputNumber size="small" placeholder={t('segmentationV2.min')} value={thLo} onChange={(v) => setThLo(v ?? null)} style={{ width: 90 }} />
                  <span>~</span>
                  <InputNumber size="small" placeholder={t('segmentationV2.max')} value={thHi} onChange={(v) => setThHi(v ?? null)} style={{ width: 90 }} />
                </Space>
              </>
            )}

            {(algorithm === 'region_grow' || algorithm === 'active_contour') && (
              <>
                <div style={{ margin: '10px 0 8px', fontWeight: 500 }}>{t('segmentationV2.seedLabel')}</div>
                <Space wrap>
                  <Tooltip title={pickMode ? t('segmentationV2.pickHint') : t('segmentationV2.enablePick')}>
                    <Button
                      size="small"
                      type={pickMode ? 'primary' : 'default'}
                      icon={<MousePointerClick size={13} />}
                      onClick={() => setPickMode((p) => !p)}
                    >
                      {t('segmentationV2.clickPick')}
                    </Button>
                  </Tooltip>
                  <InputNumber size="small" placeholder="X" value={seed?.x ?? null} onChange={(v) => setSeed((s) => ({ x: v ?? 0, y: s?.y ?? 0, z: s?.z ?? 0 }))} style={{ width: 64 }} />
                  <InputNumber size="small" placeholder="Y" value={seed?.y ?? null} onChange={(v) => setSeed((s) => ({ x: s?.x ?? 0, y: v ?? 0, z: s?.z ?? 0 }))} style={{ width: 64 }} />
                  <InputNumber size="small" placeholder="Z" value={seed?.z ?? null} onChange={(v) => setSeed((s) => ({ x: s?.x ?? 0, y: s?.y ?? 0, z: v ?? 0 }))} style={{ width: 64 }} />
                </Space>
                {seed && <Tag color="red" style={{ marginTop: 6 }}>{t('segmentationV2.seedTag', { x: seed.x, y: seed.y, z: seed.z })}</Tag>}
                {algorithm === 'region_grow' && <div style={{ fontSize: 11, color: '#999', marginTop: 'var(--space-1, 4px)' }}>{t('segmentationV2.noSeedHint')}</div>}
              </>
            )}

            {algorithm === 'edge_canny' && (
              <>
                <div style={{ margin: '10px 0 8px', fontWeight: 500 }}>{t('segmentationV2.sigmaLabel')}</div>
                <Slider min={0} max={5} value={sigma ?? 1} onChange={(v) => setSigma(v)} />
                <div style={{ margin: '8px 0', fontWeight: 500 }}>{t('segmentationV2.edgeThreshold')}</div>
                <Space>
                  <InputNumber size="small" placeholder={t('segmentationV2.lowThreshold')} value={edgeLow} onChange={(v) => setEdgeLow(v ?? null)} style={{ width: 90 }} />
                  <InputNumber size="small" placeholder={t('segmentationV2.highThreshold')} value={edgeHigh} onChange={(v) => setEdgeHigh(v ?? null)} style={{ width: 90 }} />
                </Space>
              </>
            )}

            {(algorithm === 'kmeans' || algorithm === 'active_contour') && (
              <div style={{ margin: '10px 0 4px', fontWeight: 500 }}>
                {t('segmentationV2.iterations')} <InputNumber size="small" min={0} max={50} value={iterations ?? 2} onChange={(v) => setIterations(v ?? null)} style={{ width: 70, marginLeft: 'var(--space-2, 8px)' }} />
              </div>
            )}

            <div style={{ margin: '10px 0 4px', fontWeight: 500 }}>
              {t('segmentationV2.minVoxels')} <InputNumber size="small" min={0} value={minVoxels} onChange={(v) => setMinVoxels(v ?? null)} style={{ width: 90, marginLeft: 'var(--space-2, 8px)' }} placeholder={t('segmentationV2.noLimit')} />
            </div>

            <div style={{ marginTop: 14 }}>
              <Button type="primary" block loading={running} onClick={handleRun} icon={<Box size={14} />}>
                {running ? t('segmentationV2.running') : t('segmentationV2.run')}
              </Button>
            </div>
            {error && <Alert style={{ marginTop: 10 }} type="error" showIcon message={error} />}
          </Card>

          {/* [W-D7] 算法列表 (segmentation-v2 内置 5 算法) */}
          <Card
            size="small"
            title={<Space><Database size={14} /><span>{t('segmentationV2.algorithmLabel')}</span></Space>}
            extra={<Tag>{ALGORITHM_LIST_ROWS.length}</Tag>}
            style={{ marginBottom: 'var(--space-3, 12px)' }}
          >
            <DataTable<AlgoListRow>
              rowKey="key"
              dataSource={ALGORITHM_LIST_ROWS}
              columns={algoListColumns}
              pagination={false}
              showExport={false}
              showDensity={false}
              columnConfigKey="seg-algo-list"
              exportFileName="segmentation-algorithms"
            />
          </Card>

          <Card
            size="small"
            title={<Space><Layers size={14} /><span>{t('segmentationV2.resultsTitle')}</span></Space>}
            extra={<Tag>{list.length}</Tag>}
            style={{ marginBottom: 'var(--space-3, 12px)' }}
            styles={{ body: { padding: 'var(--space-2, 8px)', maxHeight: 420, overflowY: 'auto' } }}
          >
            <Spin spinning={listLoading}>
              {list.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('segmentationV2.noResults')} style={{ margin: '16px 0' }} />
              ) : (
                list.map((s) => {
                  const visible = visibleIds.has(s.id)
                  const isSelected = s.id === selectedId
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        padding: '6px 4px', borderBottom: '1px solid #f0f0f0', fontSize: 12, cursor: 'pointer',
                        background: isSelected ? '#e6f4ff' : undefined, borderRadius: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Space size={6} wrap>
                          <Tooltip title={visible ? t('segmentationV2.hideOverlay') : t('segmentationV2.showOverlay')}>
                            <Button aria-label="查看" size="small" type="text" icon={visible ? <Eye size={12} /> : <EyeOff size={12} />} onClick={(e) => { e.stopPropagation(); toggleVisible(s.id) }} />
                          </Tooltip>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                          <span style={{ fontWeight: 500 }}>{s.label}</span>
                          <Tag color={ALGORITHMS.find((a) => a.value === s.algorithm)?.color ?? '#999'} style={{ marginRight: 0 }}>{s.algorithmLabel}</Tag>
                          <Tag style={{ marginRight: 0 }}>{organLabel(s.organClass)}</Tag>
                        </Space>
                      </div>
                      <div style={{ color: '#666', marginTop: 2 }}>
                        {s.stats.voxelCount.toLocaleString()} vox · {s.stats.volumeCm3.toFixed(2)} cm³
                        {s.usedFallback && <Tag color="orange" style={{ marginLeft: 6 }}>{t('segmentationV2.fallback')}</Tag>}
                        {s.linkedMeasurement && <Tag color="purple" style={{ marginLeft: 6 }}>{t('segmentationV2.linked', { size: s.linkedMeasurement.diameterMm })}</Tag>}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginTop: 'var(--space-1, 4px)' }}>
                        <Button size="small" type="primary" ghost icon={<PenLine size={11} />} onClick={(e) => { e.stopPropagation(); openRelabel(s) }}>{t('segmentationV2.annotate')}</Button>
                        <Button size="small" icon={<Ruler size={11} />} onClick={(e) => { e.stopPropagation(); openLink(s) }}>{t('segmentationV2.linkMeasure')}</Button>
                        <Popconfirm
                          title={t('segmentationV2.deleteConfirm')}
                          description={t('segmentationV2.deleteDesc', { label: s.label, voxels: s.stats.voxelCount.toLocaleString() })}
                          okText={t('segmentationV2.delete')}
                          cancelText={t('segmentationV2.cancel')}
                          okButtonProps={{ danger: true }}
                          onConfirm={() => handleDelete(s.id)}
                        >
                          <Button aria-label="删除" size="small" type="text" danger icon={<Trash2 size={11} />} onClick={(e) => e.stopPropagation()} />
                        </Popconfirm>
                      </div>
                    </div>
                  )
                })
              )}
            </Spin>
          </Card>

          <Card size="small" title={<Space><History size={14} /><span>{t('segmentationV2.historyTitle')}</span></Space>} styles={{ body: { padding: 'var(--space-2, 8px)', maxHeight: 260, overflowY: 'auto' } }}>
            <Spin spinning={historyLoading}>
              {history.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('segmentationV2.noHistory')} style={{ margin: '12px 0' }} />
              ) : (
                history.map((h) => (
                  <div key={h.id} style={{ padding: '5px 4px', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                    <Space size={6} wrap>
                      <Tag color={ALGORITHMS.find((a) => a.value === h.algorithm)?.color ?? '#999'} style={{ marginRight: 0 }}>{ALGORITHMS.find((a) => a.value === h.algorithm) ? t(ALGORITHMS.find((a) => a.value === h.algorithm)!.labelKey) : h.algorithm}</Tag>
                      <Tag style={{ marginRight: 0 }}>{organLabel(h.organClass)}</Tag>
                      {h.status === 'active' ? <Tag color="success" style={{ marginRight: 0 }}>{t('segmentationV2.active')}</Tag> : <Tag style={{ marginRight: 0 }}>{t('segmentationV2.deleted')}</Tag>}
                    </Space>
                    <div style={{ color: '#666', marginTop: 2 }}>{h.voxelCount.toLocaleString()} vox · {h.volumeCm3.toFixed(2)} cm³</div>
                    <div style={{ color: '#999', fontSize: 11 }}>{new Date(h.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </Spin>
          </Card>

          {/* [W-D7] 分割/3D 接线 — MPR/MIP/VR 后处理 (POST /volume/mpr|mip|vr) */}
          <Card
            size="small"
            title={<Space><Boxes size={14} /><span>{t('nav.postProcessing')}</span></Space>}
            style={{ marginBottom: 'var(--space-3, 12px)' }}
          >
            <Space wrap style={{ marginBottom: 'var(--space-2, 8px)' }}>
              <Button
                size="small"
                icon={<Scan size={13} />}
                loading={postLoading && postKind === 'mpr'}
                onClick={() => void runPostProcessing('mpr')}
                data-testid="seg-mpr-btn"
              >
                {t('dcm.mpr')}
              </Button>
              <Button
                size="small"
                icon={<Layers size={13} />}
                loading={postLoading && postKind === 'mip'}
                onClick={() => void runPostProcessing('mip')}
                data-testid="seg-mip-btn"
              >
                {t('dcm.mip')}
              </Button>
              <Button
                size="small"
                icon={<Boxes size={13} />}
                loading={postLoading && postKind === 'vr'}
                onClick={() => void runPostProcessing('vr')}
                data-testid="seg-vr-btn"
              >
                {t('dcm.vr')}
              </Button>
            </Space>
            <Space wrap size={4}>
              <Tag>{t('segmentationV2.seriesLabel')}: {selectedUid ? `…${selectedUid.slice(-12)}` : '-'}</Tag>
              <Tag>{t('segmentationV2.fldSource')}: {jobSource ?? '-'}</Tag>
              {jobId && <Tag color="blue">jobId: …{jobId.slice(-10)}</Tag>}
            </Space>
            {postInfo && (
              <Space wrap size={4} style={{ marginTop: 'var(--space-2, 8px)' }}>
                {postInfo.meta.map((m) => (
                  <Tag key={m.label}>{m.label}: {m.value}</Tag>
                ))}
              </Space>
            )}
            <div style={{ marginTop: 'var(--space-2, 8px)', height: 220, background: '#0f172a', borderRadius: 6, position: 'relative' }}>
              <canvas
                ref={postCanvasRef}
                style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
                data-testid="seg-post-canvas"
              />
              {!postImageData && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {postLoading ? <Spin size="small" /> : t('segmentationV2.selectSeries')}
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col span={19}>
          {!selected ? (
            <Card>
              <Empty
                description={t('w9d.seg.emptyDesc')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          ) : (
            <>
              <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
                <StatCard title={t('segmentationV2.statVolume')} value={stats?.volumeCm3 ?? 0} precision={2} icon={<Box size={16} />} />
                <StatCard title={t('segmentationV2.statArea')} value={stats?.areaCm2 ?? 0} precision={1} />
                <StatCard title={t('segmentationV2.statMean')} value={stats?.meanIntensity ?? 0} precision={1} icon={<Activity size={16} />} />
                <StatCard title={t('segmentationV2.statBoundary')} value={stats?.boundaryPointCount ?? 0} />
                <StatCard title={t('segmentationV2.statVoxels')} value={stats?.voxelCount ?? 0} icon={<Boxes size={16} />} />
                <StatCard title={t('segmentationV2.statDiameter')} value={equivalentDiameterMm(stats?.volumeCm3 ?? 0)} precision={1} icon={<Ruler size={16} />} />
              </StatCardGrid>
              <Row gutter={12}>
                <Col span={16}>
                  <Card
                    size="small"
                    title={<Space><Scan size={14} /><span>{t('segmentationV2.sliceOverlay')}</span></Space>}
                    extra={
                      <Space>
                        <Select size="small" value={plane} onChange={setPlane} style={{ width: 90 }} options={PLANES.map((p) => ({ value: p.value, label: t(`segmentationV2.plane.${p.value}`) }))} />
                        <span style={{ fontSize: 11, color: '#999' }}>{t('segmentationV2.slice')}</span>
                        <Slider style={{ width: 160, display: 'inline-block' }} min={0} max={Math.max(0, planeTotal - 1)} value={clampedIndex} onChange={setSliceIndex} />
                        <span style={{ fontSize: 11, color: '#999' }}>{clampedIndex + 1}/{planeTotal}</span>
                      </Space>
                    }
                  >
                    <div style={{ height: 440, position: 'relative' }}>
                      <SegmentationOverlayCanvas
                        jobId={jobId}
                        plane={plane}
                        index={clampedIndex}
                        depth={selectedDetail?.dims.depth ?? 32}
                        overlays={overlays}
                        seed={seed}
                        pickMode={pickMode}
                        onPick={(v) => { setSeed(v); setPickMode(false); message.success(t('segmentationV2.seedSet', { x: v.x, y: v.y, z: v.z })) }}
                        ww={ww}
                        wl={wl}
                      />
                    </div>
                    <Space style={{ marginTop: 6 }} size="large" wrap>
                      <span style={{ fontSize: 11 }}>WW <Slider style={{ width: 110, display: 'inline-block' }} min={1} max={4000} value={ww} onChange={setWw} /></span>
                      <span style={{ fontSize: 11 }}>WL <Slider style={{ width: 110, display: 'inline-block' }} min={-1000} max={3000} value={wl} onChange={setWl} /></span>
                      <Tag icon={<Boxes size={11} />} color="blue">{t('segmentationV2.overlays', { count: overlays.length })}</Tag>
                      <Tag color={jobSource === 'real' ? 'green' : 'default'}>{jobSource === 'real' ? t('segmentationV2.realDicomShort') : t('segmentationV2.syntheticShort')}</Tag>
                    </Space>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title={<Space><Database size={14} /><span>{t('segmentationV2.detailTitle')}</span></Space>} styles={{ body: { maxHeight: 470, overflowY: 'auto' } }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                      <Tag color={ALGORITHMS.find((a) => a.value === selected.algorithm)?.color ?? '#999'}>{selected.algorithmLabel}</Tag>
                      <div><b>{t('segmentationV2.fldLabel')}</b>: {selected.label}</div>
                      <div><b>{t('segmentationV2.fldOrganClass')}</b>: <Tag>{organLabel(selected.organClass)}</Tag></div>
                      <div><b>{t('segmentationV2.fldSource')}</b>: {selected.source === 'real' ? t('segmentationV2.realDicomShort') : t('segmentationV2.syntheticFallback')} {selected.usedFallback && <Tag color="orange">{t('segmentationV2.fallback')}</Tag>}</div>
                      <div><b>{t('segmentationV2.fldBbox')}</b>: x{selected.stats.bbox.x} y{selected.stats.bbox.y} z{selected.stats.bbox.z} · {selected.stats.bbox.w}×{selected.stats.bbox.h}×{selected.stats.bbox.d}</div>
                      <div><b>{t('segmentationV2.fldIntensity')}</b>: {selected.stats.minIntensity} ~ {selected.stats.maxIntensity}</div>
                      <div><b>{t('segmentationV2.fldVolume')}</b>: {selected.stats.volumeCm3.toFixed(2)} cm³ · <b>{t('segmentationV2.fldArea')}</b>: {selected.stats.areaCm2.toFixed(2)} cm²</div>
                      {selectedDetail && (
                        <>
                          <Divider style={{ margin: '8px 0' }} />
                          <div style={{ fontWeight: 500, marginBottom: 'var(--space-1, 4px)' }}>{t('segmentationV2.params')}</div>
                          {Object.entries(selectedDetail.params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                            <div key={k} style={{ fontSize: 12, color: '#555' }}>
                              {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </div>
                          ))}
                          <Divider style={{ margin: '8px 0' }} />
                          <div style={{ fontWeight: 500, marginBottom: 'var(--space-1, 4px)' }}>{t('segmentationV2.measureLink')}</div>
                          {selectedDetail.linkedMeasurement ? (
                            <div style={{ fontSize: 12 }}>
                              <Tag color="purple">{t('segmentationV2.linkedTag')}</Tag>
                              <div>{t('segmentationV2.equivalentDiameter', { size: selectedDetail.linkedMeasurement.diameterMm })}</div>
                              <div>{t('segmentationV2.lesion', { id: selectedDetail.linkedMeasurement.lesionId ?? t('segmentationV2.localRecord') })}</div>
                              <div>{t('segmentationV2.date', { date: selectedDetail.linkedMeasurement.date })}</div>
                            </div>
                          ) : (
                            <Button size="small" icon={<Ruler size={12} />} onClick={() => openLink(selected as SegmentSummaryDto)}>{t('segmentationV2.linkToLesion')}</Button>
                          )}
                        </>
                      )}
                    </Space>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Col>
      </Row>

      <Modal
        title={<Space><PenLine size={14} /><span>{t('segmentationV2.annotateTitle')}</span></Space>}
        open={relabelOpen}
        onOk={handleRelabel}
        onCancel={() => setRelabelOpen(false)}
        okText={t('segmentationV2.save')}
        cancelText={t('segmentationV2.cancel')}
      >
        {relabelTarget && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldLabelName')}</div>
              <Input value={relabelForm.label} onChange={(e) => setRelabelForm((f) => ({ ...f, label: e.target.value }))} placeholder={t('segmentationV2.fldLabelPlaceholder')} />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldColor')}</div>
              <Space wrap>
                {RELABEL_COLORS.map((c) => (
                  <span
                    key={c}
                    onClick={() => setRelabelForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', display: 'inline-block',
                      boxShadow: relabelForm.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </Space>
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldOrgan')}</div>
              <Select
                style={{ width: '100%' }}
                value={relabelForm.organClass}
                onChange={(v) => setRelabelForm((f) => ({ ...f, organClass: v }))}
                options={ORGAN_CLASSES.map((o) => ({ value: o, label: organLabel(o) }))}
              />
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title={<Space><Ruler size={14} /><span>{t('segmentationV2.linkTitle')}</span></Space>}
        open={linkOpen}
        onOk={handleLink}
        onCancel={() => setLinkOpen(false)}
        okText={t('segmentationV2.link')}
        cancelText={t('segmentationV2.cancel')}
        confirmLoading={linkLoading}
      >
        {linkTarget && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type="info"
              showIcon
              message={`${linkTarget.label} · ${linkTarget.stats.volumeCm3.toFixed(2)} cm³`}
              description={t('segmentationV2.linkAlertDesc', { size: equivalentDiameterMm(linkTarget.stats.volumeCm3) })}
            />
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.linkMode')}</div>
              <Radio.Group
                value={linkForm.mode}
                onChange={(e) => setLinkForm((f) => ({ ...f, mode: e.target.value as 'existing' | 'new' }))}
                options={[
                  { value: 'new', label: t('segmentationV2.newLesion') },
                  { value: 'existing', label: t('segmentationV2.existingLesion') },
                ]}
                optionType="button"
              />
            </div>
            {linkForm.mode === 'new' ? (
              <div>
                <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldPatientId')}</div>
                <Input value={linkForm.patientId} onChange={(e) => setLinkForm((f) => ({ ...f, patientId: e.target.value }))} placeholder={t('segmentationV2.fldPatientIdPlaceholder')} />
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldLesionId')}</div>
                <Input value={linkForm.lesionId} onChange={(e) => setLinkForm((f) => ({ ...f, lesionId: e.target.value }))} placeholder={t('segmentationV2.fldLesionIdPlaceholder')} />
              </div>
            )}
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldSize')}</div>
              <InputNumber style={{ width: '100%' }} min={0} value={linkForm.sizeMm} onChange={(v) => setLinkForm((f) => ({ ...f, sizeMm: v ?? null }))} placeholder={t('segmentationV2.fldSizePlaceholder')} />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('segmentationV2.fldNotes')}</div>
              <Input value={linkForm.notes} onChange={(e) => setLinkForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('segmentationV2.fldNotesPlaceholder')} />
            </div>
          </Space>
        )}
      </Modal>
    </PageContainer>
  )
}

export default SegmentationPage

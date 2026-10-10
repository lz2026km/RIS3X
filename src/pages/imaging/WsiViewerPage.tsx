/**
 * G005 RIS v3.0.6.11-101 Wave 2B - 病理切片 WSI 全切片图像浏览与标注
 *
 * - 金字塔浏览: 层级切换 / 拖拽平移 / 滚轮缩放 / tile 拼接 (CSS grid 绝对定位)
 * - 标注工具: 矩形 / 圆形 / 多边形绘制, 颜色分类, 标签输入, 置信度
 * - 切片信息面板 (染色/分辨率/机构/放大倍数) + 缩略图导航 (Overview 定位)
 * - 后端: GET /pathology/* (backend/src/modules/pathology/); mock 模式或无后端时
 *   自动回退内置 seed + 客户端确定性瓦片生成, 页面始终可用。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import {
  Alert, Button, Card, Col, Descriptions, Empty, Input, Modal, Popconfirm, Radio, Row,
  Segmented, Select, Slider, Space, Spin, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  Circle as CircleIcon, Crosshair, Hexagon, Layers, Maximize, Minus, Move,
  Plus, RotateCcw, Square, Trash2,
} from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { currentApiMode } from '../../services/api/client'
import {
  wsiApi,
  type AnnotationKind,
  type CreateAnnotationDto,
  type PathologyAnnotation,
  type PathologyCaseSummary,
  type PathologyLevelMeta,
  type PathologySlideDetail,
  type PathologySlideSummary,
} from '../../services/api/wsiApi'

const { Text } = Typography

// ────────────────────────────────────────────────────────────────────────────
// i18n: 文案键位于 src/i18n/namespaces/w10WsiViewer.ts (前缀 w10Wsi.)
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// 内置演示数据 (mock / 后端不可用回退; 与后端 seed 一致)
// ────────────────────────────────────────────────────────────────────────────

interface DemoSeed {
  id: string
  patientId: string
  patientName: string
  stain: string
  stainLabel: string
  magnification: number
  institution: string
  levels: number
  width: number
  height: number
  specimen: string
  diagnosis: string
  status: 'pending' | 'reviewed' | 'reported'
  accessionNumber: string
}

const DEMO_SEED: DemoSeed[] = [
  { id: 'SL-2026-001', patientId: 'P00001', patientName: '张伟', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 40, institution: '汉东省人民医院 · 病理科', levels: 5, width: 8192, height: 6144, specimen: '胃窦活检', diagnosis: '低分化腺癌', status: 'reported', accessionNumber: 'ACC-20260701-001' },
  { id: 'SL-2026-002', patientId: 'P00002', patientName: '李娜', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 4096, height: 3000, specimen: '乳腺穿刺', diagnosis: '浸润性导管癌', status: 'reported', accessionNumber: 'ACC-20260702-018' },
  { id: 'SL-2026-003', patientId: 'P00003', patientName: '王芳', stain: 'IHC', stainLabel: '免疫组化 CK', magnification: 40, institution: '汉东省肿瘤医院 · 病理科', levels: 6, width: 16384, height: 12288, specimen: '结肠切除', diagnosis: '腺癌 CK 阳性', status: 'reviewed', accessionNumber: 'ACC-20260703-033' },
  { id: 'SL-2026-004', patientId: 'P00004', patientName: '赵敏', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 40, institution: '汉东省人民医院 · 病理科', levels: 5, width: 8192, height: 6144, specimen: '肺楔形切除', diagnosis: '鳞状细胞癌', status: 'pending', accessionNumber: 'ACC-20260704-052' },
  { id: 'SL-2026-005', patientId: 'P00005', patientName: '陈杰', stain: 'SS', stainLabel: '特殊染色 阿辛蓝-PAS', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 5120, height: 4096, specimen: '胃窦黏膜', diagnosis: '肠上皮化生', status: 'reported', accessionNumber: 'ACC-20260705-007' },
  { id: 'SL-2026-006', patientId: 'P00006', patientName: '刘洋', stain: 'FISH', stainLabel: 'FISH HER2', magnification: 40, institution: '汉东省肿瘤医院 · 病理科', levels: 5, width: 10240, height: 8192, specimen: '乳腺肿块', diagnosis: 'HER2 基因扩增', status: 'reviewed', accessionNumber: 'ACC-20260706-021' },
  { id: 'SL-2026-007', patientId: 'P00007', patientName: '孙丽', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 4096, height: 3072, specimen: '淋巴结活检', diagnosis: '反应性增生', status: 'pending', accessionNumber: 'ACC-20260707-044' },
  { id: 'SL-2026-008', patientId: 'P00008', patientName: '周强', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 10, institution: '汉东省人民医院 · 病理科', levels: 3, width: 2048, height: 2048, specimen: '皮肤肿物', diagnosis: '基底细胞癌', status: 'reported', accessionNumber: 'ACC-20260708-012' },
]

const DEMO_TILE_SIZE = 256

function makeLevelsMeta(width: number, height: number, levels: number, tileSize: number): PathologyLevelMeta[] {
  const out: PathologyLevelMeta[] = []
  for (let level = 0; level < levels; level++) {
    const w = Math.max(1, Math.ceil(width / Math.pow(2, level)))
    const h = Math.max(1, Math.ceil(height / Math.pow(2, level)))
    out.push({ level, width: w, height: h, tilesX: Math.ceil(w / tileSize), tilesY: Math.ceil(h / tileSize), tileSize })
  }
  return out
}

function demoSlides(): PathologySlideSummary[] {
  return DEMO_SEED.map((s) => ({
    id: s.id,
    caseId: `PC-${s.id.replace('SL-', '')}`,
    patientId: s.patientId,
    patientName: s.patientName,
    stain: s.stain,
    stainLabel: s.stainLabel,
    magnification: s.magnification,
    institution: s.institution,
    levels: s.levels,
    width: s.width,
    height: s.height,
    tileSize: DEMO_TILE_SIZE,
    scannedAt: `2026-07-01T09:30:00.000Z`,
    caseStatus: s.status,
  }))
}

function demoCase(s: DemoSeed): PathologyCaseSummary {
  return {
    id: `PC-${s.id.replace('SL-', '')}`,
    patientId: s.patientId,
    patientName: s.patientName,
    specimen: s.specimen,
    diagnosis: s.diagnosis,
    status: s.status,
    reportedAt: s.status === 'reported' ? `2026-07-01T14:00:00.000Z` : undefined,
    slideCount: 1,
    accessionNumber: s.accessionNumber,
  }
}

function demoDetail(id: string): PathologySlideDetail | null {
  const seed = DEMO_SEED.find((s) => s.id === id)
  if (!seed) return null
  const summary = demoSlides().find((s) => s.id === id)!
  return {
    ...summary,
    levelsMeta: makeLevelsMeta(seed.width, seed.height, seed.levels, DEMO_TILE_SIZE),
    case: demoCase(seed),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 客户端确定性瓦片生成 (mock / 后端失败回退; 与后端算法一致)
// ────────────────────────────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const SEED_HASH_CACHE = new Map<string, number>()

function seedHash(seed: string): number {
  let h = SEED_HASH_CACHE.get(seed)
  if (h === undefined) {
    h = fnv1a(seed)
    if (SEED_HASH_CACHE.size > 8192) SEED_HASH_CACHE.clear()
    SEED_HASH_CACHE.set(seed, h)
  }
  return h
}

function hashAt(seed: string, x: number, y: number): number {
  let h = seedHash(seed)
  h ^= (x | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2)
  h = Math.imul(h, 0x85ebca6b)
  h ^= (y | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2)
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function unitNoise(seed: string, x: number, y: number): number {
  return (hashAt(seed, x, y) % 1000) / 1000
}

function smoothNoise(seed: string, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const v00 = unitNoise(seed, x0, y0)
  const v10 = unitNoise(seed, x0 + 1, y0)
  const v01 = unitNoise(seed, x0, y0 + 1)
  const v11 = unitNoise(seed, x0 + 1, y0 + 1)
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = v00 + (v10 - v00) * sx
  const b = v01 + (v11 - v01) * sx
  return a + (b - a) * sy
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 与后端 pathology.service tilePixel 一致的 H&E 模拟组织学图案 (噪声种子绑定 slide+level) */
interface NoiseSeeds {
  t: string
  s: string
  e: string
  n: string
}

function tilePixel(seeds: NoiseSeeds, gx: number, gy: number): [number, number, number] {
  const tissue = smoothNoise(seeds.t, gx / 180, gy / 180)
  const inTissue = tissue > 0.42
  let r = 252
  let g = 249
  let b = 245
  if (inTissue) {
    const stroma = smoothNoise(seeds.s, gx / 36, gy / 36)
    r = 238 + Math.round((stroma - 0.5) * 40)
    g = 215 + Math.round((stroma - 0.5) * 34)
    b = 198 + Math.round((stroma - 0.5) * 30)
    const epi = smoothNoise(seeds.e, gx / 14, gy / 14)
    if (epi > 0.72) {
      const t = Math.min(1, (epi - 0.72) / 0.28)
      r = lerp(r, 226, t * 0.9)
      g = lerp(g, 182, t * 0.9)
      b = lerp(b, 196, t * 0.9)
    }
    const nuc = smoothNoise(seeds.n, gx / 5.5, gy / 5.5)
    if (nuc > 0.78) {
      const t = clamp01((nuc - 0.78) / 0.22)
      r = lerp(r, 92, t)
      g = lerp(g, 58, t)
      b = lerp(b, 112, t)
    }
  }
  return [Math.round(clamp01(r / 255) * 255), Math.round(clamp01(g / 255) * 255), Math.round(clamp01(b / 255) * 255)]
}

function makeFallbackTileUrl(slideId: string, level: number, x: number, y: number, tileSize: number): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = tileSize
    canvas.height = tileSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    const img = ctx.createImageData(tileSize, tileSize)
    const base = `${slideId}:${level}`
    const seeds: NoiseSeeds = { t: `${base}:t`, s: `${base}:s`, e: `${base}:e`, n: `${base}:n` }
    let i = 0
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        const [r, g, b] = tilePixel(seeds, x * tileSize + px, y * tileSize + py)
        img.data[i++] = r
        img.data[i++] = g
        img.data[i++] = b
        img.data[i++] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 小工具
// ────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const CATEGORIES = [
  { value: 'benign', color: '#52c41a' },
  { value: 'suspicious', color: '#faad14' },
  { value: 'malignant', color: '#ff4d4f' },
  { value: 'necrosis', color: '#722ed1' },
  { value: 'uncategorized', color: '#8c8c8c' },
]

const PALETTE = ['#ff4d4f', '#faad14', '#52c41a', '#1677ff', '#722ed1', '#eb2f96', '#13c2c2', '#fa541c']

interface ViewState {
  cx: number
  cy: number
  zoom: number
}

interface ToolButtonProps {
  active?: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function ToolButton({ active, icon, label, onClick }: ToolButtonProps) {
  return (
    <Tooltip title={label}>
      <Button
        type={active ? 'primary' : 'default'}
        size="small"
        icon={icon}
        onClick={onClick}
        aria-label={label}
        title={label}
      />
    </Tooltip>
  )
}

interface TileProps {
  slideId: string
  level: number
  x: number
  y: number
  tileSize: number
  edgeW: number
  edgeH: number
  scale: number
  left: number
  top: number
}

/** 单块瓦片: real 模式走后端 PNG blob; mock/失败 → 客户端确定性生成 */
function TileImg({ slideId, level, x, y, tileSize, edgeW, edgeH, scale, left, top }: TileProps) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    if (currentApiMode() === 'mock') {
      setSrc(makeFallbackTileUrl(slideId, level, x, y, tileSize))
      return
    }
    setSrc('')
    void wsiApi.getTile(slideId, level, x, y).then((r) => {
      if (alive) setSrc(r.ok ? r.url : makeFallbackTileUrl(slideId, level, x, y, tileSize))
    })
    return () => {
      alive = false
    }
  }, [slideId, level, x, y, tileSize])
  return (
    <img
      src={src || undefined}
      width={edgeW * scale}
      height={edgeH * scale}
      alt=""
      draggable={false}
      onError={() => setSrc(makeFallbackTileUrl(slideId, level, x, y, tileSize))}
      style={{
        position: 'absolute',
        left,
        top,
        backgroundColor: '#f5f0eb',
        userSelect: 'none',
      }}
    />
  )
}

interface OverviewCanvasProps {
  detail: PathologySlideDetail
  view: ViewState
  viewSize: { w: number; h: number }
  onNavigate: (cx: number, cy: number) => void
}

/** 缩略图导航: 最顶层金字塔拼接 + 当前视口矩形 + 点击定位 */
function OverviewCanvas({ detail, view, viewSize, onNavigate }: OverviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const level = detail.levels - 1
    const meta = detail.levelsMeta[level]
    if (!meta) return
    const MAX = 220
    const scale = Math.min(MAX / meta.width, MAX / meta.height, 1)
    const cw = Math.max(1, Math.round(meta.width * scale))
    const ch = Math.max(1, Math.round(meta.height * scale))
    canvas.width = cw
    canvas.height = ch
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, cw, ch)
    ctx.strokeStyle = '#d9d9d9'
    ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1)

    const load = (url: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = url
      })

    void (async () => {
      for (let ty = 0; ty < meta.tilesY; ty++) {
        for (let tx = 0; tx < meta.tilesX; tx++) {
          if (cancelled) return
          const tw = Math.min(meta.tileSize, meta.width - tx * meta.tileSize)
          const th = Math.min(meta.tileSize, meta.height - ty * meta.tileSize)
          let url = ''
          if (currentApiMode() === 'mock') {
            url = makeFallbackTileUrl(detail.id, level, tx, ty, meta.tileSize)
          } else {
            const r = await wsiApi.getTile(detail.id, level, tx, ty)
            url = r.ok ? r.url : makeFallbackTileUrl(detail.id, level, tx, ty, meta.tileSize)
          }
          if (cancelled || !url) continue
          const img = await load(url)
          if (!img) continue
          ctx.drawImage(img, tx * tw * scale, ty * th * scale, tw * scale, th * scale)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detail])

  const rectPct = useMemo(() => {
    if (!canvasRef.current || canvasRef.current.width === 0) return null
    const cw = canvasRef.current.width
    const ch = canvasRef.current.height
    const x0 = ((view.cx - viewSize.w / (2 * view.zoom)) / detail.width) * cw
    const y0 = ((view.cy - viewSize.h / (2 * view.zoom)) / detail.height) * ch
    const w = (viewSize.w / view.zoom / detail.width) * cw
    const h = (viewSize.h / view.zoom / detail.height) * ch
    return { left: `${clamp(x0 / cw, 0, 1) * 100}%`, top: `${clamp(y0 / ch, 0, 1) * 100}%`, width: `${(w / cw) * 100}%`, height: `${(h / ch) * 100}%` }
  }, [view, viewSize, detail])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const fx = clamp((e.clientX - rect.left) / (rect.width || 1), 0, 1)
    const fy = clamp((e.clientY - rect.top) / (rect.height || 1), 0, 1)
    onNavigate(fx * detail.width, fy * detail.height)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'crosshair' }}
      />
      {rectPct && (
        <div
          style={{
            position: 'absolute',
            border: '1.5px solid #fa541c',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
            ...rectPct,
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ marginTop: 'var(--space-1, 4px)', fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
        {t('w10Wsi.overview')} · {t('w10Wsi.levelLabel')} L{detail.levels - 1}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 主页面
// ────────────────────────────────────────────────────────────────────────────

const MAX_ZOOM = 32
const MIN_DRAW_PX = 2

type Tool = 'pan' | 'rect' | 'circle' | 'polygon'

interface DrawingState {
  kind: 'rect' | 'circle'
  start: [number, number]
  current: [number, number]
}

interface PendingAnnotation {
  kind: AnnotationKind
  points: number[]
  level: number
}

const WsiViewerPage: React.FC = () => {
  const [slides, setSlides] = useState<PathologySlideSummary[]>([])
  const [detail, setDetail] = useState<PathologySlideDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [backendOffline, setBackendOffline] = useState(false)
  // [v3.0.6.11-103 Wave 2B] 病例列表 (GET /pathology/cases) + 患者过滤
  const [cases, setCases] = useState<PathologyCaseSummary[]>([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [caseFilterPatientId, setCaseFilterPatientId] = useState<string | undefined>(undefined)
  const [view, setView] = useState<ViewState>({ cx: 0, cy: 0, zoom: 1 })
  const [tool, setTool] = useState<Tool>('pan')
  const [annotations, setAnnotations] = useState<PathologyAnnotation[]>([])
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const [polyPoints, setPolyPoints] = useState<number[]>([])
  const [polyHover, setPolyHover] = useState<[number, number] | null>(null)
  const [pendingAnn, setPendingAnn] = useState<PendingAnnotation | null>(null)
  const [editingAnn, setEditingAnn] = useState<PathologyAnnotation | null>(null)
  const [annLabel, setAnnLabel] = useState('')
  const [annCategory, setAnnCategory] = useState('uncategorized')
  const [annColor, setAnnColor] = useState('#ff4d4f')
  const [annConfidence, setAnnConfidence] = useState(0.9)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ sx: number; sy: number; v0: ViewState } | null>(null)
  const annSeqRef = useRef(0)

  const isMock = currentApiMode() === 'mock'

  // ── 容器尺寸 ──
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── 切片列表 ──
  const loadSlides = useCallback(async () => {
    setLoading(true)
    if (isMock) {
      const list = demoSlides()
      setSlides(caseFilterPatientId ? list.filter(s => s.patientId === caseFilterPatientId) : list)
      setBackendOffline(true)
      setLoading(false)
      return
    }
    const res = await wsiApi.listSlides(caseFilterPatientId ? { patientId: caseFilterPatientId } : undefined)
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      setSlides(res.data)
      setBackendOffline(false)
    } else {
      setSlides(demoSlides())
      setBackendOffline(true)
    }
    setLoading(false)
  }, [isMock, caseFilterPatientId])

  useEffect(() => {
    void loadSlides()
  }, [loadSlides])

  // [v3.0.6.11-103 Wave 2B] 病例列表 (GET /pathology/cases) + 按患者过滤切片
  const loadCases = useCallback(async () => {
    setCasesLoading(true)
    if (isMock) {
      const seen = new Map<string, PathologyCaseSummary>()
      for (const s of DEMO_SEED) {
        const existing = seen.get(s.patientId)
        const c = demoCase(s)
        if (existing) {
          seen.set(s.patientId, { ...existing, slideCount: existing.slideCount + 1 })
        } else {
          seen.set(s.patientId, c)
        }
      }
      setCases([...seen.values()])
      setCasesLoading(false)
      return
    }
    const res = await wsiApi.listCases()
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      setCases(res.data)
      setBackendOffline(false)
    } else {
      setCases([])
    }
    setCasesLoading(false)
  }, [isMock])

  useEffect(() => {
    void loadCases()
  }, [loadCases])

  const selectCase = useCallback((patientId: string) => {
    setCaseFilterPatientId((prev) => (prev === patientId ? undefined : patientId))
    setDetail(null)
    setAnnotations([])
  }, [])

  // ── 选择切片 → 详情 + 标注 ──
  const selectSlide = useCallback(async (id: string) => {
    setDetail(null)
    setAnnotations([])
    setTool('pan')
    setPolyPoints([])
    setDrawing(null)
    if (isMock) {
      setDetail(demoDetail(id))
      return
    }
    const [dRes, aRes] = await Promise.all([wsiApi.getSlide(id), wsiApi.listAnnotations(id)])
    if (dRes.success && dRes.data) {
      setDetail(dRes.data)
      setBackendOffline(false)
    } else {
      setDetail(demoDetail(id))
      setBackendOffline(true)
    }
    if (aRes.success && Array.isArray(aRes.data)) setAnnotations(aRes.data)
  }, [isMock])

  const currentSlideId = detail?.id ?? null

  // ── 视口: 初始适配 / 层级 ──
  const minZoom = detail ? 1 / Math.pow(2, detail.levels + 1) : 0.01

  useEffect(() => {
    if (!detail || size.w === 0 || size.h === 0) return
    const zoom = Math.min(size.w / detail.width, size.h / detail.height, 1)
    setView({ cx: detail.width / 2, cy: detail.height / 2, zoom: Math.max(zoom, minZoom) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, size.w, size.h])

  const level = useMemo(() => {
    if (!detail) return 0
    return clamp(Math.round(Math.log2(1 / view.zoom)), 0, detail.levels - 1)
  }, [detail, view.zoom])

  // ── 滚轮缩放 (非 passive 原生监听) ──
  useEffect(() => {
    const el = viewportRef.current
    if (!el || !detail) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25
      setView((v) => {
        const zoom = clamp(v.zoom * factor, minZoom, MAX_ZOOM)
        if (zoom === v.zoom) return v
        const cx = v.cx + (mx - rect.width / 2) * (1 / v.zoom - 1 / zoom)
        const cy = v.cy + (my - rect.height / 2) * (1 / v.zoom - 1 / zoom)
        return { cx, cy, zoom }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [detail, minZoom])

  const zoomBy = useCallback(
    (factor: number) => {
      setView((v) => ({ ...v, zoom: clamp(v.zoom * factor, minZoom, MAX_ZOOM) }))
    },
    [minZoom],
  )

  const fitView = useCallback(() => {
    if (!detail || size.w === 0 || size.h === 0) return
    const zoom = Math.min(size.w / detail.width, size.h / detail.height, 1)
    setView({ cx: detail.width / 2, cy: detail.height / 2, zoom: Math.max(zoom, minZoom) })
  }, [detail, size, minZoom])

  const setLevel = useCallback(
    (l: number) => {
      if (!detail) return
      const target = 1 / Math.pow(2, clamp(l, 0, detail.levels - 1))
      setView((v) => ({ ...v, zoom: clamp(target, minZoom, MAX_ZOOM) }))
    },
    [detail, minZoom],
  )

  // ── 坐标换算 ──
  const toLevel0 = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const el = viewportRef.current
      if (!el) return [0, 0]
      const rect = el.getBoundingClientRect()
      const vx = clientX - rect.left
      const vy = clientY - rect.top
      return [(vx - rect.width / 2) / view.zoom + view.cx, (vy - rect.height / 2) / view.zoom + view.cy]
    },
    [view],
  )

  const toScreen = useCallback(
    (x: number, y: number): [number, number] => [
      (x - view.cx) * view.zoom + size.w / 2,
      (y - view.cy) * view.zoom + size.h / 2,
    ],
    [view, size],
  )

  // ── 标注本地 CRUD + 后端同步 ──
  const upsertLocal = useCallback((ann: PathologyAnnotation) => {
    setAnnotations((prev) => {
      const idx = prev.findIndex((a) => a.id === ann.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = ann
        return next
      }
      return [...prev, ann]
    })
  }, [])

  const removeLocal = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const createAnnotation = useCallback(
    async (dto: CreateAnnotationDto) => {
      if (!detail) return
      const localId = `local-${Date.now()}-${annSeqRef.current++}`
      const now = new Date().toISOString()
      upsertLocal({
        id: localId,
        slideId: detail.id,
        kind: dto.kind,
        points: dto.points,
        label: dto.label,
        category: dto.category ?? 'uncategorized',
        color: dto.color ?? '#ff4d4f',
        confidence: dto.confidence,
        level: dto.level ?? 0,
        createdBy: 'wsi-user',
        createdAt: now,
        updatedAt: now,
      })
      if (isMock) return
      const res = await wsiApi.createAnnotation(detail.id, dto)
      if (res.success && res.data) {
        upsertLocal(res.data)
        setAnnotations((prev) => prev.filter((a) => a.id !== localId))
      } else {
        message.warning(t('w10Wsi.apiFailed'))
      }
    },
    [detail, isMock, upsertLocal],
  )

  const updateAnnotation = useCallback(
    async (id: string, patch: Partial<CreateAnnotationDto>) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)),
      )
      if (isMock) return
      const res = await wsiApi.updateAnnotation(id, patch)
      if (res.success && res.data) upsertLocal(res.data)
      else message.warning(t('w10Wsi.apiFailed'))
    },
    [isMock, upsertLocal],
  )

  const deleteAnnotation = useCallback(
    async (id: string) => {
      removeLocal(id)
      if (isMock) return
      const res = await wsiApi.deleteAnnotation(id)
      if (!res.success) message.warning(t('w10Wsi.apiFailed'))
    },
    [isMock, removeLocal],
  )

  // ── 绘制交互 ──
  const finishDraw = useCallback(
    (d: DrawingState) => {
      if (!detail) return
      const [x1, y1] = d.start
      const [x2, y2] = d.current
      let points: number[] = []
      if (d.kind === 'rect') {
        if (Math.abs(x2 - x1) < MIN_DRAW_PX && Math.abs(y2 - y1) < MIN_DRAW_PX) return
        points = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]
      } else {
        const r = Math.hypot(x2 - x1, y2 - y1)
        if (r < MIN_DRAW_PX) return
        points = [x1, y1, r]
      }
      setPendingAnn({ kind: d.kind, points, level: 0 })
    },
    [detail],
  )

  const finishPolygon = useCallback(() => {
    if (polyPoints.length < 6) return
    setPendingAnn({ kind: 'polygon', points: polyPoints, level: 0 })
    setPolyPoints([])
  }, [polyPoints])

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const [x, y] = toLevel0(e.clientX, e.clientY)
      if (tool === 'pan') {
        dragRef.current = { sx: e.clientX, sy: e.clientY, v0: view }
        return
      }
      if (tool === 'polygon') {
        setPolyPoints((p) => [...p, x, y])
        return
      }
      if (tool === 'rect' || tool === 'circle') {
        setDrawing({ kind: tool, start: [x, y], current: [x, y] })
      }
    },
    [tool, view, toLevel0],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragRef.current) {
        const d = dragRef.current
        setView(() => ({
          cx: d.v0.cx - (e.clientX - d.sx) / d.v0.zoom,
          cy: d.v0.cy - (e.clientY - d.sy) / d.v0.zoom,
          zoom: d.v0.zoom,
        }))
        return
      }
      if (drawing) {
        setDrawing((d) => (d ? { ...d, current: toLevel0(e.clientX, e.clientY) } : d))
        return
      }
      if (tool === 'polygon' && polyPoints.length > 0) {
        setPolyHover(toLevel0(e.clientX, e.clientY))
      }
    },
    [drawing, tool, polyPoints.length, toLevel0],
  )

  const endInteraction = useCallback(() => {
    if (drawing) finishDraw(drawing)
    dragRef.current = null
    setDrawing(null)
  }, [drawing, finishDraw])

  const onDoubleClick = useCallback(() => {
    if (tool === 'polygon') finishPolygon()
  }, [tool, finishPolygon])

  // ── 标注弹窗确认 ──
  const openCreateModal = useCallback(() => {
    setEditingAnn(null)
    setAnnLabel('')
    setAnnCategory('uncategorized')
    setAnnColor('#ff4d4f')
    setAnnConfidence(0.9)
  }, [])

  const openEditModal = useCallback((ann: PathologyAnnotation) => {
    setEditingAnn(ann)
    setAnnLabel(ann.label)
    setAnnCategory(ann.category)
    setAnnColor(ann.color)
    setAnnConfidence(ann.confidence ?? 0.9)
  }, [])

  const confirmAnnotationModal = useCallback(() => {
    if (!pendingAnn && !editingAnn) return
    const label = annLabel.trim()
    if (!label) {
      message.warning(t('w10Wsi.labelRequired'))
      return
    }
    const dto: CreateAnnotationDto = {
      kind: pendingAnn?.kind ?? editingAnn!.kind,
      points: pendingAnn?.points ?? editingAnn!.points,
      label,
      category: annCategory,
      color: annColor,
      confidence: annConfidence,
      level: pendingAnn?.level ?? editingAnn!.level,
    }
    if (editingAnn) {
      void updateAnnotation(editingAnn.id, dto)
      message.success(t('w10Wsi.updated'))
    } else {
      void createAnnotation(dto)
      message.success(t('w10Wsi.created'))
    }
    setPendingAnn(null)
    setEditingAnn(null)
  }, [pendingAnn, editingAnn, annLabel, annCategory, annColor, annConfidence, createAnnotation, updateAnnotation])

  const locateAnnotation = useCallback(
    (ann: PathologyAnnotation) => {
      const pts = ann.points
      let cx = 0
      let cy = 0
      if (ann.kind === 'circle') {
        cx = pts[0] ?? 0
        cy = pts[1] ?? 0
      } else if (ann.kind === 'rect') {
        cx = ((pts[0] ?? 0) + (pts[2] ?? 0)) / 2
        cy = ((pts[1] ?? 0) + (pts[3] ?? 0)) / 2
      } else {
        let sx = 0
        let sy = 0
        for (let i = 0; i + 1 < pts.length; i += 2) {
          sx += pts[i] ?? 0
          sy += pts[i + 1] ?? 0
        }
        cx = sx / Math.max(1, pts.length / 2)
        cy = sy / Math.max(1, pts.length / 2)
      }
      setView((v) => ({ ...v, cx, cy, zoom: Math.max(v.zoom, 1) }))
    },
    [],
  )

  // ── 瓦片集合 ──
  const tiles = useMemo(() => {
    if (!detail || size.w === 0 || size.h === 0) return []
    const meta = detail.levelsMeta[level]
    if (!meta) return []
    const scale = view.zoom * Math.pow(2, level)
    const halfW = size.w / (2 * view.zoom)
    const halfH = size.h / (2 * view.zoom)
    const lx0 = (view.cx - halfW) / Math.pow(2, level)
    const lx1 = (view.cx + halfW) / Math.pow(2, level)
    const ly0 = (view.cy - halfH) / Math.pow(2, level)
    const ly1 = (view.cy + halfH) / Math.pow(2, level)
    const tX0 = clamp(Math.floor(lx0 / meta.tileSize), 0, meta.tilesX - 1)
    const tX1 = clamp(Math.floor(lx1 / meta.tileSize), 0, meta.tilesX - 1)
    const tY0 = clamp(Math.floor(ly0 / meta.tileSize), 0, meta.tilesY - 1)
    const tY1 = clamp(Math.floor(ly1 / meta.tileSize), 0, meta.tilesY - 1)
    const out: TileProps[] = []
    for (let ty = tY0; ty <= tY1; ty++) {
      for (let tx = tX0; tx <= tX1; tx++) {
        const edgeW = Math.min(meta.tileSize, meta.width - tx * meta.tileSize)
        const edgeH = Math.min(meta.tileSize, meta.height - ty * meta.tileSize)
        out.push({
          slideId: detail.id,
          level,
          x: tx,
          y: ty,
          tileSize: meta.tileSize,
          edgeW,
          edgeH,
          scale,
          left: tx * meta.tileSize * scale,
          top: ty * meta.tileSize * scale,
        })
      }
    }
    return out
  }, [detail, level, view, size])

  const worldSize = useMemo(() => {
    if (!detail || size.w === 0) return { w: 0, h: 0, left: 0, top: 0 }
    const meta = detail.levelsMeta[level]
    if (!meta) return { w: 0, h: 0, left: 0, top: 0 }
    const scale = view.zoom * Math.pow(2, level)
    return {
      w: meta.width * scale,
      h: meta.height * scale,
      left: size.w / 2 - (view.cx / Math.pow(2, level)) * scale,
      top: size.h / 2 - (view.cy / Math.pow(2, level)) * scale,
    }
  }, [detail, level, view, size])

  // ── 标注 SVG 渲染 ──
  const renderShape = useCallback(
    (kind: AnnotationKind, points: number[], color: string, label: string) => {
      const [sx1, sy1] = toScreen(points[0] ?? 0, points[1] ?? 0)
      if (kind === 'rect') {
        const [sx2, sy2] = toScreen(points[2] ?? 0, points[3] ?? 0)
        return (
          <g key={`${label}-${sx1}-${sy1}`}>
            <rect
              x={Math.min(sx1, sx2)}
              y={Math.min(sy1, sy2)}
              width={Math.abs(sx2 - sx1)}
              height={Math.abs(sy2 - sy1)}
              fill={color}
              fillOpacity={0.12}
              stroke={color}
              strokeWidth={1.5}
            />
          </g>
        )
      }
      if (kind === 'circle') {
        const r = (points[2] ?? 0) * view.zoom
        return (
          <g key={`${label}-${sx1}-${sy1}`}>
            <circle cx={sx1} cy={sy1} r={r} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
          </g>
        )
      }
      const pts = points.map((v, i) => (i % 2 === 0 ? toScreen(v, points[i + 1] ?? 0)[0] : toScreen(points[i - 1] ?? 0, v)[1]))
      const pairs: string[] = []
      for (let i = 0; i + 1 < pts.length; i += 2) pairs.push(`${pts[i]!.toFixed(1)},${pts[i + 1]!.toFixed(1)}`)
      return (
        <g key={`${label}-${sx1}-${sy1}`}>
          <polygon points={pairs.join(' ')} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
        </g>
      )
    },
    [toScreen, view.zoom],
  )

  const drawingShape = useMemo(() => {
    if (!drawing) return null
    const [x1, y1] = drawing.start
    const [x2, y2] = drawing.current
    const [sx1, sy1] = toScreen(x1, y1)
    const [sx2, sy2] = toScreen(x2, y2)
    if (drawing.kind === 'rect') {
      return (
        <rect
          x={Math.min(sx1, sx2)}
          y={Math.min(sy1, sy2)}
          width={Math.abs(sx2 - sx1)}
          height={Math.abs(sy2 - sy1)}
          fill="#1677ff"
          fillOpacity={0.1}
          stroke="#1677ff"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )
    }
    return (
      <circle cx={sx1} cy={sy1} r={Math.hypot(sx2 - sx1, sy2 - sy1)} fill="#1677ff" fillOpacity={0.1} stroke="#1677ff" strokeWidth={1.5} strokeDasharray="4 3" />
    )
  }, [drawing, toScreen])

  const polygonPreview = useMemo(() => {
    if (polyPoints.length === 0) return null
    const pairs = polyPoints.map((v, i) => (i % 2 === 0 ? toScreen(v, polyPoints[i + 1] ?? 0)[0] : toScreen(polyPoints[i - 1] ?? 0, v)[1]))
    const line: string[] = []
    for (let i = 0; i + 1 < pairs.length; i += 2) line.push(`${pairs[i]!.toFixed(1)},${pairs[i + 1]!.toFixed(1)}`)
    if (polyHover) {
      const [hx, hy] = toScreen(polyHover[0], polyHover[1])
      line.push(`${hx.toFixed(1)},${hy.toFixed(1)}`)
    }
    return (
      <polyline
        points={line.join(' ')}
        fill="none"
        stroke="#1677ff"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinejoin="round"
      />
    )
  }, [polyPoints, polyHover, toScreen])

  // ── 渲染 ──
  return (
    <div style={{ padding: 'var(--space-4, 16px)' }}>
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <Card size="small">
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
              <Space wrap>
                <Crosshair size={18} color="#722ed1" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{t('w10Wsi.title')}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{t('w10Wsi.subtitle')}</div>
                </div>
              </Space>
              <Space wrap>
                <Select
                  style={{ width: 300 }}
                  placeholder={t('w10Wsi.selectSlide')}
                  value={currentSlideId ?? undefined}
                  onChange={(v: string) => void selectSlide(v)}
                  options={slides.map((s) => ({
                    value: s.id,
                    label: `${s.id} · ${s.patientName} · ${s.stainLabel} (${s.magnification}x)`,
                  }))}
                />
                <Button size="small" icon={<RotateCcw size={14} />} onClick={() => void loadSlides()}>
                  {t('w10Wsi.refresh')}
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={6} xl={5}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {/* [v3.0.6.11-103 Wave 2B] 病例列表 (GET /pathology/cases) */}
            <Card
              size="small"
              title={
                <Space size={6}>
                  <Text strong>{t('w10Wsi.caseList')}</Text>
                  {caseFilterPatientId && <Tag color="blue">{t('w10Wsi.filterActive')} {caseFilterPatientId}</Tag>}
                </Space>
              }
              extra={caseFilterPatientId ? (
                <Button size="small" type="link" onClick={() => { setCaseFilterPatientId(undefined); setDetail(null) }}>{t('w10Wsi.clearFilter')}</Button>
              ) : undefined}
              styles={{ body: { maxHeight: 200, overflow: 'auto', padding: 'var(--space-2, 8px)' } }}
            >
              {casesLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)' }}>
                  <Spin size="small" />
                </div>
              ) : cases.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {cases.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectCase(c.patientId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') selectCase(c.patientId) }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: caseFilterPatientId === c.patientId ? '1px solid #722ed1' : '1px solid transparent',
                        background: caseFilterPatientId === c.patientId ? 'rgba(114,46,209,0.06)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {c.patientName} <span style={{ color: '#8c8c8c', fontWeight: 400 }}>{c.patientId}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {c.specimen} · {t('w10Wsi.slideCount')} {c.slideCount}
                      </div>
                      <Tag color={c.status === 'reported' ? 'green' : c.status === 'reviewed' ? 'blue' : 'orange'} style={{ marginTop: 2 }}>
                        {t('w10Wsi.status.' + c.status)}
                      </Tag>
                    </div>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w10Wsi.noSlide')} />
              )}
              <div style={{ fontSize: 10, color: '#b0b7c3', marginTop: 6 }}>{t('w10Wsi.caseFilterHint')}</div>
            </Card>

            <Card size="small" title={<Text strong>{t('w10Wsi.slideList')}</Text>} styles={{ body: { maxHeight: 380, overflow: 'auto', padding: 'var(--space-2, 8px)' } }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)' }}>
                  <Spin size="small" />
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {slides.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => void selectSlide(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void selectSlide(s.id)
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: currentSlideId === s.id ? '1px solid #722ed1' : '1px solid transparent',
                        background: currentSlideId === s.id ? 'rgba(114,46,209,0.06)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {s.id} · {s.patientName}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {s.stainLabel} · {s.magnification}x · {Math.round(s.width / 1000)}k×{Math.round(s.height / 1000)}k
                      </div>
                      <Tag color={s.caseStatus === 'reported' ? 'green' : s.caseStatus === 'reviewed' ? 'blue' : 'orange'} style={{ marginTop: 2 }}>
                        {t('w10Wsi.status.' + s.caseStatus)}
                      </Tag>
                    </div>
                  ))}
                </Space>
              )}
            </Card>

            <Card size="small" title={<Text strong>{t('w10Wsi.caseInfo')}</Text>}>
              {detail ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('w10Wsi.patient')}>{detail.patientName} ({detail.patientId})</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.specimen')}>{detail.case.specimen}</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.diagnosis')}>{detail.case.diagnosis}</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.accession')}>{detail.case.accessionNumber}</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.caseStatus')}>
                    <Tag color={detail.case.status === 'reported' ? 'green' : detail.case.status === 'reviewed' ? 'blue' : 'orange'}>
                      {t('w10Wsi.status.' + detail.case.status)}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w10Wsi.noSlide')} />
              )}
            </Card>

            <Card size="small" title={<Text strong>{t('w10Wsi.slideInfo')}</Text>}>
              {detail ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('w10Wsi.slideId')}>{detail.id}</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.stain')}>{detail.stainLabel} ({detail.stain})</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.magnification')}>{detail.magnification}x</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.resolution')}>
                    {detail.width} × {detail.height}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.levels')}>{detail.levels} {t('w10Wsi.levelsSuffix')}</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.tileSize')}>{detail.tileSize}px</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.institution')}>{detail.institution}</Descriptions.Item>
                  <Descriptions.Item label={t('w10Wsi.scannedAt')}>{detail.scannedAt.replace('T', ' ').slice(0, 16)}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w10Wsi.noSlide')} />
              )}
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={12} xl={13}>
          <Card size="small" styles={{ body: { padding: 'var(--space-2, 8px)' } }}>
            <Space wrap style={{ width: '100%', justifyContent: 'space-between' }} align="center">
              <Space wrap>
                <Text strong style={{ fontSize: 12 }}>{t('w10Wsi.tools')}:</Text>
                <ToolButton active={tool === 'pan'} icon={<Move size={14} />} label={t('w10Wsi.pan')} onClick={() => setTool('pan')} />
                <ToolButton active={tool === 'rect'} icon={<Square size={14} />} label={t('w10Wsi.rect')} onClick={() => setTool('rect')} />
                <ToolButton active={tool === 'circle'} icon={<CircleIcon size={14} />} label={t('w10Wsi.circle')} onClick={() => setTool('circle')} />
                <ToolButton active={tool === 'polygon'} icon={<Hexagon size={14} />} label={t('w10Wsi.polygon')} onClick={() => setTool('polygon')} />
              </Space>
              <Space wrap>
                <ToolButton icon={<Plus size={14} />} label={t('w10Wsi.zoomIn')} onClick={() => zoomBy(1.4)} />
                <ToolButton icon={<Minus size={14} />} label={t('w10Wsi.zoomOut')} onClick={() => zoomBy(1 / 1.4)} />
                <ToolButton icon={<Maximize size={14} />} label={t('w10Wsi.fitView')} onClick={fitView} />
                {detail && (
                  <Segmented
                    size="small"
                    value={level}
                    onChange={(v) => setLevel(Number(v))}
                    options={detail.levelsMeta.map((m) => ({ label: `L${m.level}`, value: m.level }))}
                  />
                )}
              </Space>
            </Space>

            {tool === 'polygon' && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#8c8c8c' }}>
                {t('w10Wsi.annotateHintPoly')}
                {polyPoints.length >= 6 && (
                  <Button size="small" type="primary" style={{ marginLeft: 'var(--space-2, 8px)' }} onClick={finishPolygon}>
                    {t('w10Wsi.polygonFinish')}
                  </Button>
                )}
              </div>
            )}

            <div
              ref={viewportRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={endInteraction}
              onMouseLeave={endInteraction}
              onDoubleClick={onDoubleClick}
              style={{
                position: 'relative',
                width: '100%',
                height: 'calc(100vh - 260px)',
                minHeight: 420,
                overflow: 'hidden',
                background: '#1c1f26',
                borderRadius: 8,
                cursor: tool === 'pan' ? 'grab' : 'crosshair',
                userSelect: 'none',
                touchAction: 'none',
                marginTop: 'var(--space-2, 8px)',
              }}
            >
              {!detail && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a8adb8',
                    gap: 'var(--space-2, 8px)',
                  }}
                >
                  <Crosshair size={40} opacity={0.5} />
                  <div>{t('w10Wsi.noSlide')}</div>
                  <div style={{ fontSize: 12 }}>{t('w10Wsi.noSlideHint')}</div>
                </div>
              )}
              {detail && (
                <div
                  style={{
                    position: 'absolute',
                    left: worldSize.left,
                    top: worldSize.top,
                    width: worldSize.w,
                    height: worldSize.h,
                    transformOrigin: '0 0',
                  }}
                >
                  {tiles.map((t) => (
                    <TileImg key={`${t.level}-${t.x}-${t.y}`} {...t} />
                  ))}
                </div>
              )}
              <svg
                width={size.w}
                height={size.h}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
              >
                {detail &&
                  annotations.map((a) =>
                    renderShape(a.kind, a.points, a.color, a.label),
                  )}
                {drawingShape}
                {polygonPreview}
              </svg>
              {detail && (
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: 8,
                    zIndex: 4,
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 12,
                  }}
                >
                  {detail.id} · L{level} · {Math.round(view.zoom * detail.magnification)}x · ({Math.round(view.cx)}, {Math.round(view.cy)})
                </div>
              )}
              {detail && (
                <div
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    zIndex: 4,
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 12,
                  }}
                >
                  {t('w10Wsi.zoomLevel')}: {Math.round(view.zoom * 100)}% · {t('w10Wsi.level0Space')}
                </div>
              )}
            </div>

            {detail && (
              <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                <OverviewCanvas detail={detail} view={view} viewSize={size} onNavigate={(cx, cy) => setView((v) => ({ ...v, cx, cy }))} />
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={6} xl={6}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {backendOffline && (
              <Alert type="warning" showIcon message={t('w10Wsi.loadFailed')} description={t('w10Wsi.staleBackend')} />
            )}
            <Card
              size="small"
              title={
                <Space>
                  <Text strong>{t('w10Wsi.annotations')}</Text>
                  <Tag color="purple">{annotations.length}</Tag>
                </Space>
              }
              extra={
                <Button size="small" type="primary" icon={<Layers size={13} />} onClick={openCreateModal} disabled={!detail}>
                  {t('w10Wsi.addAnnotation')}
                </Button>
              }
              styles={{ body: { maxHeight: 420, overflow: 'auto' } }}
            >
              {annotations.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w10Wsi.emptyAnnotations')} />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {annotations.map((a) => (
                    <div
                      key={a.id}
                      style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 6 }}
                      onClick={() => locateAnnotation(a)}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space size={4}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color, display: 'inline-block' }} />
                          <Text strong style={{ fontSize: 12 }}>{a.label}</Text>
                        </Space>
                        <Space size={2}>
                          <Tooltip title={t('w10Wsi.locate')}>
                            <Button aria-label="操作" size="small" type="text" icon={<Crosshair size={13} />} onClick={() => locateAnnotation(a)} />
                          </Tooltip>
                          <Tooltip title={t('w10Wsi.edit')}>
                            <Button aria-label="编辑" size="small" type="text" icon={<Square size={13} />} onClick={() => openEditModal(a)} />
                          </Tooltip>
                          <Popconfirm title={t('w10Wsi.confirmDelete')} onConfirm={() => void deleteAnnotation(a.id)}>
                            <Tooltip title={t('w10Wsi.delete')}>
                              <Button aria-label="删除" size="small" type="text" danger icon={<Trash2 size={13} />} />
                            </Tooltip>
                          </Popconfirm>
                        </Space>
                      </Space>
                      <div style={{ marginTop: 'var(--space-1, 4px)', fontSize: 11, color: '#8c8c8c' }}>
                        <Tag color={a.color} style={{ fontSize: 11 }}>{t('w10Wsi.categoryName.' + a.category)}</Tag>
                        {a.kind === 'rect' && `${t('w10Wsi.rect')} ${Math.round(a.points[2]! - a.points[0]!)}×${Math.round(a.points[3]! - a.points[1]!)}px`}
                        {a.kind === 'circle' && `${t('w10Wsi.circle')} r=${Math.round(a.points[2] ?? 0)}px`}
                        {a.kind === 'polygon' && `${t('w10Wsi.polygon')} ${Math.floor(a.points.length / 2)}${t('w10Wsi.marker')}`}
                        {a.confidence !== undefined && ` · ${Math.round(a.confidence * 100)}%`}
                      </div>
                    </div>
                  ))}
                </Space>
              )}
            </Card>
            <Card size="small" title={<Text strong>{t('w10Wsi.annotateHint')}</Text>}>
              <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.8 }}>
                1. {t('w10Wsi.pan')}: {t('w10Wsi.hintPan')}{detail ? detail.levels - 1 : 5}<br />
                2. {t('w10Wsi.rect')} / {t('w10Wsi.circle')}: {t('w10Wsi.hintRect')}<br />
                3. {t('w10Wsi.polygon')}: {t('w10Wsi.hintPoly')}<br />
                4. {t('w10Wsi.hintLocate')} {t('w10Wsi.locate')}
              </div>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* 标注创建 / 编辑弹窗 */}
      <Modal
        open={pendingAnn !== null || editingAnn !== null}
        title={editingAnn ? t('w10Wsi.edit') : t('w10Wsi.addAnnotation')}
        onCancel={() => {
          setPendingAnn(null)
          setEditingAnn(null)
        }}
        onOk={confirmAnnotationModal}
        okText={t('w10Wsi.ok')}
        cancelText={t('w10Wsi.cancel')}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12, color: '#595959' }}>{t('w10Wsi.label')}</div>
            <Input
              value={annLabel}
              onChange={(e) => setAnnLabel(e.target.value)}
              placeholder={t('w10Wsi.labelPlaceholder')}
              maxLength={200}
            />
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12, color: '#595959' }}>{t('w10Wsi.category')}</div>
            <Radio.Group
              value={annCategory}
              onChange={(e) => {
                setAnnCategory(e.target.value)
                const cat = CATEGORIES.find((c) => c.value === e.target.value)
                if (cat) setAnnColor(cat.color)
              }}
            >
              {CATEGORIES.map((c) => (
                <Radio.Button key={c.value} value={c.value}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "currentColor", marginRight: 'var(--space-1, 4px)', color: c.color }} /> {t('w10Wsi.categoryName.' + c.value)}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12, color: '#595959' }}>{t('w10Wsi.color')}</div>
            <Radio.Group value={annColor} onChange={(e) => setAnnColor(e.target.value)}>
              {PALETTE.map((c) => (
                <Radio.Button key={c} value={c}>
                  <span style={{ color: c }}>●</span>
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12, color: '#595959' }}>
              {t('w10Wsi.confidence')}: {Math.round(annConfidence * 100)}%
            </div>
            <Slider min={0} max={1} step={0.01} value={annConfidence} onChange={(v) => setAnnConfidence(Number(v))} />
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default WsiViewerPage

import React from 'react'

export type WindowPreset = { name: string; ww: number; wc: number; icon?: string }
export type MeasureType = 'length' | 'angle' | 'area' | 'ct'
export type LayoutMode = '1x1' | '2x2' | '1x2' | '2x1'
export type Tool = 'zoom' | 'pan' | 'wl' | 'rotate' | 'flipH' | 'flipV' | 'measure' | 'annotate' | 'play' | 'print' | 'reset'
// [G005 v3.0.6.11-99 Wave 4B] 测量族增强: cobb (Cobb角 双线夹角) / polygon (多边形面积)
export type MeasureSubMenu = 'length' | 'angle' | 'area' | 'ct' | 'ellipse' | 'rectangle' | 'circle' | 'ctvalue' | 'cobb' | 'polygon' | null
export type RightTab = 'patient' | 'image' | 'measure' | 'report' | 'history' | 'external'
export type AnnotationType = 'text' | 'arrow' | 'rect' | 'ellipse'
export type PseudoColorMode = 'none' | 'hotIron' | 'coolBlue' | 'grayscale' | 'pet' | 'softTissue'
export type CompareLayout = 'leftRight' | 'topBottom'
export type ViewMode = 'MPR' | 'MIP' | 'VR'
export type MipDirection = 'axial' | 'sagittal' | 'coronal'
export type VrAxis = 'x' | 'y' | 'z'

export type Annotation = {
  id: string
  type: AnnotationType
  x: number
  y: number
  x2?: number
  y2?: number
  text?: string
  color: string
  fontSize: number
  visible: boolean
  locked: boolean
}

export type MeasurePoint = {
  id: string
  x: number
  y: number
}

export interface Measurement {
  id: string
  type: 'line' | 'angle' | 'ellipse' | 'rectangle' | 'circle' | 'ctvalue' | 'cobb' | 'polygon'
  points: { x: number; y: number }[]
  value: number
  unit: string
  label: string
  location?: string
}

export type InteractiveMeasure = Measurement & { color: string; visible: boolean }

export type PseudoColorPreset = {
  name: string
  mode: PseudoColorMode
  icon: React.ReactNode
  description: string
}

export type Series = {
  id: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  imageCount: number
  thumbnail: string
}

export type DicomImage = {
  id: string
  seriesId: string
  imageNumber: number
  sliceLocation: number
  windowWidth: number
  windowCenter: number
  pixelSpacing: number
  sliceThickness: number
  tr?: number
  te?: number
  matrix: string
  fov: number
}

export type HistoryExam = {
  id: string
  examId: string
  examDate: string
  examTime: string
  examItemName: string
  modality: string
  bodyPart: string
  deviceName: string
  status: string
  reportDate?: string
  reportDoctor?: string
  finding?: string
  conclusion?: string
}

export type ExamItem = {
  id: string
  examId: string
  accessionNumber: string
  patientId: string
  patientName: string
  gender: string
  age: number
  patientType: string
  examItemName: string
  examDate: string
  examTime: string
  modality: string
  bodyPart: string
  deviceName: string
  roomName: string
  status: string
  priority: string
  clinicalDiagnosis: string
  clinicalHistory: string
  examIndications: string
  reportDate?: string
  reportDoctor?: string
  finding?: string
  conclusion?: string
}

export const PRIMARY = '#1e40af'
export const PRIMARY_LIGHT = '#2563eb'
export const CARD_BG = 'var(--bg-card)'
export const PANEL_BG = '#f0f4f8'

/** @deprecated Use getPresetsForModality from utils/modalityPresets instead */
export const WINDOW_PRESETS: WindowPreset[] = [
  { name: '骨窗', ww: 2000, wc: 400 },
  { name: '肺窗', ww: 1500, wc: -600 },
  { name: '脑窗', ww: 80, wc: 40 },
  { name: '腹部窗', ww: 400, wc: 50 },
  { name: '软组织', ww: 400, wc: 40 },
  { name: '纵隔窗', ww: 400, wc: 40 },
  { name: '乳腺窗', ww: 400, wc: 300 },
  { name: '心脏窗', ww: 350, wc: 50 },
  { name: '肝脏增强窗', ww: 200, wc: 60 },
  { name: '血管窗', ww: 600, wc: 200 },
  { name: '眼眶窗', ww: 300, wc: 50 },
]

export const SERIES_COLORS = ['#4a90d9', '#50b784', '#e5a832', '#d94a4a', '#9b59b6', '#1abc9c']

export const PSEUDO_COLOR_PRESETS: PseudoColorPreset[] = [
  { name: '无', mode: 'none', icon: React.createElement('span'), description: '原始灰度' },
  { name: '热铁', mode: 'hotIron', icon: React.createElement('span'), description: 'Hot Iron - 红色到白色' },
  { name: '冷蓝', mode: 'coolBlue', icon: React.createElement('span'), description: 'Cool Blue - 蓝色调' },
  { name: 'PET', mode: 'pet', icon: React.createElement('span'), description: 'PET伪彩 - 彩虹色' },
  { name: '软组织', mode: 'softTissue', icon: React.createElement('span'), description: '软组织窗' },
]

export const ANNOTATION_COLORS = [
  '#ff0000', '#00ff00', '#ffff00', '#00ffff',
  '#ff00ff', '#ff8800', '#88ff00', '#0088ff',
  '#ffffff', '#ffcc00',
]

export const ANNOTATION_COLOR_NAMES: Record<string, string> = {
  '#ff0000': '红',
  '#00ff00': '绿',
  '#ffff00': '黄',
  '#00ffff': '青',
  '#ff00ff': '品红',
  '#ff8800': '橙',
  '#88ff00': '黄绿',
  '#0088ff': '蓝',
  '#ffffff': '白',
  '#ffcc00': '金黄',
}

// ════════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-101 Wave 3B] 影像测量 V2 + 标注 V2 双向同步
// ════════════════════════════════════════════════════════════════════════════

/** 测量 V2 八工具 (后端 measurement-v2 模块同构) */
export type MeasureV2Type = 'line' | 'angle' | 'ellipseArea' | 'rectangleArea' | 'polygonArea' | 'polyline' | 'cobb' | 'calciumScore'
/** 标注 V2 对象类型 */
export type AnnotationV2Type = 'text' | 'arrow' | 'rect' | 'ellipse' | 'freehand'

export interface Point2D {
  x: number
  y: number
}

export interface MeasureV2Meta {
  type: MeasureV2Type
  label: string
  unit: string
  minPoints: number
  fixedPoints: number
  deterministic: boolean
  formula: string
  precision: number
}

export interface MeasureV2Result {
  type: MeasureV2Type
  value: number
  unit: string
  formula: string
  deterministic: boolean
  precision: number
  detail?: Record<string, number>
}

export interface MeasureV2Version {
  version: number
  value: number
  unit: string
  points: Point2D[]
  worldPoints: Point2D[]
  label: string
  color: string
  note: string
  createdAt: string
}

export interface MeasureV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: MeasureV2Type
  points: Point2D[]
  worldPoints: Point2D[]
  value: number
  unit: string
  label: string
  color: string
  visible: boolean
  formula: string
  deterministic: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: MeasureV2Version[]
  annotationId: string | null
}

export interface AnnotationV2Version {
  version: number
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  note: string
  createdAt: string
}

export interface AnnotationV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  visible: boolean
  locked: boolean
  measurementId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: AnnotationV2Version[]
}

/** 测量 V2 八工具元数据 (与后端一致, 前端本地兜底计算用) */
export const MEASURE_V2_META_LABEL_KEYS: Record<MeasureV2Type, string> = {
  line: 'w9d.measureV2.line', angle: 'w9d.measureV2.angle', ellipseArea: 'w9d.measureV2.ellipseArea',
  rectangleArea: 'w9d.measureV2.rectangleArea', polygonArea: 'w9d.measureV2.polygonArea', polyline: 'w9d.measureV2.polyline',
  cobb: 'w9d.measureV2.cobb', calciumScore: 'w9d.measureV2.calciumScore',
}
export const MEASURE_V2_META: Record<MeasureV2Type, MeasureV2Meta> = {
  line: { type: 'line', label: '直线长度', unit: 'mm', minPoints: 2, fixedPoints: 2, deterministic: true, formula: '√(dx²+dy²)×spacing', precision: 2 },
  angle: { type: 'angle', label: '角度', unit: '°', minPoints: 3, fixedPoints: 3, deterministic: true, formula: 'atan2 三点夹角', precision: 2 },
  ellipseArea: { type: 'ellipseArea', label: '椭圆面积', unit: 'mm²', minPoints: 2, fixedPoints: 2, deterministic: true, formula: 'π·a·b', precision: 2 },
  rectangleArea: { type: 'rectangleArea', label: '矩形面积', unit: 'mm²', minPoints: 2, fixedPoints: 2, deterministic: true, formula: '宽×高', precision: 2 },
  polygonArea: { type: 'polygonArea', label: '多边形面积', unit: 'mm²', minPoints: 3, fixedPoints: 0, deterministic: true, formula: '鞋带公式', precision: 2 },
  polyline: { type: 'polyline', label: '折线长度', unit: 'mm', minPoints: 2, fixedPoints: 0, deterministic: true, formula: 'Σ 线段距离', precision: 2 },
  cobb: { type: 'cobb', label: 'Cobb角', unit: '°', minPoints: 4, fixedPoints: 4, deterministic: true, formula: '两条线夹角 (锐角)', precision: 2 },
  calciumScore: { type: 'calciumScore', label: '钙化评分', unit: 'AU', minPoints: 1, fixedPoints: 0, deterministic: true, formula: 'Agatston 简化: Σ 面积×HU权重', precision: 1 },
}

export const MEASURE_V2_TOOL_ORDER: MeasureV2Type[] = ['line', 'angle', 'ellipseArea', 'rectangleArea', 'polygonArea', 'polyline', 'cobb', 'calciumScore']

/** 测量 V2 本地确定性计算 (与后端 computeMeasurement 一致, 后端不可达时兜底) */
export function computeMeasureV2(type: MeasureV2Type, points: Point2D[], pixelSpacing: [number, number], huValues?: number[], huThreshold = 130): MeasureV2Result {
  const meta = MEASURE_V2_META[type]
  const round = (v: number) => {
    const factor = 10 ** meta.precision
    return Math.round(v * factor) / factor
  }
  const dist = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y)
  const lineDeg = (a: Point2D, b: Point2D) => Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
  let value = 0
  switch (type) {
    case 'line':
      value = points.length >= 2 ? dist(points[0]!, points[1]!) * pixelSpacing[0] : 0
      break
    case 'angle': {
      if (points.length >= 3) {
        const [p1, vertex, p2] = points
        let deg = Math.abs(lineDeg(vertex!, p2!) - lineDeg(vertex!, p1!))
        if (deg > 180) deg = 360 - deg
        value = deg
      }
      break
    }
    case 'ellipseArea': {
      if (points.length >= 2) {
        const [p1, p2] = points
        const rx = (Math.abs(p2!.x - p1!.x) / 2) * pixelSpacing[0]
        const ry = (Math.abs(p2!.y - p1!.y) / 2) * pixelSpacing[1]
        value = Math.PI * rx * ry
      }
      break
    }
    case 'rectangleArea': {
      if (points.length >= 2) {
        const [p1, p2] = points
        value = Math.abs(p2!.x - p1!.x) * pixelSpacing[0] * Math.abs(p2!.y - p1!.y) * pixelSpacing[1]
      }
      break
    }
    case 'polygonArea': {
      if (points.length >= 3) {
        let sum = 0
        for (let i = 0; i < points.length; i++) {
          const cur = points[i]!
          const nxt = points[(i + 1) % points.length]!
          sum += cur.x * nxt.y - nxt.x * cur.y
        }
        value = (Math.abs(sum) / 2) * pixelSpacing[0] * pixelSpacing[1]
      }
      break
    }
    case 'polyline': {
      let total = 0
      for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!)
      value = total * pixelSpacing[0]
      break
    }
    case 'cobb': {
      if (points.length >= 4) {
        let diff = Math.abs(lineDeg(points[2]!, points[3]!) - lineDeg(points[0]!, points[1]!)) % 180
        if (diff > 90) diff = 180 - diff
        value = diff
      }
      break
    }
    case 'calciumScore': {
      const voxelArea = pixelSpacing[0] * pixelSpacing[1]
      const n = Math.min(points.length, huValues?.length ?? 0)
      for (let i = 0; i < n; i++) {
        const hu = huValues![i]!
        if (hu < huThreshold) continue
        let weight = 1
        if (hu >= 400) weight = 4
        else if (hu >= 300) weight = 3
        else if (hu >= 200) weight = 2
        value += voxelArea * weight
      }
      break
    }
  }
  return {
    type,
    value: round(value),
    unit: meta.unit,
    formula: meta.formula,
    deterministic: true,
    precision: meta.precision,
  }
}

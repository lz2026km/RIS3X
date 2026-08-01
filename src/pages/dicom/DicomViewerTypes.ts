import React from 'react'

export type WindowPreset = { name: string; ww: number; wc: number; icon?: string }
export type MeasureType = 'length' | 'angle' | 'area' | 'ct'
export type LayoutMode = '1x1' | '2x2' | '1x2' | '2x1'
export type Tool = 'zoom' | 'pan' | 'wl' | 'rotate' | 'flipH' | 'flipV' | 'measure' | 'annotate' | 'play' | 'print'
export type MeasureSubMenu = 'length' | 'angle' | 'area' | 'ct' | 'ellipse' | 'rectangle' | 'circle' | 'ctvalue' | null
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
  type: 'line' | 'angle' | 'ellipse' | 'rectangle' | 'circle' | 'ctvalue'
  points: { x: number; y: number }[]
  value: number
  unit: string
  label: string
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

export const PRIMARY = '#1e3a5f'
export const PRIMARY_LIGHT = '#2d4a6f'
export const CARD_BG = '#ffffff'
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

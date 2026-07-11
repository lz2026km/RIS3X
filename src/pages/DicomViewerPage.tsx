import { t } from '../i18n/appI18n'
import ViewerSelector from '../components/common/ViewerSelector'
// TODO v3.0.4: 此文件超过 2000 行（5879行），需要拆分为子组件
// v3.0.4 重构目标：
// 1. 提取页面头部 (title + breadcrumb + actions)
// 2. 提取搜索/筛选栏为独立组件
// 3. 提取列表/表格为独立组件
// 4. 提取对话框/编辑面板为独立组件
// ============================================================
// G005 放射科RIS - DICOM影像浏览器 v0.5.0
// 专业DICOM Viewer，模拟GE Centricity/联影DICOM Viewer功能
// 布局：左侧工具栏(60px) + 中间影像区 + 右侧信息面板(280px)
// 扩充功能：交互式测量、标注工具、伪彩显示、图像对比增强
// ============================================================
// @ts-nocheck - TODO: Remove after sub-component extraction completes
// eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  // 工具图标
  ZoomIn, ZoomOut, Move, Sun, Contrast, RotateCw, RotateCcw,
  FlipHorizontal, FlipVertical, RefreshCw, Ruler, Calendar,
  MessageSquare, Play, Pause, Printer, Grid3x3, Maximize2,
  Minimize2, Download, Layers, Film, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, SplitSquareHorizontal, Square,
  Eye, MousePointer, Circle, PenTool, Minus, Plus,
  AlertCircle, CheckCircle, Clock, FileText, Activity,
  X, Info, Triangle, Maximize, Camera, Layers3, Crosshair, Box,
  // 标签页图标
  User, Image as ImageIcon, Ruler as RulerIcon, FileSearch, History, GitCompare, ArrowLeftRight,
  CheckSquare, Square as SquareIcon, AlertTriangle, Diff, ScrollText,
  // 窗值预设相关
  EyeOff, Focus,
  // 扩增标注工具图标
  Type, ArrowUpRight, Square as RectIcon, Circle as CircleIcon,
  Palette, Trash2, Edit3, Lock, Unlock, Eye as EyeIcon, Volume2,
  // 伪彩相关
  Flame, Droplets, Wind, Thermometer,
  // DICOM文件导入
  Upload, File,
} from 'lucide-react'
import { initialRadiologyExams } from '../data/initialData'
import { examApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import {
  loadDicomFile,
  getPatientInfo,
  getWindowCenterWidth,
  getModality,
  getBodyPart,
  DicomDataset,
  PatientInfo,
} from '../utils/DicomManager'
import {
  getRecommendedPresets,
  WindowPreset as DicomWindowPreset,
} from '../utils/WindowPresets'

// ============================================================
// 类型定义
// ============================================================
type WindowPreset = { name: string; ww: number; wl: number; icon?: string }
type MeasureType = 'length' | 'angle' | 'area' | 'ct'
type LayoutMode = '1x1' | '2x2' | '1x2' | '2x1'
type Tool = 'zoom' | 'pan' | 'wl' | 'rotate' | 'flipH' | 'flipV' | 'measure' | 'annotate' | 'play' | 'print'
type MeasureSubMenu = 'length' | 'angle' | 'area' | 'ct' | null
type RightTab = 'patient' | 'image' | 'measure' | 'report' | 'history' | 'external'
type AnnotationType = 'text' | 'arrow' | 'rect' | 'ellipse'
type PseudoColorMode = 'none' | 'hotIron' | 'coolBlue' | 'grayscale' | 'pet' | 'softTissue'
type CompareLayout = 'leftRight' | 'topBottom'
type ViewMode = 'MPR' | 'MIP' | 'VR'
type MipDirection = 'axial' | 'sagittal' | 'coronal'
type VrAxis = 'x' | 'y' | 'z'

// 标注数据类型
type Annotation = {
  id: string
  type: AnnotationType
  x: number
  y: number
  x2?: number // for arrow, rect, ellipse end point
  y2?: number
  text?: string
  color: string
  fontSize: number
  visible: boolean
  locked: boolean
}

// 测量点数据
type MeasurePoint = {
  id: string
  x: number
  y: number
}

// 交互式测量结果（符合任务要求的Measurement结构）
interface Measurement {
  id: string
  type: 'line' | 'angle' | 'ellipse' | 'rectangle' | 'circle' | 'ctvalue'
  points: { x: number; y: number }[]
  value: number
  unit: string
  label: string
}

// 兼容旧接口
type InteractiveMeasure = Measurement & { color: string; visible: boolean }

// 伪彩预设
type PseudoColorPreset = {
  name: string
  mode: PseudoColorMode
  icon: React.ReactNode
  description: string
}
type Series = {
  id: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  imageCount: number
  thumbnail: string // 模拟颜色
}

type DicomImage = {
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

// 历史检查记录类型
type HistoryExam = {
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

// 检查项目类型
type ExamItem = {
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

// ============================================================
// 常量定义
// ============================================================
const PRIMARY = '#1e3a5f'
const PRIMARY_LIGHT = '#2d4a6f'
const CARD_BG = '#ffffff'
const PANEL_BG = '#f0f4f8'

const WINDOW_PRESETS: WindowPreset[] = [
  { name: '骨窗', ww: 2000, wl: 400 },
  { name: '肺窗', ww: 1500, wl: -600 },
  { name: '脑窗', ww: 80, wl: 40 },
  { name: '腹部窗', ww: 400, wl: 50 },
  { name: '软组织', ww: 400, wl: 40 },
  { name: '纵隔窗', ww: 350, wl: 50 },
]

const SERIES_COLORS = ['#4a90d9', '#50b784', '#e5a832', '#d94a4a', '#9b59b6', '#1abc9c']

// 伪彩显示预设
const PSEUDO_COLOR_PRESETS: PseudoColorPreset[] = [
  { name: '无', mode: 'none', icon: <EyeOff size={14} />, description: '原始灰度' },
  { name: '热铁', mode: 'hotIron', icon: <Flame size={14} />, description: 'Hot Iron - 红色到白色' },
  { name: '冷蓝', mode: 'coolBlue', icon: <Droplets size={14} />, description: 'Cool Blue - 蓝色调' },
  { name: 'PET', mode: 'pet', icon: <Activity size={14} />, description: 'PET伪彩 - 彩虹色' },
  { name: '软组织', mode: 'softTissue', icon: <Wind size={14} />, description: '软组织窗' },
]

// 标注颜色选项
const ANNOTATION_COLORS = [
  '#ff0000', '#00ff00', '#ffff00', '#00ffff',
  '#ff00ff', '#ff8800', '#88ff00', '#0088ff',
  '#ffffff', '#ffcc00',
]

// 标注颜色名称映射
const ANNOTATION_COLOR_NAMES: Record<string, string> = {
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

// 模拟序列数据
const generateSeries = (modality: string): Series[] => {
  if (modality === 'CT') {
    return [
      { id: 's1', seriesNumber: 1, seriesDescription: '横断面-肺窗', modality: 'CT', imageCount: 120, thumbnail: '#4a90d9' },
      { id: 's2', seriesNumber: 2, seriesDescription: '横断面-纵隔窗', modality: 'CT', imageCount: 120, thumbnail: '#50b784' },
      { id: 's3', seriesNumber: 3, seriesDescription: '冠状面', modality: 'CT', imageCount: 80, thumbnail: '#e5a832' },
      { id: 's4', seriesNumber: 4, seriesDescription: '矢状面', modality: 'CT', imageCount: 80, thumbnail: '#d94a4a' },
    ]
  }
  if (modality === 'MR') {
    return [
      { id: 's1', seriesNumber: 1, seriesDescription: 'T1WI横断', modality: 'MR', imageCount: 200, thumbnail: '#4a90d9' },
      { id: 's2', seriesNumber: 2, seriesDescription: 'T2WI横断', modality: 'MR', imageCount: 200, thumbnail: '#50b784' },
      { id: 's3', seriesNumber: 3, seriesDescription: 'FLAIR', modality: 'MR', imageCount: 200, thumbnail: '#e5a832' },
      { id: 's4', seriesNumber: 4, seriesDescription: 'DWI', modality: 'MR', imageCount: 50, thumbnail: '#d94a4a' },
    ]
  }
  if (modality === 'DR') {
    return [
      { id: 's1', seriesNumber: 1, seriesDescription: '后前位', modality: 'DR', imageCount: 1, thumbnail: '#4a90d9' },
      { id: 's2', seriesNumber: 2, seriesDescription: '侧位', modality: 'DR', imageCount: 1, thumbnail: '#50b784' },
    ]
  }
  return [{ id: 's1', seriesNumber: 1, seriesDescription: '序列1', modality: modality, imageCount: 1, thumbnail: '#4a90d9' }]
}

const generateImages = (series: Series): DicomImage[] => {
  const images: DicomImage[] = []
  for (let i = 1; i <= series.imageCount; i++) {
    images.push({
      id: `${series.id}-i${i}`,
      seriesId: series.id,
      imageNumber: i,
      sliceLocation: (i - series.imageCount / 2) * 2.5,
      windowWidth: 400,
      windowCenter: 40,
      pixelSpacing: 0.68,
      sliceThickness: 2.5,
      tr: series.modality === 'MR' ? 2500 : undefined,
      te: series.modality === 'MR' ? 30 : undefined,
      matrix: '512×512',
      fov: 35,
    })
  }
  return images
}

// 模拟测量数据
const mockMeasurements = {
  length: [
    { id: 'm1', type: 'length', value: 12.5, unit: 'mm', location: '病灶最大径' },
    { id: 'm2', type: 'length', value: 8.3, unit: 'mm', location: '另一病灶' },
  ],
  angle: [
    { id: 'a1', type: 'angle', value: 45.2, unit: '°', location: '脊柱侧弯角' },
  ],
  ct: [
    { id: 'ct1', type: 'ct', value: 45, unit: 'HU', location: '病灶中心' },
    { id: 'ct2', type: 'ct', value: 20, unit: 'HU', location: '病灶边缘' },
  ],
  area: [
    { id: 'ar1', type: 'area', value: 98.5, unit: 'mm²', location: '横断面面积' },
  ],
}

// 模拟历史检查数据
const mockHistoryExams: HistoryExam[] = [
  {
    id: 'h1',
    examId: 'EX20260415001',
    examDate: '2026-04-15',
    examTime: '09:30',
    examItemName: '胸部CT平扫',
    modality: 'CT',
    bodyPart: 'CHEST',
    deviceName: 'GE Revolution Apex（CT-01）',
    status: '已完成',
    reportDate: '2026-04-15 11:45',
    reportDoctor: '张伟明',
    finding: '左肺上叶见一枚直径约8mm磨玻璃结节，较2026-03-01片未见明显变化。余肺野清晰。',
    conclusion: '左肺上叶磨玻璃结节，较前相仿，建议6个月复查。',
  },
  {
    id: 'h2',
    examId: 'EX20260301001',
    examDate: '2026-03-01',
    examTime: '14:20',
    examItemName: '胸部CT平扫',
    modality: 'CT',
    bodyPart: 'CHEST',
    deviceName: 'GE Revolution Apex（CT-01）',
    status: '已完成',
    reportDate: '2026-03-01 16:30',
    reportDoctor: '李明辉',
    finding: '左肺上叶见一枚直径约8mm磨玻璃结节。余肺野清晰。',
    conclusion: '左肺上叶磨玻璃结节，建议定期复查。',
  },
  {
    id: 'h3',
    examId: 'EX20260110001',
    examDate: '2026-01-10',
    examTime: '10:15',
    examItemName: '胸部DR正侧位',
    modality: 'DR',
    bodyPart: 'CHEST',
    deviceName: '飞利浦DigitalDiagnost（DR-02）',
    status: '已完成',
    reportDate: '2026-01-10 11:00',
    reportDoctor: '王芳',
    finding: '心影增大，双肺纹理增多，余未见明显异常。',
    conclusion: '心影增大，建议进一步CT检查。',
  },
  {
    id: 'h4',
    examId: 'EX20251120001',
    examDate: '2025-11-20',
    examTime: '08:45',
    examItemName: '胸部CT平扫',
    modality: 'CT',
    bodyPart: 'CHEST',
    deviceName: 'GE Revolution Apex（CT-01）',
    status: '已完成',
    reportDate: '2025-11-20 10:30',
    reportDoctor: '张伟明',
    finding: '左肺上叶见一枚直径约6mm磨玻璃结节。右肺中叶见索条影。余肺野清晰。',
    conclusion: '左肺磨玻璃结节6mm，建议3个月复查。',
  },
  {
    id: 'h5',
    examId: 'EX20250905001',
    examDate: '2025-09-05',
    examTime: '15:30',
    examItemName: '腹部CT平扫',
    modality: 'CT',
    bodyPart: 'ABDOMEN',
    deviceName: '西门子SOMATOM Force（CT-02）',
    status: '已完成',
    reportDate: '2025-09-05 17:00',
    reportDoctor: '赵红',
    finding: '肝实质内未见明显异常密度影。胆囊未见结石。胰腺、脾脏、双肾未见异常。',
    conclusion: '腹部CT平扫未见明显异常。',
  },
]

// ============================================================
// 跨机构调阅 - 外部医疗机构模拟数据
// ============================================================
type ExternalInstitution = {
  id: string
  name: string
  address: string
  phone: string
  pacsType: string
  status: 'online' | 'offline'
}

type ExternalExam = {
  id: string
  institutionId: string
  patientId: string
  patientName: string
  gender: string
  age: number
  examDate: string
  examItemName: string
  modality: string
  bodyPart: string
  deviceName: string
  accessionNumber: string
  reportDoctor?: string
  reportDate?: string
  finding?: string
  conclusion?: string
  series: Series[]
  status: 'available' | 'archived' | 'pending'
}

const EXTERNAL_INSTITUTIONS: ExternalInstitution[] = [
  { id: 'hubei-provincial', name: '汉东省人民医院', address: '武汉市武昌区解放路238号', phone: '027-88871234', pacsType: 'GE Centricity PACS', status: 'online' },
  { id: 'wuhan-center', name: '武汉市中心医院', address: '武汉市江岸区中山路1260号', phone: '027-82218999', pacsType: '锐柯PACS/RIS', status: 'online' },
  { id: 'shanghai-first', name: '上海市第一人民医院', address: '上海市虹口区武进路85号', phone: '021-63240090', pacsType: 'HISILON PACS', status: 'online' },
  { id: 'peking-union', name: '北京协和医院', address: '北京市东城区帅府园1号', phone: '010-69156114', pacsType: '飞利浦PACS', status: 'online' },
  { id: 'sun-yat-sen', name: '中山大学附属第一医院', address: '广州市越秀区中山二路58号', phone: '020-87755777', pacsType: '西门子PACS/Syngo', status: 'offline' },
]

const EXTERNAL_EXAMS: ExternalExam[] = [
  {
    id: 'ext-001',
    institutionId: 'hubei-provincial',
    patientId: 'P202600123',
    patientName: '李明华',
    gender: '男',
    age: 58,
    examDate: '2026-04-10',
    examItemName: '胸部CT平扫',
    modality: 'CT',
    bodyPart: 'CHEST',
    deviceName: 'GE Revolution Apex（CT-01）',
    accessionNumber: 'HN20260410001',
    reportDoctor: '王建国',
    reportDate: '2026-04-10 14:30',
    finding: '右肺中叶见一枚直径约12mm实性结节，边缘可见分叶征。左肺上叶见索条影。纵隔淋巴结未见明显肿大。',
    conclusion: '右肺中叶实性结节，建议进一步PET-CT检查除外恶性。',
    series: generateSeries('CT'),
    status: 'available',
  },
  {
    id: 'ext-002',
    institutionId: 'hubei-provincial',
    patientId: 'P202600123',
    patientName: '李明华',
    gender: '男',
    age: 58,
    examDate: '2026-01-22',
    examItemName: '腹部CT增强',
    modality: 'CT',
    bodyPart: 'ABDOMEN',
    deviceName: '西门子SOMATOM Force（CT-02）',
    accessionNumber: 'HN20260122002',
    reportDoctor: '陈晓红',
    reportDate: '2026-01-22 16:45',
    finding: '肝S7段见一枚直径约8mm低密度影，增强扫描呈环形强化。胆囊、胰腺、脾脏未见明显异常。双肾未见结石或占位。',
    conclusion: '肝S7段小病灶，建议3个月复查。',
    series: generateSeries('CT'),
    status: 'archived',
  },
  {
    id: 'ext-003',
    institutionId: 'wuhan-center',
    patientId: 'P202600456',
    patientName: '张伟',
    gender: '男',
    age: 45,
    examDate: '2026-03-15',
    examItemName: '头颅MRI平扫',
    modality: 'MR',
    bodyPart: 'BRAIN',
    deviceName: '西门子MAGNETOM Prisma（MR-01）',
    accessionNumber: 'WH20260315003',
    reportDoctor: '刘芳',
    reportDate: '2026-03-15 11:20',
    finding: '两侧大脑半球对称，脑实质内未见明显异常信号。脑室系统形态正常。中线结构居中。',
    conclusion: '头颅MRI平扫未见明显异常。',
    series: generateSeries('MR'),
    status: 'available',
  },
  {
    id: 'ext-004',
    institutionId: 'shanghai-first',
    patientId: 'P202600789',
    patientName: '王秀英',
    gender: '女',
    age: 62,
    examDate: '2026-02-28',
    examItemName: 'MG',
    modality: 'DR',
    bodyPart: 'BREAST',
    deviceName: 'GE Senographe Essential（MG-01）',
    accessionNumber: 'SH20260228004',
    reportDoctor: '赵敏',
    reportDate: '2026-02-28 15:00',
    finding: '双侧乳腺腺体呈致密型。右乳外上象限见一枚约8mm类圆形致密影，边缘可见毛刺征。左乳未见明确结节影。双侧腋窝淋巴结未见肿大。',
    conclusion: '右乳外上象限结节，BIRADS 4类，建议活检。',
    series: generateSeries('DR'),
    status: 'available',
  },
  {
    id: 'ext-005',
    institutionId: 'peking-union',
    patientId: 'P202600123',
    patientName: '李明华',
    gender: '男',
    age: 58,
    examDate: '2025-12-18',
    examItemName: '胸部CT平扫',
    modality: 'CT',
    bodyPart: 'CHEST',
    deviceName: '飞利浦Brilliance iCT（CT-01）',
    accessionNumber: 'PUMC20251218005',
    reportDoctor: '孙丽华',
    reportDate: '2025-12-18 10:30',
    finding: '左肺上叶见一枚直径约6mm磨玻璃结节。余肺野清晰。纵隔淋巴结未见肿大。心影不大。',
    conclusion: '左肺上叶磨玻璃小结节，建议年度复查。',
    series: generateSeries('CT'),
    status: 'pending',
  },
]

// ============================================================
// 样式对象
// ============================================================
const s = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: 'calc(100vh - 52px)',
    background: PANEL_BG,
    fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif',
    overflow: 'hidden',
  },
  // ---- 主体三栏布局 ----
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  // ---- 左侧工具栏 ----
  leftToolbar: {
    width: 60,
    background: `linear-gradient(180deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    gap: 4,
    borderRight: `1px solid ${PRIMARY}`,
    flexShrink: 0,
    boxShadow: '2px 0 8px rgba(30,58,95,0.3)',
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    position: 'relative' as const,
    flexShrink: 0,
  },
  toolBtnActive: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  toolDivider: {
    width: 32,
    height: 1,
    background: 'rgba(255,255,255,0.2)',
    margin: '4px 0',
  },
  // ---- 中间影像区 ----
  centerArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#111',
    overflow: 'hidden',
    minWidth: 0,
  },
  // 顶部工具条
  topToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: CARD_BG,
    borderBottom: `1px solid #e2e8f0`,
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  topToolbarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    borderRight: '1px solid #e2e8f0',
  },
  topToolbarSectionLast: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  select: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: 12,
    color: PRIMARY,
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    minWidth: 180,
  },
  slider: {
    width: 120,
    accentColor: PRIMARY,
    cursor: 'pointer',
  },
  sliderVal: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: 600,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  imgCounter: {
    fontSize: 13,
    color: '#1e3a5f',
    fontWeight: 700,
    background: '#f0f4f8',
    padding: '4px 12px',
    borderRadius: 20,
    border: `1px solid #cbd5e1`,
  },
  layoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    transition: 'all 0.15s',
  },
  layoutBtnActive: {
    background: PRIMARY,
    borderColor: PRIMARY,
  },
  presetBtn: {
    padding: '4px 10px',
    borderRadius: 20,
    border: `1px solid #cbd5e1`,
    background: '#fff',
    color: '#475569',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  presetBtnActive: {
    background: PRIMARY,
    color: '#fff',
    borderColor: PRIMARY,
  },
  fullscreenBtn: {
    marginLeft: 'auto',
    padding: '4px 8px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
  },
  // 影像主显示区
  imageMain: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'crosshair',
  },
  imageWrapper: {
    position: 'relative' as const,
    border: `2px solid #334155`,
    background: '#000',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 影像叠加信息
  overlayTL: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  overlayTR: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'right' as const,
  },
  overlayBL: {
    position: 'absolute' as const,
    bottom: 8,
    left: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  overlayBR: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'right' as const,
  },
  // 底部序列缩略图
  seriesStrip: {
    height: 100,
    background: '#0d1117',
    borderTop: `1px solid #1e2533`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px',
    overflowX: 'auto',
    flexShrink: 0,
  },
  seriesThumb: {
    width: 72,
    height: 72,
    borderRadius: 6,
    border: '2px solid #333',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
    transition: 'all 0.2s',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  seriesThumbActive: {
    border: `2px solid ${PRIMARY}`,
    boxShadow: `0 0 12px ${PRIMARY}`,
  },
  seriesThumbInner: {
    width: 48,
    height: 48,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: '#fff',
    fontWeight: 700,
  },
  // 窗宽窗位弹出
  wlPopup: {
    position: 'absolute' as const,
    left: 60,
    top: 60,
    width: 240,
    background: CARD_BG,
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    border: `1px solid #e2e8f0`,
    zIndex: 100,
    padding: 12,
  },
  wlPopupTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  wlSliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  wlLabel: {
    fontSize: 12,
    color: '#64748b',
    width: 36,
    flexShrink: 0,
  },
  wlSlider: {
    flex: 1,
    accentColor: PRIMARY,
  },
  wlVal: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: 700,
    width: 40,
    textAlign: 'right' as const,
  },
  // 测量子菜单
  measureMenu: {
    position: 'absolute' as const,
    left: 60,
    top: 280,
    background: CARD_BG,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    border: `1px solid #e2e8f0`,
    zIndex: 100,
    padding: 6,
    minWidth: 140,
  },
  measureMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    color: '#475569',
    transition: 'all 0.15s',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left' as const,
  },
  // ---- 右侧面板 ----
  rightPanel: {
    width: 280,
    background: CARD_BG,
    borderLeft: `1px solid #e2e8f0`,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    flexShrink: 0,
    boxShadow: '-2px 0 8px rgba(0,0,0,0.05)',
  },
  rightTabs: {
    display: 'flex',
    borderBottom: `2px solid #e2e8f0`,
    background: '#f8fafc',
    flexShrink: 0,
  },
  rightTab: {
    flex: 1,
    padding: '10px 4px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
    transition: 'all 0.15s',
    borderBottom: `2px solid transparent`,
    marginBottom: -2,
  },
  rightTabActive: {
    color: PRIMARY,
    borderBottom: `2px solid ${PRIMARY}`,
    background: '#fff',
  },
  rightPanelContent: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoSectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: PRIMARY,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 6,
    borderBottom: `1px solid #e2e8f0`,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  infoValue: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: 600,
  },
  infoValueFull: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  // 报告状态
  reportStatusCard: {
    background: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    border: `1px solid #e2e8f0`,
  },
  reportStatusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  reportBtn: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    transition: 'all 0.15s',
  },
  // 测量列表
  measureListItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    background: '#f8fafc',
    borderRadius: 6,
    marginBottom: 4,
    border: `1px solid #e2e8f0`,
  },
  measureListItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  measureListItemDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  // MPR标签
  mprTabs: {
    display: 'flex',
    gap: 4,
    marginTop: 12,
  },
  mprTab: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: 8,
    border: `1px solid #e2e8f0`,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textAlign: 'center' as const,
    transition: 'all 0.15s',
  },
  mprTabActive: {
    background: PRIMARY,
    color: '#fff',
    borderColor: PRIMARY,
  },
  // 底部状态栏
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '5px 16px',
    background: '#0d1117',
    borderTop: `1px solid #1e2533`,
    fontSize: 12,
    color: '#6b7280',
    flexShrink: 0,
  },
  // 序列滑块区域
  seriesNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 8px',
  },
  // ---- 历史对比面板样式 ----
  historyPanel: {
    padding: 0,
  },
  // ---- 视图模式切换 ----
  viewModeTabs: {
    display: 'flex',
    gap: 4,
    padding: '8px 12px',
    background: '#f8fafc',
    borderBottom: `1px solid #e2e8f0`,
  },
  viewModeTab: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: 8,
    border: `1px solid #e2e8f0`,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textAlign: 'center' as const,
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  viewModeTabActive: {
    background: PRIMARY,
    color: '#fff',
    borderColor: PRIMARY,
  },
  // ---- VR控制面板 ----
  vrControlPanel: {
    padding: 12,
    borderBottom: `1px solid #e2e8f0`,
  },
  vrControlTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  vrSliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  vrSliderLabel: {
    fontSize: 12,
    color: '#64748b',
    width: 50,
    flexShrink: 0,
  },
  vrSlider: {
    flex: 1,
    accentColor: PRIMARY,
  },
  vrSliderVal: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: 600,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  vrResetBtn: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: PRIMARY,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    fontFamily: 'inherit',
  },
  // ---- MIP控制面板 ----
  mipControlPanel: {
    padding: 12,
    borderBottom: `1px solid #e2e8f0`,
  },
  mipControlTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  mipDirRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 10,
  },
  mipDirBtn: {
    flex: 1,
    padding: '5px 4px',
    borderRadius: 6,
    border: `1px solid #cbd5e1`,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textAlign: 'center' as const,
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  mipDirBtnActive: {
    background: PRIMARY,
    color: '#fff',
    borderColor: PRIMARY,
  },
  mipFrameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  mipFrameLabel: {
    fontSize: 12,
    color: '#64748b',
    flexShrink: 0,
  },
  mipFrameVal: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: 600,
    minWidth: 50,
  },
  // ---- VR 3D画布容器 ----
  vrCanvasContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  // ---- MIP 画布 ----
  mipCanvasContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  historySearchRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
  },
  historySearchInput: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
  },
  historySearchBtn: {
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: PRIMARY,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  historyListItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    marginBottom: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  historyListItemSelected: {
    border: '2px solid #3b82f6',
    background: '#eff6ff',
  },
  historyListItemChecked: {
    border: '2px solid #22c55e',
    background: '#f0fdf4',
  },
  historyCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: '2px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
    cursor: 'pointer',
  },
  historyCheckboxChecked: {
    background: '#22c55e',
    borderColor: '#22c55e',
  },
  historyListItemContent: {
    flex: 1,
    minWidth: 0,
  },
  historyListItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyListItemTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1e293b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  historyListItemDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  historyListItemMeta: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.4,
  },
  historyListItemStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 6px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    marginTop: 4,
  },
  historyListEmpty: {
    textAlign: 'center' as const,
    padding: '24px 12px',
    color: '#94a3b8',
    fontSize: 12,
  },
  historyListEmptyIcon: {
    marginBottom: 8,
    opacity: 0.5,
  },
  // ---- 对比模式样式 ----
  compareToolbarBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s',
  },
  compareToolbarBtnActive: {
    background: '#3b82f6',
    borderColor: '#3b82f6',
    color: '#fff',
  },
  compareSplitContainer: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  compareSplitPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  compareDivider: {
    width: 4,
    background: PRIMARY,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareDividerHandle: {
    width: 12,
    height: 40,
    background: PRIMARY,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'col-resize',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
  },
  compareLabel: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    background: 'rgba(30,58,95,0.9)',
    color: '#fff',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    zIndex: 10,
  },
  compareLabelRight: {
    left: 'auto',
    right: 8,
  },
  // ---- 差异高亮样式 ----
  diffHighlightOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    zIndex: 5,
  },
  diffRegion: {
    position: 'absolute' as const,
    border: '2px dashed #ef4444',
    background: 'rgba(239,68,68,0.15)',
    borderRadius: 4,
  },
  diffRegionNew: {
    border: '2px dashed #22c55e',
    background: 'rgba(34,197,94,0.15)',
  },
  diffRegionImproved: {
    border: '2px dashed #3b82f6',
    background: 'rgba(59,130,246,0.15)',
  },
  // ---- 对比信息卡片 ----
  compareInfoCard: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    padding: 10,
    marginBottom: 8,
  },
  compareInfoCardTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  compareInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  compareInfoRowLast: {
    borderBottom: 'none',
  },
  compareInfoLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  compareInfoValue: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1e293b',
  },
  compareInfoValueIncrease: {
    color: '#22c55e',
  },
  compareInfoValueDecrease: {
    color: '#ef4444',
  },
  compareInfoNoChange: {
    color: '#94a3b8',
  },
  // ---- 同步滚动控制 ----
  syncScrollBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '3px 8px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
  },
  syncScrollBadgeOn: {
    background: '#dcfce7',
    color: '#16a34a',
  },
  syncScrollBadgeOff: {
    background: '#f1f5f9',
    color: '#64748b',
  },
  // ---- 差异摘要 ----
  diffSummaryCard: {
    background: '#fefce8',
    border: '1px solid #fef08a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  diffSummaryTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#a16207',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  diffSummaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 0',
    fontSize: 12,
    color: '#713f12',
  },
  diffSummaryDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  // ---- 历史列表操作栏 ----
  historyActionBar: {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap' as const,
  },
  historyActionBtn: {
    flex: 1,
    minWidth: 60,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    transition: 'all 0.15s',
  },
  historyActionBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  // ---- 对比工具栏 ----
  compareToolbarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    borderRight: '1px solid #e2e8f0',
  },
  compareToolbarDivider: {
    width: 1,
    height: 20,
    background: '#e2e8f0',
  },
  // ---- 标注工具面板样式 ----
  annotationPanel: {
    position: 'absolute' as const,
    left: 60,
    top: 200,
    width: 200,
    background: CARD_BG,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    border: `1px solid #e2e8f0`,
    zIndex: 100,
    padding: 10,
  },
  annotationPanelTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  annotationTypeRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4,
    marginBottom: 8,
  },
  annotationTypeBtn: {
    width: '100%',
    height: 36,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    transition: 'all 0.15s',
    padding: 4,
  },
  annotationTypeBtnActive: {
    background: PRIMARY,
    borderColor: PRIMARY,
    color: '#fff',
  },
  annotationTypeBtnLabel: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center' as const,
  },
  annotationColorPicker: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 4,
    marginBottom: 8,
  },
  annotationColorBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  annotationColorBtnActive: {
    border: '2px solid #1e3a5f',
    transform: 'scale(1.1)',
  },
  annotationFontSizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  annotationFontSizeLabel: {
    fontSize: 12,
    color: '#64748b',
    flexShrink: 0,
  },
  annotationFontSizeInput: {
    flex: 1,
    padding: '4px 6px',
    borderRadius: 4,
    border: '1px solid #cbd5e1',
    fontSize: 12,
    outline: 'none',
    width: 50,
  },
  annotationListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    background: '#f8fafc',
    borderRadius: 6,
    marginBottom: 4,
    border: `1px solid #e2e8f0`,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  annotationListItemSelected: {
    border: '2px solid #3b82f6',
    background: '#eff6ff',
  },
  annotationListItemLocked: {
    opacity: 0.7,
  },
  annotationListItemActions: {
    display: 'flex',
    gap: 4,
    marginLeft: 'auto',
  },
  annotationActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    transition: 'all 0.15s',
  },
  // ---- 伪彩面板样式 ----
  pseudoColorPanel: {
    position: 'absolute' as const,
    left: 60,
    top: 320,
    width: 180,
    background: CARD_BG,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    border: `1px solid #e2e8f0`,
    zIndex: 100,
    padding: 10,
  },
  pseudoColorPanelTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pseudoColorBtn: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#475569',
    transition: 'all 0.15s',
    marginBottom: 4,
  },
  pseudoColorBtnActive: {
    background: PRIMARY,
    borderColor: PRIMARY,
    color: '#fff',
  },
  pseudoColorPreview: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: '1px solid rgba(0,0,0,0.1)',
    flexShrink: 0,
  },
  // ---- 交互式测量绘制样式 ----
  measureOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    zIndex: 8,
  },
  measurePoint: {
    position: 'absolute' as const,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#fff',
    border: '2px solid #22c55e',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none' as const,
  },
  measureLine: {
    position: 'absolute' as const,
    background: '#22c55e',
    height: 2,
    transformOrigin: '0 50%',
    pointerEvents: 'none' as const,
  },
  measureLabel: {
    position: 'absolute' as const,
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    pointerEvents: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  // ---- 标注叠加层样式 ----
  annotationOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    zIndex: 9,
  },
  annotationSvg: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
  },
  // ---- 测量列表增强样式 ----
  measureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: '#f8fafc',
    borderRadius: 8,
    marginBottom: 6,
    border: `1px solid #e2e8f0`,
  },
  measureItemColor: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  measureItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  measureItemValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1e293b',
  },
  measureItemType: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize' as const,
  },
  measureItemActions: {
    display: 'flex',
    gap: 4,
  },
  // ---- ROI测量工具栏样式 ----
  roiToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: '#f8fafc',
    borderBottom: `1px solid #e2e8f0`,
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  roiToolBtn: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s',
  },
  roiToolBtnActive: {
    background: PRIMARY,
    borderColor: PRIMARY,
    color: '#fff',
  },
  roiToolDivider: {
    width: 1,
    height: 24,
    background: '#e2e8f0',
    margin: '0 4px',
  },
  roiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600,
    marginRight: 4,
    whiteSpace: 'nowrap' as const,
  },
  exportBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: PRIMARY,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  // ---- 对比模式增强样式 ----
  compareToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: '#f8fafc',
    borderBottom: `1px solid #e2e8f0`,
    flexShrink: 0,
  },
  compareLayoutBtn: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s',
  },
  compareLayoutBtnActive: {
    background: PRIMARY,
    borderColor: PRIMARY,
    color: '#fff',
  },
  compareSeriesSelect: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: 12,
    color: PRIMARY,
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    minWidth: 140,
  },
  compareControlBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: 'none',
  },
  compareControlBadgeOn: {
    background: PRIMARY,
    color: '#fff',
  },
  compareControlBadgeOff: {
    background: '#e2e8f0',
    color: '#64748b',
  },
}

// ============================================================
// 工具提示组件
// ============================================================
function Tooltip({ children, title }: { children: React.ReactNode; title: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: 8,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
        }}>
          {title}
        </div>
      )}
    </div>
  )
}

// ============================================================
// MIP最大密度投影组件
// ============================================================
function MIPCanvas({
  mipDirection,
  mipFrame,
  totalFrames,
  ww, wl,
}: {
  mipDirection: MipDirection
  mipFrame: number
  totalFrames: number
  ww: number
  wl: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 512
    const h = 512
    canvas.width = w
    canvas.height = h

    // 模拟多层CT数据投影
    const project = () => {
      const imageData = ctx.createImageData(w, h)
      const data = imageData.data

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4
          const dx = px - w / 2
          const dy = py - h / 2
          const dist = Math.sqrt(dx * dx + dy * dy)

          let maxVal = 0
          const steps = mipDirection === 'axial' ? 60 : 40

          for (let s = 0; s < steps; s++) {
            const offset = (s / steps - 0.5) * 120
            let v = 15

            if (dist < 200) {
              const nx = dx / 200
              const ny = (dy + offset) / 200
              const lungL = Math.sqrt((dx + 80) ** 2 + (dy + offset + 20) ** 2)
              const lungR = Math.sqrt((dx - 80) ** 2 + (dy + offset + 20) ** 2)
              if (lungL < 55 || lungR < 55) {
                v = 15
              } else {
                v = 45 + Math.sin(nx * 3 + ny * 2) * 8
                const heart = Math.sqrt((dx - 10) ** 2 + (dy + offset + 30) ** 2)
                if (heart < 60) v = 55 + Math.sin(nx * 5 + ny * 4) * 6
                if (Math.abs(dx) < 20 && dy + offset > 80 && dy + offset < 110) v = 70
                const ribDist = Math.abs(Math.sqrt((dy + offset) ** 2 + ((dx % 40) - 20) ** 2) - 120)
                if (ribDist < 8 && dy + offset < 60) v = 85
              }
            }

            if (v > maxVal) maxVal = v
          }

          const minV = wl - ww / 2
          const maxV = wl + ww / 2
          const norm = Math.max(0, Math.min(1, (maxVal - minV) / (maxV - minV)))
          const gray = Math.round(norm * 255)

          data[idx] = gray
          data[idx + 1] = gray
          data[idx + 2] = gray
          data[idx + 3] = 255
        }
      }
      ctx.putImageData(imageData, 0, 0)
    }

    project()
  }, [mipDirection, mipFrame, ww, wl])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 512,
        height: 512,
        imageRendering: 'pixelated',
      }}
    />
  )
}

// ============================================================
// VR体绘制组件 (Three.js)
// ============================================================
function VRCanvas({
  rotX, rotY, rotZ,
  opacity,
}: {
  rotX: number; rotY: number; rotZ: number
  opacity: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return

    const THREE = require('three')
    const container = containerRef.current
    const w = container.clientWidth || 512
    const h = container.clientHeight || 512

    // Scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 1000)
    camera.position.z = 500

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setClearColor(0x000000, 0)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 创建多层canvas模拟体数据
    const geometry = new THREE.BoxGeometry(w * 0.6, h * 0.6, 100)
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uOpacity: { value: opacity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vPosition = position;
          vNormal = normalMatrix * normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uTime;
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          float dist = length(vPosition.xy) / 200.0;
          float edge = 1.0 - smoothstep(0.5, 1.0, dist);
          vec3 color = mix(vec3(0.1, 0.3, 0.6), vec3(0.2, 0.7, 0.9), edge);
          float alpha = edge * uOpacity * 0.7;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // 添加边框线
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4a90d9, linewidth: 1 })
    const wireframe = new THREE.LineSegments(edges, lineMat)
    scene.add(wireframe)

    // 动画循环
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      material.uniforms.uTime.value += 0.01
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationRef.current)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [])

  // 更新旋转
  useEffect(() => {
    if (!sceneRef.current) return
    const THREE = require('three')
    const scene = sceneRef.current
    scene.rotation.set(
      (rotX * Math.PI) / 180,
      (rotY * Math.PI) / 180,
      (rotZ * Math.PI) / 180
    )
  }, [rotX, rotY, rotZ])

  // 更新透明度
  useEffect(() => {
    if (!sceneRef.current) return
    const scene = sceneRef.current
    scene.traverse((obj: any) => {
      if (obj.material && obj.material.uniforms && obj.material.uniforms.uOpacity) {
        obj.material.uniforms.uOpacity.value = opacity
      }
    })
  }, [opacity])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ============================================================
// DICOM Canvas渲染组件 - 真实窗宽窗位调整
// ============================================================
function DicomCanvas({
  zoom, rotation, flipH, flipV, ww, wl, brightness, contrast, invert,
  activeTool, panX, panY, windowPreset, measureType, activeSeries,
  imageIndex, images, pseudoColorMode,
  onWheel
}: {
  zoom: number; rotation: number; flipH: boolean; flipV: boolean;
  ww: number; wl: number; brightness: number; contrast: number; invert?: boolean;
  activeTool: Tool; panX: number; panY: number;
  windowPreset: string; measureType: MeasureSubMenu;
  activeSeries: Series; imageIndex: number; images: DicomImage[];
  pseudoColorMode?: PseudoColorMode;
  onWheel?: (deltaY: number, deltaX: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const img = images[imageIndex] || images[0]
  const w = 512
  const h = 512

  // 伪彩映射表
  const applyPseudoColor = (gray: number, mode: PseudoColorMode) => {
    let r = gray, g = gray, b = gray
    if (mode === 'hotIron') {
      if (gray < 85) { r = 0; g = 0; b = gray * 3 }
      else if (gray < 170) { r = (gray - 85) * 3; g = 0; b = 255 - (gray - 85) * 3 }
      else { r = 255; g = (gray - 170) * 3; b = 0 }
    } else if (mode === 'coolBlue') {
      if (gray < 128) { r = 0; g = gray * 2; b = 255 - gray }
      else { r = (gray - 128) * 2; g = 255 - (gray - 128); b = 128 }
    } else if (mode === 'pet') {
      const colors = ['#0000ff', '#00ff00', '#ffff00', '#ff8800', '#ff0000']
      const idx = Math.floor(gray / 51)
      r = gray; g = gray; b = gray
    } else if (mode === 'softTissue') {
      r = Math.min(255, gray * 1.2); g = Math.min(255, gray * 1.1); b = Math.min(255, gray * 0.9)
    }
    return { r, g, b }
  }

  // 根据窗宽窗位计算灰度
  const windowLevel = (base: number, windowCenter: number, windowWidth: number): number => {
    const min = windowCenter - windowWidth / 2
    const max = windowCenter + windowWidth / 2
    const normalized = (base - min) / (max - min)
    return Math.max(0, Math.min(1, normalized))
  }

  // 生成CT横断面图像数据
  const generateCTData = () => {
    const data = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2
        const dy = y - h / 2
        const dist = Math.sqrt(dx * dx + dy * dy)
        let v = 20 // 空气/HU值
        // 身体轮廓
        if (dist < 200) {
          const nx = dx / 200
          const ny = dy / 200
          // 肺野（低密度）
          const lungL = Math.sqrt((dx + 80) ** 2 + (dy + 20) ** 2)
          const lungR = Math.sqrt((dx - 80) ** 2 + (dy + 20) ** 2)
          if (lungL < 55 || lungR < 55) {
            v = -800 + Math.random() * 100 // 肺组织HU约-800
          } else {
            // 软组织（约40-60HU）
            v = 45 + Math.sin(nx * 3 + ny * 2) * 8 + Math.random() * 5
            // 心脏（肌肉组织约30-50HU）
            const heart = Math.sqrt((dx - 10) ** 2 + (dy + 30) ** 2)
            if (heart < 60) {
              v = 50 + Math.sin(nx * 5 + ny * 4) * 6
            }
            // 肝脏/腹部（约30-60HU）
            if (dy > 60 && dy < 140) {
              v = 50 + Math.sin(ny * 0.1) * 5
            }
            // 脊椎（骨骼约200-400HU）
            if (Math.abs(dx) < 20 && dy > 80 && dy < 110) {
              v = 250
            }
            // 肋骨（骨骼约200-400HU）
            const ribDist = Math.abs(Math.sqrt(dy ** 2 + ((dx % 40) - 20) ** 2) - 120)
            if (ribDist < 8 && dy < 60) {
              v = 300 + Math.random() * 50
            }
          }
        }
        // 转换为0-255范围（假设HU范围-1024到3072）
        data[y * w + x] = Math.max(0, Math.min(255, ((v + 1024) / 4096) * 255))
      }
    }
    return data
  }

  // 生成MR图像数据
  const generateMRData = () => {
    const data = new Uint8Array(w * h * 3)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2
        const dy = y - h / 2
        const dist = Math.sqrt(dx * dx + dy * dy)
        let v = 30
        if (dist < 200) {
          const brain = Math.sqrt((dx - 5) ** 2 + (dy - 10) ** 2)
          if (brain < 120) {
            v = 60 + Math.sin(dx * 0.08) * 15 + Math.cos(dy * 0.1) * 15
            // 脑室（低信号）
            if (Math.abs(dx - 5) < 15 && dy < -20 && dy > -60) v = 20
          }
        }
        const idx = (y * w + x) * 3
        data[idx] = Math.max(0, Math.min(255, v + 10))
        data[idx + 1] = Math.max(0, Math.min(255, v))
        data[idx + 2] = Math.max(0, Math.min(255, v - 5))
      }
    }
    return data
  }

  // 生成DR图像数据
  const generateDRData = () => {
    const data = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2
        const dy = y - h / 2
        let v = 180 // 背景密度
        // 肺部（低密度）
        if (dy < 50 && Math.abs(dx) > 40) {
          v = 40 + Math.random() * 30
        }
        // 心脏（高密度）
        if (dx > -60 && dx < 20 && dy > -80 && dy < -20) {
          v = 200 + Math.random() * 40
        }
        // 肋骨（高密度）
        const dist = Math.sqrt(dx * dx + dy * dy)
        const ribAngle = Math.atan2(dy, dx)
        if (dist < 180 && Math.abs(Math.sin(ribAngle * 6)) < 0.15 && dy < 0) {
          v = 220 + Math.random() * 35
        }
        data[y * w + x] = Math.max(0, Math.min(255, v))
      }
    }
    return data
  }

  // 渲染图像到Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.createImageData(w, h)
    const pixelData = imageData.data

    let rawData: Uint8Array
    if (activeSeries.modality === 'CT') {
      rawData = generateCTData()
    } else if (activeSeries.modality === 'MR') {
      rawData = generateMRData()
    } else {
      rawData = generateDRData()
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        const pixelIdx = idx * 4
        let r: number, g: number, b: number, gray: number

        if (activeSeries.modality === 'MR') {
          // MR图像为彩色
          r = rawData[idx * 3]
          g = rawData[idx * 3 + 1]
          b = rawData[idx * 3 + 2]
          // 应用窗宽窗位
          const wwFactor = ww / 400
          const wlFactor = (wl - 40) / 100
          r = Math.max(0, Math.min(255, r * wwFactor + wlFactor * 50))
          g = Math.max(0, Math.min(255, g * wwFactor + wlFactor * 50))
          b = Math.max(0, Math.min(255, b * wwFactor + wlFactor * 50))
        } else {
          // CT/DR灰度图像
          gray = rawData[idx]
          const windowedGray = windowLevel(gray * (ww / 400) + (wl - 40), 128, 256) * 255
          const finalGray = Math.max(0, Math.min(255, windowedGray))
          
          if (pseudoColorMode && pseudoColorMode !== 'none') {
            const pseudo = applyPseudoColor(finalGray, pseudoColorMode)
            r = pseudo.r; g = pseudo.g; b = pseudo.b
          } else {
            r = g = b = finalGray
          }
        }

        pixelData[pixelIdx] = r
        pixelData[pixelIdx + 1] = g
        pixelData[pixelIdx + 2] = b
        pixelData[pixelIdx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [ww, wl, brightness, contrast, activeSeries.modality, pseudoColorMode])

  // 鼠标滚轮处理WW/WL
  const handleWheel = (e: React.WheelEvent) => {
    if (onWheel) {
      onWheel(e.deltaY, e.deltaX)
    }
  }

  // 鼠标样式
  const cursorStyle = (() => {
    switch (activeTool) {
      case 'zoom': return 'zoom-in'
      case 'pan': return 'grab'
      case 'wl': return 'crosshair'
      case 'measure': return 'crosshair'
      case 'annotate': return 'crosshair'
      default: return 'default'
    }
  })()

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: w,
        height: h,
        transform: `translate(${panX}px, ${panY}px) scale(${zoom / 100}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
        filter: `brightness(${brightness}%) contrast(${contrast}%)${invert ? ' invert(1)' : ''}`,
        transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
        transformOrigin: 'center center',
        cursor: cursorStyle,
      }}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        style={{ display: 'block' }}
      />
      {/* 十字准星（标注模式） */}
      {activeTool === 'annotate' && (
        <svg
          width={w}
          height={h}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="rgba(255,0,0,0.5)" strokeWidth={1} strokeDasharray="4" />
          <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,0,0,0.5)" strokeWidth={1} strokeDasharray="4" />
        </svg>
      )}
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================
export default function DicomViewerPage() {
  // ---- 数据状态 ----
  const [selectedExamIdx, setSelectedExamIdx] = useState(0)
  const [exams, setExams] = useState(initialRadiologyExams)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await examApi.list({})
      if (cancelled) return
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setExams(res.data as unknown as typeof initialRadiologyExams)
        setLoadError(null)
      } else {
        setExams(initialRadiologyExams)
        setLoadError('API 不可用,使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const exam = exams[selectedExamIdx]

  const [seriesList] = useState<Series[]>(() => generateSeries(exam.modality))
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0)
  const activeSeries = seriesList[activeSeriesIdx]

  const [images] = useState<DicomImage[]>(() => generateImages(activeSeries))
  const [imageIndex, setImageIndex] = useState(Math.floor(images.length / 2))

  // ---- 工具状态 ----
  const [activeTool, setActiveTool] = useState<Tool>('zoom')
  const [measureSubMenu, setMeasureSubMenu] = useState<MeasureSubMenu>(null)
  const [showWlPopup, setShowWlPopup] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const playRef = useRef<NodeJS.Timeout | null>(null)

  // ---- 影像调整 ----
  const [zoom, setZoom] = useState(100)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [invert, setInvert] = useState(false)
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)
  const [activePresetIdx, setActivePresetIdx] = useState<number | null>(null)
  const [activeMprIdx, setActiveMprIdx] = useState(0)

  // ---- 3D后处理视图模式 ----
  const [viewMode, setViewMode] = useState<ViewMode>('MPR')
  const [mipDirection, setMipDirection] = useState<MipDirection>('axial')
  const [mipFrame, setMipFrame] = useState(30)
  const [vrRotX, setVrRotX] = useState(30)
  const [vrRotY, setVrRotY] = useState(45)
  const [vrRotZ, setVrRotZ] = useState(0)
  const [vrOpacity, setVrOpacity] = useState(0.8)

  // ---- DICOM文件导入状态 ----
  const [loadedDicomDataset, setLoadedDicomDataset] = useState<DicomDataset | null>(null)
  const [loadedPatientInfo, setLoadedPatientInfo] = useState<PatientInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dicomFileName, setDicomFileName] = useState<string>('')
  const [dicomError, setDicomError] = useState<string>('')
  // [v3.0.4.0] 窗位/窗宽预设:默认使用 CT 常用 6 套预设,生产应接入 useDicomStore
  const DEFAULT_DICOM_PRESETS: DicomWindowPreset[] = [
    { id: 'ct-soft', label: 'Soft Tissue', window: 400, level: 40 },
    { id: 'ct-lung', label: 'Lung', window: 1500, level: -600 },
    { id: 'ct-bone', label: 'Bone', window: 2000, level: 300 },
    { id: 'ct-brain', label: 'Brain', window: 80, level: 40 },
    { id: 'ct-liver', label: 'Liver', window: 150, level: 30 },
    { id: 'ct-angio', label: 'Angio', window: 700, level: 100 },
  ]
  const [dicomPresets, setDicomPresets] = useState<DicomWindowPreset[]>(DEFAULT_DICOM_PRESETS)

  // ---- 布局 ----
  const [layout, setLayout] = useState<LayoutMode>('1x1')

  // ---- 右侧面板 ----
  const [rightTab, setRightTab] = useState<RightTab>('patient')

  // ---- 测量 ----
  const [measurements] = useState(mockMeasurements)

  // ---- 报告 ----
  const reportStatus = exam.status === '已完成' ? '已报告' :
    exam.status === '待报告' ? '待书写' :
      exam.status === '检查中' ? '检查中' : '未检查'

  // ---- Toast提示 ----
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000)
  }, [])

  // ---- 打印预览 ----
  const [showPrintPreview, setShowPrintPreview] = useState(false)

  // ---- 历史对比 ----
  const [historyExams] = useState<HistoryExam[]>(mockHistoryExams)
  // [v3.0.4.0] 选中对比的历史检查 ID;空数组表示"未选",允许选 2 项进行左右对比
  const [selectedHistoryExams, setSelectedHistoryExams] = useState<string[]>([])
  const [historySearchText, setHistorySearchText] = useState('')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [compareExam, setCompareExam] = useState<HistoryExam | null>(null)
  const [syncScroll, setSyncScroll] = useState(true)
  const [showDiffHighlight, setShowDiffHighlight] = useState(true)
  const [compareImageIndex, setCompareImageIndex] = useState(Math.floor(images.length / 2))
  const [compareLayout, setCompareLayout] = useState<CompareLayout>('leftRight')

  // ============================================================
  // 跨机构调阅状态
  // ============================================================
  const [externalInstitution, setExternalInstitution] = useState<string>('')
  const [externalSearchType, setExternalSearchType] = useState<'patientId' | 'patientName'>('patientId')
  const [externalSearchText, setExternalSearchText] = useState('')
  // [v3.0.4.0] 外部机构检索结果;空表示尚未检索或未命中,UI 给出"未找到匹配检查记录"提示
  const [externalSearchResults, setExternalSearchResults] = useState<ExternalExam[]>([])
  const [selectedExternalExam, setSelectedExternalExam] = useState<ExternalExam | null>(null)
  const [isExternalCompareMode, setIsExternalCompareMode] = useState(false)
  const [externalCompareLayout, setExternalCompareLayout] = useState<'leftRight' | 'topBottom'>('leftRight')
  const [archiveRequestStatus, setArchiveRequestStatus] = useState<string | null>(null)

  // ============================================================
  // 扩充功能状态 - 标注工具
  // ============================================================
  const [annotations, setAnnotations] = useState<Annotation[]>([
    // 初始示例标注
    { id: 'a1', type: 'text', x: 100, y: 100, text: '病灶区域', color: '#ff0000', fontSize: 14, visible: true, locked: false },
    { id: 'a2', type: 'arrow', x: 150, y: 150, x2: 250, y2: 200, color: '#00ff00', fontSize: 12, visible: true, locked: false },
    { id: 'a3', type: 'rect', x: 200, y: 200, x2: 300, y2: 280, color: '#ffff00', fontSize: 12, visible: true, locked: true },
  ])
  const [activeAnnotationType, setActiveAnnotationType] = useState<AnnotationType>('text')
  const [activeAnnotationColor, setActiveAnnotationColor] = useState('#ff0000')
  const [activeAnnotationFontSize, setActiveAnnotationFontSize] = useState(14)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
  const [annotationInputText, setAnnotationInputText] = useState('')
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)
  const [showAnnotationColorPicker, setShowAnnotationColorPicker] = useState(false)

  // ============================================================
  // 扩充功能状态 - 交互式测量
  // ============================================================
  // [v3.0.4.0] 用户当前会话内的交互式测量;空数组表示未开始,提交后由"保存到报告"按钮写入 RadiologyReport.measurements
  const [interactiveMeasures, setInteractiveMeasures] = useState<InteractiveMeasure[]>([])
  const [isDrawingMeasure, setIsDrawingMeasure] = useState(false)
  // [v3.0.4.0] 测量绘制过程中暂存的点序列(2 端点 = 长度,3+ 端点 = 折线);提交后清空
  const [drawingPoints, setDrawingPoints] = useState<MeasurePoint[]>([])
  const [tempMeasureValue, setTempMeasureValue] = useState<{ value: number; unit: string } | null>(null)

  // ============================================================
  // 扩充功能状态 - 伪彩显示
  // ============================================================
  const [pseudoColorMode, setPseudoColorMode] = useState<PseudoColorMode>('none')
  const [showPseudoColorPanel, setShowPseudoColorPanel] = useState(false)

  // ============================================================
  // 扩充功能状态 - 增强对比
  // ============================================================
  // [v3.0.4.0] 对比序列列表;空表示"未选择对比序列",从 series 列表点击"加入对比"后填充
  const [compareSeriesList, setCompareSeriesList] = useState<Series[]>([])
  const [compareActiveSeriesIdx, setCompareActiveSeriesIdx] = useState(0)
  // [v3.0.4.0] 对比模式下的预加载图像缓存(避免重复 cornerstone 解码)
  const [compareImages, setCompareImages] = useState<DicomImage[]>([])
  const [showMeasurementsOverlay, setShowMeasurementsOverlay] = useState(true)
  const [showAnnotationsOverlay, setShowAnnotationsOverlay] = useState(true)

  // 同步滚动处理
  useEffect(() => {
    if (syncScroll && isCompareMode) {
      setCompareImageIndex(imageIndex)
    }
  }, [imageIndex, syncScroll, isCompareMode])

  // 历史检查选择/取消
  const toggleHistoryExam = (examId: string) => {
    setSelectedHistoryExams(prev => {
      if (prev.includes(examId)) {
        return prev.filter(id => id !== examId)
      }
      if (prev.length >= 2) {
        return [prev[1], examId]
      }
      return [...prev, examId]
    })
  }

  // 进入对比模式
  const enterCompareMode = () => {
    if (selectedHistoryExams.length === 1) {
      const exam = historyExams.find(h => h.id === selectedHistoryExams[0])
      if (exam) {
        setCompareExam(exam)
        setIsCompareMode(true)
      }
    } else if (selectedHistoryExams.length === 2) {
      const exam = historyExams.find(h => h.id === selectedHistoryExams[1])
      if (exam) {
        setCompareExam(exam)
        setIsCompareMode(true)
      }
    }
  }

  // 退出对比模式
  const exitCompareMode = () => {
    setIsCompareMode(false)
    setCompareExam(null)
    setCompareImageIndex(Math.floor(images.length / 2))
  }

  // 获取过滤后的历史检查
  const filteredHistoryExams = historyExams.filter(exam =>
    exam.examItemName.toLowerCase().includes(historySearchText.toLowerCase()) ||
    exam.examDate.includes(historySearchText) ||
    exam.modality.toLowerCase().includes(historySearchText.toLowerCase())
  )

  // 计算对比差异信息
  const getCompareDiffInfo = () => {
    if (!compareExam) return null
    const diffInfo: { label: string; oldVal: string; newVal: string; type: 'increase' | 'decrease' | 'new' | 'same' }[] = []
    // 模拟差异数据
    if (compareExam.examItemName.includes('CT')) {
      diffInfo.push({ label: '病灶大小', oldVal: '6mm', newVal: '8mm', type: 'increase' })
      diffInfo.push({ label: '病灶数量', oldVal: '1枚', newVal: '1枚', type: 'same' })
      diffInfo.push({ label: '性质描述', oldVal: '磨玻璃结节', newVal: '磨玻璃结节', type: 'same' })
    }
    return diffInfo
  }

  // ============================================================
  // 标注工具相关函数
  // ============================================================

  // 添加新标注
  const addAnnotation = (annotation: Omit<Annotation, 'id'>) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    setAnnotations(prev => [...prev, newAnnotation])
    return newAnnotation.id
  }

  // 更新标注
  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, ...updates } : ann))
  }

  // 删除标注
  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id))
    if (selectedAnnotationId === id) setSelectedAnnotationId(null)
  }

  // 清除所有标注
  const clearAllAnnotations = () => {
    setAnnotations([])
    setSelectedAnnotationId(null)
  }

  // 锁定/解锁标注
  const toggleAnnotationLock = (id: string) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, locked: !ann.locked } : ann))
  }

  // 切换标注可见性
  const toggleAnnotationVisibility = (id: string) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, visible: !ann.visible } : ann))
  }

  // ============================================================
  // 交互式测量相关函数
  // ============================================================

  // 计算两点间距离（像素）
  const calculateDistance = (p1: MeasurePoint, p2: MeasurePoint): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  }

  // 计算角度（三点）
  const calculateAngle = (p1: MeasurePoint, vertex: MeasurePoint, p2: MeasurePoint): number => {
    const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y }
    const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y }
    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
    if (mag1 === 0 || mag2 === 0) return 0
    const cosAngle = dot / (mag1 * mag2)
    return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
  }

  // 计算多边形面积（使用鞋带公式）
  const calculatePolygonArea = (points: MeasurePoint[]): number => {
    if (points.length < 3) return 0
    let area = 0
    const n = points.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }
    return Math.abs(area) / 2
  }

  // 计算椭圆面积（两点确定外接矩形，长短轴计算）
  const calculateEllipseArea = (p1: MeasurePoint, p2: MeasurePoint): number => {
    const a = Math.abs(p2.x - p1.x) / 2 // 半长轴
    const b = Math.abs(p2.y - p1.y) / 2 // 半短轴
    return Math.PI * a * b
  }

  // 计算矩形面积（两点确定对角顶点）
  const calculateRectangleArea = (p1: MeasurePoint, p2: MeasurePoint): number => {
    const width = Math.abs(p2.x - p1.x)
    const height = Math.abs(p2.y - p1.y)
    return width * height
  }

  // 计算圆形面积（两点确定半径）
  const calculateCircleArea = (p1: MeasurePoint, p2: MeasurePoint): number => {
    const radius = calculateDistance(p1, p2)
    return Math.PI * radius * radius
  }

  // 模拟获取像素位置的CT值(HU)
  const getCTValueAtPoint = (x: number, y: number): number => {
    // 基于模拟图像的位置生成不同的HU值
    const centerX = 256, centerY = 256
    const dx = x - centerX
    const dy = y - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    // 模拟不同组织的CT值范围
    if (dist < 200) {
      // 身体轮廓内
      const lungDistL = Math.sqrt(Math.pow(dx + 80, 2) + Math.pow(dy + 20, 2))
      const lungDistR = Math.sqrt(Math.pow(dx - 80, 2) + Math.pow(dy + 20, 2))
      if (lungDistL < 55 || lungDistR < 55) {
        // 肺野 -800 ~ -400 HU
        return Math.round(-600 + Math.random() * 200 - 100)
      }
      const heartDist = Math.sqrt(Math.pow(dx - 10, 2) + Math.pow(dy + 30, 2))
      if (heartDist < 60) {
        // 心脏 40 ~ 60 HU
        return Math.round(40 + Math.random() * 20)
      }
      // 软组织 20 ~ 60 HU
      return Math.round(30 + Math.random() * 30)
    }
    // 背景空气 -1000 HU
    return Math.round(-1000 + Math.random() * 20)
  }

  // 获取测量类型的中文标签
  const getMeasureTypeLabel = (type: Measurement['type']): string => {
    const labels: Record<Measurement['type'], string> = {
      line: '长度测量',
      angle: '角度测量',
      ellipse: '椭圆ROI',
      rectangle: '矩形ROI',
      circle: '圆ROI',
      ctvalue: 'CT值采样',
    }
    return labels[type] || type
  }

  // 导出测量报告
  const exportMeasurements = (format: 'clipboard' | 'json') => {
    const report = {
      patientName: exam.patientName,
      examDate: exam.examDate,
      examItem: exam.examItemName,
      exportTime: new Date().toISOString(),
      measurements: interactiveMeasures.map(m => ({
        id: m.id,
        type: m.type,
        typeLabel: getMeasureTypeLabel(m.type),
        value: m.value,
        unit: m.unit,
        label: m.label,
        points: m.points,
      })),
    }

    const jsonStr = JSON.stringify(report, null, 2)

    if (format === 'clipboard') {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('测量报告已复制到剪贴板')
      }).catch(() => {
        // 剪贴板失败，下载JSON
        downloadJSON(report)
      })
    } else {
      downloadJSON(report)
    }
  }

  const downloadJSON = (report: object) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `measurement_report_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 根据测量类型完成测量
  const finalizeMeasure = useCallback(() => {
    if (drawingPoints.length === 0) return

    const measureType = measureSubMenu
    if (!measureType) return

    let value = 0
    let unit = ''
    let color = '#22c55e'
    let label = ''

    if (measureType === 'line' && drawingPoints.length >= 2) {
      const pixelDist = calculateDistance(drawingPoints[0], drawingPoints[1])
      const img = images[imageIndex] || images[0]
      const mmDist = pixelDist * (img?.pixelSpacing || 0.68)
      value = parseFloat(mmDist.toFixed(2))
      unit = 'mm'
      color = '#22c55e'
      label = `长度: ${value} ${unit}`
    } else if (measureType === 'angle' && drawingPoints.length >= 3) {
      value = parseFloat(calculateAngle(drawingPoints[0], drawingPoints[1], drawingPoints[2]).toFixed(1))
      unit = '°'
      color = '#f59e0b'
      label = `角度: ${value}${unit}`
    } else if (measureType === 'ellipse' && drawingPoints.length >= 2) {
      const pixelArea = calculateEllipseArea(drawingPoints[0], drawingPoints[1])
      const img = images[imageIndex] || images[0]
      const mm2Area = pixelArea * Math.pow(img?.pixelSpacing || 0.68, 2)
      value = parseFloat(mm2Area.toFixed(2))
      unit = 'cm²'
      value = value / 100 // 转换为cm²
      color = '#8b5cf6'
      label = `椭圆: ${value.toFixed(2)} ${unit}`
    } else if (measureType === 'rectangle' && drawingPoints.length >= 2) {
      const pixelArea = calculateRectangleArea(drawingPoints[0], drawingPoints[1])
      const img = images[imageIndex] || images[0]
      const mm2Area = pixelArea * Math.pow(img?.pixelSpacing || 0.68, 2)
      value = parseFloat(mm2Area.toFixed(2))
      unit = 'cm²'
      value = value / 100 // 转换为cm²
      color = '#06b6d4'
      label = `矩形: ${value.toFixed(2)} ${unit}`
    } else if (measureType === 'circle' && drawingPoints.length >= 2) {
      const pixelArea = calculateCircleArea(drawingPoints[0], drawingPoints[1])
      const img = images[imageIndex] || images[0]
      const mm2Area = pixelArea * Math.pow(img?.pixelSpacing || 0.68, 2)
      value = parseFloat(mm2Area.toFixed(2))
      unit = 'cm²'
      value = value / 100 // 转换为cm²
      color = '#ec4899'
      label = `圆形: ${value.toFixed(2)} ${unit}`
    } else if ((measureType === 'ctvalue' || measureType === 'ct') && drawingPoints.length >= 1) {
      value = getCTValueAtPoint(drawingPoints[0].x, drawingPoints[0].y)
      unit = 'HU'
      color = '#3b82f6'
      label = `CT: ${value} ${unit}`
    } else if (measureType === 'area' && drawingPoints.length >= 3) {
      const pixelArea = calculatePolygonArea(drawingPoints)
      const img = images[imageIndex] || images[0]
      const mm2Area = pixelArea * Math.pow(img?.pixelSpacing || 0.68, 2)
      value = parseFloat(mm2Area.toFixed(2))
      unit = 'cm²'
      value = value / 100 // 转换为cm²
      color = '#8b5cf6'
      label = `面积: ${value.toFixed(2)} ${unit}`
    }

    const newMeasure: Measurement = {
      id: `measure_${Date.now()}`,
      type: measureType as Measurement['type'],
      points: drawingPoints.map(p => ({ x: p.x, y: p.y })),
      value,
      unit,
      label,
    }

    setInteractiveMeasures(prev => [...prev, { ...newMeasure, color, visible: true }])
    setDrawingPoints([])
    setIsDrawingMeasure(false)
    setTempMeasureValue(null)
  }, [drawingPoints, measureSubMenu, imageIndex, images])

  // 删除测量
  const deleteMeasure = (id: string) => {
    setInteractiveMeasures(prev => prev.filter(m => m.id !== id))
  }

  // 清除所有测量
  const clearAllMeasures = () => {
    setInteractiveMeasures([])
    setDrawingPoints([])
    setIsDrawingMeasure(false)
  }

  // ============================================================
  // 伪彩滤镜计算函数
  // ============================================================
  const applyPseudoColor = (grayValue: number, mode: PseudoColorMode): { r: number; g: number; b: number } => {
    const v = grayValue / 255

    switch (mode) {
      case 'hotIron':
        // 热铁伪彩：黑->蓝->红->黄->白
        if (v < 0.25) {
          return { r: 0, g: 0, b: Math.round(v * 4 * 255) }
        } else if (v < 0.5) {
          return { r: 0, g: Math.round((v - 0.25) * 4 * 255), b: 255 }
        } else if (v < 0.75) {
          return { r: Math.round((v - 0.5) * 4 * 255), g: 255, b: Math.round(255 - (v - 0.5) * 4 * 255) }
        } else {
          return { r: 255, g: 255, b: Math.round((v - 0.75) * 4 * 255) }
        }

      case 'coolBlue':
        // 冷蓝伪彩：黑->青->蓝->白
        if (v < 0.33) {
          return { r: 0, g: Math.round(v * 3 * 255), b: Math.round(v * 3 * 255) }
        } else if (v < 0.66) {
          return { r: 0, g: 255, b: Math.round((v - 0.33) * 3 * 255) }
        } else {
          return { r: Math.round((v - 0.66) * 3 * 255), g: 255, b: 255 }
        }

      case 'pet':
        // PET伪彩：彩虹色
        const colors = [
          { r: 0, g: 0, b: 255 },
          { r: 0, g: 255, b: 255 },
          { r: 0, g: 255, b: 0 },
          { r: 255, g: 255, b: 0 },
          { r: 255, g: 0, b: 0 },
          { r: 255, g: 0, b: 255 },
        ]
        const idx = v * (colors.length - 1)
        const i = Math.floor(idx)
        const t = idx - i
        const c1 = colors[Math.min(i, colors.length - 1)]
        const c2 = colors[Math.min(i + 1, colors.length - 1)]
        return {
          r: Math.round(c1.r + (c2.r - c1.r) * t),
          g: Math.round(c1.g + (c2.g - c1.g) * t),
          b: Math.round(c1.b + (c2.b - c1.b) * t),
        }

      case 'softTissue':
        // 软组织伪彩：青绿调
        return {
          r: Math.round(v * 200),
          g: Math.round(v * 220),
          b: Math.round(v * 200 + 55),
        }

      case 'grayscale':
      default:
        return { r: grayValue, g: grayValue, b: grayValue }
    }
  }

  // 差异高亮区域（模拟）
  const diffRegions = showDiffHighlight && isCompareMode ? [
    { id: 'd1', x: 180, y: 200, w: 60, h: 60, type: 'increase' as const },
    { id: 'd2', x: 280, y: 150, w: 40, h: 40, type: 'new' as const },
  ] : []

  // ---- 序列图像同步 ----
  useEffect(() => {
    setImageIndex(Math.floor(images.length / 2))
  }, [activeSeriesIdx])

  // ---- 滚轮切换图像 ----
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        setImageIndex(i => Math.min(i + 1, images.length - 1))
      } else {
        setImageIndex(i => Math.max(i - 1, 0))
      }
    }
    const el = document.getElementById('image-main-area')
    if (el) el.addEventListener('wheel', handleWheel)
    return () => { if (el) el.removeEventListener('wheel', handleWheel) }
  }, [images.length])

  // ---- 播放动画 ----
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setImageIndex(i => {
          if (i >= images.length - 1) {
            setIsPlaying(false)
            return 0
          }
          return i + 1
        })
      }, 150)
    } else {
      if (playRef.current) clearInterval(playRef.current)
    }
    return () => { if (playRef.current) clearInterval(playRef.current) }
  }, [isPlaying, images.length])

  // ---- 工具点击处理 ----
  const handleToolClick = (tool: Tool) => {
    if (tool === 'measure') {
      setActiveTool('measure')
      setMeasureSubMenu(measureSubMenu === null ? 'length' : null)
      setShowWlPopup(false)
    } else if (tool === 'wl') {
      setActiveTool('wl')
      setShowWlPopup(!showWlPopup)
      setMeasureSubMenu(null)
    } else if (tool === 'zoom') {
      setActiveTool('zoom')
      setShowWlPopup(false)
      setMeasureSubMenu(null)
    } else if (tool === 'pan') {
      setActiveTool('pan')
      setShowWlPopup(false)
      setMeasureSubMenu(null)
    } else if (tool === 'rotate') {
      setRotation(r => (r + 90) % 360)
    } else if (tool === 'flipH') {
      setFlipH(f => !f)
    } else if (tool === 'flipV') {
      setFlipV(f => !f)
    } else if (tool === 'reset') {
      setZoom(100); setPanX(0); setPanY(0); setRotation(0)
      setFlipH(false); setFlipV(false); setBrightness(100); setContrast(100); setInvert(false)
      setWw(400); setWl(40)
    } else if (tool === 'play') {
      setIsPlaying(p => !p)
    } else if (tool === 'print') {
      setShowPrintPreview(true)
    } else {
      setActiveTool(tool)
      setShowWlPopup(false)
      setMeasureSubMenu(null)
    }
  }

  const handlePresetClick = (preset: WindowPreset, idx: number) => {
    setWw(preset.ww)
    setWl(preset.wl)
    setActivePresetIdx(activePresetIdx === idx ? null : idx)
  }

  // 鼠标滚轮调整窗宽窗位（线性插值）
  const handleImageWheel = (deltaY: number, deltaX: number) => {
    const wwStep = 20
    const wlStep = 10
    // 垂直滚动调整窗宽
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      setWw(prev => Math.max(50, Math.min(4000, prev - deltaY * 0.5)))
    }
    // 水平滚动调整窗位
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setWl(prev => Math.max(-1000, Math.min(1000, prev + deltaX * 0.5)))
    }
    // 两者都没有时默认调整窗宽
    if (deltaY !== 0 || deltaX !== 0) {
      setActivePresetIdx(null)
    }
  }

  // 获取当前Modality对应的预设
  const getCurrentPresets = () => {
    if (exam.modality === 'CT') {
      return [
        { name: '肺窗', ww: 1500, wl: -600 },
        { name: '纵隔窗', ww: 400, wl: 40 },
        { name: '骨窗', ww: 2000, wl: 400 },
      ]
    }
    if (exam.modality === 'MR') {
      return [
        { name: 'T1', ww: 400, wl: 40 },
        { name: 'T2', ww: 800, wl: 200 },
        { name: 'FLAIR', ww: 1000, wl: 400 },
      ]
    }
    return [
      { name: '骨窗', ww: 2000, wl: 400 },
      { name: '软组织', ww: 400, wl: 40 },
    ]
  }

  const handleLayoutChange = (newLayout: LayoutMode) => {
    setLayout(newLayout)
  }

  const handleSeriesSelect = (idx: number) => {
    setActiveSeriesIdx(idx)
    setImageIndex(Math.floor(generateImages(seriesList[idx]).length / 2))
  }

  const handleExamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value)
    setSelectedExamIdx(idx)
  }

  const handleExternalSearch = () => {
    if (!externalInstitution) {
      showToast('请先选择外部机构')
      return
    }
    if (!externalSearchText.trim()) {
      showToast('请输入检索条件')
      return
    }
    const results = EXTERNAL_EXAMS.filter(exam => {
      if (exam.institutionId !== externalInstitution) return false
      if (externalSearchType === 'patientId') {
        return exam.patientId.toLowerCase().includes(externalSearchText.toLowerCase())
      } else {
        return exam.patientName.toLowerCase().includes(externalSearchText.toLowerCase())
      }
    })
    setExternalSearchResults(results)
    if (results.length === 0) {
      showToast('未找到匹配的检查记录')
    }
  }

  const handleArchiveRequest = () => {
    if (!selectedExternalExam) return
    setArchiveRequestStatus('pending')
    showToast('正在申请调阅...')
    setTimeout(() => {
      setArchiveRequestStatus('success')
      showToast('调阅申请已提交，请等待审核')
    }, 1500)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // ---- DICOM文件导入处理 ----
  const handleDicomFile = async (file: File) => {
    setDicomError('')
    setDicomFileName(file.name)

    try {
      const result = await loadDicomFile(file)

      if (!result.success || !result.dataset) {
        setDicomError(result.error || 'DICOM解析失败')
        return
      }

      const dataset = result.dataset
      setLoadedDicomDataset(dataset)

      // 提取患者信息
      const patientInfo = getPatientInfo(dataset)
      setLoadedPatientInfo(patientInfo)

      // 获取窗宽窗位
      const windowInfo = getWindowCenterWidth(dataset)
      setWw(windowInfo.windowWidth)
      setWl(windowInfo.windowCenter)

      // 获取推荐的预设
      const modality = getModality(dataset)
      const bodyPart = getBodyPart(dataset)
      const presets = getRecommendedPresets(modality, bodyPart)
      setDicomPresets(presets)

      // 自动选择第一个预设
      if (presets.length > 0) {
        setWw(presets[0].ww)
        setWl(presets[0].wl)
        setActivePresetIdx(0)
      }
    } catch (err) {
      setDicomError(err instanceof Error ? err.message : '未知错误')
    }
  }

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await handleDicomFile(files[0])
    }
  }

  // 文件选择处理
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleDicomFile(files[0])
    }
  }

  // 清除已加载的DICOM
  const clearDicomFile = () => {
    setLoadedDicomDataset(null)
    setLoadedPatientInfo(null)
    setDicomFileName('')
    setDicomError('')
    setDicomPresets([])
  }

  // ---- 布局网格配置 ----
  const gridConfig = {
    '1x1': { cols: 1, rows: 1 },
    '2x2': { cols: 2, rows: 2 },
    '1x2': { cols: 1, rows: 2 },
    '2x1': { cols: 2, rows: 1 },
  }[layout]

  const currentImage = images[imageIndex] || images[0]

  // ---- 工具按钮列表 ----
  const tools: { tool: Tool; icon: React.ReactNode; label: string; divider?: boolean }[] = [
    { tool: 'zoom', icon: <ZoomIn size={20} />, label: '缩放' },
    { tool: 'pan', icon: <Move size={20} />, label: '平移' },
    { tool: 'wl', icon: <Sun size={20} />, label: '窗口/级别' },
    { tool: 'rotate', icon: <RotateCw size={20} />, label: '旋转90°' },
    { tool: 'flipH', icon: <FlipHorizontal size={20} />, label: '水平翻转', divider: true },
    { tool: 'flipV', icon: <FlipVertical size={20} />, label: '垂直翻转' },
    { tool: 'reset', icon: <RefreshCw size={20} />, label: '重置', divider: true },
    { tool: 'measure', icon: <Ruler size={20} />, label: '测量' },
    { tool: 'annotate', icon: <PenTool size={20} />, label: '标注' },
    { tool: 'play', icon: isPlaying ? <Pause size={20} /> : <Play size={20} />, label: isPlaying ? '暂停' : '播放', divider: true },
    { tool: 'print', icon: <Printer size={20} />, label: '胶片打印' },
  ]

  // ============================================================
  // 伪彩工具按钮（独立于主工具栏）
  // ============================================================
  const pseudoColorTools: { mode: PseudoColorMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'none', icon: <EyeOff size={16} />, label: '原始' },
    { mode: 'hotIron', icon: <Flame size={16} />, label: '热铁' },
    { mode: 'coolBlue', icon: <Droplets size={16} />, label: '冷蓝' },
    { mode: 'pet', icon: <Activity size={16} />, label: 'PET' },
    { mode: 'softTissue', icon: <Wind size={16} />, label: '软组织' },
  ]

  // ============================================================
  // 标注工具按钮类型
  // ============================================================
  const annotationTypes: { type: AnnotationType; icon: React.ReactNode; label: string }[] = [
    { type: 'text', icon: <Type size={16} />, label: '文字' },
    { type: 'arrow', icon: <ArrowUpRight size={16} />, label: '箭头' },
    { type: 'rect', icon: <RectIcon size={16} />, label: '矩形' },
    { type: 'ellipse', icon: <CircleIcon size={16} />, label: '椭圆' },
  ]

  return (
    <>
      <ViewerSelector current="classic" />
      <div data-testid="dicom-viewer-page" style={s.root}>
      {loading && <LoadingBanner message="正在从 API 加载影像数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* =============================================== */}
      {/* 主体三栏布局 */}
      {/* =============================================== */}
      <div style={s.body}>

        {/* =============================================== */}
        {/* 左侧工具栏 */}
        {/* =============================================== */}
        <div style={s.leftToolbar}>
          {tools.map(({ tool, icon, label, divider }) => (
            <div key={tool}>
              {divider && <div style={s.toolDivider} />}
              <Tooltip title={label}>
                <button
                  style={{
                    ...s.toolBtn,
                    ...(activeTool === tool ? s.toolBtnActive : {}),
                  }}
                  onClick={() => handleToolClick(tool)}
                >
                  {icon}
                </button>
              </Tooltip>
            </div>
          ))}

          {/* 缩放滑块（当工具为zoom时显示） */}
          {activeTool === 'zoom' && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <button
                style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }}
                onClick={() => setZoom(z => Math.min(500, z + 20))}
              >
                <Plus size={14} color="#fff" />
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{zoom}%</span>
              <button
                style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }}
                onClick={() => setZoom(z => Math.max(10, z - 20))}
              >
                <Minus size={14} color="#fff" />
              </button>
            </div>
          )}

          {/* 旋转按钮 */}
          {activeTool === 'rotate' && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <button
                style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }}
                onClick={() => setRotation(r => (r + 90) % 360)}
              >
                <RotateCw size={14} color="#fff" />
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{rotation}°</span>
              <button
                style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }}
                onClick={() => setRotation(r => (r - 90 + 360) % 360)}
              >
                <RotateCcw size={14} color="#fff" />
              </button>
            </div>
          )}

          {/* 伪彩快捷按钮 - 始终显示 */}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Tooltip title="伪彩显示">
              <button
                style={{
                  ...s.toolBtn,
                  width: 36,
                  height: 28,
                  padding: 0,
                  ...(pseudoColorMode !== 'none' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}),
                }}
                onClick={() => setShowPseudoColorPanel(!showPseudoColorPanel)}
              >
                {pseudoColorMode === 'none' ? <EyeOff size={14} /> :
                  pseudoColorMode === 'hotIron' ? <Flame size={14} /> :
                    pseudoColorMode === 'coolBlue' ? <Droplets size={14} /> :
                      pseudoColorMode === 'pet' ? <Activity size={14} /> :
                        <Wind size={14} />}
              </button>
            </Tooltip>
            {pseudoColorMode !== 'none' && (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: pseudoColorMode === 'hotIron' ? '#ff4400' :
                  pseudoColorMode === 'coolBlue' ? '#0088ff' :
                    pseudoColorMode === 'pet' ? '#ff00ff' : '#00cc88',
              }} />
            )}
          </div>

          {/* 反色切换按钮 */}
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Tooltip title={invert ? '取消反色' : '反色显示'}>
              <button
                style={{
                  ...s.toolBtn,
                  width: 36,
                  height: 28,
                  padding: 0,
                  ...(invert ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}),
                }}
                onClick={() => setInvert(v => !v)}
              >
                {invert ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </Tooltip>
            {invert && <span style={{ fontSize: 10, color: '#fbbf24' }}>反色</span>}
          </div>

          {/* 标注工具快捷按钮 */}
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Tooltip title="标注工具">
              <button
                style={{
                  ...s.toolBtn,
                  width: 36,
                  height: 28,
                  padding: 0,
                  ...(activeTool === 'annotate' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}),
                }}
                onClick={() => {
                  setActiveTool('annotate')
                  setShowAnnotationPanel(!showAnnotationPanel)
                  setMeasureSubMenu(null)
                  setShowWlPopup(false)
                }}
              >
                <PenTool size={14} />
              </button>
            </Tooltip>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('dcmtool.annotate')}</span>
          </div>
        </div>

        {/* =============================================== */}
        {/* 中间影像区 */}
        {/* =============================================== */}
        <div style={s.centerArea}>

          {/* ---- ROI测量工具栏 ---- */}
          <div style={s.roiToolbar}>
            <span style={s.roiLabel}>📏 ROI工具:</span>
            <button
              style={{
                ...s.roiToolBtn,
                ...(measureSubMenu === 'line' ? s.roiToolBtnActive : {}),
              }}
              onClick={() => {
                setMeasureSubMenu('line')
                setActiveTool('measure')
              }}
              title="长度测量"
            >
              📏 长度
            </button>
            <button
              style={{
                ...s.roiToolBtn,
                ...(measureSubMenu === 'angle' ? s.roiToolBtnActive : {}),
              }}
              onClick={() => {
                setMeasureSubMenu('angle')
                setActiveTool('measure')
              }}
              title="角度测量"
            >
              📐 角度
            </button>
            <div style={s.roiToolDivider} />
            <button
              style={{
                ...s.roiToolBtn,
                ...(measureSubMenu === 'ellipse' ? s.roiToolBtnActive : {}),
              }}
              onClick={() => {
                setMeasureSubMenu('ellipse')
                setActiveTool('measure')
              }}
              title="椭圆ROI"
            >
              ⭕ 椭圆
            </button>
            <button
              style={{
                ...s.roiToolBtn,
                ...(measureSubMenu === 'rectangle' ? s.roiToolBtnActive : {}),
              }}
              onClick={() => {
                setMeasureSubMenu('rectangle')
                setActiveTool('measure')
              }}
              title="矩形ROI"
            >
              ▢ 矩形
            </button>
            <button
              style={{
                ...s.roiToolBtn,
                ...(measureSubMenu === 'circle' ? s.roiToolBtnActive : {}),
              }}
              onClick={() => {
                setMeasureSubMenu('circle')
                setActiveTool('measure')
              }}
              title="圆ROI"
            >
              🔘 圆形
            </button>
            <div style={s.roiToolDivider} />
            <button
              style={{
                ...s.roiToolBtn,
                ...(measureSubMenu === 'ctvalue' ? s.roiToolBtnActive : {}),
              }}
              onClick={() => {
                setMeasureSubMenu('ctvalue')
                setActiveTool('measure')
              }}
              title="CT值采样"
            >
              💉 CT值
            </button>
            <div style={s.roiToolDivider} />
            <button
              style={{
                ...s.roiToolBtn,
                color: '#ef4444',
              }}
              onClick={clearAllMeasures}
              title="清空全部测量"
            >
              🗑️ 清空
            </button>
            <button
              style={s.exportBtn}
              onClick={() => exportMeasurements('clipboard')}
              title="导出测量报告到剪贴板"
            >
              📋 导出报告
            </button>
          </div>

          {/* ---- 顶部工具条 ---- */}
          <div style={s.topToolbar}>
            {/* 检查选择 */}
            <div style={s.topToolbarSection}>
              <span style={s.label}>{t('dcm.examLabel')}</span>
              <select
                style={s.select}
                value={selectedExamIdx}
                onChange={handleExamChange}
              >
                {initialRadiologyExams.map((e, i) => (
                  <option key={e.id} value={i}>
                    {e.patientName} - {e.examItemName} ({e.modality})
                  </option>
                ))}
              </select>
            </div>

            {/* 序列滑块 */}
            <div style={s.topToolbarSection}>
              <span style={s.label}>{t('dcm.seriesLabel')}</span>
              <span style={{ ...s.sliderVal, minWidth: 24 }}>
                {activeSeriesIdx + 1}/{seriesList.length}
              </span>
              <input
                type="range"
                min={0}
                max={seriesList.length - 1}
                value={activeSeriesIdx}
                onChange={e => handleSeriesSelect(parseInt(e.target.value))}
                style={s.slider}
              />
            </div>

            {/* 图像计数 */}
            <div style={s.topToolbarSection}>
              <span style={s.label}>{t('dcm.imageLabel')}</span>
              <span style={s.imgCounter}>
                {imageIndex + 1} / {images.length}
              </span>
              <button
                style={{ ...s.toolBtn, color: PRIMARY, padding: '4px 6px', border: `1px solid #cbd5e1`, borderRadius: 6 }}
                onClick={() => setImageIndex(i => Math.max(0, i - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                style={{ ...s.toolBtn, color: PRIMARY, padding: '4px 6px', border: `1px solid #cbd5e1`, borderRadius: 6 }}
                onClick={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 布局切换 */}
            <div style={s.topToolbarSection}>
              <span style={s.label}>{t('dcm.layoutLabel')}</span>
              {(['1x1', '2x2', '1x2', '2x1'] as LayoutMode[]).map(l => (
                <button
                  key={l}
                  style={{
                    ...s.layoutBtn,
                    ...(layout === l ? s.layoutBtnActive : {}),
                  }}
                  onClick={() => handleLayoutChange(l)}
                  title={l}
                >
                  <Grid3x3 size={14} color={layout === l ? '#fff' : '#64748b'} />
                </button>
              ))}
            </div>

            {/* 3D后处理模式切换 */}
            <div style={s.topToolbarSection}>
              <span style={s.label}>{t('dcm.modeLabel')}</span>
              {(['MPR', 'MIP', 'VR'] as ViewMode[]).map(vm => (
                <button
                  key={vm}
                  style={{
                    ...s.presetBtn,
                    ...(viewMode === vm ? s.presetBtnActive : {}),
                    padding: '4px 8px',
                  }}
                  onClick={() => setViewMode(vm)}
                >
                  {vm}
                </button>
              ))}
            </div>

            {/* 窗值预设 - 按Modality自动切换 */}
            <div style={s.topToolbarSectionLast}>
              <span style={s.label}>{t('dcm.windowLabel')}</span>
              {getCurrentPresets().map((p, i) => (
                <button
                  key={p.name}
                  style={{
                    ...s.presetBtn,
                    ...(activePresetIdx === i + 100 ? s.presetBtnActive : {}),
                  }}
                  onClick={() => handlePresetClick(p, i + 100)}
                  title={`WW:${p.ww} WL:${p.wl}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* 历史对比按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
              <button
                style={{
                  ...s.compareToolbarBtn,
                  ...(rightTab === 'history' ? s.compareToolbarBtnActive : {}),
                }}
                onClick={() => setRightTab('history')}
                title="历史对比"
              >
                <History size={14} />{t('dcm.historyTab')}</button>
              {selectedHistoryExams.length > 0 && (
                <button
                  style={{
                    ...s.compareToolbarBtn,
                    ...(isCompareMode ? s.compareToolbarBtnActive : {}),
                  }}
                  onClick={isCompareMode ? exitCompareMode : enterCompareMode}
                  title={isCompareMode ? '退出对比' : '进入对比模式'}
                >
                  <GitCompare size={14} />
                  {isCompareMode ? '退出对比' : `对比(${selectedHistoryExams.length})`}
                </button>
              )}
            </div>

            {/* 网格+全屏 */}
            <button
              style={{
                ...s.layoutBtn,
                ...(showGrid ? s.layoutBtnActive : {}),
                marginLeft: 8,
              }}
              onClick={() => setShowGrid(g => !g)}
              title="网格"
            >
              <Grid3x3 size={14} color={showGrid ? '#fff' : '#64748b'} />
            </button>
            <button
              style={s.fullscreenBtn}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? '退出全屏' : '全屏'}
            </button>
          </div>

          {/* ---- 主影像显示区 ---- */}
          <div
            id="image-main-area"
            style={isCompareMode ? { ...s.imageMain, display: 'flex' } : s.imageMain}
            onClick={() => {
              if (activeTool === 'wl') setShowWlPopup(false)
              if (activeTool === 'measure') setMeasureSubMenu(null)
            }}
          >
            {isCompareMode ? (
              /* ===== 对比模式左右分屏 ===== */
              <div style={s.compareSplitContainer}>
                {/* 左侧：当前检查 */}
                <div style={s.compareSplitPane}>
                  <span style={s.compareLabel}>当前: {exam.examDate}</span>
                  <div style={{
                    ...s.imageWrapper,
                    width: '100%',
                    height: '100%',
                  }}>
                    <DicomCanvas
                      zoom={zoom}
                      rotation={rotation}
                      flipH={flipH}
                      flipV={flipV}
                      ww={ww}
                      wl={wl}
                      brightness={brightness}
                      contrast={contrast}
                      activeTool={activeTool}
                      panX={panX}
                      panY={panY}
                      windowPreset={WINDOW_PRESETS[activePresetIdx || 0]?.name || ''}
                      measureType={measureSubMenu}
                      activeSeries={activeSeries}
                      imageIndex={imageIndex}
                      images={images}
                      pseudoColorMode={pseudoColorMode}
                      invert={invert}
                    />
                    {/* 差异高亮叠加层 */}
                    {showDiffHighlight && diffRegions.map(region => (
                      <div
                        key={region.id}
                        style={{
                          ...s.diffRegion,
                          ...(region.type === 'increase' ? {} :
                              region.type === 'new' ? s.diffRegionNew :
                                s.diffRegionImproved),
                          left: region.x,
                          top: region.y,
                          width: region.w,
                          height: region.h,
                        }}
                      />
                    ))}
                  </div>
                  {/* 左下叠加信息 */}
                  <div style={s.overlayBL}>
                    <span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span>
                    <span style={{ color: '#86efac' }}>Img:{imageIndex + 1}/{images.length}</span>
                  </div>
                  <div style={s.overlayBR}>
                    <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
                  </div>
                </div>

                {/* 分屏分割线 */}
                <div style={s.compareDivider}>
                  <div style={s.compareDividerHandle}>
                    <ArrowLeftRight size={8} />
                  </div>
                </div>

                {/* 右侧：历史检查 */}
                <div style={s.compareSplitPane}>
                  <span style={{ ...s.compareLabel, ...s.compareLabelRight }}>
                    历史: {compareExam?.examDate}
                  </span>
                  <div style={{
                    ...s.imageWrapper,
                    width: '100%',
                    height: '100%',
                  }}>
                    <DicomCanvas
                      zoom={zoom}
                      rotation={rotation}
                      flipH={flipH}
                      flipV={flipV}
                      ww={ww}
                      wl={wl}
                      brightness={brightness}
                      contrast={contrast}
                      activeTool={activeTool}
                      panX={panX}
                      panY={panY}
                      windowPreset={WINDOW_PRESETS[activePresetIdx || 0]?.name || ''}
                      measureType={measureSubMenu}
                      activeSeries={activeSeries}
                      imageIndex={syncScroll ? imageIndex : compareImageIndex}
                      images={images}
                      pseudoColorMode={pseudoColorMode}
                      invert={invert}
                    />
                    {/* 差异高亮叠加层 */}
                    {showDiffHighlight && diffRegions.map(region => (
                      <div
                        key={`r-${region.id}`}
                        style={{
                          ...s.diffRegion,
                          ...(region.type === 'increase' ? {} :
                              region.type === 'new' ? s.diffRegionNew :
                                s.diffRegionImproved),
                          left: region.x,
                          top: region.y,
                          width: region.w,
                          height: region.h,
                        }}
                      />
                    ))}
                  </div>
                  {/* 右下叠加信息 */}
                  <div style={s.overlayBL}>
                    <span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span>
                    <span style={{ color: '#86efac' }}>
                      Img:{syncScroll ? imageIndex + 1 : compareImageIndex + 1}/{images.length}
                    </span>
                  </div>
                  <div style={s.overlayBR}>
                    <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
                    {!syncScroll && (
                      <span style={{ color: '#fbbf24' }}>独立滚动</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ===== 正常单图模式（支持MPR/MIP/VR切换） ===== */
              <div style={{
                ...s.imageWrapper,
                width: gridConfig.cols === 2 ? 'calc(50% - 4px)' : '100%',
                height: gridConfig.rows === 2 ? 'calc(50% - 4px)' : '100%',
              }}>
                {viewMode === 'MPR' && (
                  <DicomCanvas
                    zoom={zoom}
                    rotation={rotation}
                    flipH={flipH}
                    flipV={flipV}
                    ww={ww}
                    wl={wl}
                    brightness={brightness}
                    contrast={contrast}
                    activeTool={activeTool}
                    panX={panX}
                    panY={panY}
                    windowPreset={WINDOW_PRESETS[activePresetIdx || 0]?.name || ''}
                    measureType={measureSubMenu}
                    activeSeries={activeSeries}
                    imageIndex={imageIndex}
                    images={images}
                    pseudoColorMode={pseudoColorMode}
                    invert={invert}
                    onWheel={handleImageWheel}
                  />
                )}
                {viewMode === 'MIP' && (
                  <div style={s.mipCanvasContainer}>
                    <MIPCanvas
                      mipDirection={mipDirection}
                      mipFrame={mipFrame}
                      totalFrames={images.length}
                      ww={ww}
                      wl={wl}
                    />
                  </div>
                )}
                {viewMode === 'VR' && (
                  <div style={s.vrCanvasContainer}>
                    <VRCanvas
                      rotX={vrRotX}
                      rotY={vrRotY}
                      rotZ={vrRotZ}
                      opacity={vrOpacity}
                    />
                  </div>
                )}

                {/* 左上叠加信息 */}
                <div style={s.overlayTL}>
                  <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                    {exam.patientName}
                  </span>
                  <span style={{ color: '#94a3b8' }}>
                    #{exam.accessionNumber}
                  </span>
                  <span style={{ color: '#86efac' }}>
                    {exam.examItemName}
                  </span>
                  {viewMode !== 'MPR' && (
                    <span style={{ color: '#fbbf24' }}>{viewMode}模式</span>
                  )}
                </div>

                {/* 右上叠加信息 */}
                <div style={s.overlayTR}>
                  <span style={{ color: '#fbbf24' }}>
                    {exam.deviceName.split('（')[0]}
                  </span>
                  <span style={{ color: '#f87171' }}>
                    Ser:{activeSeries.seriesNumber} Img:{currentImage?.imageNumber || 1}
                  </span>
                  <span style={{ color: '#a5f3fc' }}>
                    {activeSeries.seriesDescription}
                  </span>
                </div>

                {/* 左下叠加信息 - 窗宽窗位预设快捷按钮 */}
                <div style={{ ...s.overlayBL, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>WW:{Math.round(ww)}</span>
                    <span style={{ color: '#f87171', fontWeight: 700 }}>WL:{Math.round(wl)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {getCurrentPresets().map((p, i) => (
                      <button
                        key={p.name}
                        onClick={() => handlePresetClick(p, i + 100)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.3)',
                          background: 'rgba(0,0,0,0.5)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <span style={{ color: '#86efac', fontSize: 12 }}>
                    滚轮调整WW/WL
                  </span>
                </div>

                {/* 右下叠加信息 */}
                <div style={s.overlayBR}>
                  {/* 手动窗宽窗位滑块 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ color: '#60a5fa', fontSize: 12 }}>WW</span>
                    <input
                      type="range"
                      min={50}
                      max={4000}
                      value={ww}
                      onChange={e => { setWw(Number(e.target.value)); setActivePresetIdx(null) }}
                      style={{ width: 80, accentColor: '#60a5fa' }}
                    />
                    <input
                      type="number"
                      value={Math.round(ww)}
                      onChange={e => { setWw(Number(e.target.value)); setActivePresetIdx(null) }}
                      style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#60a5fa' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ color: '#f87171', fontSize: 12 }}>WL</span>
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      value={wl}
                      onChange={e => { setWl(Number(e.target.value)); setActivePresetIdx(null) }}
                      style={{ width: 80, accentColor: '#f87171' }}
                    />
                    <input
                      type="number"
                      value={Math.round(wl)}
                      onChange={e => { setWl(Number(e.target.value)); setActivePresetIdx(null) }}
                      style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#f87171' }}
                    />
                  </div>
                  <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
                  <span style={{ color: '#a5f3fc' }}>
                    {flipH ? 'FH ' : ''}{flipV ? 'FV ' : ''}{invert ? 'Invert ' : ''}Bright:{brightness}% Contrast:{contrast}%
                  </span>
                  {measureSubMenu && (
                    <span style={{ color: '#fbbf24' }}>
                      测量模式:{measureSubMenu === 'length' ? '长度' : measureSubMenu === 'angle' ? '角度' : measureSubMenu === 'area' ? '面积' : 'CT值'}
                    </span>
                  )}
                  {pseudoColorMode !== 'none' && (
                    <span style={{ color: '#f97316' }}>
                      伪彩:{pseudoColorMode === 'hotIron' ? '热铁' : pseudoColorMode === 'coolBlue' ? '冷蓝' : pseudoColorMode === 'pet' ? 'PET' : '软组织'}
                    </span>
                  )}
                </div>

                {/* ---- 交互式测量叠加层 ---- */}
                {showMeasurementsOverlay && (measureSubMenu || isDrawingMeasure || interactiveMeasures.length > 0) && (
                  <svg style={s.annotationSvg}>
                    {/* 已完成的测量 */}
                    {interactiveMeasures.map(measure => {
                      if (measure.points.length < 1) return null
                      const points = measure.points
                      const color = (measure as any).color || '#22c55e'

                      if (measure.type === 'line' && points.length >= 2) {
                        const [p1, p2] = points
                        const midX = (p1.x + p2.x) / 2
                        const midY = (p1.y + p2.y) / 2
                        return (
                          <g key={measure.id}>
                            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                              stroke={color} strokeWidth={2} />
                            <circle cx={p1.x} cy={p1.y} r={4} fill={color} />
                            <circle cx={p2.x} cy={p2.y} r={4} fill={color} />
                            <text x={midX} y={midY - 8} fill={color} fontSize={12}
                              fontFamily="monospace" textAnchor="middle">
                              {measure.value}{measure.unit}
                            </text>
                          </g>
                        )
                      }

                      if (measure.type === 'angle' && points.length >= 3) {
                        const [p1, vertex, p2] = points
                        return (
                          <g key={measure.id}>
                            <line x1={vertex.x} y1={vertex.y} x2={p1.x} y2={p1.y}
                              stroke={color} strokeWidth={2} />
                            <line x1={vertex.x} y1={vertex.y} x2={p2.x} y2={p2.y}
                              stroke={color} strokeWidth={2} />
                            <circle cx={p1.x} cy={p1.y} r={4} fill={color} />
                            <circle cx={vertex.x} cy={vertex.y} r={4} fill={color} />
                            <circle cx={p2.x} cy={p2.y} r={4} fill={color} />
                            <text x={vertex.x + 20} y={vertex.y - 10} fill={color} fontSize={12}
                              fontFamily="monospace">
                              {measure.value}{measure.unit}
                            </text>
                          </g>
                        )
                      }

                      if (measure.type === 'ellipse' && points.length >= 2) {
                        const [p1, p2] = points
                        const cx = (p1.x + p2.x) / 2
                        const cy = (p1.y + p2.y) / 2
                        const rx = Math.abs(p2.x - p1.x) / 2
                        const ry = Math.abs(p2.y - p1.y) / 2
                        return (
                          <g key={measure.id}>
                            <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
                              fill={color} fillOpacity={0.15}
                              stroke={color} strokeWidth={2} />
                            <circle cx={p1.x} cy={p1.y} r={4} fill={color} />
                            <circle cx={p2.x} cy={p2.y} r={4} fill={color} />
                            <text x={cx} y={cy - ry - 8} fill={color} fontSize={12}
                              fontFamily="monospace" textAnchor="middle">
                              {measure.label}
                            </text>
                          </g>
                        )
                      }

                      if (measure.type === 'rectangle' && points.length >= 2) {
                        const [p1, p2] = points
                        const x = Math.min(p1.x, p2.x)
                        const y = Math.min(p1.y, p2.y)
                        const w = Math.abs(p2.x - p1.x)
                        const h = Math.abs(p2.y - p1.y)
                        return (
                          <g key={measure.id}>
                            <rect x={x} y={y} width={w} height={h}
                              fill={color} fillOpacity={0.15}
                              stroke={color} strokeWidth={2} />
                            <circle cx={p1.x} cy={p1.y} r={4} fill={color} />
                            <circle cx={p2.x} cy={p2.y} r={4} fill={color} />
                            <text x={x + w / 2} y={y - 8} fill={color} fontSize={12}
                              fontFamily="monospace" textAnchor="middle">
                              {measure.label}
                            </text>
                          </g>
                        )
                      }

                      if (measure.type === 'circle' && points.length >= 2) {
                        const [center, edge] = points
                        const r = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2))
                        return (
                          <g key={measure.id}>
                            <circle cx={center.x} cy={center.y} r={r}
                              fill={color} fillOpacity={0.15}
                              stroke={color} strokeWidth={2} />
                            <circle cx={center.x} cy={center.y} r={4} fill={color} />
                            <circle cx={edge.x} cy={edge.y} r={4} fill={color} />
                            <text x={center.x} y={center.y - r - 8} fill={color} fontSize={12}
                              fontFamily="monospace" textAnchor="middle">
                              {measure.label}
                            </text>
                          </g>
                        )
                      }

                      if (measure.type === 'ctvalue' && points.length >= 1) {
                        const p = points[0]
                        return (
                          <g key={measure.id}>
                            <circle cx={p.x} cy={p.y} r={10} fill={color} fillOpacity={0.3}
                              stroke={color} strokeWidth={2} />
                            <text x={p.x + 15} y={p.y + 5} fill={color} fontSize={12}
                              fontFamily="monospace">
                              {measure.value}{measure.unit}
                            </text>
                          </g>
                        )
                      }

                      if (measure.type === 'area' && points.length >= 3) {
                        const pathData = points.map((p, i) =>
                          `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`
                        ).join(' ') + ' Z'
                        return (
                          <g key={measure.id}>
                            <path d={pathData} fill={color} fillOpacity={0.2}
                              stroke={color} strokeWidth={2} />
                            {points.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} />
                            ))}
                            <text x={points[0].x} y={points[0].y - 10} fill={color} fontSize={12}
                              fontFamily="monospace">
                              {measure.label}
                            </text>
                          </g>
                        )
                      }

                      return null
                    })}

                    {/* 正在绘制的测量 */}
                    {isDrawingMeasure && drawingPoints.map((point, idx) => (
                      <circle key={`draw-${idx}`} cx={point.x} cy={point.y} r={5}
                        fill="#22c55e" stroke="#fff" strokeWidth={2} />
                    ))}

                    {/* 正在绘制的线 */}
                    {isDrawingMeasure && drawingPoints.length >= 1 && measureSubMenu === 'line' && (
                      <line
                        x1={drawingPoints[drawingPoints.length - 1].x}
                        y1={drawingPoints[drawingPoints.length - 1].y}
                        x2={drawingPoints[drawingPoints.length - 1].x + 50}
                        y2={drawingPoints[drawingPoints.length - 1].y}
                        stroke="#22c55e"
                        strokeWidth={2}
                        strokeDasharray="4"
                      />
                    )}

                    {/* 正在绘制椭圆 */}
                    {isDrawingMeasure && drawingPoints.length >= 1 && measureSubMenu === 'ellipse' && (
                      <ellipse
                        cx={drawingPoints[0].x}
                        cy={drawingPoints[0].y}
                        rx={Math.abs((drawingPoints[drawingPoints.length - 1].x - drawingPoints[0].x))}
                        ry={Math.abs((drawingPoints[drawingPoints.length - 1].y - drawingPoints[0].y))}
                        fill="#8b5cf6"
                        fillOpacity={0.15}
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="4"
                      />
                    )}

                    {/* 正在绘制矩形 */}
                    {isDrawingMeasure && drawingPoints.length >= 1 && measureSubMenu === 'rectangle' && (
                      <rect
                        x={Math.min(drawingPoints[0].x, drawingPoints[drawingPoints.length - 1].x)}
                        y={Math.min(drawingPoints[0].y, drawingPoints[drawingPoints.length - 1].y)}
                        width={Math.abs(drawingPoints[drawingPoints.length - 1].x - drawingPoints[0].x)}
                        height={Math.abs(drawingPoints[drawingPoints.length - 1].y - drawingPoints[0].y)}
                        fill="#06b6d4"
                        fillOpacity={0.15}
                        stroke="#06b6d4"
                        strokeWidth={2}
                        strokeDasharray="4"
                      />
                    )}

                    {/* 正在绘制圆形 */}
                    {isDrawingMeasure && drawingPoints.length >= 1 && measureSubMenu === 'circle' && (
                      <circle
                        cx={drawingPoints[0].x}
                        cy={drawingPoints[0].y}
                        r={Math.sqrt(
                          Math.pow(drawingPoints[drawingPoints.length - 1].x - drawingPoints[0].x, 2) +
                          Math.pow(drawingPoints[drawingPoints.length - 1].y - drawingPoints[0].y, 2)
                        )}
                        fill="#ec4899"
                        fillOpacity={0.15}
                        stroke="#ec4899"
                        strokeWidth={2}
                        strokeDasharray="4"
                      />
                    )}

                    {/* 正在绘制多边形 */}
                    {isDrawingMeasure && drawingPoints.length >= 2 && (measureSubMenu === 'angle' || measureSubMenu === 'area') && (
                      <>
                        {drawingPoints.length >= 2 && (
                          <line
                            x1={drawingPoints[drawingPoints.length - 2].x}
                            y1={drawingPoints[drawingPoints.length - 2].y}
                            x2={drawingPoints[drawingPoints.length - 1].x}
                            y2={drawingPoints[drawingPoints.length - 1].y}
                            stroke="#22c55e"
                            strokeWidth={2}
                            strokeDasharray="4"
                          />
                        )}
                      </>
                    )}
                  </svg>
                )}

                {/* ---- 标注叠加层 ---- */}
                {showAnnotationsOverlay && annotations.length > 0 && (
                  <svg style={s.annotationSvg}>
                    {annotations.filter(a => a.visible).map(ann => {
                      if (ann.type === 'text') {
                        return (
                          <g key={ann.id}>
                            <text
                              x={ann.x}
                              y={ann.y}
                              fill={ann.color}
                              fontSize={ann.fontSize}
                              fontFamily="PingFang SC, Microsoft YaHei, sans-serif"
                              fontWeight="bold"
                            >
                              {ann.text}
                            </text>
                          </g>
                        )
                      }

                      if (ann.type === 'arrow' && ann.x2 !== undefined && ann.y2 !== undefined) {
                        const dx = ann.x2 - ann.x
                        const dy = ann.y2 - ann.y
                        const angle = Math.atan2(dy, dx)
                        const headLen = 15
                        const headAngle = Math.PI / 6

                        return (
                          <g key={ann.id}>
                            <line
                              x1={ann.x} y1={ann.y}
                              x2={ann.x2 - headLen * Math.cos(angle - headAngle)}
                              y2={ann.y2 - headLen * Math.sin(angle - headAngle)}
                              stroke={ann.color} strokeWidth={2}
                            />
                            <line
                              x1={ann.x2} y1={ann.y2}
                              x2={ann.x2 - headLen * Math.cos(angle + headAngle)}
                              y2={ann.y2 - headLen * Math.sin(angle + headAngle)}
                              stroke={ann.color} strokeWidth={2}
                            />
                            <line x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2}
                              stroke={ann.color} strokeWidth={2} />
                          </g>
                        )
                      }

                      if (ann.type === 'rect' && ann.x2 !== undefined && ann.y2 !== undefined) {
                        return (
                          <g key={ann.id}>
                            <rect
                              x={Math.min(ann.x, ann.x2)}
                              y={Math.min(ann.y, ann.y2)}
                              width={Math.abs(ann.x2 - ann.x)}
                              height={Math.abs(ann.y2 - ann.y)}
                              fill="transparent"
                              stroke={ann.color}
                              strokeWidth={2}
                              strokeDasharray="5,3"
                            />
                          </g>
                        )
                      }

                      if (ann.type === 'ellipse' && ann.x2 !== undefined && ann.y2 !== undefined) {
                        const cx = (ann.x + ann.x2) / 2
                        const cy = (ann.y + ann.y2) / 2
                        const rx = Math.abs(ann.x2 - ann.x) / 2
                        const ry = Math.abs(ann.y2 - ann.y) / 2
                        return (
                          <g key={ann.id}>
                            <ellipse
                              cx={cx} cy={cy}
                              rx={rx} ry={ry}
                              fill="transparent"
                              stroke={ann.color}
                              strokeWidth={2}
                              strokeDasharray="5,3"
                            />
                          </g>
                        )
                      }

                      return null
                    })}
                  </svg>
                )}
              </div>
            )}

            {/* ---- 窗宽窗位弹出 ---- */}
            {showWlPopup && (
              <div style={s.wlPopup} onClick={e => e.stopPropagation()}>
                <div style={s.wlPopupTitle}>
                  <Sun size={14} color={PRIMARY} />{t('dcm.wlSettings')}</div>
                <div style={s.wlSliderRow}>
                  <span style={s.wlLabel}>{t('dcm.wwLabel')}</span>
                  <input
                    type="range"
                    min={50}
                    max={4000}
                    value={ww}
                    onChange={e => { setWw(+e.target.value); setActivePresetIdx(null) }}
                    style={s.wlSlider}
                  />
                  <span style={s.wlVal}>{ww}</span>
                </div>
                <div style={s.wlSliderRow}>
                  <span style={s.wlLabel}>{t('dcm.wlLabel')}</span>
                  <input
                    type="range"
                    min={-1000}
                    max={1000}
                    value={wl}
                    onChange={e => { setWl(+e.target.value); setActivePresetIdx(null) }}
                    style={s.wlSlider}
                  />
                  <span style={s.wlVal}>{wl}</span>
                </div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {WINDOW_PRESETS.map((p, i) => (
                    <button
                      key={p.name}
                      style={{
                        ...s.presetBtn,
                        fontSize: 12,
                        padding: '3px 6px',
                        ...(activePresetIdx === i ? s.presetBtnActive : {}),
                      }}
                      onClick={() => handlePresetClick(p, i)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button
                    style={{ ...s.reportBtn, background: PRIMARY, color: '#fff', flex: 1 }}
                    onClick={() => { setWw(400); setWl(40); setActivePresetIdx(null) }}
                  >{t('dcmtool.reset')}</button>
                  <button
                    style={{ ...s.reportBtn, background: '#e2e8f0', color: '#475569', flex: 1 }}
                    onClick={() => setShowWlPopup(false)}
                  >{t('dcm.close')}</button>
                </div>
              </div>
            )}

            {/* ---- 测量子菜单 ---- */}
            {activeTool === 'measure' && measureSubMenu !== null && (
              <div style={s.measureMenu} onClick={e => e.stopPropagation()}>
                {(['line', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue'] as MeasureSubMenu[]).map(type => (
                  <button
                    key={type}
                    style={{
                      ...s.measureMenuItem,
                      ...(measureSubMenu === type ? { background: `${PRIMARY}15`, color: PRIMARY } : {}),
                    }}
                    onClick={() => setMeasureSubMenu(type)}
                  >
                    {type === 'line' && <Ruler size={14} />}
                    {type === 'angle' && <Triangle size={14} />}
                    {type === 'ellipse' && <CircleIcon size={14} />}
                    {type === 'rectangle' && <RectIcon size={14} />}
                    {type === 'circle' && <Circle size={14} />}
                    {type === 'ctvalue' && <Activity size={14} />}
                    {type === 'line' ? '长度测量' :
                      type === 'angle' ? '角度测量' :
                        type === 'ellipse' ? '椭圆ROI' :
                          type === 'rectangle' ? '矩形ROI' :
                            type === 'circle' ? '圆ROI' : 'CT值(HU)'}
                  </button>
                ))}
                {/* 清除测量按钮 */}
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 4 }}>
                  <button
                    style={{ ...s.measureMenuItem, color: '#ef4444' }}
                    onClick={clearAllMeasures}
                  >
                    <Trash2 size={14} />{t('dcm.clearAllMeasures')}</button>
                </div>
              </div>
            )}

            {/* ---- 伪彩面板 ---- */}
            {showPseudoColorPanel && (
              <div style={s.pseudoColorPanel} onClick={e => e.stopPropagation()}>
                <div style={s.pseudoColorPanelTitle}>
                  <Palette size={14} color={PRIMARY} />{t('dcm.pseudoColor')}</div>
                {pseudoColorTools.map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    style={{
                      ...s.pseudoColorBtn,
                      ...(pseudoColorMode === mode ? s.pseudoColorBtnActive : {}),
                    }}
                    onClick={() => {
                      setPseudoColorMode(mode)
                      if (mode !== 'none') {
                        setActiveTool('wl') // 自动切换到窗口工具以显示伪彩
                      }
                    }}
                  >
                    <div style={{
                      ...s.pseudoColorPreview,
                      background: mode === 'none' ? '#888' :
                        mode === 'hotIron' ? 'linear-gradient(135deg, #000 0%, #00f 25%, #0f0 50%, #ff0 75%, #fff 100%)' :
                          mode === 'coolBlue' ? 'linear-gradient(135deg, #000 0%, #0ff 50%, #fff 100%)' :
                            mode === 'pet' ? 'linear-gradient(135deg, #00f 0%, #0ff 20%, #0f0 40%, #ff0 60%, #f00 80%, #f0f 100%)' :
                              'linear-gradient(135deg, #000 0%, #88cc88 100%)',
                    }} />
                    {icon}
                    <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                    {pseudoColorMode === mode && <CheckCircle size={12} />}
                  </button>
                ))}
                <button
                  style={{ ...s.reportBtn, background: '#f0f4f8', color: '#64748b', marginTop: 4 }}
                  onClick={() => setShowPseudoColorPanel(false)}
                >{t('dcm.close')}</button>
              </div>
            )}

            {/* ---- 标注工具面板 ---- */}
            {showAnnotationPanel && (
              <div style={s.annotationPanel} onClick={e => e.stopPropagation()}>
                <div style={s.annotationPanelTitle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <PenTool size={14} color={PRIMARY} />{t('dcm.annotationTool')}</span>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    onClick={() => setShowAnnotationPanel(false)}
                  >
                    <X size={14} color="#64748b" />
                  </button>
                </div>

                {/* 标注类型选择 */}
                <div style={s.annotationTypeRow}>
                  {annotationTypes.map(({ type, icon, label }) => (
                    <button
                      key={type}
                      style={{
                        ...s.annotationTypeBtn,
                        ...(activeAnnotationType === type ? s.annotationTypeBtnActive : {}),
                      }}
                      onClick={() => setActiveAnnotationType(type)}
                      title={label}
                    >
                      <div style={{ color: activeAnnotationType === type ? '#fff' : '#64748b' }}>
                        {icon}
                      </div>
                      <span style={{
                        ...s.annotationTypeBtnLabel,
                        color: activeAnnotationType === type ? 'rgba(255,255,255,0.8)' : '#64748b',
                      }}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 颜色选择 */}
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('dcm.color')}</div>
                <div style={s.annotationColorPicker}>
                  {ANNOTATION_COLORS.map(color => (
                    <button
                      key={color}
                      style={{
                        ...s.annotationColorBtn,
                        background: color,
                        ...(activeAnnotationColor === color ? s.annotationColorBtnActive : {}),
                      }}
                      onClick={() => setActiveAnnotationColor(color)}
                      title={ANNOTATION_COLOR_NAMES[color] || color}
                    />
                  ))}
                </div>

                {/* 字体大小 */}
                <div style={s.annotationFontSizeRow}>
                  <span style={s.annotationFontSizeLabel}>{t('dcm.fontSize')}</span>
                  <input
                    type="number"
                    min={8}
                    max={48}
                    value={activeAnnotationFontSize}
                    onChange={e => setActiveAnnotationFontSize(Number(e.target.value))}
                    style={s.annotationFontSizeInput}
                  />
                </div>

                {/* 标注列表 */}
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, marginTop: 8 }}>
                  已添加标注 ({annotations.length})
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {annotations.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 8 }}>{t('dcm.clickToAnnotate')}</div>
                  ) : (
                    annotations.map(ann => (
                      <div
                        key={ann.id}
                        style={{
                          ...s.annotationListItem,
                          ...(selectedAnnotationId === ann.id ? s.annotationListItemSelected : {}),
                          ...(ann.locked ? s.annotationListItemLocked : {}),
                        }}
                        onClick={() => setSelectedAnnotationId(ann.id)}
                      >
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: ann.color,
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ann.type === 'text' ? ann.text :
                              ann.type === 'arrow' ? '箭头标注' :
                                ann.type === 'rect' ? '矩形标注' : '椭圆标注'}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            {ann.type} | {ann.visible ? '可见' : '隐藏'}
                          </div>
                        </div>
                        <div style={s.annotationListItemActions}>
                          <button
                            style={s.annotationActionBtn}
                            onClick={e => { e.stopPropagation(); toggleAnnotationVisibility(ann.id) }}
                            title={ann.visible ? '隐藏' : '显示'}
                          >
                            {ann.visible ? <EyeIcon size={12} color="#64748b" /> : <EyeOff size={12} color="#94a3b8" />}
                          </button>
                          <button
                            style={s.annotationActionBtn}
                            onClick={e => { e.stopPropagation(); toggleAnnotationLock(ann.id) }}
                            title={ann.locked ? '解锁' : '锁定'}
                          >
                            {ann.locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} color="#64748b" />}
                          </button>
                          <button
                            style={{ ...s.annotationActionBtn }}
                            onClick={e => { e.stopPropagation(); deleteAnnotation(ann.id) }}
                            title="删除"
                          >
                            <Trash2 size={12} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 清除所有标注 */}
                {annotations.length > 0 && (
                  <button
                    style={{ ...s.reportBtn, background: '#fef2f2', color: '#ef4444', marginTop: 8 }}
                    onClick={clearAllAnnotations}
                  >
                    <Trash2 size={12} />{t('dcm.clearAllAnnotations')}</button>
                )}
              </div>
            )}
          </div>

          {/* ---- 底部序列缩略图条 ---- */}
          <div style={s.seriesStrip}>
            {seriesList.map((sItem, idx) => (
              <div
                key={sItem.id}
                style={{
                  ...s.seriesThumb,
                  ...(activeSeriesIdx === idx ? s.seriesThumbActive : {}),
                }}
                onClick={() => handleSeriesSelect(idx)}
                title={`${sItem.seriesDescription} (${sItem.imageCount}幅)`}
              >
                <div style={{
                  ...s.seriesThumbInner,
                  background: sItem.thumbnail,
                  opacity: activeSeriesIdx === idx ? 1 : 0.7,
                }}>
                  <Layers size={16} />
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {sItem.seriesNumber}
                </span>
                <span style={{ fontSize: 8, color: '#6b7280' }}>
                  {sItem.imageCount}幅
                </span>
              </div>
            ))}

            {/* 额外布局空间 */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {exam.modality} · {exam.bodyPart}
              </span>
              <button
                style={{
                  ...s.layoutBtn,
                  background: PRIMARY,
                  borderColor: PRIMARY,
                }}
                onClick={() => setImageIndex(i => Math.max(0, i - 1))}
                title="上一幅"
              >
                <ChevronLeft size={14} color="#fff" />
              </button>
              <button
                style={{
                  ...s.layoutBtn,
                  background: PRIMARY,
                  borderColor: PRIMARY,
                }}
                onClick={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}
                title="下一幅"
              >
                <ChevronRight size={14} color="#fff" />
              </button>
            </div>
          </div>
        </div>

        {/* =============================================== */}
        {/* 右侧信息面板 */}
        {/* =============================================== */}
        <div style={s.rightPanel}>
          {/* ---- 标签页切换 ---- */}
          <div style={s.rightTabs}>
            <button
              style={{ ...s.rightTab, ...(rightTab === 'patient' ? s.rightTabActive : {}) }}
              onClick={() => setRightTab('patient')}
            >
              <User size={14} />{t('qcimage.patient')}</button>
            <button
              style={{ ...s.rightTab, ...(rightTab === 'image' ? s.rightTabActive : {}) }}
              onClick={() => setRightTab('image')}
            >
              <ImageIcon size={14} />{t('dcm.imageTab')}</button>
            <button
              style={{ ...s.rightTab, ...(rightTab === 'measure' ? s.rightTabActive : {}) }}
              onClick={() => setRightTab('measure')}
            >
              <Ruler size={14} />{t('dcmtool.measure')}</button>
            <button
              style={{ ...s.rightTab, ...(rightTab === 'report' ? s.rightTabActive : {}) }}
              onClick={() => setRightTab('report')}
            >
              <FileSearch size={14} />{t('dcm.reportTab')}</button>
            <button
              style={{ ...s.rightTab, ...(rightTab === 'history' ? s.rightTabActive : {}) }}
              onClick={() => setRightTab('history')}
            >
              <History size={14} />{t('dcm.historyTab')}</button>
            <button
              style={{ ...s.rightTab, ...(rightTab === 'external' ? s.rightTabActive : {}) }}
              onClick={() => setRightTab('external')}
            >
              <GitCompare size={14} />{t('dcm.externalTab')}</button>
          </div>

          {/* ---- 面板内容 ---- */}
          <div style={s.rightPanelContent}>

            {/* ===== 标签页1：患者信息 ===== */}
            {rightTab === 'patient' && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <User size={12} />{t('dcm.basicInfo')}</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.name')}</span>
                      <span style={s.infoValue}>{exam.patientName}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.genderAge')}</span>
                      <span style={s.infoValue}>{exam.gender} / {exam.age}岁</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.patientType')}</span>
                      <span style={s.infoValue}>{exam.patientType}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('qcimage.examId')}</span>
                      <span style={s.infoValue}>{exam.accessionNumber}</span>
                    </div>
                  </div>
                </div>

                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <FileText size={12} />{t('dcm.examInfo')}</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.examItem')}</span>
                      <span style={s.infoValue}>{exam.examItemName}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.examDate')}</span>
                      <span style={s.infoValue}>{exam.examDate}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.examTime')}</span>
                      <span style={s.infoValue}>{exam.examTime}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.examDevice')}</span>
                      <span style={s.infoValue}>{exam.deviceName.split('（')[0]}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.examRoom')}</span>
                      <span style={s.infoValue}>{exam.roomName}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.examStatus')}</span>
                      <span style={{
                        ...s.infoValue,
                        color: exam.status === '已完成' ? '#22c55e' :
                          exam.status === '检查中' ? '#f59e0b' : '#64748b',
                      }}>
                        {exam.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <AlertCircle size={12} />{t('dcm.clinicalInfo')}</div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={s.infoLabel}>{t('dcm.clinicalDiagnosis')}</span>
                    <div style={{ ...s.infoValueFull, color: '#dc2626' }}>
                      {exam.clinicalDiagnosis}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={s.infoLabel}>病史</span>
                    <div style={s.infoValueFull}>{exam.clinicalHistory}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={s.infoLabel}>{t('dcm.examIndications')}</span>
                    <div style={s.infoValueFull}>{exam.examIndications}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={s.infoLabel}>{t('dcm.orderingDept')}</span>
                    <div style={s.infoValue}>放射科</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={s.infoLabel}>{t('dcm.orderingDoctor')}</span>
                    <div style={s.infoValue}>待定</div>
                  </div>
                </div>

                {/* MPR多平面重建标签 */}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <Layers3 size={12} />{t('dcm.mpr')}</div>
                  <div style={s.mprTabs}>
                    {['横断面', '冠状面', '矢状面'].map((tab, i) => (
                      <button
                        key={tab}
                        style={{
                          ...s.mprTab,
                          ...(i === 0 ? s.mprTabActive : {}),
                        }}
                        onClick={() => setActiveMprIdx(i)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MIP最大密度投影控制 */}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <Activity size={12} />{t('dcm.mip')}</div>
                  <div style={s.mipControlPanel}>
                    <div style={s.mipControlTitle}>
                      <span>{t('dcm.projDir')}</span>
                    </div>
                    <div style={s.mipDirRow}>
                      {(['axial', 'sagittal', 'coronal'] as MipDirection[]).map(dir => (
                        <button
                          key={dir}
                          style={{
                            ...s.mipDirBtn,
                            ...(mipDirection === dir ? s.mipDirBtnActive : {}),
                          }}
                          onClick={() => setMipDirection(dir)}
                        >
                          {dir === 'axial' ? '轴位' : dir === 'sagittal' ? '矢状' : '冠状'}
                        </button>
                      ))}
                    </div>
                    <div style={s.mipControlTitle}><span>{t('dcm.frameSelect')}</span></div>
                    <div style={s.mipFrameRow}>
                      <span style={s.mipFrameLabel}>帧:</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, images.length - 1)}
                        value={mipFrame}
                        onChange={e => setMipFrame(parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: PRIMARY }}
                      />
                      <span style={s.mipFrameVal}>{mipFrame + 1}/{images.length}</span>
                    </div>
                  </div>
                </div>

                {/* VR体绘制控制 */}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <Box size={12} />{t('dcm.vr')}</div>
                  <div style={s.vrControlPanel}>
                    {/* 旋转X */}
                    <div style={s.vrSliderRow}>
                      <span style={s.vrSliderLabel}>{t('dcm.rotateX')}</span>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={vrRotX}
                        onChange={e => setVrRotX(parseInt(e.target.value))}
                        style={s.vrSlider}
                      />
                      <span style={s.vrSliderVal}>{vrRotX}°</span>
                    </div>
                    {/* 旋转Y */}
                    <div style={s.vrSliderRow}>
                      <span style={s.vrSliderLabel}>{t('dcm.rotateY')}</span>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={vrRotY}
                        onChange={e => setVrRotY(parseInt(e.target.value))}
                        style={s.vrSlider}
                      />
                      <span style={s.vrSliderVal}>{vrRotY}°</span>
                    </div>
                    {/* 旋转Z */}
                    <div style={s.vrSliderRow}>
                      <span style={s.vrSliderLabel}>{t('dcm.rotateZ')}</span>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={vrRotZ}
                        onChange={e => setVrRotZ(parseInt(e.target.value))}
                        style={s.vrSlider}
                      />
                      <span style={s.vrSliderVal}>{vrRotZ}°</span>
                    </div>
                    {/* 透明度 */}
                    <div style={s.vrSliderRow}>
                      <span style={s.vrSliderLabel}>{t('dcm.opacity')}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(vrOpacity * 100)}
                        onChange={e => setVrOpacity(parseInt(e.target.value) / 100)}
                        style={s.vrSlider}
                      />
                      <span style={s.vrSliderVal}>{Math.round(vrOpacity * 100)}%</span>
                    </div>
                    {/* 重置按钮 */}
                    <button
                      style={s.vrResetBtn}
                      onClick={() => {
                        setVrRotX(30)
                        setVrRotY(45)
                        setVrRotZ(0)
                        setVrOpacity(0.8)
                      }}
                    >
                      <RefreshCw size={12} />{t('dcm.resetView')}</button>
                  </div>
                </div>

                {/* 其他操作按钮 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <button
                    style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }}
                    onClick={() => {
                      const canvas = document.querySelector('#image-main-area canvas') as HTMLCanvasElement
                      if (canvas) {
                        const url = canvas.toDataURL('image/png')
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `dicom_capture_${Date.now()}.png`
                        a.click()
                        showToast('PNG已导出')
                      } else {
                        showToast('请先加载DICOM影像')
                      }
                    }}>
                    <Camera size={14} />{t('dcmexp.exportPng')}</button>
                  <button
                    style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }}
                    onClick={() => {
                      // [v3.0.4.0] TODO: 接入 cornerstone + dcmjs 的 DICOM 导出(保留 VOI/LUT 与 DICOMDIR)
                      showToast('DICOM 导出功能 v3.0.4.0 待实现')
                    }}>
                    <Download size={14} />{t('dcmexp.exportDicom')}</button>
                </div>
              </>
            )}

            {/* ===== 标签页2：影像信息 ===== */}
            {rightTab === 'image' && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <ImageIcon size={12} />{t('dcm.seriesInfo')}</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.seriesNumber')}</span>
                      <span style={s.infoValue}>{activeSeries.seriesNumber}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.imageNumber')}</span>
                      <span style={s.infoValue}>{currentImage?.imageNumber || 1}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.seriesDesc')}</span>
                      <span style={{ ...s.infoValue, gridColumn: '1 / -1' }}>
                        {activeSeries.seriesDescription}
                      </span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.imageCount')}</span>
                      <span style={s.infoValue}>{activeSeries.imageCount}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}> modality</span>
                      <span style={s.infoValue}>{activeSeries.modality}</span>
                    </div>
                  </div>
                </div>

                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <Info size={12} />{t('dcm.imageParams')}</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.sliceThickness')}</span>
                      <span style={s.infoValue}>{currentImage?.sliceThickness || 2.5}mm</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>层间距</span>
                      <span style={s.infoValue}>2.5mm</span>
                    </div>
                    {currentImage?.tr && (
                      <div style={s.infoItem}>
                        <span style={s.infoLabel}>TR</span>
                        <span style={s.infoValue}>{currentImage.tr}ms</span>
                      </div>
                    )}
                    {currentImage?.te && (
                      <div style={s.infoItem}>
                        <span style={s.infoLabel}>TE</span>
                        <span style={s.infoValue}>{currentImage.te}ms</span>
                      </div>
                    )}
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.matrix')}</span>
                      <span style={s.infoValue}>{currentImage?.matrix || '512×512'}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>FOV</span>
                      <span style={s.infoValue}>{currentImage?.fov || 35}cm</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.pixelSpacing')}</span>
                      <span style={s.infoValue}>{currentImage?.pixelSpacing || 0.68}mm</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.acqMatrix')}</span>
                      <span style={s.infoValue}>512×512</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.dispMatrix')}</span>
                      <span style={s.infoValue}>512×512</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.ww')}</span>
                      <span style={s.infoValue}>{ww}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.wl')}</span>
                      <span style={s.infoValue}>{wl}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.sliceLoc')}</span>
                      <span style={s.infoValue}>
                        {currentImage?.sliceLocation?.toFixed(1) || '0.0'}mm
                      </span>
                    </div>
                  </div>
                </div>

                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <Activity size={12} />{t('dcm.deviceInfo')}</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.deviceModel')}</span>
                      <span style={s.infoValue}>{exam.deviceName.split('（')[1]?.replace('）', '') || 'N/A'}</span>
                    </div>
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>{t('dcm.manufacturer')}</span>
                      <span style={s.infoValue}>
                        {exam.deviceName.includes('GE') ? 'GE' :
                          exam.deviceName.includes('Siemens') ? 'Siemens' :
                            exam.deviceName.includes('Philips') ? 'Philips' : 'N/A'}
                      </span>
                    </div>
                    <div style={{ ...s.infoItem, gridColumn: '1 / -1' }}>
                      <span style={s.infoLabel}>{t('dcm.acqStation')}</span>
                      <span style={s.infoValue}>CT-Acq-01</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== 标签页3：测量工具（增强版） ===== */}
            {rightTab === 'measure' && (
              <>
                {/* 测量控制 */}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <RulerIcon size={12} />ROI测量工具
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {(['line', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue'] as MeasureSubMenu[]).map(type => (
                      <button
                        key={type}
                        style={{
                          flex: 1,
                          minWidth: 60,
                          padding: '6px 4px',
                          borderRadius: 6,
                          border: `1px solid ${measureSubMenu === type ? PRIMARY : '#e2e8f0'}`,
                          background: measureSubMenu === type ? PRIMARY : '#fff',
                          color: measureSubMenu === type ? '#fff' : '#475569',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column' as const,
                          alignItems: 'center',
                          gap: 2,
                        }}
                        onClick={() => {
                          setMeasureSubMenu(type)
                          setActiveTool('measure')
                        }}
                      >
                        {type === 'line' && <Ruler size={14} />}
                        {type === 'angle' && <Triangle size={14} />}
                        {type === 'ellipse' && <CircleIcon size={14} />}
                        {type === 'rectangle' && <RectIcon size={14} />}
                        {type === 'circle' && <Circle size={14} />}
                        {type === 'ctvalue' && <Activity size={14} />}
                        {type === 'line' ? '📏长度' :
                          type === 'angle' ? '📐角度' :
                            type === 'ellipse' ? '⭕椭圆' :
                              type === 'rectangle' ? '▢矩形' :
                                type === 'circle' ? '🔘圆形' : '💉CT'}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    {measureSubMenu === 'line' && '📏 点击图像两点测量长度（mm）'}
                    {measureSubMenu === 'angle' && '📐 点击图像三点测量角度（°）'}
                    {measureSubMenu === 'ellipse' && '⭕ 点击拖动绘制椭圆ROI（cm²）'}
                    {measureSubMenu === 'rectangle' && '▢ 点击拖动绘制矩形ROI（cm²）'}
                    {measureSubMenu === 'circle' && '🔘 点击拖动绘制圆形ROI（cm²）'}
                    {measureSubMenu === 'ctvalue' && '💉 点击图像测量CT值（HU）'}
                  </div>
                </div>

                {/* 交互式测量结果列表 */}
                <div style={s.infoSection}>
                  <div style={{ ...s.infoSectionTitle, justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Activity size={12} />测量结果 ({interactiveMeasures.length})
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        style={{
                          ...s.compareControlBadge,
                          padding: '2px 8px',
                          ...(showMeasurementsOverlay ? s.compareControlBadgeOn : s.compareControlBadgeOff),
                        }}
                        onClick={() => setShowMeasurementsOverlay(!showMeasurementsOverlay)}
                      >
                        {showMeasurementsOverlay ? <EyeIcon size={10} /> : <EyeOff size={10} />}
                        {showMeasurementsOverlay ? '显示' : '隐藏'}
                      </button>
                    </div>
                  </div>

                  {interactiveMeasures.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
                      <Ruler size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                      <div>{t('dcmmeas.noData')}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>选择ROI工具后点击图像开始测量</div>
                    </div>
                  ) : (
                    interactiveMeasures.map(measure => (
                      <div key={measure.id} style={s.measureItem}>
                        <div style={{
                          ...s.measureItemColor,
                          background: (measure as any).color || '#22c55e',
                        }} />
                        <div style={s.measureItemInfo}>
                          <div style={s.measureItemValue}>
                            {measure.label || `${measure.value} ${measure.unit}`}
                          </div>
                          <div style={s.measureItemType}>
                            {getMeasureTypeLabel(measure.type)}
                          </div>
                        </div>
                        <div style={s.measureItemActions}>
                          <button
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 4,
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onClick={() => deleteMeasure(measure.id)}
                            title="删除"
                          >
                            <Trash2 size={12} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 预设测量数据 */}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <FileText size={12} />历史测量数据
                  </div>
                  <div style={s.infoSection}>
                    <div style={s.infoSectionTitle}>
                      <RulerIcon size={12} />{t('dcm.lengthMeasure')}</div>
                    {measurements.length.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                        暂无长度测量数据
                      </div>
                    ) : (
                      measurements.length.map((m, i) => (
                        <div key={m.id} style={s.measureListItem}>
                          <div style={s.measureListItemLeft}>
                            <div style={{ ...s.measureListItemDot, background: '#22c55e' }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                                {m.value} {m.unit}
                              </div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.location}</div>
                            </div>
                          </div>
                          <button style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: 2,
                          }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={s.infoSection}>
                    <div style={s.infoSectionTitle}>
                      <Activity size={12} />{t('dcm.ctHu')}</div>
                    {measurements.ct.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                        暂无CT值测量数据
                      </div>
                    ) : (
                      measurements.ct.map(m => (
                        <div key={m.id} style={s.measureListItem}>
                          <div style={s.measureListItemLeft}>
                            <div style={{ ...s.measureListItemDot, background: '#3b82f6' }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                                {m.value} {m.unit}
                              </div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.location}</div>
                            </div>
                          </div>
                          <button style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: 2,
                          }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    style={{ ...s.reportBtn, background: '#f0f4f8', color: '#475569', flex: 1 }}
                    onClick={clearAllMeasures}
                  >
                    <Trash2 size={14} />清除全部
                  </button>
                  <button
                    style={{ ...s.reportBtn, background: '#22c55e', color: '#fff', flex: 1 }}
                    onClick={() => {
                      const report = measurements.lines.map((m: any) => `${m.label}: ${m.value}${m.unit}`).join('\n');
                      const allMeasures = [...measurements.lines, ...measurements.angles, ...measurements.ellipses, ...measurements.rectangles, ...measurements.circles, ...measurements.ct];
                      const reportText = allMeasures.length > 0 
                        ? allMeasures.map(m => `${m.label}: ${m.value}${m.unit}`).join('\n')
                        : '暂无测量数据';
                      navigator.clipboard.writeText(reportText);
                      showToast('测量报告已复制到剪贴板');
                    }}
                  >
                    <FileText size={14} />{t('dcmmeas.exportReport')}</button>
                </div>
              </>
            )}

            {/* ===== 标签页4：报告关联 ===== */}
            {rightTab === 'report' && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <FileSearch size={12} />{t('dcm.reportStatus')}</div>
                  <div style={s.reportStatusCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                        {exam.examItemName}
                      </span>
                      <span style={{
                        ...s.reportStatusBadge,
                        background: reportStatus === '已报告' ? '#dcfce7' :
                          reportStatus === '待书写' ? '#fef3c7' : '#f1f5f9',
                        color: reportStatus === '已报告' ? '#16a34a' :
                          reportStatus === '待书写' ? '#d97706' : '#64748b',
                      }}>
                        {reportStatus === '已报告' && <CheckCircle size={10} />}
                        {reportStatus === '待书写' && <Clock size={10} />}
                        {reportStatus === '检查中' && <Activity size={10} />}
                        {reportStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                      患者: {exam.patientName} | {exam.age}岁{exam.gender}<br />
                      检查日期: {exam.examDate} {exam.examTime}
                    </div>
                  </div>

                  {reportStatus === '已报告' ? (
                    <>
                      <div style={{ marginBottom: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('dcm.reportDoctor')}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>李明辉</div>
                      </div>
                      <div style={{ marginBottom: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>报告时间</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>2026-05-01 14:30</div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <FileText size={12} />{t('dcm.reportActions')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {exam.status !== '待报告' && exam.status !== '已报告' && (
                      <button
                        style={{ ...s.reportBtn, background: '#059669', color: '#fff' }}
                        onClick={async () => {
                          await examApi.complete(exam.id)
                          showToast('影像采集完成')
                        }}
                      >
                        <CheckCircle size={14} />{t('dcm.completeAcquisition')}</button>
                    )}
                    {reportStatus === '已报告' ? (
                      <>
                        <button
                          style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }}
                          onClick={() => { setRightTab('report'); showToast('查看报告') }}
                        >
                          <Eye size={14} />{t('dcm.viewReport')}</button>
                        <button
                          style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }}
                          onClick={() => { setRightTab('report'); showToast('修改报告模式') }}
                        >
                          <PenTool size={14} />{t('dcm.modifyReport')}</button>
                      </>
                    ) : reportStatus === '待书写' ? (
                      <>
                        <button
                          style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }}
                          onClick={() => { setRightTab('report'); showToast('书写报告模式') }}
                        >
                          <PenTool size={14} />{t('dcm.writeReport')}</button>
                        <button
                          style={{ ...s.reportBtn, background: '#f0f4f8', color: '#475569' }}
                          onClick={() => { showToast('引用模板功能 v3.0.4.0 待实现') }}
                        >
                          <FileText size={14} />{t('dcm.useTemplate')}</button>
                        <button
                          style={{ ...s.reportBtn, background: '#fef3c7', color: '#d97706' }}
                          onClick={() => { showToast('危急值通知已发送') }}
                        >
                          <AlertCircle size={14} />{t('dcm.sendCritical')}</button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{ ...s.reportBtn, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }}
                          disabled
                        >
                          <Clock size={14} />{t('dcm.waitForExam')}</button>
                      </>
                    )}
                  </div>
                </div>

                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <Calendar size={12} />{t('dcm.reportTimelinessSection')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{t('dcm.examCompleteTime')}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>2026-05-01 10:00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{t('dcm.waitingTime')}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706' }}>4小时30分</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{t('dcm.avgReportTime')}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>28分钟</span>
                    </div>
                  </div>
                </div>

                {/* 危急值提示 */}
                {exam.priority === '紧急' || exam.priority === '危重' ? (
                  <div style={{
                    padding: 10,
                    background: '#fef2f2',
                    borderRadius: 8,
                    border: '1px solid #fecaca',
                    marginTop: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <AlertCircle size={14} color="#dc2626" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                        {exam.priority === '危重' ? '危重' : '紧急'}检查
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>
                      {exam.clinicalDiagnosis}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {/* ===== 标签页5：历史对比 ===== */}
            {rightTab === 'history' && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <History size={12} />{t('dcm.historyList')}</div>
                  {/* 搜索框 */}
                  <div style={s.historySearchRow}>
                    <input
                      type="text"
                      placeholder="搜索检查项目/日期/模态..."
                      style={s.historySearchInput}
                      value={historySearchText}
                      onChange={e => setHistorySearchText(e.target.value)}
                    />
                  </div>
                  {/* 操作按钮 */}
                  <div style={s.historyActionBar}>
                    <button
                      style={{
                        ...s.historyActionBtn,
                        ...(selectedHistoryExams.length === 0 ? s.historyActionBtnDisabled : {}),
                      }}
                      disabled={selectedHistoryExams.length === 0}
                      onClick={enterCompareMode}
                    >
                      <GitCompare size={12} />{t('dcm.compare')}</button>
                    <button
                      style={{
                        ...s.historyActionBtn,
                        ...(selectedHistoryExams.length === 0 ? s.historyActionBtnDisabled : {}),
                      }}
                      disabled={selectedHistoryExams.length === 0}
                      onClick={() => setSelectedHistoryExams([])}
                    >
                      <X size={12} />{t('dcm.clear')}</button>
                  </div>
                  {/* 已选检查提示 */}
                  {selectedHistoryExams.length > 0 && (
                    <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 8, fontWeight: 600 }}>
                      已选择 {selectedHistoryExams.length} 项检查（选择2项进行左右对比）
                    </div>
                  )}
                  {/* 检查列表 */}
                  {filteredHistoryExams.length === 0 ? (
                    <div style={s.historyListEmpty}>
                      <div style={s.historyListEmptyIcon}>
                        <ScrollText size={32} />
                      </div>
                      <div>{t('dcm.noHistory')}</div>
                    </div>
                  ) : (
                    filteredHistoryExams.map(historyExam => {
                      const isSelected = selectedHistoryExams.includes(historyExam.id)
                      return (
                        <div
                          key={historyExam.id}
                          style={{
                            ...s.historyListItem,
                            ...(isSelected ? s.historyListItemChecked : {}),
                          }}
                          onClick={() => toggleHistoryExam(historyExam.id)}
                        >
                          <div
                            style={{
                              ...s.historyCheckbox,
                              ...(isSelected ? s.historyCheckboxChecked : {}),
                            }}
                          >
                            {isSelected && (
                              <CheckCircle size={12} color="#fff" />
                            )}
                          </div>
                          <div style={s.historyListItemContent}>
                            <div style={s.historyListItemHeader}>
                              <span style={s.historyListItemTitle}>{historyExam.examItemName}</span>
                              <span style={s.historyListItemDate}>{historyExam.examDate}</span>
                            </div>
                            <div style={s.historyListItemMeta}>
                              {historyExam.modality} | {historyExam.deviceName.split('（')[0]}
                            </div>
                            <div style={{
                              ...s.historyListItemStatus,
                              background: historyExam.status === '已完成' ? '#dcfce7' : '#fef3c7',
                              color: historyExam.status === '已完成' ? '#16a34a' : '#d97706',
                            }}>
                              {historyExam.status === '已完成' && <CheckCircle size={9} />}
                              {historyExam.status}
                            </div>
                            {historyExam.conclusion && (
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                                {historyExam.conclusion.length > 60
                                  ? historyExam.conclusion.substring(0, 60) + '...'
                                  : historyExam.conclusion}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* 对比模式控制 */}
                {isCompareMode && compareExam && (
                  <>
                    <div style={s.infoSection}>
                      <div style={s.infoSectionTitle}>
                        <GitCompare size={12} />{t('dcm.compareMode')}</div>
                      {/* 同步滚动控制 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{t('dcm.syncScroll')}</span>
                        <button
                          style={{
                            ...s.syncScrollBadge,
                            ...(syncScroll ? s.syncScrollBadgeOn : s.syncScrollBadgeOff),
                          }}
                          onClick={() => setSyncScroll(s => !s)}
                        >
                          {syncScroll ? <CheckCircle size={10} /> : <X size={10} />}
                          {syncScroll ? '开' : '关'}
                        </button>
                      </div>
                      {/* 差异高亮控制 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{t('dcm.diffHighlight')}</span>
                        <button
                          style={{
                            ...s.syncScrollBadge,
                            ...(showDiffHighlight ? s.syncScrollBadgeOn : s.syncScrollBadgeOff),
                          }}
                          onClick={() => setShowDiffHighlight(s => !s)}
                        >
                          {showDiffHighlight ? <CheckCircle size={10} /> : <X size={10} />}
                          {showDiffHighlight ? '开' : '关'}
                        </button>
                      </div>
                      <button
                        style={{ ...s.reportBtn, background: '#ef4444', color: '#fff' }}
                        onClick={exitCompareMode}
                      >
                        <X size={14} />{t('dcm.exitCompareMode')}</button>
                    </div>

                    {/* 对比信息卡片 */}
                    <div style={s.compareInfoCard}>
                      <div style={s.compareInfoCardTitle}>
                        <ArrowLeftRight size={12} />{t('dcm.compareInfo')}</div>
                      <div style={s.compareInfoRow}>
                        <span style={s.compareInfoLabel}>{t('dcm.currentExam')}</span>
                        <span style={s.compareInfoValue}>{exam.examDate}</span>
                      </div>
                      <div style={s.compareInfoRow}>
                        <span style={s.compareInfoLabel}>{t('dcm.historyExam')}</span>
                        <span style={s.compareInfoValue}>{compareExam.examDate}</span>
                      </div>
                      <div style={s.compareInfoRow}>
                        <span style={s.compareInfoLabel}>{t('dcm.timeInterval')}</span>
                        <span style={s.compareInfoValue}>约45天</span>
                      </div>
                    </div>

                    {/* 差异摘要 */}
                    {getCompareDiffInfo() && (
                      <div style={s.diffSummaryCard}>
                        <div style={s.diffSummaryTitle}>
                          <AlertTriangle size={12} />{t('dcm.diffSummary')}</div>
                        {getCompareDiffInfo()?.map((diff, idx) => (
                          <div key={idx} style={s.diffSummaryItem}>
                            <div
                              style={{
                                ...s.diffSummaryDot,
                                background: diff.type === 'increase' ? '#ef4444' :
                                  diff.type === 'decrease' ? '#3b82f6' :
                                    diff.type === 'new' ? '#22c55e' : '#94a3b8',
                              }}
                            />
                            <span style={{ flex: 1 }}>{diff.label}:</span>
                            <span style={{
                              color: diff.type === 'increase' ? '#ef4444' :
                                diff.type === 'decrease' ? '#3b82f6' :
                                  diff.type === 'new' ? '#22c55e' : '#94a3b8',
                              fontWeight: 600,
                            }}>
                              {diff.oldVal} → {diff.newVal}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 历史报告摘要 */}
                    <div style={s.compareInfoCard}>
                      <div style={s.compareInfoCardTitle}>
                        <ScrollText size={12} />{t('dcm.historyReport')}</div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{t('dcm.reportDoctor')}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                          {compareExam.reportDoctor || '未报告'}
                        </div>
                      </div>
                      {compareExam.finding && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{t('dcm.finding')}</div>
                          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                            {compareExam.finding}
                          </div>
                        </div>
                      )}
                      {compareExam.conclusion && (
                        <div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{t('dcm.conclusion')}</div>
                          <div style={{ fontSize: 12, color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>
                            {compareExam.conclusion}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ===== 标签页6：跨机构调阅 ===== */}
            {rightTab === 'external' && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}>
                    <GitCompare size={12} />{t('dcm.crossInst')}</div>

                  {/* 机构选择器 */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>{t('dcm.selectInst')}</div>
                    <select
                      value={externalInstitution}
                      onChange={e => {
                        setExternalInstitution(e.target.value)
                        setExternalSearchResults([])
                        setSelectedExternalExam(null)
                      }}
                      style={{
                        ...s.select,
                        width: '100%',
                        minWidth: 'unset',
                      }}
                    >
                      <option value="">-- 请选择外部机构 --</option>
                      {EXTERNAL_INSTITUTIONS.filter(inst => inst.status === 'online').map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                    {externalInstitution && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        {EXTERNAL_INSTITUTIONS.find(i => i.id === externalInstitution)?.address}
                      </div>
                    )}
                  </div>

                  {/* 检索方式切换 */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    <button
                      style={{
                        ...s.mprTab,
                        flex: 1,
                        ...(externalSearchType === 'patientId' ? s.mprTabActive : {}),
                      }}
                      onClick={() => setExternalSearchType('patientId')}
                    >{t('dcm.patientId')}</button>
                    <button
                      style={{
                        ...s.mprTab,
                        flex: 1,
                        ...(externalSearchType === 'patientName' ? s.mprTabActive : {}),
                      }}
                      onClick={() => setExternalSearchType('patientName')}
                    >{t('dc.patientName')}</button>
                  </div>

                  {/* 检索输入框 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder={externalSearchType === 'patientId' ? '输入患者ID' : '输入患者姓名'}
                      value={externalSearchText}
                      onChange={e => setExternalSearchText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleExternalSearch()}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      style={{
                        ...s.historySearchBtn,
                        padding: '6px 12px',
                      }}
                      onClick={handleExternalSearch}
                    >{t('dcm.search')}</button>
                  </div>
                </div>

                {/* 检索结果列表 */}
                {externalSearchResults.length > 0 && (
                  <div style={s.infoSection}>
                    <div style={s.infoSectionTitle}>
                      <FileSearch size={12} />检索结果 ({externalSearchResults.length})
                    </div>
                    {externalSearchResults.map(exam => (
                      <div
                        key={exam.id}
                        style={{
                          ...s.historyListItem,
                          ...(selectedExternalExam?.id === exam.id ? s.historyListItemSelected : {}),
                        }}
                        onClick={() => setSelectedExternalExam(exam)}
                      >
                        <div style={s.historyListItemContent}>
                          <div style={s.historyListItemHeader}>
                            <span style={s.historyListItemTitle}>{exam.examItemName}</span>
                            <span style={s.historyListItemDate}>{exam.examDate}</span>
                          </div>
                          <div style={s.historyListItemMeta}>
                            {exam.patientName} · {exam.gender}/{exam.age}岁 · {exam.modality} · {exam.bodyPart}
                          </div>
                          <div style={{
                            ...s.historyListItemStatus,
                            background: exam.status === 'available' ? '#dcfce7' : exam.status === 'pending' ? '#fef3c7' : '#f3f4f6',
                            color: exam.status === 'available' ? '#16a34a' : exam.status === 'pending' ? '#d97706' : '#6b7280',
                          }}>
                            {exam.status === 'available' && <CheckCircle size={9} />}
                            {exam.status === 'available' ? '可调阅' : exam.status === 'pending' ? '申请中' : '已归档'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 选中外院检查详情 */}
                {selectedExternalExam && (
                  <>
                    <div style={s.infoSection}>
                      <div style={s.infoSectionTitle}>
                        <FileText size={12} />外院检查详情
                      </div>
                      <div style={s.infoGrid}>
                        <div style={s.infoItem}>
                          <span style={s.infoLabel}>{t('dc.patientName')}</span>
                          <span style={s.infoValue}>{selectedExternalExam.patientName}</span>
                        </div>
                        <div style={s.infoItem}>
                          <span style={s.infoLabel}>{t('dcm.genderAge')}</span>
                          <span style={s.infoValue}>{selectedExternalExam.gender}/{selectedExternalExam.age}岁</span>
                        </div>
                        <div style={s.infoItem}>
                          <span style={s.infoLabel}>{t('dcm.examItem')}</span>
                          <span style={s.infoValue}>{selectedExternalExam.examItemName}</span>
                        </div>
                        <div style={s.infoItem}>
                          <span style={s.infoLabel}>{t('dcm.examDate')}</span>
                          <span style={s.infoValue}>{selectedExternalExam.examDate}</span>
                        </div>
                        <div style={s.infoItem}>
                          <span style={s.infoLabel}>{t('qcimage.device')}</span>
                          <span style={s.infoValue}>{selectedExternalExam.deviceName.split('（')[0]}</span>
                        </div>
                        <div style={s.infoItem}>
                          <span style={s.infoLabel}>{t('qcimage.examId')}</span>
                          <span style={s.infoValue}>{selectedExternalExam.accessionNumber}</span>
                        </div>
                      </div>
                    </div>

                    {/* 外院报告摘要 */}
                    {selectedExternalExam.finding && (
                      <div style={s.infoSection}>
                        <div style={s.infoSectionTitle}>
                          <ScrollText size={12} />外院报告摘要
                        </div>
                        <div style={s.reportStatusCard}>
                          <div style={{ marginBottom: 6 }}>
                            <span style={s.infoLabel}>{t('dcm.reportDoctor')}</span>
                            <div style={s.infoValue}>{selectedExternalExam.reportDoctor || '未填写'}</div>
                          </div>
                          {selectedExternalExam.finding && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={s.infoLabel}>{t('dcm.finding')}</span>
                              <div style={{ ...s.infoValueFull, fontSize: 12, lineHeight: 1.5 }}>{selectedExternalExam.finding}</div>
                            </div>
                          )}
                          {selectedExternalExam.conclusion && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={s.infoLabel}>{t('dcm.conclusion')}</span>
                              <div style={{ ...s.infoValueFull, fontSize: 12, fontWeight: 600, color: '#dc2626', lineHeight: 1.5 }}>{selectedExternalExam.conclusion}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 对比模式控制 */}
                    <div style={s.infoSection}>
                      <div style={s.infoSectionTitle}>
                        <GitCompare size={12} />影像对比
                      </div>
                      {/* 布局切换 */}
                      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                        <button
                          style={{
                            ...s.mprTab,
                            flex: 1,
                            ...(externalCompareLayout === 'leftRight' ? s.mprTabActive : {}),
                          }}
                          onClick={() => setExternalCompareLayout('leftRight')}
                        >
                          左右
                        </button>
                        <button
                          style={{
                            ...s.mprTab,
                            flex: 1,
                            ...(externalCompareLayout === 'topBottom' ? s.mprTabActive : {}),
                          }}
                          onClick={() => setExternalCompareLayout('topBottom')}
                        >
                          上下
                        </button>
                      </div>
                      <button
                        style={{
                          ...s.reportBtn,
                          background: isExternalCompareMode ? '#ef4444' : PRIMARY,
                          color: '#fff',
                        }}
                        onClick={() => setIsExternalCompareMode(!isExternalCompareMode)}
                      >
                        <GitCompare size={14} />
                        {isExternalCompareMode ? '退出对比' : '启动对比'}
                      </button>
                    </div>

                    {/* 申请归档 */}
                    <div style={s.infoSection}>
                      <div style={s.infoSectionTitle}>
                        <Upload size={12} />申请调阅归档
                      </div>
                      <div style={{
                        padding: '8px 10px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        marginBottom: 8,
                        border: '1px solid #e2e8f0',
                      }}>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                          将外院影像归档至本院PACS系统，便于后续长期查阅和对比。
                        </div>
                      </div>
                      {archiveRequestStatus && (
                        <div style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          marginBottom: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          background: archiveRequestStatus === 'success' ? '#dcfce7' : '#fef3c7',
                          color: archiveRequestStatus === 'success' ? '#16a34a' : '#d97706',
                        }}>
                          {archiveRequestStatus === 'success' ? (
                            <><CheckCircle size={12} /> 申请已提交，请等待审核</>
                          ) : (
                            <><Clock size={12} /> 申请处理中...</>
                          )}
                        </div>
                      )}
                      <button
                        style={{
                          ...s.reportBtn,
                          background: selectedExternalExam.status === 'archived' ? '#94a3b8' : PRIMARY,
                          color: '#fff',
                          cursor: selectedExternalExam.status === 'archived' ? 'not-allowed' : 'pointer',
                        }}
                        disabled={selectedExternalExam.status === 'archived' || !!archiveRequestStatus}
                        onClick={handleArchiveRequest}
                      >
                        <Upload size={14} />
                        {selectedExternalExam.status === 'archived' ? '已归档' : archiveRequestStatus ? '已申请' : '申请调阅'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* =============================================== */}
      {/* 打印预览Modal */}
      {/* =============================================== */}
      {showPrintPreview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowPrintPreview(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24,
            width: 640, maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>胶片打印预览</span>
              <button onClick={() => setShowPrintPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            {/* 模拟胶片布局 */}
            <div style={{ background: '#111', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                {['序列1 - 层面1', '序列1 - 层面2', '序列2 - 层面1', '序列2 - 层面2'].map((label, i) => (
                  <div key={i} style={{ background: '#222', borderRadius: 4, padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                    <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>▣</div>
                    {label}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 12 }}>
                <span>Patient: {exam.patientName} | {exam.patientId}</span>
                <span>{exam.examItemName} | {exam.deviceName.split('（')[0]}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }} onClick={() => setShowPrintPreview(false)}>{t('dc.cancel')}</button>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => { showToast('正在发送打印任务...'); setShowPrintPreview(false) }}>
                <Printer size={14} />确认打印
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================== */}
      {/* Toast 提示 */}
      {/* =============================================== */}
      {toastVisible && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#22c55e', color: '#fff', padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(34,197,94,0.4)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn 0.3s ease',
        }}>
          <CheckCircle size={16} />{toastMsg}
        </div>
      )}

      {/* =============================================== */}
      {/* 底部状态栏 */}
      {/* =============================================== */}
      <div style={s.statusBar}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileImage size={12} />
          {exam.patientName} · {exam.examItemName}
        </span>
        <span>Accession: {exam.accessionNumber}</span>
        <span>设备: {exam.deviceName.split('（')[0]}</span>
        <span style={{ color: '#3b82f6' }}>窗口: {ww}/{wl}</span>
        <span style={{ color: '#22c55e' }}>缩放: {zoom}%</span>
        <span style={{ color: '#f59e0b' }}>旋转: {rotation}°</span>
        <span style={{ color: '#a855f7' }}>
          {activeSeries.seriesDescription}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Activity size={12} />
          DICOM Viewer v0.4.0 | {exam.modality}-{exam.bodyPart}
        </span>
      </div>
    </div>
    </>
  )
}

// 辅助图标组件（确保所有图标都被引用）
function FileImage(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 16, ...rest } = props
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

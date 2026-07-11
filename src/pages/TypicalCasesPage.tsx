// @ts-nocheck
// TODO v3.0.4: 替换此文件中所有硬编码中文文本为 i18n t() 调用 (约 2,207 字符)
// ============================================================
// G005 放射科RIS系统 - 典型病例库 v1.0.0
// 汉东省人民医院放射科
// ============================================================
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, Filter, X, ChevronDown, ChevronUp,
  Eye, Heart, MessageSquare, Clock, Calendar,
  Stethoscope, FileText, Tag, Plus, Upload,
  Download, AlertTriangle, Share2, ThumbsUp,
  Image as ImageIcon, Bookmark, BookmarkCheck,
  Activity, Scan, Monitor, BookOpen, List,
  FilterX, Award, Settings, RefreshCw, Edit3
} from 'lucide-react'

// ============================================================
// 样式常量 - 蓝色主题
// ============================================================
const COLORS = {
  primary: '#1e3a5f',
  primaryLight: '#2d4a6f',
  primaryDark: '#152a45',
  white: '#ffffff',
  background: '#f1f5f9',
  backgroundLight: '#f8fafc',
  text: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: '#e2e8f0',
  success: '#059669',
  successBg: '#ecfdf5',
  warning: '#d97706',
  warningBg: '#fffbeb',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  info: '#2563eb',
  infoBg: '#eff6ff',
  purple: '#7c3aed',
  purpleBg: '#f5f3ff',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: '#3b82f6', MR: '#60a5fa', DR: '#22c55e',
  DSA: '#f59e0b', XR: '#06b6d4', MG: '#ec4899',
}

// ============================================================
// 类型定义
// ============================================================
interface TypicalCase {
  id: string
  patientName: string
  age: number
  gender: string
  examType: string
  examName: string
  bodyPart: string
  disease: string
  diagnosis: string
  findings: string
  impression: string
  findingsList: string[]
  tags: string[]
  teaching: boolean
  images: { thumbnail: string; description: string }[]
  annotations: { id: string; x: number; y: number; type: string; label: string; description: string }[]
  discussions: { id: string; user: string; avatar: string; content: string; time: string; likes: number; liked: boolean }[]
  likeCount: number
  viewCount: number
  createdAt: string
  createdBy: string
  status: '已审核' | '待审核' | '编辑中'
  verified: boolean
}

// ============================================================
// 模拟数据 - 10个典型病例
// ============================================================
const mockTypicalCases: TypicalCase[] = [
  {
    id: 'TC001', patientName: '张志刚', age: 62, gender: '男', examType: 'CT', examName: '冠脉CTA',
    bodyPart: '心脏', disease: '冠心病', diagnosis: '左主干开口狭窄约85%，前降支近段狭窄约90%',
    findings: '冠脉CTA扫描显示：左主干开口可见重度狭窄，约85%，可见混合斑块形成。前降支近段可见重度狭窄，约90%，局部管壁增厚。回旋支近段可见中度狭窄，约75%。右冠状动脉近段可见重度狭窄，约80%。左室心肌未见明显异常强化。',
    impression: '1. 左主干开口重度狭窄（约85%）\n2. 前降支近段重度狭窄（约90%）\n3. 回旋支近段中度狭窄（约75%）\n4. 右冠状动脉近段重度狭窄（约80%）\n5. 建议行CAG+PCI治疗',
    findingsList: ['左主干开口狭窄约85%', '前降支近段狭窄约90%', '回旋支近段狭窄约75%', '右冠近段狭窄约80%'],
    tags: ['冠心病', '冠脉狭窄', '教学病例', '典型征象'], teaching: true,
    images: [
      { thumbnail: 'coronary', description: '冠脉CTA VR重建' },
      { thumbnail: 'coronary', description: '冠脉CTA CPR重建' },
      { thumbnail: 'coronary', description: '冠脉CTA横断位' },
    ],
    annotations: [
      { id: 'A1', x: 35, y: 45, type: 'stenosis', label: '左主干开口狭窄', description: '狭窄约85%，混合斑块' },
      { id: 'A2', x: 55, y: 40, type: 'stenosis', label: '前降支近段狭窄', description: '狭窄约90%' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '非常典型的左主干加三支病变病例，狭窄程度严重，教学价值很高。', time: '2026-04-28 14:30', likes: 12, liked: false },
      { id: 'D2', user: '王秀峰', avatar: 'WXF', content: '同意分析，建议优先处理左主干和前降支病变。', time: '2026-04-28 15:00', likes: 8, liked: true },
    ],
    likeCount: 45, viewCount: 1230, createdAt: '2026-04-25', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC002', patientName: '李秀英', age: 55, gender: '女', examType: 'MR', examName: '头颅MR平扫',
    bodyPart: '头颅', disease: '脑转移瘤', diagnosis: '右侧额叶占位，考虑转移瘤',
    findings: '颅脑MR平扫+T1WI、T2WI、FLAIR及增强扫描：右侧额叶见约2.1×1.8cm异常信号，T1WI呈等低信号，T2WI呈高信号，周围见大片水肿信号。增强扫描病灶明显不均匀强化。左侧小脑半球见约0.8cm小结节影。',
    impression: '1. 右侧额叶占位，考虑转移瘤\n2. 左侧小脑半球小结节，考虑转移瘤\n3. 建议进一步查找原发灶',
    findingsList: ['右侧额叶约2.1×1.8cm占位', '病灶周围大片水肿', '增强扫描明显不均匀强化', '左侧小脑半球约0.8cm小结节'],
    tags: ['脑肿瘤', '转移瘤', '典型征象', 'MRI表现'], teaching: true,
    images: [
      { thumbnail: 'brain', description: 'T1WI增强扫描' },
      { thumbnail: 'brain', description: 'T2WI序列' },
      { thumbnail: 'brain', description: 'FLAIR序列' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 35, type: 'mass', label: '额叶占位', description: '2.1×1.8cm，明显强化' },
      { id: 'A2', x: 50, y: 60, type: 'edema', label: '周围水肿', description: '大片血管源性水肿' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '环形强化+大片水肿是转移瘤的典型表现，需与胶质瘤鉴别。', time: '2026-04-26 10:00', likes: 15, liked: true },
    ],
    likeCount: 38, viewCount: 980, createdAt: '2026-04-26', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC003', patientName: '王建国', age: 58, gender: '男', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '肺癌', diagnosis: '右肺上叶周围型肺癌',
    findings: '胸部CT平扫显示：右肺上叶尖段见约3.5×2.8cm团块影，边缘毛刺状，可见分叶，密度不均匀，CT值约45-65Hu。纵隔淋巴结肿大，较大者约1.5cm。左侧肾上腺增粗，约1.8cm。',
    impression: '1. 右肺上叶周围型肺癌（建议穿刺活检）\n2. 纵隔淋巴结肿大\n3. 左侧肾上腺转移待排除',
    findingsList: ['右肺上叶团块影3.5×2.8cm', '边缘毛刺状', '纵隔淋巴结肿大约1.5cm', '左侧肾上腺增粗'],
    tags: ['肺癌', '周围型肺癌', '典型征象', '教学病例'], teaching: true,
    images: [
      { thumbnail: 'lung', description: '胸部CT肺窗' },
      { thumbnail: 'lung', description: '胸部CT纵隔窗' },
      { thumbnail: 'lung', description: '三维重建' },
    ],
    annotations: [
      { id: 'A1', x: 40, y: 30, type: 'mass', label: '右上叶团块', description: '3.5×2.8cm，边缘毛刺' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '典型周围型肺癌表现，边缘毛刺征是恶性肿瘤特征。', time: '2026-04-27 09:00', likes: 20, liked: false },
    ],
    likeCount: 52, viewCount: 1450, createdAt: '2026-04-27', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC004', patientName: '赵晓敏', age: 45, gender: '女', examType: 'CT', examName: '头颅CT平扫',
    bodyPart: '头颅', disease: '硬膜下血肿', diagnosis: '左侧额颞顶部硬膜下血肿',
    findings: '颅脑CT平扫显示：左侧额颞顶部颅骨内板下方见新月形高密度影，厚度约8mm，密度均匀，CT值约65Hu。右侧脑室轻度受压变形。中线结构右偏约5mm。',
    impression: '1. 左侧额颞顶部硬膜下血肿\n2. 右侧脑室轻度受压\n3. 中线结构右偏约5mm',
    findingsList: ['左侧额颞顶部新月形高密度影', '血肿厚度约8mm', '右侧脑室轻度受压变形', '中线结构右偏约5mm'],
    tags: ['硬膜下血肿', '外伤', '急诊', '典型征象'], teaching: false,
    images: [{ thumbnail: 'brain', description: '颅脑CT平扫' }],
    annotations: [{ id: 'A1', x: 35, y: 40, type: 'hematoma', label: '硬膜下血肿', description: '左侧额颞顶部，厚度8mm' }],
    discussions: [
      { id: 'D1', user: '张海涛', avatar: 'ZHT', content: '典型外伤后硬膜下血肿表现，中线移位明显，需密切监测。', time: '2026-04-27 14:00', likes: 10, liked: true },
    ],
    likeCount: 25, viewCount: 780, createdAt: '2026-04-27', createdBy: '张海涛', status: '已审核', verified: true,
  },
  {
    id: 'TC005', patientName: '周玉芬', age: 52, gender: '女', examType: 'CT', examName: '腹部CT平扫+增强',
    bodyPart: '腹部', disease: '肝血管瘤', diagnosis: '肝右叶血管瘤',
    findings: '上腹部CT增强扫描显示：肝右叶见约4.5×3.8cm低密度影，边界清晰，动脉期边缘结节样强化，门脉期及延迟期对比剂逐渐向内填充，呈现"快进慢出"的强化模式。',
    impression: '1. 肝右叶血管瘤\n2. 符合良性病变影像学表现',
    findingsList: ['肝右叶约4.5×3.8cm低密度影', '边界清晰', '动脉期边缘结节样强化', '"快进慢出"强化模式'],
    tags: ['肝血管瘤', '良性肿瘤', '典型征象', '鉴别诊断'], teaching: true,
    images: [
      { thumbnail: 'liver', description: '动脉期' },
      { thumbnail: 'liver', description: '门脉期' },
      { thumbnail: 'liver', description: '延迟期' },
    ],
    annotations: [{ id: 'A1', x: 50, y: 45, type: 'mass', label: '肝血管瘤', description: '4.5×3.8cm，边缘强化' }],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '"快进慢出"是肝血管瘤的典型强化模式，与肝癌的"快进快出"形成对比。', time: '2026-04-28 10:00', likes: 18, liked: false },
    ],
    likeCount: 33, viewCount: 890, createdAt: '2026-04-28', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC006', patientName: '孙伟', age: 35, gender: '男', examType: 'MR', examName: '腰椎MR平扫',
    bodyPart: '脊柱', disease: '腰椎间盘突出', diagnosis: 'L4/5椎间盘向左后突出',
    findings: '腰椎MR平扫显示：L4/5椎间盘向后突出，约0.6cm，压迫硬膜囊前缘。L5/S1椎间盘信号正常，未见突出。椎管形态正常，未见狭窄。黄韧带未见增厚。',
    impression: '1. L4/5椎间盘突出（旁中型）\n2. L5/S1椎间盘未见异常',
    findingsList: ['L4/5椎间盘向后突出约0.6cm', '硬膜囊前缘受压', 'L5/S1椎间盘信号正常', '椎管形态正常'],
    tags: ['椎间盘突出', '腰椎', '退行性病变', '典型征象'], teaching: false,
    images: [
      { thumbnail: 'spine', description: 'T2WI矢状位' },
      { thumbnail: 'spine', description: 'T2WI横断位' },
    ],
    annotations: [{ id: 'A1', x: 50, y: 50, type: 'herniation', label: 'L4/5突出', description: '向后突出0.6cm' }],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '典型椎间盘突出MR表现，矢状位T2WI显示椎间盘信号减低。', time: '2026-04-29 11:00', likes: 14, liked: true },
    ],
    likeCount: 28, viewCount: 650, createdAt: '2026-04-29', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC007', patientName: '吴婷', age: 42, gender: '女', examType: 'DR', examName: 'MG',
    bodyPart: '胸部', disease: '乳腺癌', diagnosis: '左侧乳腺外上象限肿块，BI-RADS 5类',
    findings: '双侧乳腺钼靶X线摄影（MLO+CC位）显示：左侧乳腺外上象限见约2.1×1.8cm肿块影，边缘毛刺状，密度不均匀增高。周围可见簇状钙化。皮肤局限性增厚。',
    impression: '1. 左侧乳腺外上象限肿块，BI-RADS 5类\n2. 建议活检明确诊断',
    findingsList: ['左乳外上象限肿块2.1×1.8cm', '边缘毛刺状', '周围簇状钙化', '皮肤局限性增厚'],
    tags: ['乳腺癌', '乳腺肿块', 'BI-RADS 5', '教学病例'], teaching: true,
    images: [
      { thumbnail: 'breast', description: 'MLO位' },
      { thumbnail: 'breast', description: 'CC位' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'mass', label: '乳腺肿块', description: '2.1×1.8cm，边缘毛刺' },
      { id: 'A2', x: 50, y: 50, type: 'calc', label: '簇状钙化', description: '恶性钙化特征' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '典型乳腺癌X线表现，毛刺征和簇状钙化都是恶性特征。', time: '2026-04-29 14:00', likes: 22, liked: false },
    ],
    likeCount: 41, viewCount: 1100, createdAt: '2026-04-29', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC008', patientName: '郑丽', age: 38, gender: '女', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '肺栓塞', diagnosis: '双侧肺动脉栓塞',
    findings: '肺动脉CTA显示：双侧肺动脉主干及分支可见多发充盈缺损，左下肺动脉主干完全阻塞。右中肺动脉分支可见偏心性充盈缺损。心脏形态正常，主肺动脉干轻度扩张。',
    impression: '1. 双侧肺动脉栓塞\n2. 左下肺动脉主干完全阻塞\n3. 危急值，已电话通知临床',
    findingsList: ['双侧肺动脉多发充盈缺损', '左下肺动脉主干完全阻塞', '右中肺动脉偏心性充盈缺损', '主肺动脉干轻度扩张'],
    tags: ['肺栓塞', '危急值', '急诊', '典型征象', '教学病例'], teaching: true,
    images: [
      { thumbnail: 'pulmo', description: '肺动脉CTA' },
      { thumbnail: 'pulmo', description: '肺动脉MIP重建' },
    ],
    annotations: [
      { id: 'A1', x: 40, y: 35, type: 'emboli', label: '左下肺动脉栓塞', description: '完全阻塞' },
      { id: 'A2', x: 60, y: 40, type: 'emboli', label: '右中肺动脉栓塞', description: '偏心性充盈缺损' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '典型肺栓塞CT表现，充盈缺损是直接征象。', time: '2026-04-30 09:00', likes: 25, liked: true },
    ],
    likeCount: 48, viewCount: 1350, createdAt: '2026-04-30', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC009', patientName: '刘建国', age: 65, gender: '男', examType: 'CT', examName: '腹部CT平扫',
    bodyPart: '腹部', disease: '急性胰腺炎', diagnosis: '急性坏死性胰腺炎',
    findings: '上腹部CT平扫显示：胰腺体积明显增大，以体尾部为著，轮廓模糊，密度不均匀减低，周围脂肪间隙模糊、密度增高，可见大量渗出延伸至肾前筋膜。胰周可见液性暗区。',
    impression: '1. 急性坏死性胰腺炎\n2. 胰周渗出伴液性暗区形成\n3. 累及肾前筋膜',
    findingsList: ['胰腺体积明显增大', '体尾部为著，轮廓模糊', '周围脂肪间隙渗出', '肾前筋膜受累'],
    tags: ['急性胰腺炎', '坏死性胰腺炎', '急诊', '典型征象'], teaching: true,
    images: [
      { thumbnail: 'pancreas', description: 'CT平扫' },
      { thumbnail: 'pancreas', description: 'CT增强' },
    ],
    annotations: [{ id: 'A1', x: 45, y: 45, type: 'inflammation', label: '胰腺坏死', description: '体积增大，密度不均' }],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '急性坏死性胰腺炎的CT表现，胰腺模糊+周围渗出是典型特征。', time: '2026-05-01 10:00', likes: 16, liked: false },
    ],
    likeCount: 35, viewCount: 920, createdAt: '2026-05-01', createdBy: '刘芳', status: '待审核', verified: false,
  },
  {
    id: 'TC010', patientName: '陈小红', age: 28, gender: '女', examType: 'MR', examName: '盆腔MR平扫',
    bodyPart: '盆腔', disease: '卵巢囊肿', diagnosis: '右侧卵巢巧克力囊肿',
    findings: '盆腔MR平扫显示：右侧卵巢区见约4.2×3.5cm囊性信号，壁厚薄不均，T1WI呈高信号，T2WI呈不均匀高信号，内可见液-液平面。左侧卵巢未见明显异常。',
    impression: '1. 右侧卵巢巧克力囊肿\n2. 建议妇科随诊',
    findingsList: ['右侧卵巢约4.2×3.5cm囊性信号', '壁厚薄不均', 'T1WI高信号（出血）', 'T2WI不均匀高信号'],
    tags: ['卵巢囊肿', '巧克力囊肿', '典型征象', '妇科'], teaching: false,
    images: [
      { thumbnail: 'pelvis', description: 'T1WI' },
      { thumbnail: 'pelvis', description: 'T2WI' },
    ],
    annotations: [{ id: 'A1', x: 50, y: 45, type: 'cyst', label: '巧克力囊肿', description: '4.2×3.5cm，T1高信号' }],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: 'T1高信号是巧克力囊肿的特征，与普通囊肿鉴别点在于是否有出血成分。', time: '2026-05-01 14:00', likes: 12, liked: true },
    ],
    likeCount: 22, viewCount: 580, createdAt: '2026-05-01', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC011', patientName: '赵大力', age: 55, gender: '男', examType: 'CT', examName: '上腹部CT平扫',
    bodyPart: '腹部', disease: '原发性肝癌', diagnosis: '肝细胞癌合并门静脉癌栓',
    findings: '上腹部CT平扫+增强显示：肝右叶见约6.5×5.8cm团块影，动脉期明显不均匀强化，门脉期及延迟期快速廓清，呈现"快进快出"强化模式。门静脉右支可见充盈缺损，考虑癌栓形成。肝门部淋巴结肿大。腹水少量。',
    impression: '1. 肝右叶肝细胞癌\n2. 门静脉右支癌栓形成\n3. 肝门部淋巴结肿大\n4. 腹水',
    findingsList: ['肝右叶6.5×5.8cm团块影', '"快进快出"强化模式', '门静脉右支癌栓', '肝门部淋巴结肿大', '腹水少量'],
    tags: ['肝癌', '肝细胞癌', '门静脉癌栓', '典型征象', '教学病例'], teaching: true,
    images: [
      { thumbnail: 'liver', description: '动脉期' },
      { thumbnail: 'liver', description: '门脉期' },
      { thumbnail: 'liver', description: '延迟期' },
      { thumbnail: 'liver', description: '门静脉重建' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'mass', label: '肝右叶肿瘤', description: '6.5×5.8cm，"快进快出"' },
      { id: 'A2', x: 55, y: 55, type: 'thrombus', label: '门静脉癌栓', description: '右支充盈缺损' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '"快进快出"是肝细胞癌的典型强化模式，与血管瘤的"快进慢出"鉴别。门静脉癌栓是晚期肝癌的重要标志。', time: '2026-05-02 09:00', likes: 28, liked: true },
      { id: 'D2', user: '张海涛', avatar: 'ZHT', content: '需要与肝硬化结节鉴别，后者通常动脉期强化不明显。', time: '2026-05-02 10:30', likes: 15, liked: false },
    ],
    likeCount: 56, viewCount: 1680, createdAt: '2026-05-02', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC012', patientName: '王秀兰', age: 48, gender: '女', examType: 'CT', examName: '盆腔CT平扫',
    bodyPart: '盆腔', disease: '宫颈癌', diagnosis: '宫颈癌（IIA期）',
    findings: '盆腔CT平扫显示：宫颈增大，约4.2×3.5cm，密度不均匀，可见低密度坏死区。阴道壁上1/3受累，双侧宫旁组织未见明显异常。盆腔淋巴结未见肿大。膀胱及直肠壁光滑。',
    impression: '1. 宫颈癌（IIA期）\n2. 建议MRI进一步分期\n3. 建议病理活检',
    findingsList: ['宫颈增大4.2×3.5cm', '密度不均匀，低密度坏死', '阴道壁上1/3受累', '双侧宫旁组织未受累', '盆腔淋巴结未见肿大'],
    tags: ['宫颈癌', '妇科肿瘤', '典型征象', '教学病例'], teaching: true,
    images: [
      { thumbnail: 'pelvis', description: 'CT平扫横断面' },
      { thumbnail: 'pelvis', description: 'CT增强' },
      { thumbnail: 'pelvis', description: '冠状面重建' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'mass', label: '宫颈肿瘤', description: '4.2×3.5cm，坏死' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '宫颈癌的CT表现主要是宫颈增大和密度改变，但MRI对软组织分辨率更高，建议补充MRI检查进行分期。', time: '2026-05-02 14:00', likes: 18, liked: false },
    ],
    likeCount: 32, viewCount: 890, createdAt: '2026-05-02', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  // ============================================================
  // 呼吸系统病例 (TC013-TC019)
  // ============================================================
  {
    id: 'TC013', patientName: '黄建国', age: 68, gender: '男', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '慢性阻塞性肺疾病', diagnosis: '双肺气肿伴肺大泡形成',
    findings: '胸部CT平扫显示：双肺透亮度增高，肺纹理稀疏紊乱，多发肺大泡形成，较大者位于右肺上叶，约3.2×2.8cm。纵隔内可见多发淋巴结肿大。胸廓呈桶状改变。',
    impression: '1. 双肺气肿伴肺大泡形成\\n2. 纵隔淋巴结肿大\\n3. 桶状胸改变',
    findingsList: ['双肺透亮度增高', '肺纹理稀疏紊乱', '右肺上叶肺大泡3.2×2.8cm', '纵隔淋巴结肿大', '桶状胸'],
    tags: ['COPD', '肺气肿', '肺大泡', '典型征象'],
    images: [
      { thumbnail: 'lung', description: '肺窗' },
      { thumbnail: 'lung', description: '纵隔窗' },
    ],
    annotations: [
      { id: 'A1', x: 40, y: 35, type: 'emphysema', label: '右上肺大泡', description: '3.2×2.8cm' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '典型COPD影像表现，肺大泡和桶状胸是特征性改变。', time: '2026-05-02 15:00', likes: 10, liked: false },
    ],
    likeCount: 18, viewCount: 450, createdAt: '2026-05-02', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC014', patientName: '林小红', age: 32, gender: '女', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '肺结核', diagnosis: '右上肺继发性肺结核',
    findings: '胸部CT平扫显示：右肺上叶尖段见斑片状致密影，边界模糊，密度不均，可见空洞形成，约1.5×1.2cm。左肺下叶背段见小结节影，直径约0.5cm。纵隔淋巴结未见明显肿大。',
    impression: '1. 右上肺继发性肺结核伴空洞\\n2. 左肺下叶结核可能\\n3. 建议痰检及抗酸染色',
    findingsList: ['右上叶尖段斑片状致密影', '空洞形成1.5×1.2cm', '左下叶小结节0.5cm', '纵隔淋巴结未肿大'],
    tags: ['肺结核', '空洞', '传染病', '典型征象'],
    images: [
      { thumbnail: 'lung', description: '肺窗' },
      { thumbnail: 'lung', description: '纵隔窗' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 30, type: 'cavity', label: '结核空洞', description: '1.5×1.2cm' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '肺结核的典型表现，空洞和斑片影是常见征象，需与肺癌鉴别。', time: '2026-05-03 09:00', likes: 14, liked: true },
    ],
    likeCount: 26, viewCount: 680, createdAt: '2026-05-03', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC015', patientName: '张伟', age: 45, gender: '男', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '肺炎', diagnosis: '左肺下叶大叶性肺炎',
    findings: '胸部CT平扫显示：左肺下叶可见大片实变影，呈楔形分布，密度均匀，CT值约45Hu，可见空气支气管征。肺叶体积未见缩小。胸腔未见积液。',
    impression: '1. 左肺下叶大叶性肺炎\\n2. 空气支气管征阳性',
    findingsList: ['左肺下叶大片实变影', '呈楔形分布', '空气支气管征', '密度均匀'],
    tags: ['肺炎', '大叶性肺炎', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'lung', description: '肺窗' },
      { thumbnail: 'lung', description: '纵隔窗' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 55, type: 'consolidation', label: '大叶性肺炎', description: '左下叶实变，空气支气管征' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '典型大叶性肺炎表现，空气支气管征是重要诊断依据。', time: '2026-05-03 10:00', likes: 12, liked: false },
    ],
    likeCount: 22, viewCount: 520, createdAt: '2026-05-03', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC016', patientName: '李娜', age: 38, gender: '女', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '间质性肺病', diagnosis: '特发性肺纤维化',
    findings: '胸部CT平扫显示：双肺可见弥漫性网格状阴影，以双下肺及胸膜下区为著，可见蜂窝样改变。肺结构扭曲，肺容积缩小。双侧支气管血管束增粗。',
    impression: '1. 特发性肺纤维化（IPF）\\n2. 双肺弥漫性网格影伴蜂窝改变\\n3. 肺容积缩小',
    findingsList: ['双肺弥漫性网格状阴影', '蜂窝样改变', '肺结构扭曲', '肺容积缩小', '双侧支气管血管束增粗'],
    tags: ['间质性肺病', '肺纤维化', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'lung', description: '肺窗' },
      { thumbnail: 'lung', description: 'HRCT' },
    ],
    annotations: [
      { id: 'A1', x: 40, y: 60, type: 'fibrosis', label: '蜂窝样改变', description: '双下肺胸膜下区为著' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: 'IPF的典型CT表现，蜂窝和网格影是诊断关键。', time: '2026-05-03 14:00', likes: 16, liked: true },
    ],
    likeCount: 30, viewCount: 750, createdAt: '2026-05-03', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC017', patientName: '赵军', age: 55, gender: '男', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '胸腔积液', diagnosis: '右侧中量胸腔积液',
    findings: '胸部CT平扫显示：右侧胸腔可见弧形水样密度影，分布于胸壁与肺组织之间，最厚处约4.5cm，肺组织轻度受压膨胀不全。左肺未见异常。纵隔未见明显移位。',
    impression: '1. 右侧中量胸腔积液\\n2. 建议胸腔穿刺抽液送检',
    findingsList: ['右侧胸腔弧形水样密度影', '最厚处约4.5cm', '肺组织轻度受压', '纵隔未见明显移位'],
    tags: ['胸腔积液', '典型征象', '鉴别诊断'],
    images: [
      { thumbnail: 'lung', description: '肺窗' },
      { thumbnail: 'lung', description: '纵隔窗' },
    ],
    annotations: [
      { id: 'A1', x: 35, y: 50, type: 'effusion', label: '胸腔积液', description: '右侧中量，最厚4.5cm' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '典型胸腔积液表现，需鉴别漏出液和渗出液。', time: '2026-05-04 09:00', likes: 8, liked: false },
    ],
    likeCount: 15, viewCount: 380, createdAt: '2026-05-04', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC018', patientName: '王磊', age: 60, gender: '男', examType: 'CT', examName: '胸部CT增强',
    bodyPart: '胸部', disease: '纵隔肿瘤', diagnosis: '前纵隔畸胎瘤',
    findings: '胸部CT增强显示：前纵隔见约6.5×5.2cm囊实性肿块，边界清晰，密度不均匀，可见脂肪密度及钙化灶。增强扫描实性部分轻度强化。周围血管推压移位，未见明显侵犯。',
    impression: '1. 前纵隔畸胎瘤\\n2. 建议手术切除',
    findingsList: ['前纵隔囊实性肿块6.5×5.2cm', '边界清晰', '含脂肪密度及钙化', '实性部分轻度强化'],
    tags: ['纵隔肿瘤', '畸胎瘤', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'mediastinum', description: 'CT增强' },
      { thumbnail: 'mediastinum', description: '冠状面重建' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'mass', label: '前纵隔畸胎瘤', description: '6.5×5.2cm，含脂肪钙化' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '畸胎瘤的典型表现，脂肪和钙化成份是诊断关键。', time: '2026-05-04 10:00', likes: 20, liked: false },
    ],
    likeCount: 35, viewCount: 890, createdAt: '2026-05-04', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC019', patientName: '周敏', age: 42, gender: '女', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '胸部', disease: '支气管扩张', diagnosis: '左肺下叶支气管扩张',
    findings: '胸部CT平扫显示：左肺下叶可见支气管呈柱状及囊状扩张，管壁增厚，管腔增宽，可见印戒征。周围肺组织可见纤维条索影。右肺未见异常。',
    impression: '1. 左肺下叶支气管扩张\\n2. 周围肺组织纤维化',
    findingsList: ['左肺下叶支气管扩张', '柱状及囊状扩张', '管壁增厚', '印戒征阳性', '周围纤维条索'],
    tags: ['支气管扩张', '典型征象', '影像特征'],
    images: [
      { thumbnail: 'lung', description: '肺窗' },
      { thumbnail: 'lung', description: 'HRCT' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 55, type: 'bronchiectasis', label: '支气管扩张', description: '左下叶，印戒征' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '支气管扩张的典型CT表现，印戒征是特征性改变。', time: '2026-05-04 14:00', likes: 12, liked: true },
    ],
    likeCount: 20, viewCount: 480, createdAt: '2026-05-04', createdBy: '李明辉', status: '已审核', verified: true,
  },
  // ============================================================
  // 消化系统病例 (TC020-TC026)
  // ============================================================
  {
    id: 'TC020', patientName: '吴强', age: 52, gender: '男', examType: 'CT', examName: '腹部CT平扫+增强',
    bodyPart: '腹部', disease: '胃癌', diagnosis: '胃窦癌伴周围淋巴结转移',
    findings: '上腹部CT增强扫描显示：胃窦部胃壁局限性增厚，约1.2cm，黏膜面不规则，增强扫描明显强化。周围脂肪间隙模糊。肝胃间隙及腹膜后可见多发肿大淋巴结，较大者约1.8cm。',
    impression: '1. 胃窦癌\\n2. 肝胃间隙及腹膜后淋巴结转移\\n3. 建议胃镜活检',
    findingsList: ['胃窦部胃壁局限性增厚1.2cm', '黏膜面不规则', '明显强化', '周围淋巴结肿大1.8cm'],
    tags: ['胃癌', '消化道肿瘤', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'stomach', description: 'CT增强动脉期' },
      { thumbnail: 'stomach', description: 'CT增强静脉期' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 50, type: 'mass', label: '胃窦癌', description: '胃壁增厚1.2cm' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '胃癌的CT表现，胃壁增厚伴强化是直接征象。', time: '2026-05-05 09:00', likes: 18, liked: false },
    ],
    likeCount: 28, viewCount: 720, createdAt: '2026-05-05', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC021', patientName: '陈淑芬', age: 48, gender: '女', examType: 'CT', examName: '腹部CT平扫',
    bodyPart: '腹部', disease: '胆囊结石', diagnosis: '胆囊结石伴慢性胆囊炎',
    findings: '上腹部CT平扫显示：胆囊体积增大，壁增厚约4mm，胆囊内可见多发高密度影，较大者约1.5×1.2cm，CT值约800Hu。胆总管未见扩张。肝脏未见明显异常。',
    impression: '1. 胆囊结石伴慢性胆囊炎\\n2. 建议外科会诊',
    findingsList: ['胆囊体积增大', '胆囊壁增厚4mm', '多发高密度影1.5×1.2cm', 'CT值约800Hu', '胆总管未见扩张'],
    tags: ['胆囊结石', '慢性胆囊炎', '典型征象'],
    images: [
      { thumbnail: 'gallbladder', description: 'CT平扫' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'stone', label: '胆囊结石', description: '1.5×1.2cm，高密度' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '典型胆囊结石CT表现，高密度影是特征。', time: '2026-05-05 10:00', likes: 10, liked: true },
    ],
    likeCount: 18, viewCount: 420, createdAt: '2026-05-05', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC022', patientName: '刘志明', age: 58, gender: '男', examType: 'CT', examName: '腹部CT平扫+增强',
    bodyPart: '腹部', disease: '胰腺癌', diagnosis: '胰体尾部癌伴肝转移',
    findings: '上腹部CT增强扫描显示：胰体尾部见约4.5×3.8cm低密度肿块，边界不清，增强扫描轻度强化，延迟期强化更明显。肝内可见多发小结节影，较大者约1.2cm，考虑转移。腹膜后淋巴结未见肿大。',
    impression: '1. 胰体尾部癌\\n2. 肝内多发转移\\n3. 建议肿瘤标志物检查',
    findingsList: ['胰体尾部4.5×3.8cm低密度肿块', '边界不清', '延迟期强化', '肝内多发小结节转移'],
    tags: ['胰腺癌', '恶性肿瘤', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'pancreas', description: 'CT增强动脉期' },
      { thumbnail: 'pancreas', description: 'CT增强静脉期' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 45, type: 'mass', label: '胰体尾癌', description: '4.5×3.8cm，低密度' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '胰腺癌的典型CT表现，延迟强化是重要特征。', time: '2026-05-05 14:00', likes: 24, liked: false },
    ],
    likeCount: 38, viewCount: 920, createdAt: '2026-05-05', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC023', patientName: '张玉兰', age: 65, gender: '女', examType: 'CT', examName: '腹部CT平扫',
    bodyPart: '腹部', disease: '肠梗阻', diagnosis: '小肠梗阻',
    findings: '腹部CT平扫显示：小肠肠管明显扩张积气积液，可见多发气液平面。回肠末端见一团块状软组织密度影，边界不清，约3.2×2.5cm。结肠未见明显扩张。腹腔未见游离气体。',
    impression: '1. 小肠梗阻\\n2. 回肠末端占位考虑肿瘤可能\\n3. 建议进一步检查',
    findingsList: ['小肠肠管扩张积气积液', '多发气液平面', '回肠末端团块3.2×2.5cm', '结肠未扩张', '无游离气体'],
    tags: ['肠梗阻', '急诊', '典型征象'],
    images: [
      { thumbnail: 'intestine', description: 'CT平扫' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 55, type: 'obstruction', label: '回肠末端占位', description: '3.2×2.5cm，肠梗阻原因' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '肠梗阻的CT表现，气液平面是直接征象。', time: '2026-05-06 09:00', likes: 15, liked: true },
    ],
    likeCount: 25, viewCount: 580, createdAt: '2026-05-06', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC024', patientName: '孙桂英', age: 70, gender: '女', examType: 'CT', examName: '腹部CT平扫+增强',
    bodyPart: '腹部', disease: '结肠癌', diagnosis: '升结肠癌伴肠周淋巴结转移',
    findings: '腹部CT增强扫描显示：升结肠肠壁局限性增厚，约1.8cm，肠腔狭窄，增强扫描明显不均匀强化。肠周脂肪间隙模糊，见多发淋巴结，较大者约1.0cm。肝脏未见明显转移灶。',
    impression: '1. 升结肠癌\\n2. 肠周淋巴结肿大\\n3. 建议结肠镜活检',
    findingsList: ['升结肠肠壁增厚1.8cm', '肠腔狭窄', '明显不均匀强化', '肠周淋巴结肿大'],
    tags: ['结肠癌', '消化道肿瘤', '典型征象'],
    images: [
      { thumbnail: 'colon', description: 'CT增强' },
      { thumbnail: 'colon', description: '冠状面重建' },
    ],
    annotations: [
      { id: 'A1', x: 55, y: 45, type: 'mass', label: '升结肠癌', description: '肠壁增厚1.8cm' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '结肠癌的典型CT表现，肠壁增厚和强化是直接征象。', time: '2026-05-06 10:00', likes: 20, liked: false },
    ],
    likeCount: 30, viewCount: 680, createdAt: '2026-05-06', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC025', patientName: '马建华', age: 55, gender: '男', examType: 'CT', examName: '腹部CT平扫',
    bodyPart: '腹部', disease: '肝硬化', diagnosis: '肝硬化伴脾大',
    findings: '上腹部CT平扫显示：肝脏体积缩小，边缘呈波浪状，肝裂增宽。肝实质密度不均匀，可见多发再生结节。脾脏体积增大，约6个肋单元。门静脉增宽，约1.5cm。腹水中量。',
    impression: '1. 肝硬化（Child-Pugh B级）\\n2. 脾大\\n3. 门静脉增宽\\n4. 腹水中量',
    findingsList: ['肝脏体积缩小', '边缘波浪状', '肝裂增宽', '脾大6个肋单元', '门静脉增宽1.5cm', '腹水中量'],
    tags: ['肝硬化', '门脉高压', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'liver', description: 'CT平扫' },
      { thumbnail: 'liver', description: '门脉期' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'cirrhosis', label: '肝硬化', description: '体积缩小，再生结节' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '典型肝硬化表现，肝脏缩小和再生结节是特征。', time: '2026-05-06 14:00', likes: 22, liked: true },
    ],
    likeCount: 35, viewCount: 850, createdAt: '2026-05-06', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC026', patientName: '朱婷', age: 38, gender: '女', examType: 'CT', examName: '腹部CT平扫',
    bodyPart: '腹部', disease: '阑尾炎', diagnosis: '急性化脓性阑尾炎',
    findings: '腹部CT平扫显示：阑尾增粗肿胀，约1.2cm直径，壁增厚，周围脂肪间隙模糊、密度增高。可见少量渗出液积聚于右下腹。盲肠未见明显异常。',
    impression: '1. 急性化脓性阑尾炎\\n2. 阑尾周围炎\\n3. 建议急诊外科会诊',
    findingsList: ['阑尾增粗1.2cm', '壁增厚', '周围脂肪间隙模糊', '右下腹渗出液'],
    tags: ['阑尾炎', '急诊', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'appendix', description: 'CT平扫' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 55, type: 'inflammation', label: '阑尾炎', description: '阑尾增粗1.2cm' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '典型急性阑尾炎CT表现，阑尾增粗和周围渗出是诊断依据。', time: '2026-05-07 09:00', likes: 16, liked: false },
    ],
    likeCount: 24, viewCount: 620, createdAt: '2026-05-07', createdBy: '刘芳', status: '已审核', verified: true,
  },
  // ============================================================
  // 心血管系统病例 (TC027-TC033)
  // ============================================================
  {
    id: 'TC027', patientName: '徐大伟', age: 58, gender: '男', examType: 'CT', examName: '主动脉CTA',
    bodyPart: '心脏', disease: '主动脉夹层', diagnosis: 'Stanford B型主动脉夹层',
    findings: '主动脉CTA显示：降主动脉见内膜片影，将主动脉分为真假两腔，从左锁骨下动脉开口以远延伸至腹主动脉肾动脉水平。真腔较小，假腔较大。腹腔干、肠系膜上动脉及双肾动脉均起自真腔。',
    impression: '1. Stanford B型主动脉夹层\\n2. 从左锁骨下动脉延伸至腹主动脉\\n3. 腹腔干等主要分支起自真腔',
    findingsList: ['降主动脉内膜片影', '真假腔形成', '从左锁骨下动脉以远延伸', '假腔较大', '主要分支起自真腔'],
    tags: ['主动脉夹层', '危急值', '急诊', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'aorta', description: '主动脉CTA VR重建' },
      { thumbnail: 'aorta', description: '主动脉CTA MPR' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'dissection', label: '主动脉夹层', description: '内膜片，真假腔' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '典型B型主动脉夹层表现，内膜片和真假腔是直接征象。', time: '2026-05-07 10:00', likes: 30, liked: true },
    ],
    likeCount: 52, viewCount: 1450, createdAt: '2026-05-07', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC028', patientName: '杨秀英', age: 65, gender: '女', examType: 'CT', examName: '心脏CT平扫',
    bodyPart: '心脏', disease: '心肌病', diagnosis: '扩张型心肌病',
    findings: '心脏CT平扫显示：全心增大，以左心室为著，左心室舒张末径约6.8cm。左心房、右心房亦增大。左心室壁厚度正常范围，肌小梁显示清晰。心包未见明显异常。',
    impression: '1. 扩张型心肌病\\n2. 全心增大，左心室为著\\n3. 左心室舒张末径增大',
    findingsList: ['全心增大', '左心室舒张末径6.8cm', '左心房增大', '右心房增大', '心室壁厚度正常'],
    tags: ['心肌病', '扩张型心肌病', '典型征象'],
    images: [
      { thumbnail: 'heart', description: '心脏CT四腔心' },
      { thumbnail: 'heart', description: '心脏CT短轴位' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'cardiomyopathy', label: '扩张型心肌病', description: '左心室增大6.8cm' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '扩张型心肌病的典型表现，心腔扩大而室壁厚度正常是特征。', time: '2026-05-07 14:00', likes: 20, liked: false },
    ],
    likeCount: 32, viewCount: 780, createdAt: '2026-05-07', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC029', patientName: '郑涛', age: 48, gender: '男', examType: 'CT', examName: '冠脉CTA',
    bodyPart: '心脏', disease: '冠脉粥样硬化', diagnosis: '冠心病，前降支中段重度狭窄',
    findings: '冠脉CTA显示：左主干未见明显狭窄。前降支中段可见混合斑块伴管腔重度狭窄，约85%，斑块局部有钙化。对角支开口未见明显狭窄。回旋支近段可见轻度狭窄，约40%。右冠状动脉未见明显异常。',
    impression: '1. 前降支中段重度狭窄（约85%）\\n2. 回旋支近段轻度狭窄（约40%）\\n3. 建议冠脉造影进一步评估',
    findingsList: ['前降支中段狭窄约85%', '混合斑块伴钙化', '回旋支近段狭窄约40%', '左主干未见狭窄', '右冠未见异常'],
    tags: ['冠心病', '冠脉狭窄', '典型征象'],
    images: [
      { thumbnail: 'coronary', description: '冠脉CTA VR' },
      { thumbnail: 'coronary', description: '冠脉CTA CPR' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 40, type: 'stenosis', label: '前降支中段狭窄', description: '约85%' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '冠脉狭窄的CTA评估，重度狭窄需要介入治疗。', time: '2026-05-08 09:00', likes: 15, liked: true },
    ],
    likeCount: 28, viewCount: 920, createdAt: '2026-05-08', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC030', patientName: '冯玉珍', age: 72, gender: '女', examType: 'CT', examName: '胸部CT平扫',
    bodyPart: '心脏', disease: '心包积液', diagnosis: '中量心包积液',
    findings: '胸部CT平扫显示：心包脏层与壁层之间可见水样密度影，以左心室侧及心底部为著，最厚处约2.5cm。心脏形态未见明显异常。纵隔未见肿大淋巴结。',
    impression: '1. 中量心包积液\\n2. 建议进一步查找病因',
    findingsList: ['心包水样密度影', '最厚处约2.5cm', '左心室侧及心底部为著', '心脏形态正常'],
    tags: ['心包积液', '典型征象', '鉴别诊断'],
    images: [
      { thumbnail: 'heart', description: '胸部CT纵隔窗' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 50, type: 'effusion', label: '心包积液', description: '中量，最厚2.5cm' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '心包积液的CT表现，需要与胸腔积液鉴别。', time: '2026-05-08 10:00', likes: 12, liked: false },
    ],
    likeCount: 20, viewCount: 580, createdAt: '2026-05-08', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC031', patientName: '曹志刚', age: 60, gender: '男', examType: 'CT', examName: '主动脉CTA',
    bodyPart: '心脏', disease: '腹主动脉瘤', diagnosis: '腹主动脉瘤伴附壁血栓',
    findings: '主动脉CTA显示：腹主动脉肾动脉水平以下至髂动脉分叉上方可见梭形动脉瘤，最宽处约5.8cm，瘤壁可见弧形钙化。瘤腔内可见偏心性附壁血栓，最厚处约1.2cm。双侧髂总动脉未见明显异常。',
    impression: '1. 腹主动脉瘤（梭形）\\n2. 附壁血栓形成\\n3. 建议血管外科会诊',
    findingsList: ['腹主动脉梭形扩张最宽5.8cm', '瘤壁钙化', '偏心性附壁血栓1.2cm', '双髂动脉未见异常'],
    tags: ['腹主动脉瘤', '血管疾病', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'aorta', description: '主动脉CTA VR' },
      { thumbnail: 'aorta', description: '主动脉CTA MPR' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 50, type: 'aneurysm', label: '腹主动脉瘤', description: '梭形，5.8cm' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '腹主动脉瘤的典型表现，附壁血栓是常见并发症。', time: '2026-05-08 14:00', likes: 22, liked: true },
    ],
    likeCount: 35, viewCount: 880, createdAt: '2026-05-08', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC032', patientName: '胡敏', age: 52, gender: '女', examType: 'MR', examName: '心脏MR平扫+增强',
    bodyPart: '心脏', disease: '心肌梗死', diagnosis: '左心室前壁心肌梗死伴室壁瘤形成',
    findings: '心脏MR平扫+T1WI、T2WI及增强扫描：左心室前壁、室间隔前部心肌信号异常，T2WI呈高信号，增强扫描可见明显异常强化。局部心肌变薄向外膨凸，形成室壁瘤，范围约2.5×1.8cm。余左心室心肌未见明显异常。',
    impression: '1. 左心室前壁心肌梗死\\n2. 室壁瘤形成\\n3. 左心室余心肌未见异常',
    findingsList: ['左心室前壁心肌信号异常', 'T2WI高信号', '增强扫描异常强化', '室壁瘤2.5×1.8cm'],
    tags: ['心肌梗死', '室壁瘤', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'heart', description: '心脏MR T2WI' },
      { thumbnail: 'heart', description: '心脏MR增强' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'infarction', label: '心肌梗死伴室壁瘤', description: '前壁，室壁瘤形成' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '心肌梗死伴室壁瘤的MRI表现，心肌变薄和异常强化是诊断依据。', time: '2026-05-09 09:00', likes: 25, liked: false },
    ],
    likeCount: 40, viewCount: 1020, createdAt: '2026-05-09', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC033', patientName: '高建平', age: 56, gender: '男', examType: 'CT', examName: '肺动脉CTA',
    bodyPart: '心脏', disease: '肺动脉高压', diagnosis: '肺动脉高压',
    findings: '肺动脉CTA显示：主肺动脉干明显扩张，约4.5cm（正常<3cm）。左右肺动脉亦增宽。右心室壁增厚，约0.8cm。右心房增大。肺实质内未见明显血栓影。',
    impression: '1. 肺动脉高压\\n2. 主肺动脉干扩张（4.5cm）\\n3. 右心室壁增厚\\n4. 右心房增大',
    findingsList: ['主肺动脉干扩张4.5cm', '左右肺动脉增宽', '右心室壁增厚0.8cm', '右心房增大', '肺实质未见血栓'],
    tags: ['肺动脉高压', '心脏疾病', '典型征象'],
    images: [
      { thumbnail: 'pulmo', description: '肺动脉CTA' },
      { thumbnail: 'heart', description: '四腔心层面' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 35, type: 'pulmonary', label: '肺动脉高压', description: '主肺动脉干扩张4.5cm' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '肺动脉高压的CT表现，肺动脉扩张和右心改变是直接征象。', time: '2026-05-09 10:00', likes: 18, liked: true },
    ],
    likeCount: 26, viewCount: 650, createdAt: '2026-05-09', createdBy: '李明辉', status: '已审核', verified: true,
  },
  // ============================================================
  // 神经系统病例 (TC034-TC040)
  // ============================================================
  {
    id: 'TC034', patientName: '丁建华', age: 48, gender: '男', examType: 'CT', examName: '头颅CT平扫',
    bodyPart: '头颅', disease: '脑出血', diagnosis: '左侧基底节区脑出血',
    findings: '颅脑CT平扫显示：左侧基底节区可见团块状高密度影，大小约3.5×2.8cm，CT值约75Hu，边界清晰，周围可见轻度水肿带。脑室系统受压，中线结构右偏约3mm。',
    impression: '1. 左侧基底节区脑出血\\n2. 周围轻度水肿\\n3. 中线结构右偏约3mm',
    findingsList: ['左侧基底节区高密度影3.5×2.8cm', 'CT值约75Hu', '周围轻度水肿', '中线右偏3mm'],
    tags: ['脑出血', '急诊', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'brain', description: '颅脑CT平扫' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'hemorrhage', label: '基底节区出血', description: '3.5×2.8cm，高密度' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '典型高血压性脑出血表现，基底节区是最常见部位。', time: '2026-05-09 14:00', likes: 20, liked: true },
    ],
    likeCount: 35, viewCount: 980, createdAt: '2026-05-09', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC035', patientName: '陆秀英', age: 55, gender: '女', examType: 'MR', examName: '头颅MR平扫',
    bodyPart: '头颅', disease: '脑梗死', diagnosis: '右侧大脑中动脉供血区急性脑梗死',
    findings: '颅脑MR平扫+DWI显示：右侧大脑中动脉供血区可见片状异常信号，T1WI呈低信号，T2WI呈高信号，DWI呈明显高信号（提示细胞毒性水肿）。左侧供血区未见异常。脑室系统未见异常。',
    impression: '1. 右侧大脑中动脉供血区急性脑梗死\\n2. DWI高信号提示急性期\\n3. 建议神经内科治疗',
    findingsList: ['右侧MCA供血区片状异常', 'T1WI低信号', 'T2WI高信号', 'DWI明显高信号', '细胞毒性水肿'],
    tags: ['脑梗死', '急诊', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'brain', description: 'DWI' },
      { thumbnail: 'brain', description: 'T2WI' },
      { thumbnail: 'brain', description: 'ADC图' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 40, type: 'infarction', label: 'MCA供血区梗死', description: 'DWI高信号，急性期' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '急性脑梗死的DWI表现，高信号是早期诊断的金标准。', time: '2026-05-10 09:00', likes: 28, liked: false },
    ],
    likeCount: 45, viewCount: 1280, createdAt: '2026-05-10', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC036', patientName: '邓志明', age: 42, gender: '男', examType: 'MR', examName: '头颅MR平扫',
    bodyPart: '头颅', disease: '脑膜瘤', diagnosis: '左侧蝶骨嵴脑膜瘤',
    findings: '颅脑MR平扫+增强显示：左侧蝶骨嵴见约3.2×2.5cm类圆形肿块，边界清晰，T1WI呈等信号，T2WI呈等高信号，增强扫描明显均匀强化。邻近脑组织受压移位，可见脑膜尾征。',
    impression: '1. 左侧蝶骨嵴脑膜瘤\\n2. 脑膜尾征阳性\\n3. 建议神经外科手术治疗',
    findingsList: ['左侧蝶骨嵴3.2×2.5cm肿块', '边界清晰', 'T1WI等信号', 'T2WI等高信号', '均匀强化', '脑膜尾征'],
    tags: ['脑膜瘤', '脑肿瘤', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'brain', description: 'T1WI增强' },
      { thumbnail: 'brain', description: 'T2WI' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'mass', label: '蝶骨嵴脑膜瘤', description: '3.2×2.5cm，脑膜尾征' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '典型脑膜瘤表现，脑膜尾征是诊断关键。', time: '2026-05-10 10:00', likes: 22, liked: true },
    ],
    likeCount: 38, viewCount: 920, createdAt: '2026-05-10', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC037', patientName: '宋玉华', age: 35, gender: '女', examType: 'MR', examName: '头颅MR平扫',
    bodyPart: '头颅', disease: '垂体瘤', diagnosis: '垂体微腺瘤',
    findings: '颅脑MR平扫+动态增强显示：垂体右侧可见约0.8×0.6cm小结节，T1WI呈稍低信号，T2WI呈稍高信号，动态增强扫描呈延迟强化。垂体柄居中。蝶鞍形态正常。',
    impression: '1. 垂体微腺瘤（约0.8×0.6cm）\\n2. 建议内分泌科随诊',
    findingsList: ['垂体右侧0.8×0.6cm结节', 'T1WI稍低信号', 'T2WI稍高信号', '延迟强化', '垂体柄居中'],
    tags: ['垂体瘤', '微腺瘤', '典型征象'],
    images: [
      { thumbnail: 'brain', description: '垂体MR T1WI增强' },
      { thumbnail: 'brain', description: '垂体MR T2WI' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'adenoma', label: '垂体微腺瘤', description: '0.8×0.6cm' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '垂体微腺瘤的MRI表现，动态增强有助于发现小病灶。', time: '2026-05-10 14:00', likes: 16, liked: false },
    ],
    likeCount: 25, viewCount: 680, createdAt: '2026-05-10', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC038', patientName: '韩志刚', age: 60, gender: '男', examType: 'CT', examName: '头颅CT平扫',
    bodyPart: '头颅', disease: '蛛网膜下腔出血', diagnosis: '鞍上池动脉瘤破裂致蛛网膜下腔出血',
    findings: '颅脑CT平扫显示：脑池及脑沟内可见高密度影，以鞍上池、双侧侧裂池及大脑纵裂为著，CT值约65Hu。脑室系统未见明显扩大。中线结构居中。',
    impression: '1. 蛛网膜下腔出血\\n2. 以鞍上池及侧裂池为著\\n3. 疑似动脉瘤破裂，建议CTA检查',
    findingsList: ['脑池脑沟高密度影', '鞍上池、双侧侧裂池为著', 'CT值约65Hu', '脑室未见扩大', '中线居中'],
    tags: ['蛛网膜下腔出血', '急诊', '危急值', '典型征象'],
    images: [
      { thumbnail: 'brain', description: '颅脑CT平扫' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 40, type: 'hemorrhage', label: '蛛网膜下腔出血', description: '鞍上池及侧裂池为著' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '典型蛛网膜下腔出血CT表现，动脉瘤破裂是常见原因。', time: '2026-05-11 09:00', likes: 32, liked: true },
    ],
    likeCount: 48, viewCount: 1380, createdAt: '2026-05-11', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC039', patientName: '唐晓燕', age: 45, gender: '女', examType: 'MR', examName: '颈椎MR平扫',
    bodyPart: '脊柱', disease: '颈椎病', diagnosis: 'C4/5、C5/6椎间盘突出伴脊髓受压',
    findings: '颈椎MR平扫显示：C4/5椎间盘向后突出，约0.5cm，压迫硬膜囊及脊髓前缘。C5/6椎间盘亦向后突出，约0.6cm，脊髓受压变扁，信号未见明显异常。黄韧带未见增厚。椎管未见狭窄。',
    impression: '1. C4/5椎间盘突出\\n2. C5/6椎间盘突出伴脊髓受压\\n3. 建议骨科会诊',
    findingsList: ['C4/5椎间盘向后突出0.5cm', 'C5/6椎间盘向后突出0.6cm', '脊髓受压变扁', '黄韧带未见增厚'],
    tags: ['颈椎病', '椎间盘突出', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'spine', description: '颈椎MR T2WI矢状位' },
      { thumbnail: 'spine', description: '颈椎MR T2WI横断位' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'herniation', label: 'C5/6椎间盘突出', description: '0.6cm，脊髓受压' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '脊髓型颈椎病的MR表现，脊髓受压是手术指征。', time: '2026-05-11 10:00', likes: 20, liked: false },
    ],
    likeCount: 30, viewCount: 850, createdAt: '2026-05-11', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC040', patientName: '姚秀兰', age: 68, gender: '女', examType: 'CT', examName: '头颅CT平扫',
    bodyPart: '头颅', disease: '脑萎缩', diagnosis: '老年性脑萎缩',
    findings: '颅脑CT平扫显示：脑组织体积弥漫性缩小，脑沟增宽加深，以额叶及颞叶为著。脑室系统扩大，以侧脑室前角为著。中线结构居中。脑白质密度未见明显异常。',
    impression: '1. 老年性脑萎缩\\n2. 脑室系统扩大\\n3. 脑白质密度未见异常',
    findingsList: ['脑组织体积缩小', '脑沟增宽加深', '额颞叶为著', '侧脑室前角扩大', '白质密度正常'],
    tags: ['脑萎缩', '老年性疾病', '典型征象'],
    images: [
      { thumbnail: 'brain', description: '颅脑CT平扫' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 40, type: 'atrophy', label: '脑萎缩', description: '额颞叶为著' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '老年性脑萎缩的CT表现，需与病理性脑萎缩鉴别。', time: '2026-05-11 14:00', likes: 12, liked: true },
    ],
    likeCount: 18, viewCount: 480, createdAt: '2026-05-11', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  // ============================================================
  // 骨骼系统病例 (TC041-TC046)
  // ============================================================
  {
    id: 'TC041', patientName: '方建国', age: 52, gender: '男', examType: 'DR', examName: '右手X线平片',
    bodyPart: '骨骼', disease: '骨折', diagnosis: '右手第二掌骨骨折',
    findings: '右手X线平片显示：右手第二掌骨可见横行骨折线，骨皮质中断，断端轻度移位，约2mm。周围软组织肿胀。余掌指骨未见明显异常。',
    impression: '1. 右手第二掌骨骨折\\n2. 断端轻度移位\\n3. 建议骨科处理',
    findingsList: ['第二掌骨横行骨折线', '骨皮质中断', '断端移位约2mm', '软组织肿胀'],
    tags: ['骨折', '外伤', '典型征象'],
    images: [
      { thumbnail: 'bone', description: '右手X线正位' },
      { thumbnail: 'bone', description: '右手X线斜位' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 50, type: 'fracture', label: '第二掌骨骨折', description: '横行，断端移位2mm' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '典型掌骨骨折X线表现，需注意功能位片评估。', time: '2026-05-12 09:00', likes: 8, liked: false },
    ],
    likeCount: 12, viewCount: 320, createdAt: '2026-05-12', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC042', patientName: '梁秀英', age: 58, gender: '女', examType: 'MR', examName: '左膝关节MR平扫',
    bodyPart: '骨骼', disease: '半月板损伤', diagnosis: '左膝内侧半月板撕裂',
    findings: '左膝关节MR平扫显示：内侧半月板后角可见线状高信号影，与半月板上下关节面相连，达关节面边缘，考虑撕裂。外侧半月板形态信号未见明显异常。前交叉韧带及后交叉韧带信号正常。内侧副韧带未见异常。',
    impression: '1. 左膝内侧半月板撕裂（后角）\\n2. 前交叉韧带未见异常\\n3. 建议关节镜检查',
    findingsList: ['内侧半月板后角线状高信号', '达关节面边缘', '外侧半月板正常', '前交叉韧带正常'],
    tags: ['半月板撕裂', '膝关节', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'joint', description: '膝关节MR PDWI矢状位' },
      { thumbnail: 'joint', description: '膝关节MR T2WI冠状位' },
    ],
    annotations: [
      { id: 'A1', x: 45, y: 55, type: 'meniscus', label: '内侧半月板撕裂', description: '后角，线状高信号' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '半月板撕裂的MRI诊断标准，高信号与关节面相连是关键。', time: '2026-05-12 10:00', likes: 18, liked: true },
    ],
    likeCount: 28, viewCount: 720, createdAt: '2026-05-12', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC043', patientName: '孟志刚', age: 65, gender: '男', examType: 'DR', examName: '胸椎X线平片',
    bodyPart: '骨骼', disease: '骨质疏松', diagnosis: '胸腰椎多发压缩性骨折',
    findings: '胸椎X线正侧位片显示：胸8、胸12椎体呈楔形改变，前缘高度减低，约减少1/3。骨皮质连续，骨小梁稀疏。腰椎生理曲度存在，腰1椎体上缘见唇样骨质增生。',
    impression: '1. 胸8、胸12椎体压缩性骨折\\n2. 骨质疏松\\n3. 腰1椎体唇样骨质增生',
    findingsList: ['胸8椎体楔形变', '胸12椎体楔形变', '前缘高度减少约1/3', '骨小梁稀疏', '腰1唇样增生'],
    tags: ['压缩性骨折', '骨质疏松', '典型征象'],
    images: [
      { thumbnail: 'spine', description: '胸椎X线侧位' },
      { thumbnail: 'spine', description: '胸椎X线正位' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'fracture', label: '胸12压缩骨折', description: '楔形变，前缘高度减少1/3' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '骨质疏松性压缩骨折的典型表现，楔形变是特征。', time: '2026-05-12 14:00', likes: 15, liked: false },
    ],
    likeCount: 22, viewCount: 580, createdAt: '2026-05-12', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC044', patientName: '秦秀芳', age: 48, gender: '女', examType: 'CT', examName: '骨盆CT平扫',
    bodyPart: '骨骼', disease: '骨关节炎', diagnosis: '双侧髋关节骨关节炎',
    findings: '骨盆CT平扫显示：双侧髋关节间隙狭窄，以左侧为著，关节面骨质硬化，边缘见唇样骨赘形成。右侧髋臼前缘亦见骨赘。股骨头形态正常，骨髓信号未见明显异常。',
    impression: '1. 双侧髋关节骨关节炎\\n2. 左侧为著\\n3. 建议保守治疗或关节置换',
    findingsList: ['双侧髋关节间隙狭窄', '关节面骨质硬化', '边缘唇样骨赘', '左侧为著'],
    tags: ['骨关节炎', '髋关节', '典型征象'],
    images: [
      { thumbnail: 'pelvis', description: '骨盆CT横断面' },
      { thumbnail: 'pelvis', description: '骨盆CT冠状面重建' },
    ],
    annotations: [
      { id: 'A1', x: 40, y: 50, type: 'arthritis', label: '左髋关节骨关节炎', description: '间隙狭窄，骨赘形成' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '髋关节骨关节炎的CT表现，关节间隙狭窄和骨赘是诊断依据。', time: '2026-05-13 09:00', likes: 14, liked: true },
    ],
    likeCount: 20, viewCount: 520, createdAt: '2026-05-13', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC045', patientName: '丁建国', age: 55, gender: '男', examType: 'CT', examName: '左肩关节CT平扫',
    bodyPart: '骨骼', disease: '肩周炎', diagnosis: '左侧肩袖损伤',
    findings: '左肩关节CT平扫+三维重建显示：肱骨头向上半脱位，肩峰下间隙变窄，约6mm（正常8-10mm）。肩锁关节可见骨赘形成。冈上肌腱可见钙化影。肱二头肌长头腱未见明显异常。',
    impression: '1. 左侧肩袖损伤\\n2. 肩峰下间隙狭窄\\n3. 肩锁关节骨赘\\n4. 建议MR进一步评估',
    findingsList: ['肱骨头上半脱位', '肩峰下间隙6mm', '肩锁关节骨赘', '冈上肌腱钙化'],
    tags: ['肩袖损伤', '肩周炎', '典型征象'],
    images: [
      { thumbnail: 'shoulder', description: '左肩关节CT' },
      { thumbnail: 'shoulder', description: '三维重建' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 40, type: 'rotator', label: '肩袖损伤', description: '肩峰下间隙狭窄' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '肩袖损伤的CT表现，MR是评估软组织的最佳方法。', time: '2026-05-13 10:00', likes: 16, liked: false },
    ],
    likeCount: 24, viewCount: 620, createdAt: '2026-05-13', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC046', patientName: '蒋秀英', age: 42, gender: '女', examType: 'MR', examName: '腰椎MR平扫',
    bodyPart: '骨骼', disease: '脊柱转移瘤', diagnosis: '腰1椎体转移瘤',
    findings: '腰椎MR平扫显示：腰1椎体内见约2.5×2.0cm异常信号，T1WI呈低信号，T2WI呈高信号，增强扫描明显不均匀强化。椎体后缘骨皮质破坏，椎管轻度狭窄。相邻椎间盘未见明显异常。',
    impression: '1. 腰1椎体转移瘤\\n2. 椎管轻度狭窄\\n3. 建议进一步查找原发灶',
    findingsList: ['腰1椎体2.5×2.0cm异常信号', 'T1WI低T2WI高信号', '明显不均匀强化', '椎体后缘骨皮质破坏'],
    tags: ['脊柱转移瘤', '骨肿瘤', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'spine', description: '腰椎MR T1WI增强' },
      { thumbnail: 'spine', description: '腰椎MR T2WI' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'metastasis', label: '腰1转移瘤', description: '2.5×2.0cm，明显强化' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '脊柱转移瘤的典型MR表现，需与结核鉴别。', time: '2026-05-13 14:00', likes: 22, liked: true },
    ],
    likeCount: 35, viewCount: 880, createdAt: '2026-05-13', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  // ============================================================
  // 泌尿生殖系统病例 (TC047-TC050)
  // ============================================================
  {
    id: 'TC047', patientName: '钱志明', age: 62, gender: '男', examType: 'CT', examName: '腹部CT平扫',
    bodyPart: '泌尿生殖', disease: '肾结石', diagnosis: '右肾鹿角形结石',
    findings: '上腹部CT平扫显示：右肾可见铸型高密度影，呈鹿角形分布，CT值约1200Hu，累及肾盂及多个肾盏。左肾未见明显异常。输尿管未见扩张。',
    impression: '1. 右肾鹿角形结石\\n2. 建议泌尿外科处理',
    findingsList: ['右肾鹿角形高密度影', 'CT值约1200Hu', '累及肾盂及肾盏', '输尿管未见扩张'],
    tags: ['肾结石', '鹿角形结石', '典型征象'],
    images: [
      { thumbnail: 'kidney', description: 'CT平扫' },
      { thumbnail: 'kidney', description: '三维重建' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'stone', label: '右肾鹿角形结石', description: 'CT值1200Hu' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '鹿角形结石是肾结石的特殊类型，通常需要手术处理。', time: '2026-05-14 09:00', likes: 12, liked: false },
    ],
    likeCount: 18, viewCount: 480, createdAt: '2026-05-14', createdBy: '刘芳', status: '已审核', verified: true,
  },
  {
    id: 'TC048', patientName: '孙玉兰', age: 48, gender: '女', examType: 'CT', examName: '腹部CT平扫+增强',
    bodyPart: '泌尿生殖', disease: '肾癌', diagnosis: '右肾透明细胞癌',
    findings: '上腹部CT增强扫描显示：右肾中部可见约4.2×3.5cm类圆形肿块，T1WI呈等低信号，增强扫描动脉期明显不均匀强化，实质期及延迟期快速廓清，呈现\"快进快出\"强化模式。肾静脉及下腔静脉未见癌栓。',
    impression: '1. 右肾透明细胞癌\\n2. 建议根治性肾切除术',
    findingsList: ['右肾中部4.2×3.5cm肿块', '"快进快出"强化模式', '动脉期明显强化', '肾静脉未见癌栓'],
    tags: ['肾癌', '透明细胞癌', '典型征象', '教学病例'],
    images: [
      { thumbnail: 'kidney', description: 'CT增强动脉期' },
      { thumbnail: 'kidney', description: 'CT增强静脉期' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'mass', label: '右肾癌', description: '4.2×3.5cm，"快进快出"' },
    ],
    discussions: [
      { id: 'D1', user: '李明辉', avatar: 'LMH', content: '肾透明细胞癌的典型强化模式，与血管瘤的"快进慢出"鉴别。', time: '2026-05-14 10:00', likes: 26, liked: true },
    ],
    likeCount: 38, viewCount: 920, createdAt: '2026-05-14', createdBy: '李明辉', status: '已审核', verified: true,
  },
  {
    id: 'TC049', patientName: '吴婷', age: 35, gender: '女', examType: 'MR', examName: '盆腔MR平扫',
    bodyPart: '泌尿生殖', disease: '子宫肌瘤', diagnosis: '多发性子宫肌瘤',
    findings: '盆腔MR平扫显示：子宫体积增大，宫底部可见约3.5×3.0cm类圆形肿块，T1WI呈等信号，T2WI呈低信号，增强扫描轻度强化。子宫前壁亦见约1.5×1.2cm小结节。子宫内膜未见明显异常。',
    impression: '1. 多发性子宫肌瘤\\n2. 宫底部及前壁\\n3. 建议妇科随诊',
    findingsList: ['子宫增大', '宫底部3.5×3.0cm肿块', 'T2WI低信号', '子宫前壁1.5×1.2cm结节', '轻度强化'],
    tags: ['子宫肌瘤', '妇科肿瘤', '典型征象'],
    images: [
      { thumbnail: 'pelvis', description: '盆腔MR T2WI' },
      { thumbnail: 'pelvis', description: '盆腔MR增强' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 45, type: 'mass', label: '子宫肌瘤', description: '宫底部，3.5×3.0cm' },
    ],
    discussions: [
      { id: 'D1', user: '王秀峰', avatar: 'WXF', content: '子宫肌瘤的典型MR表现，T2WI低信号是特征。', time: '2026-05-14 14:00', likes: 18, liked: false },
    ],
    likeCount: 28, viewCount: 680, createdAt: '2026-05-14', createdBy: '王秀峰', status: '已审核', verified: true,
  },
  {
    id: 'TC050', patientName: '郑志刚', age: 68, gender: '男', examType: 'CT', examName: '前列腺CT平扫',
    bodyPart: '泌尿生殖', disease: '前列腺增生', diagnosis: '前列腺增生',
    findings: '盆腔CT平扫显示：前列腺体积增大，约4.5×3.8×3.2cm，密度均匀，边界清晰，增生结节突向膀胱。精囊形态信号未见明显异常。膀胱壁未见明显增厚。',
    impression: '1. 前列腺增生\\n2. 增生结节突向膀胱\\n3. 建议泌尿外科随诊',
    findingsList: ['前列腺4.5×3.8×3.2cm', '密度均匀', '增生结节突向膀胱', '精囊未见异常'],
    tags: ['前列腺增生', '泌尿系统', '典型征象'],
    images: [
      { thumbnail: 'pelvis', description: '盆腔CT横断面' },
    ],
    annotations: [
      { id: 'A1', x: 50, y: 50, type: 'hyperplasia', label: '前列腺增生', description: '4.5×3.8×3.2cm' },
    ],
    discussions: [
      { id: 'D1', user: '刘芳', avatar: 'LF', content: '前列腺增生的CT表现，MRI对前列腺癌分期更准确。', time: '2026-05-15 09:00', likes: 14, liked: true },
    ],
    likeCount: 22, viewCount: 550, createdAt: '2026-05-15', createdBy: '刘芳', status: '已审核', verified: true,
  },
]

// ============================================================
// 辅助函数
// ============================================================
const getBodyPartColor = (bodyPart: string) => {
  const colors: Record<string, string> = {
    '头颅': '#3b82f6', '胸部': '#3b82f6', '腹部': '#22c55e',
    '脊柱': '#f59e0b', '心脏': '#ef4444', '盆腔': '#ec4899',
  }
  return colors[bodyPart] || '#64748b'
}

const getModalityColor = (modality: string) => {
  return MODALITY_COLORS[modality] || '#64748b'
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return date
}

const formatDateFull = (date: string) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

const getAnnotationColor = (type: string) => {
  const colors: Record<string, string> = {
    stenosis: COLORS.danger,
    mass: COLORS.warning,
    emboli: '#ff6b6b',
    edema: COLORS.purple,
    hematoma: COLORS.danger,
    herniation: COLORS.info,
    calc: COLORS.warning,
    cyst: COLORS.teal,
    inflammation: COLORS.warning,
    thrombus: COLORS.danger,
  }
  return colors[type] || COLORS.info
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { bg: string; color: string }> = {
    '已审核': { bg: COLORS.successBg, color: COLORS.success },
    '待审核': { bg: COLORS.warningBg, color: COLORS.warning },
    '编辑中': { bg: COLORS.infoBg, color: COLORS.info },
  }
  return configs[status] || { bg: COLORS.backgroundLight, color: COLORS.textMuted }
}

// ============================================================
// 子组件：标签胶囊
// ============================================================
interface TagBadgeProps { text: string; color: string; bg: string; size?: 'small' | 'default' }
const TagBadge: React.FC<TagBadgeProps> = ({ text, color, bg, size = 'default' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: size === 'small' ? '1px 6px' : '2px 10px',
    borderRadius: 12, fontSize: size === 'small' ? 10 : 11,
    fontWeight: 600, color, background: bg, gap: 4,
  }}>{text}</span>
)

// ============================================================
// 子组件：统计卡片
// ============================================================
interface StatCardProps { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</div>
    </div>
  </div>
)

// ============================================================
// 子组件：手风琴折叠面板
// ============================================================
interface AccordionProps { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; count?: number }
const Accordion: React.FC<AccordionProps> = ({ title, icon, children, defaultOpen = false, count }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', background: isOpen ? COLORS.infoBg : COLORS.white,
        cursor: 'pointer', transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: isOpen ? COLORS.info : COLORS.textMuted }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? COLORS.info : COLORS.text }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 10, background: isOpen ? COLORS.info : COLORS.textLight, color: COLORS.white }}>{count}</span>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} style={{ color: COLORS.textMuted }} /> : <ChevronDown size={16} style={{ color: COLORS.textMuted }} />}
      </div>
      {isOpen && (
        <div style={{ padding: 12, background: COLORS.white, borderTop: `1px solid ${COLORS.border}` }}>{children}</div>
      )}
    </div>
  )
}

// ============================================================
// 子组件：病例卡片
// ============================================================
interface CaseCardProps { caseData: TypicalCase; onView: (c: TypicalCase) => void; isAdmin?: boolean }
const CaseCard: React.FC<CaseCardProps> = ({ caseData, onView, isAdmin }) => {
  const { t } = useTranslation('v3report')
  const [isHovered, setIsHovered] = useState(false)
  const getModalityIcon = (modality: string) => <Scan size={14} style={{ color: MODALITY_COLORS[modality] || '#64748b' }} />

  return (
    <div onClick={() => onView(caseData)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16,
        cursor: 'pointer', transition: 'all 0.25s ease', transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
      }}>
      {/* 顶部标签 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: `${MODALITY_COLORS[caseData.examType] || '#64748b'}18`, color: MODALITY_COLORS[caseData.examType] || '#64748b' }}>
          {getModalityIcon(caseData.examType)} {caseData.examType}
        </span>
        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${getBodyPartColor(caseData.bodyPart)}18`, color: getBodyPartColor(caseData.bodyPart) }}>
          {caseData.bodyPart}
        </span>
        {caseData.teaching && <TagBadge text={t('teachingBadge')} color={COLORS.danger} bg={COLORS.dangerBg} size="small" />}
        {caseData.status === '待审核' && <TagBadge text={t('pendingBadge')} color={COLORS.warning} bg={COLORS.warningBg} size="small" />}
      </div>

      {/* 缩略图 */}
      <div style={{
        width: '100%', height: 100, background: `linear-gradient(135deg, ${COLORS.primaryLight}15, ${COLORS.primary}10)`,
        borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${COLORS.border}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <ImageIcon size={28} style={{ color: COLORS.textLight }} />
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t('caseCardImage')}</span>
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          {caseData.images.slice(0, 3).map((_, idx) => (
            <div key={idx} style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.primary, opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: COLORS.white }}>{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 患者信息 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>
          {caseData.patientName} · {caseData.gender} · {caseData.age}岁
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>{caseData.examName}</div>
      </div>

      {/* 诊断 */}
      <div style={{ padding: '8px 10px', background: COLORS.backgroundLight, borderRadius: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 2 }}>{t('caseCardDiagnosis')}</div>
        <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 500 }}>
          {caseData.diagnosis.length > 50 ? caseData.diagnosis.substring(0, 50) + '...' : caseData.diagnosis}
        </div>
      </div>

      {/* 标签 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {caseData.tags.slice(0, 3).map((tag, idx) => (
          <span key={idx} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: COLORS.background, color: COLORS.textMuted }}>{tag}</span>
        ))}
        {caseData.tags.length > 3 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: COLORS.background, color: COLORS.textMuted }}>+{caseData.tags.length - 3}</span>}
      </div>

      {/* 底部统计 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: COLORS.textMuted }}><Eye size={12} /> {caseData.viewCount}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: COLORS.textMuted }}><Heart size={12} /> {caseData.likeCount}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: COLORS.textMuted }}><MessageSquare size={12} /> {caseData.discussions.length}</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textLight }}>{caseData.createdAt}</div>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：病例详情抽屉
// ============================================================
interface CaseDetailDrawerProps { caseData: TypicalCase | null; visible: boolean; onClose: () => void; isAdmin?: boolean }
const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({ caseData, visible, onClose, isAdmin }) => {
  const { t } = useTranslation('v3report')
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'report' | 'discussion'>('info')
  const [likedDiscussions, setLikedDiscussions] = useState<Set<string>>(new Set())
  const [newComment, setNewComment] = useState('')
  const [isFavorited, setIsFavorited] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null)

  if (!visible || !caseData) return null

  const handleLikeDiscussion = (discId: string) => {
    setLikedDiscussions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(discId)) newSet.delete(discId)
      else newSet.add(discId)
      return newSet
    })
  }

  const tabStyle = (tab: string) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    borderBottom: activeTab === tab ? `2px solid ${COLORS.info}` : '2px solid transparent',
    color: activeTab === tab ? COLORS.info : COLORS.textMuted, transition: 'all 0.2s',
  })

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: '60vw', maxWidth: 900, height: '100vh', background: COLORS.white, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.white }}>{t('caseDetailTitle')}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('caseDetailId')}: {caseData.id} | {caseData.examType} {caseData.examName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setIsFavorited(!isFavorited)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: isFavorited ? COLORS.warning : 'rgba(255,255,255,0.2)', color: COLORS.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {isFavorited ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {isFavorited ? t('favored') : t('favorite')}
          </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `典型病例: ${c.patientName}`,
                        text: `查看典型病例: ${c.patientName} - ${c.diagnosis}`,
                        url: window.location.href
                      })
                    } else {
                      navigator.clipboard.writeText(window.location.href)
                      // 显示复制成功Toast
                      const toast = document.createElement('div');
                      toast.textContent = t('linkCopied');
                      toast.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:fadeIn 0.3s ease';
                      document.body.appendChild(toast);
                      setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => document.body.removeChild(toast), 300); }, 2000);
                    }
                  }}
                  style={{ ...styles.btn, ...styles.btnOutline }}>
                  <Share2 size={14} />
                </button>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.2)', color: COLORS.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.white }}>
        <div style={tabStyle('info')} onClick={() => setActiveTab('info')}>{t('tabBasicInfo')}</div>
        <div style={tabStyle('images')} onClick={() => setActiveTab('images')}>{t('tabImages')}</div>
        <div style={tabStyle('report')} onClick={() => setActiveTab('report')}>{t('tabReport')}</div>
        <div style={tabStyle('discussion')} onClick={() => setActiveTab('discussion')}>{t('tabDiscussion')} ({caseData.discussions.length})</div>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {activeTab === 'info' && (
          <div>
            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('sectionPatientInfo')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldName')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.patientName}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldGender')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.gender}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldAge')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.age}岁</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldExamType')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.examType}</div></div>
              </div>
            </div>

            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('sectionExamInfo')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldExamItem')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.examName}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldBodyPart')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.bodyPart}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldDisease')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.disease}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldCreateDate')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.createdAt}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldCreatedBy')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.createdBy}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldStatus')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.status}</div></div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('fieldTags')}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {caseData.tags.map((tag, idx) => (
                  <span key={idx} style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: COLORS.background, color: COLORS.text }}>
                    <Tag size={10} style={{ marginRight: 4 }} />{tag}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, background: COLORS.infoBg, borderRadius: 8, textAlign: 'center' }}>
                <Eye size={20} style={{ color: COLORS.info, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.info }}>{caseData.viewCount}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statViews')}</div>
              </div>
              <div style={{ padding: 12, background: COLORS.dangerBg, borderRadius: 8, textAlign: 'center' }}>
                <Heart size={20} style={{ color: COLORS.danger, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.danger }}>{caseData.likeCount}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statFavorites')}</div>
              </div>
              <div style={{ padding: 12, background: COLORS.warningBg, borderRadius: 8, textAlign: 'center' }}>
                <MessageSquare size={20} style={{ color: COLORS.warning, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.warning }}>{caseData.discussions.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statDiscussions')}</div>
              </div>
              <div style={{ padding: 12, background: COLORS.successBg, borderRadius: 8, textAlign: 'center' }}>
                <FileText size={20} style={{ color: COLORS.success, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.success }}>{caseData.images.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statImages')}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div>
            <div style={{ background: '#1a1a2e', borderRadius: 10, padding: 20, marginBottom: 16, minHeight: 400, position: 'relative' }}>
              <div style={{ width: '100%', height: 360, background: 'linear-gradient(135deg, #2d2d44, #1a1a2e)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {caseData.annotations.map((ann, idx) => (
                  <div key={ann.id} onClick={() => setSelectedAnnotation(selectedAnnotation === idx ? null : idx)} style={{
                    position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, width: 24, height: 24, borderRadius: '50%',
                    background: ann.type === 'stenosis' ? COLORS.danger : ann.type === 'mass' ? COLORS.warning : ann.type === 'emboli' ? '#ff6b6b' : COLORS.info,
                    border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: COLORS.white, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transform: 'translate(-50%, -50%)', zIndex: 10,
                  }}>
                    {idx + 1}
                  </div>
                ))}

                {selectedAnnotation !== null && caseData.annotations[selectedAnnotation] && (
                  <div style={{
                    position: 'absolute', left: `${caseData.annotations[selectedAnnotation].x}%`, top: `${caseData.annotations[selectedAnnotation].y - 8}%`,
                    transform: 'translateX(-50%)', background: COLORS.white, borderRadius: 8, padding: '8px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 20, minWidth: 160,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>{caseData.annotations[selectedAnnotation].label}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted }}>{caseData.annotations[selectedAnnotation].description}</div>
                  </div>
                )}

                <div style={{ fontSize: 48, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}><Monitor size={64} /></div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{t('imagePreviewArea')}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{caseData.images[0]?.description || t('imageDescription')}</div>

                <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
                  <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>W: 1500</span>
                  <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>L: -600</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {caseData.annotations.map((ann, idx) => (
                  <div key={ann.id} onClick={() => setSelectedAnnotation(idx)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer',
                  }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: ann.type === 'stenosis' ? COLORS.danger : ann.type === 'mass' ? COLORS.warning : ann.type === 'emboli' ? '#ff6b6b' : COLORS.info }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{idx + 1}. {ann.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('imageList', { count: caseData.images.length })}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {caseData.images.map((img, idx) => (
                  <div key={idx} style={{
                    background: COLORS.backgroundLight, borderRadius: 8, padding: 12, cursor: 'pointer',
                    border: `1px solid ${idx === 0 ? COLORS.info : COLORS.border}`, transition: 'all 0.2s',
                  }}>
                    <div style={{ width: '100%', height: 60, background: COLORS.primaryLight, borderRadius: 4, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.text, textAlign: 'center' }}>{img.description}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center' }}>Series {idx + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div>
            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} />{t('reportFindings')}
              </h4>
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.8 }}>{caseData.findings}</div>
            </div>

            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <List size={16} />{t('reportFindingsSummary')}
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {caseData.findingsList.map((finding, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: COLORS.text, marginBottom: 6, lineHeight: 1.6 }}>{finding}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: `${COLORS.info}10`, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.info}30` }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.info, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} />{t('reportImpression')}
              </h4>
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{caseData.impression}</div>
            </div>

            {caseData.annotations.length > 0 && (
              <div style={{ marginTop: 16, background: COLORS.warningBg, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.warning}30` }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={16} />{t('reportAnnotations')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {caseData.annotations.map((ann, idx) => (
                    <div key={ann.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: COLORS.white, borderRadius: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: COLORS.warning, color: COLORS.white, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{ann.label}</div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{ann.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'discussion' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {caseData.discussions.map((disc) => (
                <div key={disc.id} style={{ padding: 14, background: COLORS.backgroundLight, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: COLORS.primary, color: COLORS.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {disc.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{disc.user}</div>
                      <div style={{ fontSize: 12, color: COLORS.textMuted }}>{disc.time}</div>
                    </div>
                    <button onClick={() => handleLikeDiscussion(disc.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, border: 'none',
                      background: likedDiscussions.has(disc.id) ? COLORS.dangerBg : 'transparent',
                      color: likedDiscussions.has(disc.id) ? COLORS.danger : COLORS.textMuted, cursor: 'pointer', fontSize: 12,
                    }}>
                      <ThumbsUp size={12} />{disc.likes + (likedDiscussions.has(disc.id) ? 1 : 0)}
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6, paddingLeft: 46 }}>{disc.content}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 14, background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>{t('discussionAdd')}</div>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t('discussionPlaceholder')}
                style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setNewComment('')} disabled={!newComment.trim()} style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none', background: newComment.trim() ? COLORS.info : COLORS.textLight,
                  color: COLORS.white, fontSize: 12, fontWeight: 600, cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                }}>
                  {t('discussionPost')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 子组件：新增病例表单
// ============================================================
interface AddCaseFormProps { visible: boolean; onClose: () => void; onSubmit: (data: Partial<TypicalCase>) => void }
const AddCaseForm: React.FC<AddCaseFormProps> = ({ visible, onClose, onSubmit }) => {
  const { t } = useTranslation('v3report')
  const [formData, setFormData] = useState({
    patientName: '', age: '', gender: '男', examType: 'CT', examName: '',
    bodyPart: '头颅', disease: '', diagnosis: '', findings: '', impression: '', tags: '', teaching: false,
  })

  const handleSubmit = () => {
    onSubmit({
      ...formData, age: parseInt(formData.age) || 0,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    onClose()
  }

  if (!visible) return null

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, outline: 'none' }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ width: '90%', maxWidth: 700, maxHeight: '90vh', background: COLORS.white, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.white }}>{t('addCaseFormTitle')}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.2)', color: COLORS.white, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>{t('formPatientName')}</label><input type="text" value={formData.patientName} onChange={(e) => setFormData({ ...formData, patientName: e.target.value })} style={inputStyle} placeholder={t('placeholderPatientName')} /></div>
            <div><label style={labelStyle}>{t('formAge')}</label><input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} style={inputStyle} placeholder={t('placeholderAge')} /></div>
            <div><label style={labelStyle}>{t('formGender')}</label><select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} style={inputStyle}><option value="男">{t('male')}</option><option value="女">{t('female')}</option></select></div>
            <div><label style={labelStyle}>{t('formExamType')}</label><select value={formData.examType} onChange={(e) => setFormData({ ...formData, examType: e.target.value })} style={inputStyle}><option value="CT">CT</option><option value="MR">MR</option><option value="DR">DR</option><option value="DSA">DSA</option></select></div>
            <div><label style={labelStyle}>{t('formExamName')}</label><input type="text" value={formData.examName} onChange={(e) => setFormData({ ...formData, examName: e.target.value })} style={inputStyle} placeholder={t('placeholderExamName')} /></div>
            <div><label style={labelStyle}>{t('formBodyPart')}</label><select value={formData.bodyPart} onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })} style={inputStyle}><option value="头颅">头颅</option><option value="胸部">胸部</option><option value="腹部">腹部</option><option value="脊柱">脊柱</option><option value="心脏">心脏</option><option value="盆腔">盆腔</option></select></div>
            <div><label style={labelStyle}>{t('formDisease')}</label><input type="text" value={formData.disease} onChange={(e) => setFormData({ ...formData, disease: e.target.value })} style={inputStyle} placeholder={t('placeholderDisease')} /></div>
            <div><label style={labelStyle}>{t('formTags')}</label><input type="text" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} style={inputStyle} placeholder={t('placeholderTags')} /></div>
          </div>
          <div style={{ marginTop: 16 }}><label style={labelStyle}>{t('formDiagnosis')}</label><textarea value={formData.diagnosis} onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} placeholder={t('placeholderDiagnosis')} /></div>
          <div style={{ marginTop: 16 }}><label style={labelStyle}>{t('formFindings')}</label><textarea value={formData.findings} onChange={(e) => setFormData({ ...formData, findings: e.target.value })} style={{ ...inputStyle, minHeight: 100 }} placeholder={t('placeholderFindings')} /></div>
          <div style={{ marginTop: 16 }}><label style={labelStyle}>{t('formImpression')}</label><textarea value={formData.impression} onChange={(e) => setFormData({ ...formData, impression: e.target.value })} style={{ ...inputStyle, minHeight: 80 }} placeholder={t('placeholderImpression')} /></div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="teaching" checked={formData.teaching} onChange={(e) => setFormData({ ...formData, teaching: e.target.checked })} style={{ width: 16, height: 16 }} />
            <label htmlFor="teaching" style={{ ...labelStyle, marginBottom: 0 }}>{t('formTeaching')}</label>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('formCancel')}</button>
          <button onClick={handleSubmit} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: COLORS.info, color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('formSave')}</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 主组件：典型病例库页面
// ============================================================
export default function TypicalCasesPage() {
  const { t } = useTranslation('v3report')
  const [cases, setCases] = useState<TypicalCase[]>(mockTypicalCases)
  const [selectedCase, setSelectedCase] = useState<TypicalCase | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [addFormVisible, setAddFormVisible] = useState(false)
  const [isAdmin, setIsAdmin] = useState(true)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState<string[]>([])
  const [bodyPartFilter, setBodyPartFilter] = useState<string[]>([])
  const [diseaseFilter, setDiseaseFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [teachingOnly, setTeachingOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'latest' | 'hottest' | 'mostLiked'>('latest')
  const [showFilters, setShowFilters] = useState(true)

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    cases.forEach(c => c.tags.forEach(t => tags.add(t)))
    return Array.from(tags)
  }, [cases])

  const allDiseases = useMemo(() => {
    const diseases = new Set<string>()
    cases.forEach(c => diseases.add(c.disease))
    return Array.from(diseases)
  }, [cases])

  const filteredCases = useMemo(() => {
    let result = [...cases]
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      result = result.filter(c => c.patientName.toLowerCase().includes(kw) || c.disease.toLowerCase().includes(kw) || c.diagnosis.toLowerCase().includes(kw) || c.examName.toLowerCase().includes(kw) || c.tags.some(t => t.toLowerCase().includes(kw)))
    }
    if (examTypeFilter.length > 0) result = result.filter(c => examTypeFilter.includes(c.examType))
    if (bodyPartFilter.length > 0) result = result.filter(c => bodyPartFilter.includes(c.bodyPart))
    if (diseaseFilter.length > 0) result = result.filter(c => diseaseFilter.includes(c.disease))
    if (tagFilter.length > 0) result = result.filter(c => c.tags.some(t => tagFilter.includes(t)))
    if (teachingOnly) result = result.filter(c => c.teaching)
    switch (sortBy) {
      case 'hottest': result.sort((a, b) => b.viewCount - a.viewCount); break
      case 'mostLiked': result.sort((a, b) => b.likeCount - a.likeCount); break
      default: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return result
  }, [cases, searchKeyword, examTypeFilter, bodyPartFilter, diseaseFilter, tagFilter, teachingOnly, sortBy])

  const stats = useMemo(() => ({
    total: cases.length, teaching: cases.filter(c => c.teaching).length,
    pending: cases.filter(c => c.status === '待审核').length,
    views: cases.reduce((sum, c) => sum + c.viewCount, 0),
    likes: cases.reduce((sum, c) => sum + c.likeCount, 0),
  }), [cases])

  const handleViewDetail = useCallback((c: TypicalCase) => { setSelectedCase(c); setDetailVisible(true) }, [])
  const handleAddCase = useCallback((data: Partial<TypicalCase>) => {
    const newCase: TypicalCase = {
      id: `TC${String(cases.length + 1).padStart(3, '0')}`, patientName: data.patientName || '', age: data.age || 0,
      gender: data.gender || '男', examType: data.examType || 'CT', examName: data.examName || '',
      bodyPart: data.bodyPart || '头颅', disease: data.disease || '', diagnosis: data.diagnosis || '',
      findings: data.findings || '', impression: data.impression || '',
      findingsList: data.findings?.split('\n').filter(Boolean) || [], tags: data.tags || [],
      teaching: data.teaching || false, images: [{ thumbnail: 'default', description: t('defaultImage') }],
      annotations: [], discussions: [], likeCount: 0, viewCount: 0,
      createdAt: new Date().toISOString().split('T')[0], createdBy: '当前用户',
      status: '编辑中', verified: false,
    }
    setCases(prev => [newCase, ...prev])
  }, [cases.length])

  const toggleArrayFilter = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (arr.includes(val)) setArr(arr.filter(v => v !== val))
    else setArr([...arr, val])
  }

  const clearFilters = () => {
    setSearchKeyword(''); setExamTypeFilter([]); setBodyPartFilter([]); setDiseaseFilter([]); setTagFilter([]); setTeachingOnly(false)
  }

  const hasActiveFilters = searchKeyword || examTypeFilter.length > 0 || bodyPartFilter.length > 0 || diseaseFilter.length > 0 || tagFilter.length > 0 || teachingOnly

  return (
    <div style={{ minHeight: '100vh', background: COLORS.background }}>
      {/* 顶部统计 */}
      <div style={{ background: COLORS.primary, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.white }}>{t('typicalCasesTitle')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('hospitalSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {isAdmin && (
            <button onClick={() => setAddFormVisible(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: COLORS.info, color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} />{t('addCase')}
            </button>
          )}
          <button
            onClick={async (evt) => {
              const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
              const originalText = btn.innerHTML;
              btn.innerHTML = t('importing');
              btn.disabled = true;
              await new Promise(r => setTimeout(r, 1500));
              const cases = JSON.parse(localStorage.getItem('g005_typical_cases') || '[]');
              cases.push({ id: `TC${Date.now()}`, importTime: new Date().toISOString() });
              localStorage.setItem('g005_typical_cases', JSON.stringify(cases));
              btn.innerHTML = t('importSuccess');
              setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
            }}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={16} />{t('batchImport')}
          </button>
          <button
            onClick={() => {
              // Export typical cases to CSV
              const csvContent = [
                [t('csvHeaderName'), t('csvHeaderAge'), t('csvHeaderGender'), t('csvHeaderDiagnosis'), t('csvHeaderExamType'), t('csvHeaderTypicalFeatures')].join(','),
                ...filteredCases.map(c => [
                  c.patientName, c.age, c.gender, c.diagnosis, c.examType, c.typicalFeatures
                ].join(','))
              ].join('\n')
              const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `typical_cases_${new Date().toISOString().slice(0,10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} />{t('exportCases')}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: '16px 24px', background: COLORS.white, borderBottom: `1px solid ${COLORS.border}` }}>
        <StatCard icon={<BookOpen size={20} />} label={t('statTotalCases')} value={stats.total} color={COLORS.primary} bg={COLORS.infoBg} />
        <StatCard icon={<Award size={20} />} label={t('statTeachingCases')} value={stats.teaching} color={COLORS.danger} bg={COLORS.dangerBg} />
        <StatCard icon={<Clock size={20} />} label={t('statPendingReview')} value={stats.pending} color={COLORS.warning} bg={COLORS.warningBg} />
        <StatCard icon={<Eye size={20} />} label={t('statTotalViews')} value={stats.views.toLocaleString()} color={COLORS.info} bg={COLORS.infoBg} />
        <StatCard icon={<Heart size={20} />} label={t('statTotalFavorites')} value={stats.likes.toLocaleString()} color={COLORS.danger} bg={COLORS.dangerBg} />
      </div>

      {/* 主内容区域 */}
      <div style={{ display: 'flex', padding: '16px 24px', gap: 16 }}>
        {/* 左侧筛选栏 */}
        {showFilters && (
          <div style={{ width: 280, flexShrink: 0, background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, height: 'calc(100vh - 220px)', overflow: 'auto' }}>
            {/* 搜索 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', background: COLORS.backgroundLight }}>
                <Search size={16} style={{ color: COLORS.textMuted }} />
                <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder={t('searchCases')}
                  style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent' }} />
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={clearFilters} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <FilterX size={14} />{t('clearFilters')}
                </button>
              </div>
            )}

            {/* 检查类型 */}
            <Accordion title={t('examType')} icon={<Scan size={14} />} count={examTypeFilter.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['CT', 'MR', 'DR', 'DSA'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" checked={examTypeFilter.includes(type)} onChange={() => toggleArrayFilter(examTypeFilter, setExamTypeFilter, type)} style={{ width: 16, height: 16 }} />
                    <span style={{ width: 24, height: 16, borderRadius: 4, background: `${MODALITY_COLORS[type]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Scan size={14} style={{ color: MODALITY_COLORS[type] }} />
                    </span>
                    <span style={{ fontSize: 13, color: COLORS.text }}>{type}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted, background: COLORS.background, padding: '1px 6px', borderRadius: 8 }}>
                      {cases.filter(c => c.examType === type).length}
                    </span>
                  </label>
                ))}
              </div>
            </Accordion>

            {/* 检查部位 */}
            <Accordion title={t('bodyPart')} icon={<Stethoscope size={14} />} count={bodyPartFilter.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['头颅', '胸部', '腹部', '脊柱', '心脏', '盆腔'].map(part => {
                  const count = cases.filter(c => c.bodyPart === part).length
                  if (count === 0) return null
                  return (
                    <button key={part} onClick={() => toggleArrayFilter(bodyPartFilter, setBodyPartFilter, part)} style={{
                      padding: '4px 10px', borderRadius: 6, border: `1px solid ${bodyPartFilter.includes(part) ? getBodyPartColor(part) : COLORS.border}`,
                      background: bodyPartFilter.includes(part) ? `${getBodyPartColor(part)}15` : COLORS.white,
                      color: bodyPartFilter.includes(part) ? getBodyPartColor(part) : COLORS.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {part} ({count})
                    </button>
                  )
                })}
              </div>
            </Accordion>

            {/* 疾病类型 */}
            <Accordion title={t('diseaseType')} icon={<Activity size={14} />} count={diseaseFilter.length} defaultOpen={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allDiseases.map(disease => {
                  const count = cases.filter(c => c.disease === disease).length
                  return (
                    <label key={disease} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
                      <input type="checkbox" checked={diseaseFilter.includes(disease)} onChange={() => toggleArrayFilter(diseaseFilter, setDiseaseFilter, disease)} style={{ width: 14, height: 14 }} />
                      <span style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{disease}</span>
                      <span style={{ fontSize: 12, color: COLORS.textMuted }}>{count}</span>
                    </label>
                  )
                })}
              </div>
            </Accordion>

            {/* 标签筛选 */}
            <Accordion title={t('tags')} icon={<Tag size={14} />} count={tagFilter.length} defaultOpen={false}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allTags.map(tag => (
                  <button key={tag} onClick={() => toggleArrayFilter(tagFilter, setTagFilter, tag)} style={{
                    padding: '2px 8px', borderRadius: 10, border: `1px solid ${tagFilter.includes(tag) ? COLORS.info : COLORS.border}`,
                    background: tagFilter.includes(tag) ? COLORS.infoBg : COLORS.white,
                    color: tagFilter.includes(tag) ? COLORS.info : COLORS.textMuted, fontSize: 12, cursor: 'pointer',
                  }}>
                    {tag}
                  </button>
                ))}
              </div>
            </Accordion>

            {/* 教学病例 */}
            <div style={{ padding: '10px 12px', borderRadius: 8, background: COLORS.backgroundLight, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={teachingOnly} onChange={() => setTeachingOnly(!teachingOnly)} style={{ width: 16, height: 16 }} />
                <Award size={14} style={{ color: COLORS.danger }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{t('teachingOnly')}</span>
              </label>
            </div>
          </div>
        )}

        {/* 右侧病例列表 */}
        <div style={{ flex: 1 }}>
          {/* 工具栏 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setShowFilters(!showFilters)} style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`,
                background: showFilters ? COLORS.infoBg : COLORS.white,
                color: showFilters ? COLORS.info : COLORS.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Filter size={14} />{showFilters ? t('hideFilters') : t('showFilters')}
              </button>
              <span style={{ fontSize: 13, color: COLORS.textMuted }}>{t('foundCases', { count: filteredCases.length }) }</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t('sortBy')}</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <option value="latest">{t('latest')}</option>
                <option value="hottest">{t('hottest')}</option>
                <option value="mostLiked">{t('mostLiked')}</option>
              </select>
            </div>
          </div>

          {/* 病例卡片网格 */}
          {filteredCases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <FileText size={48} style={{ color: COLORS.textLight, marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: COLORS.text }}>{t('noCasesFound')}</h3>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.textMuted }}>{t('adjustFiltersHint')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filteredCases.map(caseItem => (
                <CaseCard key={caseItem.id} caseData={caseItem} onView={handleViewDetail} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CaseDetailDrawer caseData={selectedCase} visible={detailVisible} onClose={() => setDetailVisible(false)} isAdmin={isAdmin} />
      <AddCaseForm visible={addFormVisible} onClose={() => setAddFormVisible(false)} onSubmit={handleAddCase} />
    </div>
  )
}

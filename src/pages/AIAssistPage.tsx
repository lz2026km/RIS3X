// ============================================================
// G005 放射科RIS系统 - AI辅助诊断页面 v1.1.0
// 汉东省人民医院放射科
// ============================================================
import { useState, useMemo } from 'react'
import {
  // AI推荐相关图标
  Brain, Sparkles, CheckCircle2, AlertTriangle, // 异常检测相关图标
  Target, ShieldAlert,
  // 质控相关图标
  ClipboardCheck, FileCheck, Timer, Zap,
  // 学习辅助相关图标
  BookOpen, FileText, Search, Star, // 骨龄检测相关图标
  User, Calendar, Ruler, Scale, Baby, TrendingUp, Activity,
  // 通用图标
  ChevronDown, ChevronUp, RefreshCw, Eye, Info, Check, ThumbsUp, Upload, Image as ImageIcon, FileDown, Database
} from 'lucide-react'

// ============================================================
// 样式常量 - WIN10风格蓝色主题
// ============================================================
const COLORS = {
  primary: '#1e40af',        // 主色：深蓝
  primaryLight: '#3b82f6',   // 浅蓝
  primaryDark: '#1e3a8a',    // 深蓝
  secondary: '#0891b2',      // 辅色：青色
  white: '#ffffff',          // 白色卡片
  background: '#e8e8e8',      // 浅灰背景
  backgroundLight: '#f5f5f5', // 更浅灰
  text: '#1e293b',           // 主文字
  textMuted: '#64748b',      // 次要文字
  textLight: '#94a3b8',      // 浅色文字
  border: '#d1d5db',         // 边框
  success: '#059669',        // 成功
  successBg: '#ecfdf5',      // 成功背景
  warning: '#d97706',        // 警告
  warningBg: '#fffbeb',      // 警告背景
  danger: '#dc2626',         // 危险
  dangerBg: '#fef2f2',       // 危险背景
  info: '#2563eb',           // 信息蓝
  infoBg: '#eff6ff',         // 信息背景
  purple: '#7c3aed',         // 紫色
  purpleBg: '#f5f3ff',       // 紫色背景
}

// ==================== Toast通知Hook ====================
function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const ToastContainer = () => (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            padding: '12px 20px',
            borderRadius: 8,
            background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#2563eb',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 240,
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )

  return { showToast, ToastContainer }
}

// ==================== 进度Modal组件 ====================
interface ProgressModalProps {
  open: boolean
  title: string
  message: string
  progress?: number
  onClose?: () => void
}

function ProgressModal({ open, title, message, progress, onClose }: ProgressModalProps) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: 12, padding: 32,
          width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
          {message}
        </div>
        {progress !== undefined && (
          <div style={{ background: '#e8e8e8', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{ background: '#3b82f6', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          {progress !== undefined ? `${progress}%` : '请稍候...'}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 类型定义
// ============================================================

/** AI推荐诊断项 */
interface AIRecommendation {
  id: string
  examType: string          // 检查类型
  diagnosis: string         // 诊断建议
  confidence: number        // 置信度 0-100
  basis: string            // 推荐依据
  reasoning: string         // AI推理说明
  isAccepted: boolean       // 是否已采纳
}

/** 异常提示项 */
interface AbnormalityItem {
  id: string
  region: string           // 异常区域
  type: string             // 异常类型
  severity: 'high' | 'medium' | 'low'  // 可疑程度
  location: { x: number; y: number; description: string }  // 位置坐标
  description: string      // 描述
  suggestion: string       // 建议
}

/** 质控问题项 */
interface QCIssue {
  id: string
  category: 'completeness' | 'standard' | 'timeliness' | 'critical'  // 质控类别
  level: 'critical' | 'warning' | 'info'    // 问题级别
  title: string           // 问题标题
  description: string     // 问题描述
  suggestion: string       // 整改建议
  isResolved: boolean      // 是否已解决
}

/** 典型病例 */
interface TypicalCase {
  id: string
  title: string
  disease: string
  examType: string
  keyFindings: string[]
  tags: string[]
  viewCount: number
  usefulCount: number
}

/** 相关文献 */
interface ReferenceArticle {
  id: string
  title: string
  journal: string
  authors: string
  year: number
  abstract: string
  keywords: string[]
  url?: string
}

/** 骨骺评级项 */
interface BoneRatingItem {
  name: string
  rating: string
  score: number
}

/** 骨龄评估记录 */
interface BoneAgeRecord {
  id: string
  patientName: string
  gender: '男' | '女'
  birthDate: string
  examDate: string
  boneAge: number
  chronologicalAge: number
  deviation: number
  developmentStatus: '正常' | '提前' | '落后'
  predictedHeight: number
  russianRating: BoneRatingItem[]
  carpalRating: BoneRatingItem[]
}

// ============================================================
// 演示数据
// ============================================================

/** AI诊断推荐数据 */
const mockRecommendations: AIRecommendation[] = [
  {
    id: 'REC001',
    examType: 'CT胸部平扫',
    diagnosis: '右肺上叶周围型肺癌',
    confidence: 92,
    basis: '基于200万例肺癌影像数据训练',
    reasoning: 'CT显示右肺上叶见约2.8cm结节，边缘呈分叶状，可见毛刺征，增强扫描明显不均匀强化，考虑恶性可能性大',
    isAccepted: false
  },
  {
    id: 'REC002',
    examType: 'CT腹部平扫',
    diagnosis: '肝血管瘤',
    confidence: 87,
    basis: '基于50万例肝脏影像数据训练',
    reasoning: '肝右叶见约1.5cm低密度影，边界清晰，增强扫描边缘明显结节样强化，符合血管瘤特征',
    isAccepted: true
  }
]

/** 异常区域数据 */
const mockAbnormalities: AbnormalityItem[] = [
  {
    id: 'ABN001',
    region: '右肺上叶',
    type: '肺结节',
    severity: 'high',
    location: { x: 125, y: 180, description: '右肺上叶前段' },
    description: '见一枚约2.8cm×2.5cm软组织密度结节，边缘呈分叶状，可见毛刺征',
    suggestion: '建议进一步增强扫描，必要时PET-CT检查'
  },
  {
    id: 'ABN002',
    region: '纵隔',
    type: '淋巴结肿大',
    severity: 'medium',
    location: { x: 200, y: 220, description: '4R区淋巴结' },
    description: '纵隔4R区见一枚约1.2cm淋巴结，边界清晰',
    suggestion: '建议短期随访复查'
  }
]

/** 质控问题数据 */
const mockQCIssues: QCIssue[] = [
  {
    id: 'QC001',
    category: 'completeness',
    level: 'warning',
    title: '报告描述不完整',
    description: '缺少病变与邻近结构关系的描述',
    suggestion: '请补充病变与胸膜、血管的关系描述',
    isResolved: false
  },
  {
    id: 'QC002',
    category: 'critical',
    level: 'critical',
    title: '发现危急值',
    description: '肺动脉栓塞待排除',
    suggestion: '请立即与临床医生沟通确认',
    isResolved: false
  },
  {
    id: 'QC003',
    category: 'timeliness',
    level: 'info',
    title: '报告超时提醒',
    description: '该报告已超时2小时未完成审核',
    suggestion: '请尽快完成报告审核',
    isResolved: false
  },
  {
    id: 'QC004',
    category: 'standard',
    level: 'warning',
    title: '术语不规范',
    description: '使用了非标准缩写"CA"',
    suggestion: '请使用标准医学术语"癌"或"恶性肿瘤"',
    isResolved: true
  }
]

/** 典型病例数据 */
const mockTypicalCases: TypicalCase[] = [
  {
    id: 'TC001',
    title: '右肺上叶周围型肺癌',
    disease: '肺腺癌',
    examType: 'CT胸部增强',
    keyFindings: ['分叶征', '毛刺征', '胸膜牵拉征', '血管集束征'],
    tags: ['肺癌', '典型征象', '教学病例'],
    viewCount: 1256,
    usefulCount: 89
  },
  {
    id: 'TC002',
    title: '肝血管瘤',
    disease: '肝血管瘤',
    examType: 'CT腹部增强',
    keyFindings: ['边缘明显强化', '充填式强化', '平扫低密度'],
    tags: ['血管瘤', '良性病变', '典型强化模式'],
    viewCount: 876,
    usefulCount: 56
  },
  {
    id: 'TC003',
    title: '脑梗死',
    disease: '急性脑梗死',
    examType: 'CT头颅平扫',
    keyFindings: ['大脑中动脉高密度征', '岛带征消失', '脑沟变浅'],
    tags: ['脑血管病', '危急值', '典型CT表现'],
    viewCount: 2341,
    usefulCount: 167
  }
]

/** 相关文献数据 */
const mockReferences: ReferenceArticle[] = [
  {
    id: 'REF001',
    title: '肺结节的CT诊断与人工智能辅助研究进展',
    journal: '中华放射学杂志',
    authors: '张明等',
    year: 2024,
    abstract: '本文综述了肺结节的CT影像学特征及AI辅助诊断系统的最新研究进展...',
    keywords: ['肺结节', '人工智能', 'CT诊断', '深度学习']
  },
  {
    id: 'REF002',
    title: '基于深度学习的肺癌早期筛查系统多中心验证',
    journal: 'Radiology',
    authors: 'Wang et al.',
    year: 2025,
    abstract: '本研究纳入全国12家中心数据，验证了基于深度学习的肺癌筛查系统的准确性...',
    keywords: ['肺癌筛查', '深度学习', '多中心验证', 'CAD']
  }
]

/** 骨龄检测记录数据 */
const mockBoneAgeRecords: BoneAgeRecord[] = [
  {
    id: 'BA001',
    patientName: '王小明',
    gender: '男',
    birthDate: '2018-03-15',
    examDate: '2024-09-20',
    boneAge: 7.2,
    chronologicalAge: 6.5,
    deviation: 0.7,
    developmentStatus: '正常',
    predictedHeight: 172,
    russianRating: [
      { name: '桡骨', rating: 'E', score: 4 },
      { name: '尺骨', rating: 'D', score: 3 },
      { name: '掌骨I', rating: 'D', score: 3 },
      { name: '掌骨III', rating: 'D', score: 3 },
      { name: '掌骨V', rating: 'C', score: 2 },
      { name: '指骨I', rating: 'D', score: 3 },
      { name: '指骨III', rating: 'D', score: 3 },
      { name: '指骨V', rating: 'C', score: 2 }
    ],
    carpalRating: [
      { name: '舟骨', rating: 'C', score: 2 },
      { name: '月骨', rating: 'C', score: 2 },
      { name: '三角骨', rating: 'C', score: 2 },
      { name: '豌豆骨', rating: 'B', score: 1 },
      { name: '大多角骨', rating: 'B', score: 1 },
      { name: '小多角骨', rating: 'B', score: 1 },
      { name: '头状骨', rating: 'C', score: 2 },
      { name: '钩骨', rating: 'C', score: 2 }
    ]
  },
  {
    id: 'BA002',
    patientName: '李婷婷',
    gender: '女',
    birthDate: '2016-07-22',
    examDate: '2024-09-18',
    boneAge: 9.8,
    chronologicalAge: 8.2,
    deviation: 1.6,
    developmentStatus: '提前',
    predictedHeight: 165,
    russianRating: [
      { name: '桡骨', rating: 'F', score: 5 },
      { name: '尺骨', rating: 'E', score: 4 },
      { name: '掌骨I', rating: 'E', score: 4 },
      { name: '掌骨III', rating: 'E', score: 4 },
      { name: '掌骨V', rating: 'D', score: 3 },
      { name: '指骨I', rating: 'E', score: 4 },
      { name: '指骨III', rating: 'E', score: 4 },
      { name: '指骨V', rating: 'D', score: 3 }
    ],
    carpalRating: [
      { name: '舟骨', rating: 'D', score: 3 },
      { name: '月骨', rating: 'D', score: 3 },
      { name: '三角骨', rating: 'D', score: 3 },
      { name: '豌豆骨', rating: 'C', score: 2 },
      { name: '大多角骨', rating: 'C', score: 2 },
      { name: '小多角骨', rating: 'C', score: 2 },
      { name: '头状骨', rating: 'D', score: 3 },
      { name: '钩骨', rating: 'D', score: 3 }
    ]
  },
  {
    id: 'BA003',
    patientName: '张伟',
    gender: '男',
    birthDate: '2012-11-05',
    examDate: '2024-09-15',
    boneAge: 11.0,
    chronologicalAge: 11.8,
    deviation: -0.8,
    developmentStatus: '落后',
    predictedHeight: 175,
    russianRating: [
      { name: '桡骨', rating: 'E', score: 4 },
      { name: '尺骨', rating: 'E', score: 4 },
      { name: '掌骨I', rating: 'E', score: 4 },
      { name: '掌骨III', rating: 'E', score: 4 },
      { name: '掌骨V', rating: 'D', score: 3 },
      { name: '指骨I', rating: 'E', score: 4 },
      { name: '指骨III', rating: 'E', score: 4 },
      { name: '指骨V', rating: 'D', score: 3 }
    ],
    carpalRating: [
      { name: '舟骨', rating: 'D', score: 3 },
      { name: '月骨', rating: 'D', score: 3 },
      { name: '三角骨', rating: 'D', score: 3 },
      { name: '豌豆骨', rating: 'D', score: 3 },
      { name: '大多角骨', rating: 'C', score: 2 },
      { name: '小多角骨', rating: 'C', score: 2 },
      { name: '头状骨', rating: 'D', score: 3 },
      { name: '钩骨', rating: 'D', score: 3 }
    ]
  },
  {
    id: 'BA004',
    patientName: '陈思思',
    gender: '女',
    birthDate: '2014-02-28',
    examDate: '2024-09-12',
    boneAge: 10.5,
    chronologicalAge: 10.5,
    deviation: 0,
    developmentStatus: '正常',
    predictedHeight: 163,
    russianRating: [
      { name: '桡骨', rating: 'F', score: 5 },
      { name: '尺骨', rating: 'E', score: 4 },
      { name: '掌骨I', rating: 'E', score: 4 },
      { name: '掌骨III', rating: 'E', score: 4 },
      { name: '掌骨V', rating: 'E', score: 4 },
      { name: '指骨I', rating: 'E', score: 4 },
      { name: '指骨III', rating: 'E', score: 4 },
      { name: '指骨V', rating: 'E', score: 4 }
    ],
    carpalRating: [
      { name: '舟骨', rating: 'D', score: 3 },
      { name: '月骨', rating: 'D', score: 3 },
      { name: '三角骨', rating: 'D', score: 3 },
      { name: '豌豆骨', rating: 'D', score: 3 },
      { name: '大多角骨', rating: 'D', score: 3 },
      { name: '小多角骨', rating: 'D', score: 3 },
      { name: '头状骨', rating: 'E', score: 4 },
      { name: '钩骨', rating: 'E', score: 4 }
    ]
  },
  {
    id: 'BA005',
    patientName: '刘子豪',
    gender: '男',
    birthDate: '2010-08-14',
    examDate: '2024-09-10',
    boneAge: 14.0,
    chronologicalAge: 14.1,
    deviation: -0.1,
    developmentStatus: '正常',
    predictedHeight: 180,
    russianRating: [
      { name: '桡骨', rating: 'G', score: 6 },
      { name: '尺骨', rating: 'G', score: 6 },
      { name: '掌骨I', rating: 'G', score: 6 },
      { name: '掌骨III', rating: 'G', score: 6 },
      { name: '掌骨V', rating: 'F', score: 5 },
      { name: '指骨I', rating: 'G', score: 6 },
      { name: '指骨III', rating: 'G', score: 6 },
      { name: '指骨V', rating: 'F', score: 5 }
    ],
    carpalRating: [
      { name: '舟骨', rating: 'E', score: 4 },
      { name: '月骨', rating: 'E', score: 4 },
      { name: '三角骨', rating: 'E', score: 4 },
      { name: '豌豆骨', rating: 'E', score: 4 },
      { name: '大多角骨', rating: 'E', score: 4 },
      { name: '小多角骨', rating: 'E', score: 4 },
      { name: '头状骨', rating: 'F', score: 5 },
      { name: '钩骨', rating: 'F', score: 5 }
    ]
  }
]

// ============================================================
// 辅助函数
// ============================================================

/** 获取置信度颜色 */
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return COLORS.success
  if (confidence >= 70) return COLORS.warning
  return COLORS.danger
}

/** 获取严重程度颜色 */
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'high': return COLORS.danger
    case 'medium': return COLORS.warning
    case 'low': return COLORS.info
    default: return COLORS.textMuted
  }
}

/** 获取质控级别颜色 */
const getQCLevelColor = (level: string): string => {
  switch (level) {
    case 'critical': return COLORS.danger
    case 'warning': return COLORS.warning
    case 'info': return COLORS.info
    default: return COLORS.textMuted
  }
}

/** 获取质控类别标签 */
const getQCCategoryLabel = (category: string): string => {
  switch (category) {
    case 'completeness': return '完整性'
    case 'standard': return '规范性'
    case 'timeliness': return '时效性'
    case 'critical': return '危急值'
    default: return category
  }
}

/** 计算年龄 */
const calculateAge = (birthDate: string, examDate: string): number => {
  const birth = new Date(birthDate)
  const exam = new Date(examDate)
  const years = exam.getFullYear() - birth.getFullYear()
  const months = exam.getMonth() - birth.getMonth()
  const days = exam.getDate() - birth.getDate()
  let age = years + months / 12 + days / 365
  return Math.round(age * 10) / 10
}

/** 获取发育状态颜色 */
const getDevStatusColor = (status: string): string => {
  switch (status) {
    case '正常': return COLORS.success
    case '提前': return COLORS.warning
    case '落后': return COLORS.info
    default: return COLORS.textMuted
  }
}

/** 获取TW3评级颜色 */
const getRatingColor = (rating: string): string => {
  const ratingNum = rating.charCodeAt(0) - 64 // A=1, B=2, etc.
  if (ratingNum >= 6) return COLORS.success
  if (ratingNum >= 4) return COLORS.warning
  if (ratingNum >= 2) return COLORS.info
  return COLORS.textMuted
}

// ============================================================
// 子组件：AI推荐诊断卡片
// ============================================================
interface RecommendationCardProps {
  recommendation: AIRecommendation
  onAccept: (id: string) => void
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation, onAccept }) => {
  const [expanded, setExpanded] = useState(false)
  const confidenceColor = getConfidenceColor(recommendation.confidence)

  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* 头部信息 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* AI图标 */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: `${COLORS.primary}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Brain size={20} color={COLORS.primary} />
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {recommendation.diagnosis}
            </span>
            {recommendation.isAccepted && (
              <span style={{
                fontSize: 12,
                padding: '2px 6px',
                borderRadius: 4,
                background: COLORS.successBg,
                color: COLORS.success
              }}>
                已采纳
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
            {recommendation.examType}
          </div>

          {/* 置信度条 */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>置信度</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: confidenceColor }}>
                {recommendation.confidence}%
              </span>
            </div>
            <div style={{
              height: 6,
              background: `${confidenceColor}20`,
              borderRadius: 3,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${recommendation.confidence}%`,
                height: '100%',
                background: confidenceColor,
                borderRadius: 3,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* 展开更多 */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12,
              color: COLORS.primary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? '收起详情' : '查看推荐依据'}
          </button>

          {/* 展开内容 */}
          {expanded && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: COLORS.background,
              borderRadius: 6,
              fontSize: 12
            }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: COLORS.textMuted }}>推荐依据：</span>
                <span style={{ color: COLORS.text }}>{recommendation.basis}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: COLORS.textMuted }}>AI推理：</span>
                <span style={{ color: COLORS.text }}>{recommendation.reasoning}</span>
              </div>
            </div>
          )}
        </div>

        {/* 采纳按钮 */}
        {!recommendation.isAccepted && (
          <button
            onClick={() => onAccept(recommendation.id)}
            style={{
              padding: '8px 16px',
              background: COLORS.primary,
              color: COLORS.white,
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0
            }}
          >
            <Check size={14} />
            采纳
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 子组件：异常区域卡片
// ============================================================
interface AbnormalityCardProps {
  abnormality: AbnormalityItem
}

const AbnormalityCard: React.FC<AbnormalityCardProps> = ({ abnormality }) => {
  const severityColor = getSeverityColor(abnormality.severity)
  const severityLabels = { high: '高', medium: '中', low: '低' }

  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
      border: `1px solid ${COLORS.border}`,
      borderLeft: `3px solid ${severityColor}`
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* 警示图标 */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: `${severityColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <AlertTriangle size={18} color={severityColor} />
        </div>

        {/* 内容 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {abnormality.type}
            </span>
            <span style={{
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 3,
              background: `${severityColor}20`,
              color: severityColor,
              fontWeight: 500
            }}>
              {severityLabels[abnormality.severity]}可疑
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
            位置：{abnormality.region}
          </div>
          <div style={{ fontSize: 12, color: COLORS.text, marginBottom: 6 }}>
            {abnormality.description}
          </div>
          <div style={{
            fontSize: 12,
            padding: '6px 10px',
            background: COLORS.infoBg,
            borderRadius: 4,
            color: COLORS.info,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Info size={12} />
            {abnormality.suggestion}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：质控问题卡片
// ============================================================
interface QCCardProps {
  issue: QCIssue
  onResolve: (id: string) => void
}

const QCCard: React.FC<QCCardProps> = ({ issue, onResolve }) => {
  const levelColor = getQCLevelColor(issue.level)
  const categoryIcon = {
    completeness: <FileCheck size={16} />,
    standard: <ClipboardCheck size={16} />,
    timeliness: <Timer size={16} />,
    critical: <Zap size={16} />
  }

  return (
    <div style={{
      background: issue.isResolved ? COLORS.backgroundLight : COLORS.white,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
      border: `1px solid ${issue.isResolved ? COLORS.border : levelColor}`,
      opacity: issue.isResolved ? 0.7 : 1
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* 类别图标 */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: `${levelColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {categoryIcon[issue.category]}
        </div>

        {/* 内容 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
              {issue.title}
            </span>
            <span style={{
              fontSize: 12,
              padding: '2px 5px',
              borderRadius: 3,
              background: `${levelColor}20`,
              color: levelColor,
              fontWeight: 500
            }}>
              {issue.level === 'critical' ? '危急' : issue.level === 'warning' ? '警告' : '提示'}
            </span>
            <span style={{
              fontSize: 12,
              padding: '2px 5px',
              borderRadius: 3,
              background: COLORS.background,
              color: COLORS.textMuted
            }}>
              {getQCCategoryLabel(issue.category)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
            {issue.description}
          </div>
          {!issue.isResolved && (
            <div style={{
              fontSize: 12,
              padding: '6px 10px',
              background: COLORS.warningBg,
              borderRadius: 4,
              color: COLORS.warning,
              marginBottom: 8
            }}>
              建议：{issue.suggestion}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {!issue.isResolved ? (
          <button
            onClick={() => onResolve(issue.id)}
            style={{
              padding: '6px 12px',
              background: COLORS.success,
              color: COLORS.white,
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            已整改
          </button>
        ) : (
          <span style={{
            fontSize: 12,
            color: COLORS.success,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <CheckCircle2 size={14} />
            已整改
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 子组件：典型病例卡片
// ============================================================
interface CaseCardProps {
  caseItem: TypicalCase
}

const CaseCard: React.FC<CaseCardProps> = ({ caseItem }) => {
  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
      border: `1px solid ${COLORS.border}`,
      cursor: 'pointer',
      transition: 'box-shadow 0.2s'
    }}
    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: `${COLORS.secondary}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <BookOpen size={18} color={COLORS.secondary} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>
            {caseItem.title}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>
            {caseItem.examType} · {caseItem.disease}
          </div>
        </div>
      </div>

      {/* 关键影像表现 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
          关键影像表现
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {caseItem.keyFindings.map((finding, idx) => (
            <span key={idx} style={{
              fontSize: 12,
              padding: '3px 8px',
              background: COLORS.infoBg,
              color: COLORS.info,
              borderRadius: 4
            }}>
              {finding}
            </span>
          ))}
        </div>
      </div>

      {/* 标签和统计 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {caseItem.tags.slice(0, 2).map((tag, idx) => (
            <span key={idx} style={{
              fontSize: 12,
              padding: '2px 6px',
              background: COLORS.purpleBg,
              color: COLORS.purple,
              borderRadius: 3
            }}>
              {tag}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: COLORS.textMuted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Eye size={12} />
            {caseItem.viewCount}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ThumbsUp size={12} />
            {caseItem.usefulCount}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：文献卡片
// ============================================================
interface ReferenceCardProps {
  article: ReferenceArticle
}

const ReferenceCard: React.FC<ReferenceCardProps> = ({ article }) => {
  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
      border: `1px solid ${COLORS.border}`
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: `${COLORS.purple}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <FileText size={18} color={COLORS.purple} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
            {article.title}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
            {article.journal} · {article.authors} · {article.year}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
            {article.abstract.slice(0, 80)}...
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {article.keywords.map((kw, idx) => (
              <span key={idx} style={{
                fontSize: 12,
                padding: '2px 6px',
                background: COLORS.background,
                color: COLORS.textMuted,
                borderRadius: 3
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：骨龄检测卡片
// ============================================================
interface BoneAgeCardProps {
  record: BoneAgeRecord
  onSelect: (record: BoneAgeRecord) => void
}

const BoneAgeCard: React.FC<BoneAgeCardProps> = ({ record, onSelect }) => {
  const devStatusColor = getDevStatusColor(record.developmentStatus)

  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
      border: `1px solid ${COLORS.border}`,
      cursor: 'pointer',
      transition: 'box-shadow 0.2s'
    }}
    onClick={() => onSelect(record)}
    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* 左侧图标 */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${COLORS.primary}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Baby size={22} color={COLORS.primary} />
        </div>

        {/* 内容 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {record.patientName}
            </span>
            <span style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 4,
              background: record.gender === '男' ? COLORS.infoBg : COLORS.purpleBg,
              color: record.gender === '男' ? COLORS.info : COLORS.purple
            }}>
              {record.gender}
            </span>
            <span style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 4,
              background: `${devStatusColor}15`,
              color: devStatusColor,
              fontWeight: 500
            }}>
              {record.developmentStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} />
              出生：{record.birthDate}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} />
              拍摄：{record.examDate}
            </span>
          </div>

          {/* 评估结果 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{
              padding: '6px 12px',
              background: COLORS.background,
              borderRadius: 6,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>骨龄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary }}>
                {record.boneAge}岁
              </div>
            </div>
            <div style={{
              padding: '6px 12px',
              background: COLORS.background,
              borderRadius: 6,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>实际年龄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                {record.chronologicalAge}岁
              </div>
            </div>
            <div style={{
              padding: '6px 12px',
              background: COLORS.background,
              borderRadius: 6,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>偏差</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: devStatusColor }}>
                {record.deviation > 0 ? '+' : ''}{record.deviation}岁
              </div>
            </div>
            <div style={{
              padding: '6px 12px',
              background: COLORS.background,
              borderRadius: 6,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>预测身高</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.secondary }}>
                {record.predictedHeight}cm
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：生长曲线图SVG
// ============================================================
interface GrowthCurveProps {
  currentHeight: number
  currentWeight: number
  age: number
  gender: '男' | '女'
  geneticHeight: number
}

const GrowthCurve: React.FC<GrowthCurveProps> = ({ currentHeight, currentWeight, age, gender, geneticHeight }) => {
  // 生长曲线数据点
  const heightCurvePoints = gender === '男'
    ? [[2, 85], [4, 103], [6, 117], [8, 130], [10, 140], [12, 150], [14, 165], [16, 172], [18, 175]]
    : [[2, 83], [4, 101], [6, 115], [8, 127], [10, 138], [12, 148], [14, 158], [16, 162], [18, 164]]

  const weightCurvePoints = gender === '男'
    ? [[2, 12], [4, 16], [6, 20], [8, 25], [10, 30], [12, 38], [14, 50], [16, 58], [18, 65]]
    : [[2, 11], [4, 15], [6, 19], [8, 24], [10, 31], [12, 40], [14, 48], [16, 52], [18, 55]]

  // 坐标转换
  const width = 500
  const height = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const xScale = (age: number) => ((age - 2) / 16) * plotWidth + padding.left
  const yScaleHeight = (h: number) => plotHeight - ((h - 70) / 110) * plotHeight + padding.top
  const yScaleWeight = (w: number) => plotHeight - ((w - 5) / 65) * plotHeight + padding.top

  // 生成曲线路径
  const generatePath = (points: number[][]) => {
    return points.map((p, i) => {
      const x = xScale(p[0])
      const y = yScaleHeight(p[1])
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  const generateWeightPath = (points: number[][]) => {
    return points.map((p, i) => {
      const x = xScale(p[0])
      const y = yScaleWeight(p[1])
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  // 当前年龄对应的x坐标
  const currentX = xScale(age)

  return (
    <svg width="100%" height={200} viewBox={`0 0 ${width} ${height}`}>
      {/* 背景网格 */}
      <defs>
        <pattern id="grid" width="50" height="25" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#e8e8e8" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} fill="url(#grid)"/>

      {/* X轴年龄标签 */}
      {[2, 6, 10, 14, 18].map(age => (
        <g key={age}>
          <line x1={xScale(age)} y1={padding.top} x2={xScale(age)} y2={height - padding.bottom} stroke="#d1d5db" strokeWidth="1"/>
          <text x={xScale(age)} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{age}岁</text>
        </g>
      ))}

      {/* Y轴身高标签 */}
      {[80, 120, 160, 180].map(h => (
        <g key={h}>
          <line x1={padding.left} y1={yScaleHeight(h)} x2={width - padding.right} y2={yScaleHeight(h)} stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="3,3"/>
          <text x={padding.left - 5} y={yScaleHeight(h) + 3} textAnchor="end" fontSize="9" fill="#64748b">{h}</text>
        </g>
      ))}

      {/* 身高曲线 */}
      <path d={generatePath(heightCurvePoints)} fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round"/>

      {/* 体重曲线（次坐标轴） */}
      <path d={generateWeightPath(weightCurvePoints)} fill="none" stroke={COLORS.secondary} strokeWidth="2" strokeLinecap="round" strokeDasharray="5,3"/>

      {/* 遗传身高参考线 */}
      <line x1={padding.left} y1={yScaleHeight(geneticHeight)} x2={width - padding.right} y2={yScaleHeight(geneticHeight)} stroke={COLORS.purple} strokeWidth="1.5" strokeDasharray="8,4"/>
      <text x={width - padding.right + 5} y={yScaleHeight(geneticHeight) + 3} fontSize="9" fill={COLORS.purple}>遗传身高</text>

      {/* 当前身高标记 */}
      <circle cx={currentX} cy={yScaleHeight(currentHeight)} r="6" fill={COLORS.primary} stroke="white" strokeWidth="2"/>
      <text x={currentX} y={yScaleHeight(currentHeight) - 12} textAnchor="middle" fontSize="10" fill={COLORS.primary} fontWeight="600">{currentHeight}cm</text>

      {/* 当前体重标记 */}
      <circle cx={currentX} cy={yScaleWeight(currentWeight)} r="6" fill={COLORS.secondary} stroke="white" strokeWidth="2"/>
      <text x={currentX} y={yScaleWeight(currentWeight) - 12} textAnchor="middle" fontSize="10" fill={COLORS.secondary} fontWeight="600">{currentWeight}kg</text>

      {/* 图例 */}
      <g transform={`translate(${padding.left}, ${height - 5})`}>
        <line x1="0" y1="0" x2="20" y2="0" stroke={COLORS.primary} strokeWidth="2"/>
        <text x="25" y="3" fontSize="9" fill="#64748b">身高</text>
        <line x1="60" y1="0" x2="80" y2="0" stroke={COLORS.secondary} strokeWidth="2" strokeDasharray="5,3"/>
        <text x="85" y="3" fontSize="9" fill="#64748b">体重</text>
        <line x1="120" y1="0" x2="140" y2="0" stroke={COLORS.purple} strokeWidth="1.5" strokeDasharray="8,4"/>
        <text x="145" y="3" fontSize="9" fill="#64748b">遗传身高</text>
      </g>
    </svg>
  )
}

// ============================================================
// 主组件
// ============================================================
const AIAssistPage: React.FC = () => {
  // Tab状态
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'abnormality' | 'qc' | 'learning' | 'boneage'>('diagnosis')

  // 数据状态
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(mockRecommendations)
  const [qcIssues, setQCIssues] = useState<QCIssue[]>(mockQCIssues)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [caseFilter, setCaseFilter] = useState('all')

  // 骨龄检测状态
  const [selectedBoneAgeRecord, setSelectedBoneAgeRecord] = useState<BoneAgeRecord | null>(null)
  const [boneAgeHistory] = useState<BoneAgeRecord[]>(mockBoneAgeRecords)

  // 刷新AI推荐处理
  const handleRefreshRecommendations = () => {
    setRecommendations(prev => prev.map(r => ({ ...r, confidence: parseFloat((r.confidence + (Math.random() - 0.5) * 0.1).toFixed(3)) })))
  }

  // 查看全部典型病例处理
  const handleViewAllCases = () => {
    // 跳转到典型病例库
    window.location.href = '/typical-cases'
  }

  // 查看全部文献处理
  const handleViewAllReferences = () => {
    window.location.href = '/finding-library'
  }

  // 进入知识库处理
  const handleEnterKnowledgeBase = () => {
    window.location.href = '/term-library'
  }

  // 生成骨龄报告处理
  const handleGenerateReport = () => {
    // 触发数据更新
  }

  // Tab配置
  const tabs = [
    { id: 'diagnosis' as const, label: 'AI推荐诊断', icon: <Sparkles size={16} />, count: recommendations.length },
    { id: 'abnormality' as const, label: '异常提示', icon: <AlertTriangle size={16} />, count: mockAbnormalities.length },
    { id: 'qc' as const, label: '智能质控', icon: <ShieldAlert size={16} />, count: qcIssues.filter(q => !q.isResolved).length },
    { id: 'learning' as const, label: '学习辅助', icon: <BookOpen size={16} />, count: 0 },
    { id: 'boneage' as const, label: 'AI骨龄检测', icon: <Baby size={16} />, count: 0 }
  ]

  // 采纳推荐处理
  const handleAcceptRecommendation = (id: string) => {
    setRecommendations(prev =>
      prev.map(rec =>
        rec.id === id ? { ...rec, isAccepted: true } : rec
      )
    )
  }

  // 整改质控问题处理
  const handleResolveQC = (id: string) => {
    setQCIssues(prev =>
      prev.map(issue =>
        issue.id === id ? { ...issue, isResolved: true } : issue
      )
    )
  }

  // 计算统计数据
  const stats = useMemo(() => ({
    totalRecommendations: recommendations.length,
    acceptedCount: recommendations.filter(r => r.isAccepted).length,
    highConfidenceCount: recommendations.filter(r => r.confidence >= 90).length,
    abnormalityCount: mockAbnormalities.length,
    highSeverityCount: mockAbnormalities.filter(a => a.severity === 'high').length,
    qcIssueCount: qcIssues.filter(q => !q.isResolved).length,
    criticalCount: qcIssues.filter(q => q.level === 'critical' && !q.isResolved).length
  }), [recommendations, qcIssues])

  // 选中骨龄记录时计算相关信息
  const boneAgeInfo = useMemo(() => {
    if (!selectedBoneAgeRecord) return null
    const record = selectedBoneAgeRecord
    const chronologicalAge = calculateAge(record.birthDate, record.examDate)
    const russianTotalScore = record.russianRating.reduce((sum, item) => sum + item.score, 0)
    const carpalTotalScore = record.carpalRating.reduce((sum, item) => sum + item.score, 0)

    // 遗传身高计算（基于父母身高，这里简化）
    const fatherHeight = 175
    const motherHeight = 162
    const geneticHeight = record.gender === '男'
      ? Math.round((fatherHeight + motherHeight + 13) / 2)
      : Math.round((fatherHeight + motherHeight - 13) / 2)

    return {
      chronologicalAge,
      russianTotalScore,
      carpalTotalScore,
      geneticHeight
    }
  }, [selectedBoneAgeRecord])

  return (
    <div style={{ padding: 20, background: COLORS.background, minHeight: '100vh' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.primary,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Brain size={20} color={COLORS.white} />
          </div>
          AI辅助诊断
        </h1>
        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6 }}>
          基于人工智能的诊断建议、异常检测、质控提醒和学习资源
        </p>
      </div>

      {/* 统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 20
      }}>
        <div style={{
          background: COLORS.white,
          borderRadius: 10,
          padding: 16,
          border: `1px solid ${COLORS.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: `${COLORS.primary}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={22} color={COLORS.primary} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text }}>
                {stats.totalRecommendations}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>AI推荐数</div>
            </div>
          </div>
        </div>

        <div style={{
          background: COLORS.white,
          borderRadius: 10,
          padding: 16,
          border: `1px solid ${COLORS.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: `${COLORS.success}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={22} color={COLORS.success} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text }}>
                {stats.acceptedCount}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>已采纳</div>
            </div>
          </div>
        </div>

        <div style={{
          background: COLORS.white,
          borderRadius: 10,
          padding: 16,
          border: `1px solid ${COLORS.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: `${COLORS.danger}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={22} color={COLORS.danger} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text }}>
                {stats.abnormalityCount}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>异常区域</div>
            </div>
          </div>
        </div>

        <div style={{
          background: COLORS.white,
          borderRadius: 10,
          padding: 16,
          border: `1px solid ${COLORS.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: `${COLORS.warning}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={22} color={COLORS.warning} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text }}>
                {stats.qcIssueCount}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>质控问题</div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{
        background: COLORS.white,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden'
      }}>
        {/* 标签导航 */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.backgroundLight
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? COLORS.primary : COLORS.textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 10,
                  background: tab.id === 'qc' && stats.criticalCount > 0
                    ? COLORS.danger
                    : COLORS.primary,
                  color: COLORS.white
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 标签内容 */}
        <div style={{ padding: 20 }}>
          {/* ========== AI推荐诊断 ========== */}
          {activeTab === 'diagnosis' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.text,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <Sparkles size={18} color={COLORS.primary} />
                  AI诊断推荐
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: COLORS.textMuted
                  }}>
                    — 基于深度学习模型的智能诊断建议
                  </span>
                </h3>
              </div>

              {/* 筛选操作栏 */}
              <div style={{
                display: 'flex',
                gap: 12,
                marginBottom: 16,
                alignItems: 'center'
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: COLORS.background,
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`
                }}>
                  <Search size={16} color={COLORS.textMuted} />
                  <input
                    type="text"
                    placeholder="搜索诊断建议..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      outline: 'none',
                      color: COLORS.text
                    }}
                  />
                </div>
                <button onClick={handleRefreshRecommendations} style={{
                  padding: '8px 16px',
                  background: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: COLORS.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <RefreshCw size={14} />
                  刷新
                </button>
              </div>

              {/* 推荐列表 */}
              <div>
                {recommendations
                  .filter(rec =>
                    searchKeyword === '' ||
                    rec.diagnosis.includes(searchKeyword) ||
                    rec.examType.includes(searchKeyword)
                  )
                  .map(rec => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onAccept={handleAcceptRecommendation}
                    />
                  ))}
              </div>

              {recommendations.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: COLORS.textMuted
                }}>
                  <Sparkles size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ fontSize: 14 }}>暂无AI诊断推荐</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    请先选择患者并开始书写报告
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== 异常提示 ========== */}
          {activeTab === 'abnormality' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.text,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <Target size={18} color={COLORS.danger} />
                  自动检测异常区域
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: COLORS.textMuted
                  }}>
                    — AI自动标注的可疑病灶
                  </span>
                </h3>
              </div>

              {/* 图像标注区域 */}
              <div style={{
                background: COLORS.background,
                borderRadius: 10,
                padding: 20,
                marginBottom: 20,
                border: `1px solid ${COLORS.border}`,
                position: 'relative'
              }}>
                {/* DICOM图像区域 */}
                <div style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  background: '#1a1a2e',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* CT横断面示意 */}
                  <div style={{
                    width: '80%',
                    height: '80%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #2a2a4a 0%, #1a1a2e 100%)',
                    position: 'relative'
                  }}>
                    {/* 脊柱 */}
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 30,
                      height: 50,
                      background: '#3a3a5a',
                      borderRadius: 8
                    }} />

                    {/* 标注点 */}
                    {mockAbnormalities.map((abn, idx) => (
                      <div
                        key={abn.id}
                        style={{
                          position: 'absolute',
                          left: `${abn.location.x / 3}%`,
                          top: `${abn.location.y / 3}%`,
                          transform: 'translate(-50%, -50%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: getSeverityColor(abn.severity),
                          border: '2px solid white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 0 10px ${getSeverityColor(abn.severity)}`
                        }}>
                          <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>
                            {idx + 1}
                          </span>
                        </div>
                        <div style={{
                          marginTop: 4,
                          padding: '2px 6px',
                          background: 'rgba(0,0,0,0.8)',
                          borderRadius: 4,
                          fontSize: 12,
                          color: 'white',
                          whiteSpace: 'nowrap'
                        }}>
                          {abn.region}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 图例 */}
                <div style={{
                  display: 'flex',
                  gap: 20,
                  marginTop: 12,
                  justifyContent: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: COLORS.danger
                    }} />
                    <span style={{ fontSize: 12, color: COLORS.textMuted }}>高度可疑</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: COLORS.warning
                    }} />
                    <span style={{ fontSize: 12, color: COLORS.textMuted }}>中度可疑</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: COLORS.info
                    }} />
                    <span style={{ fontSize: 12, color: COLORS.textMuted }}>低度可疑</span>
                  </div>
                </div>
              </div>

              {/* 异常列表 */}
              <div>
                {mockAbnormalities.map(abn => (
                  <AbnormalityCard key={abn.id} abnormality={abn} />
                ))}
              </div>
            </div>
          )}

          {/* ========== 智能质控 ========== */}
          {activeTab === 'qc' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.text,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <ShieldAlert size={18} color={COLORS.warning} />
                  智能质控
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: COLORS.textMuted
                  }}>
                    — 自动检查报告质量与规范
                  </span>
                </h3>
              </div>

              {/* 质控筛选 */}
              <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16
              }}>
                {['全部', '待整改', '危急值'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setCaseFilter(filter === '全部' ? 'all' : filter === '待整改' ? 'pending' : 'critical')}
                    style={{
                      padding: '6px 14px',
                      background: caseFilter === (filter === '全部' ? 'all' : filter === '待整改' ? 'pending' : 'critical')
                        ? COLORS.primary
                        : COLORS.white,
                      border: `1px solid ${caseFilter === (filter === '全部' ? 'all' : filter === '待整改' ? 'pending' : 'critical')
                        ? COLORS.primary
                        : COLORS.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: caseFilter === (filter === '全部' ? 'all' : filter === '待整改' ? 'pending' : 'critical')
                        ? COLORS.white
                        : COLORS.text,
                      cursor: 'pointer'
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* 质控问题列表 */}
              <div>
                {qcIssues
                  .filter(issue => {
                    if (caseFilter === 'all') return true
                    if (caseFilter === 'pending') return !issue.isResolved
                    if (caseFilter === 'critical') return issue.level === 'critical' && !issue.isResolved
                    return true
                  })
                  .map(issue => (
                    <QCCard key={issue.id} issue={issue} onResolve={handleResolveQC} />
                  ))}
              </div>

              {qcIssues.filter(q => !q.isResolved).length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: COLORS.textMuted
                }}>
                  <ShieldAlert size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ fontSize: 14 }}>所有质控问题已整改完成</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                   继续保持！
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== 学习辅助 ========== */}
          {activeTab === 'learning' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.text,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <BookOpen size={18} color={COLORS.secondary} />
                  学习辅助
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: COLORS.textMuted
                  }}>
                    — 典型病例、文献和知识库
                  </span>
                </h3>
              </div>

              {/* 学习资源分类 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20
              }}>
                {/* 典型病例 */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12
                  }}>
                    <h4 style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLORS.text,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <Star size={14} color={COLORS.warning} />
                      典型病例推荐
                    </h4>
                    <button onClick={handleViewAllCases} style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 12,
                      color: COLORS.primary,
                      cursor: 'pointer'
                    }}>
                      查看全部
                    </button>
                  </div>
                  <div>
                    {mockTypicalCases.map(caseItem => (
                      <CaseCard key={caseItem.id} caseItem={caseItem} />
                    ))}
                  </div>
                </div>

                {/* 相关文献 */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12
                  }}>
                    <h4 style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLORS.text,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <FileText size={14} color={COLORS.purple} />
                      相关文献推送
                    </h4>
                    <button onClick={handleViewAllReferences} style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 12,
                      color: COLORS.primary,
                      cursor: 'pointer'
                    }}>
                      查看全部
                    </button>
                  </div>
                  <div>
                    {mockReferences.map(article => (
                      <ReferenceCard key={article.id} article={article} />
                    ))}
                  </div>
                </div>
              </div>

              {/* 诊断知识库入口 */}
              <div style={{
                marginTop: 20,
                padding: 20,
                background: `linear-gradient(135deg, ${COLORS.primary}10, ${COLORS.secondary}10)`,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: COLORS.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <Database size={24} color={COLORS.primary} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>
                      诊断知识库
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                      包含10万+典型病例、影像征象鉴别诊断、指南共识
                    </div>
                  </div>
                </div>
                <button onClick={handleEnterKnowledgeBase} style={{
                  padding: '10px 20px',
                  background: COLORS.primary,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Search size={14} />
                  进入知识库
                </button>
              </div>
            </div>
          )}

          {/* ========== AI骨龄检测 ========== */}
          {activeTab === 'boneage' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.text,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <Baby size={18} color={COLORS.primary} />
                  AI骨龄检测
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: COLORS.textMuted
                  }}>
                    — 手骨X光片AI评估，基于TW3/Tanner骨龄标准
                  </span>
                </h3>
              </div>

              {/* AI模型说明卡片 */}
              <div style={{
                padding: 16,
                background: `linear-gradient(135deg, ${COLORS.primary}08, ${COLORS.secondary}08)`,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: COLORS.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <Activity size={24} color={COLORS.primary} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                      AI骨龄评估模型
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 12, color: COLORS.textMuted }}>
                      <span>训练数据：<strong style={{ color: COLORS.primary }}>150万</strong>张手骨X光</span>
                      <span>准确率(&lt;±1岁)：<strong style={{ color: COLORS.success }}>98%</strong></span>
                      <span>适用年龄：<strong style={{ color: COLORS.secondary }}>3-18岁</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* 左侧：历史记录列表 */}
                <div>
                  <h4 style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.text,
                    margin: '0 0 12px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <Calendar size={14} color={COLORS.primary} />
                    历史检测记录
                  </h4>

                  <div style={{
                    background: COLORS.background,
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 500,
                    overflowY: 'auto'
                  }}>
                    {boneAgeHistory.map(record => (
                      <BoneAgeCard
                        key={record.id}
                        record={record}
                        onSelect={setSelectedBoneAgeRecord}
                      />
                    ))}
                  </div>
                </div>

                {/* 右侧：详细评估界面 */}
                <div>
                  {selectedBoneAgeRecord ? (
                    <div>
                      {/* 患者基本信息 */}
                      <div style={{
                        background: COLORS.white,
                        borderRadius: 10,
                        padding: 16,
                        border: `1px solid ${COLORS.border}`,
                        marginBottom: 16
                      }}>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.text,
                          margin: '0 0 12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <User size={14} color={COLORS.primary} />
                          患者基本信息
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>姓名：</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                              {selectedBoneAgeRecord.patientName}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>性别：</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                              {selectedBoneAgeRecord.gender}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>出生日期：</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                              {selectedBoneAgeRecord.birthDate}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>拍摄日期：</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                              {selectedBoneAgeRecord.examDate}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>实际年龄：</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.secondary }}>
                              {boneAgeInfo?.chronologicalAge}岁
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 手骨X光片上传区域 */}
                      <div style={{
                        background: COLORS.white,
                        borderRadius: 10,
                        padding: 16,
                        border: `1px solid ${COLORS.border}`,
                        marginBottom: 16
                      }}>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.text,
                          margin: '0 0 12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <ImageIcon size={14} color={COLORS.primary} />
                          手骨X光片
                        </h4>
                        <div style={{
                          background: COLORS.background,
                          borderRadius: 8,
                          padding: 30,
                          textAlign: 'center',
                          border: `2px dashed ${COLORS.border}`
                        }}>
                          <Upload size={40} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 4 }}>
                            点击或拖拽上传手骨X光片
                          </div>
                          <div style={{ fontSize: 12, color: COLORS.textLight }}>
                            支持 DICOM / JPG / PNG 格式
                          </div>
                        </div>
                      </div>

                      {/* AI评估结果 */}
                      <div style={{
                        background: COLORS.white,
                        borderRadius: 10,
                        padding: 16,
                        border: `1px solid ${COLORS.border}`,
                        marginBottom: 16
                      }}>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.text,
                          margin: '0 0 12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <Sparkles size={14} color={COLORS.primary} />
                          AI评估结果
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                          <div style={{
                            padding: 12,
                            background: `${COLORS.primary}10`,
                            borderRadius: 8,
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>骨龄评估</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary }}>
                              {selectedBoneAgeRecord.boneAge}岁
                            </div>
                          </div>
                          <div style={{
                            padding: 12,
                            background: `${COLORS.warning}10`,
                            borderRadius: 8,
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>骨龄偏差</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.warning }}>
                              {selectedBoneAgeRecord.deviation > 0 ? '+' : ''}{selectedBoneAgeRecord.deviation}岁
                            </div>
                          </div>
                          <div style={{
                            padding: 12,
                            background: `${getDevStatusColor(selectedBoneAgeRecord.developmentStatus)}10`,
                            borderRadius: 8,
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>发育评估</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: getDevStatusColor(selectedBoneAgeRecord.developmentStatus) }}>
                              {selectedBoneAgeRecord.developmentStatus}
                            </div>
                          </div>
                          <div style={{
                            padding: 12,
                            background: `${COLORS.secondary}10`,
                            borderRadius: 8,
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>预测成年身高</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.secondary }}>
                              {selectedBoneAgeRecord.predictedHeight}cm
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* TW3/Tanner骨龄标准对照 */}
                      <div style={{
                        background: COLORS.white,
                        borderRadius: 10,
                        padding: 16,
                        border: `1px solid ${COLORS.border}`,
                        marginBottom: 16
                      }}>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.text,
                          margin: '0 0 12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <Target size={14} color={COLORS.primary} />
                          TW3/Tanner骨龄标准对照
                        </h4>

                        {/* RUS骨骺评级 */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: COLORS.textMuted,
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <Ruler size={12} />
                            RUS（桡尺骨、掌指骨）评分
                            <span style={{
                              fontSize: 12,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: `${COLORS.primary}15`,
                              color: COLORS.primary
                            }}>
                              总分：{boneAgeInfo?.russianTotalScore}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {selectedBoneAgeRecord.russianRating.map((item, idx) => (
                              <div key={idx} style={{
                                padding: '6px 8px',
                                background: COLORS.background,
                                borderRadius: 5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span style={{ fontSize: 12, color: COLORS.textMuted }}>{item.name}</span>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: getRatingColor(item.rating)
                                }}>
                                  {item.rating}({item.score})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Carpal骨骺评级 */}
                        <div>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: COLORS.textMuted,
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <Scale size={12} />
                            Carpal（腕骨）评分
                            <span style={{
                              fontSize: 12,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: COLORS.infoBg,
                              color: COLORS.info
                            }}>
                              总分：{boneAgeInfo?.carpalTotalScore}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {selectedBoneAgeRecord.carpalRating.map((item, idx) => (
                              <div key={idx} style={{
                                padding: '6px 8px',
                                background: COLORS.background,
                                borderRadius: 5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span style={{ fontSize: 12, color: COLORS.textMuted }}>{item.name}</span>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: getRatingColor(item.rating)
                                }}>
                                  {item.rating}({item.score})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 儿童生长曲线图 */}
                      <div style={{
                        background: COLORS.white,
                        borderRadius: 10,
                        padding: 16,
                        border: `1px solid ${COLORS.border}`,
                        marginBottom: 16
                      }}>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.text,
                          margin: '0 0 12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <TrendingUp size={14} color={COLORS.primary} />
                          儿童生长曲线图
                        </h4>
                        <GrowthCurve
                          currentHeight={selectedBoneAgeRecord.predictedHeight - 50}
                          currentWeight={35}
                          age={boneAgeInfo?.chronologicalAge || 10}
                          gender={selectedBoneAgeRecord.gender}
                          geneticHeight={boneAgeInfo?.geneticHeight || 165}
                        />
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: 8,
                          padding: '8px 12px',
                          background: COLORS.background,
                          borderRadius: 6
                        }}>
                          <div>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>遗传身高：</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.purple }}>
                              {boneAgeInfo?.geneticHeight}cm
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>当前身高：</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
                              {selectedBoneAgeRecord.predictedHeight - 50}cm
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: 12, color: COLORS.textMuted }}>当前体重：</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.secondary }}>
                              35kg
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 报告生成按钮 */}
                      <button
                        onClick={handleGenerateReport}
                        style={{
                          width: '100%',
                          padding: '14px 20px',
                          background: COLORS.primary,
                          color: COLORS.white,
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <FileDown size={18} />
                        一键生成骨龄评估报告
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      background: COLORS.background,
                      borderRadius: 10,
                      padding: 60,
                      textAlign: 'center',
                      border: `1px solid ${COLORS.border}`
                    }}>
                      <Baby size={48} color={COLORS.textLight} style={{ marginBottom: 12 }} />
                      <div style={{ fontSize: 14, color: COLORS.textMuted }}>
                        请从左侧选择一条检测记录
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
                        或上传新的手骨X光片进行评估
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部信息 */}
      <div style={{
        marginTop: 16,
        textAlign: 'center',
        fontSize: 12,
        color: COLORS.textMuted
      }}>
        AI辅助诊断系统 · 基于深度学习模型 · 仅供参考，最终诊断以临床医生为准
      </div>
    </div>
  )
}

export default AIAssistPage

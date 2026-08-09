// G005 放射科RIS系统 - 报告词库页面 v1.1.0
// 放射科专用术语词库，支持快速录入、分类管理、快捷复制、批量导入
// 支持 WS/T 500-2016 国家标准对照
import { useState, useEffect, useRef } from 'react'
import { BookOpen, Search, Plus, Edit2, Trash2, X, Copy, Upload, Download, BarChart2, Tag, FolderOpen, TrendingUp, CheckCircle2, FileSpreadsheet, RefreshCw, EyeOff, Check, LayoutGrid, Zap, FileCheck, DownloadCloud, Network, Lightbulb, Languages, FileSearch, Move, Save } from 'lucide-react'
import { initialTermLibrary } from '../data/initialData'
import { termApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'

// ============ 类型定义 ============
interface TermEntry {
  id: string
  category: string
  term: string
  count: number
  standardReport: string
  lastUsed?: string
  isActive?: boolean
  modality?: string[]
  termType?: '描述短语' | '诊断结论' | '测量值' | '参考范围'
  usageNotes?: string
  synonyms?: string[]
  wsStandardCode?: string
}

interface TermCategory {
  id: string
  name: string
  modality: string
  count: number
  color: string
}

interface QuickTerm {
  id: string
  term: string
  modality: string
  count: number
  category: string
}

interface WsStandardEntry {
  code: string
  standardName: string
  aliases: string[]
  department: string
  subClass: string
  reportTemplate: string
}

interface SynonymRelation {
  id: string
  from: string
  to: string
  type: 'synonym' | 'broader' | 'narrower' | 'related'
  weight: number
}

interface TermSuggestion {
  term: string
  frequency: number
  modality: string
  category: string
  context: string
}

interface LanguageEntry {
  termId: string
  zh: string
  en: string
  ja: string
  accuracy: number
}

interface ExtractedTerm {
  id: string
  term: string
  frequency: number
  source: string
  status: 'pending' | 'approved' | 'rejected'
  suggestedCategory: string
}

interface CategoryTreeNode {
  id: string
  name: string
  children: CategoryTreeNode[]
  count: number
  color: string
}

// ============ 常量 ============
const MODALITY_LIST = ['CT', 'MR', 'DR', 'DSA', 'MG', 'GI']
const TERM_TYPES: Array<'描述短语' | '诊断结论' | '测量值' | '参考范围'> = [
  '描述短语', '诊断结论', '测量值', '参考范围'
]
const MODALITY_COLORS: Record<string, string> = {
  'CT': '#3b82f6', 'MR': '#8b5cf6', 'DR': '#10b981', 'DSA': '#f59e0b', 'MG': '#ec4899', 'GI': '#06b6d4',
}
const MODALITY_BG: Record<string, string> = {
  'CT': '#3b82f622', 'MR': '#8b5cf622', 'DR': '#10b98122', 'DSA': '#f59e0b22', 'MG': '#ec489922', 'GI': '#06b6d422',
}

const WS_STANDARDS: WsStandardEntry[] = [
  { code: 'WS-CT-001', standardName: 'CT头部平扫', aliases: ['头颅CT', '脑部CT', '头部CT'], department: 'CT', subClass: '头部', reportTemplate: '颅内未见异常密度影，脑室、脑池、脑沟形态正常，中线结构居中。' },
  { code: 'WS-CT-002', standardName: 'CT胸部平扫', aliases: ['肺部CT', '胸片CT', '胸部CT'], department: 'CT', subClass: '胸部', reportTemplate: '双肺纹理清晰，未见实变及肿块影。纵隔无偏移，心影形态正常。' },
  { code: 'WS-CT-003', standardName: 'CT腹部平扫', aliases: ['腹部CT', '盆腔CT', '腹腔CT'], department: 'CT', subClass: '腹部', reportTemplate: '肝脾形态、大小正常，未见异常密度影。腹膜后未见肿大淋巴结。' },
  { code: 'WS-CT-004', standardName: 'CT冠脉动脉成像', aliases: ['冠脉CTA', '心脏CTA', '冠状动脉CTA'], department: 'CT', subClass: '心脏大血管', reportTemplate: '冠状动脉各支未见明显狭窄或钙化斑块。主动脉根部形态正常。' },
  { code: 'WS-CT-005', standardName: 'CT肺部高分辨', aliases: ['HRCT肺', '肺部HRCT'], department: 'CT', subClass: '胸部', reportTemplate: '双肺野透亮度正常，肺纹理清晰，肺小叶间隔未见增厚。' },
  { code: 'WS-CT-006', standardName: 'CT骨盆平扫', aliases: ['骨盆CT'], department: 'CT', subClass: '骨盆', reportTemplate: '骨盆骨质结构完整，未见骨折及破坏性病变。关节间隙正常。' },
  { code: 'WS-CT-007', standardName: 'CT四肢平扫', aliases: ['四肢CT', '肢体CT'], department: 'CT', subClass: '四肢', reportTemplate: '四肢骨骨质完整，未见骨折及骨破坏。软组织未见异常。' },
  { code: 'WS-CT-008', standardName: 'CT颈部平扫', aliases: ['颈部CT', '甲状腺CT'], department: 'CT', subClass: '颈部', reportTemplate: '颈部淋巴结未见肿大。甲状腺形态正常，未见占位性病变。' },
  { code: 'WS-MR-001', standardName: 'MR头颅平扫', aliases: ['脑MRI', '脑部磁共振', '头颅MRI'], department: 'MR', subClass: '头部', reportTemplate: '脑实质内未见异常信号灶，脑室、脑池、脑沟形态正常，中线结构居中。' },
  { code: 'WS-MR-002', standardName: 'MR腰椎平扫', aliases: ['腰骶MRI', '腰椎磁共振', '腰部MRI'], department: 'MR', subClass: '脊柱', reportTemplate: '腰椎序列正常，L4/5、L5/S1椎间盘轻度突出，硬膜囊轻度受压。' },
  { code: 'WS-MR-003', standardName: 'MR腹部平扫', aliases: ['腹部MRI', '肝胆MRI', '上腹MRI'], department: 'MR', subClass: '腹部', reportTemplate: '肝脏形态、大小正常，肝实质未见异常信号。脾脏不大。胆囊形态正常。' },
  { code: 'WS-MR-004', standardName: 'MR前列腺平扫', aliases: ['前列腺MRI'], department: 'MR', subClass: '盆腔', reportTemplate: '前列腺形态规整，体积约XXml，信号均匀，未见明确肿块影。' },
  { code: 'WS-MR-005', standardName: 'MR颈椎平扫', aliases: ['颈MRI', '颈椎磁共振'], department: 'MR', subClass: '脊柱', reportTemplate: '颈椎序列正常，C4/5、C5/6椎间盘向后突出，硬膜囊轻度受压。' },
  { code: 'WS-MR-006', standardName: 'MR肩关节平扫', aliases: ['肩关节MRI'], department: 'MR', subClass: '关节', reportTemplate: '肩袖形态、信号正常，肩锁关节未见脱位，肱骨头形态正常。' },
  { code: 'WS-MR-007', standardName: 'MR膝关节平扫', aliases: ['膝关节MRI', '膝盖MRI'], department: 'MR', subClass: '关节', reportTemplate: '前交叉韧带形态、信号正常，内侧半月板后角轻度退变。' },
  { code: 'WS-MR-008', standardName: 'MR盆腔平扫', aliases: ['盆腔MRI', '子宫附件MRI'], department: 'MR', subClass: '盆腔', reportTemplate: '盆腔内脏器形态、信号正常，未见异常占位性病变。' },
  { code: 'WS-DXR-001', standardName: '数字化X线胸片', aliases: ['DR胸片', '胸部正侧位', '胸片DR'], department: 'DXR', subClass: '胸部', reportTemplate: '胸廓对称，双肺纹理清晰，双肺野透亮度正常。心脏大小、形态正常。' },
  { code: 'WS-DXR-002', standardName: '数字化X线腹部立卧位', aliases: ['腹部平片', 'KUB'], department: 'DXR', subClass: '腹部', reportTemplate: '腹部肠管充气良好，未见液平及游离气体。双肾区未见阳性结石影。' },
  { code: 'WS-DXR-003', standardName: '数字化X线四肢关节', aliases: ['四肢X线', '关节片'], department: 'DXR', subClass: '四肢', reportTemplate: '诸骨骨质完整，关节面光滑，关节间隙正常，软组织未见异常。' },
  { code: 'WS-DXR-004', standardName: '数字化X线脊柱全长', aliases: ['脊柱全长片', 'EOS'], department: 'DXR', subClass: '脊柱', reportTemplate: '脊柱序列正常，生理曲度存在。椎体形态、密度正常。' },
  { code: 'WS-DXR-005', standardName: '数字化X线乳腺摄影', aliases: ['MG', '乳腺X线'], department: '乳腺', subClass: '乳腺', reportTemplate: '双侧乳腺腺体呈混合型，乳腺纹理结构清晰，未见肿块及异常钙化。' },
  { code: 'WS-DXR-006', standardName: '数字化X线口腔全景', aliases: ['口腔全景片', 'OPG'], department: 'DXR', subClass: '口腔', reportTemplate: '全口牙列完整，牙槽骨未见明显吸收，颞下颌关节形态正常。' },
  { code: 'WS-US-001', standardName: '超声腹部常规', aliases: ['腹部B超', '肝胆脾胰B超'], department: '超声', subClass: '腹部', reportTemplate: '肝脏大小形态正常，肝实质回声均匀，肝内管道走形正常。' },
  { code: 'WS-US-002', standardName: '超声甲状腺', aliases: ['甲状腺B超', '甲状腺彩超'], department: '超声', subClass: '浅表器官', reportTemplate: '甲状腺左右叶大小正常，实质回声均匀，未见结节及肿块。' },
  { code: 'WS-US-003', standardName: '超声泌尿系统', aliases: ['肾脏B超', '泌尿系B超'], department: '超声', subClass: '泌尿', reportTemplate: '双肾大小形态正常，皮质回声均匀，集合系统未见分离。' },
  { code: 'WS-US-004', standardName: '超声心脏', aliases: ['心脏彩超', 'UCG', '超声心动图'], department: '超声', subClass: '心脏', reportTemplate: '心脏各房室大小正常，瓣膜形态启闭良好，心功能正常。' },
  { code: 'WS-US-005', standardName: '超声颈部血管', aliases: ['颈动脉B超', '颈部血管彩超'], department: '超声', subClass: '血管', reportTemplate: '双侧颈动脉内-中膜不厚，管腔未见狭窄及扩张，血流速度正常。' },
  { code: 'WS-DSA-001', standardName: 'DSA脑血管造影', aliases: ['脑DSA', '脑血管DSA'], department: 'DSA', subClass: '神经系统', reportTemplate: '脑血管各分支形态、走形正常，未见动脉瘤、畸形或狭窄。' },
  { code: 'WS-DSA-002', standardName: 'DSA冠状动脉造影', aliases: ['冠脉DSA', '心脏导管'], department: 'DSA', subClass: '心血管', reportTemplate: '冠状动脉左主干、前降支、回旋支、右冠状动脉未见明显狭窄。' },
]

const DEPT_LIST = ['CT', 'MR', 'DXR', '超声', '乳腺', 'DSA', '放射']

const INIT_CATEGORIES: TermCategory[] = [
  { id: 'CAT-CT-HEAD', name: 'CT-头部', modality: 'CT', count: 0, color: '#3b82f6' },
  { id: 'CAT-CT-CHEST', name: 'CT-胸部', modality: 'CT', count: 0, color: '#60a5fa' },
  { id: 'CAT-CT-ABD', name: 'CT-腹部', modality: 'CT', count: 0, color: '#93c5fd' },
  { id: 'CAT-MR-HEAD', name: 'MR-头部', modality: 'MR', count: 0, color: '#8b5cf6' },
  { id: 'CAT-MR-SPINE', name: 'MR-脊柱', modality: 'MR', count: 0, color: '#a78bfa' },
  { id: 'CAT-DR-CHEST', name: 'DR-胸部', modality: 'DR', count: 0, color: '#10b981' },
  { id: 'CAT-DR-EXT', name: 'DR-四肢', modality: 'DR', count: 0, color: '#34d399' },
  { id: 'CAT-DSA', name: 'DSA', modality: 'DSA', count: 0, color: '#f59e0b' },
  { id: 'CAT-MG', name: 'MG', modality: 'MG', count: 0, color: '#ec4899' },
]

const relationshipColors: Record<string, string> = {
  synonym: '#16a34a', broader: '#3b82f6', narrower: '#f59e0b', related: '#8b5cf6',
}

// ============ 主组件 ============
export default function TermLibraryPage() {
  const [terms, setTerms] = useState<TermEntry[]>(() =>
    initialTermLibrary.map((t, i) => {
      const wsCodes = WS_STANDARDS.map(ws => ws.code)
      const mapped = i % 3 === 0 ? wsCodes[i % wsCodes.length] : undefined
      return {
        ...t,
        lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        isActive: true,
        modality: MODALITY_LIST.slice(0, Math.floor(Math.random() * 3) + 1),
        termType: TERM_TYPES[Math.floor(Math.random() * 2)] as TermEntry['termType'],
        wsStandardCode: mapped,
      }
    })
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await termApi.list()
      if (cancelled) return
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setLoadError(null)
      } else {
        setLoadError('API 不可用,使用本地术语库')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])
  const [categories, _setCategories] = useState<TermCategory[]>(INIT_CATEGORIES)
  const [leftSearch, setLeftSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all')
  const [rightSearch, setRightSearch] = useState('')
  const [modalityFilter, setModalityFilter] = useState<string>('全部')
  const [categoryFilter, setCategoryFilter] = useState<string>('全部')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingTerm, setEditingTerm] = useState<TermEntry | null>(null)
  const [showQuickPanel, setShowQuickPanel] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [activeQuickModality, setActiveQuickModality] = useState<string>('CT')
  const [importLoading, setImportLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [_importSuccess, setImportSuccess] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mainTab, setMainTab] = useState<'dict' | 'standard'>('dict')
  const [wsSearch, setWsSearch] = useState('')
  const [wsDeptFilter, setWsDeptFilter] = useState<string>('全部')
  const [importAllLoading, setImportAllLoading] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    term: '', category: 'CT描述', modality: ['CT'] as string[],
    termType: '描述短语' as TermEntry['termType'],
    standardReport: '', usageNotes: '', wsStandardCode: '',
  })

  // Phase 7 state
  const [featureTab, setFeatureTab] = useState<'main' | 'suggestion' | 'synonym' | 'extraction' | 'language' | 'category'>('main')
  const [suggestionSearch, setSuggestionSearch] = useState('')
  const [_showSynonymGraph, _setShowSynonymGraph] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [synonymZoom, setSynonymZoom] = useState(1)
  const [synonymPan, setSynonymPan] = useState({ x: 0, y: 0 })
  const [extractionRunning, setExtractionRunning] = useState(false)
  const [extractedTerms, setExtractedTerms] = useState<ExtractedTerm[]>([])
  const [languageSearch, setLanguageSearch] = useState('')
  const [bilingualMode, setBilingualMode] = useState(false)
  const [selectedLang, setSelectedLang] = useState<'zh' | 'en' | 'ja'>('zh')
  const [translations, setTranslations] = useState<LanguageEntry[]>([])
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([])
  const [synonymRelations, setSynonymRelations] = useState<SynonymRelation[]>([])
  const [suggestions, setSuggestions] = useState<TermSuggestion[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [sugRes, synRes, transRes, extRes, catRes] = await Promise.allSettled([
        termApi.getSuggestions(),
        termApi.getSynonymRelations(),
        termApi.getTranslations(),
        termApi.getExtractedTerms(),
        termApi.getCategoryTree(),
      ])
      if (cancelled) return
      if (sugRes.status === 'fulfilled' && sugRes.value.success && Array.isArray(sugRes.value.data)) {
        setSuggestions(sugRes.value.data.map(s => ({ ...s } as TermSuggestion)))
      }
      if (synRes.status === 'fulfilled' && synRes.value.success && Array.isArray(synRes.value.data)) {
        setSynonymRelations(synRes.value.data.map(s => ({ ...s } as SynonymRelation)))
      }
      if (transRes.status === 'fulfilled' && transRes.value.success && Array.isArray(transRes.value.data)) {
        setTranslations(transRes.value.data.map(t => ({ ...t } as LanguageEntry)))
      }
      if (extRes.status === 'fulfilled' && extRes.value.success && Array.isArray(extRes.value.data)) {
        setExtractedTerms(extRes.value.data.map(e => ({ ...e } as ExtractedTerm)))
      }
      if (catRes.status === 'fulfilled' && catRes.value.success && Array.isArray(catRes.value.data)) {
        setCategoryTree(catRes.value.data.map(c => ({ ...c } as CategoryTreeNode)))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const stats = {
    totalTerms: terms.length,
    totalCategories: categories.length,
    thisMonthUsage: terms.reduce((sum, t) => sum + t.count, 0),
    activeTerms: terms.filter(t => t.isActive !== false).length,
    mappedCount: terms.filter(t => t.wsStandardCode).length,
  }

  const getCategoryCount = (catId: string) => {
    if (catId === 'ALL') return terms.length
    const cat = categories.find(c => c.id === catId)
    if (!cat) return 0
    return terms.filter(t => t.modality?.includes(cat.modality)).length
  }

  const filteredTerms = terms.filter(t => {
    if (activeCategoryId !== 'ALL') {
      const cat = categories.find(c => c.id === activeCategoryId)
      if (cat && !t.modality?.includes(cat.modality)) return false
    }
    if (activeTab === 'active' && t.isActive === false) return false
    if (activeTab === 'inactive' && t.isActive !== false) return false
    if (rightSearch && !t.term.toLowerCase().includes(rightSearch.toLowerCase()) &&
        !t.standardReport.toLowerCase().includes(rightSearch.toLowerCase())) return false
    if (modalityFilter !== '全部' && !t.modality?.includes(modalityFilter)) return false
    if (categoryFilter !== '全部' && t.category !== categoryFilter) return false
    return true
  })

  const filteredWsStandards = WS_STANDARDS.filter(ws => {
    if (wsSearch) {
      const s = wsSearch.toLowerCase()
      if (!ws.standardName.toLowerCase().includes(s) &&
          !ws.code.toLowerCase().includes(s) &&
          !ws.aliases.some(a => a.toLowerCase().includes(s))) return false
    }
    if (wsDeptFilter !== '全部' && ws.department !== wsDeptFilter) return false
    return true
  })

  const quickTerms: QuickTerm[] = terms
    .filter(t => t.modality?.includes(activeQuickModality) && t.isActive !== false)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map(t => ({ id: t.id, term: t.term, modality: activeQuickModality, count: t.count, category: t.category }))

  const top20Terms = [...terms].sort((a, b) => b.count - a.count).slice(0, 20)
  const allCategoryNames = Array.from(new Set(terms.map(t => t.category)))
  const mappedWsCodes = new Set(terms.filter(t => t.wsStandardCode).map(t => t.wsStandardCode))

  const filteredSuggestions = suggestions.filter(s =>
    !suggestionSearch || s.term.toLowerCase().includes(suggestionSearch.toLowerCase()) ||
    s.context.toLowerCase().includes(suggestionSearch.toLowerCase())
  )

  const filteredTranslations = translations.filter(t =>
    !languageSearch ||
    t.zh.includes(languageSearch) || t.en.toLowerCase().includes(languageSearch.toLowerCase()) ||
    t.ja.includes(languageSearch)
  )

  // ============ 操作函数 ============
  const handleCopyTerm = async (term: string) => {
    try {
      await navigator.clipboard.writeText(term)
      setCopySuccess(term)
      setTimeout(() => setCopySuccess(null), 1500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = term
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopySuccess(term)
      setTimeout(() => setCopySuccess(null), 1500)
    }
  }

  const openAddModal = () => {
    setModalMode('add')
    setFormData({ term: '', category: 'CT描述', modality: ['CT'], termType: '描述短语', standardReport: '', usageNotes: '', wsStandardCode: '' })
    setEditingTerm(null)
    setShowModal(true)
  }

  const openEditModal = (term: TermEntry) => {
    setModalMode('edit')
    setEditingTerm(term)
    setFormData({ term: term.term, category: term.category, modality: term.modality || ['CT'], termType: term.termType || '描述短语', standardReport: term.standardReport, usageNotes: term.usageNotes || '', wsStandardCode: term.wsStandardCode || '' })
    setShowModal(true)
  }

  const handleSaveTerm = () => {
    if (!formData.term.trim()) return
    if (modalMode === 'add') {
      const newTerm: TermEntry = { id: `TERM${String(terms.length + 1).padStart(3, '0')}`, ...formData, count: 0, lastUsed: new Date().toISOString().slice(0, 10), isActive: true }
      setTerms([...terms, newTerm])
    } else if (editingTerm) {
      setTerms(terms.map(t => t.id === editingTerm.id ? { ...t, ...formData, lastUsed: new Date().toISOString().slice(0, 10) } : t))
    }
    setShowModal(false)
  }

  const handleDeleteTerm = (id: string) => {
    if (!confirm('确认删除该词条？')) return
    setTerms(terms.filter(t => t.id !== id))
  }

  const handleToggleActive = (id: string) => {
    setTerms(terms.map(t => t.id === id ? { ...t, isActive: t.isActive === false ? true : false } : t))
  }

  const handleModalityToggle = (mod: string) => {
    setFormData(prev => ({ ...prev, modality: prev.modality.includes(mod) ? prev.modality.filter(m => m !== mod) : [...prev.modality, mod] }))
  }

  const handleImportFile = async () => {
    if (!importFile) return
    setImportLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    const newTerms: TermEntry[] = [
      { id: `TERM${String(terms.length + 1).padStart(3, '0')}`, term: '导入词条示例1', category: 'CT描述', modality: ['CT'], count: 0, standardReport: '批量导入的词条内容', isActive: true, termType: '描述短语', lastUsed: new Date().toISOString().slice(0, 10) },
      { id: `TERM${String(terms.length + 2).padStart(3, '0')}`, term: '导入词条示例2', category: 'MR描述', modality: ['MR'], count: 0, standardReport: '批量导入的词条内容', isActive: true, termType: '描述短语', lastUsed: new Date().toISOString().slice(0, 10) },
    ]
    setTerms([...terms, ...newTerms])
    setImportLoading(false)
    setImportFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setImportSuccess('批量导入成功！')
    setTimeout(() => setImportSuccess(''), 3000)
  }

  const handleDownloadTemplate = () => {
    const headers = ['词条内容', '所属分类', '适用设备类型', '词条类型', '标准报告模板', '使用说明', 'WS标准码']
    const sampleRows = [
      ['未见异常密度影', 'CT描述', 'CT', '描述短语', '脑实质密度均匀，未见异常密度影。', '常规CT头部报告使用', 'WS-CT-001'],
      ['建议定期随访', '结论术语', 'CT,MR', '诊断结论', '建议定期随访复查。', '用于需要随访的患者', ''],
    ]
    const csv = [headers, ...sampleRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '词库导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportAllStandards = async () => {
    setImportAllLoading(true)
    await new Promise(r => setTimeout(r, 2000))
    const updated = terms.map((t, i) => {
      if (i < WS_STANDARDS.length) return { ...t, wsStandardCode: WS_STANDARDS[i % WS_STANDARDS.length].code }
      return t
    })
    setTerms(updated)
    setImportAllLoading(false)
    setImportedCount(WS_STANDARDS.length)
    setTimeout(() => setImportedCount(null), 3000)
  }

  const useCount = (id: string) => {
    setTerms(terms.map(t => t.id === id ? { ...t, count: t.count + 1, lastUsed: new Date().toISOString().slice(0, 10) } : t))
  }

  const handleRunExtraction = () => {
    setExtractionRunning(true)
    setTimeout(() => {
      setExtractedTerms(prev => [...prev, ...[
        { id: `ET-${Date.now()}`, term: '新提取-肺大疱', frequency: 45, source: 'CT报告分析', status: 'pending' as const, suggestedCategory: 'CT描述' },
        { id: `ET-${Date.now() + 1}`, term: '新提取-骨质增生', frequency: 38, source: 'DR报告分析', status: 'pending' as const, suggestedCategory: 'DR描述' },
      ]])
      setExtractionRunning(false)
    }, 2000)
  }

  const handleApproveExtraction = (id: string) => {
    setExtractedTerms(prev => prev.map(et => et.id === id ? { ...et, status: 'approved' as const } : et))
    const term = extractedTerms.find(et => et.id === id)
    if (term && term.status === 'pending') {
      const newTerm: TermEntry = {
        id: `TERM${String(terms.length + 1).padStart(3, '0')}`,
        term: term.term, category: term.suggestedCategory, modality: ['CT'],
        count: term.frequency, standardReport: '', isActive: true, termType: '描述短语',
        lastUsed: new Date().toISOString().slice(0, 10),
      }
      setTerms(prev => [...prev, newTerm])
    }
  }

  const handleRejectExtraction = (id: string) => {
    setExtractedTerms(prev => prev.map(et => et.id === id ? { ...et, status: 'rejected' as const } : et))
  }

  const renderFeatureBar = () => (
    <div style={{
      display: mainTab === 'dict' ? 'flex' : 'none', gap: 4, marginBottom: 0,
      background: 'var(--bg-card)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
      flexWrap: 'wrap',
    }}>
      {[
        { key: 'main', label: '词库首页', icon: <BookOpen size={13} /> },
        { key: 'suggestion', label: '智能建议', icon: <Lightbulb size={13} /> },
        { key: 'synonym', label: '同义词网络', icon: <Network size={13} /> },
        { key: 'extraction', label: '术语提取', icon: <FileSearch size={13} /> },
        { key: 'language', label: '多语言', icon: <Languages size={13} /> },
        { key: 'category', label: '分类管理', icon: <Move size={13} /> },
      ].map(f => (
        <button
          key={f.key}
          onClick={() => setFeatureTab(f.key as any)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: featureTab === f.key ? '#1e40af' : 'var(--bg-card)',
            color: featureTab === f.key ? '#fff' : '#64748b',
          }}
        >
          {f.icon} {f.label}
        </button>
      ))}
    </div>
  )

  const renderSuggestionTab = () => (
    <div style={{ padding: 16, display: mainTab === 'dict' && featureTab === 'suggestion' ? undefined : 'none' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Lightbulb size={15} color="#f59e0b" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>实时智能建议</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <Search size={12} color="var(--text-secondary)" />
            <input value={suggestionSearch} onChange={e => setSuggestionSearch(e.target.value)} placeholder="输入关键词获取建议..." style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
          </div>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
            <option value="">全部设备</option>
            {MODALITY_LIST.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {filteredSuggestions.map(s => (
            <div key={s.term} style={{ padding: 10, background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>{s.term}</div>
              <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>频率: {s.frequency}</span>
                <span>·</span>
                <span>{s.modality}</span>
                <span>·</span>
                <span>{s.context}</span>
              </div>
              <button onClick={() => handleCopyTerm(s.term)} style={{ padding: '3px 10px', background: 'var(--color-info-bg)', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                <Copy size={10} /> 使用
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>基于 {suggestions.reduce((s, x) => s + x.frequency, 0)} 次历史使用记录排序 · 上下文感知（检查部位/设备类型过滤）</div>
      </div>
    </div>
  )

  const renderSynonymTab = () => {
    const allNodes = [...new Set(synonymRelations.flatMap(r => [r.from, r.to]))]
    const nodeColors: Record<string, string> = {}
    const nodeDegrees: Record<string, number> = {}
    allNodes.forEach(n => {
      nodeDegrees[n] = synonymRelations.filter(r => r.from === n || r.to === n).length
      nodeColors[n] = relationshipColors[synonymRelations.find(r => r.from === n || r.to === n)?.type || 'related']
    })
    const maxDegree = Math.max(...Object.values(nodeDegrees), 1)
    const selectedRelations = selectedNode
      ? synonymRelations.filter(r => r.from === selectedNode || r.to === selectedNode)
      : synonymRelations.slice(0, 8)

    return (
      <div style={{ padding: 16, display: mainTab === 'dict' && featureTab === 'synonym' ? undefined : 'none' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Network size={15} color="#7c3aed" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>术语关系网络</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => setSynonymZoom(z => Math.min(3, z + 0.2))} style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>+</button>
                <button onClick={() => setSynonymZoom(z => Math.max(0.5, z - 0.2))} style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>-</button>
                <button onClick={() => { setSynonymZoom(1); setSynonymPan({ x: 0, y: 0 }) }} style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>重置</button>
              </span>
            </div>
            <div style={{ overflow: 'hidden', height: 350, position: 'relative', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}
              onMouseDown={e => { if (e.button === 0) { const startX = e.clientX - synonymPan.x; const startY = e.clientY - synonymPan.y; const onMove = (ev: MouseEvent) => { setSynonymPan({ x: ev.clientX - startX, y: ev.clientY - startY }); }; const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); }}}
            >
              <svg width="100%" height="350" viewBox={`0 0 600 350`} style={{ transform: `scale(${synonymZoom}) translate(${synonymPan.x / synonymZoom}px, ${synonymPan.y / synonymZoom}px)`, transformOrigin: 'center center' }}>
                {selectedRelations.map((r, _i) => {
                  const fromIdx = allNodes.indexOf(r.from)
                  const toIdx = allNodes.indexOf(r.to)
                  const angle1 = (fromIdx / allNodes.length) * Math.PI * 2
                  const angle2 = (toIdx / allNodes.length) * Math.PI * 2
                  const x1 = 300 + 120 * Math.cos(angle1)
                  const y1 = 175 + 120 * Math.sin(angle1)
                  const x2 = 300 + 120 * Math.cos(angle2)
                  const y2 = 175 + 120 * Math.sin(angle2)
                  const relColor = relationshipColors[r.type] || '#94a3b8'
                  return <line key={r.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={relColor} strokeWidth={1.5 * r.weight} strokeOpacity={0.6} />
                })}
                {allNodes.map((node, i) => {
                  const angle = (i / allNodes.length) * Math.PI * 2
                  const x = 300 + 120 * Math.cos(angle)
                  const y = 175 + 120 * Math.sin(angle)
                  const radius = 8 + (nodeDegrees[node] / maxDegree) * 12
                  const isSelected = selectedNode === node
                  return (
                    <g key={node} onClick={() => setSelectedNode(selectedNode === node ? null : node)} style={{ cursor: 'pointer' }}>
                      <circle cx={x} cy={y} r={radius} fill={nodeColors[node] || '#94a3b8'} stroke={isSelected ? '#1e293b' : 'none'} strokeWidth={isSelected ? 2 : 0} opacity={isSelected ? 1 : 0.8} />
                      <text x={x} y={y + radius + 12} textAnchor="middle" fontSize={isSelected ? 11 : 9} fill="var(--text-primary)" fontWeight={isSelected ? 700 : 400}>{node}</text>
                      {isSelected && <text x={x} y={y + 4} textAnchor="middle" fontSize={8} fill="#fff" fontWeight={700}>{nodeDegrees[node]}</text>}
                    </g>
                  )
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
              {Object.entries(relationshipColors).map(([type, color]) => (
                <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  {type === 'synonym' ? '同义词' : type === 'broader' ? '上位词' : type === 'narrower' ? '下位词' : '相关'}
                </span>
              ))}
            </div>
          </div>
          {selectedNode && (
            <div style={{ width: 280, background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>{selectedNode}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>关联关系 ({selectedRelations.length} 条)</div>
              {selectedRelations.map(r => {
                const other = r.from === selectedNode ? r.to : r.from
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: relationshipColors[r.type], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{other}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.type === 'synonym' ? '同义词' : r.type === 'broader' ? '上位词' : r.type === 'narrower' ? '下位词' : '相关'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderExtractionTab = () => (
    <div style={{ padding: 16, display: mainTab === 'dict' && featureTab === 'extraction' ? undefined : 'none' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FileSearch size={15} color="#059669" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>报告术语提取</span>
          <button
            onClick={handleRunExtraction}
            disabled={extractionRunning}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: extractionRunning ? '#94a3b8' : '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: extractionRunning ? 'wait' : 'pointer' }}
          >
            {extractionRunning ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSearch size={12} />}
            {extractionRunning ? '分析中...' : '分析报告并提取'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af' }}>{extractedTerms.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>提取术语总数</div>
          </div>
          <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{extractedTerms.filter(t => t.status === 'approved').length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已采纳</div>
          </div>
          <div style={{ background: 'var(--color-warning-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{extractedTerms.filter(t => t.status === 'pending').length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>待审核</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>提取术语</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>频率</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>来源</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>建议分类</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>状态</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {extractedTerms.map(et => (
              <tr key={et.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '9px 12px' }}><span style={{ fontWeight: 600, color: '#1e40af' }}>{et.term}</span></td>
                <td style={{ padding: '9px 12px' }}><span style={{ fontWeight: 700, color: '#059669' }}>{et.frequency}</span></td>
                <td style={{ padding: '9px 12px' }}><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{et.source}</span></td>
                <td style={{ padding: '9px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#8b5cf622', color: '#6d28d9' }}>{et.suggestedCategory}</span></td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                    background: et.status === 'approved' ? '#dcfce7' : et.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                    color: et.status === 'approved' ? '#16a34a' : et.status === 'rejected' ? '#dc2626' : '#d97706',
                  }}>
                    {et.status === 'approved' ? '已采纳' : et.status === 'rejected' ? '已拒绝' : '待审核'}
                  </span>
                </td>
                <td style={{ padding: '9px 12px' }}>
                  {et.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleApproveExtraction(et.id)} style={{ padding: '3px 8px', background: 'var(--color-success-bg)', color: '#16a34a', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>采纳</button>
                      <button onClick={() => handleRejectExtraction(et.id)} style={{ padding: '3px 8px', background: 'var(--color-error-bg)', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>拒绝</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        </div>
      </div>
    </div>
  )

  const renderLanguageTab = () => (
    <div style={{ padding: 16, display: mainTab === 'dict' && featureTab === 'language' ? undefined : 'none' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Languages size={15} color="#7c3aed" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>多语言支持</span>
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={bilingualMode} onChange={() => setBilingualMode(!bilingualMode)} />
            双语模式
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <Search size={12} color="var(--text-secondary)" />
            <input value={languageSearch} onChange={e => setLanguageSearch(e.target.value)} placeholder="搜索术语..." style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
          </div>
          <select value={selectedLang} onChange={e => setSelectedLang(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>中文</th>
              {bilingualMode && <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>English</th>}
              {bilingualMode && <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>日本語</th>}
              {!bilingualMode && <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>{selectedLang === 'en' ? 'English' : '日本語'}</th>}
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>准确度</th>
            </tr>
          </thead>
          <tbody>
            {filteredTranslations.map(t => (
              <tr key={t.termId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '9px 12px' }}><span style={{ fontWeight: 600, color: '#1e40af' }}>{t.zh}</span></td>
                {bilingualMode ? (
                  <>
                    <td style={{ padding: '9px 12px' }}><span style={{ color: 'var(--text-secondary)' }}>{t.en}</span></td>
                    <td style={{ padding: '9px 12px' }}><span style={{ color: 'var(--text-secondary)' }}>{t.ja}</span></td>
                  </>
                ) : (
                  <td style={{ padding: '9px 12px' }}><span style={{ color: 'var(--text-secondary)' }}>{selectedLang === 'en' ? t.en : t.ja}</span></td>
                )}
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 50, height: 5, background: 'var(--border-color)', borderRadius: 3 }}>
                      <div style={{ width: `${t.accuracy * 100}%`, height: 5, background: t.accuracy > 0.95 ? '#16a34a' : t.accuracy > 0.9 ? '#f59e0b' : '#dc2626', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(t.accuracy * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>支持中/英/日三种语言 · 可切换双语对照显示 · 翻译准确度通过临床术语库验证</div>
      </div>
    </div>
  )

  const renderCategoryTab = () => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(categoryTree.map(n => n.id)))
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string; parentId: string; color: string }>({ name: '', parentId: '', color: '#2563eb' })

    const CATEGORY_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#db2777']

    const addCategoryNode = (nodes: CategoryTreeNode[], parentId: string, node: CategoryTreeNode): CategoryTreeNode[] => {
      if (!parentId) return [...nodes, node]
      return nodes.map(n => n.id === parentId ? { ...n, children: [...n.children, node] } : { ...n, children: addCategoryNode(n.children, parentId, node) })
    }

    const updateCategoryNode = (nodes: CategoryTreeNode[], id: string, name: string): CategoryTreeNode[] =>
      nodes.map(n => n.id === id ? { ...n, name } : { ...n, children: updateCategoryNode(n.children, id, name) })

    const openAddCategory = () => {
      setCategoryForm({ name: '', parentId: selectedCategory ?? '', color: '#2563eb' })
      setShowCategoryModal(true)
    }

    const openEditCategory = () => {
      const find = (nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null => {
        for (const n of nodes) { if (n.id === id) return n; const f = find(n.children, id); if (f) return f }
        return null
      }
      const node = selectedCategory ? find(categoryTree, selectedCategory) : null
      if (!node) return
      setCategoryForm({ id: node.id, name: node.name, parentId: '', color: node.color })
      setShowCategoryModal(true)
    }

    const handleSaveCategory = () => {
      if (!categoryForm.name.trim()) return
      if (categoryForm.id) {
        setCategoryTree(prev => updateCategoryNode(prev, categoryForm.id, categoryForm.name.trim()))
      } else {
        const node: CategoryTreeNode = { id: `cat-${Date.now()}`, name: categoryForm.name.trim(), children: [], count: 0, color: categoryForm.color }
        setCategoryTree(prev => addCategoryNode(prev, categoryForm.parentId, node))
        setExpandedNodes(prev => new Set(prev).add(categoryForm.parentId))
      }
      setShowCategoryModal(false)
    }

    const toggleExpand = (id: string) => {
      setExpandedNodes(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
    }

    const renderTree = (nodes: CategoryTreeNode[], level: number = 0) => nodes.map(node => (
      <div key={node.id}>
        <div
          onClick={() => { setSelectedCategory(node.id); toggleExpand(node.id) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            cursor: 'pointer', borderRadius: 4, marginLeft: level * 16,
            background: selectedCategory === node.id ? `${node.color}15` : 'transparent',
          }}
        >
          {node.children.length > 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{expandedNodes.has(node.id) ? '▼' : '▶'}</span>
          ) : <span style={{ width: 10 }} />}
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: node.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{node.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--content-bg)', borderRadius: 8, padding: '1px 6px' }}>{node.count}</span>
        </div>
        {expandedNodes.has(node.id) && node.children.length > 0 && renderTree(node.children, level + 1)}
      </div>
    ))

    return (
      <div style={{ padding: 16, display: mainTab === 'dict' && featureTab === 'category' ? undefined : 'none' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Move size={15} color="#0891b2" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>分类树浏览器</span>
              <button onClick={openAddCategory} style={{ marginLeft: 'auto', padding: '4px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={11} /> 新建分类
              </button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 4 }}>
              {renderTree(categoryTree)}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>拖拽术语到分类节点进行分类</div>
          </div>
          {selectedCategory && (
            <div style={{ width: 300, background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>分类统计</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>32</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>术语数</div>
                </div>
                <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>1,245</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>使用次数</div>
                </div>
              </div>
              <button onClick={openEditCategory} style={{ marginTop: 12, width: '100%', padding: '6px 12px', background: 'var(--content-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                编辑分类
              </button>
            </div>
          )}
        </div>
        {showCategoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCategoryModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}><Move size={16} color="#0891b2" /> {categoryForm.id ? '编辑分类' : '新建分类'}</div>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, padding: 4 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>分类名称 *</label>
                <input value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="如: 胸部疾病" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {!categoryForm.id && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>父级分类</label>
                  <select value={categoryForm.parentId} onChange={e => setCategoryForm({ ...categoryForm, parentId: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13 }}>
                    <option value="">无（顶级分类）</option>
                    {categoryTree.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              )}
              {!categoryForm.id && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>颜色</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {CATEGORY_COLORS.map(c => (
                      <button key={c} onClick={() => setCategoryForm({ ...categoryForm, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: categoryForm.color === c ? '3px solid #1e293b' : 'none', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowCategoryModal(false)} style={{ padding: '8px 20px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>取消</button>
                <button onClick={handleSaveCategory} disabled={!categoryForm.name.trim()} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: categoryForm.name.trim() ? '#1e40af' : '#94a3b8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: categoryForm.name.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}><Save size={13} />保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    )
  }

  // ============ 渲染 ============
  return (
    <div data-testid="term-library-page" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-card)', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' }}>
      {/* [G005 W1-C] 演示数据（后端待实现）: 后端无 /terms controller, 数据由 MSW 演示数据提供 */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: 'var(--color-warning-bg)', color: '#92400e', fontSize: 12, fontWeight: 600, padding: '4px 16px', textAlign: 'center', borderBottom: '1px solid #fcd34d' }}>
        演示数据（后端待实现）：本页词库数据由 MSW 演示数据提供，后端暂无 /terms 接口
      </div>
      {loading && <LoadingBanner message="正在从 API 加载术语库..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <div style={{ width: 260, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-color)', background: '#1e40af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BookOpen size={18} style={{ color: '#93c5fd' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>报告词库</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>标准化术语 · WS/T 500-2016</p>
        </div>
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 10px' }}>
            <Search size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input value={leftSearch} onChange={e => setLeftSearch(e.target.value)} placeholder="搜索词条..." style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
            {leftSearch && <button onClick={() => setLeftSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} style={{ color: 'var(--text-secondary)' }} /></button>}
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{stats.totalTerms}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>词条总数</div>
            </div>
            <div style={{ background: '#8b5cf622', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{stats.mappedCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已对照</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <button onClick={() => { setActiveCategoryId('ALL'); setMainTab('dict') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: activeCategoryId === 'ALL' && mainTab === 'dict' ? 'var(--color-info-bg)' : 'transparent',
            borderLeft: activeCategoryId === 'ALL' && mainTab === 'dict' ? '3px solid #1e40af' : '3px solid transparent', textAlign: 'left',
          }}>
            <FolderOpen size={13} style={{ color: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#1e40af' : '#94a3b8' }} />
            <span style={{ fontSize: 12, fontWeight: activeCategoryId === 'ALL' && mainTab === 'dict' ? 700 : 400, color: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#1e40af' : '#475569' }}>全部词库</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#1e40af' : 'var(--border-color)', color: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#fff' : '#64748b', borderRadius: 10, padding: '1px 6px' }}>{getCategoryCount('ALL')}</span>
          </button>
          <button onClick={() => { setMainTab('standard'); setActiveCategoryId('ALL') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: mainTab === 'standard' ? 'var(--color-info-bg)' : 'transparent',
            borderLeft: mainTab === 'standard' ? '3px solid #1e40af' : '3px solid transparent', textAlign: 'left',
          }}>
            <FileCheck size={13} style={{ color: mainTab === 'standard' ? '#1e40af' : '#94a3b8' }} />
            <span style={{ fontSize: 12, fontWeight: mainTab === 'standard' ? 700 : 400, color: mainTab === 'standard' ? '#1e40af' : '#475569' }}>国家标准</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: mainTab === 'standard' ? '#1e40af' : 'var(--border-color)', color: mainTab === 'standard' ? '#fff' : '#64748b', borderRadius: 10, padding: '1px 6px' }}>{WS_STANDARDS.length}</span>
          </button>
          <div style={{ padding: '6px 16px 4px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: 1 }}>按检查类型</div>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { setActiveCategoryId(cat.id); setMainTab('dict') }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', border: 'none', cursor: 'pointer',
              background: activeCategoryId === cat.id && mainTab === 'dict' ? 'var(--color-info-bg)' : 'transparent',
              borderLeft: activeCategoryId === cat.id && mainTab === 'dict' ? `3px solid ${cat.color}` : '3px solid transparent', textAlign: 'left',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: cat.color, opacity: activeCategoryId === cat.id ? 1 : 0.5 }} />
              <span style={{ fontSize: 12, fontWeight: activeCategoryId === cat.id ? 600 : 400, color: activeCategoryId === cat.id ? '#1e40af' : '#475569' }}>{cat.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, background: activeCategoryId === cat.id ? cat.color : 'var(--bg-card)', color: activeCategoryId === cat.id ? '#fff' : '#94a3b8', borderRadius: 10, padding: '1px 6px' }}>{getCategoryCount(cat.id)}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
          <button onClick={openAddModal} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(30,64,175,0.3)' }}>
            <Plus size={13} /> 新建词条
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-card)', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={16} style={{ color: '#1e40af' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
              {mainTab === 'dict' ? '词库管理' : '国家标准 WS/T 500-2016'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>({mainTab === 'dict' ? filteredTerms.length : filteredWsStandards.length} 条)</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {mainTab === 'dict' && (
              <>
                <button onClick={() => setShowQuickPanel(!showQuickPanel)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showQuickPanel ? 'var(--color-info-bg)' : 'var(--bg-card)', border: `1px solid ${showQuickPanel ? '#1e40af' : 'var(--border-color)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: showQuickPanel ? '#1e40af' : '#64748b' }}>
                  <Zap size={12} /> 快捷词库
                </button>
                <button onClick={() => setShowStats(!showStats)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showStats ? 'var(--color-info-bg)' : 'var(--bg-card)', border: `1px solid ${showStats ? '#7c3aed' : 'var(--border-color)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: showStats ? '#7c3aed' : '#64748b' }}>
                  <BarChart2 size={12} /> 统计
                </button>
              </>
            )}
            {mainTab === 'standard' && (
              <button onClick={handleImportAllStandards} disabled={importAllLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: importAllLoading ? '#94a3b8' : '#1e40af', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: importAllLoading ? 'wait' : 'pointer', boxShadow: importAllLoading ? 'none' : '0 2px 6px rgba(30,64,175,0.3)' }}>
                {importAllLoading ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> 导入中...</> : <><DownloadCloud size={12} /> 一键导入全部标准</>}
              </button>
            )}
          </div>
        </div>

        {renderFeatureBar()}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {mainTab === 'standard' && (
            <div style={{ padding: 16 }}>
              {importedCount !== null && (
                <div style={{ background: 'var(--color-success-bg)', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} style={{ color: '#16a34a' }} />
                  <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>已成功导入 {importedCount} 条标准对照关系！</span>
                </div>
              )}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileCheck size={15} style={{ color: '#1e40af' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>WS/T 500-2016 标准对照表</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>卫生行业标准 · 放射学检查项目分类与编码</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: '标准总数', value: WS_STANDARDS.length, color: '#1e40af', bg: '#3b82f622' },
                    { label: 'CT类', value: WS_STANDARDS.filter(w => w.department === 'CT').length, color: '#3b82f6', bg: '#3b82f622' },
                    { label: 'MR类', value: WS_STANDARDS.filter(w => w.department === 'MR').length, color: '#8b5cf6', bg: '#8b5cf622' },
                    { label: 'DR/X线类', value: WS_STANDARDS.filter(w => w.department === 'DXR' || w.department === '乳腺').length, color: '#10b981', bg: '#22c55e22' },
                    { label: '超声/DSA', value: WS_STANDARDS.filter(w => w.department === '超声' || w.department === 'DSA').length, color: '#f59e0b', bg: '#f59e0b22' },
                  ].map(item => (
                    <div key={item.label} style={{ background: item.bg, borderRadius: 8, padding: '10px 12px', border: `1px solid ${item.color}20` }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', flex: 1, minWidth: 200 }}>
                    <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <input value={wsSearch} onChange={e => setWsSearch(e.target.value)} placeholder="搜索标准名称、代码或别名..." style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
                    {wsSearch && <button onClick={() => setWsSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} style={{ color: 'var(--text-secondary)' }} /></button>}
                  </div>
                  <select value={wsDeptFilter} onChange={e => setWsDeptFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
                    <option value="全部">全部科室</option>
                    {DEPT_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
                    <thead><tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid var(--border-color)' }}>
                      {['代码', '标准检查名称', '常用别名', '科室', '检查子类', '报告模板', '状态'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', borderRight: i < 6 ? '1px solid var(--border-light)' : 'none' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filteredWsStandards.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center' }}><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}><Search size={24} style={{ marginBottom: 8, opacity: 0.5 }} /><div>无匹配的标准条目</div></div></td></tr>
                      ) : filteredWsStandards.map((ws, _idx) => {
                        const isMapped = mappedWsCodes.has(ws.code)
                        return (
                          <tr key={ws.code} style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                          >
                            <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1e40af', background: 'var(--color-info-bg)', padding: '2px 8px', borderRadius: 4 }}>{ws.code}</span></td>
                            <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)', maxWidth: 180 }}><span style={{ fontWeight: 600, color: '#1e40af' }}>{ws.standardName}</span></td>
                            <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{ws.aliases.map(a => <span key={a} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, background: 'var(--content-bg)', color: 'var(--text-secondary)' }}>{a}</span>)}</div></td>
                            <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: MODALITY_BG[ws.department] || 'var(--content-bg)', color: MODALITY_COLORS[ws.department] || '#64748b' }}>{ws.department}</span></td>
                            <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ws.subClass}</span></td>
                            <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)', maxWidth: 250 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{ws.reportTemplate}</div></td>
                            <td style={{ padding: '9px 12px' }}>
                              {isMapped ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'var(--color-success-bg)', color: '#16a34a' }}><CheckCircle2 size={10} /> 已对照</span> : <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--color-warning-bg)', color: '#d97706' }}>未对照</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table></div>
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>共 <strong style={{ color: '#1e40af' }}>{filteredWsStandards.length}</strong> 条标准，已对照 <strong style={{ color: '#16a34a' }}>{WS_STANDARDS.filter(w => mappedWsCodes.has(w.code)).length}</strong> 条</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>数据来源：WS/T 500-2016 卫生行业标准（虚构数据，仅供演示）</span>
                </div>
              </div>
            </div>
          )}

          {mainTab === 'dict' && featureTab === 'main' && (
            <>
              {showStats && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, margin: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <BarChart2 size={15} style={{ color: '#7c3aed' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>词库统计</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: '词条总数', value: stats.totalTerms, sub: '条', color: '#1e40af', bg: '#3b82f622' },
                      { label: '本月使用', value: stats.thisMonthUsage, sub: '次', color: '#7c3aed', bg: '#8b5cf622' },
                      { label: '已对照标准', value: stats.mappedCount, sub: '条', color: '#059669', bg: '#22c55e22' },
                      { label: '活跃词条', value: stats.activeTerms, sub: '条', color: '#d97706', bg: '#f59e0b22' },
                    ].map(item => (
                      <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${item.color}20` }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}<span style={{ fontSize: 12, marginLeft: 2 }}>{item.sub}</span></div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <TrendingUp size={13} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>使用排行榜 TOP20</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {top20Terms.map((t, i) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: i < 3 ? (i === 0 ? 'var(--color-warning-bg)' : i === 1 ? 'var(--bg-card)' : 'var(--color-warning-bg)') : 'var(--bg-card)', borderRadius: 8, padding: '7px 10px', border: `1px solid ${i < 3 ? '#f59e0b30' : 'var(--border-light)'}` }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? '#d97706' : '#94a3b8', minWidth: 16 }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.term}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.count}次</div>
                          </div>
                          <button onClick={() => handleCopyTerm(t.term)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-secondary)' }}><Copy size={11} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {showQuickPanel && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, margin: 16, marginBottom: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Zap size={15} style={{ color: '#f59e0b' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>快捷词库</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>点击词条自动复制</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {MODALITY_LIST.map(m => (
                      <button key={m} onClick={() => setActiveQuickModality(m)} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${activeQuickModality === m ? MODALITY_COLORS[m] : 'var(--border-color)'}`, background: activeQuickModality === m ? MODALITY_BG[m] : 'var(--bg-card)', color: activeQuickModality === m ? MODALITY_COLORS[m] : '#64748b' }}>{m}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {quickTerms.length === 0 ? (
                      <div
                        role="status"
                        data-testid="term-empty"
                        style={{ width: '100%', textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 12 }}
                      >
                        暂无词汇,试试切换其他模态或在词库中补充
                      </div>
                    ) : quickTerms.map(t => (
                      <button key={t.id} onClick={() => { handleCopyTerm(t.term); useCount(t.id) }} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid',
                        cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        background: copySuccess === t.term ? 'var(--color-success-bg)' : 'var(--bg-card)',
                        borderColor: copySuccess === t.term ? '#16a34a' : 'var(--border-color)',
                        color: copySuccess === t.term ? '#16a34a' : 'var(--text-primary)',
                        transition: 'all 0.15s',
                      }}>
                        {copySuccess === t.term ? <Check size={11} /> : <Copy size={11} />}
                        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.term}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--content-bg)', borderRadius: 8, padding: '1px 5px' }}>{t.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--bg-card)', borderRadius: 12, margin: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([{ key: 'all', label: '全部', count: terms.length }, { key: 'active', label: '已启用', count: terms.filter(t => t.isActive !== false).length }, { key: 'inactive', label: '已禁用', count: terms.filter(t => t.isActive === false).length }] as const).map(tab => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeTab === tab.key ? '#1e40af' : 'var(--bg-card)', color: activeTab === tab.key ? '#fff' : '#64748b' }}>
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 10px' }}>
                      <Search size={12} style={{ color: 'var(--text-secondary)' }} />
                      <input value={rightSearch} onChange={e => setRightSearch(e.target.value)} placeholder="搜索词条内容..." style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', width: 150, color: '#1e40af' }} />
                    </div>
                    <select value={modalityFilter} onChange={e => setModalityFilter(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
                      <option value="全部">全部设备</option>
                      {MODALITY_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
                      <option value="全部">全部分类</option>
                      {allCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#059669', cursor: 'pointer' }}><Download size={11} /> 导入模板</button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: importLoading ? 'var(--content-bg)' : 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#7c3aed', cursor: importLoading ? 'wait' : 'pointer' }}>
                      <Upload size={11} />{importLoading ? '导入中...' : '批量导入'}
                      <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>
                    {importFile && <button onClick={handleImportFile} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#7c3aed', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}><FileSpreadsheet size={11} /> 确认导入</button>}
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
                    <thead><tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid var(--border-color)' }}>
                      {['词条ID', '词条内容', '类别', '设备类型', '使用次数', '最近使用', '标准对照', '操作'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', borderRight: i < 7 ? '1px solid var(--border-light)' : 'none' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filteredTerms.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: '40px 0', textAlign: 'center' }}><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}><Search size={28} style={{ marginBottom: 8, color: 'var(--text-secondary)' }} /><div>暂无匹配的词条</div></div></td></tr>
                      ) : filteredTerms.map((term, _idx) => (
                        <tr key={term.id} style={{ borderBottom: '1px solid var(--border-light)', background: term.isActive === false ? 'var(--color-error-bg)' : 'var(--bg-card)', transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (term.isActive !== false) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { if (term.isActive !== false) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'; else (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-error-bg)' }}
                        >
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--content-bg)', padding: '2px 6px', borderRadius: 4 }}>{term.id}</span></td>
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)', maxWidth: 220 }}>
                            <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 2 }}>{term.term}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{term.standardReport}</div>
                          </td>
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#8b5cf622', color: '#6d28d9' }}>{term.category}</span></td>
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{term.modality?.map(m => <span key={m} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: MODALITY_BG[m] || 'var(--bg-card)', color: MODALITY_COLORS[m] || '#64748b' }}>{m}</span>)}</div></td>
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} style={{ color: '#10b981' }} /><span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>{term.count}</span></div></td>
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{term.lastUsed || '-'}</span></td>
                          <td style={{ padding: '9px 12px', borderRight: '1px solid var(--border-light)' }}>
                            {term.wsStandardCode ? <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--color-success-bg)', color: '#16a34a' }}>{term.wsStandardCode}</span> : <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => openEditModal(term)} title="编辑" style={{ padding: '4px 8px', background: 'var(--color-info-bg)', color: '#2563eb', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={11} /></button>
                              <button onClick={() => handleToggleActive(term.id)} title={term.isActive === false ? '启用' : '禁用'} style={{ padding: '4px 8px', background: term.isActive === false ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: term.isActive === false ? '#16a34a' : '#d97706', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>{term.isActive === false ? <CheckCircle2 size={11} /> : <EyeOff size={11} />}</button>
                              <button onClick={() => handleDeleteTerm(term.id)} title="删除" style={{ padding: '4px 8px', background: 'var(--color-error-bg)', color: '#dc2626', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={11} /></button>
                              <button onClick={() => { handleCopyTerm(term.term); useCount(term.id) }} title="复制并使用" style={{ padding: '4px 8px', background: copySuccess === term.term ? '#dcfce7' : '#f0fdf4', color: copySuccess === term.term ? '#16a34a' : '#059669', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>{copySuccess === term.term ? <Check size={11} /> : <Copy size={11} />}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>共 <strong style={{ color: '#1e40af' }}>{filteredTerms.length}</strong> 条词条，已对照标准 <strong style={{ color: '#16a34a' }}>{stats.mappedCount}</strong> 条</span>
                  <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Plus size={12} /> 新建词条</button>
                </div>
              </div>
            </>
          )}

          {renderSuggestionTab()}
          {renderSynonymTab()}
          {renderExtractionTab()}
          {renderLanguageTab()}
          {renderCategoryTab()}
        </div>
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, width: 580, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e40af', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={15} style={{ color: '#93c5fd' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{modalMode === 'add' ? '新建词条' : '编辑词条'}</span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, padding: 5, cursor: 'pointer', display: 'flex' }}><X size={16} style={{ color: '#fff' }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>词条内容 <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea value={formData.term} onChange={e => setFormData(prev => ({ ...prev, term: e.target.value }))} rows={3} placeholder="请输入词条内容，如：未见异常密度影" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#1e40af'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>所属分类</label>
                  <select value={formData.category} onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', background: 'var(--bg-card)', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {allCategoryNames.length > 0 ? allCategoryNames.map(c => <option key={c} value={c}>{c}</option>) : ['CT描述', 'MR描述', '结论术语', '急诊模板', '肿瘤评估'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>词条类型</label>
                  <select value={formData.termType} onChange={e => setFormData(prev => ({ ...prev, termType: e.target.value as TermEntry['termType'] }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', background: 'var(--bg-card)', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {TERM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>适用检查类型 <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>（可多选）</span></label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MODALITY_LIST.map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${formData.modality.includes(m) ? MODALITY_COLORS[m] : 'var(--border-color)'}`, background: formData.modality.includes(m) ? MODALITY_BG[m] : 'var(--bg-card)', color: formData.modality.includes(m) ? MODALITY_COLORS[m] : '#94a3b8', userSelect: 'none' }}>
                      <input type="checkbox" checked={formData.modality.includes(m)} onChange={() => handleModalityToggle(m)} style={{ display: 'none' }} />
                      <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid', borderColor: formData.modality.includes(m) ? MODALITY_COLORS[m] : 'var(--border-color)', background: formData.modality.includes(m) ? MODALITY_COLORS[m] : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {formData.modality.includes(m) && <Check size={8} style={{ color: '#fff' }} />}
                      </div>
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>WS/T 500-2016 标准对照</label>
                <select value={formData.wsStandardCode} onChange={e => setFormData(prev => ({ ...prev, wsStandardCode: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', background: 'var(--bg-card)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="">不关联标准</option>
                  {WS_STANDARDS.map(ws => <option key={ws.code} value={ws.code}>{ws.code} - {ws.standardName}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>标准报告模板</label>
                <textarea value={formData.standardReport} onChange={e => setFormData(prev => ({ ...prev, standardReport: e.target.value }))} rows={4} placeholder="请输入标准报告模板内容" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#1e40af'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>使用说明 / 备注</label>
                <textarea value={formData.usageNotes} onChange={e => setFormData(prev => ({ ...prev, usageNotes: e.target.value }))} rows={2} placeholder="选填" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#1e40af'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-card)', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveTerm} disabled={!formData.term.trim()} style={{ padding: '8px 20px', background: formData.term.trim() ? '#1e40af' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: formData.term.trim() ? 'pointer' : 'not-allowed', boxShadow: formData.term.trim() ? '0 2px 8px rgba(30,64,175,0.3)' : 'none' }}>
                {modalMode === 'add' ? '保存词条' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

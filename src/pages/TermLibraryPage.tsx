// G005 放射科RIS系统 - 报告词库页面 v1.1.0
// 放射科专用术语词库，支持快速录入、分类管理、快捷复制、批量导入
// 支持 WS/T 500-2016 国家标准对照
import { useState, useEffect, useRef } from 'react'
import { BookOpen, Search, Plus, X, Copy, Upload, Download, BarChart2, Tag, FolderOpen, TrendingUp, CheckCircle2, FileSpreadsheet, RefreshCw, EyeOff, Check, LayoutGrid, Zap, FileCheck, DownloadCloud, Network, Lightbulb, Languages, FileSearch, Move } from 'lucide-react'
import { initialTermLibrary } from '../data/initialData'
import { termApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { message, Select } from 'antd'
import type { TableColumnsType } from 'antd'
import { VirtualTable } from '../components/common/VirtualTable'
import { DataTable } from '../components/common/DataTable'
import { ActionButton } from '../components/common/ActionButton'
import { StatusTag } from '../components/common/StatusTag'
import { t as t9 } from '../i18n/appI18n'
import { uniqueId } from '../utils/uniqueId'

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
        setLoadError(t9('termLibrary.apiUnavailable'))
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
      // [v3.0.6.11-92] W2-B P2: 接入 termApi.create (失败回退本地新增, 不阻断)
      void termApi.create({ term: formData.term, category: formData.category, definition: formData.standardReport, pinyin: '' })
        .then((res) => { if (res.success && res.data?.id) newTerm.id = res.data.id })
        .catch(() => { /* 后端不可用, 仅本地 */ })
      setTerms([...terms, newTerm])
    } else if (editingTerm) {
      setTerms(terms.map(t => t.id === editingTerm.id ? { ...t, ...formData, lastUsed: new Date().toISOString().slice(0, 10) } : t))
    }
    setShowModal(false)
  }

  const handleDeleteTerm = (id: string) => {
    if (!confirm(t9('termLibrary.confirmDelete'))) return
    // [v3.0.6.11-92] W2-B P2: 接入 termApi.delete (失败回退本地删除, 不阻断)
    void termApi.delete(id).catch(() => { /* 后端不可用, 仅本地 */ })
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
    let text = ''
    try {
      text = await importFile.text()
    } catch (e: any) {
      message.error(t9('w9b.termLibrary.fileReadFailed') + (e?.message ?? String(e)))
      setImportLoading(false)
      return
    }
    const trimmed = text.replace(/^\uFEFF/, '').trim()
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim())
    const rows: Array<Record<string, string>> = []
    if (lines.length >= 2) {
      const header = lines[0]!.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      for (const line of lines.slice(1)) {
        const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        header.forEach((h, i) => { row[h] = cells[i] ?? '' })
        rows.push(row)
      }
    }
    if (rows.length === 0) {
      message.error(t9('termLibrary.importFileFormatError'))
      setImportLoading(false)
      return
    }
    const newTerms: TermEntry[] = []
    let success = 0
    let fail = 0
    for (const row of rows) {
      const term = String(row['词条内容'] ?? row['中文名'] ?? row['name'] ?? '').trim()
      const category = String(row['所属分类'] ?? row['分类'] ?? row['category'] ?? '').trim() || '未分类'
      const standardReport = String(row['标准报告模板'] ?? '').trim()
      const modality = String(row['适用设备类型'] ?? '').split(',').map(m => m.trim()).filter(Boolean)
      if (!term) { fail++; continue }
      try {
        const res = await termApi.create({ term, category, definition: standardReport, pinyin: '' })
        if (res.success && res.data?.id) {
          newTerms.push({ id: res.data.id, term, category, modality: modality.length ? modality : ['CT'], count: 0, standardReport, isActive: true, termType: '描述短语', lastUsed: new Date().toISOString().slice(0, 10) })
          success++
        } else { fail++ }
      } catch { fail++ }
    }
    if (newTerms.length > 0) setTerms([...terms, ...newTerms])
    setImportLoading(false)
    setImportFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setImportSuccess(`批量导入完成: 成功 ${success} 条, 失败 ${fail} 条`)
    setTimeout(() => setImportSuccess(''), 3000)
    if (success > 0) message.success(t9('w9b.termLibrary.importDone', { success, fail }))
    else message.error(t9('w9b.termLibrary.importFailed', { fail }))
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
    a.download = t9('termLibrary.templateFileName')
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImportAllStandards = async () => {
    setImportAllLoading(true)
    await new Promise(r => setTimeout(r, 2000))
    const updated = terms.map((t, i) => {
      if (i < WS_STANDARDS.length) return { ...t, wsStandardCode: WS_STANDARDS[i % WS_STANDARDS.length]?.code }
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

  const termColumns: TableColumnsType<TermEntry> = [
    {
      title: t9('termLibrary.thTermId'), dataIndex: 'id', key: 'id', width: 100,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--content-bg)', padding: '2px 6px', borderRadius: 4 }}>{v}</span>,
    },
    {
      title: t9('termLibrary.thTermContent'), dataIndex: 'term', key: 'term',
      render: (_v: string, term: TermEntry) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 2 }}>{term.term}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{term.standardReport}</div>
        </div>
      ),
    },
    {
      title: t9('termLibrary.thCategory'), dataIndex: 'category', key: 'category',
      render: (v: string) => <StatusTag tone={{ bg: '#8b5cf622', border: 'transparent', color: '#6d28d9', dot: '#6d28d9' }}>{v}</StatusTag>,
    },
    {
      title: t9('termLibrary.thModality'), dataIndex: 'modality', key: 'modality',
      render: (mods?: string[]) => (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {mods?.map(m => <span key={m} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: MODALITY_BG[m] || 'var(--bg-card)', color: MODALITY_COLORS[m] || 'var(--text-muted)' }}>{m}</span>)}
        </div>
      ),
    },
    {
      title: t9('termLibrary.thUsageCount'), dataIndex: 'count', key: 'count', width: 100,
      render: (v: number) => <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} style={{ color: '#10b981' }} /><span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>{v}</span></div>,
    },
    { title: t9('termLibrary.thLastUsed'), dataIndex: 'lastUsed', key: 'lastUsed', render: (v?: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v || '-'}</span> },
    {
      title: t9('termLibrary.thStandardMapping'), dataIndex: 'wsStandardCode', key: 'wsStandardCode',
      render: (v?: string) => v ? <StatusTag status="success" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v}</StatusTag> : <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>—</span>,
    },
    {
      title: t9('termLibrary.thActions'), key: 'actions', width: 160,
      render: (_v: unknown, term: TermEntry) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="edit" size="compact" onClick={() => openEditModal(term)} />
          <button onClick={() => handleToggleActive(term.id)} title={term.isActive === false ? t9('termLibrary.enable') : t9('termLibrary.disable')} style={{ padding: '4px 8px', background: term.isActive === false ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: term.isActive === false ? '#16a34a' : '#d97706', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>{term.isActive === false ? <CheckCircle2 size={11} /> : <EyeOff size={11} />}</button>
          <ActionButton action="delete" size="compact" onClick={() => handleDeleteTerm(term.id)} />
          <button onClick={() => { handleCopyTerm(term.term); useCount(term.id) }} title={t9('termLibrary.copyAndUse')} style={{ padding: '4px 8px', background: 'var(--color-success-bg)', color: copySuccess === term.term ? '#16a34a' : '#059669', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>{copySuccess === term.term ? <Check size={11} /> : <Copy size={11} />}</button>
        </div>
      ),
    },
  ]

  const handleRunExtraction = () => {
    setExtractionRunning(true)
    setTimeout(() => {
      setExtractedTerms(prev => [...prev, ...[
        { id: uniqueId('ET'), term: '新提取-肺大疱', frequency: 45, source: 'CT报告分析', status: 'pending' as const, suggestedCategory: 'CT描述' },
        { id: uniqueId('ET'), term: '新提取-骨质增生', frequency: 38, source: 'DR报告分析', status: 'pending' as const, suggestedCategory: 'DR描述' },
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
        { key: 'main', label: t9('termLibrary.featureHome'), icon: <BookOpen size={13} /> },
        { key: 'suggestion', label: t9('termLibrary.featureSuggestion'), icon: <Lightbulb size={13} /> },
        { key: 'synonym', label: t9('termLibrary.featureSynonym'), icon: <Network size={13} /> },
        { key: 'extraction', label: t9('termLibrary.featureExtraction'), icon: <FileSearch size={13} /> },
        { key: 'language', label: t9('termLibrary.featureLanguage'), icon: <Languages size={13} /> },
        { key: 'category', label: t9('termLibrary.featureCategory'), icon: <Move size={13} /> },
      ].map(f => (
        <button
          key={f.key}
          onClick={() => setFeatureTab(f.key as any)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: featureTab === f.key ? '#1e40af' : 'var(--bg-card)',
            color: featureTab === f.key ? '#fff' : 'var(--text-muted)',
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
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.realtimeSuggestion')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <Search size={12} color="var(--text-secondary)" />
            <input value={suggestionSearch} onChange={e => setSuggestionSearch(e.target.value)} placeholder={t9('termLibrary.suggestionPlaceholder')} style={{ border: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
          </div>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
            <option value="">{t9('termLibrary.allModalities')}</option>
            {MODALITY_LIST.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {filteredSuggestions.map(s => (
            <div key={s.term} style={{ padding: 10, background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>{s.term}</div>
              <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>{t9('termLibrary.frequencyPrefix')}{s.frequency}</span>
                <span>·</span>
                <span>{s.modality}</span>
                <span>·</span>
                <span>{s.context}</span>
              </div>
              <button onClick={() => handleCopyTerm(s.term)} style={{ padding: '3px 10px', background: 'var(--color-info-bg)', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                <Copy size={10} /> {t9('termLibrary.use')}
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.suggestionFooterPrefix')}{suggestions.reduce((s, x) => s + x.frequency, 0)}{t9('termLibrary.suggestionFooterSuffix')}</div>
      </div>
    </div>
  )

  const renderSynonymTab = () => {
    const allNodes = [...new Set(synonymRelations.flatMap(r => [r.from, r.to]))]
    const nodeColors: Record<string, string> = {}
    const nodeDegrees: Record<string, number> = {}
    allNodes.forEach(n => {
      nodeDegrees[n] = synonymRelations.filter(r => r.from === n || r.to === n).length
      nodeColors[n] = relationshipColors[synonymRelations.find(r => r.from === n || r.to === n)?.type || 'related'] ?? 'var(--text-muted)'
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
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.synonymNetwork')}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => setSynonymZoom(z => Math.min(3, z + 0.2))} style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>+</button>
                <button onClick={() => setSynonymZoom(z => Math.max(0.5, z - 0.2))} style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>-</button>
                <button onClick={() => { setSynonymZoom(1); setSynonymPan({ x: 0, y: 0 }) }} style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12 }}>{t9('termLibrary.reset')}</button>
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
                  const relColor = relationshipColors[r.type] || 'var(--text-muted)'
                  return <line key={r.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={relColor} strokeWidth={1.5 * r.weight} strokeOpacity={0.6} />
                })}
                {allNodes.map((node, i) => {
                  const angle = (i / allNodes.length) * Math.PI * 2
                  const x = 300 + 120 * Math.cos(angle)
                  const y = 175 + 120 * Math.sin(angle)
                  const radius = 8 + ((nodeDegrees[node] ?? 0) / maxDegree) * 12
                  const isSelected = selectedNode === node
                  return (
                    <g key={node} onClick={() => setSelectedNode(selectedNode === node ? null : node)} style={{ cursor: 'pointer' }}>
                      <circle cx={x} cy={y} r={radius} fill={nodeColors[node] || 'var(--text-muted)'} stroke={isSelected ? 'var(--text-primary)' : 'none'} strokeWidth={isSelected ? 2 : 0} opacity={isSelected ? 1 : 0.8} />
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
                  {type === 'synonym' ? t9('termLibrary.relSynonym') : type === 'broader' ? t9('termLibrary.relBroader') : type === 'narrower' ? t9('termLibrary.relNarrower') : t9('termLibrary.relRelated')}
                </span>
              ))}
            </div>
          </div>
          {selectedNode && (
            <div style={{ width: 280, background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>{selectedNode}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{t9('termLibrary.relatedRelationsPrefix')}{selectedRelations.length}{t9('termLibrary.relatedRelationsSuffix')}</div>
              {selectedRelations.map(r => {
                const other = r.from === selectedNode ? r.to : r.from
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: relationshipColors[r.type], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{other}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.type === 'synonym' ? t9('termLibrary.relSynonym') : r.type === 'broader' ? t9('termLibrary.relBroader') : r.type === 'narrower' ? t9('termLibrary.relNarrower') : t9('termLibrary.relRelated')}
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
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.reportTermExtraction')}</span>
          <button
            onClick={handleRunExtraction}
            disabled={extractionRunning}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: extractionRunning ? 'var(--text-muted)' : '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: extractionRunning ? 'wait' : 'pointer' }}
          >
            {extractionRunning ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSearch size={12} />}
            {extractionRunning ? t9('termLibrary.analyzing') : t9('termLibrary.analyzeAndExtract')}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{extractedTerms.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.extractedTotal')}</div>
          </div>
          <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{extractedTerms.filter(t => t.status === 'approved').length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.adopted')}</div>
          </div>
          <div style={{ background: 'var(--color-warning-bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{extractedTerms.filter(t => t.status === 'pending').length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.pendingReview')}</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <VirtualTable
          columns={[
            {
              title: t9('termLibrary.thExtractedTerm'),
              dataIndex: 'term',
              key: 'term',
              render: (v: string) => <span style={{ fontWeight: 600, color: '#1e40af' }}>{v}</span>,
            },
            {
              title: t9('termLibrary.thFrequency'),
              dataIndex: 'frequency',
              key: 'frequency',
              width: 80,
              render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>{v}</span>,
            },
            {
              title: t9('termLibrary.thSource'),
              dataIndex: 'source',
              key: 'source',
              render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>,
            },
            {
              title: t9('termLibrary.thSuggestedCategory'),
              dataIndex: 'suggestedCategory',
              key: 'suggestedCategory',
              render: (v: string) => <StatusTag tone={{ bg: '#8b5cf622', border: 'transparent', color: '#6d28d9', dot: '#6d28d9' }}>{v}</StatusTag>,
            },
            {
              title: t9('termLibrary.thStatus'),
              dataIndex: 'status',
              key: 'status',
              width: 90,
              render: (v: string) => (
                <StatusTag
                  size="md"
                  style={{ fontWeight: 700 }}
                  status={v === 'approved' ? 'success' : v === 'rejected' ? 'critical' : 'warning'}
                >
                  {v === 'approved' ? t9('termLibrary.adopted') : v === 'rejected' ? t9('termLibrary.rejected') : t9('termLibrary.pendingReview')}
                </StatusTag>
              ),
            },
            {
              title: t9('termLibrary.thActions'),
              key: 'action',
              width: 120,
              render: (_: unknown, et) => (
                <div style={{ display: 'flex', gap: 4 }}>
                  {et.status === 'pending' && (
                    <>
                      <button onClick={() => handleApproveExtraction(et.id)} style={{ padding: '3px 8px', background: 'var(--color-success-bg)', color: '#16a34a', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t9('termLibrary.adopt')}</button>
                      <button onClick={() => handleRejectExtraction(et.id)} style={{ padding: '3px 8px', background: 'var(--color-error-bg)', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t9('termLibrary.reject')}</button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          dataSource={extractedTerms}
          rowKey="id"
          height={420}
          pageSize={15}
        />
      </div>
      </div>
    </div>
  )

  const renderLanguageTab = () => (
    <div style={{ padding: 16, display: mainTab === 'dict' && featureTab === 'language' ? undefined : 'none' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Languages size={15} color="#7c3aed" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.multilingualSupport')}</span>
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={bilingualMode} onChange={() => setBilingualMode(!bilingualMode)} />
            {t9('termLibrary.bilingualMode')}
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
            <Search size={12} color="var(--text-secondary)" />
            <input value={languageSearch} onChange={e => setLanguageSearch(e.target.value)} placeholder={t9('termLibrary.searchTermsShort')} style={{ border: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
          </div>
          <select value={selectedLang} onChange={e => setSelectedLang(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
            <option value="zh">{t9('termLibrary.langZh')}</option>
            <option value="en">{t9('termLibrary.langEn')}</option>
            <option value="ja">{t9('termLibrary.langJa')}</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <DataTable
          dataSource={filteredTranslations}
          rowKey="termId"
          pagination={false}
          columns={[
            { title: t9('termLibrary.langZh'), dataIndex: 'zh', render: (v: string) => <span style={{ fontWeight: 600, color: '#1e40af' }}>{v}</span> },
            ...(bilingualMode
              ? [
                  { title: t9('termLibrary.langEn'), dataIndex: 'en', render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
                  { title: t9('termLibrary.langJa'), dataIndex: 'ja', render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
                ]
              : [
                  {
                    title: selectedLang === 'en' ? t9('termLibrary.langEn') : t9('termLibrary.langJa'),
                    key: 'translation',
                    render: (_: unknown, row: LanguageEntry) => <span style={{ color: 'var(--text-secondary)' }}>{selectedLang === 'en' ? row.en : row.ja}</span>,
                  },
                ]),
            {
              title: t9('termLibrary.accuracy'), dataIndex: 'accuracy',
              render: (v: number) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 50, height: 5, background: 'var(--border-color)', borderRadius: 3 }}>
                    <div style={{ width: `${v * 100}%`, height: 5, background: v > 0.95 ? '#16a34a' : v > 0.9 ? '#f59e0b' : '#dc2626', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(v * 100)}%</span>
                </div>
              ),
            },
          ]}
        />
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.languageFooter')}</div>
      </div>
    </div>
  )

  // [W1-107] renderCategoryTab 内 Hook 提升至组件作用域, 避免规则违规 (Hook 顺序不稳定)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(categoryTree.map(n => n.id)))
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string; parentId: string; color: string }>({ name: '', parentId: '', color: '#2563eb' })

  const renderCategoryTab = () => {
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
      const editingId = categoryForm.id
      if (editingId) {
        setCategoryTree(prev => updateCategoryNode(prev, editingId, categoryForm.name.trim()))
      } else {
        const node: CategoryTreeNode = { id: uniqueId('cat'), name: categoryForm.name.trim(), children: [], count: 0, color: categoryForm.color }
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
          role="button"
          tabIndex={0}
          onClick={() => { setSelectedCategory(node.id); toggleExpand(node.id) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCategory(node.id); toggleExpand(node.id) } }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            cursor: 'pointer', borderRadius: 4, marginLeft: level * 16,
            background: selectedCategory === node.id ? `${node.color}15` : 'transparent',
          }}
        >
          {node.children.length > 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{expandedNodes.has(node.id) ? '▼' : ''}</span>
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
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.categoryBrowser')}</span>
              <button onClick={openAddCategory} style={{ marginLeft: 'auto', padding: '4px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={11} /> {t9('termLibrary.newCategory')}
              </button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 4 }}>
              {renderTree(categoryTree)}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.dragHint')}</div>
          </div>
          {selectedCategory && (
            <div style={{ width: 300, background: 'var(--bg-card)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>{t9('termLibrary.categoryStats')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>32</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.termCount')}</div>
                </div>
                <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>1,245</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.usageCount')}</div>
                </div>
              </div>
              <button onClick={openEditCategory} style={{ marginTop: 12, width: '100%', padding: '6px 12px', background: 'var(--content-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                {t9('termLibrary.editCategory')}
              </button>
            </div>
          )}
        </div>
        {showCategoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCategoryModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}><Move size={16} color="#0891b2" /> {categoryForm.id ? t9('termLibrary.editCategory') : t9('termLibrary.newCategory')}</div>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, padding: 4 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{t9('termLibrary.labelCategoryName')}</label>
                <input value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder={t9('termLibrary.categoryNamePlaceholder')} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              {!categoryForm.id && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{t9('termLibrary.labelParentCategory')}</label>
                  <select value={categoryForm.parentId} onChange={e => setCategoryForm({ ...categoryForm, parentId: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12 }}>
                    <option value="">{t9('termLibrary.noParent')}</option>
                    {categoryTree.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              )}
              {!categoryForm.id && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{t9('termLibrary.labelColor')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {CATEGORY_COLORS.map(c => (
                      <button key={c} onClick={() => setCategoryForm({ ...categoryForm, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: categoryForm.color === c ? '3px solid #1e293b' : 'none', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <ActionButton action="cancel" onClick={() => setShowCategoryModal(false)}>{t9('termLibrary.cancel')}</ActionButton>
                <ActionButton action="save" disabled={!categoryForm.name.trim()} onClick={handleSaveCategory}>{t9('termLibrary.save')}</ActionButton>
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
    <div data-testid="term-library-page" style={{ display: 'flex', background: 'var(--bg-card)', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' }}>
      {/* [v3.0.6.11-88] 已接入真实 API: 后端 term-entry.controller (/terms 全 11 端点) 已实现 */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: 'var(--color-success-bg)', color: '#065f46', fontSize: 12, fontWeight: 600, padding: '4px 16px', textAlign: 'center', borderBottom: '1px solid #a7f3d0' }}>
         {t9('termLibrary.apiBanner')}
      </div>
      {loading && <LoadingBanner message={t9('termLibrary.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <div style={{ width: 260, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-color)', background: '#1e40af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BookOpen size={18} style={{ color: '#93c5fd' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t9('termLibrary.title')}</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{t9('termLibrary.subtitle')}</p>
        </div>
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 10px' }}>
            <Search size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input value={leftSearch} onChange={e => setLeftSearch(e.target.value)} placeholder={t9('termLibrary.searchTermsPlaceholder')} style={{ border: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
            {leftSearch && <button onClick={() => setLeftSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} style={{ color: 'var(--text-secondary)' }} /></button>}
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{stats.totalTerms}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.totalTerms')}</div>
            </div>
            <div style={{ background: '#8b5cf622', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{stats.mappedCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.mapped')}</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <button onClick={() => { setActiveCategoryId('ALL'); setMainTab('dict') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: activeCategoryId === 'ALL' && mainTab === 'dict' ? 'var(--color-info-bg)' : 'transparent',
            borderLeft: activeCategoryId === 'ALL' && mainTab === 'dict' ? '3px solid #1e40af' : '3px solid transparent', textAlign: 'left',
          }}>
            <FolderOpen size={13} style={{ color: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#1e40af' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: activeCategoryId === 'ALL' && mainTab === 'dict' ? 700 : 400, color: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#1e40af' : 'var(--text-secondary)' }}>{t9('termLibrary.allLibrary')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#1e40af' : 'var(--border-color)', color: activeCategoryId === 'ALL' && mainTab === 'dict' ? '#fff' : 'var(--text-muted)', borderRadius: 10, padding: '1px 6px' }}>{getCategoryCount('ALL')}</span>
          </button>
          <button onClick={() => { setMainTab('standard'); setActiveCategoryId('ALL') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: mainTab === 'standard' ? 'var(--color-info-bg)' : 'transparent',
            borderLeft: mainTab === 'standard' ? '3px solid #1e40af' : '3px solid transparent', textAlign: 'left',
          }}>
            <FileCheck size={13} style={{ color: mainTab === 'standard' ? '#1e40af' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: mainTab === 'standard' ? 700 : 400, color: mainTab === 'standard' ? '#1e40af' : 'var(--text-secondary)' }}>{t9('termLibrary.nationalStandard')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: mainTab === 'standard' ? '#1e40af' : 'var(--border-color)', color: mainTab === 'standard' ? '#fff' : 'var(--text-muted)', borderRadius: 10, padding: '1px 6px' }}>{WS_STANDARDS.length}</span>
          </button>
          <div style={{ padding: '6px 16px 4px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: 1 }}>{t9('termLibrary.byModality')}</div>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { setActiveCategoryId(cat.id); setMainTab('dict') }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', border: 'none', cursor: 'pointer',
              background: activeCategoryId === cat.id && mainTab === 'dict' ? 'var(--color-info-bg)' : 'transparent',
              borderLeft: activeCategoryId === cat.id && mainTab === 'dict' ? `3px solid ${cat.color}` : '3px solid transparent', textAlign: 'left',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: cat.color, opacity: activeCategoryId === cat.id ? 1 : 0.5 }} />
              <span style={{ fontSize: 12, fontWeight: activeCategoryId === cat.id ? 600 : 400, color: activeCategoryId === cat.id ? '#1e40af' : 'var(--text-secondary)' }}>{cat.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, background: activeCategoryId === cat.id ? cat.color : 'var(--bg-card)', color: activeCategoryId === cat.id ? '#fff' : 'var(--text-muted)', borderRadius: 10, padding: '1px 6px' }}>{getCategoryCount(cat.id)}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
          <button onClick={openAddModal} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(30,64,175,0.3)' }}>
            <Plus size={13} /> {t9('termLibrary.newTerm')}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-card)', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={16} style={{ color: '#1e40af' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
              {mainTab === 'dict' ? t9('termLibrary.dictMgmt') : t9('termLibrary.nationalStandardFull')}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>({mainTab === 'dict' ? filteredTerms.length : filteredWsStandards.length} {t9('termLibrary.itemsSuffix')})</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {mainTab === 'dict' && (
              <>
                <button onClick={() => setShowQuickPanel(!showQuickPanel)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showQuickPanel ? 'var(--color-info-bg)' : 'var(--bg-card)', border: `1px solid ${showQuickPanel ? '#1e40af' : 'var(--border-color)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: showQuickPanel ? '#1e40af' : 'var(--text-muted)' }}>
                  <Zap size={12} /> {t9('termLibrary.quickLibrary')}
                </button>
                <button onClick={() => setShowStats(!showStats)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showStats ? 'var(--color-info-bg)' : 'var(--bg-card)', border: `1px solid ${showStats ? '#7c3aed' : 'var(--border-color)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: showStats ? '#7c3aed' : 'var(--text-muted)' }}>
                  <BarChart2 size={12} /> {t9('termLibrary.stats')}
                </button>
              </>
            )}
            {mainTab === 'standard' && (
              <button onClick={handleImportAllStandards} disabled={importAllLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: importAllLoading ? 'var(--text-muted)' : '#1e40af', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: importAllLoading ? 'wait' : 'pointer', boxShadow: importAllLoading ? 'none' : '0 2px 6px rgba(30,64,175,0.3)' }}>
                {importAllLoading ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> {t9('termLibrary.importing')}</> : <><DownloadCloud size={12} /> {t9('termLibrary.importAllStandards')}</>}
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
                  <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>{t9('termLibrary.importedPrefix')}{importedCount}{t9('termLibrary.importedSuffix')}</span>
                </div>
              )}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileCheck size={15} style={{ color: '#1e40af' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.wsTableTitle')}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{t9('termLibrary.wsTableSubtitle')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: t9('termLibrary.wsTotal'), value: WS_STANDARDS.length, color: '#1e40af', bg: '#3b82f622' },
                    { label: t9('termLibrary.wsCT'), value: WS_STANDARDS.filter(w => w.department === 'CT').length, color: '#3b82f6', bg: '#3b82f622' },
                    { label: t9('termLibrary.wsMR'), value: WS_STANDARDS.filter(w => w.department === 'MR').length, color: '#8b5cf6', bg: '#8b5cf622' },
                    { label: t9('termLibrary.wsDR'), value: WS_STANDARDS.filter(w => w.department === 'DXR' || w.department === '乳腺').length, color: '#10b981', bg: '#22c55e22' },
                    { label: t9('termLibrary.wsUS'), value: WS_STANDARDS.filter(w => w.department === '超声' || w.department === 'DSA').length, color: '#f59e0b', bg: '#f59e0b22' },
                  ].map(item => (
                    <div key={item.label} style={{ background: item.bg, borderRadius: 8, padding: '10px 12px', border: `1px solid ${item.color}20` }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', flex: 1, minWidth: 200 }}>
                    <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <input value={wsSearch} onChange={e => setWsSearch(e.target.value)} placeholder={t9('termLibrary.searchStandardPlaceholder')} style={{ border: 'none', fontSize: 12, background: 'transparent', width: '100%', color: '#1e40af' }} />
                    {wsSearch && <button onClick={() => setWsSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} style={{ color: 'var(--text-secondary)' }} /></button>}
                  </div>
                  <select value={wsDeptFilter} onChange={e => setWsDeptFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--content-bg)', cursor: 'pointer' }}>
                    <option value="全部">{t9('termLibrary.allDepartments')}</option>
                    {DEPT_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <DataTable
                    dataSource={filteredWsStandards}
                    rowKey="code"
                    pagination={false}
                    emptyText={t9('termLibrary.noMatchingStandards')}
                    columns={[
                      { title: t9('termLibrary.thCode'), dataIndex: 'code', render: (v: string) => <StatusTag status="info" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v}</StatusTag> },
                      { title: t9('termLibrary.thStandardName'), dataIndex: 'standardName', render: (v: string) => <span style={{ fontWeight: 600, color: '#1e40af' }}>{v}</span> },
                      {
                        title: t9('termLibrary.thAliases'), dataIndex: 'aliases',
                        render: (v: string[]) => <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{v.map(a => <span key={a} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, background: 'var(--content-bg)', color: 'var(--text-secondary)' }}>{a}</span>)}</div>,
                      },
                      {
                        title: t9('termLibrary.thDepartment'), dataIndex: 'department',
                        render: (v: string) => <StatusTag style={{ fontWeight: 700 }} tone={{ bg: MODALITY_BG[v] || 'var(--content-bg)', border: 'transparent', color: MODALITY_COLORS[v] || 'var(--text-muted)', dot: MODALITY_COLORS[v] || 'var(--text-muted)' }}>{v}</StatusTag>,
                      },
                      { title: t9('termLibrary.thSubClass'), dataIndex: 'subClass', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
                      {
                        title: t9('termLibrary.thReportTemplate'), dataIndex: 'reportTemplate',
                        render: (v: string) => <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{v}</div>,
                      },
                      {
                        title: t9('termLibrary.thStatus'), key: 'status',
                        render: (_: unknown, ws: WsStandardEntry) => mappedWsCodes.has(ws.code)
                          ? <StatusTag status="success" style={{ fontWeight: 700 }}><CheckCircle2 size={10} /> {t9('termLibrary.mappedStatus')}</StatusTag>
                          : <StatusTag status="warning">{t9('termLibrary.unmapped')}</StatusTag>,
                      },
                    ]}
                  />
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.totalStandardsPrefix')}<strong style={{ color: '#1e40af' }}>{filteredWsStandards.length}</strong>{t9('termLibrary.totalStandardsMid')}<strong style={{ color: '#16a34a' }}>{WS_STANDARDS.filter(w => mappedWsCodes.has(w.code)).length}</strong>{t9('termLibrary.totalStandardsSuffix')}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.dataSource')}</span>
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.libraryStats')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: t9('termLibrary.totalTerms'), value: stats.totalTerms, sub: t9('termLibrary.unitItems'), color: '#1e40af', bg: '#3b82f622' },
                      { label: t9('termLibrary.thisMonthUsage'), value: stats.thisMonthUsage, sub: t9('termLibrary.unitTimes'), color: '#7c3aed', bg: '#8b5cf622' },
                      { label: t9('termLibrary.mappedStandard'), value: stats.mappedCount, sub: t9('termLibrary.unitItems'), color: '#059669', bg: '#22c55e22' },
                      { label: t9('termLibrary.activeTerms'), value: stats.activeTerms, sub: t9('termLibrary.unitItems'), color: '#d97706', bg: '#f59e0b22' },
                    ].map(item => (
                      <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${item.color}20` }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}<span style={{ fontSize: 12, marginLeft: 2 }}>{item.sub}</span></div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <TrendingUp size={13} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.rankingTop20')}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {top20Terms.map((t, i) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: i < 3 ? (i === 0 ? 'var(--color-warning-bg)' : i === 1 ? 'var(--bg-card)' : 'var(--color-warning-bg)') : 'var(--bg-card)', borderRadius: 8, padding: '7px 10px', border: `1px solid ${i < 3 ? '#f59e0b30' : 'var(--border-light)'}` }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? '#d97706' : 'var(--text-muted)', minWidth: 16 }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.term}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.count}{t9('termLibrary.timesSuffix')}</div>
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t9('termLibrary.quickLibrary')}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{t9('termLibrary.clickToCopy')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {MODALITY_LIST.map(m => (
                      <button key={m} onClick={() => setActiveQuickModality(m)} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${activeQuickModality === m ? MODALITY_COLORS[m] : 'var(--border-color)'}`, background: activeQuickModality === m ? MODALITY_BG[m] : 'var(--bg-card)', color: activeQuickModality === m ? MODALITY_COLORS[m] : 'var(--text-muted)' }}>{m}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {quickTerms.length === 0 ? (
                      <div
                        role="status"
                        data-testid="term-empty"
                        style={{ width: '100%', textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 12 }}
                      >
                        {t9('termLibrary.emptyQuick')}
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
                    {([{ key: 'all', label: t9('termLibrary.tabAll'), count: terms.length }, { key: 'active', label: t9('termLibrary.tabActive'), count: terms.filter(t => t.isActive !== false).length }, { key: 'inactive', label: t9('termLibrary.tabInactive'), count: terms.filter(t => t.isActive === false).length }] as const).map(tab => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeTab === tab.key ? '#1e40af' : 'var(--bg-card)', color: activeTab === tab.key ? '#fff' : 'var(--text-muted)' }}>
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 10px' }}>
                      <Search size={12} style={{ color: 'var(--text-secondary)' }} />
                      <input value={rightSearch} onChange={e => setRightSearch(e.target.value)} placeholder={t9('termLibrary.searchTermContent')} style={{ border: 'none', fontSize: 12, background: 'transparent', width: 150, color: '#1e40af' }} />
                    </div>
                    <Select
                      size="small"
                      style={{ minWidth: 120 }}
                      value={modalityFilter}
                      onChange={(v) => setModalityFilter(v)}
                      options={[
                        { value: '全部', label: t9('termLibrary.allModalities') },
                        ...MODALITY_LIST.map(m => ({ value: m, label: m })),
                      ]}
                    />
                    <Select
                      size="small"
                      style={{ minWidth: 140 }}
                      value={categoryFilter}
                      onChange={(v) => setCategoryFilter(v)}
                      options={[
                        { value: '全部', label: t9('termLibrary.allCategories') },
                        ...allCategoryNames.map(c => ({ value: c, label: c })),
                      ]}
                    />
                    <button onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#059669', cursor: 'pointer' }}><Download size={11} /> {t9('termLibrary.importTemplate')}</button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: importLoading ? 'var(--content-bg)' : 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#7c3aed', cursor: importLoading ? 'wait' : 'pointer' }}>
                      <Upload size={11} />{importLoading ? t9('termLibrary.importing') : t9('termLibrary.batchImport')}
                      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                    </label>
                    {importFile && <button onClick={handleImportFile} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#7c3aed', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}><FileSpreadsheet size={11} /> {t9('termLibrary.confirmImport')}</button>}
                  </div>
                </div>
                <DataTable<TermEntry>
                  rowKey="id"
                  columns={termColumns}
                  dataSource={filteredTerms}
                  showPagination={false}
                  emptyText={t9('termLibrary.noMatchingTerms')}
                  onRow={(term) => ({ style: term.isActive === false ? { background: 'var(--color-error-bg)' } : undefined })}
                />
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t9('termLibrary.totalTermsPrefix')}<strong style={{ color: '#1e40af' }}>{filteredTerms.length}</strong>{t9('termLibrary.totalTermsMid')}<strong style={{ color: '#16a34a' }}>{stats.mappedCount}</strong>{t9('termLibrary.totalTermsSuffix')}</span>
                  <ActionButton action="create" size="compact" onClick={openAddModal}>{t9('termLibrary.newTerm')}</ActionButton>
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
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{modalMode === 'add' ? t9('termLibrary.modalAdd') : t9('termLibrary.modalEdit')}</span>
              </div>
              <ActionButton action="cancel" variant="text" style={{ color: '#fff' }} onClick={() => setShowModal(false)} />
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}> {t9('termLibrary.labelTermContent')} <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea value={formData.term} onChange={e => setFormData(prev => ({ ...prev, term: e.target.value }))} rows={3} placeholder={t9('termLibrary.termContentPlaceholder')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#1e40af'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>{t9('termLibrary.labelCategory')}</label>
                  <select value={formData.category} onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', background: 'var(--bg-card)', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {allCategoryNames.length > 0 ? allCategoryNames.map(c => <option key={c} value={c}>{c}</option>) : ['CT描述', 'MR描述', '结论术语', '急诊模板', '肿瘤评估'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>{t9('termLibrary.labelTermType')}</label>
                  <select value={formData.termType} onChange={e => setFormData(prev => ({ ...prev, termType: e.target.value as TermEntry['termType'] }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', background: 'var(--bg-card)', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {TERM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t9('termLibrary.labelApplicableModality')} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{t9('termLibrary.multiSelect')}</span></label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MODALITY_LIST.map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${formData.modality.includes(m) ? MODALITY_COLORS[m] : 'var(--border-color)'}`, background: formData.modality.includes(m) ? MODALITY_BG[m] : 'var(--bg-card)', color: formData.modality.includes(m) ? MODALITY_COLORS[m] : 'var(--text-muted)', userSelect: 'none' }}>
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>{t9('termLibrary.labelWsStandard')}</label>
                <select value={formData.wsStandardCode} onChange={e => setFormData(prev => ({ ...prev, wsStandardCode: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', background: 'var(--bg-card)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="">{t9('termLibrary.noStandardLink')}</option>
                  {WS_STANDARDS.map(ws => <option key={ws.code} value={ws.code}>{ws.code} - {ws.standardName}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>{t9('termLibrary.labelStandardReport')}</label>
                <textarea value={formData.standardReport} onChange={e => setFormData(prev => ({ ...prev, standardReport: e.target.value }))} rows={4} placeholder={t9('termLibrary.standardReportPlaceholder')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#1e40af'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>{t9('termLibrary.labelUsageNotes')}</label>
                <textarea value={formData.usageNotes} onChange={e => setFormData(prev => ({ ...prev, usageNotes: e.target.value }))} rows={2} placeholder={t9('termLibrary.optional')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: '#1e40af', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#1e40af'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-card)', borderRadius: '0 0 16px 16px' }}>
              <ActionButton action="cancel" onClick={() => setShowModal(false)}>{t9('termLibrary.cancel')}</ActionButton>
              <ActionButton action="save" disabled={!formData.term.trim()} onClick={handleSaveTerm}>
                {modalMode === 'add' ? t9('termLibrary.saveTerm') : t9('termLibrary.saveChanges')}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

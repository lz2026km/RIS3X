// ============================================================
// G005 放射科RIS系统 - 数据字典管理页面 v1.0.0
// 放射科专用数据字典：CT/MRI/X线检查项目、设备类型、诊断术语等
// ============================================================
import { useState, useMemo, useEffect } from 'react'
import { Card,  message } from 'antd'
import { PageHeader } from '../components/common/PageHeader'
import { termApi, type TermDto } from '../services/api/termApi'
import { dictionaryApi } from '../services/api/dictionaryApi'
import { t } from '../i18n/appI18n'
import { uniqueId } from '../utils/uniqueId'
import {
  Search, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  BookOpen, Filter, RotateCcw,
  Activity, Download, Upload, FileSpreadsheet,
  AlertTriangle, CheckCircle2, Eye, RefreshCw,
  TrendingUp, BarChart2, Users, PieChart, Layers, Code,
  Globe, Server, History, Shield,
} from 'lucide-react'

// ---------- 样式定义 ----------
const s: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1e40af' },
  subtitle: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 },
  toolbar: {
    display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
    background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16,
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--content-bg)', border: '1px solid var(--border-color)',
    borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 220,
  },
  searchInput: {
    border: 'none', outline: 'none', background: 'transparent',
    fontSize: 14, color: 'var(--text-secondary)', width: '100%',
  },
  select: {
    border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 14px',
    fontSize: 13, color: 'var(--text-secondary)', background: 'var(--content-bg)', outline: 'none',
    cursor: 'pointer', minHeight: 44,
  },
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 18px', fontSize: 13, cursor: 'pointer', minHeight: 44,
    boxShadow: '0 2px 6px rgba(30,58,95,0.25)',
  },
  btnDanger: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'var(--color-error-bg)', color: '#dc2626', border: 'none', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, cursor: 'pointer', minHeight: 44,
  },
  btnIcon: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'var(--content-bg)', color: 'var(--text-secondary)', border: 'none', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, cursor: 'pointer', minHeight: 44,
  },
  table: {
    width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)',
    borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  th: {
    background: 'var(--content-bg)', padding: '12px 14px', textAlign: 'left',
    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)',
  },
  td: {
    padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)',
  },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12,
    fontWeight: 600,
  },
  badgeActive: { background: 'var(--color-success-bg)', color: '#16a34a' },
  badgeInactive: { background: 'var(--content-bg)', color: 'var(--text-secondary)' },
  actions: { display: 'flex', gap: 6 },
  pagination: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, padding: '12px 16px', background: 'var(--bg-card)',
    borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  pageInfo: { fontSize: 13, color: 'var(--text-secondary)' },
  pageBtns: { display: 'flex', gap: 4 },
  pageBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-color)',
    background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
  },
  pageBtnActive: {
    background: '#1e40af', color: '#fff', border: '1px solid #1e40af',
  },
  pageBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-card)', borderRadius: 14, width: 700, maxHeight: '90vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#1e40af',
  },
  modalTitle: { fontSize: 15, fontWeight: 700, color: '#fff' },
  modalClose: {
    background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6,
    cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center',
    padding: 5,
  },
  modalBody: {
    padding: 20, overflowY: 'auto', flex: 1,
  },
  modalFooter: {
    padding: '12px 20px', borderTop: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'flex-end', gap: 10,
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  formGroupFull: { gridColumn: '1 / -1' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' },
  required: { color: '#dc2626', marginLeft: 2 },
  input: {
    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: 'var(--text-secondary)', outline: 'none', minHeight: 44,
    boxSizing: 'border-box', width: '100%',
  },
  textarea: {
    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: 'var(--text-secondary)', outline: 'none', resize: 'vertical',
    minHeight: 80, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
  },
  btnCancel: {
    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)',
    background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer', minHeight: 44,
  },
  btnSubmit: {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: '#1e40af', fontSize: 14, color: '#fff', cursor: 'pointer', minHeight: 44,
  },
  btnDeleteConfirm: {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: '#dc2626', fontSize: 14, color: '#fff', cursor: 'pointer', minHeight: 44,
  },
  emptyState: {
    textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)',
    fontSize: 16,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16, background: 'var(--content-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px',
  },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 },
  infoTip: {
    fontSize: 12, color: 'var(--text-secondary)', marginTop: 4,
  },
  deleteModalText: {
    fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8,
  },
  stats: {
    display: 'flex', gap: 20, marginLeft: 'auto',
  },
  statCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--bg-card)', padding: '8px 14px', borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid var(--border-light)',
  },
  statItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: 'var(--text-secondary)',
  },
  statNum: { fontWeight: 800, color: '#1e40af', fontSize: 16 },
  categoryTag: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 8,
    fontSize: 12, fontWeight: 700,
  },
  modalityBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 6,
    fontSize: 12, fontWeight: 600,
  },
  tabBar: {
    display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-card)',
    padding: '8px 12px', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  tab: {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
  },
  tabActive: { background: '#1e40af', color: '#fff' },
  tabInactive: { background: 'transparent', color: 'var(--text-secondary)' },
  chartCard: {
    background: 'var(--bg-card)', borderRadius: 10, padding: 16, marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  chartTitle: {
    fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 12,
    display: 'flex', alignItems: 'center', gap: 8,
  },
}

// ---------- 字典数据类型 ----------
interface DictionaryItem {
  id: string
  category: string
  code: string
  name: string
  pinyin?: string
  modality?: string[]
  bodyPart?: string
  sortOrder: number
  isActive: boolean
  notes?: string
}

type TermUpdatePayload = Partial<TermDto> & Partial<DictionaryItem> & { status?: string }

// ---------- 映射条目 ----------
interface MappingEntry {
  id: string
  sourceCode: string
  sourceSystem: string
  targetCode: string
  targetSystem: string
  accuracy: number
  status: 'verified' | 'unverified' | 'conflict'
  lastVerified: string
}

// ---------- FHIR 概念 ----------
interface FhirConcept {
  code: string
  display: string
  system: string
  children?: FhirConcept[]
}

// ---------- 版本条目 ----------
interface VersionEntry {
  id: string
  dictionaryId: string
  version: string
  status: 'draft' | 'review' | 'published'
  changedBy: string
  changedAt: string
  changes: string
  snapshot: Partial<DictionaryItem>
}

// ---------- 统计 ----------
interface UsageStat {
  termName: string
  usageCount: number
  department: string
  trend: number[]
}

// ---------- 放射科字典分类颜色 ----------
const categoryColors: Record<string, { backgroundColor: string; color: string }> = {
  'CT检查项目':   { backgroundColor: 'var(--color-info-bg)', color: '#1d4ed8' },
  'MRI序列':      { backgroundColor: '#ec489922', color: '#be185d' },
  'X线检查':      { backgroundColor: 'var(--color-success-bg)', color: '#16a34a' },
  '设备类型':     { backgroundColor: 'var(--color-warning-bg)', color: '#92400e' },
  '诊断术语':     { backgroundColor: '#8b5cf622', color: '#4338ca' },
  '检查部位':     { backgroundColor: '#8b5cf622', color: '#a21caf' },
  '造影剂':       { backgroundColor: '#ccfbf1', color: '#0f766e' },
  '辐射剂量':     { backgroundColor: 'var(--color-error-bg)', color: '#b91c1c' },
  '体位技术':     { backgroundColor: 'var(--color-warning-bg)', color: '#854d0e' },
  '对比剂类型':   { backgroundColor: 'var(--color-info-bg)', color: '#0369a1' },
}

const modalityColors: Record<string, { bg: string; color: string }> = {
  'CT':    { bg: '#3b82f622', color: '#2563eb' },
  'MR':    { bg: '#8b5cf622', color: '#7c3aed' },
  'DR':    { bg: '#22c55e22', color: '#059669' },
  'DSA':   { bg: '#f59e0b22', color: '#d97706' },
  '乳腺':  { bg: '#ec489922', color: '#db2777' },
  '胃肠':  { bg: '#06b6d422', color: '#0891b2' },
}

export const initialDictionaries: DictionaryItem[] = [
  { id: 'DICT-CT-001', category: 'CT检查项目', code: 'CT-BRAIN-NC', name: '颅脑CT平扫', pinyin: 'lwnctps', modality: ['CT'], bodyPart: '头部', sortOrder: 1, isActive: true, notes: '常规颅脑平扫，层厚5mm' },
  { id: 'DICT-CT-002', category: 'CT检查项目', code: 'CT-BRAIN-C', name: '颅脑CT增强', pinyin: 'lwnctzq', modality: ['CT'], bodyPart: '头部', sortOrder: 2, isActive: true, notes: '需注射对比剂' },
  { id: 'DICT-CT-003', category: 'CT检查项目', code: 'CT-CHEST-NC', name: '胸部CT平扫', pinyin: 'xbctps', modality: ['CT'], bodyPart: '胸部', sortOrder: 3, isActive: true, notes: '肺窗+纵隔窗' },
  { id: 'DICT-CT-004', category: 'CT检查项目', code: 'CT-CHEST-C', name: '胸部CT增强', pinyin: 'xbctzq', modality: ['CT'], bodyPart: '胸部', sortOrder: 4, isActive: true, notes: '肺动脉CTA方案' },
  { id: 'DICT-CT-005', category: 'CT检查项目', code: 'CT-CTA-HEAD', name: '头颅CTA', pinyin: 'tlcta', modality: ['CT'], bodyPart: '头部', sortOrder: 5, isActive: true, notes: '脑血管成像' },
  { id: 'DICT-CT-006', category: 'CT检查项目', code: 'CT-CTA-CHEST', name: '肺动脉CTA', pinyin: 'fdmcta', modality: ['CT'], bodyPart: '胸部', sortOrder: 6, isActive: true, notes: 'PE诊断金标准' },
  { id: 'DICT-CT-007', category: 'CT检查项目', code: 'CT-ABD-NC', name: '腹部CT平扫', pinyin: 'fbctps', modality: ['CT'], bodyPart: '腹部', sortOrder: 7, isActive: true, notes: '肝胆胰脾肾' },
  { id: 'DICT-CT-008', category: 'CT检查项目', code: 'CT-ABD-C', name: '腹部CT增强', pinyin: 'fbctzq', modality: ['CT'], bodyPart: '腹部', sortOrder: 8, isActive: true, notes: '三期增强扫描' },
  { id: 'DICT-CT-009', category: 'CT检查项目', code: 'CT-CORONARY', name: '冠脉CTA', pinyin: 'gmcta', modality: ['CT'], bodyPart: '心脏', sortOrder: 9, isActive: true, notes: '心率要求<75bpm' },
  { id: 'DICT-CT-010', category: 'CT检查项目', code: 'CT-SPINE-C', name: '脊柱CT三维重建', pinyin: 'jzctswcj', modality: ['CT'], bodyPart: '脊柱', sortOrder: 10, isActive: true, notes: '多平面重建MPR' },
  { id: 'DICT-MR-001', category: 'MRI序列', code: 'MR-T1WI', name: 'T1WI成像', pinyin: 't1wi', modality: ['MR'], bodyPart: '全身', sortOrder: 1, isActive: true, notes: 'SE序列' },
  { id: 'DICT-MR-002', category: 'MRI序列', code: 'MR-T2WI', name: 'T2WI成像', pinyin: 't2wi', modality: ['MR'], bodyPart: '全身', sortOrder: 2, isActive: true, notes: 'FSE序列' },
  { id: 'DICT-MR-003', category: 'MRI序列', code: 'MR-T2FS', name: 'T2脂肪抑制', pinyin: 't2zfyz', modality: ['MR'], bodyPart: '全身', sortOrder: 3, isActive: true, notes: 'STIR/FLAIR' },
  { id: 'DICT-MR-004', category: 'MRI序列', code: 'MR-DWI', name: 'DWI扩散成像', pinyin: 'dwkscx', modality: ['MR'], bodyPart: '全身', sortOrder: 4, isActive: true, notes: 'b值800-1000' },
  { id: 'DICT-MR-005', category: 'MRI序列', code: 'MR-ADC', name: 'ADC图', pinyin: 'adct', modality: ['MR'], bodyPart: '全身', sortOrder: 5, isActive: true, notes: '定量扩散系数' },
  { id: 'DICT-MR-006', category: 'MRI序列', code: 'MR-FLAIR', name: 'FLAIR序列', pinyin: 'flair', modality: ['MR'], bodyPart: '颅脑', sortOrder: 6, isActive: true, notes: '脑白质病变评估' },
  { id: 'DICT-MR-007', category: 'MRI序列', code: 'MR-SWI', name: 'SWI磁敏感成像', pinyin: 'swicmgxc', modality: ['MR'], bodyPart: '颅脑', sortOrder: 7, isActive: true, notes: '微出血/静脉显示' },
  { id: 'DICT-MR-008', category: 'MRI序列', code: 'MR-MRA', name: 'MRA脑血管成像', pinyin: 'marnxgxc', modality: ['MR'], bodyPart: '颅脑', sortOrder: 8, isActive: true, notes: 'TOF/PC法' },
  { id: 'DICT-MR-009', category: 'MRI序列', code: 'MR-MRC', name: 'MRCP胆胰管成像', pinyin: 'mrcpdygxc', modality: ['MR'], bodyPart: '腹部', sortOrder: 9, isActive: true, notes: '胰胆管水成像' },
  { id: 'DICT-MR-010', category: 'MRI序列', code: 'MR-PROPELLER', name: 'Propeller平息扫', pinyin: 'propellerpxs', modality: ['MR'], bodyPart: '颅脑', sortOrder: 10, isActive: true, notes: '运动伪影校正' },
  { id: 'DICT-DR-001', category: 'X线检查', code: 'DR-CHEST-PA', name: '胸部正侧位片', pinyin: 'xbzcwp', modality: ['DR'], bodyPart: '胸部', sortOrder: 1, isActive: true, notes: '立位PA+侧位' },
  { id: 'DICT-DR-002', category: 'X线检查', code: 'DR-ABD-KUB', name: '腹部立卧位片', pinyin: 'fblwwp', modality: ['DR'], bodyPart: '腹部', sortOrder: 2, isActive: true, notes: '消化道穿孔筛查' },
  { id: 'DICT-DR-003', category: 'X线检查', code: 'DR-SPINE-C', name: '颈椎正侧斜位', pinyin: 'jz zcxcw', modality: ['DR'], bodyPart: '颈椎', sortOrder: 3, isActive: true, notes: '张口位可选' },
  { id: 'DICT-DR-004', category: 'X线检查', code: 'DR-SPINE-T', name: '胸椎正侧位', pinyin: 'xzzc w', modality: ['DR'], bodyPart: '胸椎', sortOrder: 4, isActive: true, notes: '驼背患者可只照侧位' },
  { id: 'DICT-DR-005', category: 'X线检查', code: 'DR-SPINE-L', name: '腰椎正侧位', pinyin: 'yz zc w', modality: ['DR'], bodyPart: '腰椎', sortOrder: 5, isActive: true, notes: '腰骶部疼痛评估' },
  { id: 'DICT-DR-006', category: 'X线检查', code: 'DR-PELVIS', name: '骨盆正位', pinyin: 'gpzw', modality: ['DR'], bodyPart: '骨盆', sortOrder: 6, isActive: true, notes: '髋关节评估' },
  { id: 'DICT-DR-007', category: 'X线检查', code: 'DR-EXT-ARM', name: '四肢正侧位', pinyin: 'szzcw', modality: ['DR'], bodyPart: '四肢', sortOrder: 7, isActive: true, notes: '骨折/脱位评估' },
  { id: 'DICT-DR-008', category: 'X线检查', code: 'DR-SKULL', name: '头颅正侧位', pinyin: 'tlzcw', modality: ['DR'], bodyPart: '头部', sortOrder: 8, isActive: true, notes: '外伤/骨质评估' },
  { id: 'DICT-EQ-001', category: '设备类型', code: 'EQ-CT-64', name: '64排CT', pinyin: '64pct', modality: ['CT'], bodyPart: '全身', sortOrder: 1, isActive: true, notes: 'Philips Brilliance 64' },
  { id: 'DICT-EQ-002', category: '设备类型', code: 'EQ-CT-128', name: '128排CT', pinyin: '128pct', modality: ['CT'], bodyPart: '全身', sortOrder: 2, isActive: true, notes: 'Siemens Definition AS+' },
  { id: 'DICT-EQ-003', category: '设备类型', code: 'EQ-CT-DUAL', name: '双源CT', pinyin: 'syct', modality: ['CT'], bodyPart: '全身', sortOrder: 3, isActive: true, notes: '心脏冠脉成像优势' },
  { id: 'DICT-EQ-004', category: '设备类型', code: 'EQ-MR-15T', name: '1.5T MRI', pinyin: '15tmri', modality: ['MR'], bodyPart: '全身', sortOrder: 4, isActive: true, notes: 'Philips Achieva 1.5T' },
  { id: 'DICT-EQ-005', category: '设备类型', code: 'EQ-MR-30T', name: '3.0T MRI', pinyin: '30tmri', modality: ['MR'], bodyPart: '全身', sortOrder: 5, isActive: true, notes: 'Siemens TrioTim 3.0T' },
  { id: 'DICT-EQ-006', category: '设备类型', code: 'EQ-DR-FLAT', name: '数字化DR', pinyin: 'smhdr', modality: ['DR'], bodyPart: '全身', sortOrder: 6, isActive: true, notes: '平板探测器' },
  { id: 'DICT-EQ-007', category: '设备类型', code: 'EQ-DR-CARM', name: 'C形臂DR', pinyin: 'cxbd r', modality: ['DR', 'DSA'], bodyPart: '手术室', sortOrder: 7, isActive: true, notes: '术中透视/介入' },
  { id: 'DICT-EQ-008', category: '设备类型', code: 'EQ-DSA', name: 'DSA血管机', pinyin: 'dsaxg j', modality: ['DSA'], bodyPart: '心血管', sortOrder: 8, isActive: true, notes: 'Philips Allura Xper FD20' },
  { id: 'DICT-DIAG-001', category: '诊断术语', code: 'DIAG-NORMAL', name: '未见明显异常', pinyin: 'wjmxyc', modality: ['CT', 'MR', 'DR'], bodyPart: '全身', sortOrder: 1, isActive: true, notes: '正常报告模板' },
  { id: 'DICT-DIAG-002', category: '诊断术语', code: 'DIAG-STROKE', name: '脑梗死', pinyin: 'ngs', modality: ['CT', 'MR'], bodyPart: '颅脑', sortOrder: 2, isActive: true, notes: '急慢性分期' },
  { id: 'DICT-DIAG-003', category: '诊断术语', code: 'DIAG-HEMORRHAGE', name: '脑出血', pinyin: 'ncx', modality: ['CT', 'MR'], bodyPart: '颅脑', sortOrder: 3, isActive: true, notes: '急性期高密度' },
  { id: 'DICT-DIAG-004', category: '诊断术语', code: 'DIAG-TUMOR', name: '占位性病变', pinyin: 'zwxb b', modality: ['CT', 'MR'], bodyPart: '全身', sortOrder: 4, isActive: true, notes: '良恶性待定' },
  { id: 'DICT-DIAG-005', category: '诊断术语', code: 'DIAG-METS', name: '转移瘤', pinyin: 'zyl', modality: ['CT', 'MR'], bodyPart: '全身', sortOrder: 5, isActive: true, notes: '多发/单发' },
  { id: 'DICT-DIAG-006', category: '诊断术语', code: 'DIAG-FRACTURE', name: '骨折', pinyin: 'gz', modality: ['DR', 'CT'], bodyPart: '四肢/脊柱', sortOrder: 6, isActive: true, notes: '请注明部位及类型' },
  { id: 'DICT-DIAG-007', category: '诊断术语', code: 'DIAG-PNEUMONIA', name: '肺炎', pinyin: 'fy', modality: ['CT', 'DR'], bodyPart: '肺部', sortOrder: 7, isActive: true, notes: '大叶性/支气管肺炎' },
  { id: 'DICT-DIAG-008', category: '诊断术语', code: 'DIAG-NODULE', name: '肺结节', pinyin: 'f jie', modality: ['CT'], bodyPart: '肺部', sortOrder: 8, isActive: true, notes: '请描述大小/形态' },
  { id: 'DICT-DIAG-009', category: '诊断术语', code: 'DIAG-DISK', name: '椎间盘突出', pinyin: 'zjptc', modality: ['MR', 'CT'], bodyPart: '脊柱', sortOrder: 9, isActive: true, notes: '请注明节段' },
  { id: 'DICT-DIAG-010', category: '诊断术语', code: 'DIAG-ANEURYSM', name: '动脉瘤', pinyin: 'dml', modality: ['CT', 'MR'], bodyPart: '血管', sortOrder: 10, isActive: true, notes: '请注明部位/大小' },
  { id: 'DICT-BP-001', category: '检查部位', code: 'BP-HEAD', name: '头部', pinyin: 'tb', modality: ['CT', 'MR', 'DR'], bodyPart: '头部', sortOrder: 1, isActive: true, notes: '颅脑/副鼻窦/颞骨' },
  { id: 'DICT-BP-002', category: '检查部位', code: 'BP-NECK', name: '颈部', pinyin: 'jb', modality: ['CT', 'MR', 'DR'], bodyPart: '颈部', sortOrder: 2, isActive: true, notes: '甲状腺/气管/血管' },
  { id: 'DICT-BP-003', category: '检查部位', code: 'BP-CHEST', name: '胸部', pinyin: 'xb', modality: ['CT', 'DR', 'MR'], bodyPart: '胸部', sortOrder: 3, isActive: true, notes: '肺/纵隔/胸壁' },
  { id: 'DICT-BP-004', category: '检查部位', code: 'BP-ABD', name: '腹部', pinyin: 'fb', modality: ['CT', 'MR', 'DR'], bodyPart: '腹部', sortOrder: 4, isActive: true, notes: '肝胆胰脾肾' },
  { id: 'DICT-BP-005', category: '检查部位', code: 'BP-PELVIS', name: '盆腔', pinyin: 'pq', modality: ['CT', 'MR'], bodyPart: '盆腔', sortOrder: 5, isActive: true, notes: '膀胱/前列腺/子宫' },
  { id: 'DICT-BP-006', category: '检查部位', code: 'BP-SPINE', name: '脊柱', pinyin: 'jz', modality: ['CT', 'MR', 'DR'], bodyPart: '脊柱', sortOrder: 6, isActive: true, notes: '颈椎/胸椎/腰椎/骶椎' },
  { id: 'DICT-BP-007', category: '检查部位', code: 'BP-EXT', name: '四肢', pinyin: 'sz', modality: ['DR', 'CT', 'MR'], bodyPart: '四肢', sortOrder: 7, isActive: true, notes: '骨关节/软组织' },
  { id: 'DICT-CM-001', category: '造影剂', code: 'CM-IOHEXOL', name: '碘海醇', pinyin: 'dhc', modality: ['CT'], bodyPart: '全身', sortOrder: 1, isActive: true, notes: '浓度300/350mgI/ml' },
  { id: 'DICT-CM-002', category: '造影剂', code: 'CM-IOPAMIRON', name: '碘帕醇', pinyin: 'dpc', modality: ['CT'], bodyPart: '全身', sortOrder: 2, isActive: true, notes: '心脏CTA常用' },
  { id: 'DICT-CM-003', category: '造影剂', code: 'CM-OMNIPAQUE', name: '欧乃派克', pinyin: 'onpk', modality: ['CT'], bodyPart: '全身', sortOrder: 3, isActive: true, notes: '低渗非离子型' },
  { id: 'DICT-CM-004', category: '造影剂', code: 'CM-GD-DTPA', name: '钆喷酸葡胺', pinyin: 'gpspa', modality: ['MR'], bodyPart: '全身', sortOrder: 4, isActive: true, notes: '马根维显/莫迪司' },
  { id: 'DICT-CM-005', category: '造影剂', code: 'CM-GADOvist', name: '钆布醇', pinyin: 'gbc', modality: ['MR'], bodyPart: '全身', sortOrder: 5, isActive: true, notes: '高浓度MR对比剂' },
  { id: 'DICT-POS-001', category: '体位技术', code: 'POS-AP', name: '前后位AP', pinyin: 'qhwap', modality: ['DR'], bodyPart: '全身', sortOrder: 1, isActive: true, notes: 'X线束从前往后' },
  { id: 'DICT-POS-002', category: '体位技术', code: 'POS-PA', name: '后前位PA', pinyin: 'hqwpa', modality: ['DR'], bodyPart: '胸部', sortOrder: 2, isActive: true, notes: '胸部标准体位' },
  { id: 'DICT-POS-003', category: '体位技术', code: 'POS-LAT', name: '侧位LAT', pinyin: 'cwlat', modality: ['DR'], bodyPart: '全身', sortOrder: 3, isActive: true, notes: '左侧/右侧位' },
  { id: 'DICT-POS-004', category: '体位技术', code: 'POS-OBL', name: '斜位OBL', pinyin: 'xwobl', modality: ['DR'], bodyPart: '脊柱', sortOrder: 4, isActive: true, notes: '45度角斜位' },
  { id: 'DICT-POS-005', category: '体位技术', code: 'POS-DECUB', name: '卧位', pinyin: 'ww', modality: ['DR'], bodyPart: '腹部', sortOrder: 5, isActive: true, notes: '仰卧/俯卧/侧卧' },
  { id: 'DICT-POS-006', category: '体位技术', code: 'POS-UPRIGHT', name: '立位', pinyin: 'lw', modality: ['DR'], bodyPart: '腹部', sortOrder: 6, isActive: true, notes: '消化道穿孔站立位' },
]

const emptyDictionary = (): Partial<DictionaryItem> => ({
  category: '', code: '', name: '', pinyin: '', modality: [], bodyPart: '', sortOrder: 0, isActive: true, notes: '',
})

const validateDictionary = (d: Partial<DictionaryItem>): string[] => {
  const errs: string[] = []
  if (!(d.category ?? '').trim()) errs.push(t('dictionary.validateCategoryRequired'))
  if (!(d.code ?? '').trim()) errs.push(t('dictionary.validateCodeRequired'))
  if (!(d.name ?? '').trim()) errs.push(t('dictionary.validateNameRequired'))
  if ((d.sortOrder ?? 0) < 0) errs.push(t('dictionary.validateSortNonNegative'))
  return errs
}

export const mappingSourceSystems = ['SNOMED CT', 'LOINC', 'RadLex']
const mockMappings: MappingEntry[] = [
  { id: 'M-001', sourceCode: 'CT-BRAIN-NC', sourceSystem: 'SNOMED CT', targetCode: '384692009', targetSystem: 'SNOMED CT', accuracy: 0.98, status: 'verified', lastVerified: '2025-01-15' },
  { id: 'M-002', sourceCode: 'CT-CHEST-NC', sourceSystem: 'SNOMED CT', targetCode: '168537009', targetSystem: 'SNOMED CT', accuracy: 0.95, status: 'verified', lastVerified: '2025-01-15' },
  { id: 'M-003', sourceCode: 'CT-ABD-NC', sourceSystem: 'LOINC', targetCode: '24869-0', targetSystem: 'LOINC', accuracy: 0.90, status: 'verified', lastVerified: '2025-02-01' },
  { id: 'M-004', sourceCode: 'MR-T1WI', sourceSystem: 'RadLex', targetCode: 'RID10324', targetSystem: 'RadLex', accuracy: 0.88, status: 'unverified', lastVerified: '2025-02-10' },
  { id: 'M-005', sourceCode: 'DIAG-NORMAL', sourceSystem: 'SNOMED CT', targetCode: '260413007', targetSystem: 'SNOMED CT', accuracy: 0.97, status: 'verified', lastVerified: '2025-01-20' },
  { id: 'M-006', sourceCode: 'DR-CHEST-PA', sourceSystem: 'LOINC', targetCode: '18748-4', targetSystem: 'LOINC', accuracy: 0.85, status: 'conflict', lastVerified: '2025-03-01' },
]

const mockFhirSystems = [
  { system: 'http://snomed.info/sct', name: 'SNOMED CT', version: '2025-03' },
  { system: 'http://loinc.org', name: 'LOINC', version: '2.76' },
  { system: 'http://radlex.org', name: 'RadLex', version: '4.1' },
]

const mockConcepts: FhirConcept[] = [
  { code: '384692009', display: 'CT of head', system: 'http://snomed.info/sct', children: [
    { code: '168537009', display: 'CT of chest', system: 'http://snomed.info/sct', children: [
      { code: '24869-0', display: 'CT Abdomen', system: 'http://loinc.org' },
    ]},
  ]},
]

const mockVersionHistory: VersionEntry[] = [
  { id: 'V-001', dictionaryId: 'DICT-CT-001', version: 'v1.0', status: 'published', changedBy: '张明', changedAt: '2025-01-10 09:00', changes: '初始创建', snapshot: {} },
  { id: 'V-002', dictionaryId: 'DICT-CT-001', version: 'v1.1', status: 'published', changedBy: '李华', changedAt: '2025-02-15 14:30', changes: '修改扫描参数备注', snapshot: {} },
  { id: 'V-003', dictionaryId: 'DICT-CT-001', version: 'v2.0', status: 'review', changedBy: '王芳', changedAt: '2025-04-01 10:00', changes: '更新适应症描述，新增适应症说明', snapshot: {} },
  { id: 'V-004', dictionaryId: 'DICT-MR-001', version: 'v1.0', status: 'published', changedBy: '张明', changedAt: '2025-01-15 11:00', changes: '初始创建', snapshot: {} },
  { id: 'V-005', dictionaryId: 'DICT-MR-001', version: 'v1.1', status: 'draft', changedBy: '陈静', changedAt: '2025-05-20 16:00', changes: '更新序列参数', snapshot: {} },
]

const mockUsageStats: UsageStat[] = [
  { termName: '颅脑CT平扫', usageCount: 1256, department: '急诊科', trend: [120, 135, 142, 138, 150, 155] },
  { termName: '胸部CT平扫', usageCount: 982, department: '呼吸科', trend: [98, 105, 112, 108, 115, 120] },
  { termName: '未见明显异常', usageCount: 3450, department: '放射科', trend: [320, 340, 355, 348, 360, 370] },
  { termName: '腰椎正侧位', usageCount: 892, department: '骨科', trend: [85, 90, 88, 92, 95, 98] },
  { termName: '脑梗死', usageCount: 567, department: '神经内科', trend: [55, 58, 52, 60, 62, 65] },
  { termName: '肺结节', usageCount: 723, department: '呼吸科', trend: [68, 72, 75, 78, 80, 85] },
  { termName: '骨折', usageCount: 445, department: '骨科', trend: [42, 45, 40, 48, 50, 52] },
]

export default function DictionaryPage() {
  // [W4-A] 数据字典接真 API: 初始为空, 挂载后从 GET /dictionary/categories + GET /dictionary/:category 加载
  const [dictionaries, setDictionaries] = useState<DictionaryItem[]>([])
  const [dictLoading, setDictLoading] = useState(false)
  const [dictLoadError, setDictLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalityFilter, setModalityFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 12
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'delete' | null>(null)
  const [editingDictionary, setEditingDictionary] = useState<Partial<DictionaryItem>>(emptyDictionary())
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'dictionary' | 'mapping' | 'fhir' | 'version' | 'import' | 'analytics'>('dictionary')

  // [W4-A] 从 API 全量加载字典 (分类 Tab + 条目)
  const loadDictionary = async () => {
    setDictLoading(true)
    setDictLoadError(null)
    try {
      const catRes = await dictionaryApi.listCategories()
      const cats = catRes.success && Array.isArray(catRes.data?.categories) ? catRes.data!.categories : []
      const items: DictionaryItem[] = []
      for (const c of cats.slice(0, 50)) {
        const res = await dictionaryApi.listEntries(c.category)
        if (!res.success || !Array.isArray(res.data)) continue
        for (const e of res.data) {
          const ext = (e.extra ?? {}) as Record<string, unknown>
          items.push({
            id: e.id,
            category: e.category,
            code: e.key,
            name: e.value,
            pinyin: typeof ext.pinyin === 'string' ? ext.pinyin : '',
            modality: Array.isArray(ext.modality) ? (ext.modality as string[]) : [],
            bodyPart: typeof ext.bodyPart === 'string' ? ext.bodyPart : '',
            sortOrder: e.sort ?? 0,
            isActive: e.active !== false,
            notes: typeof ext.notes === 'string' ? ext.notes : '',
          })
        }
      }
      setDictionaries(items)
    } catch (e: any) {
      setDictLoadError(e?.message ?? String(e))
    } finally {
      setDictLoading(false)
    }
  }

  useEffect(() => {
    void loadDictionary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(dictionaries.map(d => (d.category ?? '')))]
    return cats.sort()
  }, [dictionaries])

  const modalities = useMemo(() => {
    const mods = [...new Set(dictionaries.flatMap(d => d.modality ?? []))]
    return mods.sort()
  }, [dictionaries])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return dictionaries.filter(d => {
      const matchSearch = !kw ||
        (d.name ?? '').toLowerCase().includes(kw) ||
        (d.code ?? '').toLowerCase().includes(kw) ||
        (d.pinyin ?? '').toLowerCase().includes(kw) ||
        (d.notes ?? '').toLowerCase().includes(kw) ||
        (d.bodyPart ?? '').toLowerCase().includes(kw)
      const matchCategory = !categoryFilter || ((d.category ?? '')) === categoryFilter
      const matchModality = !modalityFilter || (d.modality ?? []).includes(modalityFilter)
      return matchSearch && matchCategory && matchModality
    })
  }, [dictionaries, search, categoryFilter, modalityFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const stats = useMemo(() => {
    const total = dictionaries.length
    const active = dictionaries.filter(d => d.isActive).length
    const catCount = categories.length
    return { total, active, catCount }
  }, [dictionaries, categories])

  // [v3.0.6.8-24] 提升 hooks 到顶层 (修复 React #310: 条件 renderXxxTab 调用导致 hook 顺序变化)
  // 术语映射
  const [mappings, setMappings] = useState<MappingEntry[]>(mockMappings)
  const [mappingSearch, setMappingSearch] = useState('')
  const [showImportMapping, setShowImportMapping] = useState(false)
  // FHIR 服务
  const [fhirSearch, setFhirSearch] = useState('')
  const [selectedConcept, setSelectedConcept] = useState<FhirConcept | null>(null)
  // 版本管理
  const [versions] = useState<VersionEntry[]>(mockVersionHistory)
  const [selectedDict, setSelectedDict] = useState('DICT-CT-001')
  const [diffView, setDiffView] = useState<string | null>(null)
  // 导入导出
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'validate'>('upload')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ success: number; errors: number; warnings: string[] } | null>(null)

  const openAdd = () => {
    setEditingDictionary(emptyDictionary())
    setFormErrors([])
    setModalMode('add')
  }

  const openEdit = (d: DictionaryItem) => {
    setEditingDictionary({ ...d })
    setFormErrors([])
    setModalMode('edit')
  }

  const openDelete = (d: DictionaryItem) => {
    setEditingDictionary({ ...d })
    setModalMode('delete')
  }

  const closeModal = () => setModalMode(null)

  const handleSubmit = async () => {
    if (modalMode === 'delete') {
      setSaving(true)
      try {
        const res = await dictionaryApi.deleteEntry(editingDictionary.category ?? '', editingDictionary.code ?? '')
        if (res.success) {
          message.success(t('w9a.dictionary.itemDeleted', { name: editingDictionary.name }))
          closeModal()
          await loadDictionary()
        } else {
          message.error(res.error?.message ?? t('dictionary.deleteFailed'))
        }
      } catch (e: any) {
        message.error(t('w9a.dictionary.deleteFailedPrefix') + (e?.message ?? String(e)))
      } finally {
        setSaving(false)
      }
      return
    }
    const errs = validateDictionary(editingDictionary)
    if (errs.length > 0) { setFormErrors(errs); return }
    const extra = {
      pinyin: editingDictionary.pinyin ?? '',
      modality: editingDictionary.modality ?? [],
      bodyPart: editingDictionary.bodyPart ?? '',
      notes: editingDictionary.notes ?? '',
    }
    const payload = {
      key: (editingDictionary.code ?? '').trim(),
      value: (editingDictionary.name ?? '').trim(),
      sort: editingDictionary.sortOrder ?? 0,
      active: editingDictionary.isActive ?? true,
      extra,
    }
    setSaving(true)
    try {
      let res
      if (modalMode === 'add') {
        res = await dictionaryApi.createEntry(editingDictionary.category ?? '', payload)
      } else {
        res = await dictionaryApi.updateEntry(editingDictionary.category ?? '', editingDictionary.code ?? '', payload)
      }
      if (res.success) {
        message.success(modalMode === 'add' ? t('dictionary.added') : t('dictionary.saved'))
        closeModal()
        await loadDictionary()
      } else {
        message.error(res.error?.message ?? t('dictionary.saveFailed'))
      }
    } catch (e: any) {
      message.error(t('w9a.dictionary.saveFailedPrefix') + (e?.message ?? String(e)))
    } finally {
      setSaving(false)
    }
  }

  const handleField = (field: keyof Partial<DictionaryItem>, value: string | number | boolean | string[]) => {
    setEditingDictionary(prev => ({ ...prev, [field]: value }))
  }

  const handleModalityToggle = (mod: string) => {
    const current = editingDictionary.modality ?? []
    setEditingDictionary(prev => ({
      ...prev,
      modality: current.includes(mod) ? current.filter(m => m !== mod) : [...current, mod],
    }))
  }

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setModalityFilter('')
    setPage(1)
  }

  const renderTab = (key: string, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => { setActiveTab(key as any); setPage(1) }}
      style={{ ...s.tab, ...(activeTab === key ? s.tabActive : s.tabInactive), display: 'flex', alignItems: 'center', gap: 6 }}
    >
      {icon} {label}
    </button>
  )

  const renderDictionaryTab = () => (
    <>
      <div style={s.toolbar}>
        <div style={s.searchBox}>
          <Search size={15} color="var(--text-secondary)" />
          <input
            style={s.searchInput}
            placeholder={t('dictionary.searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
              <X size={13} color="var(--text-secondary)" />
            </button>
          )}
        </div>
        <select
          style={s.select}
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('dictionary.allCategories')}</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select
          style={s.select}
          value={modalityFilter}
          onChange={e => { setModalityFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('dictionary.allDevices')}</option>
          {modalities.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {(search || categoryFilter || modalityFilter) && (
          <button style={s.btnIcon} onClick={resetFilters}>
            <RotateCcw size={13} /> {t('dictionary.reset')}
          </button>
        )}
        <button style={s.btnPrimary} onClick={openAdd}>
          <Plus size={15} /> {t('dictionary.addItem')}
        </button>
      </div>

      {/* [W4-A] 分类 Tab (来自 API 分类列表) */}
      <div style={s.tabBar}>
        <button
          style={{ ...s.tab, ...(categoryFilter === '' ? s.tabActive : s.tabInactive), display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => { setCategoryFilter(''); setPage(1) }}
        >
          <Layers size={14} /> {t('dictionary.all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            style={{ ...s.tab, ...(categoryFilter === cat ? s.tabActive : s.tabInactive) }}
            onClick={() => { setCategoryFilter(cat); setPage(1) }}
          >
            {cat}
          </button>
        ))}
      </div>

      {dictLoading && (
        <div style={{ background: 'var(--color-info-bg)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#1e40af' }}>
          {t('dictionary.loading')}
        </div>
      )}
      {dictLoadError && !dictLoading && (
        <div style={{ background: 'var(--color-error-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#b91c1c' }}>
          {t('dictionary.loadFailed')}: {dictLoadError} ({t('dictionary.loadFailedHint')})
        </div>
      )}

      {paged.length === 0 ? (
        <Card bordered={false} style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
          <div style={s.emptyState}>
            <div style={s.emptyIcon}><BookOpen size={28} color="var(--text-secondary)" /></div>
            <div style={s.emptyTitle}>{t('dictionary.emptyTitle')}</div>
            <div style={s.emptyDesc}>{t('dictionary.emptyDesc')}</div>
            <button style={s.btnPrimary} onClick={openAdd}><Plus size={15} /> {t('dictionary.addFirstItem')}</button>
          </div>
        </Card>
      ) : (
        <div style={{ overflowX: "auto" }}><table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('dictionary.category')}</th>
              <th style={s.th}>{t('dictionary.code')}</th>
              <th style={s.th}>{t('dictionary.name')}</th>
              <th style={s.th}>{t('dictionary.modality')}</th>
              <th style={s.th}>{t('dictionary.bodyPart')}</th>
              <th style={s.th}>{t('dictionary.pinyin')}</th>
              <th style={s.th}>{t('dictionary.sortOrder')}</th>
              <th style={s.th}>{t('dictionary.status')}</th>
              <th style={s.th}>{t('dictionary.notes')}</th>
              <th style={s.th}>{t('dictionary.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(d => (
              <tr key={d.id} style={{ background: 'var(--bg-card)', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#fafbff'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
              >
                <td style={s.td}>
                  <span style={{ ...s.categoryTag, ...(categoryColors[(d.category ?? '')] || { backgroundColor: 'var(--content-bg)', color: 'var(--text-secondary)' }) }}>
                    {d.category ?? ''}
                  </span>
                </td>
                <td style={s.td}>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--content-bg)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                    {d.code ?? ''}
                  </code>
                </td>
                <td style={s.td}>
                  <div style={{ fontWeight: 600, color: '#1e40af' }}>{d.name ?? ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{d.id}</div>
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(d.modality ?? []).map(m => (
                      <span key={m} style={{ ...s.modalityBadge, backgroundColor: modalityColors[m]?.bg || '#f1f5f9', color: modalityColors[m]?.color || '#475569' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.bodyPart || '-'}</span></td>
                <td style={s.td}><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{d.pinyin || '-'}</span></td>
                <td style={s.td}><span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{d.sortOrder ?? 0}</span></td>
                <td style={s.td}>
                  <span style={{ ...s.badge, ...(d.isActive ? s.badgeActive : s.badgeInactive) }}>
                    {d.isActive ? t('dictionary.enabled') : t('dictionary.disabled')}
                  </span>
                </td>
                <td style={s.td}>
                  <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 12 }} title={d.notes}>
                    {d.notes || '-'}
                  </div>
                </td>
                <td style={s.td}>
                  <div style={s.actions}>
                    <button style={{ ...s.btnIcon, minHeight: 32, padding: '6px 10px' }} onClick={() => openEdit(d)} title={t('dictionary.edit')}><Edit2 size={14} /> {t('dictionary.edit')}</button>
                    <button style={{ ...s.btnDanger, minHeight: 32, padding: '6px 10px' }} onClick={() => openDelete(d)} title={t('dictionary.delete')}><Trash2 size={14} /> {t('dictionary.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      <div style={s.pagination}>
        <div style={s.pageInfo}>
          {t('dictionary.totalPrefix')} <strong style={{ color: '#1e40af' }}>{filtered.length}</strong> {t('dictionary.recordsSuffix')}，
          {t('dictionary.pagePrefix')} <strong style={{ color: '#1e40af' }}>{page}</strong> / <strong style={{ color: '#1e40af' }}>{totalPages}</strong> {t('dictionary.pageSuffix')}
        </div>
        <div style={s.pageBtns}>
          <button style={{ ...s.pageBtn, ...(page === 1 ? s.pageBtnDisabled : {}) }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let num = i + 1
            if (totalPages > 5) {
              if (page > 3) num = page - 2 + i
              if (page > totalPages - 2) num = totalPages - 4 + i
            }
            return (
              <button key={num} style={{ ...s.pageBtn, ...(page === num ? s.pageBtnActive : {}) }} onClick={() => setPage(num)}>
                {num}
              </button>
            )
          })}
          <button style={{ ...s.pageBtn, ...(page === totalPages ? s.pageBtnDisabled : {}) }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </>
  )

  const renderMappingTab = () => {
    const filteredMappings = mappings.filter(m =>
      !mappingSearch || m.sourceCode.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.targetCode.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.sourceSystem.toLowerCase().includes(mappingSearch.toLowerCase())
    )
    const unmapped = dictionaries.filter(d => !mappings.find(m => m.sourceCode === d.code))

    const handleImportMappings = () => {
      const newMappings: MappingEntry[] = unmapped.slice(0, 3).map((d, i) => ({
        id: `M-NEW-${i}`,
        sourceCode: d.code,
        sourceSystem: 'SNOMED CT',
        targetCode: 'AUTO-' + d.code.slice(-4),
        targetSystem: 'SNOMED CT',
        accuracy: 0.75,
        status: 'unverified' as const,
        lastVerified: new Date().toISOString().slice(0, 10),
      }))
      setMappings(prev => [...prev, ...newMappings])
      setShowImportMapping(true)
      setTimeout(() => setShowImportMapping(false), 2000)
    }

    return (
      <div>
        <div style={s.chartCard}>
          <div style={s.chartTitle}><Code size={16} /> SNOMED/LOINC/RadLex {t('dictionary.termMapping')} <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>{t('dictionary.demoDataMapping')}</span></div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div style={s.searchBox}>
              <Search size={15} color="var(--text-secondary)" />
              <input style={s.searchInput} placeholder={t('dictionary.mappingSearchPlaceholder')} value={mappingSearch} onChange={e => setMappingSearch(e.target.value)} />
            </div>
            <button style={s.btnPrimary} onClick={handleImportMappings}><Upload size={13} /> {t('dictionary.importMappingsCsv')}</button>
          </div>
          {showImportMapping && (
            <div style={{ background: 'var(--color-success-bg)', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="#16a34a" />
              <span style={{ fontSize: 12, color: '#166534' }}>{t('dictionary.imported3Mappings')}</span>
            </div>
          )}
          {unmapped.length > 0 && (
            <div style={{ background: 'var(--color-warning-bg)', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="#d97706" />
              <span style={{ fontSize: 12, color: '#92400e' }}>{t('dictionary.unmappedFound', { count: unmapped.length })} <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMappingSearch('UNMAPPED')}>{t('dictionary.viewReport')}</button></span>
            </div>
          )}
          <div style={{ overflowX: "auto" }}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('dictionary.sourceCode')}</th>
                <th style={s.th}>{t('dictionary.sourceSystem')}</th>
                <th style={s.th}>{t('dictionary.targetCode')}</th>
                <th style={s.th}>{t('dictionary.targetSystem')}</th>
                <th style={s.th}>{t('dictionary.accuracy')}</th>
                <th style={s.th}>{t('dictionary.status')}</th>
                <th style={s.th}>{t('dictionary.lastVerified')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map(m => (
                <tr key={m.id}>
                  <td style={s.td}><code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--content-bg)', padding: '2px 6px', borderRadius: 4 }}>{m.sourceCode}</code></td>
                  <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.sourceSystem}</span></td>
                  <td style={s.td}><code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-info-bg)', padding: '2px 6px', borderRadius: 4, color: '#2563eb' }}>{m.targetCode}</code></td>
                  <td style={s.td}>{m.targetSystem}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                        <div style={{ width: `${m.accuracy * 100}%`, height: 6, background: m.accuracy > 0.9 ? '#16a34a' : m.accuracy > 0.8 ? '#f59e0b' : '#dc2626', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(m.accuracy * 100)}%</span>
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.badge,
                      background: m.status === 'verified' ? '#dcfce7' : m.status === 'unverified' ? '#fef3c7' : '#fee2e2',
                      color: m.status === 'verified' ? '#16a34a' : m.status === 'unverified' ? '#d97706' : '#dc2626',
                    }}>
                      {m.status === 'verified' ? t('dictionary.verified') : m.status === 'unverified' ? t('dictionary.unverified') : t('dictionary.conflict')}
                    </span>
                  </td>
                  <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.lastVerified}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.mappingsTotal', { count: filteredMappings.length })}</div>
        </div>
      </div>
    )
  }

  const renderFhirTab = () => {
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={s.chartCard}>
            <div style={s.chartTitle}><Server size={16} /> FHIR Terminology Service <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>{t('dictionary.demoDataTerm')}</span></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={s.searchBox}>
                <Search size={15} color="var(--text-secondary)" />
                <input style={s.searchInput} placeholder={t('dictionary.fhirSearchPlaceholder')} value={fhirSearch} onChange={e => setFhirSearch(e.target.value)} />
              </div>
              <select style={s.select}>
                <option value="">{t('dictionary.allSystems')}</option>
                {mockFhirSystems.map(fs => <option key={fs.system} value={fs.system}>{fs.name} ({fs.version})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {mockFhirSystems.map(fs => (
                <div key={fs.system} style={{ background: 'var(--content-bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{fs.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fs.system}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.version')} {fs.version}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--content-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t('dictionary.conceptTree')}</div>
              {mockConcepts.map(concept => (
                <div key={concept.code} style={{ paddingLeft: 0 }}>
                  <div
                    onClick={() => setSelectedConcept(concept)}
                    style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4, background: selectedConcept?.code === concept.code ? '#dbeafe' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Layers size={14} color="#2563eb" />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{concept.display}</span>
                    <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({concept.code})</code>
                  </div>
                  {concept.children?.map(child => (
                    <div key={child.code} style={{ paddingLeft: 24 }}>
                      <div
                        onClick={() => setSelectedConcept(child)}
                        style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4, background: selectedConcept?.code === child.code ? '#dbeafe' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Layers size={14} color="var(--text-secondary)" />
                        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{child.display}</span>
                        <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({child.code})</code>
                      </div>
                      {child.children?.map(grandchild => (
                        <div key={grandchild.code} style={{ paddingLeft: 48 }}>
                          <div style={{ padding: '6px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={14} color="var(--text-secondary)" />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{grandchild.display}</span>
                            <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({grandchild.code})</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        {selectedConcept && (
          <div style={{ width: 320 }}>
            <div style={s.chartCard}>
              <div style={s.chartTitle}><Globe size={16} /> {t('dictionary.conceptDetail')}</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dictionary.code')}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{selectedConcept.code}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dictionary.displayName')}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{selectedConcept.display}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dictionary.system')}</div>
                <div style={{ fontSize: 12, color: '#2563eb', wordBreak: 'break-all' }}>{selectedConcept.system}</div>
              </div>
              <button
                style={s.btnPrimary}
                onClick={async () => {
                  try {
                    const res = await dictionaryApi.createEntry('诊断术语', {
                      key: selectedConcept.code,
                      value: selectedConcept.display,
                      sort: dictionaries.length + 1,
                      active: true,
                      extra: { pinyin: '', modality: [], bodyPart: '', notes: `从 FHIR ${selectedConcept.system} 导入` },
                    });
                    if (res.success) {
                      setDictionaries(prev => [{
                        id: res.data?.id ?? uniqueId('DICT'),
                        category: '诊断术语',
                        code: selectedConcept.code,
                        name: selectedConcept.display,
                        pinyin: '',
                        modality: [],
                        bodyPart: '',
                        sortOrder: prev.length + 1,
                        isActive: true,
                        notes: `从 FHIR ${selectedConcept.system} 导入`,
                      } as DictionaryItem, ...prev]);
                      message.success(t('w9a.dictionary.conceptApplied', { display: selectedConcept.display, code: selectedConcept.code }));
                    } else {
                      message.error(res.error?.message || t('dictionary.applyFailed'));
                    }
                  } catch (e: any) {
                    message.error(t('w9a.dictionary.applyFailedPrefix') + (e?.message || String(e)));
                  }
                }}
              >{t('dictionary.applyToDictionary')}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderVersionTab = () => {
    const dictVersions = versions.filter(v => v.dictionaryId === selectedDict)
    const dictOptions = [...new Set(versions.map(v => v.dictionaryId))]

    return (
      <div>
        <div style={s.chartCard}>
          <div style={s.chartTitle}><History size={16} /> {t('dictionary.versionManagement')} <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>{t('dictionary.demoDataVersion')}</span></div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <select style={{ ...s.select, minWidth: 200 }} value={selectedDict} onChange={e => setSelectedDict(e.target.value)}>
              {dictOptions.map(d => <option key={d} value={d}>{d} - {dictionaries.find(di => di.id === d)?.name || d}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.versionsTotal', { count: dictVersions.length })}</span>
          </div>
          <div style={{ overflowX: "auto" }}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('dictionary.versionNumber')}</th>
                <th style={s.th}>{t('dictionary.status')}</th>
                <th style={s.th}>{t('dictionary.changedBy')}</th>
                <th style={s.th}>{t('dictionary.changedAt')}</th>
                <th style={s.th}>{t('dictionary.changeDesc')}</th>
                <th style={s.th}>{t('dictionary.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {dictVersions.map(v => (
                <tr key={v.id}>
                  <td style={s.td}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e40af' }}>{v.version}</span></td>
                  <td style={s.td}>
                    <span style={{
                      ...s.badge,
                      background: v.status === 'published' ? '#dcfce7' : v.status === 'review' ? '#fef3c7' : '#f1f5f9',
                      color: v.status === 'published' ? '#16a34a' : v.status === 'review' ? '#d97706' : '#94a3b8',
                    }}>
                      {v.status === 'published' ? t('dictionary.published') : v.status === 'review' ? t('dictionary.reviewing') : t('dictionary.draft')}
                    </span>
                  </td>
                  <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.changedBy}</span></td>
                  <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.changedAt}</span></td>
                  <td style={s.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.changes}</span></td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={s.btnIcon} onClick={() => setDiffView(diffView === v.id ? null : v.id)}>
                        <Eye size={14} /> {diffView === v.id ? t('dictionary.collapse') : t('dictionary.view')}
                      </button>
                      {v.status === 'draft' && (
                        <button style={{ ...s.btnPrimary, padding: '6px 10px', minHeight: 32 }}
                          onClick={async () => {
                            try {
                              const payload: TermUpdatePayload = { status: 'review' };
                              const res = await termApi.update(v.id, payload);
                              if (res.success) {
                                message.success(t('w9a.dictionary.versionSubmittedReview', { version: v.version }));
                              } else {
                                message.error(res.error?.message || t('dictionary.submitReviewFailed'));
                              }
                            } catch (e: any) {
                              message.error(t('w9a.dictionary.submitReviewFailedPrefix') + (e?.message || String(e)));
                            }
                          }}
                        >
                          <Shield size={14} /> {t('dictionary.submitReview')}
                        </button>
                      )}
                      {v.status === 'review' && (
                        <button style={{ ...s.btnPrimary, background: '#16a34a', padding: '6px 10px', minHeight: 32 }}
                          onClick={async () => {
                            try {
                              const payload: TermUpdatePayload = { status: 'published' };
                              const res = await termApi.update(v.id, payload);
                              if (res.success) {
                                message.success(t('w9a.dictionary.versionApprovedPublished', { version: v.version }));
                              } else {
                                message.error(res.error?.message || t('dictionary.publishFailed'));
                              }
                            } catch (e: any) {
                              message.error(t('w9a.dictionary.publishFailedPrefix') + (e?.message || String(e)));
                            }
                          }}
                        >
                          <CheckCircle2 size={14} /> {t('dictionary.approvePublish')}
                        </button>
                      )}
                      {v.status === 'published' && (
                        <button
                          style={{ ...s.btnIcon, color: '#d97706' }}
                          onClick={async () => {
                            try {
                              const payload: TermUpdatePayload = { ...v.snapshot, notes: `已回滚到 ${v.version} @ ${new Date().toISOString()}` };
                              const res = await termApi.update(v.id, payload);
                              if (res.success) {
                                message.success(`已回滚字典版本 ${v.version}`);
                                setDictionaries(prev => prev.map(d => d.id === v.dictionaryId ? { ...d, ...(v.snapshot as Partial<DictionaryItem>) } : d));
                              } else {
                                message.error(res.error?.message || t('dictionary.rollbackFailed'));
                              }
                            } catch (e: any) {
                              message.error(t('w9a.dictionary.rollbackFailedPrefix') + (e?.message || String(e)));
                            }
                          }}
                        >
                          <RotateCcw size={14} /> {t('dictionary.rollback')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {diffView && (
            <div style={{ marginTop: 12, background: 'var(--content-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t('dictionary.diffViewTitle')}</div>
              <div style={{ fontSize: 12, color: '#059669', background: 'var(--color-success-bg)', padding: '6px 10px', borderRadius: 4, marginBottom: 4 }}>{t('dictionary.diffAdded')}</div>
              <div style={{ fontSize: 12, color: '#dc2626', background: 'var(--color-error-bg)', padding: '6px 10px', borderRadius: 4 }}>{t('dictionary.diffRemoved')}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderImportTab = () => {
    const handleImport = async () => {
      if (!importFile) return
      setImportStep('validate')
      let text = ''
      try {
        text = await importFile.text()
      } catch (e: any) {
        setImportResult({ success: 0, errors: 1, warnings: [t('w9a.dictionary.fileReadFailed') + (e?.message ?? String(e))] })
        return
      }
      const trimmed = text.trim()
      const lines = trimmed.split(/\r?\n/).filter(l => l.trim())
      const rows: Array<Record<string, string>> = []
      if (trimmed.startsWith('[')) {
        try {
          const arr = JSON.parse(trimmed)
          if (Array.isArray(arr)) rows.push(...arr.map((r: any) => ({
            category: String(r.category ?? ''),
            code: String(r.code ?? r.key ?? ''),
            name: String(r.name ?? r.value ?? ''),
          })))
        } catch { rows.length = 0 }
      } else if (lines.length >= 2) {
        const header = (lines[0] ?? '').split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        for (const line of lines.slice(1)) {
          const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
          const row: Record<string, string> = {}
          header.forEach((h, i) => { row[h] = cells[i] ?? '' })
          rows.push(row)
        }
      }
      if (rows.length === 0) {
        setImportResult({ success: 0, errors: 1, warnings: [t('dictionary.noRowsParsed')] })
        return
      }
      const warnings: string[] = []
      let success = 0
      let errors = 0
      for (const row of rows) {
        const category = String(row['分类'] ?? row.category ?? '').trim()
        const code = String(row['编码'] ?? row.code ?? '').trim()
        const name = String(row['名称'] ?? row.name ?? '').trim()
        if (!category || !code || !name) { errors++; warnings.push(t('w9a.dictionary.importSkipMissing', { code: code || '-' })); continue }
        try {
          const res = await dictionaryApi.createEntry(category, { key: code, value: name, sort: 0, active: true, extra: {} })
          if (res.success) success++
          else { errors++; warnings.push(`${code}: ${res.error?.message ?? t('w9a.dictionary.importFailed')}`) }
        } catch (e: any) {
          errors++
          warnings.push(`${code}: ${e?.message ?? String(e)}`)
        }
      }
      setImportResult({ success, errors, warnings })
      if (success > 0) await loadDictionary()
    }

    const handleExport = (format: 'csv' | 'json') => {
      const data = format === 'json' ? JSON.stringify(dictionaries, null, 2) : '编码,名称,分类\n' + dictionaries.map(d => `${d.code},${d.name},${d.category}`).join('\n')
      const blob = new Blob(['\ufeff' + data], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `dictionary_export.${format}`
      a.click()
    }

    return (
      <div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={s.chartCard}>
              <div style={s.chartTitle}><Upload size={16} /> {t('dictionary.batchImport')}</div>
              {importStep === 'upload' && (
                <>
                  <div style={{ border: '2px dashed var(--border-color)', borderRadius: 8, padding: 40, textAlign: 'center', marginBottom: 12, cursor: 'pointer' }}
                    onClick={() => document.getElementById('importFileInput')?.click()}
                  >
                    <FileSpreadsheet size={32} color="var(--text-secondary)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('dictionary.clickSelectFile')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('dictionary.supportedFormats')}</div>
                    <input id="importFileInput" type="file" accept=".csv,.xlsx,.json" style={{ display: 'none' }} onChange={e => { setImportFile(e.target.files?.[0] || null) }} />
                  </div>
                  {importFile && (
                    <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileSpreadsheet size={15} color="#2563eb" />
                      <span style={{ fontSize: 12, color: '#1e40af' }}>{importFile.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({(importFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('dictionary.fieldMapping')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[{ file: t('dictionary.code'), dict: 'code' }, { file: t('dictionary.name'), dict: 'name' }, { file: t('dictionary.category'), dict: 'category' }, { file: t('dictionary.pinyin'), dict: 'pinyin' }, { file: t('dictionary.bodyPart'), dict: 'bodyPart' }].map(fm => (
                        <div key={fm.file} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 60 }}>{fm.file} →</span>
                          <input style={{ ...s.select, padding: '4px 8px', minHeight: 30 }} value={fm.dict} readOnly />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.btnPrimary} onClick={handleImport} disabled={!importFile}><Upload size={13} /> {t('dictionary.startImport')}</button>
                    <button
                    style={s.btnIcon}
                    onClick={() => {
                      const csv = '\ufeff编码,名称,分类,拼音,部位\n' +
                        dictionaries.map(d => `${d.code},${d.name},${d.category},${d.pinyin || ''},${d.bodyPart || ''}`).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = '字典导入模板.csv';
                      a.click();
                      URL.revokeObjectURL(a.href);
                      message.success(t('dictionary.templateDownloaded'));
                    }}
                  ><Download size={13} /> {t('dictionary.downloadTemplate')}</button>
                  </div>
                </>
              )}
              {importStep === 'validate' && importResult && (
                <div>
                  <div style={{ background: importResult.errors > 0 ? '#fef3c7' : '#dcfce7', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {importResult.errors > 0 ? <AlertTriangle size={15} color="#d97706" /> : <CheckCircle2 size={15} color="#16a34a" />}
                      <span style={{ fontSize: 13, fontWeight: 600, color: importResult.errors > 0 ? '#92400e' : '#166534' }}>
                        {t('dictionary.importDone', { success: importResult.success, errors: importResult.errors })}
                      </span>
                    </div>
                    {importResult.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#d97706', marginLeft: 24 }}>• {w}</div>
                    ))}
                  </div>
                  <button style={s.btnPrimary} onClick={() => { setImportStep('upload'); setImportResult(null); setImportFile(null) }}><RefreshCw size={13} /> {t('dictionary.continueImport')}</button>
                </div>
              )}
            </div>
          </div>
          <div style={{ width: 350 }}>
            <div style={s.chartCard}>
              <div style={s.chartTitle}><Download size={16} /> {t('dictionary.exportFilter')}</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('dictionary.filterConditions')}</div>
                <select style={{ ...s.select, marginBottom: 8, width: '100%' }}><option value="">{t('dictionary.allCategories')}</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select style={{ ...s.select, marginBottom: 8, width: '100%' }}><option value="all">{t('dictionary.statusAll')}</option><option value="active">{t('dictionary.statusActive')}</option><option value="inactive">{t('dictionary.statusInactive')}</option></select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btnPrimary} onClick={() => handleExport('csv')}><FileSpreadsheet size={13} /> {t('dictionary.exportCsv')}</button>
                <button style={s.btnPrimary} onClick={() => handleExport('json')}><Code size={13} /> {t('dictionary.exportJson')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderAnalyticsTab = () => {
    const mostUsed = [...mockUsageStats].sort((a, b) => b.usageCount - a.usageCount)
    const leastUsed = [...mockUsageStats].sort((a, b) => a.usageCount - b.usageCount).slice(0, 3)
    const departments = [...new Set(mockUsageStats.map(u => u.department))]

    return (
      <div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={s.chartCard}>
              <div style={s.chartTitle}><TrendingUp size={16} /> {t('dictionary.usageTrend')} <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>{t('dictionary.demoDataUsage')}</span></div>
              <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 10px' }}>
                {(mockUsageStats[0]?.trend ?? []).map((v, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', height: `${(v / 370) * 180}px`, background: '#3b82f6', borderRadius: '4px 4px 0 0', minHeight: 4, opacity: 0.7 + i * 0.05 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{[t('dictionary.month1'), t('dictionary.month2'), t('dictionary.month3'), t('dictionary.month4'), t('dictionary.month5'), t('dictionary.month6')][i]}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>{t('dictionary.basedOnUsage', { count: mockUsageStats.reduce((s, u) => s + u.usageCount, 0) })}</div>
            </div>

            <div style={s.chartCard}>
              <div style={s.chartTitle}><BarChart2 size={16} /> {t('dictionary.topTerms')}</div>
              {mostUsed.slice(0, 5).map((u, i) => (
                <div key={u.termName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? '#d97706' : '#94a3b8', minWidth: 20 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{u.termName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.department}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{u.usageCount}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: 350 }}>
            <div style={s.chartCard}>
              <div style={s.chartTitle}><Users size={16} /> {t('dictionary.deptUsage')}</div>
              {departments.map(dept => {
                const deptStats = mockUsageStats.filter(u => u.department === dept)
                const total = deptStats.reduce((s, u) => s + u.usageCount, 0)
                return (
                  <div key={dept} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>{dept}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.deptUsageCount', { total, count: deptStats.length })}</div>
                    <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ width: `${(total / 3450) * 100}%`, height: 4, background: '#3b82f6', borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={s.chartCard}>
              <div style={s.chartTitle}><AlertTriangle size={16} /> {t('dictionary.cleanupSuggestions')}</div>
              {leastUsed.map(u => (
                <div key={u.termName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <PieChart size={14} color="#f59e0b" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.termName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.usedOnlyTimes', { count: u.usageCount })}</div>
                  </div>
                  <button style={{ ...s.btnDanger, padding: '4px 8px', minHeight: 28, fontSize: 12 }}
                    onClick={async () => {
                      try {
                        const payload: TermUpdatePayload = { isActive: false };
                        const res = await termApi.update(u.termName, payload);
                        if (res.success) {
                          message.success(t('w9a.dictionary.termDeactivateSuggested', { name: u.termName }));
                          setDictionaries(prev => prev.map(d => d.name === u.termName ? { ...d, isActive: false } : d));
                        } else {
                          message.error(res.error?.message || t('dictionary.operationFailed'));
                        }
                      } catch (e: any) {
                        message.error(t('w9a.dictionary.operationFailedPrefix') + (e?.message || String(e)));
                      }
                    }}
                  >
                    <Trash2 size={10} /> {t('dictionary.suggestDeactivate')}
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.cleanupHint')}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-card)', minHeight: '100vh', padding: 20, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' }}>
      <div style={s.pageHeader}>
        <PageHeader
          variant="flex"
          title={t('dictionary.pageTitle')}
          subtitle={t('dictionary.pageSubtitle')}
          style={{ marginBottom: 0 }}
        />
        <div style={s.stats}>
          <div style={s.statCard}>
            <BookOpen size={15} color="var(--text-secondary)" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1e40af' }}>{stats.total}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.entries')}</div>
            </div>
          </div>
          <div style={s.statCard}>
            <Activity size={15} color="#16a34a" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{stats.active}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.statusActive')}</div>
            </div>
          </div>
          <div style={s.statCard}>
            <Filter size={15} color="#7c3aed" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>{stats.catCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dictionary.categoryCount')}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={s.tabBar}>
        {renderTab('dictionary', t('dictionary.tabBrowse'), <BookOpen size={14} />)}
        {renderTab('mapping', t('dictionary.tabMapping'), <Code size={14} />)}
        {renderTab('fhir', t('dictionary.tabFhir'), <Server size={14} />)}
        {renderTab('version', t('dictionary.tabVersion'), <History size={14} />)}
        {renderTab('import', t('dictionary.tabImport'), <FileSpreadsheet size={14} />)}
        {renderTab('analytics', t('dictionary.tabAnalytics'), <TrendingUp size={14} />)}
      </div>

      {activeTab === 'dictionary' && renderDictionaryTab()}
      {activeTab === 'mapping' && renderMappingTab()}
      {activeTab === 'fhir' && renderFhirTab()}
      {activeTab === 'version' && renderVersionTab()}
      {activeTab === 'import' && renderImportTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}

      {modalMode && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>
            {modalMode === 'delete' ? (
              <>
                <div style={s.modalHeader}>
                  <div style={s.modalTitle}>{t('dictionary.confirmDeleteTitle')}</div>
                  <button style={s.modalClose} onClick={closeModal}><X size={16} /></button>
                </div>
                <div style={s.modalBody}>
                  <div style={s.deleteModalText}>{t('dictionary.confirmDeletePrefix')} <strong>"{editingDictionary.name}"</strong> {t('dictionary.confirmDeleteSuffix')}</div>
                  <div style={s.deleteModalText}>{t('dictionary.deleteIrreversible')}</div>
                </div>
                <div style={s.modalFooter}>
                  <button style={s.btnCancel} onClick={closeModal}>{t('dictionary.cancel')}</button>
                  <button style={s.btnDeleteConfirm} onClick={() => void handleSubmit()} disabled={saving}>{saving ? t('dictionary.deleting') : t('dictionary.confirmDelete')}</button>
                </div>
              </>
            ) : (
              <>
                <div style={s.modalHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} color="#60a5fa" />
                    <span style={s.modalTitle}>{modalMode === 'add' ? t('dictionary.addItemTitle') : t('dictionary.editItemTitle')}</span>
                  </div>
                  <button style={s.modalClose} onClick={closeModal}><X size={16} /></button>
                </div>
                <div style={s.modalBody}>
                  {formErrors.length > 0 && (
                    <div style={{ background: 'var(--color-error-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                      {formErrors.map((err, i) => <div key={i} style={{ fontSize: 12, color: '#dc2626' }}>• {err}</div>)}
                    </div>
                  )}
                  <div style={s.formGrid}>
                    <div style={s.formGroup}>
                      <label style={s.label}>{t('dictionary.category')} <span style={s.required}>*</span></label>
                      <select style={s.input} value={editingDictionary.category ?? ''} disabled={modalMode === 'edit'} onChange={e => handleField('category', e.target.value)}>
                        <option value="">{t('dictionary.pleaseSelectCategory')}</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>{t('dictionary.code')} <span style={s.required}>*</span></label>
                      <input style={s.input} placeholder={t('dictionary.codePlaceholder')} value={editingDictionary.code ?? ''} onChange={e => handleField('code', e.target.value)} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>{t('dictionary.name')} <span style={s.required}>*</span></label>
                      <input style={s.input} placeholder={t('dictionary.namePlaceholder')} value={editingDictionary.name ?? ''} onChange={e => handleField('name', e.target.value)} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>{t('dictionary.pinyinAbbr')}</label>
                      <input style={s.input} placeholder={t('dictionary.pinyinPlaceholder')} value={editingDictionary.pinyin ?? ''} onChange={e => handleField('pinyin', e.target.value)} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>{t('dictionary.bodyPartLabel')}</label>
                      <input style={s.input} placeholder={t('dictionary.bodyPartPlaceholder')} value={editingDictionary.bodyPart ?? ''} onChange={e => handleField('bodyPart', e.target.value)} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>{t('dictionary.sortOrderLabel')}</label>
                      <input style={s.input} type="number" min={0} placeholder="0" value={editingDictionary.sortOrder ?? 0} onChange={e => handleField('sortOrder', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={{ ...s.formGroup, ...s.formGroupFull }}>
                      <label style={s.label}>{t('dictionary.modalityLabel')}</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['CT', 'MR', 'DR', 'DSA', '乳腺', '胃肠'].map(m => {
                          const isSelected = (editingDictionary.modality ?? []).includes(m)
                          return (
                            <label key={m} onClick={() => handleModalityToggle(m)} style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                              fontSize: 12, fontWeight: 600, userSelect: 'none',
                              border: `1px solid ${isSelected ? (modalityColors[m]?.color || '#1e40af') : '#e2e8f0'}`,
                              background: isSelected ? (modalityColors[m]?.bg || '#eff6ff') : '#fff',
                              color: isSelected ? (modalityColors[m]?.color || '#1e40af') : '#94a3b8',
                            }}>
                              <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${isSelected ? (modalityColors[m]?.color || '#1e40af') : '#cbd5e1'}`, background: isSelected ? (modalityColors[m]?.color || '#1e40af') : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isSelected && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                              </div>
                              {m}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ ...s.formGroup, ...s.formGroupFull }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }} onClick={() => handleField('isActive', !editingDictionary.isActive)}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${editingDictionary.isActive ? '#16a34a' : '#cbd5e1'}`, background: editingDictionary.isActive ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {editingDictionary.isActive && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                        </div>
                        {t('dictionary.activeLabel')}
                      </label>
                    </div>
                    <div style={{ ...s.formGroup, ...s.formGroupFull }}>
                      <label style={s.label}>{t('dictionary.notesLabel')}</label>
                      <textarea style={s.textarea} placeholder={t('dictionary.notesPlaceholder')} value={editingDictionary.notes ?? ''} onChange={e => handleField('notes', e.target.value)} rows={2} />
                    </div>
                  </div>
                </div>
                <div style={s.modalFooter}>
                  <button style={s.btnCancel} onClick={closeModal}>{t('dictionary.cancel')}</button>
                  <button style={s.btnSubmit} onClick={() => void handleSubmit()} disabled={saving}>{saving ? t('dictionary.saving') : (modalMode === 'add' ? t('dictionary.confirmAdd') : t('dictionary.saveChanges'))}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

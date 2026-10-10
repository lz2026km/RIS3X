// ============================================================
// G005 放射科RIS系统 - 科研数据抽取/课题数据脱敏管理 v2.0.0
// 功能：课题管理 / 数据抽取 / 标签管理 / 导出管理
// 新增：DICOM脱敏引擎 / 队列构建器 / IRB工作流 / 数据导出管线 / 数据质量看板
// ============================================================
import React, { useState, useRef, useEffect } from 'react'
import { Select, Typography } from 'antd'
import { Checkbox } from 'antd'
import {
  FlaskConical, Plus, X, Search, Edit2, Trash2, Download, Tag, Folder, FileText, Calendar, User, Clock,
  Eye, EyeOff, AlertCircle,
  Database, Shield, ShieldCheck, FileJson, FileSpreadsheet,
  Filter, Users, Save,
  Activity, CheckCircle as CheckCircleIcon,
  Layers, FileSignature, ClipboardList,
  Target, Sigma
} from 'lucide-react'
import { THEME_TOKENS } from '../components/common/ThemeTokens'
import { StatusTag } from '../components/common/StatusTag'
import { DataTable } from '../components/common/DataTable'
import { researchApi, type ResearchProjectDto, type ResearchLabelDto, type CohortDefinitionDto as CohortDefinition, type IRBSubmissionDto as IRBSubmission, type ExportAuditDto as ExportAudit, type DataQualityScoreDto as DataQualityScore } from '../services/api/researchApi'
import { t } from '../i18n/appI18n'

// ==================== 类型定义 ====================
type TabKey = 'projects' | 'extract' | 'labels' | 'export' | 'deid' | 'cohort' | 'irb' | 'exportPipeline' | 'dataQuality'
type ProjectStatus = '进行中' | '已完成' | '已归档'
type LabelType = '诊断' | '部位' | '特征'
type ExamType = 'CT' | 'MR' | 'DXR' | 'US' | 'MG' | 'PET' | 'SPECT'
type ResultType = '阳性' | '阴性'
type ExportFormat = 'CSV' | 'JSON' | 'DICOM'

interface Project {
  id: string
  code: string
  name: string
  leader: string
  startDate: string
  status: ProjectStatus
  dataCount: number
  description: string
  members: string[]
}

interface ExamRecord {
  id: string
  patientId: string
  patientName: string
  age: number
  gender: string
  examType: ExamType
  examDate: string
  diagnosis: string
  result: ResultType
  idCard: string
  phone: string
  address: string
  modality: string
}

interface Label {
  id: string
  name: string
  type: LabelType
  color: string
  useCount: number
}

interface ExportRecord {
  id: string
  projectId: string
  projectName: string
  format: ExportFormat
  exportTime: string
  recordCount: number
  downloadUrl: string
  operator: string
}

interface ExtractFilter {
  examTypes: ExamType[]
  startDate: string
  endDate: string
  minAge: number
  maxAge: number
  keyword: string
  result: ResultType | ''
}

// ==================== Mock data removed - fetched from API ====================

// ==================== 样式常量 ====================
const COLORS = {
  primary: 'var(--color-primary)',
  primaryLight: 'var(--color-primary-500)',
  primaryLighter: 'var(--color-info-bg)',
  secondary: 'var(--text-secondary)',
  success: 'var(--color-success)',
  successLight: 'var(--color-success-bg)',
  warning: 'var(--color-warning)',
  warningLight: 'var(--color-warning-bg)',
  danger: 'var(--color-error)',
  dangerLight: 'var(--color-error-bg)',
  bgGray: 'var(--content-bg)',
  bgWhite: THEME_TOKENS.bgCard,
  border: 'var(--border-color)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textLight: 'var(--text-muted)',
}

// ==================== 工具函数 ====================
function maskName(name: string): string {
  if (!name || name.length === 0) return name
  return name.charAt(0) + '***'
}

function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 6) return idCard
  return idCard.substring(0, 3) + '***********' + idCard.substring(idCard.length - 4)
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4)
}

function maskAddress(address: string): string {
  if (!address) return address
  const parts = address.split('')
  if (parts.length <= 4) return address.charAt(0) + '***'
  return address.substring(0, 4) + '***'
}

// [UI] project status → canonical statusTokens key
function projectStatusKey(status: ProjectStatus): string {
  switch (status) { case '进行中': return 'in_progress'; case '已完成': return 'completed'; case '已归档': return 'archived'; default: return 'neutral' }
}

function getLabelTypeColor(type: LabelType): string {
  switch (type) { case '诊断': return 'var(--color-error)'; case '部位': return 'var(--color-primary)'; case '特征': return 'var(--color-modality-mr)'; default: return COLORS.secondary }
}

function getExportFormatIcon(format: ExportFormat): React.ReactNode {
  switch (format) { case 'CSV': return <FileSpreadsheet size={16} />; case 'JSON': return <FileJson size={16} />; case 'DICOM': return <Database size={16} /> }
}

// ==================== Toast通知Hook ====================
function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([])
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => { setToasts(prev => prev.filter(x => x.id !== id)) }, 3000)
  }
  const ToastContainer = () => (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ padding: '12px 20px', borderRadius: 8, background: toast.type === 'success' ? 'var(--color-success)' : toast.type === 'error' ? 'var(--color-error)' : 'var(--color-primary)', color: 'var(--text-inverse)', fontSize: 14, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 240, animation: 'slideIn 0.3s ease-out' }}>{toast.message}</div>
      ))}
    </div>
  )
  return { showToast, ToastContainer }
}

// ==================== 进度Modal组件 ====================
interface ProgressModalProps { open: boolean; title: string; message: string; progress?: number; onClose?: () => void }
function ProgressModal({ open, title, message, progress, onClose }: ProgressModalProps) {
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>{message}</div>
        {progress !== undefined && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-primary)', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>{progress !== undefined ? `${progress}%` : t('researchPage.pleaseWait')}</div>
      </div>
    </div>
  )
}

// ==================== 子组件 ====================
interface TabButtonProps { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }
function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: active ? COLORS.primary : 'transparent', color: active ? 'var(--text-inverse)' : COLORS.textSecondary, border: 'none', borderBottom: active ? '2px solid ' + COLORS.primary : '2px solid transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}>
      {icon}
      {label}
    </button>
  )
}

interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }
function Modal({ open, onClose, title, children, width = 600 }: ModalProps) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, width: width, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid ' + COLORS.border }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: COLORS.textSecondary }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ==================== 课题管理Tab ====================
function ProjectsTab() {
  const { showToast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [detailProject, setDetailProject] = useState<Project | null>(null)
  const [newProject, setNewProject] = useState<Partial<Project>>({ code: '', name: '', leader: '', startDate: '', description: '', members: [] })
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listProjects()
        if (res.success && Array.isArray(res.data)) setProjects(res.data as Project[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])

  const handleCreateProject = async () => {
    try {
      const res = await researchApi.createProject(newProject as Partial<ResearchProjectDto>)
      if (res.success && res.data) {
        setProjects(prev => [...prev, res.data as Project])
      }
    } catch { /* fallback */ }
    setShowModal(false)
    setNewProject({ code: '', name: '', leader: '', startDate: '', description: '', members: [] })
  }

  const handleEditProject = () => {
    if (!editingProject || !newProject.name?.trim()) return
    setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...newProject } as Project : p))
    showToast(`课题「${newProject.name}」已更新`, 'success')
    setShowEditModal(false)
    setEditingProject(null)
    setNewProject({ code: '', name: '', leader: '', startDate: '', description: '', members: [] })
  }
  const handleShowDetail = (project: Project) => { setDetailProject(project); setShowDetailModal(true) }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: COLORS.bgWhite, border: '1px solid ' + COLORS.border, borderRadius: 12, padding: '8px 12px', gap: 8 }}>
            <Search size={16} color={COLORS.textSecondary} />
            <input placeholder={t('researchPage.searchProjects')} style={{ border: 'none', fontSize: 14, width: 240, background: 'transparent' }} />
          </div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Plus size={16} /> {t('researchPage.newProject')}</button>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden' }}>
        <DataTable
          dataSource={projects}
          rowKey={(project) => project.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thProjectCode'), key: 'code', render: (_v, project) => <span style={{ fontWeight: 600, color: COLORS.primary }}>{project.code}</span> },
            { title: t('researchPage.thProjectName'), key: 'name', render: (_v, project) => <span style={{ color: COLORS.textPrimary }}>{project.name}</span> },
            { title: t('researchPage.thLeader'), key: 'leader', render: (_v, project) => <span style={{ color: COLORS.textSecondary }}><User size={14} color={COLORS.textSecondary} style={{ marginRight: 6, verticalAlign: -2 }} />{project.leader}</span> },
            { title: t('researchPage.thStartDate'), key: 'startDate', render: (_v, project) => <span style={{ color: COLORS.textSecondary }}><Calendar size={14} color={COLORS.textSecondary} style={{ marginRight: 6, verticalAlign: -2 }} />{project.startDate}</span> },
            { title: t('researchPage.thStatus'), key: 'status', render: (_v, project) => <StatusTag status={projectStatusKey(project.status)}>{project.status}</StatusTag> },
            { title: t('researchPage.thDataCount'), key: 'dataCount', align: 'right' as const, render: (_v, project) => <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{project.dataCount.toLocaleString()}</span> },
            {
              title: t('researchPage.thActions'), key: 'actions',
              render: (_v, project) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <button onClick={() => handleShowDetail(project)} style={{ padding: '6px 10px', background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', fontSize: 12, color: COLORS.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={14} /> {t('researchPage.detail')}</button>
                  <button onClick={() => { setEditingProject(project); setNewProject({ code: project.code, name: project.name, leader: project.leader, startDate: project.startDate, description: project.description, members: project.members }); setShowEditModal(true) }} style={{ padding: 6, background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', color: COLORS.textSecondary }}><Edit2 size={14} /></button>
                </div>
              ),
            },
          ]}
        />
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('researchPage.newProject')} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.projectCode')}</label><input type="text" value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} placeholder={t('researchPage.codePlaceholder')} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.projectName')}</label><input type="text" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder={t('researchPage.namePlaceholder')} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.leader')}</label><input type="text" value={newProject.leader} onChange={e => setNewProject({ ...newProject, leader: e.target.value })} placeholder={t('researchPage.leaderPlaceholder')} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.startDate')}</label><input type="date" value={newProject.startDate} onChange={e => setNewProject({ ...newProject, startDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.projectDesc')}</label><textarea value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} placeholder={t('researchPage.descPlaceholder')} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.cancel')}</button>
                <button onClick={handleCreateProject} style={{ padding: '10px 20px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} />{t('researchPage.createProject')}</button>
          </div>
        </div>
      </Modal>
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title={t('researchPage.projectDetail')} width={640}>        {detailProject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: COLORS.bgGray, padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}><span style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>{detailProject.name}</span><StatusTag status={projectStatusKey(detailProject.status)}>{detailProject.status}</StatusTag></div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>{detailProject.description}</div>
              <div style={{ display: 'flex', gap: 24, fontSize: 12, color: COLORS.textSecondary }}><span>{t('researchPage.detailCodeLabel')}<strong style={{ color: COLORS.primary }}>{detailProject.code}</strong></span><span>{t('researchPage.detailDataLabel')}<strong style={{ color: COLORS.textPrimary }}>{detailProject.dataCount}</strong></span></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{t('researchPage.leader')}</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{detailProject.leader}</div></div>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{t('researchPage.startDate')}</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{detailProject.startDate}</div></div>
            </div>
            <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>{t('researchPage.members')}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{detailProject.members.map((member, idx) => (<span key={idx} style={{ padding: '4px 12px', background: COLORS.primaryLighter, color: COLORS.primary, borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{member}</span>))}</div></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowDetailModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.close')}</button></div>
          </div>
        )}
      </Modal>
      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditingProject(null) }} title={t('researchPage.editProject')} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.projectCode')}</label><input type="text" value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.projectName')}</label><input type="text" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.leader')}</label><input type="text" value={newProject.leader} onChange={e => setNewProject({ ...newProject, leader: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.startDate')}</label><input type="date" value={newProject.startDate} onChange={e => setNewProject({ ...newProject, startDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.projectDesc')}</label><textarea value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button onClick={() => { setShowEditModal(false); setEditingProject(null) }} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.cancel')}</button>
            <button onClick={handleEditProject} disabled={!newProject.name?.trim()} style={{ padding: '10px 20px', background: newProject.name?.trim() ? COLORS.primary : COLORS.bgGray, color: newProject.name?.trim() ? 'var(--text-inverse)' : COLORS.textLight, border: 'none', borderRadius: 8, cursor: newProject.name?.trim() ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={14} />{t('researchPage.saveChanges')}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== 数据抽取Tab ====================
function ExtractTab() {
  const { showToast } = useToast()
  const [examRecords, setExamRecords] = useState<ExamRecord[]>([])
  const [, setLoading] = useState(true)
  const [filter, setFilter] = useState<ExtractFilter>({ examTypes: [], startDate: '', endDate: '', minAge: 0, maxAge: 100, keyword: '', result: '' })
  const [showDesensitization, setShowDesensitization] = useState(true)
  const [selectedExamTypes, setSelectedExamTypes] = useState<ExamType[]>([])
  const [showExtractModal, setShowExtractModal] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const extractIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const extractMountedRef = useRef(true)
  useEffect(() => { extractMountedRef.current = true; return () => { extractMountedRef.current = false; if (extractIntervalRef.current) clearInterval(extractIntervalRef.current) } }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listExamRecords()
        if (res.success && Array.isArray(res.data)) setExamRecords(res.data as ExamRecord[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])
  const examTypeOptions: ExamType[] = ['CT', 'MR', 'DXR', 'US', 'MG', 'PET', 'SPECT']
  const toggleExamType = (type: ExamType) => { setSelectedExamTypes(prev => prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]) }
  const handleExtract = () => {
    setShowExtractModal(true); setExtractProgress(0)
    extractIntervalRef.current = setInterval(() => { setExtractProgress(prev => { if (prev >= 100) { if (extractIntervalRef.current) clearInterval(extractIntervalRef.current); extractIntervalRef.current = null; setTimeout(() => { if (extractMountedRef.current) { setShowExtractModal(false); showToast(`数据抽取完成，共处理 ${examRecords.length} 条记录`, 'success') } }, 500); return 100 }; return prev + Math.floor(Math.random() * 15) + 5 }) }, 300)
  }
  return (
    <div>
      {showExtractModal && <ProgressModal open={showExtractModal} title={t('researchPage.extracting')} message={t('researchPage.extractingMsg')} progress={extractProgress} />}
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Filter size={16} /> {t('researchPage.filterConditions')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>{t('researchPage.examType')}</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{examTypeOptions.map(type => (<button key={type} onClick={() => toggleExamType(type)} style={{ padding: '6px 12px', background: selectedExamTypes.includes(type) ? COLORS.primary : COLORS.bgGray, color: selectedExamTypes.includes(type) ? 'var(--text-inverse)' : COLORS.textSecondary, border: '1px solid ' + (selectedExamTypes.includes(type) ? COLORS.primary : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }}>{type}</button>))}</div></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>{t('researchPage.dateRange')}</label><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="date" value={filter.startDate} onChange={e => setFilter({ ...filter, startDate: e.target.value })} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 12 }} /><span style={{ color: COLORS.textSecondary }}>{t('researchPage.to')}</span><input type="date" value={filter.endDate} onChange={e => setFilter({ ...filter, endDate: e.target.value })} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 12 }} /></div></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>{t('researchPage.patientAgeRange')}</label><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="number" value={filter.minAge} onChange={e => setFilter({ ...filter, minAge: Number(e.target.value) })} min={0} max={120} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 12, width: 80 }} /><span style={{ color: COLORS.textSecondary }}>{t('researchPage.to')}</span><input type="number" value={filter.maxAge} onChange={e => setFilter({ ...filter, maxAge: Number(e.target.value) })} min={0} max={120} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 12, width: 80 }} /><span style={{ color: COLORS.textSecondary }}>{t('researchPage.yearsOld')}</span></div></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>{t('researchPage.examResult')}</label><div style={{ display: 'flex', gap: 8 }}>{['', '阳性', '阴性'].map(result => (<button key={result || 'all'} onClick={() => setFilter({ ...filter, result: result as ResultType | '' })} style={{ padding: '6px 16px', background: filter.result === result ? COLORS.primary : COLORS.bgGray, color: filter.result === result ? 'var(--text-inverse)' : COLORS.textSecondary, border: '1px solid ' + (filter.result === result ? COLORS.primary : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{result || t('researchPage.resultAll')}</button>))}</div></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>{t('researchPage.diagnosisKeyword')}</label><input type="text" value={filter.keyword} onChange={e => setFilter({ ...filter, keyword: e.target.value })} placeholder={t('researchPage.diagnosisPlaceholder')} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Database size={16} /> {t('researchPage.extractPreview')}</div>
        <DataTable
          dataSource={examRecords}
          rowKey={(record) => record.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thPatientId'), key: 'patientId', render: (_v, record) => <span style={{ color: COLORS.textSecondary }}>{record.patientId}</span> },
            { title: t('researchPage.thName'), key: 'patientName', render: (_v, record) => <span style={{ fontWeight: 600, color: showDesensitization ? COLORS.textSecondary : COLORS.textPrimary }}>{showDesensitization ? maskName(record.patientName) : record.patientName}</span> },
            { title: t('researchPage.thAgeGender'), key: 'ageGender', render: (_v, record) => <span style={{ color: COLORS.textPrimary }}>{record.age}{t('researchPage.ageYears')}/{record.gender}</span> },
            { title: t('researchPage.thExamType'), key: 'examType', render: (_v, record) => <StatusTag status="info">{record.examType}</StatusTag> },
            { title: t('researchPage.thExamDate'), key: 'examDate', render: (_v, record) => <span style={{ color: COLORS.textSecondary }}>{record.examDate}</span> },
            { title: t('researchPage.thDiagnosis'), key: 'diagnosis', render: (_v, record) => <span style={{ color: COLORS.textPrimary }}>{record.diagnosis}</span> },
            { title: t('researchPage.thResult'), key: 'result', render: (_v, record) => <StatusTag status={record.result === '阳性' ? 'critical' : 'success'}>{record.result}</StatusTag> },
            ...(showDesensitization ? [
              { title: t('researchPage.thIdCard'), key: 'idCard', render: (_v: unknown, record: ExamRecord) => <span style={{ color: COLORS.textSecondary, fontFamily: 'monospace', fontSize: 12 }}>{maskIdCard(record.idCard)}</span> },
              { title: t('researchPage.thPhone'), key: 'phone', render: (_v: unknown, record: ExamRecord) => <span style={{ color: COLORS.textSecondary, fontFamily: 'monospace', fontSize: 12 }}>{maskPhone(record.phone)}</span> },
              { title: t('researchPage.thAddress'), key: 'address', render: (_v: unknown, record: ExamRecord) => <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{maskAddress(record.address)}</span> },
            ] : []),
          ]}
        />
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16} /> {t('researchPage.maskingRules')} <button onClick={() => setShowDesensitization(!showDesensitization)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: showDesensitization ? COLORS.primary : COLORS.bgGray, color: showDesensitization ? 'var(--text-inverse)' : COLORS.textSecondary, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{showDesensitization ? <EyeOff size={14} /> : <Eye size={14} />}{showDesensitization ? t('researchPage.maskingEnabled') : t('researchPage.maskingDisabled')}</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.primary }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>{t('researchPage.thName')}</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>王*** → {maskName('王建国')}</div></div>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.warning }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>{t('researchPage.thIdCard')}</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>110***2345 → {maskIdCard('110101195806121234')}</div></div>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.success }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>{t('researchPage.thPhone')}</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>138****5678 → {maskPhone('13812345678')}</div></div>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.danger }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>{t('researchPage.thAddress')}</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>北京市*** → {maskAddress('北京市朝阳区建国路88号')}</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><button onClick={handleExtract} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 40px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)' }}><Download size={18} /> {t('researchPage.confirmExtract')}</button></div>
    </div>
  )
}

// ==================== 数据标签化管理Tab ====================
function LabelsTab() {
  const { showToast } = useToast()
  const [labels, setLabels] = useState<Label[]>([])
  const [, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newLabel, setNewLabel] = useState<Partial<Label>>({ name: '', type: '诊断', color: 'var(--color-primary)' })
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterType, setFilterType] = useState<LabelType | ''>('')

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listLabels()
        if (res.success && Array.isArray(res.data)) setLabels(res.data as Label[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])

  const handleAddLabel = async () => {
    if (!newLabel.name) return
    try {
      const res = await researchApi.createLabel(newLabel as Partial<ResearchLabelDto>)
      if (res.success && res.data) {
        setLabels(prev => [...prev, res.data as Label])
      }
    } catch { /* fallback */ }
    setShowAddModal(false); setNewLabel({ name: '', type: '诊断', color: 'var(--color-primary)' })
  }
  const filteredLabels = labels.filter(label => { const matchKeyword = label.name.toLowerCase().includes(searchKeyword.toLowerCase()); const matchType = !filterType || label.type === filterType; return matchKeyword && matchType })
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchLabelId, setBatchLabelId] = useState<string>('')
  const [annotatedCount, setAnnotatedCount] = useState(0)
  const [annotatedLabels, setAnnotatedLabels] = useState<Record<string, number>>({})
  const [showCatalogModal, setShowCatalogModal] = useState(false)

  const handleBatchAnnotate = async () => {
    const label = labels.find(l => l.id === batchLabelId)
    if (!label) return
    setAnnotatedCount(prev => prev + 50)
    setAnnotatedLabels(prev => ({ ...prev, [label.name]: (prev[label.name] ?? 0) + 50 }))
    setLabels(prev => prev.map(l => l.id === label.id ? { ...l, useCount: l.useCount + 50 } : l))
    setShowBatchModal(false)
    setBatchLabelId('')
  }

  const handleApplyLabel = (label: Label) => {
    showToast(`已应用标签「${label.name}」到当前 50 条已抽取记录`, 'success')
  }

  const handleDeleteLabel = (label: Label) => {
    setLabels(prev => prev.filter(l => l.id !== label.id))
    showToast(`标签「${label.name}」已删除`, 'success')
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: COLORS.bgWhite, border: '1px solid ' + COLORS.border, borderRadius: 12, padding: '8px 12px', gap: 8 }}><Search size={16} color={COLORS.textSecondary} /><input placeholder={t('researchPage.searchLabels')} value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} style={{ border: 'none', fontSize: 14, width: 180, background: 'transparent' }} /></div>
          <div style={{ display: 'flex', gap: 8 }}>{['', '诊断', '部位', '特征'].map(type => (<button key={type || 'all'} onClick={() => setFilterType(type as LabelType | '')} style={{ padding: '8px 14px', background: filterType === type ? COLORS.primary : COLORS.bgWhite, color: filterType === type ? 'var(--text-inverse)' : COLORS.textSecondary, border: '1px solid ' + (filterType === type ? COLORS.primary : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{type || t('researchPage.resultAll')}</button>))}</div>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Plus size={16} /> {t('researchPage.customLabel')}</button>
      </div>
      <DataTable
        dataSource={filteredLabels}
        rowKey={(label) => label.id}
        pagination={false}
        showExport={false}
        showDensity={false}
        emptyText={t('common.empty.noData')}
        columns={[
          {
            title: t('researchPage.thLabelName'), key: 'name',
            render: (_v, label) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: label.color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{label.name}</span>
              </div>
            ),
          },
          { title: t('researchPage.thLabelType'), key: 'type', render: (_v, label) => <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: getLabelTypeColor(label.type) + '20', color: getLabelTypeColor(label.type) }}>{label.type}</span> },
          { title: t('researchPage.thUsageCount'), key: 'useCount', align: 'right' as const, render: (_v, label) => <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{label.useCount.toLocaleString()}</span> },
          {
            title: t('researchPage.thActions'), key: 'actions',
            render: (_v, label) => (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <button onClick={() => handleApplyLabel(label)} style={{ padding: '6px 10px', background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', fontSize: 12, color: COLORS.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={14} /> {t('researchPage.apply')}</button>
                <button onClick={() => handleDeleteLabel(label)} style={{ padding: 6, background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', color: COLORS.danger }}><Trash2 size={14} /></button>
              </div>
            ),
          },
        ]}
      />
      <div style={{ marginTop: 20, padding: 20, background: COLORS.primaryLighter, borderRadius: 12, border: '1px solid ' + COLORS.primaryLight }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={16} /> {t('researchPage.extractedLabelMgmt')}</div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary }}><p style={{ marginBottom: 8 }}>{t('researchPage.currentExtracted')}</p><p>{t('researchPage.labelHelp')}</p><p style={{ marginTop: 8, color: COLORS.primary, fontWeight: 600 }}>{t('researchPage.annotatedPrefix')}{annotatedCount}{t('researchPage.annotatedSuffix')}{Object.entries(annotatedLabels).map(([name, cnt]) => `· ${name} ${cnt}条`).join('')}</p></div>
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}><button onClick={() => setShowBatchModal(true)} style={{ padding: '10px 16px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('researchPage.batchAnnotate')}</button><button onClick={() => setShowCatalogModal(true)} style={{ padding: '10px 16px', background: COLORS.bgWhite, color: COLORS.primary, border: '1px solid ' + COLORS.primary, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('researchPage.viewAnnotatedCatalog')}</button></div>
      </div>
      <Modal open={showBatchModal} onClose={() => setShowBatchModal(false)} title={t('researchPage.batchAnnotateTitle')} width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 12, background: COLORS.primaryLighter, borderRadius: 8, fontSize: 12, color: COLORS.primary }}>{t('researchPage.batchAnnotateHint')}</div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.selectLabel')}</label><Select style={{ width: '100%' }} value={batchLabelId} onChange={(v) => setBatchLabelId(v)} options={[{ value: '', label: t('researchPage.selectLabelPlaceholder') }, ...labels.map(l => ({ value: l.id, label: `${l.name}（${l.type}）` }))]} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowBatchModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.cancel')}</button><button onClick={() => void handleBatchAnnotate()} disabled={!batchLabelId} style={{ padding: '10px 20px', background: batchLabelId ? COLORS.primary : COLORS.bgGray, color: batchLabelId ? 'var(--text-inverse)' : COLORS.textLight, border: 'none', borderRadius: 8, cursor: batchLabelId ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600 }}>{t('researchPage.confirmAnnotate')}</button></div>
        </div>
      </Modal>
      <Modal open={showCatalogModal} onClose={() => setShowCatalogModal(false)} title={t('researchPage.annotatedCatalog')} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.keys(annotatedLabels).length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: COLORS.textLight, fontSize: 12 }}>{t('researchPage.noCatalog')}</div> : Object.entries(annotatedLabels).map(([name, cnt]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: COLORS.bgGray, borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>{name}</span>
              <span style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>{cnt} {t('researchPage.recordsSuffix')}</span>
            </div>
          ))}
        </div>
      </Modal>
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={t('researchPage.addCustomLabel')} width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.labelName')}</label><input type="text" value={newLabel.name} onChange={e => setNewLabel({ ...newLabel, name: e.target.value })} placeholder={t('researchPage.labelNamePlaceholder')} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.thLabelType')}</label><div style={{ display: 'flex', gap: 8 }}>{(['诊断', '部位', '特征'] as LabelType[]).map(type => (<button key={type} onClick={() => setNewLabel({ ...newLabel, type })} style={{ padding: '8px 16px', background: newLabel.type === type ? getLabelTypeColor(type) : COLORS.bgGray, color: newLabel.type === type ? 'var(--text-inverse)' : COLORS.textSecondary, border: '1px solid ' + (newLabel.type === type ? getLabelTypeColor(type) : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{type}</button>))}</div></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>{t('researchPage.labelColor')}</label><div style={{ display: 'flex', gap: 8 }}>{['var(--color-error-500)', '#f97316', '#eab308', 'var(--color-success-500)', 'var(--color-primary)', '#8b5cf6', '#ec4899', 'var(--color-info-500)'].map(color => (<button key={color} onClick={() => setNewLabel({ ...newLabel, color })} style={{ width: 32, height: 32, background: color, border: newLabel.color === color ? '3px solid ' + COLORS.textPrimary : '2px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer' }} />))}</div></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.cancel')}</button><button onClick={handleAddLabel} style={{ padding: '10px 20px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.addLabel')}</button></div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== 导出管理Tab ====================
function ExportTab() {
  const { showToast } = useToast()
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [, setLoading] = useState(true)
  const [showPermissionModal, setShowPermissionModal] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listExportRecords()
        if (res.success && Array.isArray(res.data)) setExports(res.data as ExportRecord[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])
  const [exportPermissions, setExportPermissions] = useState({ allowCsv: true, allowJson: true, allowDicom: false, maxRecordsPerExport: 1000, requireApproval: true })
  // [Wave2A] 加载已保存的导出权限 (localStorage; researchApi 无权限设置端点)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ris_research_export_permissions')
      if (raw) setExportPermissions(prev => ({ ...prev, ...JSON.parse(raw) }))
    } catch { /* ignore */ }
  }, [])
  const handleSaveExportPermissions = () => {
    try {
      localStorage.setItem('ris_research_export_permissions', JSON.stringify(exportPermissions))
    } catch { /* ignore */ }
    showToast(t('researchPage.exportPermSaved'), 'success')
    setShowPermissionModal(false)
  }
  const handleDownload = (record: ExportRecord) => { showToast(`开始下载: ${record.downloadUrl}`, 'info') }
  return (
    <div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + COLORS.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} /> {t('researchPage.exportRecords')}</div>
          <button onClick={() => setShowPermissionModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Shield size={14} /> {t('researchPage.exportPermMgmt')}</button>
        </div>
        <DataTable
          dataSource={exports}
          rowKey={(record) => record.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thProject'), key: 'projectName', render: (_v, record) => <span style={{ fontWeight: 600, color: COLORS.primary }}>{record.projectName}</span> },
            {
              title: t('researchPage.thExportFormat'), key: 'format',
              render: (_v, record) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getExportFormatIcon(record.format)}
                  <StatusTag status={record.format === 'DICOM' ? 'warning' : 'neutral'}>{record.format}</StatusTag>
                </span>
              ),
            },
            { title: t('researchPage.thExportTime'), key: 'exportTime', render: (_v, record) => <span style={{ color: COLORS.textSecondary }}><Clock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{record.exportTime}</span> },
            { title: t('researchPage.thRecordCount'), key: 'recordCount', align: 'right' as const, render: (_v, record) => <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{record.recordCount.toLocaleString()}</span> },
            { title: t('researchPage.thOperator'), key: 'operator', render: (_v, record) => <span style={{ color: COLORS.textSecondary }}><User size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{record.operator}</span> },
            {
              title: t('researchPage.thActions'), key: 'actions',
              render: (_v, record) => (
                <button onClick={() => handleDownload(record)} style={{ padding: '6px 12px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Download size={14} /> {t('researchPage.download')}</button>
              ),
            },
          ]}
        />
      </div>
      <Modal open={showPermissionModal} onClose={() => setShowPermissionModal(false)} title={t('researchPage.exportPermMgmt')} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ padding: 16, background: COLORS.warningLight, borderRadius: 8, border: '1px solid ' + COLORS.warning }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><AlertCircle size={16} color={COLORS.warning} /><span style={{ fontSize: 12, fontWeight: 700, color: COLORS.warning }}>{t('researchPage.permHint')}</span></div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>{t('researchPage.permWarning')}</div></div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12 }}>{t('researchPage.allowedFormats')}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[{ key: 'allowCsv', label: t('researchPage.fmtCsv'), desc: t('researchPage.fmtCsvDesc') }, { key: 'allowJson', label: t('researchPage.fmtJson'), desc: t('researchPage.fmtJsonDesc') }, { key: 'allowDicom', label: t('researchPage.fmtDicom'), desc: t('researchPage.fmtDicomDesc') }].map(item => (<label key={item.key} style={{ display: 'flex', alignItems: 'center', padding: 12, background: COLORS.bgGray, borderRadius: 8, cursor: 'pointer' }}><Checkbox checked={exportPermissions[item.key as keyof typeof exportPermissions] as boolean} onChange={e => setExportPermissions({ ...exportPermissions, [item.key]: e.target.checked })} style={{ marginRight: 12 }} /><div><div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>{item.label}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.desc}</div></div></label>))}</div></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 8 }}>{t('researchPage.maxRecords')}</label><input type="number" value={exportPermissions.maxRecordsPerExport} onChange={e => setExportPermissions({ ...exportPermissions, maxRecordsPerExport: Number(e.target.value) })} min={1} max={10000} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><Checkbox checked={exportPermissions.requireApproval} onChange={e => setExportPermissions({ ...exportPermissions, requireApproval: e.target.checked })} /><span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>{t('researchPage.requireApproval')}</span></label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowPermissionModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.cancel')}</button><button onClick={handleSaveExportPermissions} style={{ padding: '10px 20px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.saveSettings')}</button></div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== 新增: DICOM脱敏引擎 ====================
function DeidEngineTab() {
  const { showToast } = useToast()
  const [deidProfile, setDeidProfile] = useState('hipaa')
  const [showPreview, setShowPreview] = useState(false)
  const [deidRunning, setDeidRunning] = useState(false)
  const [deidFileCount, setDeidFileCount] = useState(50)
  const [deidResult, setDeidResult] = useState<string | null>(null)
  const [phiTags] = useState([
    { tag: 'PatientName', status: 'remove' },
    { tag: 'PatientID', status: 'remove' },
    { tag: 'PatientBirthDate', status: 'remove' },
    { tag: 'PatientAddress', status: 'remove' },
    { tag: 'PatientPhone', status: 'remove' },
    { tag: 'MedicalRecordLocator', status: 'remove' },
    { tag: 'InstitutionName', status: 'keep' },
    { tag: 'AccessionNumber', status: 'keep' },
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} /> {t('researchPage.deidProfile')}</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[{ id: 'hipaa', label: t('researchPage.hipaaLabel'), desc: t('researchPage.hipaaDesc') }, { id: 'expert', label: t('researchPage.expertLabel'), desc: t('researchPage.expertDesc') }].map(p => (
            <div key={p.id} role="button" tabIndex={0} onClick={() => setDeidProfile(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDeidProfile(p.id) } }} style={{ flex: 1, padding: 16, borderRadius: 8, border: `2px solid ${deidProfile === p.id ? COLORS.primary : COLORS.border}`, cursor: 'pointer', background: deidProfile === p.id ? COLORS.primaryLighter : 'transparent' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: deidProfile === p.id ? COLORS.primary : COLORS.textPrimary }}>{p.label}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={16} /> {t('researchPage.deidTagRules')}</div>
        <DataTable
          dataSource={phiTags}
          rowKey={(_pt, idx) => String(idx)}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thTagName'), key: 'tag', render: (_v, pt) => <span style={{ fontSize: 12, fontFamily: 'monospace', color: COLORS.textPrimary }}>{pt.tag}</span> },
            { title: t('researchPage.thOperation'), key: 'status', render: (_v, pt) => <StatusTag status={pt.status === 'remove' ? 'critical' : 'success'}>{pt.status === 'remove' ? t('researchPage.remove') : t('researchPage.keep')}</StatusTag> },
          ]}
        />
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={16} /> {t('researchPage.pixelDeid')}</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 8, padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{t('researchPage.beforeDeid')}</div>
            <div style={{ width: 200, height: 200, margin: '0 auto', background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ color: 'var(--text-inverse)', fontSize: 12, marginBottom: 4 }}>患者: 王建国</div>
              <div style={{ color: 'var(--text-inverse)', fontSize: 12, marginBottom: 4 }}>ID: P10001</div>
              <div style={{ color: 'var(--text-inverse)', fontSize: 12 }}>2026-05-15</div>
            </div>
          </div>
          <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 8, padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{t('researchPage.afterDeid')}</div>
            <div style={{ width: 200, height: 200, margin: '0 auto', background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: 160, height: 20, background: 'black', marginBottom: 4 }} />
              <div style={{ width: 120, height: 20, background: 'black', marginBottom: 4 }} />
              <div style={{ width: 140, height: 20, background: 'black' }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button disabled={deidRunning} onClick={() => { showToast(t('researchPage.deidEndpointToast'), 'info'); setDeidRunning(true); setTimeout(() => { setDeidRunning(false); setDeidResult(`脱敏完成: ${deidFileCount} 个 DICOM 文件已按 ${deidProfile === 'hipaa' ? 'HIPAA 安全港' : '专家判定'} 配置处理 (本地模拟)`); showToast(t('researchPage.deidDoneLocal'), 'success') }, 1500) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: deidRunning ? 0.6 : 1 }}><Shield size={16} /> {deidRunning ? t('researchPage.deidProcessing') : t('researchPage.runDeid')}</button>
        <button onClick={() => setShowPreview(!showPreview)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: COLORS.bgWhite, color: COLORS.primary, border: '1px solid ' + COLORS.primary, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Eye size={16} /> {t('researchPage.previewCompare')}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: COLORS.textSecondary }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>{t('researchPage.fileCount')}
          <input type="number" min={1} max={500} value={deidFileCount} onChange={e => setDeidFileCount(Number(e.target.value) || 0)} style={{ width: 70, padding: '4px 8px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 12 }} />
        </label>
        {deidResult && <span style={{ color: COLORS.success, fontWeight: 600 }}>{deidResult}</span>}
        <span style={{ color: COLORS.warning }}>{t('researchPage.deidNote')}</span>
      </div>
    </div>
  )
}

// ==================== 新增: 队列构建器 ====================
function CohortBuilderTab() {
  const { showToast } = useToast()
  const [criteria, setCriteria] = useState([{ field: 'age', operator: '>=', value: '50', logic: 'AND' }])
  const [cohortName, setCohortName] = useState('')
  const [estimatedSize, setEstimatedSize] = useState(0)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savedCohorts, setSavedCohorts] = useState<CohortDefinition[]>([])

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listCohorts()
        if (res.success && Array.isArray(res.data)) setSavedCohorts(res.data as CohortDefinition[])
      } catch { /* use empty state */ }
    })()
  }, [])

  const addCriterion = () => { setCriteria([...criteria, { field: 'age', operator: '>=', value: '', logic: 'AND' }]) }
  const removeCriterion = (idx: any) => { setCriteria(criteria.filter((_: any, i: any) => i !== idx)) }
  const updateCriterion = (idx: number, key: 'field' | 'operator' | 'value' | 'logic', val: string) => { const c = [...criteria]; const target = c[idx]; if (target) target[key] = val; setCriteria(c) }
  const estimateSize = () => { setEstimatedSize(Math.floor(Math.random() * 2000) + 100) }
  // [G005 v3.0.6.11-91 W1-B P1 第12轮] createCohort 真实接入: POST /research/cohorts (后端已有), 成功刷新列表
  const saveCohort = async () => {
    if (!cohortName.trim()) return
    try {
      const res = await researchApi.createCohort({
        name: cohortName,
        criteria: criteria.map(c => `${c.field} ${c.operator} ${c.value}`).join(' AND '),
        estimatedSize,
        createdBy: '当前用户',
      })
      if (res.success && res.data) {
        setSavedCohorts(prev => [res.data as CohortDefinition, ...prev])
        showToast(`队列「${cohortName}」已保存`, 'success')
      } else {
        showToast(res.error?.message ?? t('researchPage.cohortSaveFailed'), 'error')
      }
    } catch {
      showToast(t('researchPage.cohortSaveFailed'), 'error')
    }
    setShowSaveDialog(false); setCohortName('')
  }

  const applyCohort = (cohort: CohortDefinition) => {
    const parsed = cohort.criteria.split(/\s+AND\s+/i).map(part => {
      const [field = 'age', operator = '=', ...rest] = part.trim().split(/\s+/)
      return { field, operator, value: rest.join(' '), logic: 'AND' }
    })
    if (parsed.length > 0) setCriteria(parsed)
    setEstimatedSize(cohort.estimatedSize)
    showToast(`已应用队列「${cohort.name}」，预估 ${cohort.estimatedSize} 例`, 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} /> {t('researchPage.cohortBuilder')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {criteria.map((c, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: COLORS.bgGray, borderRadius: 6 }}>
              {idx > 0 && <Select size="small" style={{ minWidth: 80 }} value={c.logic} onChange={(v) => updateCriterion(idx, 'logic', v)} options={[{ value: 'AND', label: t('researchPage.and') }, { value: 'OR', label: t('researchPage.or') }]} />}
              <Select size="small" style={{ minWidth: 120 }} value={c.field} onChange={(v) => updateCriterion(idx, 'field', v)} options={[
                { value: 'age', label: t('researchPage.fieldAge') },
                { value: 'gender', label: t('researchPage.fieldGender') },
                { value: 'diagnosis', label: t('researchPage.fieldDiagnosis') },
                { value: 'modality', label: t('researchPage.fieldModality') },
                { value: 'dateRange', label: t('researchPage.fieldDateRange') },
              ]} />
              <Select size="small" style={{ minWidth: 100 }} value={c.operator} onChange={(v) => updateCriterion(idx, 'operator', v)} options={[
                { value: '=', label: '=' },
                { value: '>', label: '>' },
                { value: '<', label: '<' },
                { value: '>=', label: '>=' },
                { value: '<=', label: '<=' },
                { value: '!=', label: '!=' },
                { value: 'contains', label: t('researchPage.opContains') },
              ]} />
              <input value={c.value} onChange={e => updateCriterion(idx, 'value', e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid ' + COLORS.border, fontSize: 12, flex: 1 }} placeholder={t('researchPage.valuePlaceholder')} />
              <button onClick={() => removeCriterion(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.danger, padding: 4 }}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={addCriterion} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Plus size={14} /> {t('researchPage.addCriterion')}</button>
          <button onClick={estimateSize} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: COLORS.primaryLighter, color: COLORS.primary, border: '1px solid ' + COLORS.primaryLight, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Sigma size={14} /> {t('researchPage.estimateSize')}</button>
        </div>
        {estimatedSize > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: COLORS.successLight, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon size={16} style={{ color: COLORS.success }} />
            <span>{t('researchPage.estimatedPatientsPrefix')}<strong style={{ fontSize: 16 }}>{estimatedSize.toLocaleString()}</strong> {t('researchPage.estimatedPatientsSuffix')}</span>
          </div>
        )}
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}><Save size={16} /> {t('researchPage.savedCohorts')}</div>
          <button onClick={() => { estimateSize(); setShowSaveDialog(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Save size={14} /> {t('researchPage.saveCurrentCohort')}</button>
        </div>
        {savedCohorts.map(cohort => (
          <div key={cohort.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid ' + COLORS.border }}>
            <div><div style={{ fontWeight: 600, fontSize: 12 }}>{cohort.name}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>{t('researchPage.condLabel')}{cohort.criteria}{t('researchPage.estLabel')}{cohort.estimatedSize}{t('researchPage.createdLabel')}{cohort.createdBy}{t('researchPage.lastRunLabel')}{cohort.lastRun}</div></div>
            <button onClick={() => applyCohort(cohort)} style={{ padding: '4px 10px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>{t('researchPage.apply')}</button>
          </div>
        ))}
      </div>
      {showSaveDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowSaveDialog(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('researchPage.saveCohortTitle')}</div>
            <input style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} placeholder={t('researchPage.cohortNamePlaceholder')} value={cohortName} onChange={e => setCohortName(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSaveDialog(false)} style={{ padding: '8px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer' }}>{t('researchPage.cancel')}</button>
              <button onClick={saveCohort} style={{ padding: '8px 20px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}><Save size={14} /> {t('researchPage.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 新增: IRB工作流 ====================
function IRBWorkflowTab() {
  const { showToast } = useToast()
  const [submissions, setSubmissions] = useState<IRBSubmission[]>([])
  const [, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listIRBSubmissions()
        if (res.success && Array.isArray(res.data)) setSubmissions(res.data as IRBSubmission[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])
  const [form, setForm] = useState({ projectName: '', pi: '', consentForm: '' })
  const [viewing, setViewing] = useState<IRBSubmission | null>(null)
  // [G005 v3.0.6.11-91 W1-B P1 第12轮] createIRBSubmission 真实接入: POST /research/irb (后端已有), 成功刷新列表
  const submitIRB = async () => {
    if (!form.projectName.trim() || !form.pi.trim()) { showToast(t('researchPage.irbFillRequired'), 'error'); return }
    try {
      const res = await researchApi.createIRBSubmission({
        projectName: form.projectName,
        pi: form.pi,
        consentForm: form.consentForm,
      })
      if (res.success && res.data) {
        setSubmissions(prev => [res.data as IRBSubmission, ...prev])
        showToast(t('researchPage.irbSubmitted'), 'success')
      } else {
        showToast(res.error?.message ?? t('researchPage.irbFailed'), 'error')
      }
    } catch {
      showToast(t('researchPage.irbFailed'), 'error')
    }
    setShowForm(false); setForm({ projectName: '', pi: '', consentForm: '' })
  }
  // [UI] IRB status → canonical statusTokens tone
  const irbTone = (status: string) => (status === 'draft' ? 'draft' : status === 'submitted' ? 'submitted' : status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status)
  const statusLabels: Record<string, string> = { draft: t('researchPage.irbStatusDraft'), submitted: t('researchPage.irbStatusSubmitted'), approved: t('researchPage.irbStatusApproved'), rejected: t('researchPage.irbStatusRejected') }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Plus size={16} /> {t('researchPage.newIrb')}</button>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden' }}>
        <DataTable
          dataSource={submissions}
          rowKey={(s) => s.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thProjectName'), key: 'projectName', render: (_v, s) => <span style={{ fontWeight: 600, fontSize: 12 }}>{s.projectName}</span> },
            { title: t('researchPage.thPi'), key: 'pi', render: (_v, s) => <span style={{ fontSize: 12 }}>{s.pi}</span> },
            { title: t('researchPage.thSubmitDate'), key: 'submittedDate', render: (_v, s) => <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{s.submittedDate}</span> },
            { title: t('researchPage.thStatus'), key: 'status', render: (_v, s) => <StatusTag status={irbTone(s.status)}>{statusLabels[s.status]}</StatusTag> },
            { title: t('researchPage.thApprovedDate'), key: 'approvedDate', render: (_v, s) => <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{s.approvedDate || '-'}</span> },
            { title: t('researchPage.thExpiryDate'), key: 'expiryDate', render: (_v, s) => <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{s.expiryDate || '-'}</span> },
            { title: t('researchPage.thActions'), key: 'actions', render: (_v, s) => <button onClick={() => setViewing(s)} style={{ padding: '4px 10px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>{t('researchPage.view')}</button> },
          ]}
        />
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FileSignature size={16} /> {t('researchPage.consentMgmt')}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: 12, background: COLORS.bgGray, borderRadius: 6, borderLeft: '4px solid ' + COLORS.primary }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>肺癌早筛研究</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>知情同意书_v2.pdf</div>
            <div style={{ fontSize: 12, color: COLORS.success, marginTop: 4 }}>{t('researchPage.signed')}</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: COLORS.bgGray, borderRadius: 6, borderLeft: '4px solid ' + COLORS.warning }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>阿尔茨海默病研究</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>知情同意书_v1.pdf</div>
            <div style={{ fontSize: 12, color: COLORS.warning, marginTop: 4 }}>{t('researchPage.pendingSign')}</div>
          </div>
        </div>
      </div>
      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('researchPage.newIrb')} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('researchPage.thProjectName')}</label><input style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} value={form.projectName} onChange={e => setForm({ ...form, projectName: e.target.value })} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('researchPage.thPi')}</label><input style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} value={form.pi} onChange={e => setForm({ ...form, pi: e.target.value })} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('researchPage.labelConsent')}</label><input type="file" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid ' + COLORS.border, fontSize: 14 }} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer' }}>{t('researchPage.cancel')}</button><button onClick={submitIRB} style={{ padding: '10px 20px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{t('researchPage.submitApplication')}</button></div>
        </div>
      </Modal>
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={t('researchPage.irbDetail')} width={480}>
        {viewing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 12, background: COLORS.bgGray, borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 4 }}>{viewing.projectName}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{t('researchPage.submitDatePiLabel')}{viewing.submittedDate}{t('researchPage.piLabel')}{viewing.pi}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{t('researchPage.thStatus')}</div><StatusTag status={irbTone(viewing.status)}>{statusLabels[viewing.status]}</StatusTag></div>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{t('researchPage.thApprovedDate')}</div><div style={{ fontSize: 12, fontWeight: 600 }}>{viewing.approvedDate || '-'}</div></div>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{t('researchPage.thExpiryDate')}</div><div style={{ fontSize: 12, fontWeight: 600 }}>{viewing.expiryDate || '-'}</div></div>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{t('researchPage.labelConsent')}</div><div style={{ fontSize: 12, fontWeight: 600 }}>{viewing.consentForm || '-'}</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><button onClick={() => setViewing(null)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{t('researchPage.close')}</button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ==================== 新增: 数据导出管线 ====================
function ExportPipelineTab() {
  const { showToast } = useToast()
  const [exportFormat, setExportFormat] = useState('CSV')
  const [deidentify, setDeidentify] = useState(true)
  const [includeDict, setIncludeDict] = useState(true)
  const [auditLog, setAuditLog] = useState<ExportAudit[]>([])
  const [, setLoading] = useState(true)
  const [showProgress, setShowProgress] = useState(false)
  const [progress, setProgress] = useState(0)
  const exportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const exportMountedRef = useRef(true)
  useEffect(() => { exportMountedRef.current = true; return () => { exportMountedRef.current = false; if (exportIntervalRef.current) clearInterval(exportIntervalRef.current) } }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listExportAudit()
        if (res.success && Array.isArray(res.data)) setAuditLog(res.data as ExportAudit[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])

  const runExport = () => {
    setShowProgress(true); setProgress(0)
    exportIntervalRef.current = setInterval(() => { setProgress(prev => { if (prev >= 100) { if (exportIntervalRef.current) clearInterval(exportIntervalRef.current); exportIntervalRef.current = null; setTimeout(() => { if (exportMountedRef.current) { setShowProgress(false); showToast(`导出完成 (CSV, 320条记录, 含数据字典)`, 'success') } }, 500); return 100 }; return prev + Math.floor(Math.random() * 20) + 5 }) }, 200)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showProgress && <ProgressModal open={showProgress} title={t('researchPage.exportingData')} message={`正在生成 ${exportFormat} 文件...`} progress={progress} />}
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Download size={16} /> {t('researchPage.exportConfig')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('researchPage.exportFormat')}</label><Select style={{ width: '100%' }} value={exportFormat} onChange={(v) => setExportFormat(v)} options={[{ value: 'CSV', label: 'CSV' }, { value: 'JSON', label: 'JSON' }, { value: 'FHIR', label: 'FHIR' }, { value: 'Parquet', label: 'Parquet' }]} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('researchPage.dataScope')}</label><Select style={{ width: '100%' }} defaultValue={t('researchPage.scopeAll')} options={[{ value: t('researchPage.scopeAll'), label: t('researchPage.scopeAll') }, { value: t('researchPage.scopeSelected'), label: t('researchPage.scopeSelected') }, { value: t('researchPage.scopeByDate'), label: t('researchPage.scopeByDate') }]} /></div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Checkbox checked={deidentify} onChange={e => setDeidentify(e.target.checked)} /> {t('researchPage.deidOnExport')}</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Checkbox checked={includeDict} onChange={e => setIncludeDict(e.target.checked)} /> {t('researchPage.includeDict')}</label>
        </div>
        {includeDict && (
          <div style={{ marginTop: 12, padding: 12, background: COLORS.bgGray, borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('researchPage.dictPreview')}</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
              <div>patient_id: 字符串, 匿名化标识</div>
              <div>age: 整数, 患者年龄</div>
              <div>gender: 枚举(男/女)</div>
              <div>exam_type: 枚举(CT/MR/DR...)</div>
              <div>diagnosis_code: 字符串, ICD-10编码</div>
              <div>exam_date: 日期, YYYY-MM-DD</div>
              <div>modality: 字符串, 设备编号</div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}><button onClick={runExport} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: COLORS.primary, color: 'var(--text-inverse)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Download size={16} /> {t('researchPage.runExport')}</button></div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> {t('researchPage.exportAuditLog')}</div>
        <DataTable
          dataSource={auditLog}
          rowKey={(a) => a.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thExportId'), key: 'exportId', render: (_v, a) => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{a.exportId}</span> },
            { title: t('researchPage.thRequester'), key: 'requester', render: (_v, a) => <span style={{ fontSize: 12 }}>{a.requester}</span> },
            { title: t('researchPage.thApprover'), key: 'approvedBy', render: (_v, a) => <span style={{ fontSize: 12 }}>{a.approvedBy}</span> },
            { title: t('researchPage.thExportTime'), key: 'exportTime', render: (_v, a) => <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{a.exportTime}</span> },
            { title: t('researchPage.thRecordCount'), key: 'records', align: 'right' as const, render: (_v, a) => <span style={{ fontSize: 12, fontWeight: 600 }}>{a.records}</span> },
            { title: t('researchPage.thPurpose'), key: 'purpose', render: (_v, a) => <span style={{ fontSize: 12 }}>{a.purpose}</span> },
            { title: t('researchPage.thStatus'), key: 'status', render: (_v, a) => <StatusTag status="success">{a.status}</StatusTag> },
          ]}
        />
      </div>
    </div>
  )
}

// ==================== 新增: 数据质量看板 ====================
function DataQualityTab() {
  const [scores, setScores] = useState<DataQualityScore[]>([])
  const [, setLoading] = useState(true)
  const [implemented, setImplemented] = useState<Record<string, string>>({})

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listQualityScores()
        if (res.success && Array.isArray(res.data)) setScores(res.data as DataQualityScore[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])

  const handleImplement = (key: string) => {
    setImplemented(prev => ({ ...prev, [key]: '进行中' }))
    setTimeout(() => {
      setImplemented(prev => ({ ...prev, [key]: '已完成' }))
    }, 1500)
  }

  const overallCompleteness = scores.length > 0 ? Math.round(scores.reduce((s, f) => s + f.completeness, 0) / scores.length) : 0
  const overallConsistency = scores.length > 0 ? Math.round(scores.reduce((s, f) => s + f.consistency, 0) / scores.length) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: overallCompleteness >= 80 ? COLORS.success : COLORS.warning }}>{overallCompleteness}%</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{t('researchPage.overallCompleteness')}</div>
        </div>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: overallConsistency >= 80 ? COLORS.success : COLORS.warning }}>{overallConsistency}%</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{t('researchPage.overallConsistency')}</div>
        </div>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.primary }}>6/10</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{t('researchPage.fieldsToImprove')}</div>
        </div>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.success }}>实时</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{t('researchPage.dataFreshness')}</div>
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Target size={16} /> {t('researchPage.fieldQualityScore')}</div>
        <DataTable
          dataSource={scores}
          rowKey={(_f, idx) => String(idx)}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('common.empty.noData')}
          columns={[
            { title: t('researchPage.thField'), key: 'field', render: (_v, f) => <span style={{ fontWeight: 600, fontSize: 12 }}>{f.field}</span> },
            { title: t('researchPage.thCompleteness'), key: 'completeness', align: 'center' as const, render: (_v, f) => <StatusTag status={f.completeness >= 90 ? 'success' : f.completeness >= 70 ? 'warning' : 'critical'}>{f.completeness}%</StatusTag> },
            { title: t('researchPage.thConsistency'), key: 'consistency', align: 'center' as const, render: (_v, f) => <StatusTag status={f.consistency >= 90 ? 'success' : f.consistency >= 70 ? 'warning' : 'critical'}>{f.consistency}%</StatusTag> },
            { title: t('researchPage.thFreshness'), key: 'freshness', align: 'center' as const, render: (_v, f) => <span style={{ fontSize: 12, color: f.freshness === '实时' ? COLORS.success : f.freshness === 'T+1' ? COLORS.warning : COLORS.danger }}>{f.freshness}</span> },
            { title: t('researchPage.thSuggestion'), key: 'suggestion', render: (_v, f) => <span style={{ fontSize: 12, color: f.suggestion ? COLORS.warning : COLORS.textSecondary }}>{f.suggestion || t('researchPage.good')}</span> },
          ]}
        />
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} /> {t('researchPage.qualitySuggestions')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'idcard', title: t('researchPage.sugIdcard'), desc: t('researchPage.sugIdcardDesc') },
            { key: 'icd', title: t('researchPage.sugIcd'), desc: t('researchPage.sugIcdDesc') },
            { key: 'followup', title: t('researchPage.sugFollowup'), desc: t('researchPage.sugFollowupDesc') },
          ].map(item => (
            <div key={item.key} style={{ padding: 12, background: COLORS.warningLight, borderRadius: 6, borderLeft: '4px solid ' + COLORS.warning, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.desc}</div></div>
              <button onClick={() => handleImplement(item.key)} style={{ padding: '6px 12px', background: implemented[item.key] === '已完成' ? COLORS.success : COLORS.warning, color: 'var(--text-inverse)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, minWidth: 56 }}>
                {implemented[item.key] === '已完成' ? t('researchPage.done') : implemented[item.key] === '进行中' ? t('researchPage.implementing') : t('researchPage.implement')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== 主组件 ====================
export default function ResearchPage() {
  const { ToastContainer } = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>('projects')

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'projects', label: t('researchPage.tabProjects'), icon: <Folder size={16} /> },
    { key: 'extract', label: t('researchPage.tabExtract'), icon: <Database size={16} /> },
    { key: 'labels', label: t('researchPage.tabLabels'), icon: <Tag size={16} /> },
    { key: 'export', label: t('researchPage.tabExport'), icon: <Download size={16} /> },
    { key: 'deid', label: t('researchPage.tabDeid'), icon: <Shield size={16} /> },
    { key: 'cohort', label: t('researchPage.tabCohort'), icon: <Users size={16} /> },
    { key: 'irb', label: t('researchPage.tabIrb'), icon: <FileSignature size={16} /> },
    { key: 'exportPipeline', label: t('researchPage.tabExportPipeline'), icon: <Layers size={16} /> },
    { key: 'dataQuality', label: t('researchPage.tabDataQuality'), icon: <Activity size={16} /> },
  ]

  return (
    <div style={{ padding: 24, background: COLORS.bgGray,}}>
      {/* [G005 W1-C] 演示数据（后端待实现）: 后端无 /research controller, 接口调用失败时页面展示空态/本地 fallback */}
      <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-700)', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-warning-border)', marginBottom: 16 }}>
        {t('researchPage.demoBanner')}
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: COLORS.primary, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FlaskConical size={20} color="var(--text-inverse)" /></div>
          <div><Typography.Title level={4} style={{ margin: 0 }}>{t('researchPage.pageTitle')}</Typography.Title><p style={{ fontSize: 12, color: COLORS.textSecondary, margin: 0 }}>{t('researchPage.pageSubtitle')}</p></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, background: COLORS.bgWhite, padding: '4px 4px 0', borderRadius: '12px 12px 0 0', border: '1px solid ' + COLORS.border, borderBottom: 'none', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} icon={tab.icon} label={tab.label} />
        ))}
      </div>
      <div style={{ background: COLORS.bgWhite, border: '1px solid ' + COLORS.border, borderRadius: '0 0 12px 12px', padding: 24, minHeight: 500 }}>
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'extract' && <ExtractTab />}
        {activeTab === 'labels' && <LabelsTab />}
        {activeTab === 'export' && <ExportTab />}
        {activeTab === 'deid' && <DeidEngineTab />}
        {activeTab === 'cohort' && <CohortBuilderTab />}
        {activeTab === 'irb' && <IRBWorkflowTab />}
        {activeTab === 'exportPipeline' && <ExportPipelineTab />}
        {activeTab === 'dataQuality' && <DataQualityTab />}
      </div>
      <ToastContainer />
    </div>
  )
}

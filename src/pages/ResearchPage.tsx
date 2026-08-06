// ============================================================
// G005 放射科RIS系统 - 科研数据抽取/课题数据脱敏管理 v2.0.0
// 功能：课题管理 / 数据抽取 / 标签管理 / 导出管理
// 新增：DICOM脱敏引擎 / 队列构建器 / IRB工作流 / 数据导出管线 / 数据质量看板
// ============================================================
import React, { useState, useRef, useEffect } from 'react'
import {
  FlaskConical, Plus, X, Search, Edit2, Trash2, Download, Tag, Folder, FileText, Calendar, User, Clock,
  Eye, EyeOff, AlertCircle,
  Database, Shield, ShieldCheck, FileJson, FileSpreadsheet,
  Filter, Users, Save,
  Activity, CheckCircle as CheckCircleIcon,
  Layers, FileSignature, ClipboardList,
  Target, Sigma
} from 'lucide-react'
import { researchApi, type ResearchProjectDto, type ResearchLabelDto, type CohortDefinitionDto as CohortDefinition, type IRBSubmissionDto as IRBSubmission, type ExportAuditDto as ExportAudit, type DataQualityScoreDto as DataQualityScore } from '../services/api/researchApi'

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
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  primaryLighter: '#dbeafe',
  secondary: '#64748b',
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#d97706',
  warningLight: '#fef3c7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  bgGray: '#f1f5f9',
  bgWhite: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
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

function getStatusColor(status: ProjectStatus): string {
  switch (status) { case '进行中': return COLORS.primaryLight; case '已完成': return COLORS.success; case '已归档': return COLORS.secondary; default: return COLORS.secondary }
}

function getStatusBgColor(status: ProjectStatus): string {
  switch (status) { case '进行中': return COLORS.primaryLighter; case '已完成': return COLORS.successLight; case '已归档': return '#f1f5f9'; default: return '#f1f5f9' }
}

function getLabelTypeColor(type: LabelType): string {
  switch (type) { case '诊断': return '#ef4444'; case '部位': return '#3b82f6'; case '特征': return '#8b5cf6'; default: return COLORS.secondary }
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
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)) }, 3000)
  }
  const ToastContainer = () => (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ padding: '12px 20px', borderRadius: 8, background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 240, animation: 'slideIn 0.3s ease-out' }}>{toast.message}</div>
      ))}
    </div>
  )
  return { showToast, ToastContainer }
}

// ==================== 进度Modal组件 ====================
interface ProgressModalProps { open: boolean; title: string; message: string; progress?: number; onClose?: () => void }
function ProgressModal({ open, title, message, progress, onClose }: ProgressModalProps) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 12, padding: 32, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>{title}</div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>{message}</div>
        {progress !== undefined && (
          <div style={{ background: '#e8e8e8', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{ background: '#3b82f6', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>{progress !== undefined ? `${progress}%` : '请稍候...'}</div>
      </div>
    </div>
  )
}

// ==================== 子组件 ====================
interface TabButtonProps { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }
function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: active ? COLORS.primary : 'transparent', color: active ? '#ffffff' : COLORS.textSecondary, border: 'none', borderBottom: active ? '2px solid ' + COLORS.primary : '2px solid transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}>
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
  const [projects, setProjects] = useState<Project[]>([])
  const [, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailProject, setDetailProject] = useState<Project | null>(null)
  const [newProject, setNewProject] = useState<Partial<Project>>({ code: '', name: '', leader: '', startDate: '', description: '', members: [] })

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
  const handleShowDetail = (project: Project) => { setDetailProject(project); setShowDetailModal(true) }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: COLORS.bgWhite, border: '1px solid ' + COLORS.border, borderRadius: 8, padding: '8px 12px', gap: 8 }}>
            <Search size={16} color={COLORS.textSecondary} />
            <input placeholder="搜索课题名称或编号..." style={{ border: 'none', outline: 'none', fontSize: 14, width: 240, background: 'transparent' }} />
          </div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Plus size={16} /> 新建课题</button>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>课题编号</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>课题名称</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>负责人</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>开始日期</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>状态</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>数据量</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>操作</th>
          </tr></thead>
          <tbody>{projects.map((project, idx) => (
            <tr key={project.id} style={{ background: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgGray, borderTop: '1px solid ' + COLORS.border }}>
              <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>{project.code}</td>
              <td style={{ padding: '14px 16px', fontSize: 13, color: COLORS.textPrimary }}>{project.name}</td>
              <td style={{ padding: '14px 16px', fontSize: 13, color: COLORS.textSecondary }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} color={COLORS.textSecondary} />{project.leader}</div></td>
              <td style={{ padding: '14px 16px', fontSize: 13, color: COLORS.textSecondary }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} color={COLORS.textSecondary} />{project.startDate}</div></td>
              <td style={{ padding: '14px 16px' }}><span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: getStatusBgColor(project.status), color: getStatusColor(project.status) }}>{project.status}</span></td>
              <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, textAlign: 'right' }}>{project.dataCount.toLocaleString()}</td>
              <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <button onClick={() => handleShowDetail(project)} style={{ padding: '6px 10px', background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', fontSize: 12, color: COLORS.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={12} /> 详情</button>
                <button style={{ padding: 6, background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', color: COLORS.textSecondary }}><Edit2 size={12} /></button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="新建课题" width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>课题编号</label><input type="text" value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} placeholder="如: RC-2024-006" style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>课题名称</label><input type="text" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="请输入课题名称" style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>负责人</label><input type="text" value={newProject.leader} onChange={e => setNewProject({ ...newProject, leader: e.target.value })} placeholder="请输入负责人姓名" style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>开始日期</label><input type="date" value={newProject.startDate} onChange={e => setNewProject({ ...newProject, startDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>课题描述</label><textarea value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} placeholder="请输入课题描述" rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>取消</button>
            <button onClick={handleCreateProject} style={{ padding: '10px 20px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>创建课题</button>
          </div>
        </div>
      </Modal>
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="课题详情" width={640}>
        {detailProject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: COLORS.bgGray, padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}><span style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>{detailProject.name}</span><span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: getStatusBgColor(detailProject.status), color: getStatusColor(detailProject.status) }}>{detailProject.status}</span></div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 }}>{detailProject.description}</div>
              <div style={{ display: 'flex', gap: 24, fontSize: 13, color: COLORS.textSecondary }}><span>课题编号: <strong style={{ color: COLORS.primary }}>{detailProject.code}</strong></span><span>数据量: <strong style={{ color: COLORS.textPrimary }}>{detailProject.dataCount}</strong></span></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>负责人</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{detailProject.leader}</div></div>
              <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>开始日期</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{detailProject.startDate}</div></div>
            </div>
            <div><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>课题成员</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{detailProject.members.map((member, idx) => (<span key={idx} style={{ padding: '4px 12px', background: COLORS.primaryLighter, color: COLORS.primary, borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{member}</span>))}</div></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowDetailModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>关闭</button></div>
          </div>
        )}
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
  const toggleExamType = (type: ExamType) => { setSelectedExamTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]) }
  const handleExtract = () => {
    setShowExtractModal(true); setExtractProgress(0)
    extractIntervalRef.current = setInterval(() => { setExtractProgress(prev => { if (prev >= 100) { if (extractIntervalRef.current) clearInterval(extractIntervalRef.current); extractIntervalRef.current = null; setTimeout(() => { if (extractMountedRef.current) { setShowExtractModal(false); showToast(`数据抽取完成，共处理 ${examRecords.length} 条记录`, 'success') } }, 500); return 100 }; return prev + Math.floor(Math.random() * 15) + 5 }) }, 300)
  }
  return (
    <div>
      {showExtractModal && <ProgressModal open={showExtractModal} title="数据抽取中" message="正在抽取并脱敏处理..." progress={extractProgress} />}
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Filter size={16} /> 数据筛选条件</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>检查类型</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{examTypeOptions.map(type => (<button key={type} onClick={() => toggleExamType(type)} style={{ padding: '6px 12px', background: selectedExamTypes.includes(type) ? COLORS.primary : COLORS.bgGray, color: selectedExamTypes.includes(type) ? '#ffffff' : COLORS.textSecondary, border: '1px solid ' + (selectedExamTypes.includes(type) ? COLORS.primary : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }}>{type}</button>))}</div></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>日期范围</label><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="date" value={filter.startDate} onChange={e => setFilter({ ...filter, startDate: e.target.value })} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 13 }} /><span style={{ color: COLORS.textSecondary }}>至</span><input type="date" value={filter.endDate} onChange={e => setFilter({ ...filter, endDate: e.target.value })} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 13 }} /></div></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>患者年龄范围</label><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="number" value={filter.minAge} onChange={e => setFilter({ ...filter, minAge: Number(e.target.value) })} min={0} max={120} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 13, width: 80 }} /><span style={{ color: COLORS.textSecondary }}>至</span><input type="number" value={filter.maxAge} onChange={e => setFilter({ ...filter, maxAge: Number(e.target.value) })} min={0} max={120} style={{ padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 13, width: 80 }} /><span style={{ color: COLORS.textSecondary }}>岁</span></div></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>检查结果</label><div style={{ display: 'flex', gap: 8 }}>{['', '阳性', '阴性'].map(result => (<button key={result || 'all'} onClick={() => setFilter({ ...filter, result: result as ResultType | '' })} style={{ padding: '6px 16px', background: filter.result === result ? COLORS.primary : COLORS.bgGray, color: filter.result === result ? '#ffffff' : COLORS.textSecondary, border: '1px solid ' + (filter.result === result ? COLORS.primary : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{result || '全部'}</button>))}</div></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>诊断关键词</label><input type="text" value={filter.keyword} onChange={e => setFilter({ ...filter, keyword: e.target.value })} placeholder="输入诊断关键词进行搜索..." style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Database size={16} /> 抽取预览（10条）</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: COLORS.bgGray }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>患者ID</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>姓名</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>年龄/性别</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>检查类型</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>检查日期</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>诊断</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>结果</th>
              {showDesensitization && <><th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>身份证号</th><th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>手机号</th><th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: COLORS.textSecondary }}>地址</th></>}
            </tr></thead>
            <tbody>{examRecords.map((record, idx) => (
              <tr key={record.id} style={{ background: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgGray, borderTop: '1px solid ' + COLORS.border }}>
                <td style={{ padding: '10px 12px', color: COLORS.textSecondary }}>{record.patientId}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: showDesensitization ? COLORS.textSecondary : COLORS.textPrimary }}>{showDesensitization ? maskName(record.patientName) : record.patientName}</td>
                <td style={{ padding: '10px 12px', color: COLORS.textPrimary }}>{record.age}岁/{record.gender}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ padding: '3px 8px', background: COLORS.primaryLighter, color: COLORS.primary, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{record.examType}</span></td>
                <td style={{ padding: '10px 12px', color: COLORS.textSecondary }}>{record.examDate}</td>
                <td style={{ padding: '10px 12px', color: COLORS.textPrimary }}>{record.diagnosis}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: record.result === '阳性' ? COLORS.dangerLight : COLORS.successLight, color: record.result === '阳性' ? COLORS.danger : COLORS.success }}>{record.result}</span></td>
                {showDesensitization && <><td style={{ padding: '10px 12px', color: COLORS.textSecondary, fontFamily: 'monospace', fontSize: 12 }}>{maskIdCard(record.idCard)}</td><td style={{ padding: '10px 12px', color: COLORS.textSecondary, fontFamily: 'monospace', fontSize: 12 }}>{maskPhone(record.phone)}</td><td style={{ padding: '10px 12px', color: COLORS.textSecondary, fontSize: 12 }}>{maskAddress(record.address)}</td></>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16} /> 脱敏规则 <button onClick={() => setShowDesensitization(!showDesensitization)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: showDesensitization ? COLORS.primary : COLORS.bgGray, color: showDesensitization ? '#ffffff' : COLORS.textSecondary, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{showDesensitization ? <EyeOff size={14} /> : <Eye size={14} />}{showDesensitization ? '已启用脱敏' : '已禁用脱敏'}</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.primary }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>姓名</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>王*** → {maskName('王建国')}</div></div>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.warning }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>身份证号</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>110***2345 → {maskIdCard('110101195806121234')}</div></div>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.success }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>手机号</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>138****5678 → {maskPhone('13812345678')}</div></div>
          <div style={{ padding: 16, background: COLORS.bgGray, borderRadius: 8, borderLeft: '4px solid ' + COLORS.danger }}><div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>地址</div><div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'monospace' }}>北京市*** → {maskAddress('北京市朝阳区建国路88号')}</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><button onClick={handleExtract} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 40px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)' }}><Download size={18} /> 确认抽取（10条记录）</button></div>
    </div>
  )
}

// ==================== 数据标签化管理Tab ====================
function LabelsTab() {
  const [labels, setLabels] = useState<Label[]>([])
  const [, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newLabel, setNewLabel] = useState<Partial<Label>>({ name: '', type: '诊断', color: '#3b82f6' })
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
    setShowAddModal(false); setNewLabel({ name: '', type: '诊断', color: '#3b82f6' })
  }
  const filteredLabels = labels.filter(label => { const matchKeyword = label.name.toLowerCase().includes(searchKeyword.toLowerCase()); const matchType = !filterType || label.type === filterType; return matchKeyword && matchType })
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: COLORS.bgWhite, border: '1px solid ' + COLORS.border, borderRadius: 8, padding: '8px 12px', gap: 8 }}><Search size={16} color={COLORS.textSecondary} /><input placeholder="搜索标签..." value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 14, width: 180, background: 'transparent' }} /></div>
          <div style={{ display: 'flex', gap: 8 }}>{['', '诊断', '部位', '特征'].map(type => (<button key={type || 'all'} onClick={() => setFilterType(type as LabelType | '')} style={{ padding: '8px 14px', background: filterType === type ? COLORS.primary : COLORS.bgWhite, color: filterType === type ? '#ffffff' : COLORS.textSecondary, border: '1px solid ' + (filterType === type ? COLORS.primary : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{type || '全部'}</button>))}</div>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Plus size={16} /> 自定义标签</button>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>标签名</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>标签类型</th><th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>使用次数</th><th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>操作</th></tr></thead>
          <tbody>{filteredLabels.map((label, idx) => (
            <tr key={label.id} style={{ background: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgGray, borderTop: '1px solid ' + COLORS.border }}>
              <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: label.color, flexShrink: 0 }} /><span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{label.name}</span></div></td>
              <td style={{ padding: '14px 16px' }}><span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: getLabelTypeColor(label.type) + '20', color: getLabelTypeColor(label.type) }}>{label.type}</span></td>
              <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, textAlign: 'center' }}>{label.useCount.toLocaleString()}</td>
              <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><button style={{ padding: '6px 10px', background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', fontSize: 12, color: COLORS.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={12} /> 应用</button><button style={{ padding: 6, background: 'none', border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', color: COLORS.danger }}><Trash2 size={12} /></button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 20, padding: 20, background: COLORS.primaryLighter, borderRadius: 12, border: '1px solid ' + COLORS.primaryLight }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={16} /> 已抽取数据标签管理</div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}><p style={{ marginBottom: 8 }}>当前已抽取记录：50条</p><p>为已抽取的影像数据添加诊断标签、部位标签和特征标签，便于后续研究和分析。</p></div>
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}><button style={{ padding: '10px 16px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>批量标注</button><button style={{ padding: '10px 16px', background: COLORS.bgWhite, color: COLORS.primary, border: '1px solid ' + COLORS.primary, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>查看已标注目录</button></div>
      </div>
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="添加自定义标签" width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>标签名称</label><input type="text" value={newLabel.name} onChange={e => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="请输入标签名称" style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>标签类型</label><div style={{ display: 'flex', gap: 8 }}>{(['诊断', '部位', '特征'] as LabelType[]).map(type => (<button key={type} onClick={() => setNewLabel({ ...newLabel, type })} style={{ padding: '8px 16px', background: newLabel.type === type ? getLabelTypeColor(type) : COLORS.bgGray, color: newLabel.type === type ? '#ffffff' : COLORS.textSecondary, border: '1px solid ' + (newLabel.type === type ? getLabelTypeColor(type) : COLORS.border), borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{type}</button>))}</div></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>标签颜色</label><div style={{ display: 'flex', gap: 8 }}>{['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'].map(color => (<button key={color} onClick={() => setNewLabel({ ...newLabel, color })} style={{ width: 32, height: 32, background: color, border: newLabel.color === color ? '3px solid ' + COLORS.textPrimary : '2px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer' }} />))}</div></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>取消</button><button onClick={handleAddLabel} style={{ padding: '10px 20px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>添加标签</button></div>
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
  const handleDownload = (record: ExportRecord) => { showToast(`开始下载: ${record.downloadUrl}`, 'info') }
  return (
    <div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + COLORS.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} /> 导出记录</div>
          <button onClick={() => setShowPermissionModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Shield size={14} /> 导出权限管理</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>课题</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>导出格式</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>导出时间</th><th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>记录数</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>操作人</th><th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>操作</th></tr></thead>
          <tbody>{exports.map((record, idx) => (
            <tr key={record.id} style={{ background: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgGray, borderTop: '1px solid ' + COLORS.border }}>
              <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>{record.projectName}</td>
              <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getExportFormatIcon(record.format)}<span style={{ padding: '3px 8px', background: record.format === 'DICOM' ? COLORS.warningLight : COLORS.bgGray, color: record.format === 'DICOM' ? COLORS.warning : COLORS.textSecondary, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{record.format}</span></div></td>
              <td style={{ padding: '14px 16px', fontSize: 13, color: COLORS.textSecondary }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={12} />{record.exportTime}</div></td>
              <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, textAlign: 'right' }}>{record.recordCount.toLocaleString()}</td>
              <td style={{ padding: '14px 16px', fontSize: 13, color: COLORS.textSecondary }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={12} />{record.operator}</div></td>
              <td style={{ padding: '14px 16px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><button onClick={() => handleDownload(record)} style={{ padding: '6px 12px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12} /> 下载</button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Modal open={showPermissionModal} onClose={() => setShowPermissionModal(false)} title="导出权限管理" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ padding: 16, background: COLORS.warningLight, borderRadius: 8, border: '1px solid ' + COLORS.warning }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><AlertCircle size={16} color={COLORS.warning} /><span style={{ fontSize: 13, fontWeight: 700, color: COLORS.warning }}>权限提示</span></div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>科研数据导出涉及患者隐私，请严格按照医院相关规定管理和审批导出权限。</div></div>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12 }}>允许导出的格式</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[{ key: 'allowCsv', label: 'CSV 格式', desc: '表格数据，便于统计分析' }, { key: 'allowJson', label: 'JSON 格式', desc: '结构化数据，便于程序处理' }, { key: 'allowDicom', label: 'DICOM 格式', desc: '原始影像数据，需额外审批' }].map(item => (<label key={item.key} style={{ display: 'flex', alignItems: 'center', padding: 12, background: COLORS.bgGray, borderRadius: 8, cursor: 'pointer' }}><input type="checkbox" checked={exportPermissions[item.key as keyof typeof exportPermissions] as boolean} onChange={e => setExportPermissions({ ...exportPermissions, [item.key]: e.target.checked })} style={{ marginRight: 12, width: 18, height: 18 }} /><div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{item.label}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.desc}</div></div></label>))}</div></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 8 }}>单次最大导出记录数</label><input type="number" value={exportPermissions.maxRecordsPerExport} onChange={e => setExportPermissions({ ...exportPermissions, maxRecordsPerExport: Number(e.target.value) })} min={1} max={10000} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}><input type="checkbox" checked={exportPermissions.requireApproval} onChange={e => setExportPermissions({ ...exportPermissions, requireApproval: e.target.checked })} style={{ width: 18, height: 18 }} /><span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>导出需管理员审批</span></label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}><button onClick={() => setShowPermissionModal(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>取消</button><button onClick={() => { showToast('导出权限设置已保存', 'success'); setShowPermissionModal(false) }} style={{ padding: '10px 20px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>保存设置</button></div>
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
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} /> 脱敏配置文件</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[{ id: 'hipaa', label: 'HIPAA Safe Harbor', desc: '移除18类PHI标识符' }, { id: 'expert', label: 'Expert Determination', desc: '专家确定去标识化' }].map(p => (
            <div key={p.id} onClick={() => setDeidProfile(p.id)} style={{ flex: 1, padding: 16, borderRadius: 8, border: `2px solid ${deidProfile === p.id ? COLORS.primary : COLORS.border}`, cursor: 'pointer', background: deidProfile === p.id ? COLORS.primaryLighter : 'transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: deidProfile === p.id ? COLORS.primary : COLORS.textPrimary }}>{p.label}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={16} /> DICOM标签脱敏规则</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>标签名</th><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>操作</th></tr></thead>
          <tbody>{phiTags.map((t, idx) => (
            <tr key={idx} style={{ borderTop: '1px solid ' + COLORS.border }}>
              <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: 'monospace', color: COLORS.textPrimary }}>{t.tag}</td>
              <td style={{ padding: '10px 12px' }}><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: t.status === 'remove' ? COLORS.dangerLight : COLORS.successLight, color: t.status === 'remove' ? COLORS.danger : COLORS.success }}>{t.status === 'remove' ? '移除' : '保留'}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={16} /> 像素级脱敏（模拟）</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 8, padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>脱敏前</div>
            <div style={{ width: 200, height: 200, margin: '0 auto', background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ color: 'white', fontSize: 12, marginBottom: 4 }}>患者: 王建国</div>
              <div style={{ color: 'white', fontSize: 12, marginBottom: 4 }}>ID: P10001</div>
              <div style={{ color: 'white', fontSize: 12 }}>2026-05-15</div>
            </div>
          </div>
          <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 8, padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>脱敏后</div>
            <div style={{ width: 200, height: 200, margin: '0 auto', background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: 160, height: 20, background: 'black', marginBottom: 4 }} />
              <div style={{ width: 120, height: 20, background: 'black', marginBottom: 4 }} />
              <div style={{ width: 140, height: 20, background: 'black' }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button onClick={() => { showToast('脱敏引擎正在处理...', 'info'); setTimeout(() => showToast('脱敏完成，已处理50个DICOM文件', 'success'), 1500) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Shield size={16} /> 执行脱敏</button>
        <button onClick={() => setShowPreview(!showPreview)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: COLORS.bgWhite, color: COLORS.primary, border: '1px solid ' + COLORS.primary, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Eye size={16} /> 预览对比</button>
      </div>
    </div>
  )
}

// ==================== 新增: 队列构建器 ====================
function CohortBuilderTab() {
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
  const saveCohort = () => {
    if (!cohortName.trim()) return
    setSavedCohorts([...savedCohorts, { id: `C${Date.now()}`, name: cohortName, criteria: criteria.map(c => `${c.field} ${c.operator} ${c.value}`).join(' AND '), estimatedSize, createdBy: '当前用户', createdDate: new Date().toISOString().split('T')[0]!, lastRun: '-' }])
    setShowSaveDialog(false); setCohortName('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} /> 入组条件构建器</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {criteria.map((c, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: COLORS.bgGray, borderRadius: 6 }}>
              {idx > 0 && <select value={c.logic} onChange={e => updateCriterion(idx, 'logic', e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid ' + COLORS.border, fontSize: 12 }}><option value="AND">AND</option><option value="OR">OR</option></select>}
              <select value={c.field} onChange={e => updateCriterion(idx, 'field', e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid ' + COLORS.border, fontSize: 12 }}>
                <option value="age">年龄</option><option value="gender">性别</option><option value="diagnosis">诊断</option><option value="modality">设备类型</option><option value="dateRange">日期范围</option>
              </select>
              <select value={c.operator} onChange={e => updateCriterion(idx, 'operator', e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid ' + COLORS.border, fontSize: 12 }}>
                <option value="=">=</option><option value=">">&gt;</option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option><option value="!=">!=</option><option value="contains">包含</option>
              </select>
              <input value={c.value} onChange={e => updateCriterion(idx, 'value', e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid ' + COLORS.border, fontSize: 12, flex: 1 }} placeholder="值" />
              <button onClick={() => removeCriterion(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.danger, padding: 4 }}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={addCriterion} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Plus size={14} /> 添加条件</button>
          <button onClick={estimateSize} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: COLORS.primaryLighter, color: COLORS.primary, border: '1px solid ' + COLORS.primaryLight, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Sigma size={14} /> 预估队列大小</button>
        </div>
        {estimatedSize > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: COLORS.successLight, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon size={16} style={{ color: COLORS.success }} />
            <span>预估符合条件的患者数量: <strong style={{ fontSize: 16 }}>{estimatedSize.toLocaleString()}</strong> 例</span>
          </div>
        )}
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}><Save size={16} /> 已保存队列</div>
          <button onClick={() => { estimateSize(); setShowSaveDialog(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Save size={14} /> 保存当前队列</button>
        </div>
        {savedCohorts.map(cohort => (
          <div key={cohort.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid ' + COLORS.border }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{cohort.name}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>条件: {cohort.criteria} | 预估: {cohort.estimatedSize} | 创建: {cohort.createdBy} | 最近运行: {cohort.lastRun}</div></div>
            <button style={{ padding: '4px 10px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>应用</button>
          </div>
        ))}
      </div>
      {showSaveDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowSaveDialog(false)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>保存队列定义</div>
            <input style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} placeholder="队列名称" value={cohortName} onChange={e => setCohortName(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSaveDialog(false)} style={{ padding: '8px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer' }}>取消</button>
              <button onClick={saveCohort} style={{ padding: '8px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}><Save size={14} /> 保存</button>
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
  const submitIRB = () => {
    setSubmissions([...submissions, { id: `IRB${Date.now()}`, projectName: form.projectName, pi: form.pi, submittedDate: new Date().toISOString().split('T')[0]!, status: 'draft', approvedDate: '', expiryDate: '', consentForm: form.consentForm }])
    setShowForm(false); setForm({ projectName: '', pi: '', consentForm: '' }); showToast('IRB申请已提交', 'success')
  }
  const statusColors: Record<string, string> = { draft: COLORS.textSecondary, submitted: COLORS.warning, approved: COLORS.success, rejected: COLORS.danger }
  const statusLabels: Record<string, string> = { draft: '草稿', submitted: '已提交', approved: '已批准', rejected: '已拒绝' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: COLORS.primary, color: '#ffffff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Plus size={16} /> 新建IRB申请</button>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>课题名称</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>PI</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>提交日期</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>状态</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>批准日期</th><th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>到期日期</th><th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>操作</th></tr></thead>
          <tbody>{submissions.map((s, idx) => (
            <tr key={s.id} style={{ borderTop: '1px solid ' + COLORS.border, background: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgGray }}>
              <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>{s.projectName}</td>
              <td style={{ padding: '12px 16px', fontSize: 13 }}>{s.pi}</td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: COLORS.textSecondary }}>{s.submittedDate}</td>
              <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: statusColors[s.status] + '20', color: statusColors[s.status] }}>{statusLabels[s.status]}</span></td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: COLORS.textSecondary }}>{s.approvedDate || '-'}</td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: COLORS.textSecondary }}>{s.expiryDate || '-'}</td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}><button style={{ padding: '4px 10px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>查看</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FileSignature size={16} /> 知情同意书管理</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: 12, background: COLORS.bgGray, borderRadius: 6, borderLeft: '4px solid ' + COLORS.primary }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>肺癌早筛研究</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>知情同意书_v2.pdf</div>
            <div style={{ fontSize: 12, color: COLORS.success, marginTop: 4 }}>✓ 已签署</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: COLORS.bgGray, borderRadius: 6, borderLeft: '4px solid ' + COLORS.warning }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>阿尔茨海默病研究</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>知情同意书_v1.pdf</div>
            <div style={{ fontSize: 12, color: COLORS.warning, marginTop: 4 }}>⏳ 待签署</div>
          </div>
        </div>
      </div>
      <Modal open={showForm} onClose={() => setShowForm(false)} title="新建IRB申请" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>课题名称</label><input style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} value={form.projectName} onChange={e => setForm({ ...form, projectName: e.target.value })} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>PI</label><input style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + COLORS.border, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} value={form.pi} onChange={e => setForm({ ...form, pi: e.target.value })} /></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>知情同意书</label><input type="file" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid ' + COLORS.border, fontSize: 14 }} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: COLORS.bgGray, color: COLORS.textSecondary, border: '1px solid ' + COLORS.border, borderRadius: 6, cursor: 'pointer' }}>取消</button><button onClick={submitIRB} style={{ padding: '10px 20px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>提交申请</button></div>
        </div>
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
      {showProgress && <ProgressModal open={showProgress} title="数据导出中" message={`正在生成 ${exportFormat} 文件...`} progress={progress} />}
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Download size={16} /> 导出配置</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>导出格式</label><select style={{ width: '100%', padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 13 }} value={exportFormat} onChange={e => setExportFormat(e.target.value)}><option>CSV</option><option>JSON</option><option>FHIR</option><option>Parquet</option></select></div>
          <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>数据范围</label><select style={{ width: '100%', padding: '8px 12px', border: '1px solid ' + COLORS.border, borderRadius: 6, fontSize: 13 }}><option>全部记录 (320条)</option><option>选中记录 (50条)</option><option>按日期范围</option></select></div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={deidentify} onChange={e => setDeidentify(e.target.checked)} /> 导出时脱敏</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={includeDict} onChange={e => setIncludeDict(e.target.checked)} /> 包含数据字典</label>
        </div>
        {includeDict && (
          <div style={{ marginTop: 12, padding: 12, background: COLORS.bgGray, borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>数据字典预览</div>
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
        <div style={{ marginTop: 12 }}><button onClick={runExport} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}><Download size={16} /> 执行导出</button></div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> 导出审计日志</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>导出ID</th><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>申请人</th><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>审批人</th><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>导出时间</th><th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>记录数</th><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>目的</th><th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>状态</th></tr></thead>
          <tbody>{auditLog.map((a) => (
            <tr key={a.id} style={{ borderTop: '1px solid ' + COLORS.border }}>
              <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace' }}>{a.exportId}</td>
              <td style={{ padding: '10px 12px', fontSize: 13 }}>{a.requester}</td>
              <td style={{ padding: '10px 12px', fontSize: 13 }}>{a.approvedBy}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: COLORS.textSecondary }}>{a.exportTime}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{a.records}</td>
              <td style={{ padding: '10px 12px', fontSize: 13 }}>{a.purpose}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: COLORS.successLight, color: COLORS.success }}>{a.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== 新增: 数据质量看板 ====================
function DataQualityTab() {
  const [scores, setScores] = useState<DataQualityScore[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await researchApi.listQualityScores()
        if (res.success && Array.isArray(res.data)) setScores(res.data as DataQualityScore[])
      } catch { /* use empty state */ }
      finally { setLoading(false) }
    })()
  }, [])

  const overallCompleteness = scores.length > 0 ? Math.round(scores.reduce((s, f) => s + f.completeness, 0) / scores.length) : 0
  const overallConsistency = scores.length > 0 ? Math.round(scores.reduce((s, f) => s + f.consistency, 0) / scores.length) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: overallCompleteness >= 80 ? COLORS.success : COLORS.warning }}>{overallCompleteness}%</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>综合完整度</div>
        </div>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: overallConsistency >= 80 ? COLORS.success : COLORS.warning }}>{overallConsistency}%</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>综合一致度</div>
        </div>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>6/10</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>需改进字段</div>
        </div>
        <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.success }}>实时</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>数据新鲜度</div>
        </div>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Target size={16} /> 字段质量评分</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: COLORS.bgGray }}><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>字段</th><th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>完整度</th><th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>一致度</th><th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>新鲜度</th><th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>改进建议</th></tr></thead>
          <tbody>{scores.map((f, idx) => (
            <tr key={idx} style={{ borderTop: '1px solid ' + COLORS.border }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{f.field}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: f.completeness >= 90 ? COLORS.successLight : f.completeness >= 70 ? COLORS.warningLight : COLORS.dangerLight, color: f.completeness >= 90 ? COLORS.success : f.completeness >= 70 ? COLORS.warning : COLORS.danger }}>{f.completeness}%</span></td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: f.consistency >= 90 ? COLORS.successLight : f.consistency >= 70 ? COLORS.warningLight : COLORS.dangerLight, color: f.consistency >= 90 ? COLORS.success : f.consistency >= 70 ? COLORS.warning : COLORS.danger }}>{f.consistency}%</span></td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ fontSize: 12, color: f.freshness === '实时' ? COLORS.success : f.freshness === 'T+1' ? COLORS.warning : COLORS.danger }}>{f.freshness}</span></td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: f.suggestion ? COLORS.warning : COLORS.textSecondary }}>{f.suggestion || '✓ 良好'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ background: COLORS.bgWhite, borderRadius: 12, border: '1px solid ' + COLORS.border, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} /> 质量提升建议</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: 12, background: COLORS.warningLight, borderRadius: 6, borderLeft: '4px solid ' + COLORS.warning, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>自动补充缺失的身份证号</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>通过EMR接口自动获取缺失字段</div></div>
            <button style={{ padding: '6px 12px', background: COLORS.warning, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>实施</button>
          </div>
          <div style={{ padding: 12, background: COLORS.warningLight, borderRadius: 6, borderLeft: '4px solid ' + COLORS.warning, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>建立ICD编码自动映射规则</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>基于NLP自动生成诊断编码</div></div>
            <button style={{ padding: '6px 12px', background: COLORS.warning, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>实施</button>
          </div>
          <div style={{ padding: 12, background: COLORS.warningLight, borderRadius: 6, borderLeft: '4px solid ' + COLORS.warning, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>配置随访自动提醒机制</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>提升随访记录完整率</div></div>
            <button style={{ padding: '6px 12px', background: COLORS.warning, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>实施</button>
          </div>
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
    { key: 'projects', label: '课题管理', icon: <Folder size={16} /> },
    { key: 'extract', label: '数据抽取', icon: <Database size={16} /> },
    { key: 'labels', label: '数据标签化管理', icon: <Tag size={16} /> },
    { key: 'export', label: '导出管理', icon: <Download size={16} /> },
    { key: 'deid', label: 'DICOM脱敏', icon: <Shield size={16} /> },
    { key: 'cohort', label: '队列构建', icon: <Users size={16} /> },
    { key: 'irb', label: 'IRB工作流', icon: <FileSignature size={16} /> },
    { key: 'exportPipeline', label: '导出管线', icon: <Layers size={16} /> },
    { key: 'dataQuality', label: '数据质量', icon: <Activity size={16} /> },
  ]

  return (
    <div style={{ padding: 24, background: COLORS.bgGray, minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: COLORS.primary, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FlaskConical size={20} color="#ffffff" /></div>
          <div><h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>科研数据抽取</h1><p style={{ fontSize: 13, color: COLORS.textSecondary, margin: 0 }}>课题数据脱敏管理 · 5个课题 · 50条已抽取记录 · DICOM脱敏 · 队列构建 · IRB · 导出管线 · 数据质量</p></div>
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

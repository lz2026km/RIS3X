import React, { useState, useEffect } from 'react'
import {
  FileText, Send, Search, Filter, RefreshCw, Plus,
  ClipboardList, ShieldAlert, BarChart3,
  Building2, Building, Download, X, Circle, Monitor,
  FileSignature, Share2, TrendingUp, TrendingDown
} from 'lucide-react'
import {
  styles, COLORS,
  getStatusColor, getSeverityColor,
} from './RegionalReportServiceWire'
import { Select } from 'antd'
import type { TableColumnsType } from 'antd'
import { regionalApi } from '../../services/api'
import { DataTable } from '../../components/common/DataTable'
import { ActionButton } from '../../components/common/ActionButton'
import { t } from '../../i18n/appI18n'
import type { Institution, Consultation, Report, CriticalValueReport, RemoteDiagnosis, CoSignRecord, ShareRecord, SLARecord } from './RegionalReportServiceWire'

interface InstitutionListProps {
  selectedInstitution: string
  onSelect: (id: string) => void
}

export const InstitutionList: React.FC<InstitutionListProps> = ({ selectedInstitution, onSelect }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={styles.leftPanel}>
      <div style={styles.panelHeader}><span>{t('regionalReport.institutions')}</span><span style={{ fontSize: '12px', fontWeight: 400, color: COLORS.textMuted }}>{institutions.length}{t('regionalReport.institutionsUnit')}</span></div>
      <div style={{ padding: '8px' }}>
        <div style={{ ...styles.listItem, ...(selectedInstitution === 'all' ? styles.listItemActive : {}) }} onClick={() => onSelect('all')}
          onMouseEnter={e => { if (selectedInstitution !== 'all') e.currentTarget.style.backgroundColor = 'var(--bg-card)' }}
          onMouseLeave={e => { if (selectedInstitution !== 'all') e.currentTarget.style.backgroundColor = 'transparent' }}>
          <Building size={16} style={{ color: COLORS.primary }} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: '13px' }}>{t('regionalReport.allInstitutions')}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.allHospitals')}</div></div>
          <span style={{ ...styles.badge, backgroundColor: 'var(--color-info-bg)', color: COLORS.primary }}>{institutions.reduce((sum, i) => sum + i.reportCount, 0)}</span>
        </div>
        {institutions.map(inst => (
          <div key={inst.id} style={{ ...styles.listItem, ...(selectedInstitution === inst.id ? styles.listItemActive : {}) }} onClick={() => onSelect(inst.id)}
            onMouseEnter={e => { if (selectedInstitution !== inst.id) e.currentTarget.style.backgroundColor = 'var(--bg-card)' }}
            onMouseLeave={e => { if (selectedInstitution !== inst.id) e.currentTarget.style.backgroundColor = 'transparent' }}>
            <Building2 size={16} style={{ color: COLORS.secondary }} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: '13px' }}>{inst.name}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{inst.level} {inst.type}</div></div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ ...styles.badge, backgroundColor: 'var(--bg-card)', color: COLORS.textMuted }}>{inst.reportCount}</span>
              {inst.pendingCount > 0 && <div style={{ fontSize: '10px', color: COLORS.warning, marginTop: '2px' }}>{t('regionalReport.pendingReview')} {inst.pendingCount}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: COLORS.textMuted }}>{t('regionalReport.quickFilter')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['全部', '三级医院', '二级医院', '一级医院', '待审核'].map(filter => (
            <span key={filter} style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', backgroundColor: filter === '全部' ? COLORS.primary : 'var(--bg-card)', color: filter === '全部' ? 'white' : COLORS.textMuted }}>{filter}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ConsultationListProps {
  consultations: Consultation[]
  selectedConsultation: Consultation | null
  consultationTab: string
  onSelect: (c: Consultation) => void
  onAccept: (c: Consultation) => void
  onApply: () => void
  onTabChange: (key: string) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
}

export const ConsultationList: React.FC<ConsultationListProps> = ({
  consultations, selectedConsultation, consultationTab, onSelect, onAccept, onApply, onTabChange,
  searchKeyword, onSearchChange
}) => {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [applyForm, setApplyForm] = useState({
    patientName: '', gender: '男', age: '', modality: 'CT', examItem: '',
    institution: '', priority: '普通', applyReason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleCancelApply = () => {
    setApplyForm({ patientName: '', gender: '男', age: '', modality: 'CT', examItem: '', institution: '', priority: '普通', applyReason: '' })
    onTabChange('list')
  }

  const handleSubmitApply = async () => {
    if (!applyForm.patientName.trim()) { alert(t('regionalReport.requiredPatientName')); return; }
    if (!applyForm.applyReason.trim()) { alert(t('regionalReport.requiredApplyReason')); return; }
    setSubmitting(true)
    try {
      const res = await regionalApi.createConsultationRequest({
        patientName: applyForm.patientName,
        hospital: applyForm.institution || '本院',
        diagnosis: applyForm.examItem,
        priority: applyForm.priority === '紧急' ? 'urgent' : applyForm.priority === '立即' ? 'critical' : 'normal',
        status: 'open',
        createDate: new Date().toISOString().split('T')[0],
      })
      if (res.success) {
        alert(`会诊申请已提交: ${res.data?.id ?? ''}`)
      } else {
        alert('提交失败: ' + (res.error?.message ?? '接口不可用'))
      }
    } catch {
      alert(t('regionalReport.applySubmittedLocal'))
    } finally {
      handleCancelApply()
      setSubmitting(false)
    }
  }

  const consultationColumns: TableColumnsType<Consultation> = [
    {
      title: t('regionalReport.colCaseId'), dataIndex: 'caseId', key: 'caseId',
      render: (v: string, c: Consultation) => (
        <div><div style={{ fontWeight: 500 }}>{v}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{t('regionalReport.priorityLabel')} {c.priority === '立即' ? '🔥' : c.priority === '紧急' ? '⚠️' : ''}{c.priority}</div></div>
      ),
    },
    {
      title: t('regionalReport.colPatientInfo'), key: 'patient',
      render: (_: unknown, c: Consultation) => (<div><div>{c.patientName}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{c.gender} {c.age}{t('regionalReport.yearsUnit')}</div></div>),
    },
    { title: t('regionalReport.colExamInfo'), key: 'exam', render: (_: unknown, c: Consultation) => <div>{c.modality} - {c.examItem}</div> },
    { title: t('regionalReport.colApplyInstitution'), dataIndex: 'institution', key: 'institution' },
    {
      title: t('regionalReport.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: string) => <span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(v)}20`, color: getStatusColor(v) }}><Circle size={6} fill={getStatusColor(v)} /> {v}</span>,
    },
    { title: t('regionalReport.colApplyTime'), dataIndex: 'applyTime', key: 'applyTime', render: (v: string) => <div style={{ fontSize: 12 }}>{v}</div> },
    {
      title: t('regionalReport.colActions'), key: 'actions',
      render: (_: unknown, c: Consultation) => (
        c.status === '待接诊' || c.status === '会诊中' ? (
          <ActionButton
            action={c.status === '待接诊' ? 'submit' : 'edit'}
            size="compact"
            onClick={(e) => { e.stopPropagation(); if (c.status === '待接诊') onAccept(c); else onSelect(c) }}
          >
            {c.status === '待接诊' ? t('regionalReport.accept') : t('regionalReport.writeOpinion')}
          </ActionButton>
        ) : null
      ),
    },
  ]

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <span>{t('regionalReport.remoteConsultation')}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={onApply}><Plus size={14} /> {t('regionalReport.startConsult')}</button>
        </div>
      </div>
      <div style={styles.tabContainer}>
        {[{ key: 'list', label: t('regionalReport.consultRecords'), icon: <ClipboardList size={14} /> }, { key: 'apply', label: t('regionalReport.applyConsult'), icon: <Plus size={14} /> }].map(tab => (
          <button key={tab.key} style={{ ...styles.tab, ...(consultationTab === tab.key ? styles.tabActive : {}) }} onClick={() => onTabChange(tab.key)}>{tab.icon}{tab.label}</button>
        ))}
      </div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder={t('regionalReport.searchConsultPlaceholder')} style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
        {searchKeyword && <X size={14} style={{ cursor: 'pointer', color: COLORS.textMuted }} onClick={() => onSearchChange('')} />}
      </div>
      {consultationTab === 'list' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <DataTable<Consultation>
            rowKey="id"
            dataSource={consultations}
            columns={consultationColumns}
            scroll={{ x: 'max-content' }}
            emptyText={t('regionalReport.noConsultRecords')}
            onRow={(c) => ({ onClick: () => onSelect(c), style: { cursor: 'pointer', background: selectedConsultation?.id === c.id ? 'var(--color-info-bg)' : undefined } })}
          />
        </div>
      )}
      {consultationTab === 'apply' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: '600px' }}>
            <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.patientNameStar')}</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReport.placeholderPatientName')} value={applyForm.patientName} onChange={e => setApplyForm({ ...applyForm, patientName: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.gender')}</label><Select style={{ width: '100%' }} value={applyForm.gender} onChange={v => setApplyForm({ ...applyForm, gender: v })} options={[{ value: '男', label: '男' }, { value: '女', label: '女' }]} /></div>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.age')}</label><input type="number" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReportList.age')} value={applyForm.age} onChange={e => setApplyForm({ ...applyForm, age: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReport.modalityType')}</label><Select style={{ width: '100%' }} value={applyForm.modality} onChange={v => setApplyForm({ ...applyForm, modality: v })} options={[{ value: 'CT', label: 'CT' }, { value: 'MRI', label: 'MRI' }, { value: 'DR', label: 'DR' }, { value: '超声', label: '超声' }, { value: '胃肠', label: '胃肠' }]} /></div>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.examItem')}</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReportList.examItem')} value={applyForm.examItem} onChange={e => setApplyForm({ ...applyForm, examItem: e.target.value })} /></div>
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.applyInstitution')}</label><Select style={{ width: '100%' }} value={applyForm.institution || undefined} placeholder={t('regionalReport.selectApplyInstitution')} onChange={v => setApplyForm({ ...applyForm, institution: v })} options={institutions.map(inst => ({ value: inst.name, label: inst.name }))} /></div>
            <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.priority')}</label><div style={{ display: 'flex', gap: '10px' }}>{['普通', '紧急', '立即'].map(p => <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="radio" name="priority" value={p} checked={applyForm.priority === p} onChange={() => setApplyForm({ ...applyForm, priority: p })} />{p}</label>)}</div></div>
            <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.applyReasonStar')}</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '120px' }} placeholder={t('regionalReport.applyReasonPlaceholder')} value={applyForm.applyReason} onChange={e => setApplyForm({ ...applyForm, applyReason: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}><button onClick={handleCancelApply} style={{ ...styles.button, ...styles.buttonOutline }}>{t('regionalReportList.cancel')}</button><button onClick={() => void handleSubmitApply()} disabled={submitting} style={{ ...styles.button, ...styles.buttonPrimary }}><Send size={14} /> {submitting ? t('regionalReport.submitting') : t('regionalReport.submitApply')}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ReportListProps {
  reports: Report[]
  selectedReport: Report | null
  onSelect: (r: Report) => void
  onReview: (r: Report) => void
  onOpenDetail: (r: Report) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
  onOpenQualityFilter: () => void
}

export const ReportList: React.FC<ReportListProps> = ({ reports, selectedReport, onSelect, onReview, onOpenDetail, searchKeyword, onSearchChange, onOpenQualityFilter }) => {
  const reportColumns: TableColumnsType<Report> = [
    { title: t('regionalReport.colReportId'), dataIndex: 'reportId', key: 'reportId', render: (v: string, r: Report) => (<div><div style={{ fontWeight: 500 }}>{v}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{r.reportTime}</div></div>) },
    { title: t('regionalReport.colPatientInfo'), key: 'patient', render: (_: unknown, r: Report) => (<div><div>{r.patientName}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{r.gender} {r.age}{t('regionalReport.yearsUnit')}</div></div>) },
    { title: t('regionalReport.colExamInfo'), key: 'exam', render: (_: unknown, r: Report) => <div>{r.modality} - {r.examItem}</div> },
    { title: t('regionalReport.colReportInstitution'), dataIndex: 'institution', key: 'institution' },
    {
      title: t('regionalReport.colQualityScore'), dataIndex: 'qualityScore', key: 'qualityScore',
      render: (v: number) => v > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...styles.progressBar, width: 60 }}><div style={{ ...styles.progressFill, width: `${v}%`, backgroundColor: v >= 90 ? COLORS.success : v >= 70 ? COLORS.warning : COLORS.danger }} /></div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
        </div>
      ) : <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    { title: t('regionalReport.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(v)}20`, color: getStatusColor(v) }}>{v}</span> },
    {
      title: t('regionalReport.colActions'), key: 'actions',
      render: (_: unknown, r: Report) => (
        <>
          {r.status === '待审核' && <ActionButton action="submit" size="compact" style={{ marginRight: 6 }} onClick={(e) => { e.stopPropagation(); onReview(r) }}>{t('regionalReport.review')}</ActionButton>}
          <ActionButton action="edit" size="compact" onClick={(e) => { e.stopPropagation(); onOpenDetail(r) }}>{t('regionalReport.view')}</ActionButton>
        </>
      ),
    },
  ]

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.reportReview')}</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onOpenQualityFilter}><Filter size={14} /> {t('regionalReportList.qualityFilter')}</button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: t('regionalReport.reportList'), icon: <FileText size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder={t('regionalReport.searchReportPlaceholder')} style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <DataTable<Report>
          rowKey="id"
          dataSource={reports}
          columns={reportColumns}
          scroll={{ x: 'max-content' }}
          onRow={(r) => ({ onClick: () => onSelect(r), style: { cursor: 'pointer', background: selectedReport?.id === r.id ? 'var(--color-info-bg)' : undefined } })}
        />
      </div>
    </div>
  )
}

interface RemoteDiagnosisListProps {
  diagnoses: RemoteDiagnosis[]
  selectedRemoteDiagnosis: RemoteDiagnosis | null
  onSelect: (rd: RemoteDiagnosis) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
  onSync: () => void
}

export const RemoteDiagnosisList: React.FC<RemoteDiagnosisListProps> = ({ diagnoses, selectedRemoteDiagnosis, onSelect, searchKeyword, onSearchChange, onSync }) => {
  const remoteColumns: TableColumnsType<RemoteDiagnosis> = [
    { title: t('regionalReport.colCaseId'), dataIndex: 'caseId', key: 'caseId', render: (v: string) => <div style={{ fontWeight: 500 }}>{v}</div> },
    { title: t('regionalReport.colPatientInfo'), key: 'patient', render: (_: unknown, rd: RemoteDiagnosis) => (<div><div>{rd.patientName}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{rd.gender} {rd.age}{t('regionalReport.yearsUnit')}</div></div>) },
    { title: t('regionalReport.colExamType'), dataIndex: 'examType', key: 'examType' },
    { title: t('regionalReport.colApplyInstitution'), dataIndex: 'applyInstitution', key: 'applyInstitution' },
    { title: t('regionalReport.colRemoteExpert'), key: 'expert', render: (_: unknown, rd: RemoteDiagnosis) => (<div><div style={{ fontWeight: 500 }}>{rd.remoteExpert}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{rd.expertInstitution}</div></div>) },
    {
      title: t('regionalReport.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: string, rd: RemoteDiagnosis) => (
        <>
          <span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(v)}20`, color: getStatusColor(v) }}><Circle size={6} fill={getStatusColor(v)} /> {v}</span>
          {rd.isOtherTyping && <div style={{ fontSize: 10, color: COLORS.inProgress, marginTop: 2 }}>📝 {rd.otherTypingName}{t('regionalReport.typing')}</div>}
        </>
      ),
    },
    { title: t('regionalReport.colApplyTime'), dataIndex: 'applyTime', key: 'applyTime', render: (v: string) => <div style={{ fontSize: 12 }}>{v}</div> },
    {
      title: t('regionalReport.colActions'), key: 'actions',
      render: (_: unknown, rd: RemoteDiagnosis) => (
        <ActionButton action="edit" size="compact" onClick={(e) => { e.stopPropagation(); onSelect(rd) }}>{t('regionalReport.write')}</ActionButton>
      ),
    },
  ]

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.remoteDiagnosis')}</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onSync}><RefreshCw size={14} /></button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: t('regionalReport.remoteWritingList'), icon: <Monitor size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder={t('regionalReport.searchRemotePlaceholder')} style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
        {searchKeyword && <X size={14} style={{ cursor: 'pointer', color: COLORS.textMuted }} onClick={() => onSearchChange('')} />}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <DataTable<RemoteDiagnosis>
          rowKey="id"
          dataSource={diagnoses}
          columns={remoteColumns}
          scroll={{ x: 'max-content' }}
          onRow={(rd) => ({ onClick: () => onSelect(rd), style: { cursor: 'pointer', background: selectedRemoteDiagnosis?.id === rd.id ? 'var(--color-info-bg)' : undefined } })}
        />
      </div>
    </div>
  )
}

interface CoSignListProps {
  records: CoSignRecord[]
  selectedCoSign: CoSignRecord | null
  onSelect: (cs: CoSignRecord) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
  onAdd: () => void
}

export const CoSignList: React.FC<CoSignListProps> = ({ records, selectedCoSign, onSelect, searchKeyword, onSearchChange, onAdd }) => {
  const coSignColumns: TableColumnsType<CoSignRecord> = [
    { title: t('regionalReport.colReportId'), dataIndex: 'reportId', key: 'reportId', render: (v: string) => <div style={{ fontWeight: 500 }}>{v}</div> },
    { title: t('regionalReport.colPatientInfo'), key: 'patient', render: (_: unknown, cs: CoSignRecord) => (<div><div>{cs.patientName}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{cs.gender} {cs.age}{t('regionalReport.yearsUnit')}</div></div>) },
    { title: t('regionalReport.colExamType'), dataIndex: 'examType', key: 'examType' },
    {
      title: t('regionalReport.colParticipatingInstitutions'), dataIndex: 'participatingInstitutions', key: 'participatingInstitutions',
      render: (v: string[]) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{v.map((inst, idx) => <span key={idx} style={{ ...styles.badge, backgroundColor: '#e0e7ff', color: COLORS.primary, fontSize: 10 }}>{inst}</span>)}</div>,
    },
    { title: t('regionalReport.colSignStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(v)}20`, color: getStatusColor(v) }}><Circle size={6} fill={getStatusColor(v)} /> {v}</span> },
    {
      title: t('regionalReport.colSignTime'), key: 'signTime',
      render: (_: unknown, cs: CoSignRecord) => (<div><div style={{ fontSize: 12 }}>{cs.createTime}</div>{cs.completeTime && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{t('regionalReport.completedLabel')} {cs.completeTime}</div>}</div>),
    },
    {
      title: t('regionalReport.colActions'), key: 'actions',
      render: (_: unknown, cs: CoSignRecord) => <ActionButton action="edit" size="compact" onClick={(e) => { e.stopPropagation(); onSelect(cs) }}>{t('regionalReport.view')}</ActionButton>,
    },
  ]

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.coSign')}</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onAdd}><Plus size={14} /> {t('regionalReport.addNew')}</button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: t('regionalReport.coSignRecords'), icon: <FileSignature size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder={t('regionalReport.searchCoSignPlaceholder')} style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <DataTable<CoSignRecord>
          rowKey="id"
          dataSource={records}
          columns={coSignColumns}
          scroll={{ x: 'max-content' }}
          onRow={(cs) => ({ onClick: () => onSelect(cs), style: { cursor: 'pointer', background: selectedCoSign?.id === cs.id ? 'var(--color-info-bg)' : undefined } })}
        />
      </div>
    </div>
  )
}

interface CriticalValuePanelProps {
  criticalValues: CriticalValueReport[]
  onConfirm: (cv: CriticalValueReport) => void
  onClose: (cv: CriticalValueReport) => void
  onExport: () => void
  onPrevPage: () => void
  onNextPage: () => void
  onStats: () => void
}

export const CriticalValuePanel: React.FC<CriticalValuePanelProps> = ({ criticalValues, onConfirm, onClose, onExport, onPrevPage, onNextPage, onStats }) => {
  const criticalColumns: TableColumnsType<CriticalValueReport> = [
    { title: t('regionalReport.colPatientInfo'), key: 'patient', render: (_: unknown, cv: CriticalValueReport) => (<div><div style={{ fontWeight: 500 }}>{cv.patientName}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{cv.gender} {cv.age}{t('regionalReport.yearsUnit')}</div></div>) },
    { title: t('regionalReport.colExamInfo'), key: 'exam', render: (_: unknown, cv: CriticalValueReport) => (<div><div>{cv.modality}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{cv.examItem}</div></div>) },
    { title: t('regionalReport.colInstitution'), dataIndex: 'institution', key: 'institution' },
    { title: t('regionalReport.colCriticalFinding'), dataIndex: 'criticalFinding', key: 'criticalFinding', render: (v: string) => <div style={{ color: COLORS.danger, fontWeight: 500 }}>{v}</div> },
    { title: t('regionalReport.colSeverity'), dataIndex: 'severity', key: 'severity', render: (v: string) => <span style={{ ...styles.statusTag, backgroundColor: `${getSeverityColor(v)}20`, color: getSeverityColor(v) }}>{v}</span> },
    { title: t('regionalReport.colReportedTime'), dataIndex: 'reportedTime', key: 'reportedTime', render: (v: string) => <div style={{ fontSize: 12 }}>{v}</div> },
    { title: t('regionalReport.colReportedDoctor'), dataIndex: 'reportedDoctor', key: 'reportedDoctor' },
    { title: t('regionalReport.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(v)}20`, color: getStatusColor(v) }}><Circle size={6} fill={getStatusColor(v)} /> {v}</span> },
    { title: t('regionalReport.colReceiveTime'), dataIndex: 'receiveTime', key: 'receiveTime', render: (v?: string) => v ? <div style={{ fontSize: 12 }}>{v}</div> : <span style={{ color: COLORS.textMuted }}>-</span> },
    { title: t('regionalReport.colHandleTime'), dataIndex: 'handleTime', key: 'handleTime', render: (v?: string) => v ? <div style={{ fontSize: 12 }}>{v}</div> : <span style={{ color: COLORS.textMuted }}>-</span> },
    {
      title: t('regionalReport.colActions'), key: 'actions',
      render: (_: unknown, cv: CriticalValueReport) => (
        <>
          {cv.status === '待确认' && <ActionButton action="submit" size="compact" onClick={() => onConfirm(cv)}>{t('regionalReport.confirm')}</ActionButton>}
          {cv.status === '处理中' && <ActionButton action="save" size="compact" onClick={() => onClose(cv)}>{t('regionalReport.closeLoop')}</ActionButton>}
        </>
      ),
    },
  ]

  return (
    <div style={styles.bottomPanel}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={18} style={{ color: COLORS.danger }} /><span>{t('regionalReport.criticalRecords')}</span><span style={{ ...styles.badge, backgroundColor: COLORS.danger, color: 'white' }}>{criticalValues.filter(cv => cv.status !== '已闭环').length} {t('regionalReport.pendingHandle')}</span></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }} onClick={onStats}><BarChart3 size={14} /> {t('regionalReport.statsReport')}</button>
          <button style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }} onClick={onExport}><Download size={14} /> {t('regionalReport.export')}</button>
        </div>
      </div>
      <DataTable<CriticalValueReport>
        rowKey="id"
        dataSource={criticalValues}
        columns={criticalColumns}
        scroll={{ x: 'max-content' }}
      />
      <div style={styles.pagination}>
        <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.totalLabel')} {criticalValues.length} {t('regionalReport.recordsUnit')}</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }} onClick={onPrevPage}>{t('regionalReport.prevPage')}</button>
          <button style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }} onClick={onNextPage}>{t('regionalReport.nextPage')}</button>
        </div>
      </div>
    </div>
  )
}

// ============ 跨机构报告分享组件 ============
export const ReportSharingSection: React.FC = () => {
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareForm, setShareForm] = useState({ reportId: '', targetInstitution: '', consent: true })
  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/v1/regional/share-records').then(r => r.json())
        if (!cancelled && res.data) setShares(res.data)
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleRevoke = (id: string) => { setShares(shares.map(s => s.id === id ? { ...s, status: 'revoked' as const } : s)) }
  const handleShare = () => {
    setShares([...shares, { id: `SH${Date.now()}`, reportId: shareForm.reportId, patientName: '新建患者', institution: '本院', targetInstitution: shareForm.targetInstitution, sharedDate: new Date().toISOString().split('T')[0]!, sharedBy: '当前用户', status: 'active', consent: shareForm.consent, accessCount: 0 }])
    setShowShareModal(false); setShareForm({ reportId: '', targetInstitution: '', consent: true })
  }

  const shareColumns: TableColumnsType<ShareRecord> = [
    { title: t('regionalReport.colReportId'), dataIndex: 'reportId', key: 'reportId' },
    { title: t('regionalReport.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('regionalReport.colSourceInstitution'), dataIndex: 'institution', key: 'institution' },
    { title: t('regionalReport.colTargetInstitution'), dataIndex: 'targetInstitution', key: 'targetInstitution' },
    { title: t('regionalReport.colSharedTime'), dataIndex: 'sharedDate', key: 'sharedDate' },
    { title: t('regionalReport.colSharedBy'), dataIndex: 'sharedBy', key: 'sharedBy' },
    {
      title: t('regionalReport.colConsent'), dataIndex: 'consent', key: 'consent',
      render: (v: boolean) => v ? <span style={{ color: COLORS.success }}>✓ {t('regionalReport.consentObtained')}</span> : <span style={{ color: COLORS.warning }}>⏳ {t('regionalReport.consentPending')}</span>,
    },
    { title: t('regionalReport.colAccessCount'), dataIndex: 'accessCount', key: 'accessCount' },
    {
      title: t('regionalReport.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: string) => <span style={{ ...styles.statusTag, backgroundColor: v === 'active' ? 'var(--color-success-bg)' : 'var(--bg-card)', color: v === 'active' ? COLORS.success : COLORS.textMuted }}>{v === 'active' ? t('regionalReport.statusActive') : t('regionalReport.statusRevoked')}</span>,
    },
    {
      title: t('regionalReport.colActions'), key: 'actions',
      render: (_: unknown, s: ShareRecord) => s.status === 'active' ? (
        <ActionButton action="delete" size="compact" variant="default" style={{ color: COLORS.danger }} onClick={() => handleRevoke(s.id)}>{t('regionalReport.revoke')}</ActionButton>
      ) : null,
    },
  ]

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.crossInstitutionSharing')}</span><span style={{ fontSize: '11px', color: COLORS.warning }}>{t('regionalReport.mswDemoData')}</span><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => setShowShareModal(true)}><Share2 size={14} /> {t('regionalReport.shareReport')}</button></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <DataTable<ShareRecord>
          rowKey="id"
          dataSource={shares}
          columns={shareColumns}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '8px' }}>{t('regionalReport.shareAuditLog')}</div>
        <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.shareAuditHint')}</div>
      </div>
      {showShareModal && (
        <div style={styles.modal} onClick={() => setShowShareModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}><span>{t('regionalReport.shareReport')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowShareModal(false)} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.reportIdLabel')}</label><input style={{ ...styles.input, width: '100%' }} value={shareForm.reportId} onChange={e => setShareForm({ ...shareForm, reportId: e.target.value })} placeholder={t('regionalReport.inputReportId')} /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.targetInstitution')}</label><Select style={{ width: '100%' }} value={shareForm.targetInstitution || undefined} placeholder={t('regionalReportList.pleaseSelect')} onChange={v => setShareForm({ ...shareForm, targetInstitution: v })} options={institutions.map(i => ({ value: i.name, label: i.name }))} /></div>
              <div style={styles.formGroup}><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={shareForm.consent} onChange={e => setShareForm({ ...shareForm, consent: e.target.checked })} /> <span style={{ fontSize: 13 }}>{t('regionalReport.consentObtainedLabel')}</span></label></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={() => setShowShareModal(false)}>{t('regionalReportList.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleShare}><Share2 size={14} /> {t('regionalReport.share')}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 远程阅读SLA监控 ============
export const SLAAndTATSection: React.FC = () => {
  const [slaData, setSlaData] = useState<SLARecord[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadSla = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/v1/regional/sla-data').then(r => r.json())
      if (res.data) setSlaData(res.data)
    } catch { /* keep empty */ }
    setRefreshing(false)
  }

  useEffect(() => { void loadSla() }, [])

  const slaColumns: TableColumnsType<SLARecord> = [
    { title: t('regionalReport.colRemoteSite'), dataIndex: 'siteName', key: 'siteName', render: (v: string) => <div style={{ fontWeight: 500 }}>{v}</div> },
    { title: t('regionalReport.colAssignedExams'), dataIndex: 'assignedExams', key: 'assignedExams' },
    { title: t('regionalReport.colCompleted'), dataIndex: 'completedExams', key: 'completedExams' },
    { title: t('regionalReport.colAvgTat'), dataIndex: 'avgTAT', key: 'avgTAT' },
    { title: t('regionalReport.colSlaTarget'), dataIndex: 'slaTarget', key: 'slaTarget' },
    {
      title: t('regionalReport.colSlaCompliance'), dataIndex: 'slaCompliance', key: 'slaCompliance',
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...styles.progressBar, width: 60 }}><div style={{ ...styles.progressFill, width: `${v}%`, backgroundColor: v >= 90 ? COLORS.success : v >= 80 ? COLORS.warning : COLORS.danger }} /></div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{v}%</span>
        </div>
      ),
    },
    {
      title: t('regionalReport.colStatus'), dataIndex: 'slaCompliance', key: 'status',
      render: (v: number) => <span style={{ ...styles.statusTag, backgroundColor: v >= 90 ? 'var(--color-success-bg)' : v >= 80 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)', color: v >= 90 ? COLORS.success : v >= 80 ? COLORS.warning : COLORS.danger }}>{v >= 90 ? t('regionalReport.slaMet') : v >= 80 ? t('regionalReport.slaBorderline') : t('regionalReport.slaMissed')}</span>,
    },
  ]

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.slaMonitor')}</span><span style={{ fontSize: '11px', color: COLORS.warning }}>{t('regionalReport.mswDemoData')}</span><button onClick={() => void loadSla()} disabled={refreshing} style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }}><RefreshCw size={14} /> {refreshing ? t('regionalReport.refreshing') : t('regionalReport.refresh')}</button></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.primary }}>136</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.monthlyAssignedExams')}</div></div>
          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.success }}>126</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.completed')}</div></div>
          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.warning }}>3.0h</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.avgTat')}</div></div>
          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.success }}>92%</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.slaComplianceRate')}</div></div>
        </div>
        <DataTable<SLARecord>
          rowKey={(s) => s.siteName}
          dataSource={slaData}
          columns={slaColumns}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  )
}

// ============ 区域统计看板 ============
export const RegionalStatsDashboard: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReportList.regionalStats')}</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{institutions.reduce((s, i) => s + i.reportCount, 0).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{t('regionalReport.regionalTotalExams')}</div>
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}><TrendingUp size={11} /> +8.2% {t('regionalReportList.vsLastMonth')}</div>
          </div>
          <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>18 {t('regionalReport.minutesUnit')}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{t('regionalReport.avgReportTat')}</div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}><TrendingDown size={11} /> -5% {t('regionalReportList.vsLastMonth')}</div>
          </div>
          <div style={{ background: 'var(--color-warning-bg)', padding: '16px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>96.8%</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{t('regionalReport.regionalAvgQuality')}</div>
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}><TrendingUp size={11} /> +0.3% {t('regionalReportList.vsLastMonth')}</div>
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('regionalReport.institutionExamCompare')}</div>
          {institutions.map(inst => { const maxVal = Math.max(...institutions.map(i => i.reportCount)); const pct = maxVal > 0 ? (inst.reportCount / maxVal) * 100 : 0; return (
            <div key={inst.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}><span>{inst.name}</span><span style={{ fontWeight: 600 }}>{inst.reportCount}</span></div>
              <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${pct}%`, backgroundColor: COLORS.primary }} /></div>
            </div>
          )})}
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('regionalReport.institutionAvgTat')}</div>
          {institutions.map(inst => { const tat = 15 + Math.floor(Math.random() * 30); return (
            <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px' }}>{inst.name}</span>
              <span style={{ fontWeight: 600, color: tat <= 30 ? COLORS.success : tat <= 45 ? COLORS.warning : COLORS.danger }}>{tat} {t('regionalReport.minutesUnit')}</span>
            </div>
          )})}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{t('regionalReport.qualityMonitorMetrics')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.reportCompleteRate')}</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>98.2%</div></div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.diagnosisMatchRate')}</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>96.5%</div></div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.criticalCloseRate')}</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>98%</div></div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.consultResponseTime')}</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.warning }}>18 {t('regionalReport.minutesUnit')}</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

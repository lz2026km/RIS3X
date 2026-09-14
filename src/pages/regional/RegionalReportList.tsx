import React, { useState, useEffect } from 'react'
import {
  FileText, Send, Search, Filter, RefreshCw, Plus, Eye,
  ClipboardList, ShieldAlert, BarChart3,
  Building2, Building, Download, X, Circle, Monitor, PenTool,
  FileSignature, Share2, UserX, TrendingUp, TrendingDown
} from 'lucide-react'
import {
  styles, COLORS,
  getStatusColor, getSeverityColor,
} from './RegionalReportServiceWire'
import { regionalApi } from '../../services/api'
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
          {consultations.length === 0 ? (
            <div style={styles.emptyState}><FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>{t('regionalReport.noConsultRecords')}</div></div>
          ) : (
            <div style={{ overflowX: "auto" }}><table style={styles.table}>
              <thead><tr><th style={styles.th}>{t('regionalReport.colCaseId')}</th><th style={styles.th}>{t('regionalReport.colPatientInfo')}</th><th style={styles.th}>{t('regionalReport.colExamInfo')}</th><th style={styles.th}>{t('regionalReport.colApplyInstitution')}</th><th style={styles.th}>{t('regionalReport.colStatus')}</th><th style={styles.th}>{t('regionalReport.colApplyTime')}</th><th style={styles.th}>{t('regionalReport.colActions')}</th></tr></thead>
              <tbody>{consultations.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer', backgroundColor: selectedConsultation?.id === c.id ? 'var(--color-info-bg)' : 'transparent' }} onClick={() => onSelect(c)}>
                  <td style={styles.td}><div style={{ fontWeight: 500 }}>{c.caseId}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.priorityLabel')} {c.priority === '立即' ? '🔥' : c.priority === '紧急' ? '⚠️' : ''}{c.priority}</div></td>
                  <td style={styles.td}><div>{c.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.gender} {c.age}{t('regionalReport.yearsUnit')}</div></td>
                  <td style={styles.td}><div>{c.modality} - {c.examItem}</div></td>
                  <td style={styles.td}>{c.institution}</td>
                  <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(c.status)}20`, color: getStatusColor(c.status) }}><Circle size={6} fill={getStatusColor(c.status)} /> {c.status}</span></td>
                  <td style={styles.td}><div style={{ fontSize: '12px' }}>{c.applyTime}</div></td>
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    {c.status === '待接诊' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onAccept(c)}>{t('regionalReport.accept')}</button>}
                    {c.status === '会诊中' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.success, color: 'white' }} onClick={() => onSelect(c)}>{t('regionalReport.writeOpinion')}</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
      {consultationTab === 'apply' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: '600px' }}>
            <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.patientNameStar')}</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReport.placeholderPatientName')} value={applyForm.patientName} onChange={e => setApplyForm({ ...applyForm, patientName: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.gender')}</label><select style={{ ...styles.input, width: '100%' }} value={applyForm.gender} onChange={e => setApplyForm({ ...applyForm, gender: e.target.value })}><option value="男">男</option><option value="女">女</option></select></div>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.age')}</label><input type="number" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReportList.age')} value={applyForm.age} onChange={e => setApplyForm({ ...applyForm, age: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReport.modalityType')}</label><select style={{ ...styles.input, width: '100%' }} value={applyForm.modality} onChange={e => setApplyForm({ ...applyForm, modality: e.target.value })}><option value="CT">CT</option><option value="MRI">MRI</option><option value="DR">DR</option><option value="超声">超声</option><option value="胃肠">胃肠</option></select></div>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.examItem')}</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReportList.examItem')} value={applyForm.examItem} onChange={e => setApplyForm({ ...applyForm, examItem: e.target.value })} /></div>
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReportList.applyInstitution')}</label><select style={{ ...styles.input, width: '100%' }} value={applyForm.institution} onChange={e => setApplyForm({ ...applyForm, institution: e.target.value })}><option value="">{t('regionalReport.selectApplyInstitution')}</option>{institutions.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}</select></div>
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
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.reportReview')}</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onOpenQualityFilter}><Filter size={14} /> {t('regionalReportList.qualityFilter')}</button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: t('regionalReport.reportList'), icon: <FileText size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder={t('regionalReport.searchReportPlaceholder')} style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('regionalReport.colReportId')}</th><th style={styles.th}>{t('regionalReport.colPatientInfo')}</th><th style={styles.th}>{t('regionalReport.colExamInfo')}</th><th style={styles.th}>{t('regionalReport.colReportInstitution')}</th><th style={styles.th}>{t('regionalReport.colQualityScore')}</th><th style={styles.th}>{t('regionalReport.colStatus')}</th><th style={styles.th}>{t('regionalReport.colActions')}</th></tr></thead>
          <tbody>{reports.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer', backgroundColor: selectedReport?.id === r.id ? 'var(--color-info-bg)' : 'transparent' }} onClick={() => onSelect(r)}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{r.reportId}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.reportTime}</div></td>
              <td style={styles.td}><div>{r.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.gender} {r.age}{t('regionalReport.yearsUnit')}</div></td>
              <td style={styles.td}><div>{r.modality} - {r.examItem}</div></td>
              <td style={styles.td}>{r.institution}</td>
              <td style={styles.td}>{r.qualityScore > 0 ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ ...styles.progressBar, width: '60px' }}><div style={{ ...styles.progressFill, width: `${r.qualityScore}%`, backgroundColor: r.qualityScore >= 90 ? COLORS.success : r.qualityScore >= 70 ? COLORS.warning : COLORS.danger }} /></div><span style={{ fontSize: '12px', fontWeight: 600 }}>{r.qualityScore}</span></div> : <span style={{ color: COLORS.textMuted }}>-</span>}</td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(r.status)}20`, color: getStatusColor(r.status) }}>{r.status}</span></td>
              <td style={styles.td} onClick={e => e.stopPropagation()}>
                {r.status === '待审核' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.success, color: 'white', marginRight: '6px' }} onClick={() => onReview(r)}>{t('regionalReport.review')}</button>}
                <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onOpenDetail(r)}><Eye size={14} /> {t('regionalReport.view')}</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
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
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('regionalReport.colCaseId')}</th><th style={styles.th}>{t('regionalReport.colPatientInfo')}</th><th style={styles.th}>{t('regionalReport.colExamType')}</th><th style={styles.th}>{t('regionalReport.colApplyInstitution')}</th><th style={styles.th}>{t('regionalReport.colRemoteExpert')}</th><th style={styles.th}>{t('regionalReport.colStatus')}</th><th style={styles.th}>{t('regionalReport.colApplyTime')}</th><th style={styles.th}>{t('regionalReport.colActions')}</th></tr></thead>
          <tbody>{diagnoses.map(rd => (
                            <tr key={rd.id} style={{ cursor: 'pointer', backgroundColor: selectedRemoteDiagnosis?.id === rd.id ? 'var(--color-info-bg)' : 'transparent' }} onClick={() => onSelect(rd)}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{rd.caseId}</div></td>
              <td style={styles.td}><div>{rd.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{rd.gender} {rd.age}{t('regionalReport.yearsUnit')}</div></td>
              <td style={styles.td}>{rd.examType}</td>
              <td style={styles.td}>{rd.applyInstitution}</td>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{rd.remoteExpert}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{rd.expertInstitution}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(rd.status)}20`, color: getStatusColor(rd.status) }}><Circle size={6} fill={getStatusColor(rd.status)} /> {rd.status}</span>{rd.isOtherTyping && <div style={{ fontSize: '10px', color: COLORS.inProgress, marginTop: '2px' }}>📝 {rd.otherTypingName}{t('regionalReport.typing')}</div>}</td>
              <td style={styles.td}><div style={{ fontSize: '12px' }}>{rd.applyTime}</div></td>
              <td style={styles.td} onClick={e => e.stopPropagation()}><button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onSelect(rd)}><PenTool size={14} /> {t('regionalReport.write')}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
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
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.coSign')}</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onAdd}><Plus size={14} /> {t('regionalReport.addNew')}</button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: t('regionalReport.coSignRecords'), icon: <FileSignature size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder={t('regionalReport.searchCoSignPlaceholder')} style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('regionalReport.colReportId')}</th><th style={styles.th}>{t('regionalReport.colPatientInfo')}</th><th style={styles.th}>{t('regionalReport.colExamType')}</th><th style={styles.th}>{t('regionalReport.colParticipatingInstitutions')}</th><th style={styles.th}>{t('regionalReport.colSignStatus')}</th><th style={styles.th}>{t('regionalReport.colSignTime')}</th><th style={styles.th}>{t('regionalReport.colActions')}</th></tr></thead>
          <tbody>{records.map(cs => (
                <tr key={cs.id} style={{ cursor: 'pointer', backgroundColor: selectedCoSign?.id === cs.id ? 'var(--color-info-bg)' : 'transparent' }} onClick={() => onSelect(cs)}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{cs.reportId}</div></td>
              <td style={styles.td}><div>{cs.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{cs.gender} {cs.age}{t('regionalReport.yearsUnit')}</div></td>
              <td style={styles.td}>{cs.examType}</td>
              <td style={styles.td}><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{cs.participatingInstitutions.map((inst, idx) => <span key={idx} style={{ ...styles.badge, backgroundColor: '#e0e7ff', color: COLORS.primary, fontSize: '10px' }}>{inst}</span>)}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(cs.status)}20`, color: getStatusColor(cs.status) }}><Circle size={6} fill={getStatusColor(cs.status)} /> {cs.status}</span></td>
              <td style={styles.td}><div style={{ fontSize: '12px' }}>{cs.createTime}</div>{cs.completeTime && <div style={{ fontSize: '11px', color: COLORS.textMuted }}>{t('regionalReport.completedLabel')} {cs.completeTime}</div>}</td>
              <td style={styles.td} onClick={e => e.stopPropagation()}><button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onSelect(cs)}><Eye size={14} /> {t('regionalReport.view')}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
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
  return (
    <div style={styles.bottomPanel}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={18} style={{ color: COLORS.danger }} /><span>{t('regionalReport.criticalRecords')}</span><span style={{ ...styles.badge, backgroundColor: COLORS.danger, color: 'white' }}>{criticalValues.filter(cv => cv.status !== '已闭环').length} {t('regionalReport.pendingHandle')}</span></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }} onClick={onStats}><BarChart3 size={14} /> {t('regionalReport.statsReport')}</button>
          <button style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }} onClick={onExport}><Download size={14} /> {t('regionalReport.export')}</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('regionalReport.colPatientInfo')}</th><th style={styles.th}>{t('regionalReport.colExamInfo')}</th><th style={styles.th}>{t('regionalReport.colInstitution')}</th><th style={styles.th}>{t('regionalReport.colCriticalFinding')}</th><th style={styles.th}>{t('regionalReport.colSeverity')}</th><th style={styles.th}>{t('regionalReport.colReportedTime')}</th><th style={styles.th}>{t('regionalReport.colReportedDoctor')}</th><th style={styles.th}>{t('regionalReport.colStatus')}</th><th style={styles.th}>{t('regionalReport.colReceiveTime')}</th><th style={styles.th}>{t('regionalReport.colHandleTime')}</th><th style={styles.th}>{t('regionalReport.colActions')}</th></tr></thead>
          <tbody>{criticalValues.map(cv => (
            <tr key={cv.id}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{cv.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{cv.gender} {cv.age}{t('regionalReport.yearsUnit')}</div></td>
              <td style={styles.td}><div>{cv.modality}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{cv.examItem}</div></td>
              <td style={styles.td}>{cv.institution}</td>
              <td style={styles.td}><div style={{ color: COLORS.danger, fontWeight: 500 }}>{cv.criticalFinding}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getSeverityColor(cv.severity)}20`, color: getSeverityColor(cv.severity) }}>{cv.severity}</span></td>
              <td style={styles.td}><div style={{ fontSize: '12px' }}>{cv.reportedTime}</div></td>
              <td style={styles.td}>{cv.reportedDoctor}</td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(cv.status)}20`, color: getStatusColor(cv.status) }}><Circle size={6} fill={getStatusColor(cv.status)} /> {cv.status}</span></td>
              <td style={styles.td}>{cv.receiveTime ? <div style={{ fontSize: '12px' }}>{cv.receiveTime}</div> : <span style={{ color: COLORS.textMuted }}>-</span>}</td>
              <td style={styles.td}>{cv.handleTime ? <div style={{ fontSize: '12px' }}>{cv.handleTime}</div> : <span style={{ color: COLORS.textMuted }}>-</span>}</td>
              <td style={styles.td}>
                {cv.status === '待确认' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.warning, color: 'white' }} onClick={() => onConfirm(cv)}>{t('regionalReport.confirm')}</button>}
                {cv.status === '处理中' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.success, color: 'white' }} onClick={() => onClose(cv)}>{t('regionalReport.closeLoop')}</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
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

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>{t('regionalReport.crossInstitutionSharing')}</span><span style={{ fontSize: '11px', color: COLORS.warning }}>{t('regionalReport.mswDemoData')}</span><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => setShowShareModal(true)}><Share2 size={14} /> {t('regionalReport.shareReport')}</button></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('regionalReport.colReportId')}</th><th style={styles.th}>{t('regionalReport.colPatient')}</th><th style={styles.th}>{t('regionalReport.colSourceInstitution')}</th><th style={styles.th}>{t('regionalReport.colTargetInstitution')}</th><th style={styles.th}>{t('regionalReport.colSharedTime')}</th><th style={styles.th}>{t('regionalReport.colSharedBy')}</th><th style={styles.th}>{t('regionalReport.colConsent')}</th><th style={styles.th}>{t('regionalReport.colAccessCount')}</th><th style={styles.th}>{t('regionalReport.colStatus')}</th><th style={styles.th}>{t('regionalReport.colActions')}</th></tr></thead>
          <tbody>{shares.map(s => (
            <tr key={s.id}>
              <td style={styles.td}>{s.reportId}</td><td style={styles.td}>{s.patientName}</td><td style={styles.td}>{s.institution}</td><td style={styles.td}>{s.targetInstitution}</td><td style={styles.td}>{s.sharedDate}</td><td style={styles.td}>{s.sharedBy}</td>
              <td style={styles.td}>{s.consent ? <span style={{ color: COLORS.success }}>✓ {t('regionalReport.consentObtained')}</span> : <span style={{ color: COLORS.warning }}>⏳ {t('regionalReport.consentPending')}</span>}</td>
              <td style={styles.td}>{s.accessCount}</td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: s.status === 'active' ? 'var(--color-success-bg)' : 'var(--bg-card)', color: s.status === 'active' ? COLORS.success : COLORS.textMuted }}>{s.status === 'active' ? t('regionalReport.statusActive') : t('regionalReport.statusRevoked')}</span></td>
              <td style={styles.td}>{s.status === 'active' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.danger, color: 'white' }} onClick={() => handleRevoke(s.id)}><UserX size={14} /> {t('regionalReport.revoke')}</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
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
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.targetInstitution')}</label><select style={{ ...styles.input, width: '100%' }} value={shareForm.targetInstitution} onChange={e => setShareForm({ ...shareForm, targetInstitution: e.target.value })}><option value="">{t('regionalReportList.pleaseSelect')}</option>{institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}</select></div>
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
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>{t('regionalReport.colRemoteSite')}</th><th style={styles.th}>{t('regionalReport.colAssignedExams')}</th><th style={styles.th}>{t('regionalReport.colCompleted')}</th><th style={styles.th}>{t('regionalReport.colAvgTat')}</th><th style={styles.th}>{t('regionalReport.colSlaTarget')}</th><th style={styles.th}>{t('regionalReport.colSlaCompliance')}</th><th style={styles.th}>{t('regionalReport.colStatus')}</th></tr></thead>
          <tbody>{slaData.map((s, idx) => (
            <tr key={idx}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{s.siteName}</div></td>
              <td style={styles.td}>{s.assignedExams}</td>
              <td style={styles.td}>{s.completedExams}</td>
              <td style={styles.td}>{s.avgTAT}</td>
              <td style={styles.td}>{s.slaTarget}</td>
              <td style={styles.td}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ ...styles.progressBar, width: '60px' }}><div style={{ ...styles.progressFill, width: `${s.slaCompliance}%`, backgroundColor: s.slaCompliance >= 90 ? COLORS.success : s.slaCompliance >= 80 ? COLORS.warning : COLORS.danger }} /></div><span style={{ fontSize: '12px', fontWeight: 600 }}>{s.slaCompliance}%</span></div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: s.slaCompliance >= 90 ? 'var(--color-success-bg)' : s.slaCompliance >= 80 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)', color: s.slaCompliance >= 90 ? COLORS.success : s.slaCompliance >= 80 ? COLORS.warning : COLORS.danger }}>{s.slaCompliance >= 90 ? t('regionalReport.slaMet') : s.slaCompliance >= 80 ? t('regionalReport.slaBorderline') : t('regionalReport.slaMissed')}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
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

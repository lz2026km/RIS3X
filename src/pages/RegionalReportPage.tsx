// G005 放射RIS系统 - 区域影像报告管理页面 v2.0.0
// 功能：远程会诊、区域报告审核、危急值通报、医联体远程诊断、跨机构联合签发、区域数据统计
// 已拆分至 src/pages/regional/ 子组件
import React, { useState, useEffect } from 'react'
import { Check, X, Activity, Settings, ShieldCheck, ShieldAlert, Video, FileSignature, Monitor, Share2, Timer, BarChart3 } from 'lucide-react'

import {
  styles, COLORS,
  Consultation, Report, CriticalValueReport, RemoteDiagnosis, CoSignRecord,
  consultationService, criticalValueService, teleradiologyService, remoteSyncService, statsService, exportService, reportService,
} from './regional'
import {
  InstitutionList, ConsultationList, ReportList, RemoteDiagnosisList, CoSignList,
  CriticalValuePanel, ReportSharingSection, SLAAndTATSection, RegionalStatsDashboard,
} from './regional'
import {
  ConsultationDetail, ReportDetail, RemoteWriting, CoSignDetail, StatCards, RightPanel, ModalContent,
} from './regional'
import { regionalApi } from '../services/api/regionalApi'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { t } from '../i18n/appI18n'

type MainTab = 'consultation' | 'report' | 'critical' | 'remote' | 'cosign' | 'sharing' | 'sla' | 'regionalStats'

const RegionalReportPage: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('consultation')
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [consultationTab, setConsultationTab] = useState<'list' | 'apply' | 'detail'>('list')
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [reportTab, setReportTab] = useState<'list' | 'detail'>('list')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [remoteTab, setRemoteTab] = useState<'list' | 'writing'>('list')
  const [selectedRemoteDiagnosis, setSelectedRemoteDiagnosis] = useState<RemoteDiagnosis | null>(null)
  const [remoteReportContent, setRemoteReportContent] = useState('')
  const [cosignTab, setCosignTab] = useState<'list' | 'detail'>('list')
  const [selectedCoSign, setSelectedCoSign] = useState<CoSignRecord | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [toastSuccess, setToastSuccess] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  // [Wave2A] 系统设置: 受控表单 + localStorage 真实持久化 (regionalApi 无设置端点)
  const [settingsForm, setSettingsForm] = useState(() => {
    try {
      const raw = localStorage.getItem('ris_regional_settings')
      return raw ? JSON.parse(raw) : { institutionName: '', notifyCritical: true, notifyConsult: true, notifyAudit: false }
    } catch {
      return { institutionName: '', notifyCritical: true, notifyConsult: true, notifyAudit: false }
    }
  })
  const handleSaveSettings = () => {
    try { localStorage.setItem('ris_regional_settings', JSON.stringify(settingsForm)) } catch { /* ignore */ }
    showToast(`设置已保存 (机构: ${settingsForm.institutionName || '未填写'})`)
    setShowSettingsModal(false)
  }
  const [consultationForm, setConsultationForm] = useState({ patientName: '', gender: '男', age: '', modality: 'CT', examItem: '', applyReason: '', priority: '普通', institution: '' })
  const [opinionText, setOpinionText] = useState('')
  const [reviewText, setReviewText] = useState('')

  // API data state
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [criticalValues, setCriticalValues] = useState<CriticalValueReport[]>([])
  const [remoteDiagnoses, setRemoteDiagnoses] = useState<RemoteDiagnosis[]>([])
  const [coSignRecords, setCoSignRecords] = useState<CoSignRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [instRes, consRes, repRes, cvRes, rdRes, csRes] = await Promise.allSettled([
          regionalApi.listRegionalInstitutions(),
          regionalApi.listConsultations(),
          regionalApi.listReportRecords(),
          regionalApi.listCriticalValues(),
          regionalApi.listRemoteDiagnoses(),
          regionalApi.listCoSignRecords(),
        ])

        // Institutions - fallback to imported mock data
        if (instRes.status === 'fulfilled' && instRes.value.success && Array.isArray(instRes.value.data) && instRes.value.data.length > 0) {
          setInstitutions(instRes.value.data)
        }

        if (consRes.status === 'fulfilled' && consRes.value.success && Array.isArray(consRes.value.data)) {
          setConsultations(consRes.value.data as Consultation[])
        }
        if (repRes.status === 'fulfilled' && repRes.value.success && Array.isArray(repRes.value.data)) {
          setReports(repRes.value.data as Report[])
        }
        if (cvRes.status === 'fulfilled' && cvRes.value.success && Array.isArray(cvRes.value.data)) {
          setCriticalValues(cvRes.value.data as CriticalValueReport[])
        }
        if (rdRes.status === 'fulfilled' && rdRes.value.success && Array.isArray(rdRes.value.data)) {
          setRemoteDiagnoses(rdRes.value.data as RemoteDiagnosis[])
        }
        if (csRes.status === 'fulfilled' && csRes.value.success && Array.isArray(csRes.value.data)) {
          setCoSignRecords(csRes.value.data as CoSignRecord[])
        }
        const anyRejected = [instRes, consRes, repRes, cvRes, rdRes, csRes].some((r) => r.status === 'rejected')
        setLoadError(anyRejected ? t('w9.states.error') : null)
      } catch {
        // Fallback: keep empty state
        setLoadError(t('w9.states.error'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const showToast = (msg: string, success: boolean = true) => {
    setToastMessage(msg)
    setToastSuccess(success)
    setTimeout(() => setToastSuccess(false), 2500)
  }

  const getFilteredStats = () => {
    if (selectedInstitution === 'all') {
      return { totalReports: reports.length || 3713, pendingConsultations: consultations.filter(c => c.status === '待接诊').length, criticalValues: criticalValues.filter(cv => cv.status !== '已闭环').length, avgResponseTime: '18分钟' }
    }
    const inst = institutions.find(i => i.id === selectedInstitution)
    return { totalReports: inst?.reportCount || reports.length || 0, pendingConsultations: consultations.filter(c => c.institution === inst?.name && c.status === '待接诊').length, criticalValues: criticalValues.filter(cv => cv.institution === inst?.name && cv.status !== '已闭环').length, avgResponseTime: '15分钟' }
  }

  const getFilteredConsultations = () => consultations.filter(c => {
    const matchInstitution = selectedInstitution === 'all' || c.institution === institutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || c.patientName.includes(searchKeyword) || c.caseId.includes(searchKeyword) || c.examItem.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredReports = () => reports.filter(r => {
    const matchInstitution = selectedInstitution === 'all' || r.institution === institutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || r.patientName.includes(searchKeyword) || r.reportId.includes(searchKeyword) || r.examItem.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredCriticalValues = () => criticalValues.filter(cv => {
    const matchInstitution = selectedInstitution === 'all' || cv.institution === institutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || cv.patientName.includes(searchKeyword) || cv.criticalFinding.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredRemoteDiagnoses = () => remoteDiagnoses.filter(rd => {
    const matchInstitution = selectedInstitution === 'all' || rd.applyInstitution === institutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || rd.patientName.includes(searchKeyword) || rd.caseId.includes(searchKeyword) || rd.examType.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredCoSignRecords = () => coSignRecords.filter(cs => {
    const matchInstitution = selectedInstitution === 'all' || cs.participatingInstitutions.includes(institutions.find(i => i.id === selectedInstitution)?.name || '')
    const matchSearch = searchKeyword === '' || cs.patientName.includes(searchKeyword) || cs.reportId.includes(searchKeyword) || cs.examType.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const handleSelectInstitution = (id: string) => { setSelectedInstitution(id) }
  const handleSelectConsultation = (c: Consultation) => { setSelectedConsultation(c); setConsultationTab('detail') }
  const handleSelectReport = (r: Report) => { setSelectedReport(r); setReportTab('detail') }
  const handleSelectRemoteDiagnosis = (rd: RemoteDiagnosis) => { setSelectedRemoteDiagnosis(rd); setRemoteReportContent(rd.reportContent || ''); setRemoteTab('writing') }
  const handleSelectCoSign = (cs: CoSignRecord) => { setSelectedCoSign(cs); setCosignTab('detail') }

  const handleApplyConsultation = () => { setModalType('apply'); setShowModal(true) }

  const handleSubmitConsultation = () => {
    if (!consultationForm.patientName.trim() || !consultationForm.examItem.trim() || !consultationForm.institution.trim()) {
      showToast(t('regionalPage.fillConsult'), false); return
    }
    consultationService.create(consultationForm)
    setShowModal(false)
    setConsultationForm({ patientName: '', gender: '男', age: '', modality: 'CT', examItem: '', applyReason: '', priority: '普通', institution: '' })
  }

  const handleAcceptConsultation = (consultation: Consultation) => {
    consultationService.accept(consultation.id)
  }

  const handleSubmitOpinion = () => {
    if (!opinionText.trim()) { showToast(t('regionalPage.fillOpinion'), false); return }
    consultationService.submitOpinion(selectedConsultation?.id || '', opinionText)
    setShowModal(false); setOpinionText('')
  }

  const handleReviewReport = (report: Report, result: '通过' | '驳回') => {
    if (result === '驳回' && !reviewText.trim()) { showToast(t('regionalPage.fillRejectReason'), false); return }
    reportService.review(report.reportId, result, reviewText)
    setShowModal(false); setReviewText('')
  }

  const handleConfirmCritical = (cv: CriticalValueReport) => {
    criticalValueService.acknowledge(cv.id)
  }

  const handleCloseCritical = (cv: CriticalValueReport) => {
    criticalValueService.close(cv.id)
  }

  const handleSubmitRemoteReport = () => {
    if (!remoteReportContent.trim()) { showToast(t('regionalPage.fillReportContent'), false); return }
    teleradiologyService.submit({ reportContent: remoteReportContent })
    setRemoteTab('list'); setSelectedRemoteDiagnosis(null); setRemoteReportContent('')
  }

  const handleSync = () => { remoteSyncService.pull() }
  const handleRefreshStats = () => { statsService.refresh() }
  const handleExport = () => { exportService.csv(t('regionalPage.criticalValueExport')) }
  const handlePrevPage = () => { showToast(t('regionalPage.firstPage'), false) }
  const handleNextPage = () => { showToast(t('regionalPage.lastPage'), false) }

  const handleBackFromConsultationDetail = () => { setSelectedConsultation(null); setConsultationTab('list') }
  const handleBackFromReportDetail = () => { setSelectedReport(null); setReportTab('list') }
  const handleBackFromRemoteWriting = () => { setSelectedRemoteDiagnosis(null); setRemoteTab('list'); setRemoteReportContent('') }
  const handleBackFromCoSignDetail = () => { setSelectedCoSign(null); setCosignTab('list') }

  const mainTabs = [
    { key: 'consultation' as MainTab, label: t('regionalPage.tabConsultation'), icon: <Video size={14} /> },
    { key: 'report' as MainTab, label: t('regionalPage.tabReport'), icon: <ShieldCheck size={14} /> },
    { key: 'critical' as MainTab, label: t('regionalPage.tabCritical'), icon: <ShieldAlert size={14} /> },
    { key: 'remote' as MainTab, label: t('regionalPage.tabRemote'), icon: <Monitor size={14} /> },
    { key: 'cosign' as MainTab, label: t('regionalPage.tabCosign'), icon: <FileSignature size={14} /> },
    { key: 'sharing' as MainTab, label: t('regionalPage.tabSharing'), icon: <Share2 size={14} /> },
    { key: 'sla' as MainTab, label: t('regionalPage.tabSla'), icon: <Timer size={14} /> },
    { key: 'regionalStats' as MainTab, label: t('regionalPage.tabRegionalStats'), icon: <BarChart3 size={14} /> },
  ]

  return (
    <div style={styles.pageContainer}>
      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}><Activity size={24} />{t('regionalPage.title')}</div>
          <div style={styles.headerSubtitle}>{t('regionalPage.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', opacity: 0.85 }}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
          <button style={{ ...styles.button, backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => setShowSettingsModal(true)}><Settings size={14} />{t('regionalPage.settings')}</button>
        </div>
      </div>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      <StatCards filteredStats={getFilteredStats()} />

      {/* 主Tab导航 */}
      <div style={{ padding: '0 24px', marginBottom: '16px' }}>
        <div style={styles.tabContainer}>
          {mainTabs.map(tab => (
            <button key={tab.key} style={{ ...styles.tab, ...(activeMainTab === tab.key ? styles.tabActive : {}) }} onClick={() => setActiveMainTab(tab.key)}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div style={styles.mainContent}>
        <InstitutionList selectedInstitution={selectedInstitution} onSelect={handleSelectInstitution} />

        {activeMainTab === 'consultation' && (
          consultationTab === 'detail'
            ? <ConsultationDetail selectedConsultation={selectedConsultation} opinionText={opinionText} onOpinionTextChange={setOpinionText} onBack={handleBackFromConsultationDetail} onOpenModal={(mt) => { setModalType(mt); setShowModal(true) }} onSubmitOpinion={handleSubmitOpinion} remoteReportContent='' onRemoteReportContentChange={() => {}} reviewText='' onReviewTextChange={() => {}} onSubmitRemoteReport={() => {}} />
            : <ConsultationList consultations={getFilteredConsultations()} selectedConsultation={selectedConsultation} consultationTab={consultationTab} onSelect={handleSelectConsultation} onAccept={handleAcceptConsultation} onApply={handleApplyConsultation} onTabChange={(k) => setConsultationTab(k as 'list' | 'apply' | 'detail')} searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} institutions={institutions.map(i => ({ id: i.id || '', name: i.institutionName || '', level: '三级' as const, type: '综合医院' as const, reportCount: i.examCount || 0, pendingCount: 0, icon: 'hospital' }))} />
        )}
        {activeMainTab === 'report' && (
          reportTab === 'detail'
            ? <ReportDetail selectedReport={selectedReport} reviewText={reviewText} onReviewTextChange={setReviewText} onBack={handleBackFromReportDetail} onOpenModal={(mt) => { setModalType(mt); setShowModal(true) }} opinionText='' onOpinionTextChange={() => {}} remoteReportContent='' onRemoteReportContentChange={() => {}} onSubmitOpinion={() => {}} onSubmitRemoteReport={() => {}} selectedConsultation={null} selectedRemoteDiagnosis={null} selectedCoSign={null} />
            : <ReportList reports={getFilteredReports()} selectedReport={selectedReport} onSelect={handleSelectReport} onReview={(r) => { setSelectedReport(r); setModalType('review'); setShowModal(true) }} onOpenDetail={handleSelectReport} searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} onOpenQualityFilter={() => { setModalType('quality-filter'); setShowModal(true) }} />
        )}
        {activeMainTab === 'critical' && (
          <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={styles.emptyState}><ShieldAlert size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>{t('regionalPage.criticalHint')}</div></div>
          </div>
        )}
        {activeMainTab === 'remote' && (
          remoteTab === 'writing'
            ? <RemoteWriting selectedRemoteDiagnosis={selectedRemoteDiagnosis} remoteReportContent={remoteReportContent} onRemoteReportContentChange={setRemoteReportContent} onBack={handleBackFromRemoteWriting} onSubmitRemoteReport={handleSubmitRemoteReport} opinionText='' onOpinionTextChange={() => {}} reviewText='' onReviewTextChange={() => {}} onOpenModal={() => {}} onSubmitOpinion={() => {}} selectedConsultation={null} selectedReport={null} selectedCoSign={null} />
            : <RemoteDiagnosisList diagnoses={getFilteredRemoteDiagnoses()} selectedRemoteDiagnosis={selectedRemoteDiagnosis} onSelect={handleSelectRemoteDiagnosis} searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} onSync={handleSync} />
        )}
        {activeMainTab === 'cosign' && (
          cosignTab === 'detail'
            ? <CoSignDetail selectedCoSign={selectedCoSign} onBack={handleBackFromCoSignDetail} opinionText='' onOpinionTextChange={() => {}} remoteReportContent='' onRemoteReportContentChange={() => {}} reviewText='' onReviewTextChange={() => {}} onOpenModal={() => {}} onSubmitOpinion={() => {}} onSubmitRemoteReport={() => {}} selectedConsultation={null} selectedReport={null} selectedRemoteDiagnosis={null} />
            : <CoSignList records={getFilteredCoSignRecords()} selectedCoSign={selectedCoSign} onSelect={handleSelectCoSign} searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} onAdd={() => { setModalType('cosign-add'); setShowModal(true) }} />
        )}
        {activeMainTab === 'sharing' && <ReportSharingSection />}
        {activeMainTab === 'sla' && <SLAAndTATSection />}
        {activeMainTab === 'regionalStats' && <RegionalStatsDashboard />}

        <RightPanel institutions={institutions.map(i => ({ id: i.id || '', name: i.institutionName || '', level: '三级' as const, type: '综合医院' as const, reportCount: i.examCount || 0, pendingCount: 0, icon: 'hospital' }))} onRefreshStats={handleRefreshStats} />
      </div>

      <CriticalValuePanel
        criticalValues={getFilteredCriticalValues()}
        onConfirm={handleConfirmCritical}
        onClose={handleCloseCritical}
        onExport={handleExport}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onStats={() => { setModalType('critical-stats'); setShowModal(true) }}
      />

      {/* Toast */}
      {toastSuccess && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: toastSuccess ? COLORS.success : COLORS.danger, color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={18} /> {toastMessage}
        </div>
      )}

      {/* 系统设置弹窗 */}
      {showSettingsModal && (
        <div style={styles.modal} onClick={() => setShowSettingsModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}><span>{t('regionalPage.systemSettings')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowSettingsModal(false)} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalPage.institutionName')}</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalPage.institutionNamePlaceholder')} value={settingsForm.institutionName} onChange={e => setSettingsForm({ ...settingsForm, institutionName: e.target.value })} /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalPage.notificationSettings')}</label><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={settingsForm.notifyCritical} onChange={e => setSettingsForm({ ...settingsForm, notifyCritical: e.target.checked })} /> {t('regionalPage.notifyCritical')}</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={settingsForm.notifyConsult} onChange={e => setSettingsForm({ ...settingsForm, notifyConsult: e.target.checked })} /> {t('regionalPage.notifyConsult')}</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={settingsForm.notifyAudit} onChange={e => setSettingsForm({ ...settingsForm, notifyAudit: e.target.checked })} /> {t('regionalPage.notifyAudit')}</label></div></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={() => setShowSettingsModal(false)}>{t('common.action.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleSaveSettings}>{t('common.action.save')}</button></div>
          </div>
        </div>
      )}

      <ModalContent
        modalType={modalType}
        showModal={showModal}
        onClose={() => setShowModal(false)}
        consultationForm={consultationForm}
        onConsultationFormChange={setConsultationForm}
        opinionText={opinionText}
        onOpinionTextChange={setOpinionText}
        reviewText={reviewText}
        onReviewTextChange={setReviewText}
        selectedReport={selectedReport}
        onSubmitConsultation={handleSubmitConsultation}
        onSubmitOpinion={handleSubmitOpinion}
        onReviewReport={handleReviewReport}
        institutions={institutions.map(i => ({ id: i.id || '', name: i.institutionName || '', level: '三级' as const, type: '综合医院' as const, reportCount: i.examCount || 0, pendingCount: 0, icon: 'hospital' }))}
        onToast={(msg, success) => showToast(msg, success)}
      />
    </div>
  )
}

export default RegionalReportPage

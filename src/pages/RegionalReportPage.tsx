// G005 放射RIS系统 - 区域影像报告管理页面 v2.0.0
// 功能：远程会诊、区域报告审核、危急值通报、医联体远程诊断、跨机构联合签发、区域数据统计
// 已拆分至 src/pages/regional/ 子组件
import React, { useState } from 'react'
import { Check, X, Activity, Settings, ShieldCheck, ShieldAlert, Video, FileSignature, Monitor, Share2, Timer, BarChart3 } from 'lucide-react'

import {
  styles, COLORS, mockInstitutions, mockConsultations, mockReports, mockCriticalValues,
  mockRemoteDiagnoses, mockCoSignRecords, Consultation, Report, CriticalValueReport, RemoteDiagnosis, CoSignRecord,
  consultationService, criticalValueService, teleradiologyService, remoteSyncService, statsService, exportService, reportService,
} from './regional'
import {
  InstitutionList, ConsultationList, ReportList, RemoteDiagnosisList, CoSignList,
  CriticalValuePanel, ReportSharingSection, SLAAndTATSection, RegionalStatsDashboard,
} from './regional'
import {
  ConsultationDetail, ReportDetail, RemoteWriting, CoSignDetail, StatCards, RightPanel, ModalContent,
} from './regional'

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
  const [consultationForm, setConsultationForm] = useState({ patientName: '', gender: '男', age: '', modality: 'CT', examItem: '', applyReason: '', priority: '普通', institution: '' })
  const [opinionText, setOpinionText] = useState('')
  const [reviewText, setReviewText] = useState('')

  const showToast = (msg: string, success: boolean = true) => {
    setToastMessage(msg)
    setToastSuccess(success)
    setTimeout(() => setToastSuccess(false), 2500)
  }

  const getFilteredStats = () => {
    if (selectedInstitution === 'all') {
      return { totalReports: 3713, pendingConsultations: mockConsultations.filter(c => c.status === '待接诊').length, criticalValues: mockCriticalValues.filter(cv => cv.status !== '已闭环').length, avgResponseTime: '18分钟' }
    }
    const inst = mockInstitutions.find(i => i.id === selectedInstitution)
    return { totalReports: inst?.reportCount || 0, pendingConsultations: mockConsultations.filter(c => c.institution === inst?.name && c.status === '待接诊').length, criticalValues: mockCriticalValues.filter(cv => cv.institution === inst?.name && cv.status !== '已闭环').length, avgResponseTime: '15分钟' }
  }

  const getFilteredConsultations = () => mockConsultations.filter(c => {
    const matchInstitution = selectedInstitution === 'all' || c.institution === mockInstitutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || c.patientName.includes(searchKeyword) || c.caseId.includes(searchKeyword) || c.examItem.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredReports = () => mockReports.filter(r => {
    const matchInstitution = selectedInstitution === 'all' || r.institution === mockInstitutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || r.patientName.includes(searchKeyword) || r.reportId.includes(searchKeyword) || r.examItem.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredCriticalValues = () => mockCriticalValues.filter(cv => {
    const matchInstitution = selectedInstitution === 'all' || cv.institution === mockInstitutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || cv.patientName.includes(searchKeyword) || cv.criticalFinding.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredRemoteDiagnoses = () => mockRemoteDiagnoses.filter(rd => {
    const matchInstitution = selectedInstitution === 'all' || rd.applyInstitution === mockInstitutions.find(i => i.id === selectedInstitution)?.name
    const matchSearch = searchKeyword === '' || rd.patientName.includes(searchKeyword) || rd.caseId.includes(searchKeyword) || rd.examType.includes(searchKeyword)
    return matchInstitution && matchSearch
  })

  const getFilteredCoSignRecords = () => mockCoSignRecords.filter(cs => {
    const matchInstitution = selectedInstitution === 'all' || cs.participatingInstitutions.includes(mockInstitutions.find(i => i.id === selectedInstitution)?.name || '')
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
      showToast('请填写完整会诊申请信息', false); return
    }
    consultationService.create(consultationForm)
    setShowModal(false)
    setConsultationForm({ patientName: '', gender: '男', age: '', modality: 'CT', examItem: '', applyReason: '', priority: '普通', institution: '' })
  }

  const handleAcceptConsultation = (consultation: Consultation) => {
    consultationService.accept(consultation.id)
  }

  const handleSubmitOpinion = () => {
    if (!opinionText.trim()) { showToast('请填写会诊意见', false); return }
    consultationService.submitOpinion(selectedConsultation?.id || '', opinionText)
    setShowModal(false); setOpinionText('')
  }

  const handleReviewReport = (report: Report, result: '通过' | '驳回') => {
    if (result === '驳回' && !reviewText.trim()) { showToast('请填写驳回原因', false); return }
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
    if (!remoteReportContent.trim()) { showToast('请填写报告内容', false); return }
    teleradiologyService.submit({ reportContent: remoteReportContent })
    setRemoteTab('list'); setSelectedRemoteDiagnosis(null); setRemoteReportContent('')
  }

  const handleSync = () => { remoteSyncService.pull() }
  const handleRefreshStats = () => { statsService.refresh() }
  const handleExport = () => { exportService.csv('危急值') }
  const handlePrevPage = () => { showToast('已是第一页', false) }
  const handleNextPage = () => { showToast('已是最后一页', false) }

  const handleBackFromConsultationDetail = () => { setSelectedConsultation(null); setConsultationTab('list') }
  const handleBackFromReportDetail = () => { setSelectedReport(null); setReportTab('list') }
  const handleBackFromRemoteWriting = () => { setSelectedRemoteDiagnosis(null); setRemoteTab('list'); setRemoteReportContent('') }
  const handleBackFromCoSignDetail = () => { setSelectedCoSign(null); setCosignTab('list') }

  const mainTabs = [
    { key: 'consultation' as MainTab, label: '远程会诊', icon: <Video size={14} /> },
    { key: 'report' as MainTab, label: '报告审核', icon: <ShieldCheck size={14} /> },
    { key: 'critical' as MainTab, label: '危急值', icon: <ShieldAlert size={14} /> },
    { key: 'remote' as MainTab, label: '远程诊断', icon: <Monitor size={14} /> },
    { key: 'cosign' as MainTab, label: '联合签发', icon: <FileSignature size={14} /> },
    { key: 'sharing' as MainTab, label: '报告分享', icon: <Share2 size={14} /> },
    { key: 'sla' as MainTab, label: 'SLA监控', icon: <Timer size={14} /> },
    { key: 'regionalStats' as MainTab, label: '区域统计', icon: <BarChart3 size={14} /> },
  ]

  return (
    <div style={styles.pageContainer}>
      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}><Activity size={24} />区域影像报告管理</div>
          <div style={styles.headerSubtitle}>远程会诊 | 报告审核 | 危急值通报 | 医联体远程诊断 | 跨机构联合签发</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', opacity: 0.85 }}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
          <button style={{ ...styles.button, backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => setShowSettingsModal(true)}><Settings size={14} />设置</button>
        </div>
      </div>

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
            ? <ConsultationDetail selectedConsultation={selectedConsultation} opinionText={opinionText} onOpinionTextChange={setOpinionText} onBack={handleBackFromConsultationDetail} onOpenModal={(t) => { setModalType(t); setShowModal(true) }} onSubmitOpinion={handleSubmitOpinion} remoteReportContent='' onRemoteReportContentChange={() => {}} reviewText='' onReviewTextChange={() => {}} onSubmitRemoteReport={() => {}} />
            : <ConsultationList consultations={getFilteredConsultations()} selectedConsultation={selectedConsultation} consultationTab={consultationTab} onSelect={handleSelectConsultation} onAccept={handleAcceptConsultation} onApply={handleApplyConsultation} onTabChange={(k) => setConsultationTab(k as 'list' | 'apply' | 'detail')} searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} />
        )}
        {activeMainTab === 'report' && (
          reportTab === 'detail'
            ? <ReportDetail selectedReport={selectedReport} reviewText={reviewText} onReviewTextChange={setReviewText} onBack={handleBackFromReportDetail} onOpenModal={(t) => { setModalType(t); setShowModal(true) }} opinionText='' onOpinionTextChange={() => {}} remoteReportContent='' onRemoteReportContentChange={() => {}} onSubmitOpinion={() => {}} onSubmitRemoteReport={() => {}} selectedConsultation={null} selectedRemoteDiagnosis={null} selectedCoSign={null} />
            : <ReportList reports={getFilteredReports()} selectedReport={selectedReport} onSelect={handleSelectReport} onReview={(r) => { setSelectedReport(r); setModalType('review'); setShowModal(true) }} onOpenDetail={handleSelectReport} searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} onOpenQualityFilter={() => { setModalType('quality-filter'); setShowModal(true) }} />
        )}
        {activeMainTab === 'critical' && (
          <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={styles.emptyState}><ShieldAlert size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>请在下方危急值通报记录区域进行操作</div></div>
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

        <RightPanel mockInstitutions={mockInstitutions} onRefreshStats={handleRefreshStats} />
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
            <div style={styles.modalHeader}><span>系统设置</span><X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowSettingsModal(false)} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>机构名称</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder="请输入机构名称" /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>通知设置</label><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" defaultChecked /> 接收危急值提醒</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" defaultChecked /> 接收会诊通知</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> 接收报告审核通知</label></div></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={() => setShowSettingsModal(false)}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { setShowSettingsModal(false); showToast('设置已保存') }}>保存</button></div>
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
        mockInstitutions={mockInstitutions}
        onToast={(msg, success) => showToast(msg, success)}
      />
    </div>
  )
}

export default RegionalReportPage

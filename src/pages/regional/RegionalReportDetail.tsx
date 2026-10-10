
import { useState } from 'react'
import React from 'react'
import { Video, FileText, Clock, CheckCircle, ChevronRight, ShieldCheck, BadgeCheck, XCircle, Monitor, Lock, FileSignature, ArrowRight, X, RefreshCw, ShieldAlert, ArrowUp, ArrowDown, ZoomIn, Ruler, SlidersHorizontal, Send } from 'lucide-react'
import { Select } from 'antd'
import type { TableColumnsType } from 'antd'
import { styles, COLORS, Consultation, Report, RemoteDiagnosis, CoSignRecord, Institution, getStatusColor } from './RegionalReportServiceWire'
import type { ReportVersion } from './RegionalReportServiceWire'
import { DataTable } from '../../components/common/DataTable'
import { ActionButton } from '../../components/common/ActionButton'
import { t } from '../../i18n/appI18n'

interface DetailProps {
  selectedConsultation: Consultation | null
  selectedReport: Report | null
  selectedRemoteDiagnosis: RemoteDiagnosis | null
  selectedCoSign: CoSignRecord | null
  opinionText: string
  onOpinionTextChange: (v: string) => void
  remoteReportContent: string
  onRemoteReportContentChange: (v: string) => void
  reviewText: string
  onReviewTextChange: (v: string) => void
  onBack: () => void
  onOpenModal: (type: string) => void
  onSubmitOpinion: () => void
  onSubmitRemoteReport: () => void
}

export const ConsultationDetail: React.FC<DetailProps> = ({
  selectedConsultation, opinionText, onOpinionTextChange, onBack, onOpenModal
}) => {
  if (!selectedConsultation) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><Video size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>{t('regionalReport.selectConsultation')}</div></div>
      </div>
    )
  }
  const c = selectedConsultation
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Video size={18} style={{ color: COLORS.primary }} /><span>{t('regionalReport.consultationDetail')}</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> {t('regionalReport.back')}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.basicInfo')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.caseId')}</div><div style={{ fontWeight: 500 }}>{c.caseId}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.status')}</div><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(c.status)}20`, color: getStatusColor(c.status) }}>{c.status}</span></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.patientName')}</div><div style={{ fontWeight: 500 }}>{c.patientName}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.patientInfo')}</div><div>{c.gender} / {c.age}{t('regionalReport.yearsOld')}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.modality')}</div><div>{c.modality}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.examItem')}</div><div>{c.examItem}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.applyInstitution')}</div><div>{c.institution}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.applyDoctor')}</div><div>{c.applyDoctor}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.applyTime')}</div><div>{c.applyTime}</div></div>
              {c.acceptDoctor && <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.acceptDoctor')}</div><div>{c.acceptDoctor}</div></div>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.applyReason')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>{c.applyReason}</div>
        </div>
        {c.status === '已完成' && c.consultationOpinion && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.consultationOpinion')}</h4>
            <div style={{ backgroundColor: 'var(--color-success-bg)', borderRadius: '8px', padding: '16px', border: `1px solid var(--color-success-border)` }}>{c.consultationOpinion}</div>
          </div>
        )}
        {c.status === '会诊中' && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.fillConsultationOpinion')}</h4>
            <textarea style={{ ...styles.textarea, width: '100%', minHeight: '150px' }} placeholder={t('regionalReport.consultationOpinionPlaceholder')} value={opinionText} onChange={e => onOpinionTextChange(e.target.value)} />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton action="submit" onClick={() => onOpenModal('opinion')}>{t('regionalReport.submitOpinion')}</ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const ReportDetail: React.FC<DetailProps> = ({
  selectedReport, onBack, onOpenModal
}) => {
  if (!selectedReport) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>{t('regionalReport.selectReport')}</div></div>
      </div>
    )
  }
  const r = selectedReport
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} style={{ color: COLORS.primary }} /><span>{t('regionalReport.reportDetail')}</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> {t('regionalReport.back')}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.reportInfo')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.reportNo')}</div><div style={{ fontWeight: 500 }}>{r.reportId}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.status')}</div><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(r.status)}20`, color: getStatusColor(r.status) }}>{r.status}</span></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.patientName')}</div><div style={{ fontWeight: 500 }}>{r.patientName}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.patientInfo')}</div><div>{r.gender} / {r.age}{t('regionalReport.yearsOld')}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.modality')}</div><div>{r.modality}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.examItem')}</div><div>{r.examItem}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.reportInstitution')}</div><div>{r.institution}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.reportDoctor')}</div><div>{r.reportDoctor}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.reportTime')}</div><div>{r.reportTime}</div></div>
              {r.reviewDoctor && <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.reviewDoctor')}</div><div>{r.reviewDoctor}</div></div>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.qualityScore')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
            {r.qualityScore > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '30px', fontWeight: 700, color: r.qualityScore >= 90 ? COLORS.success : r.qualityScore >= 70 ? COLORS.warning : COLORS.danger }}>{r.qualityScore}</div>
                  <div style={{ flex: 1 }}><div style={{ ...styles.progressBar, height: '12px' }}><div style={{ ...styles.progressFill, width: `${r.qualityScore}%`, backgroundColor: r.qualityScore >= 90 ? COLORS.success : r.qualityScore >= 70 ? COLORS.warning : COLORS.danger }} /></div><div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>{t('regionalReport.qualityDimensions')}</div></div>
                </div>
                {r.qualityIssues.length > 0 && <div style={{ marginTop: '12px' }}><div style={{ fontSize: '12px', color: COLORS.danger, marginBottom: '6px' }}>{t('regionalReport.issuesFound')}：</div>{r.qualityIssues.map((issue, idx) => <div key={idx} style={{ fontSize: '12px', color: COLORS.danger, marginLeft: '12px' }}>• {issue}</div>)}</div>}
              </>
            ) : <div style={{ color: COLORS.textMuted }}>{t('regionalReport.noQualityScore')}</div>}
          </div>
        </div>
        {r.reviewOpinion && <div style={{ marginBottom: '24px' }}><h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.reviewOpinion')}</h4><div style={{ backgroundColor: 'var(--color-warning-bg)', borderRadius: '8px', padding: '16px', border: `1px solid var(--color-warning-border)` }}>{r.reviewOpinion}</div></div>}
        {r.status === '待审核' && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.reviewActions')}</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => onOpenModal('review-pass')}><CheckCircle size={14} /> {t('regionalReport.pass')}</button>
              <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => onOpenModal('review-reject')}><XCircle size={14} /> {t('regionalReport.reject')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const RemoteWriting: React.FC<DetailProps> = ({
  selectedRemoteDiagnosis, remoteReportContent, onRemoteReportContentChange, onBack, onSubmitRemoteReport
}) => {
  const [zoom, setZoom] = useState(100)
  const [ww, setWw] = useState(400)
  const [wc, setWc] = useState(40)
  const [measuring, setMeasuring] = useState(false)
  const [measureResult, setMeasureResult] = useState<string | null>(null)
  if (!selectedRemoteDiagnosis) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><Monitor size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>{t('regionalReport.selectRemoteDiagnosis')}</div></div>
      </div>
    )
  }
  const rd = selectedRemoteDiagnosis
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Monitor size={18} style={{ color: COLORS.primary }} /><span>{t('regionalReport.remoteWriting')} - {rd.caseId}</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> {t('regionalReport.back')}</button>
      </div>
      {rd.isOtherTyping && <div style={{ padding: '8px 16px', backgroundColor: `${COLORS.inProgress}15`, borderBottom: `1px solid ${COLORS.inProgress}30`, display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.inProgress }} /><span style={{ fontSize: '12px', color: COLORS.inProgress }}>{rd.otherTypingName} {t('regionalReport.typingReport')}</span></div>}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, backgroundColor: '#1a1a2e', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontSize: '12px' }}>{t('regionalReport.dicomViewerSim')}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: zoom !== 100 ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)', color: 'white', border: zoom !== 100 ? '1px solid var(--color-primary-500)' : 'none' }}
                onClick={() => setZoom(z => Math.min(300, z + 25))}
                title={t('regionalReport.zoomIn')}
              >
                <ZoomIn size={12} /> {t('regionalReport.zoom')} {zoom}%
              </button>
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                onClick={() => { setWw(Math.min(2000, ww + 100)); setWc(wc - 5) }}
                title={t('regionalReport.windowPreset')}
              >
                <SlidersHorizontal size={12} /> {t('regionalReport.windowWidth')} {ww} L:{wc}
              </button>
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: measuring ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)', color: 'white', border: measuring ? '1px solid var(--color-primary-500)' : 'none' }}
                onClick={() => { setMeasuring(m => !m); setMeasureResult(null) }}
                title={t('regionalReport.measure')}
              >
                <Ruler size={12} /> {t('regionalReport.measure')}
              </button>
              {measuring && (
                <button
                  style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(34,197,94,0.35)', color: 'white' }}
                  onClick={() => setMeasureResult(`${(Math.random() * 2 + 1).toFixed(1)} mm`)}
                >
                  {t('regionalReport.measurePoints')}
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: 200, height: 200, borderRadius: '8px', background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom / 100})`, transition: 'transform 0.15s', border: measuring ? '2px dashed var(--color-primary-500)' : 'none' }}>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}><Monitor size={48} style={{ marginBottom: '8px', opacity: 0.5 }} /><div style={{ fontSize: '12px' }}>{t('regionalReport.ctChest')}</div><div style={{ fontSize: '10px', marginTop: '4px' }}>{t('regionalReport.imageLoadArea')}</div></div>
            </div>
            {measuring && <div style={{ position: 'absolute', width: 120, height: 60, border: '1px solid rgba(59,130,246,0.9)', borderRadius: 2 }} />}
            {measureResult && <div style={{ position: 'absolute', top: '36px', left: '20px', background: 'rgba(16,185,129,0.9)', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: 4 }}>{t('regionalReport.distance')}: {measureResult}</div>}
            <div style={{ position: 'absolute', top: '20px', left: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>AXIAL | 5.0mm | W:{ww} L:{wc}</div>
            <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>1/120</div>
          </div>
        </div>
        <div style={{ width: '400px', borderLeft: '1px solid var(--border-color, #e5e7eb)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('regionalReport.patientInfo')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
              <div>{t('regionalReport.nameLabel')}{rd.patientName}</div><div>{t('regionalReport.genderLabel')}{rd.gender}</div><div>{t('regionalReport.ageLabel')}{rd.age}{t('regionalReport.yearsOld')}</div><div>{t('regionalReport.examLabel')}{rd.examType}</div>
              <div style={{ gridColumn: '1/-1' }}>{t('regionalReport.applyInstitutionLabel')}{rd.applyInstitution}</div>
              <div style={{ gridColumn: '1/-1' }}>{t('regionalReport.remoteExpert')}{rd.remoteExpert}（{rd.expertInstitution}）</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('regionalReport.reportContent')}</div>
            <textarea style={{ ...styles.textarea, width: '100%', minHeight: '200px', fontSize: '12px', lineHeight: '1.6' }} placeholder={t('regionalReport.reportPlaceholder')} value={remoteReportContent} onChange={e => onRemoteReportContentChange(e.target.value)} />
          </div>
          <div style={{ padding: '12px', borderTop: '1px solid var(--border-color, #e5e7eb)', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('regionalReport.digitalSignature')}</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color, #e5e7eb)' }}><div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('regionalReport.applyDoctorSignature')}</div><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} style={{ color: COLORS.success }} /><span style={{ fontSize: '11px' }}>{t('regionalReport.pendingSignature')}</span></div></div>
              <div style={{ flex: 1, padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color, #e5e7eb)' }}><div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('regionalReport.reviewExpertSignature')}</div><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} style={{ color: COLORS.pending }} /><span style={{ fontSize: '11px' }}>{t('regionalReport.pendingSignature')}</span></div></div>
            </div>
            <ActionButton action="submit" block onClick={onSubmitRemoteReport}>{t('regionalReport.submitReport')}</ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export const CoSignDetail: React.FC<DetailProps> = ({ selectedCoSign, onBack }) => {
  if (!selectedCoSign) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><FileSignature size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>{t('regionalReport.selectCoSign')}</div></div>
      </div>
    )
  }
  const cs = selectedCoSign
  const versionColumns: TableColumnsType<ReportVersion> = [
    {
      title: t('regionalReport.versionNo'), dataIndex: 'version', key: 'version', width: 120,
      render: (v: string, _row, idx) => (
        <span style={{ ...styles.badge, backgroundColor: idx === cs.versions.length - 1 ? COLORS.primary : '#e5e7eb', color: idx === cs.versions.length - 1 ? 'white' : COLORS.textMuted }}>{v}</span>
      ),
    },
    { title: t('regionalReport.modifyTime'), dataIndex: 'modifyTime', key: 'modifyTime' },
    { title: t('regionalReport.modifyInstitution'), dataIndex: 'modifyInstitution', key: 'modifyInstitution' },
    { title: t('regionalReport.modifyReason'), dataIndex: 'modifyReason', key: 'modifyReason' },
    { title: t('regionalReport.modifier'), dataIndex: 'modifier', key: 'modifier' },
  ]
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileSignature size={18} style={{ color: COLORS.primary }} /><span>{t('regionalReport.coSignDetail')} - {cs.reportId}</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> {t('regionalReport.back')}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.basicInfo')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.reportNumber')}</div><div style={{ fontWeight: 500 }}>{cs.reportId}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.status')}</div><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(cs.status)}20`, color: getStatusColor(cs.status) }}>{cs.status}</span></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.patientName')}</div><div style={{ fontWeight: 500 }}>{cs.patientName}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.patientInfo')}</div><div>{cs.gender} / {cs.age}{t('regionalReport.yearsOld')}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.examType')}</div><div>{cs.examType}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.createTime')}</div><div>{cs.createTime}</div></div>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.multiSignature')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {cs.signatures.map((sig, idx) => (
                <React.Fragment key={idx}>
                  <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: `1px solid ${sig.certificateStatus === '已认证' ? COLORS.success : COLORS.danger}30`, minWidth: '160px' }}>
                    <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}><BadgeCheck size={12} style={{ color: COLORS.primary }} /> {sig.institution}</div>
                    <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>{sig.doctorName}</div>
                    <div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>{sig.signTime}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{sig.certificateStatus === '已认证' ? <><CheckCircle size={12} style={{ color: COLORS.success }} /><span style={{ fontSize: '10px', color: COLORS.success }}>{t('regionalReport.certified')}</span></> : <><XCircle size={12} style={{ color: COLORS.danger }} /><span style={{ fontSize: '10px', color: COLORS.danger }}>{t('regionalReport.uncertified')}</span></>}</div>
                  </div>
                  {idx < cs.signatures.length - 1 && <ArrowRight size={20} style={{ color: COLORS.textMuted }} />}
                </React.Fragment>
              ))}
              {cs.status === '待签发' && <div style={{ padding: '12px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: '2px dashed #d1d5db', minWidth: '120px', textAlign: 'center' }}><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.pendingSignature')}</div><div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>...</div></div>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>{t('regionalReport.versionManagement')}</h4>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
            <DataTable<ReportVersion>
              rowKey={(row) => row.version}
              dataSource={cs.versions}
              columns={versionColumns}
              showPagination={false}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardsProps {
  filteredStats: { totalReports: number; pendingConsultations: number; criticalValues: number; avgResponseTime: string }
}

export const StatCards: React.FC<StatCardsProps> = ({ filteredStats }) => {
  const statItems = [
    { label: t('regionalReport.totalReports'), value: filteredStats.totalReports, change: 12, changeType: 'up' as const, icon: <FileText size={18} />, color: COLORS.primary },
    { label: t('regionalReport.pendingConsultations'), value: filteredStats.pendingConsultations, change: -3, changeType: 'down' as const, icon: <Video size={18} />, color: COLORS.warning },
    { label: t('regionalReport.criticalValues'), value: filteredStats.criticalValues, change: 2, changeType: 'up' as const, icon: <ShieldAlert size={18} />, color: COLORS.danger },
    { label: t('regionalReport.avgResponseTime'), value: filteredStats.avgResponseTime, change: -5, changeType: 'down' as const, icon: <Clock size={18} />, color: COLORS.success },
  ]
  return (
    <div style={styles.statsContainer}>
      {statItems.map((stat, index) => (
        <div key={index} style={styles.statCard}>
          <div style={{ ...styles.statLabel, color: stat.color }}>{stat.icon}<span>{stat.label}</span></div>
          <div style={{ ...styles.statValue, color: stat.color }}>{stat.value}</div>
          {stat.change !== undefined && (
            <div style={{ ...styles.statChange, color: stat.changeType === 'up' ? COLORS.danger : COLORS.success }}>
              {stat.changeType === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span>{Math.abs(stat.change)}% {t('regionalReport.vsLastMonth')}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface RightPanelProps {
  institutions: Institution[]
  onRefreshStats: () => void
}

export const RightPanel: React.FC<RightPanelProps> = ({ institutions, onRefreshStats }) => {
  return (
    <div style={styles.rightPanel}>
      <div style={styles.panelHeader}><span>{t('regionalReport.regionalStats')}</span><ActionButton action="refresh" size="compact" icon={<RefreshCw size={14} />} onClick={onRefreshStats} /></div>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>{t('regionalReport.institutionReports')}</div>
        {institutions.map((inst) => {
          const maxCount = Math.max(...institutions.map(i => i.reportCount))
          const percentage = (inst.reportCount / maxCount) * 100
          return (
            <div key={inst.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '12px' }}>{inst.name}</span><span style={{ fontSize: '12px', fontWeight: 600 }}>{inst.reportCount}</span></div>
              <div style={{ ...styles.progressBar, height: '6px' }}><div style={{ ...styles.progressFill, width: `${percentage}%`, backgroundColor: COLORS.primary }} /></div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>{t('regionalReport.consultationResponseTime')}（{t('regionalReport.minutes')}）</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '100px' }}>
          {[{ label: t('regionalReport.today'), value: 15, height: 40 }, { label: t('regionalReport.week'), value: 18, height: 48 }, { label: t('regionalReport.month'), value: 22, height: 58 }, { label: t('regionalReport.quarter'), value: 20, height: 53 }].map((item, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: COLORS.primary }}>{item.value}</div>
              <div style={{ width: '30px', height: `${item.height}%`, backgroundColor: COLORS.primary, borderRadius: '4px 4px 0 0', margin: '4px auto' }} />
              <div style={{ fontSize: '10px', color: COLORS.textMuted }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>{t('regionalReport.positivityRate')}</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
              <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" stroke={COLORS.success} strokeWidth="3" strokeDasharray={`${67} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 600 }}>67%</div>
          </div>
          <div style={{ flex: 1 }}><div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('regionalReport.monthRegionPositivity')}</div><div style={{ fontSize: '12px' }}>{t('regionalReport.vsLastMonth')} <span style={{ color: COLORS.success }}>+2.3%</span></div></div>
        </div>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>{t('regionalReport.criticalTurnaround')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>8{t('regionalReport.minutes')}</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>{t('regionalReport.avgReceiveTime')}</div></div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.primary }}>25{t('regionalReport.minutes')}</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>{t('regionalReport.avgProcessTime')}</div></div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>98%</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>{t('regionalReport.closureRate')}</div></div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.warning }}>3{t('regionalReport.casesUnit')}</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>{t('regionalReport.processing')}</div></div>
        </div>
      </div>
    </div>
  )
}

interface ModalContentProps {
  modalType: string
  showModal: boolean
  onClose: () => void
  consultationForm: any
  onConsultationFormChange: (v: any) => void
  opinionText: string
  onOpinionTextChange: (v: string) => void
  reviewText: string
  onReviewTextChange: (v: string) => void
  selectedReport: Report | null
  onSubmitConsultation: () => void
  onSubmitOpinion: () => void
  onReviewReport: (report: Report, result: '通过' | '驳回') => void
  institutions: Institution[]
  onToast: (msg: string, success?: boolean) => void
}

export const ModalContent: React.FC<ModalContentProps> = ({
  modalType, showModal, onClose, consultationForm, onConsultationFormChange,
  opinionText, onOpinionTextChange, reviewText, onReviewTextChange,
  selectedReport, onSubmitConsultation, onSubmitOpinion, onReviewReport, institutions, onToast
}) => {
  if (!showModal) return null
  const setForm = (v: any) => onConsultationFormChange({ ...consultationForm, ...v })
  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        {modalType === 'apply' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.initiateConsultation')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.patientName')} *</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReport.patientNamePlaceholder')} value={consultationForm.patientName} onChange={e => setForm({ patientName: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReport.gender')}</label><Select style={{ width: '100%' }} value={consultationForm.gender} onChange={v => setForm({ gender: v })} options={[{ value: '男', label: t('regionalReport.male') }, { value: '女', label: t('regionalReport.female') }]} /></div>
                <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>{t('regionalReport.age')}</label><input type="number" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReport.age')} value={consultationForm.age} onChange={e => setForm({ age: e.target.value })} /></div>
              </div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.applyInstitution')} *</label><Select style={{ width: '100%' }} value={consultationForm.institution || undefined} placeholder={t('regionalReport.selectInstitution')} onChange={v => setForm({ institution: v })} options={institutions.map(inst => ({ value: inst.name, label: inst.name }))} /></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }} onClick={onSubmitConsultation}><Send size={13} />{t('regionalReport.submit')}</button></div>
          </>
        )}
        {modalType === 'opinion' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.fillConsultationOpinion')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}><div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.consultationOpinion')}</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '150px' }} placeholder={t('regionalReport.consultationOpinionDetailPlaceholder')} value={opinionText} onChange={e => onOpinionTextChange(e.target.value)} /></div></div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }} onClick={onSubmitOpinion}><Send size={13} />{t('regionalReport.submitOpinion')}</button></div>
          </>
        )}
        {modalType === 'review' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.reviewReport')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px' }}><div style={{ marginBottom: '8px' }}>{t('regionalReport.reportNo')}：{selectedReport?.reportId}</div><div style={{ marginBottom: '8px' }}>{t('regionalReport.patient')}：{selectedReport?.patientName}</div><div>{t('regionalReport.exam')}：{selectedReport?.modality} - {selectedReport?.examItem}</div></div>
              </div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.reviewOpinion')}</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '120px' }} placeholder={t('regionalReport.reviewOpinionPlaceholder')} value={reviewText} onChange={e => onReviewTextChange(e.target.value)} /></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, padding: '8px 20px', backgroundColor: COLORS.success, color: 'white' }} onClick={() => selectedReport && onReviewReport(selectedReport, '通过')}><CheckCircle size={14} /> {t('regionalReport.pass')}</button><button style={{ ...styles.button, padding: '8px 20px', backgroundColor: COLORS.danger, color: 'white' }} onClick={() => selectedReport && onReviewReport(selectedReport, '驳回')}><XCircle size={14} /> {t('regionalReport.reject')}</button></div>
          </>
        )}
        {modalType === 'review-pass' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.reviewPassed')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}><div style={{ textAlign: 'center', padding: '20px' }}><CheckCircle size={48} style={{ color: COLORS.success, marginBottom: '16px' }} /><div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>{t('regionalReport.confirmPass')}</div><div style={{ color: COLORS.textMuted, fontSize: '12px' }}>{t('regionalReport.reportNo')}：{selectedReport?.reportId}</div></div></div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { selectedReport && onReviewReport(selectedReport, '通过') }}>{t('regionalReport.confirmPassBtn')}</button></div>
          </>
        )}
        {modalType === 'review-reject' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.rejectReport')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}><div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.rejectReason')} *</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '120px' }} placeholder={t('regionalReport.rejectReasonPlaceholder')} value={reviewText} onChange={e => onReviewTextChange(e.target.value)} /></div></div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.cancel')}</button><button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => { selectedReport && onReviewReport(selectedReport, '驳回') }}>{t('regionalReport.confirmReject')}</button></div>
          </>
        )}
        {modalType === 'quality-filter' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.qualityFilter')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.qualityRange')}</label><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="number" style={{ ...styles.input, width: '80px' }} placeholder={t('regionalReport.minLabel')} min="0" max="100" /><span>{t('regionalReport.toLabel')}</span><input type="number" style={{ ...styles.input, width: '80px' }} placeholder={t('regionalReport.maxLabel')} min="0" max="100" /></div></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.issueType')}</label><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> {t('regionalReport.issueNotDetailed')}</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> {t('regionalReport.issueDiagnosisUnclear')}</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> {t('regionalReport.issueFormatNonstandard')}</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> {t('regionalReport.issueNoMeasurement')}</label></div></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { onClose(); onToast(t('regionalReport.filterApplied'), true) }}>{t('regionalReport.applyFilter')}</button></div>
          </>
        )}
        {modalType === 'cosign-add' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.addCoSign')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.reportNumber')} *</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder={t('regionalReport.reportNumberPlaceholder')} /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.examType')}</label><Select style={{ width: '100%' }} placeholder={t('regionalReport.pleaseSelect')} options={[{ value: 'CT', label: 'CT' }, { value: 'MRI', label: 'MRI' }, { value: 'DR', label: 'DR' }, { value: '超声', label: t('regionalReport.ultrasound') }]} /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.participatingInstitutions')}</label><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{institutions.map(inst => <label key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> {inst.name}</label>)}</div></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.cancel')}</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { onClose(); onToast(t('regionalReport.coSignCreated'), true) }}>{t('regionalReport.create')}</button></div>
          </>
        )}
        {modalType === 'critical-stats' && (
          <>
            <div style={styles.modalHeader}><span>{t('regionalReport.criticalStatsReport')}</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.danger }}>5</div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.pending')}</div></div>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.success }}>3</div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('regionalReport.closed')}</div></div>
              </div>
              <div style={styles.formGroup}><label style={styles.formLabel}>{t('regionalReport.filterByTimeRange')}</label><Select style={{ width: '100%' }} defaultValue="today" options={[{ value: 'today', label: t('regionalReport.today') }, { value: 'week', label: t('regionalReport.week') }, { value: 'month', label: t('regionalReport.month') }, { value: 'year', label: t('regionalReport.thisYear') }]} /></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>{t('regionalReport.close')}</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { onClose(); onToast(t('regionalReport.reportExported'), true) }}>{t('regionalReport.exportReport')}</button></div>
          </>
        )}
      </div>
    </div>
  )
}

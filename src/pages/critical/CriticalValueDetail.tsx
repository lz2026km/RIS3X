
import {
  ShieldAlert, X, User, AlertTriangle, Bell, ClipboardList, PhoneOutgoing, PhoneIncoming,
  Clock, FileText, TrendingUp, Stethoscope, CheckCircle, Circle,
} from 'lucide-react'

import { FollowUpTab, DocumentsTab } from './CriticalValueFollowUp'
import type { CriticalValue, FollowUpRecord, TimelineEvent } from './types'
import { t } from '../../i18n/appI18n'

interface DetailPanelProps {
  cv: CriticalValue
  onClose: () => void
  activeTab: number
  setActiveTab: (v: number) => void
  followUpRecords: FollowUpRecord[]
  /** [W2-A] GET /criticals/:id/history 操作历史 */
  historyEvents?: TimelineEvent[]
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: '#94a3b8', marginBottom: 2 }
const valueStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#1e40af' }

export const DetailPanel = ({ cv, onClose, activeTab, setActiveTab, followUpRecords, historyEvents }: DetailPanelProps) => {
  const tabs = [
    { label: t('critDetail.tab.basic'), icon: User },
    { label: t('critDetail.tab.detail'), icon: AlertTriangle },
    { label: t('critDetail.tab.report'), icon: Bell },
    { label: t('critDetail.tab.processing'), icon: ClipboardList },
    { label: t('critDetail.tab.followUp'), icon: PhoneOutgoing },
    { label: t('critDetail.tab.timeline'), icon: Clock },
    { label: t('critDetail.tab.documents'), icon: FileText },
  ]

  return (
    <div style={{
      width: 480, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 120px)', position: 'sticky', top: 24,
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-error-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={20} style={{ color: '#dc2626' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{t('critDetail.title')}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{cv.id} · {cv.patientName}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} style={{ color: '#64748b' }} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        {tabs.map((tab, idx) => {
          const Icon = tab.icon
          return (
            <div key={tab.label} onClick={() => setActiveTab(idx)} style={{
              flex: 1, padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
              borderBottom: activeTab === idx ? '2px solid #1e40af' : '2px solid transparent',
              background: activeTab === idx ? 'var(--bg-card)' : 'transparent', transition: 'all 0.2s',
            }}>
              <Icon size={14} style={{ color: activeTab === idx ? '#1e40af' : '#94a3b8', marginBottom: 2 }} />
              <div style={{ fontSize: 12, fontWeight: activeTab === idx ? 700 : 500, color: activeTab === idx ? '#1e40af' : '#94a3b8' }}>
                {tab.label}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 0 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>{t('critDetail.patientInfo')}</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: t('critDetail.name'), value: cv.patientName }, { label: t('critDetail.gender'), value: cv.gender },
                    { label: t('critDetail.age'), value: cv.age + '岁' }, { label: t('critDetail.patientType'), value: cv.patientType },
                    { label: t('critDetail.inpatientNo'), value: cv.patientId }, { label: t('critDetail.phone'), value: cv.phone },
                    { label: t('critDetail.contactPerson'), value: cv.contactPerson }, { label: t('critDetail.outpatientNo'), value: cv.accessionNumber },
                  ].map(item => (
                    <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value || '-'}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>{t('critDetail.examInfo')}</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: t('critDetail.examItem'), value: cv.examItemName }, { label: t('critDetail.device'), value: cv.deviceName },
                    { label: t('critDetail.examTime'), value: cv.examTime }, { label: t('critDetail.examDoctor'), value: cv.examDoctorName },
                    { label: t('critDetail.bodyPart'), value: cv.bodyPart }, { label: t('critDetail.accession'), value: cv.accessionNumber },
                  ].map(item => (
                    <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value || '-'}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>{t('critDetail.summary')}</div>
              <div style={{ background: 'var(--color-error-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--color-error-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>{cv.severity} · {cv.modality}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cv.findingDetails}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div>
            <div style={{ background: 'var(--color-error-bg)', borderRadius: 10, padding: 16, border: '2px solid #dc2626', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={18} style={{ color: '#dc2626' }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>{t('critDetail.abnormalResult')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div style={labelStyle}>{t('critDetail.resultValue')}</div><div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{cv.resultValue}</div></div>
                <div><div style={labelStyle}>{t('critDetail.unit')}</div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{cv.resultUnit}</div></div>
                <div><div style={labelStyle}>{t('critDetail.normalRange')}</div><div style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>{cv.normalRange}</div></div>
                <div><div style={labelStyle}>{t('critDetail.criticalRange')}</div><div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>{cv.criticalRange}</div></div>
              </div>
              {cv.exceedRatio && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-error-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={14} style={{ color: '#dc2626' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{t('critDetail.exceed', { value: cv.exceedRatio })}</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>{t('critDetail.description')}</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                {cv.findingDetails}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ label: t('critDetail.examItem'), value: cv.examItemName }, { label: t('critDetail.deviceType'), value: cv.modality }, { label: t('critDetail.severity'), value: cv.severity }, { label: t('critDetail.reportedBy'), value: cv.reportedByName }].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 10, border: '1px solid var(--border-color)' }}>
                  <div style={labelStyle}>{item.label}</div>
                  <div style={valueStyle}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Bell size={16} style={{ color: '#d97706' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{t('critDetail.reportInfo')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: t('critDetail.reportedTime'), value: cv.reportedTime }, { label: t('critDetail.reportedBy'), value: cv.reportedByName }, { label: t('critDetail.notifyMethod'), value: cv.notificationMethod }, { label: t('critDetail.receivingDept'), value: cv.receivingDepartment }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value || '-'}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--color-warning-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--color-warning-border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PhoneIncoming size={16} style={{ color: '#ea580c' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>{t('critDetail.phoneNotify')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: t('critDetail.phoneCaller'), value: cv.voiceCalledBy || cv.receivingDoctorName || t('critDetail.toNotify') }, { label: t('critDetail.notifyTime'), value: cv.voiceCalledAt || cv.receivingTime || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={{ ...valueStyle, color: item.value === t('critDetail.toNotify') || item.value === '-' ? '#94a3b8' : '#1e40af' }}>{item.value}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Stethoscope size={16} style={{ color: '#1e40af' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{t('critDetail.receiveClinical')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: t('critDetail.receivingDoctor'), value: cv.receivingDoctorName || t('critDetail.toAssign') }, { label: t('critDetail.receivingTime'), value: cv.receivingTime || '-' }, { label: t('critDetail.clinicalReply'), value: cv.acknowledgedBy || t('critDetail.toReply') }, { label: t('critDetail.replyTime'), value: cv.acknowledgedTime || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={{ ...valueStyle, color: item.value === t('critDetail.toAssign') || item.value === t('critDetail.toReply') || item.value === '-' ? '#94a3b8' : '#1e40af' }}>{item.value}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--color-success-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--color-success-border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{t('critDetail.clinicalReceipt')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: t('critDetail.confirmedBy'), value: cv.confirmedBy || t('critDetail.toReceipt') }, { label: t('critDetail.receiptTime'), value: cv.confirmedAt || '-' }, { label: t('critDetail.signature'), value: cv.confirmedSignature || '-' }, { label: t('critDetail.receiptNote'), value: cv.confirmedComment || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={{ ...valueStyle, color: item.value === t('critDetail.toReceipt') || item.value === '-' ? '#94a3b8' : '#1e40af' }}>{item.value}</div></div>
                ))}
              </div>
            </div>
            {cv.followUpNotes && (
              <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--color-info-border)' }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>{t('critDetail.followUpNotes')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cv.followUpNotes}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <div>
            <div style={{ background: cv.status === '已处理' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', borderRadius: 10, padding: 16, border: `1px solid ${cv.status === '已处理' ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {cv.status === '已处理' ? <CheckCircle size={18} style={{ color: '#059669' }} /> : <Clock size={18} style={{ color: '#d97706' }} />}
                <span style={{ fontSize: 14, fontWeight: 800, color: cv.status === '已处理' ? '#059669' : '#d97706' }}>
                  {cv.status === '已处理' ? t('critDetail.processingDone') : t('critDetail.processing')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: t('critDetail.processingTime'), value: cv.processingTime || '-' }, { label: t('critDetail.processingDoctor'), value: cv.processingDoctorName || '-' }, { label: t('critDetail.processingDept'), value: cv.processingDepartment || '-' }, { label: t('critDetail.processingDuration'), value: cv.processingDuration || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value}</div></div>
                ))}
              </div>
            </div>
            {cv.processingMeasure && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>{t('critDetail.processingMeasure')}</div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cv.processingMeasure}</div>
              </div>
            )}
            {cv.processingResult && (
              <div>
                <div style={{ ...labelStyle, marginBottom: 6 }}>{t('critDetail.processingResult')}</div>
                <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: 14, border: '1px solid var(--color-success-border)', fontSize: 13, color: '#166534', lineHeight: 1.6, fontWeight: 600 }}>{cv.processingResult}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 4 && (
          <FollowUpTab cv={cv} records={followUpRecords} />
        )}

        {activeTab === 5 && (
          <div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
              {(cv.timeline ?? []).map((event, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: idx < cv.timeline.length - 1 ? 16 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: idx === cv.timeline.length - 1 ? '#1e40af' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {idx === cv.timeline.length - 1 ? <CheckCircle size={16} style={{ color: '#fff' }} /> : <Circle size={12} style={{ color: '#94a3b8' }} />}
                    </div>
                    {idx < cv.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border-color)', marginTop: 4, minHeight: 20 }} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{event.event}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{event.time}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{event.user}</div>
                    {event.detail && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                        {event.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {historyEvents && historyEvents.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', borderTop: '1px dashed var(--border-color)', paddingTop: 12, marginTop: 12 }}>{t('critDetail.operationHistory')}</div>
                  {historyEvents.map((event, idx) => (
                    <div key={`h-${idx}`} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Clock size={13} style={{ color: '#4f46e5' }} />
                        </div>
                        <div style={{ width: 2, flex: 1, background: 'var(--border-color)', marginTop: 4, minHeight: 20 }} />
                      </div>
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca' }}>{event.event}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{event.time}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{event.user}</div>
                        {event.detail && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                            {event.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 6 && (
          <DocumentsTab documents={cv.documents ?? []} cvId={cv.id} />
        )}
      </div>
    </div>
  )
}

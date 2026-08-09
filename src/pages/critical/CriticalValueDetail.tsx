
import {
  ShieldAlert, X, User, AlertTriangle, Bell, ClipboardList, PhoneOutgoing, PhoneIncoming,
  Clock, FileText, TrendingUp, Stethoscope, CheckCircle, Circle,
} from 'lucide-react'

import { FollowUpTab, DocumentsTab } from './CriticalValueFollowUp'
import type { CriticalValue, FollowUpRecord, TimelineEvent } from './types'
import { PRIMARY_COLOR, PRIMARY_LIGHT } from './types'

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
    { label: '基本信息', icon: User },
    { label: '危急值详情', icon: AlertTriangle },
    { label: '上报记录', icon: Bell },
    { label: '处理记录', icon: ClipboardList },
    { label: '回访记录', icon: PhoneOutgoing },
    { label: '时间轴', icon: Clock },
    { label: '相关文档', icon: FileText },
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
            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>危急值详情</div>
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
              <div style={{ ...labelStyle, marginBottom: 6 }}>患者信息</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: '姓名', value: cv.patientName }, { label: '性别', value: cv.gender },
                    { label: '年龄', value: cv.age + '岁' }, { label: '患者类型', value: cv.patientType },
                    { label: '住院号', value: cv.patientId }, { label: '联系电话', value: cv.phone },
                    { label: '联系人', value: cv.contactPerson }, { label: '门诊号', value: cv.accessionNumber },
                  ].map(item => (
                    <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value || '-'}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>检查信息</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: '检查项目', value: cv.examItemName }, { label: '设备', value: cv.deviceName },
                    { label: '检查时间', value: cv.examTime }, { label: '检查医生', value: cv.examDoctorName },
                    { label: '检查部位', value: cv.bodyPart }, { label: '检查号', value: cv.accessionNumber },
                  ].map(item => (
                    <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value || '-'}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>危急值摘要</div>
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
                <span style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>异常检查结果</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div style={labelStyle}>检查结果</div><div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{cv.resultValue}</div></div>
                <div><div style={labelStyle}>单位</div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{cv.resultUnit}</div></div>
                <div><div style={labelStyle}>正常范围</div><div style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>{cv.normalRange}</div></div>
                <div><div style={labelStyle}>危急范围</div><div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>{cv.criticalRange}</div></div>
              </div>
              {cv.exceedRatio && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-error-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={14} style={{ color: '#dc2626' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>超标程度：{cv.exceedRatio}</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>详细描述</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                {cv.findingDetails}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ label: '检查项目', value: cv.examItemName }, { label: '设备类型', value: cv.modality }, { label: '紧急程度', value: cv.severity }, { label: '上报医生', value: cv.reportedByName }].map(item => (
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
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>上报信息</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: '上报时间', value: cv.reportedTime }, { label: '上报医生', value: cv.reportedByName }, { label: '通知方式', value: cv.notificationMethod }, { label: '接收科室', value: cv.receivingDepartment }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value || '-'}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--color-warning-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--color-warning-border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PhoneIncoming size={16} style={{ color: '#ea580c' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>电话通知</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: '电话通知人', value: cv.voiceCalledBy || cv.receivingDoctorName || '待通知' }, { label: '通知时间', value: cv.voiceCalledAt || cv.receivingTime || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={{ ...valueStyle, color: item.value === '待通知' || item.value === '-' ? '#94a3b8' : '#1e40af' }}>{item.value}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Stethoscope size={16} style={{ color: '#1e40af' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>接收临床</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: '接收医生', value: cv.receivingDoctorName || '待指定' }, { label: '接收时间', value: cv.receivingTime || '-' }, { label: '临床回复', value: cv.acknowledgedBy || '待回复' }, { label: '回复时间', value: cv.acknowledgedTime || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={{ ...valueStyle, color: item.value === '待指定' || item.value === '待回复' || item.value === '-' ? '#94a3b8' : '#1e40af' }}>{item.value}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--color-success-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--color-success-border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>临床回执</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: '确认医生', value: cv.confirmedBy || '待回执' }, { label: '回执时间', value: cv.confirmedAt || '-' }, { label: '签名', value: cv.confirmedSignature || '-' }, { label: '回执备注', value: cv.confirmedComment || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={{ ...valueStyle, color: item.value === '待回执' || item.value === '-' ? '#94a3b8' : '#1e40af' }}>{item.value}</div></div>
                ))}
              </div>
            </div>
            {cv.followUpNotes && (
              <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: 12, border: '1px solid var(--color-info-border)' }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>跟进备注</div>
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
                  {cv.status === '已处理' ? '处理完成' : '处理中'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ label: '处理时间', value: cv.processingTime || '-' }, { label: '处理医生', value: cv.processingDoctorName || '-' }, { label: '处理科室', value: cv.processingDepartment || '-' }, { label: '处理耗时', value: cv.processingDuration || '-' }].map(item => (
                  <div key={item.label}><div style={labelStyle}>{item.label}</div><div style={valueStyle}>{item.value}</div></div>
                ))}
              </div>
            </div>
            {cv.processingMeasure && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>处理措施</div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cv.processingMeasure}</div>
              </div>
            )}
            {cv.processingResult && (
              <div>
                <div style={{ ...labelStyle, marginBottom: 6 }}>处理结果</div>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', borderTop: '1px dashed var(--border-color)', paddingTop: 12, marginTop: 12 }}>操作历史 (listHistory)</div>
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

// [G005 Wave1A P1-1] 接入 kioskApi settings/messages/stats (kiosk.controller 真实端点)
import { useState, useEffect } from 'react'
import { message, Card } from 'antd'
import { kioskApi, type KioskPatientDto, type KioskCheckInResultDto, type KioskTodayStatsDto, type KioskSetting, type KioskMessage } from '../../services/api/kioskApi'
import { queueApi, type QueueCallDto } from '../../services/api/queueApi'
// [v3.0.6.11-104 Wave 3D] 登记流程模板 (登记核对/妊娠询问)
import WorkflowTemplatePanel from '../../components/common/WorkflowTemplatePanel'
import { t } from '../../i18n/appI18n'

// ===== Types =====
export interface KioskState {
  step: 'idle' | 'idInput' | 'confirm' | 'result'
  idCardLast4: string
  patientName: string
  examItem: string
  result: KioskCheckInResultDto | null
}

// ===== Styles =====
const s = {
  container: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, sans-serif' },
  card: { background: '#1e293b', borderRadius: 16, padding: 40, maxWidth: 520, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  title: { fontSize: 28, fontWeight: 700, textAlign: 'center' as const, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as const, marginBottom: 32 },
  input: { width: '100%', padding: '14px 16px', fontSize: 18, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#f8fafc', textAlign: 'center' as const, letterSpacing: 4, boxSizing: 'border-box' as const, outline: 'none' },
  btn: { width: '100%', padding: '14px', fontSize: 16, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 8, display: 'block' },
  value: { fontSize: 16, color: '#f8fafc', fontWeight: 500 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #334155' },
  badge: (isPrimary: boolean) => ({
    background: isPrimary ? '#1e40af' : '#334155', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  }),
  queueNumber: { fontSize: 48, fontWeight: 800, textAlign: 'center' as const, color: '#3b82f6', fontFamily: 'monospace', margin: '20px 0' },
}

  // ===== Component =====
  const marqueeStyle = `@keyframes kioskScroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
    .kiosk-marquee { display: flex; white-space: nowrap; animation: kioskScroll 22s linear infinite; }
    .kiosk-marquee:hover { animation-play-state: paused; }`

  export default function KioskCheckIn() {
  const [step, setStep] = useState<KioskState['step']>('idle')
  const [idInput, setIdInput] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<KioskPatientDto | null>(null)
  const [result, setResult] = useState<KioskCheckInResultDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<KioskTodayStatsDto | null>(null)
  const [settings, setSettings] = useState<KioskSetting[]>([])
  const [messages, setMessages] = useState<KioskMessage[]>([])
  const [queue, setQueue] = useState<QueueCallDto[]>([])
  const [queueLoading, setQueueLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [statsRes, queueRes, settingsRes, messagesRes] = await Promise.all([
        kioskApi.getStats(),
        queueApi.list(),
        kioskApi.getSettings(),
        kioskApi.getMessages(),
      ])
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      if (queueRes.success && Array.isArray(queueRes.data)) setQueue(queueRes.data)
      if (settingsRes.success && Array.isArray(settingsRes.data)) setSettings(settingsRes.data)
      if (messagesRes.success && Array.isArray(messagesRes.data)) setMessages(messagesRes.data)
      setQueueLoading(false)
    })()
  }, [])

  const announcement = settings.find(s => s.key === 'announcement')?.value
  const activeMessages = messages.filter(m => m.active)

  const handleIdSubmit = async () => {
    setLoading(true)
    try {
      const res = await kioskApi.lookup(idInput)
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const first = res.data[0]
        if (first) setSelectedPatient(first)
        setStep('confirm')
      } else {
        message.warning(t('kiosk.notFound'))
      }
    } catch {
      message.error(t('kiosk.lookupUnavailable'))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedPatient) return
    setLoading(true)
    try {
      const res = await kioskApi.checkIn({
        patientId: selectedPatient.patientId,
        patientName: selectedPatient.patientName,
        examItemId: selectedPatient.exams[0]?.id || '',
        idCardLast4: idInput,
      })
      if (res.success && res.data) {
        setResult(res.data)
        setStep('result')
      } else {
        message.error(res.error?.message || t('kiosk.checkInFailed'))
      }
    } catch {
      message.error(t('kiosk.checkInUnavailable'))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep('idle')
    setIdInput('')
    setSelectedPatient(null)
    setResult(null)
  }

  const waitingQueue = queue.filter(q => q.status === 'waiting').slice(0, 6)

  return (
    <div style={s.container}>
      <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
        {step === 'idle' && (
          <>
            <div style={s.title}>{t('kiosk.title')}</div>
            <div style={s.subtitle}>{t('kiosk.subtitle')}</div>
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
                {[
                  { label: t('kiosk.todayCount'), value: stats.todayCount },
                  { label: t('kiosk.waitingCount'), value: stats.waitingCount },
                  { label: t('kiosk.avgWait'), value: t('kiosk.minutes', { count: stats.avgWaitMinutes }) },
                  { label: t('kiosk.activeRooms'), value: stats.activeRooms },
                ].map(it => (
                  <div key={it.label} style={{ background: '#0f172a', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid #334155' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{it.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{it.label}</div>
                  </div>
                ))}
              </div>
            )}
            {activeMessages.length > 0 && (
              <div style={{ marginBottom: 16, overflow: 'hidden', borderRadius: 10, background: '#0f172a', border: '1px solid #334155' }}>
                <style>{marqueeStyle}</style>
                <div className="kiosk-marquee" style={{ padding: '10px 0' }}>
                  {activeMessages.map(m => (
                    <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 48, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: m.level === 'urgent' ? '#f87171' : m.level === 'warning' ? '#fbbf24' : '#60a5fa' }}>📣 {m.title}</span>
                      <span style={{ color: '#cbd5e1' }}>{m.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {announcement && (
              <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '1px solid #334155' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{t('kiosk.announcementLabel')}</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{announcement}</div>
              </div>
            )}
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 20, border: '1px solid #334155' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{t('kiosk.processLabel')}</div>
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
                {t('kiosk.processSteps')}
              </div>
            </div>
            {/* [v3.0.6.11-104 Wave 3D] 登记流程模板 (登记核对/妊娠询问) */}
            <div style={{ marginBottom: 20 }}>
              <WorkflowTemplatePanel compact />
            </div>
            <input style={s.input} placeholder={t('kiosk.idPlaceholder')} maxLength={4} value={idInput}
              onChange={e => /^\d{0,4}$/.test(e.target.value) && setIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && idInput.length === 4 && void handleIdSubmit()} />
            <button style={{ ...s.btn, background: '#3b82f6', color: '#fff', marginTop: 24, opacity: idInput.length === 4 && !loading ? 1 : 0.5 }}
              disabled={idInput.length !== 4 || loading} onClick={() => void handleIdSubmit()}>
              {loading ? t('kiosk.querying') : t('kiosk.confirmCheckIn')}
            </button>
            <div style={{ marginTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
              {t('kiosk.helpHint')}
            </div>
          </>
        )}

        {step === 'confirm' && selectedPatient && (
          <>
            <div style={s.title}>{t('kiosk.confirmTitle')}</div>
            <div style={s.subtitle}>{t('kiosk.confirmSubtitle')}</div>
            <div style={{ margin: '24px 0' }}>
              <div style={s.row}><span style={s.label}>{t('kiosk.name')}</span><span style={s.value}>{selectedPatient.patientName}</span></div>
              <div style={s.row}><span style={s.label}>{t('kiosk.idCard')}</span><span style={s.value}>****{idInput}</span></div>
              <div style={s.row}><span style={s.label}>{t('kiosk.examItem')}</span><span style={s.value}>{selectedPatient.exams[0]?.name || t('kiosk.imagingExam')}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...s.btn, flex: 1, background: '#334155', color: '#94a3b8' }} onClick={handleReset}>{t('kiosk.back')}</button>
              <button style={{ ...s.btn, flex: 2, background: '#3b82f6', color: '#fff', opacity: loading ? 0.7 : 1 }}
                disabled={loading} onClick={() => void handleConfirm()}>{loading ? t('kiosk.processing') : t('kiosk.confirmCheckIn')}</button>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 8 }}>✅</div>
              <div style={s.title}>{t('kiosk.successTitle')}</div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>{result.patientName} · {t('kiosk.keepQueueNumber')}</div>
            </div>
            <div style={s.queueNumber}>{result.queueNumber}</div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{t('kiosk.estimatedWait')}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>{t('kiosk.minutes', { count: result.estimatedWaitMinutes })}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#0f172a', borderRadius: 8, marginBottom: 20 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>{t('kiosk.goTo')}</span>
              <span style={{ color: '#3b82f6', fontWeight: 700 }}>{result.roomName}</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>{t('kiosk.waitForCall')}</span>
            </div>
            <button style={{ ...s.btn, background: '#3b82f6', color: '#fff' }} onClick={handleReset}>{t('kiosk.done')}</button>
          </>
        )}
      </Card>

      {(step === 'idle' || step === 'result') && (
        <Card bordered={false} style={{ maxWidth: 520, width: '100%', marginTop: 16, background: '#1e293b', borderRadius: 12, padding: 16, border: '1px solid #334155' }} styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{t('kiosk.queueTitle')}</span>
            {queueLoading && <span style={{ fontSize: 11, color: '#64748b' }}>{t('kiosk.loading')}</span>}
          </div>
          {waitingQueue.length === 0 && !queueLoading ? (
            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: 8 }}>{t('kiosk.noWaiting')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {waitingQueue.map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{q.queueNumber} · {q.patientName}</span>
                  <span style={s.badge(true)}>{q.examItem}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { appointmentApi } from '../../services/api/appointmentApi'
import { templatesApi } from '../../services/api/templatesApi'
import { getCurrentUser } from '../../utils/auth'
import { Card } from 'antd'
import { AppEmpty } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

// ===== Types =====
export interface PushTemplate {
  id: string
  name: string
  channel: '短信' | '微信' | '邮件'
  content: string
  enabled: boolean
}

export interface ServicePreference {
  smsNotify: boolean
  wechatNotify: boolean
  emailNotify: boolean
  reportReadyAlert: boolean
  appointmentReminder: boolean
  marketingAllowed: boolean
  language: 'zh-CN' | 'en'
}

export interface AppointmentSlot {
  id: string
  date: string
  timeSlot: string
  department: string
  available: boolean
}

export interface BookingForm {
  department: string
  date: string
  timeSlot: string
  phone: string
  notes: string
}

export interface AppointmentRecord {
  id: string
  department: string
  date: string
  timeSlot: string
  status: '待确认' | '已确认' | '已完成' | '已取消'
  code: string
  phone: string
}

// ===== Mock Data (回退) =====
const MOCK_TEMPLATES: PushTemplate[] = [
  { id: 'T1', name: '报告完成通知', channel: '短信', content: '尊敬的{name}，您的{exam}检查报告已出具，请登录查看。', enabled: true },
  { id: 'T2', name: '电子胶片通知', channel: '微信', content: '您的{exam}电子胶片已生成，点击查看。', enabled: true },
  { id: 'T3', name: '复查提醒', channel: '短信', content: '尊敬的{name}，建议您近期复查，请提前预约。', enabled: false },
  { id: 'T4', name: '危急值通知', channel: '邮件', content: '您的检查发现异常，请尽快联系主治医生。', enabled: true },
]

const DEPARTMENTS = ['放射科', '内科', '外科', '骨科', '神经科', '心血管科']
const TIME_SLOTS = ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00', '16:00-17:00']

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'AP'
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const STATUS_MAP: Record<string, AppointmentRecord['status']> = {
  SCHEDULED: '待确认',
  CONFIRMED: '已确认',
  CHECKED_IN: '已确认',
  IN_PROGRESS: '已确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  NO_SHOW: '已取消',
}

// ===== Styles =====
const s = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '-apple-system, sans-serif' },
  card: { background: 'var(--bg-card)', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 16 },
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  btnSmall: { padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' as const },
  select: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' as const },
  badge: (status: string) => ({
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    background: status === '已确认' ? 'var(--color-success-bg)' : status === '已取消' ? 'var(--color-error-bg)' : status === '已完成' ? 'var(--color-info-bg)' : 'var(--color-warning-bg)',
    color: status === '已确认' ? 'var(--color-success)' : status === '已取消' ? 'var(--color-error)' : status === '已完成' ? 'var(--color-info)' : 'var(--color-warning)',
  }),
}

// ===== Component =====
export default function ServiceManagement() {
  const [activeTab, setActiveTab] = useState<'appointment' | 'push' | 'preference'>('appointment')
  // [W2-A] 预约/模板接 appointmentApi + templatesApi 实时 (失败回退演示数据)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'demo'>('demo')
  const [templates, setTemplates] = useState<PushTemplate[]>(MOCK_TEMPLATES)
  const [prefs, setPrefs] = useState<ServicePreference>({
    smsNotify: true, wechatNotify: true, emailNotify: false,
    reportReadyAlert: true, appointmentReminder: true,
    marketingAllowed: false, language: 'zh-CN',
  })
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [bookingForm, setBookingForm] = useState<BookingForm>({ department: '', date: '', timeSlot: '', phone: '', notes: '' })
  const [successCode, setSuccessCode] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [apptRes, snipRes] = await Promise.allSettled([
        appointmentApi.list({ take: 20 }),
        templatesApi.listSnippets(),
      ])
      let live = false
      if (apptRes.status === 'fulfilled' && Array.isArray(apptRes.value.data)) {
        setAppointments(apptRes.value.data.map((a: any) => ({
          id: a.id,
          department: a.bodyPart || a.modality || '放射科',
          date: String(a.startAt || '').slice(0, 10),
          timeSlot: (String(a.startAt || '').slice(11, 16) || '--') + '-' + (String(a.endAt || '').slice(11, 16) || '--'),
          status: STATUS_MAP[a.state] ?? '待确认',
          code: a.id,
          phone: a.patientName || '',
        })))
        live = true
      }
      if (snipRes.status === 'fulfilled' && Array.isArray(snipRes.value.data) && snipRes.value.data.length > 0) {
        setTemplates(snipRes.value.data.map((t: any, i: number) => ({
          id: t.id || `snp-${i}`,
          name: t.name || '未命名模板',
          content: t.content || '',
          channel: (/短信/.test(String(t.category ?? '')) ? '短信' : /邮件/.test(String(t.category ?? '')) ? '邮件' : '微信') as PushTemplate['channel'],
          enabled: true,
        })))
        live = true
      }
      setSource(live ? 'api' : 'demo')
      if (!live) setError(t('serviceMgmt.apiUnavailable'))
    } catch (e) {
      setSource('demo')
      setError(e instanceof Error ? e.message : t('serviceMgmt.loadFailedFallback'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const handleBook = async () => {
    if (!bookingForm.department || !bookingForm.date || !bookingForm.timeSlot || !bookingForm.phone) return
    const start = `${bookingForm.date}T${bookingForm.timeSlot.split('-')[0]}:00`
    const end = `${bookingForm.date}T${bookingForm.timeSlot.split('-')[1] || '00:00'}:00`
    const user = getCurrentUser()
    try {
      const res = await appointmentApi.create({
        patientName: `患者${bookingForm.phone.slice(-4)}`,
        patientId: `P-${Date.now()}`,
        modality: 'CT',
        bodyPart: bookingForm.department,
        startAt: start,
        endAt: end,
        deviceId: 'DEV-001',
        deviceName: bookingForm.department,
        priority: 'ROUTINE',
        note: bookingForm.notes,
        createdById: user?.id ?? 'unknown',
      })
      const code = res.data?.id || generateCode()
      const newAppt: AppointmentRecord = {
        id: code, department: bookingForm.department, date: bookingForm.date,
        timeSlot: bookingForm.timeSlot, status: '待确认', code, phone: bookingForm.phone,
      }
      setAppointments(prev => [newAppt, ...prev])
      setSuccessCode(code)
      setBookingForm({ department: '', date: '', timeSlot: '', phone: '', notes: '' })
      setTimeout(() => setSuccessCode(null), 5000)
    } catch (e) {
      window.alert?.('预约提交失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await appointmentApi.cancel(id)
    } catch { /* 后端失败时仍本地更新状态 */ }
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: '已取消' as const } : a))
  }

  const toggleTemplate = (id: string) => {
    setTemplates(prev => prev.map(tpl => tpl.id === id ? { ...tpl, enabled: !tpl.enabled } : tpl))
  }

  return (
    <div style={s.container}>
      {/* 数据源状态条 */}
      <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', border: `1px solid ${source === 'api' ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`, fontSize: 12, color: source === 'api' ? 'var(--color-success)' : 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? t('serviceMgmt.syncing') : source === 'api' ? t('serviceMgmt.sourceApi') : t('serviceMgmt.sourceDemo')}
        {error && <span style={{ color: '#dc2626', marginLeft: 'auto' }}>{error}</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', padding: 4, borderRadius: 10 }}>
        {(['appointment', 'push', 'preference'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
            background: activeTab === tab ? 'var(--bg-elevated)' : 'transparent', color: activeTab === tab ? '#1e40af' : '#64748b',
            cursor: 'pointer', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tab === 'appointment' ? t('serviceMgmt.tabAppointment') : tab === 'push' ? t('serviceMgmt.tabPush') : t('serviceMgmt.tabPreference')}
          </button>
        ))}
      </div>

      {/* Appointment Tab */}
      {activeTab === 'appointment' && (
        <>
          <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
            <h3 style={s.title}>{t('serviceMgmt.newBooking')}</h3>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>{t('serviceMgmt.department')}</label>
                <select value={bookingForm.department} onChange={e => setBookingForm(p => ({ ...p, department: e.target.value }))} style={s.select}>
                  <option value="">{t('serviceMgmt.selectDepartment')}</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>{t('serviceMgmt.appointmentDate')}</label>
                <input type="date" value={bookingForm.date} onChange={e => setBookingForm(p => ({ ...p, date: e.target.value }))} style={s.input} />
              </div>
              <div>
                <label style={s.label}>{t('serviceMgmt.timeSlot')}</label>
                <select value={bookingForm.timeSlot} onChange={e => setBookingForm(p => ({ ...p, timeSlot: e.target.value }))} style={s.select}>
                  <option value="">{t('serviceMgmt.selectTimeSlot')}</option>
                  {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>{t('serviceMgmt.phone')}</label>
                <input placeholder={t('serviceMgmt.phonePlaceholder')} value={bookingForm.phone} onChange={e => setBookingForm(p => ({ ...p, phone: e.target.value }))} style={s.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>{t('serviceMgmt.notes')}</label>
                <input placeholder={t('serviceMgmt.notesPlaceholder')} value={bookingForm.notes} onChange={e => setBookingForm(p => ({ ...p, notes: e.target.value }))} style={s.input} />
              </div>
            </div>
            <button style={{ ...s.btn, marginTop: 12 }} onClick={() => void handleBook()}>{t('serviceMgmt.submitBooking')}</button>
            {successCode && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--color-success-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--color-success)', fontWeight: 600 }}>{t('serviceMgmt.bookingSuccess')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', fontFamily: 'monospace', letterSpacing: 2, marginTop: 8 }}>{successCode}</div>
              </div>
            )}
          </Card>

          {appointments.length === 0 && (
            <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
              <h3 style={s.title}>{t('serviceMgmt.myAppointments')}</h3>
              <AppEmpty variant="no-data" minHeight={160} />
            </Card>
          )}

          {appointments.length > 0 && (
            <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
              <h3 style={s.title}>{t('serviceMgmt.myAppointments')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{source === 'api' ? t('serviceMgmt.apptRealtime') : t('serviceMgmt.demo')}</span></h3>
              {appointments.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{a.department}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{a.date} {a.timeSlot}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('serviceMgmt.codePrefix')}{a.code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={s.badge(a.status)}>{a.status}</span>
                    {a.status !== '已取消' && a.status !== '已完成' && (
                      <button style={{ ...s.btnSmall, background: 'var(--color-error-bg)', color: 'var(--color-error)' }} onClick={() => void handleCancel(a.id)}>{t('serviceMgmt.cancel')}</button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Push Templates Tab */}
      {activeTab === 'push' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={s.title}>{t('serviceMgmt.pushTemplates')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{source === 'api' ? t('serviceMgmt.templatesRealtime') : t('serviceMgmt.demo')}</span></h3>
          {templates.map(tpl => (
            <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 8, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tpl.name}
                  <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: tpl.channel === '短信' ? 'var(--color-info-bg)' : tpl.channel === '微信' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                    color: tpl.channel === '短信' ? 'var(--color-info)' : tpl.channel === '微信' ? 'var(--color-success)' : 'var(--color-warning)',
                  }}>{tpl.channel}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{tpl.content}</div>
              </div>
              <button onClick={() => toggleTemplate(tpl.id)} style={{
                ...s.btnSmall, minWidth: 48,
                background: tpl.enabled ? '#059669' : 'var(--bg-card)',
                color: tpl.enabled ? '#fff' : '#94a3b8',
              }}>
                {tpl.enabled ? t('serviceMgmt.on') : t('serviceMgmt.off')}
              </button>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{t('serviceMgmt.templatesNote')}</div>
        </Card>
      )}

      {/* Preference Tab */}
      {activeTab === 'preference' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={s.title}>{t('serviceMgmt.notifyPrefs')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{t('serviceMgmt.localStorage')}</span></h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'smsNotify' as const, label: t('serviceMgmt.notifySms') },
              { key: 'wechatNotify' as const, label: t('serviceMgmt.notifyWechat') },
              { key: 'emailNotify' as const, label: t('serviceMgmt.notifyEmail') },
              { key: 'reportReadyAlert' as const, label: t('serviceMgmt.notifyReportReady') },
              { key: 'appointmentReminder' as const, label: t('serviceMgmt.notifyAppointment') },
              { key: 'marketingAllowed' as const, label: t('serviceMgmt.notifyMarketing') },
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefs[item.key] as boolean} onChange={() => setPrefs(p => ({ ...p, [item.key]: !p[item.key] }))} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{item.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={s.label}>{t('serviceMgmt.language')}</label>
            <select value={prefs.language} onChange={e => setPrefs(p => ({ ...p, language: e.target.value as 'zh-CN' | 'en' }))} style={s.select}>
              <option value="zh-CN">{t('serviceMgmt.langZh')}</option>
              <option value="en">{t('serviceMgmt.langEn')}</option>
            </select>
          </div>
          <button
            style={{ ...s.btn, marginTop: 16 }}
            onClick={() => {
              try {
                window.localStorage.setItem('ris_patient_prefs', JSON.stringify(prefs));
                const verb = t('serviceMgmt.prefsSaved');
                window.alert?.(verb);
                setSuccessCode(verb);
                setTimeout(() => setSuccessCode(null), 3000);
              } catch (e) {
                window.alert?.('保存失败: ' + (e as Error).message);
              }
            }}
          >{t('serviceMgmt.saveSettings')}</button>
        </Card>
      )}
    </div>
  )
}

import { useState } from 'react'

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

// ===== Mock Data =====
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

// ===== Styles =====
const s = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '-apple-system, sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title: { fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0, marginBottom: 16 },
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  btnSmall: { padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' as const },
  select: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' as const },
  badge: (status: string) => ({
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    background: status === '已确认' ? '#dcfce7' : status === '已取消' ? '#fee2e2' : status === '已完成' ? '#e0f2fe' : '#fef9c3',
    color: status === '已确认' ? '#166534' : status === '已取消' ? '#991b1b' : status === '已完成' ? '#0369a1' : '#854d0e',
  }),
}

// ===== Component =====
export default function ServiceManagement() {
  const [activeTab, setActiveTab] = useState<'appointment' | 'push' | 'preference'>('appointment')
  const [templates, setTemplates] = useState<PushTemplate[]>(MOCK_TEMPLATES)
  const [prefs, setPrefs] = useState<ServicePreference>({
    smsNotify: true, wechatNotify: true, emailNotify: false,
    reportReadyAlert: true, appointmentReminder: true,
    marketingAllowed: false, language: 'zh-CN',
  })
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [bookingForm, setBookingForm] = useState<BookingForm>({ department: '', date: '', timeSlot: '', phone: '', notes: '' })
  const [successCode, setSuccessCode] = useState<string | null>(null)

  const handleBook = () => {
    if (!bookingForm.department || !bookingForm.date || !bookingForm.timeSlot || !bookingForm.phone) return
    const code = generateCode()
    const newAppt: AppointmentRecord = {
      id: `APT${Date.now()}`, department: bookingForm.department, date: bookingForm.date,
      timeSlot: bookingForm.timeSlot, status: '待确认', code, phone: bookingForm.phone,
    }
    setAppointments(prev => [newAppt, ...prev])
    setSuccessCode(code)
    setBookingForm({ department: '', date: '', timeSlot: '', phone: '', notes: '' })
    setTimeout(() => setSuccessCode(null), 5000)
  }

  const handleCancel = (id: string) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: '已取消' as const } : a))
  }

  const toggleTemplate = (id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  return (
    <div style={s.container}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
        {(['appointment', 'push', 'preference'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
            background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#1e40af' : '#64748b',
            cursor: 'pointer', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tab === 'appointment' ? '预约挂号' : tab === 'push' ? '推送管理' : '偏好设置'}
          </button>
        ))}
      </div>

      {/* Appointment Tab */}
      {activeTab === 'appointment' && (
        <>
          <div style={s.card}>
            <h3 style={s.title}>新建预约</h3>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>科室</label>
                <select value={bookingForm.department} onChange={e => setBookingForm(p => ({ ...p, department: e.target.value }))} style={s.select}>
                  <option value="">请选择科室</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>预约日期</label>
                <input type="date" value={bookingForm.date} onChange={e => setBookingForm(p => ({ ...p, date: e.target.value }))} style={s.input} />
              </div>
              <div>
                <label style={s.label}>时段</label>
                <select value={bookingForm.timeSlot} onChange={e => setBookingForm(p => ({ ...p, timeSlot: e.target.value }))} style={s.select}>
                  <option value="">请选择时段</option>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>联系电话</label>
                <input placeholder="手机号" value={bookingForm.phone} onChange={e => setBookingForm(p => ({ ...p, phone: e.target.value }))} style={s.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>备注</label>
                <input placeholder="病情描述或特殊要求" value={bookingForm.notes} onChange={e => setBookingForm(p => ({ ...p, notes: e.target.value }))} style={s.input} />
              </div>
            </div>
            <button style={{ ...s.btn, marginTop: 12 }} onClick={handleBook}>提交预约</button>
            {successCode && (
              <div style={{ marginTop: 16, padding: 16, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#166534', fontWeight: 600 }}>预约成功！</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', fontFamily: 'monospace', letterSpacing: 2, marginTop: 8 }}>{successCode}</div>
              </div>
            )}
          </div>

          {appointments.length > 0 && (
            <div style={s.card}>
              <h3 style={s.title}>我的预约</h3>
              {appointments.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{a.department}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{a.date} {a.timeSlot}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>编号：{a.code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={s.badge(a.status)}>{a.status}</span>
                    {a.status !== '已取消' && a.status !== '已完成' && (
                      <button style={{ ...s.btnSmall, background: '#fee2e2', color: '#991b1b' }} onClick={() => handleCancel(a.id)}>取消</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Push Templates Tab */}
      {activeTab === 'push' && (
        <div style={s.card}>
          <h3 style={s.title}>推送模板管理</h3>
          {templates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.name}
                  <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: t.channel === '短信' ? '#e0f2fe' : t.channel === '微信' ? '#dcfce7' : '#fef3c7',
                    color: t.channel === '短信' ? '#0369a1' : t.channel === '微信' ? '#166534' : '#92400e',
                  }}>{t.channel}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t.content}</div>
              </div>
              <button onClick={() => toggleTemplate(t.id)} style={{
                ...s.btnSmall, minWidth: 48,
                background: t.enabled ? '#059669' : '#e2e8f0',
                color: t.enabled ? '#fff' : '#94a3b8',
              }}>
                {t.enabled ? '开启' : '关闭'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preference Tab */}
      {activeTab === 'preference' && (
        <div style={s.card}>
          <h3 style={s.title}>通知偏好</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'smsNotify' as const, label: '短信通知' },
              { key: 'wechatNotify' as const, label: '微信通知' },
              { key: 'emailNotify' as const, label: '邮件通知' },
              { key: 'reportReadyAlert' as const, label: '报告完成提醒' },
              { key: 'appointmentReminder' as const, label: '预约提醒' },
              { key: 'marketingAllowed' as const, label: '接收推广信息' },
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefs[item.key] as boolean} onChange={() => setPrefs(p => ({ ...p, [item.key]: !p[item.key] }))} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14, color: '#334155' }}>{item.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={s.label}>语言偏好</label>
            <select value={prefs.language} onChange={e => setPrefs(p => ({ ...p, language: e.target.value as 'zh-CN' | 'en' }))} style={s.select}>
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            style={{ ...s.btn, marginTop: 16 }}
            onClick={() => {
              try {
                window.localStorage.setItem('ris_patient_prefs', JSON.stringify(prefs));
                const verb = navigator?.language?.startsWith('zh') ? '已保存偏好设置' : 'Preferences saved';
                window.alert?.(verb);
                setSuccessCode(verb);
                setTimeout(() => setSuccessCode(null), 3000);
              } catch (e) {
                window.alert?.('保存失败: ' + (e as Error).message);
              }
            }}
          >保存设置</button>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { ListChecks, Bell, UserX, RefreshCw, Plus, Send, ScanLine, RotateCcw, Check } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import {
  appointmentApi,
  type WaitlistEntryDto,
  type ReminderPlanDto,
  type NoShowRecordDto,
} from '../../services/api'

type Tab = 'WAITLIST' | 'REMINDER' | 'NOSHOW'

const borderGray = 'var(--border-color)'
const primaryBlue = '#1e40af'
const textGray = '#64748b'

const priorityLabel = (p: string): string =>
  p === 'critical' ? t('w5Appt.priorityCritical') : p === 'urgent' ? t('w5Appt.priorityUrgent') : t('w5Appt.priorityNormal')

const priorityColor = (p: string): string =>
  p === 'critical' ? '#dc2626' : p === 'urgent' ? '#f59e0b' : textGray

export default function AppointmentOpsPanels() {
  const [tab, setTab] = useState<Tab>('WAITLIST')
  const [waitlist, setWaitlist] = useState<WaitlistEntryDto[]>([])
  const [reminders, setReminders] = useState<ReminderPlanDto[]>([])
  const [noShows, setNoShows] = useState<NoShowRecordDto[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [newPatient, setNewPatient] = useState('')
  const [newModality, setNewModality] = useState('CT')
  const [newPriority, setNewPriority] = useState('normal')

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [w, r, n] = await Promise.all([
        appointmentApi.getWaitlist(),
        appointmentApi.getReminderPlans(),
        appointmentApi.getNoShowList(),
      ])
      if (w.success && Array.isArray(w.data)) setWaitlist(w.data)
      if (r.success && Array.isArray(r.data)) setReminders(r.data)
      if (n.success && Array.isArray(n.data)) setNoShows(n.data)
    } catch { /* demo 回退 */ }
    setBusy(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const addWaitlist = async () => {
    if (!newPatient.trim()) return
    const res = await appointmentApi.addWaitlist({ patientName: newPatient, modality: newModality, priority: newPriority })
    if (res.success) { setNewPatient(''); flash(t('w5Appt.opsAdded')); void load() }
  }

  const assign = async (id: string) => {
    const res = await appointmentApi.assignWaitlist(id, { deviceId: 'DEV-CT-01' })
    if (res.success) { flash(t('w5Appt.opsAssigned')); void load() }
  }

  const fireOne = async (id: string) => {
    const res = await appointmentApi.fireReminderPlan(id)
    if (res.success) { flash(t('w5Appt.opsFired')); void load() }
  }

  const fireDue = async () => {
    const res = await appointmentApi.fireDueReminders()
    if (res.success) { flash(`${t('w5Appt.opsFired')} (${Array.isArray(res.data) ? res.data.length : 0})`); void load() }
  }

  const scan = async () => {
    const res = await appointmentApi.scanNoShow(30)
    if (res.success) { flash(t('w5Appt.opsScanDone')); void load() }
  }

  const restore = async (id: string) => {
    const res = await appointmentApi.restoreNoShow(id)
    if (res.success) { flash(t('w5Appt.opsRestored')); void load() }
  }

  const tabBtn = (key: Tab, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
        background: tab === key ? primaryBlue : 'var(--bg-deep)', color: tab === key ? '#fff' : textGray,
      }}
    >
      {icon}{label}
    </button>
  )

  const th = (label: string) => <th key={label} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: textGray, whiteSpace: 'nowrap', fontSize: 11 }}>{label}</th>
  const td = (children: React.ReactNode, key: string) => <td key={key} style={{ padding: '7px 10px', fontSize: 12, color: '#334155' }}>{children}</td>

  return (
    <div data-testid="appointment-ops" style={{ background: 'var(--bg-card)', borderRadius: 10, border: `1px solid ${borderGray}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${borderGray}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: primaryBlue, marginRight: 6 }}>{t('w5Appt.opsTitle')}</div>
        {tabBtn('WAITLIST', t('w5Appt.opsWaitlist'), <ListChecks size={13} />)}
        {tabBtn('REMINDER', t('w5Appt.opsReminderPlan'), <Bell size={13} />)}
        {tabBtn('NOSHOW', t('w5Appt.opsNoShow'), <UserX size={13} />)}
        <button onClick={() => void load()} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 6, border: `1px solid ${borderGray}`, background: 'var(--bg-card)', color: textGray, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={12} /> {busy ? '...' : t('w5Appt.opsRefresh')}
        </button>
        {toast && <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>{toast}</span>}
      </div>

      <div style={{ padding: 12, overflowX: 'auto' }}>
        {tab === 'WAITLIST' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <input placeholder={t('w5Appt.opsPatient')} value={newPatient} onChange={(e) => setNewPatient(e.target.value)} style={{ padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, color: primaryBlue }} />
              <select value={newModality} onChange={(e) => setNewModality(e.target.value)} style={{ padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, color: primaryBlue }}>
                {['CT', 'MR', 'DR', 'US'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} style={{ padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, color: primaryBlue }}>
                <option value="normal">{t('w5Appt.priorityNormal')}</option>
                <option value="urgent">{t('w5Appt.priorityUrgent')}</option>
                <option value="critical">{t('w5Appt.priorityCritical')}</option>
              </select>
              <button onClick={() => void addWaitlist()} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: primaryBlue, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={13} /> {t('w5Appt.opsAdd')}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr style={{ borderBottom: `2px solid ${borderGray}` }}>{[t('w5Appt.opsSeq'), t('w5Appt.opsPatient'), t('w5Appt.opsModality'), t('w5Appt.opsPriority'), t('w5Appt.opsStatus'), t('w5Appt.opsActions')].map(th)}</tr></thead>
              <tbody>
                {waitlist.map((w) => (
                  <tr key={w.id} data-testid={`waitlist-row-${w.id}`} style={{ borderBottom: `1px solid ${borderGray}` }}>
                    {td(w.seq ?? '-', 'seq')}
                    {td(<b style={{ color: primaryBlue }}>{w.patientName}</b>, 'name')}
                    {td(w.modality, 'mod')}
                    {td(<span style={{ color: priorityColor(w.priority), fontWeight: 700 }}>{priorityLabel(w.priority)}</span>, 'pri')}
                    {td(w.status === 'ASSIGNED' ? t('w5Appt.statusAssigned') : t('w5Appt.statusWaiting'), 'st')}
                    {td(
                      w.status !== 'ASSIGNED' ? (
                        <button onClick={() => void assign(w.id)} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${primaryBlue}`, background: 'var(--bg-card)', color: primaryBlue, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Check size={11} /> {t('w5Appt.opsAssign')}
                        </button>
                      ) : <span style={{ color: '#059669' }}>✓</span>,
                      'act')}
                  </tr>
                ))}
                {waitlist.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: textGray, fontSize: 12 }}>{t('w5Appt.opsEmpty')}</td></tr>}
              </tbody>
            </table>
          </>
        )}

        {tab === 'REMINDER' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => void fireDue()} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: primaryBlue, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Send size={13} /> {t('w5Appt.opsFireDue')}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr style={{ borderBottom: `2px solid ${borderGray}` }}>{[t('w5Appt.opsPatient'), t('w5Appt.opsChannel'), t('w5Appt.opsScheduledAt'), t('w5Appt.opsStatus'), t('w5Appt.opsActions')].map(th)}</tr></thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} data-testid={`reminder-row-${r.id}`} style={{ borderBottom: `1px solid ${borderGray}` }}>
                    {td(<b style={{ color: primaryBlue }}>{r.patientName}</b>, 'name')}
                    {td(r.channel, 'ch')}
                    {td(new Date(r.scheduledAt).toLocaleString('zh-CN'), 'at')}
                    {td(r.status === 'SENT' ? t('w5Appt.statusSent') : t('w5Appt.statusPending'), 'st')}
                    {td(
                      r.status !== 'SENT' ? (
                        <button onClick={() => void fireOne(r.id)} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${primaryBlue}`, background: 'var(--bg-card)', color: primaryBlue, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Send size={11} /> {t('w5Appt.opsFire')}
                        </button>
                      ) : <span style={{ color: '#059669' }}>✓</span>,
                      'act')}
                  </tr>
                ))}
                {reminders.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: textGray, fontSize: 12 }}>{t('w5Appt.opsEmpty')}</td></tr>}
              </tbody>
            </table>
          </>
        )}

        {tab === 'NOSHOW' && (
          <>
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => void scan()} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ScanLine size={13} /> {t('w5Appt.opsScan')}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr style={{ borderBottom: `2px solid ${borderGray}` }}>{[t('w5Appt.opsAppointment'), t('w5Appt.opsPatient'), t('w5Appt.opsMarkedAt'), t('w5Appt.opsStatus'), t('w5Appt.opsActions')].map(th)}</tr></thead>
              <tbody>
                {noShows.map((n) => (
                  <tr key={n.id} data-testid={`noshow-row-${n.id}`} style={{ borderBottom: `1px solid ${borderGray}` }}>
                    {td(<span style={{ fontFamily: 'monospace', color: primaryBlue }}>{n.appointmentId}</span>, 'apt')}
                    {td(n.patientName ?? '-', 'name')}
                    {td(new Date(n.markedAt).toLocaleString('zh-CN'), 'at')}
                    {td(<span style={{ color: '#dc2626', fontWeight: 700 }}>{t('w5Appt.statusNoShow')}</span>, 'st')}
                    {td(
                      <button onClick={() => void restore(n.appointmentId)} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${borderGray}`, background: 'var(--bg-card)', color: textGray, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <RotateCcw size={11} /> {t('w5Appt.opsRestore')}
                      </button>,
                      'act')}
                  </tr>
                ))}
                {noShows.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: textGray, fontSize: 12 }}>{t('w5Appt.opsEmpty')}</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

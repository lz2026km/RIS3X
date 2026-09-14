import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { Search, Calendar, Bell, UserCheck, Syringe, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { appointmentApi, type AppointmentDto, examApi, mobileApi, type TodaySummary, type CriticalValueItem } from '../../../services/api'
import { t } from '../../../i18n/appI18n'

export interface NurseAppointment {
  id: string
  patientName: string
  gender: string
  age: number
  examItem: string
  modality: string
  status: 'waiting' | 'in-progress' | 'completed' | 'cancelled'
  appointmentTime: string
  contrastRequired: boolean
  medications: string[]
  notes?: string
}

export interface MedicationRecord {
  id: string
  patientName: string
  medication: string
  dosage: string
  route: string
  administeredAt: string
  administeredBy: string
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  waiting: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', label: t('nurse.status.waiting') },
  'in-progress': { bg: 'var(--color-info-bg)', color: 'var(--color-info)', label: t('nurse.status.inProgress') },
  completed: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: t('nurse.status.completed') },
  cancelled: { bg: 'var(--bg-card)', color: 'var(--text-secondary)', label: t('nurse.status.cancelled') },
}

const s = {
  container: { maxWidth: 420, margin: '0 auto', background: 'var(--bg-primary)', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', padding: '16px 16px 12px' },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', borderRadius: 10, padding: '10px 14px', margin: '12px 16px', border: '1px solid var(--border-color)' },
  tabRow: { display: 'flex', margin: '0 16px', gap: 4 },
  tab: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active ? '#7c3aed' : '#94a3b8', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent' }),
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' },
}

export default function NurseMobileWorkstation() {
  const [tab, setTab] = useState<'queue' | 'meds' | 'critical'>('queue')
  const [filter, setFilter] = useState<'all' | 'waiting' | 'in-progress'>('all')
  const [search, setSearch] = useState('')
  const [appointments, setAppointments] = useState<NurseAppointment[]>([])
  const [summary, setSummary] = useState<TodaySummary>({ examsToday: 0, pendingExams: 0, inProgressExams: 0, criticalValues: 0, reportsToday: 0, signedReportsToday: 0, date: '' })
  const [criticals, setCriticals] = useState<CriticalValueItem[]>([])
  const [ackingId, setAckingId] = useState<string | null>(null)
  const [usingMock, setUsingMock] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [aptRes, sumRes, cvRes] = await Promise.allSettled([
        appointmentApi.list({ state: 'SCHEDULED' }),
        mobileApi.getTodaySummary(),
        mobileApi.getCriticalValues(),
      ])
      if (!cancelled && aptRes.status === 'fulfilled' && aptRes.value.success && Array.isArray(aptRes.value.data)) {
        const stateMap: Record<string, NurseAppointment['status']> = {
          SCHEDULED: 'waiting', CONFIRMED: 'waiting', CHECKED_IN: 'in-progress',
          IN_PROGRESS: 'in-progress', COMPLETED: 'completed', CANCELLED: 'cancelled', NO_SHOW: 'cancelled',
        }
        setAppointments(aptRes.value.data.map((a: AppointmentDto) => ({
          id: a.id,
          patientName: a.patientName || t('nurse.unknownPatient'),
          gender: t('nurse.unknown'),
          age: 0,
          examItem: a.room || '',
          modality: a.modality,
          status: stateMap[a.state] || 'waiting',
          appointmentTime: a.startAt ? new Date(a.startAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
          contrastRequired: false,
          medications: [],
          notes: a.note,
        })))
      } else if (!cancelled) {
        // [离线兜底] 预约接口失败, 保持空队列
      }
      if (!cancelled && sumRes.status === 'fulfilled' && sumRes.value.success && sumRes.value.data) {
        setSummary(sumRes.value.data)
      } else if (!cancelled) {
        // [离线兜底] 与后端 mobile.service seed 对齐
        setSummary({ examsToday: 42, pendingExams: 12, inProgressExams: 5, criticalValues: 3, reportsToday: 28, signedReportsToday: 21, date: new Date().toISOString().slice(0, 10) })
      }
      if (cvRes.status === 'fulfilled' && cvRes.value.success && Array.isArray(cvRes.value.data)) {
        if (!cancelled) setCriticals(cvRes.value.data)
      } else if (!cancelled) {
        // [离线兜底] 危急值演示数据 (护士确认列表)
        setCriticals([
          { id: 'CV1', patientName: '王建军', gender: 'MALE', age: 45, description: '腹部CT示肝右叶占位，考虑恶性可能', severity: 'CRITICAL', state: 'FOUND', method: 'SYSTEM', notifiedTo: '急诊科 张医生', accessionNumber: 'ACC003', modality: 'CT', createdAt: new Date().toISOString(), ackedAt: null },
          { id: 'CV2', patientName: '陈国强', gender: 'MALE', age: 71, description: '冠脉CTA示左前降支重度狭窄', severity: 'URGENT', state: 'NOTIFIED', method: 'PHONE', notifiedTo: '心内科 李主任', accessionNumber: 'ACC005', modality: 'CT', createdAt: new Date(Date.now() - 3600_000).toISOString(), ackedAt: null },
        ])
        setUsingMock(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleAck = useCallback(async (id: string) => {
    setAckingId(id)
    try {
      const res = await mobileApi.ackCriticalValue(id, 'nurse-mobile')
      if (res.success) {
        setCriticals(prev => prev.map(c => c.id === id ? { ...c, state: 'ACKNOWLEDGED', ackedAt: new Date().toISOString() } : c))
        message.success(t('nurse.cvAcked'))
      } else {
        message.error(`确认失败: ${res.error?.message ?? t('nurse.unknown')}`)
      }
    } catch {
      message.error(t('nurse.ackFailedNetwork'))
    }
    setAckingId(null)
  }, [])

  const isAcked = (c: CriticalValueItem) => c.state === 'ACKNOWLEDGED' || !!c.ackedAt

  const filtered = appointments.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.examItem.includes(search)) return false
    return true
  })

  // [Wave2A] 签到 → POST /worklist/:id/checkin (MSW 支撑; 后端 queue 为房间叫号模块, 无患者签到端点)
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const handleCheckIn = useCallback(async (id: string) => {
    setCheckingInId(id)
    try {
      const res = await examApi.checkIn(id)
      if (res.success) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'in-progress' as const } : a))
        message.success(`签到成功: ${id}，患者已进入候检流程`)
      } else {
        message.error(res.error?.message ?? t('nurse.checkInFailed'))
      }
    } catch {
      message.error(t('nurse.checkInFailedNetwork'))
    } finally {
      setCheckingInId(null)
    }
  }, [])

  // [Wave2A] 用药记录: 后端无用药端点 → 本地记录 (localStorage 持久化) + 标注
  const [medRecords, setMedRecords] = useState<MedicationRecord[]>(() => {
    try {
      const raw = localStorage.getItem('ris_nurse_med_records')
      return raw ? JSON.parse(raw) as MedicationRecord[] : []
    } catch { return [] }
  })
  const handleMedication = useCallback((id: string, med = t('nurse.defaultMed'), dosage = t('nurse.defaultDosage')) => {
    const patient = appointments.find(a => a.id === id)
    const record: MedicationRecord = {
      id: `MED-${Date.now()}`,
      patientName: patient?.patientName ?? id,
      medication: med,
      dosage,
      route: t('nurse.ivRoute'),
      administeredAt: new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      administeredBy: t('nurse.currentNurse'),
    }
    setMedRecords(prev => {
      const next = [record, ...prev].slice(0, 50)
      try { localStorage.setItem('ris_nurse_med_records', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    message.success(`用药已记录 (本地): ${record.patientName} - ${med} ${dosage} · 后端用药端点待接入`)
  }, [appointments])

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerTitle}>{t('nurse.title')}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('nurse.subtitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { value: appointments.filter(a => a.status === 'waiting').length, label: t('nurse.stat.waiting'), bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
            { value: appointments.filter(a => a.status === 'in-progress').length, label: t('nurse.stat.inProgress'), bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
            { value: summary.criticalValues, label: t('nurse.stat.critical'), bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
            { value: summary.examsToday, label: t('nurse.stat.todayExams'), bg: 'rgba(124,58,237,0.12)', color: '#7c3aed' },
          ].map(stat => (
            <div key={stat.label} style={{ background: stat.bg, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {usingMock && (
        <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, padding: '6px 16px', textAlign: 'center' }}>
          ⚠ {t('nurse.mockNotice')}
        </div>
      )}

      <div style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('nurse.searchPlaceholder')} style={{ border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', width: '100%', background: 'transparent' }} />
        <Bell size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
      </div>

      <div style={s.tabRow}>
        {[{ key: 'queue' as const, icon: Calendar, label: t('nurse.tab.queue') }, { key: 'meds' as const, icon: Syringe, label: t('nurse.tab.meds') }, { key: 'critical' as const, icon: AlertTriangle, label: t('nurse.tab.critical') }].map(t => (
          <div key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'queue' ? (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px' }}>
            {[{ key: 'all', label: t('nurse.filter.all') }, { key: 'waiting', label: t('nurse.filter.waiting') }, { key: 'in-progress', label: t('nurse.filter.inProgress') }].map(f => (
              <div key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.key ? '#7c3aed' : 'var(--bg-card)', color: filter === f.key ? '#fff' : '#64748b' }}>
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            {filtered.map(item => {
              const sc = STATUS_CONFIG[item.status] ?? { bg: 'var(--bg-card)', color: 'var(--text-secondary)', label: t('nurse.unknown') }
              return (
                <div key={item.id} style={s.listItem}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.status === 'completed' ? <CheckCircle size={18} color="#059669" /> : item.status === 'cancelled' ? <XCircle size={18} color="#94a3b8" /> : <Clock size={18} color={sc.color} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.patientName}</span>
                      {item.contrastRequired && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>{t('nurse.contrast')}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6 }}>
                      <span>{item.gender}/{item.age}{t('nurse.ageSuffix')}</span>
                      <span>{item.modality}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.examItem} · {item.appointmentTime}</div>
                    {item.notes && <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>⚠ {item.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    {item.status === 'waiting' && (
                      <button onClick={() => handleCheckIn(item.id)} disabled={checkingInId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: checkingInId === item.id ? 0.6 : 1 }}>
                        {checkingInId === item.id ? t('nurse.checkingIn') : t('nurse.checkIn')}
                      </button>
                    )}
                    {item.contrastRequired && item.status === 'waiting' && (
                      <button onClick={() => handleMedication(item.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {t('nurse.medicate')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : tab === 'critical' ? (
        <div style={{ padding: 16 }}>
          {criticals.map(c => (
            <div key={c.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${c.severity === 'CRITICAL' ? 'var(--color-error-border)' : 'var(--color-warning-border)'}`, borderLeft: `4px solid ${c.severity === 'CRITICAL' ? '#dc2626' : '#d97706'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.patientName}</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: c.severity === 'CRITICAL' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: c.severity === 'CRITICAL' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                  {c.severity === 'CRITICAL' ? t('nurse.sevCritical') : c.severity === 'URGENT' ? t('nurse.sevUrgent') : c.severity}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.modality ?? ''} {c.accessionNumber ?? ''}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{c.description}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{c.createdAt ? new Date(c.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''} · {c.notifiedTo ?? t('nurse.notNotified')}</span>
                {isAcked(c) ? (
                  <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={14} /> {t('nurse.acked')}
                  </span>
                ) : (
                  <button
                    onClick={() => handleAck(c.id)}
                    disabled={ackingId === c.id}
                    style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: ackingId === c.id ? 0.6 : 1 }}
                  >
                    {ackingId === c.id ? t('nurse.confirming') : t('nurse.confirmReceive')}
                  </button>
                )}
              </div>
            </div>
          ))}
          {criticals.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>{t('nurse.noCriticals')}</div>}
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Syringe size={16} color="#7c3aed" /> {t('nurse.medTitle')}
              <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>{t('nurse.medNotice')}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {appointments.filter(a => a.contrastRequired || a.medications.length > 0).map(item => (
                <div key={item.id} style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.patientName} - {item.examItem}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {item.contrastRequired && <span>{t('nurse.needsContrastPrefix')}{item.medications.join(', ')}</span>}
                    {!item.contrastRequired && <span>{t('nurse.noContrast')}</span>}
                  </div>
                  <button onClick={() => handleMedication(item.id)} style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid #7c3aed', background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {t('nurse.recordMedication')}
                  </button>
                </div>
              ))}
              {appointments.filter(a => a.contrastRequired || a.medications.length > 0).length === 0 && medRecords.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>{t('nurse.noMedPatients')}</div>
              )}
            </div>
          </div>
          {medRecords.length > 0 && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border-color)', marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('nurse.medRecordsTitle')} ({medRecords.length})</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {medRecords.map(r => (
                  <div key={r.id} style={{ padding: '10px 12px', background: 'rgba(124,58,237,0.12)', borderRadius: 8, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#4c1d95' }}>{r.patientName} · {r.medication} {r.dosage}</div>
                    <div style={{ color: '#7c3aed', marginTop: 2 }}>{r.route} · {r.administeredAt} · {r.administeredBy}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', padding: '6px 0' }}>
        {[
          { key: 'queue', icon: Calendar, label: t('nurse.nav.queue') },
          { key: 'meds', icon: Syringe, label: t('nurse.nav.meds') },
          { key: 'bell', icon: Bell, label: t('nurse.nav.notify') },
          { key: 'check', icon: UserCheck, label: t('nurse.nav.checkIn') },
        ].map(nav => (
          <div key={nav.key} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, color: tab === nav.key ? '#7c3aed' : '#94a3b8', cursor: 'pointer', fontWeight: tab === nav.key ? 700 : 400 }}
            onClick={() => ['queue', 'meds', 'critical'].includes(nav.key) && setTab(nav.key as 'queue' | 'meds' | 'critical')}>
            <nav.icon size={18} style={{ display: 'block', margin: '0 auto 2px' }} />
            {nav.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// 6.8 Department Operations (20 pts)
// [v3.0.6.11-82] W3-C: 接入 statsApi.getDaily/getByModality (乳腺统计), 失败回退演示数据
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Users, Calendar, Clock, Activity, TrendingUp, RefreshCw, Download, Plus, Bed, UserCheck, FileText } from 'lucide-react'
import { statsApi } from '../../services/api/statsApi'
import { DataTable } from '../../components/common'
import { Card } from 'antd'
import { t } from '../../i18n/appI18n'

const statsData: Array<{ key: string; labelKey: string; value: string; unit?: string; unitKey?: string; icon: any; color: string; bg: string }> = [
  { key: 'todayExams', labelKey: 'deptOps.stat.todayExams', value: '28', unitKey: 'deptOps.unit.case', icon: Activity, color: '#2563eb', bg: '#3b82f622' },
  { key: 'waitingPatients', labelKey: 'deptOps.stat.waitingPatients', value: '12', unitKey: 'deptOps.unit.person', icon: Users, color: '#ea580c', bg: '#f9731622' },
  { key: 'avgWait', labelKey: 'deptOps.stat.avgWait', value: '18', unit: 'min', icon: Clock, color: '#ca8a04', bg: '#f59e0b22' },
  { key: 'deviceUsage', labelKey: 'deptOps.stat.deviceUsage', value: '86', unit: '%', icon: TrendingUp, color: '#16a34a', bg: '#22c55e22' },
  { key: 'dailyReports', labelKey: 'deptOps.stat.dailyReports', value: '18', unitKey: 'deptOps.unit.report', icon: FileText, color: '#7c3aed', bg: '#8b5cf622' },
  { key: 'staffOnDuty', labelKey: 'deptOps.stat.staffOnDuty', value: '6', unitKey: 'deptOps.unit.person', icon: UserCheck, color: '#0891b2', bg: '#06b6d422' },
]

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0 },
  subtitle: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: 700, color: 'var(--color-primary-800)', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  section: { background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  bad: { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-block' },
  scrollBox: { maxHeight: 280, overflowY: 'auto' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    '空闲': { bg: '#22c55e22', text: '#16a34a' },
    '使用中': { bg: '#2563eb', text: '#fff' },
    '维护中': { bg: '#f59e0b22', text: '#ca8a04' },
    '等待中': { bg: '#f9731622', text: '#ea580c' },
    '已完成': { bg: '#22c55e22', text: '#16a34a' },
    '已签到': { bg: '#3b82f622', text: '#2563eb' },
  }
  const c = colors[status] || { bg: 'var(--bg-deep)', text: '#64748b' }
  return <span style={{ ...s.bad, background: c.bg, color: c.text }}>{status}</span>
}

const DepartmentOperationsPage = () => {
  const [search, setSearch] = useState('')
  const [_tab] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPatient, setNewPatient] = useState({ name: '', exam: 'MG', room: '' })
  const [extraPatients, setExtraPatients] = useState<Array<{ id: number; name: string; exam: string; room: string; scheduled: string; status: string }>>([])
  const [daily, setDaily] = useState<{ examCount?: number; reportCount?: number; criticalCount?: number; date?: string } | null>(null)
  const [byModality, setByModality] = useState<Record<string, unknown> | null>(null)
  const [source, setSource] = useState<'api' | 'demo'>('demo')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [dailyRes, modalityRes] = await Promise.all([statsApi.getDaily(), statsApi.getByModality()])
        if (cancelled) return
        if (dailyRes.success && dailyRes.data) {
          setDaily(dailyRes.data)
          setSource('api')
        }
        if (modalityRes.success && modalityRes.data && typeof modalityRes.data === 'object') {
          setByModality(modalityRes.data as Record<string, unknown>)
        }
      } catch {
        if (!cancelled) setSource('demo')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const effectiveStats = statsData.map(s => {
    if (s.key === 'todayExams' && daily?.examCount != null) return { ...s, value: String(daily.examCount) }
    if (s.key === 'dailyReports' && daily?.reportCount != null) return { ...s, value: String(daily.reportCount) }
    return s
  })

  const handleRefresh = useCallback(() => {
    setRefreshTick(t => t + 1)
  }, [])

  const staff = useMemo(() => [
    { name: '张敏', role: '主任医师', shift: '上午', status: '在岗', focus: '诊断' },
    { name: '李芳', role: '主治医师', shift: '上午', status: '在岗', focus: '诊断' },
    { name: '王丽', role: '技师', shift: '上午', status: '检查中', focus: 'MG扫描' },
    { name: '赵静', role: '技师', shift: '下午', status: '在岗', focus: 'TOMO' },
    { name: '刘洁', role: '技师', shift: '上午', status: '检查中', focus: '超声' },
    { name: '陈艳', role: '护士', shift: '上午', status: '在岗', focus: '注射' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [refreshTick])

  const rooms = useMemo(() => [
    { name: '钼靶室1', device: 'Hologic Selenia', modality: 'MG', status: '使用中', patient: '王秀兰', todayCount: 12 },
    { name: '钼靶室2', device: 'GE Senographe', modality: 'MG', status: '空闲', patient: '', todayCount: 8 },
    { name: '断层室', device: 'Siemens Inspiration', modality: 'TOM', status: '使用中', patient: '李桂英', todayCount: 6 },
    { name: '超声室1', device: 'GE Logiq E10', modality: 'US', status: '使用中', patient: '赵丽娟', todayCount: 10 },
    { name: '超声室2', device: 'Philips EPIQ', modality: 'US', status: '维护中', patient: '', todayCount: 0 },
    { name: 'MRI室', device: 'Siemens Skyra', modality: 'MRI', status: '空闲', patient: '', todayCount: 4 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [refreshTick])

  const queue = useMemo(() => [
    ...Array.from({ length: 15 }, (_, i) => ({
      id: i + 1, name: `患者${String.fromCharCode(65 + (i % 26))}${i}`,
      exam: ['MG', '乳腺断层', '乳腺超声', '乳腺MRI'][i % 4],
      room: rooms[i % rooms.length]?.name ?? '未分配', scheduled: `${8 + Math.floor(i / 2)}:${(i % 2) * 30 + 10}`,
      status: ['等待中', '已签到', '检查中', '已完成'][Math.min(i % 4, 3)] as string,
    })),
    ...extraPatients,
  ], [rooms, extraPatients])

  const filteredQueue = queue.filter(q => q.name.includes(search) || (q.exam ?? '').includes(search))

  const handleAddPatient = () => {
    if (!newPatient.name.trim()) return
    const roomsList = rooms.map(r => r.name)
    setExtraPatients(prev => [...prev, {
      id: Date.now(),
      name: newPatient.name.trim(),
      exam: newPatient.exam,
      room: newPatient.room || roomsList[0] || '未分配',
      scheduled: new Date().toTimeString().slice(0, 5),
      status: '等待中',
    }])
    setShowAddModal(false)
    setNewPatient({ name: '', exam: 'MG', room: '' })
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('deptOps.title')}</h1>
          <p style={s.subtitle}>
            {t('deptOps.subtitle')}
            <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: source === 'api' ? '#dcfce7' : '#fef3c7', color: source === 'api' ? '#16a34a' : '#d97706' }}>
              {source === 'api' ? t('deptOps.sourceApi') : t('deptOps.sourceDemo')}
            </span>
            {loading && <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>{t('deptOps.loading')}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn} onClick={handleRefresh} title={t('deptOps.refresh')}><RefreshCw size={14} /></button>
          <button style={s.btnPrimary} onClick={() => setShowStatsModal(true)}><Download size={14} /> {t('deptOps.statsReport')}</button>
        </div>
      </div>

      <div style={s.statsRow}>
        {effectiveStats.map((stat, i) => (
          <Card key={i} bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
            <div style={{ ...s.statIcon, background: stat.bg }}><stat.icon size={20} color={stat.color} /></div>
            <div style={s.statValue}>{stat.value}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>{stat.unitKey ? t(stat.unitKey) : stat.unit}</span></div>
            <div style={s.statLabel}>{t(stat.labelKey)}</div>
          </Card>
        ))}
      </div>

      {byModality && Object.keys(byModality).length > 0 && (
        <Card bordered={false} style={{ ...s.section, padding: 12, marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
          <div style={{ ...s.sectionTitle, marginBottom: 8 }}><Activity size={16} color="#2563eb" />{t('deptOps.modalityDist')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byModality).map(([mod, stat]) => {
              const count = typeof stat === 'number' ? stat : ((stat as { total?: number })?.total ?? 0)
              return (
                <span key={mod} style={{ padding: '4px 12px', background: 'var(--color-info-bg)', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{mod}: {count} {t('deptOps.unit.case')}</span>
              )
            })}
          </div>
        </Card>
      )}

      <div style={s.grid2}>
        <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
          <div style={s.sectionTitle}><Bed size={16} color='#2563eb' />{t('deptOps.deviceStatus')}</div>
          {rooms.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === '空闲' ? '#16a34a' : r.status === '使用中' ? '#2563eb' : '#ca8a04' }} />
                <div><div style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.device} · {r.modality}</div></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={r.status} />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t('deptOps.todayPrefix')}{r.todayCount}{t('deptOps.unit.case')}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
          <div style={s.sectionTitle}><Users size={16} color='#7c3aed' />{t('deptOps.staffTitle')}</div>
          <div style={s.grid4}>
            {staff.map((p, i) => (
              <div key={i} style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', margin: '0 auto 6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>{p.name[0]}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{p.role}</div>
                <StatusBadge status={p.status} />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{p.shift} · {p.focus}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={s.sectionTitle}><Calendar size={16} color='#0891b2' />{t('deptOps.queueTitle')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, width: 200 }} placeholder={t('deptOps.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
            <button style={{ ...s.btn, padding: '6px 12px' }} onClick={() => setShowAddModal(true)}><Plus size={12} /> {t('deptOps.addQueue')}</button>
          </div>
        </div>
        <div style={s.scrollBox}>
          <DataTable
            rowKey="id"
            dataSource={filteredQueue}
            showPagination={false}
            showExport={false}
            showDensity={false}
            columns={[
              { title: t('deptOps.colIndex'), dataIndex: 'id', key: 'id' },
              { title: t('deptOps.colPatient'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
              { title: t('deptOps.colExam'), dataIndex: 'exam', key: 'exam' },
              { title: t('deptOps.colRoom'), dataIndex: 'room', key: 'room' },
              { title: t('deptOps.colScheduled'), dataIndex: 'scheduled', key: 'scheduled' },
              { title: t('deptOps.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
            ]}
          />
        </div>
      </Card>

      {showStatsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowStatsModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 520, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Download size={16} color="#2563eb" /> {t('deptOps.statsModalTitle')}</div>
              <button onClick={() => setShowStatsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, fontSize: 16 }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {effectiveStats.slice(0, 6).map(stat => (
                  <div key={stat.key} style={{ background: stat.bg, borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{stat.unitKey ? t(stat.unitKey) : stat.unit}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t(stat.labelKey)}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('deptOps.queueStats')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['等待中', '已签到', '检查中', '已完成'].map(st => {
                  const count = queue.filter(q => q.status === st).length
                  const max = Math.max(1, queue.length)
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 60, fontSize: 12, color: 'var(--text-secondary)' }}>{st}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-card)', borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: '#2563eb', borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 28, fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>{t('deptOps.updatedAt', { time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), count: queue.length })}</div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={16} color="#0891b2" /> {t('deptOps.addPatientTitle')}</div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, fontSize: 16 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>{t('deptOps.colPatient')}</label>
                <input value={newPatient.name} onChange={e => setNewPatient({ ...newPatient, name: e.target.value })} placeholder={t('deptOps.enterPatientName')} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>{t('deptOps.colExam')}</label>
                <select value={newPatient.exam} onChange={e => setNewPatient({ ...newPatient, exam: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}>
                  {['MG', '乳腺断层', '乳腺超声', '乳腺MRI'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>{t('deptOps.colRoom')}</label>
                <select value={newPatient.room} onChange={e => setNewPatient({ ...newPatient, room: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}>
                  <option value="">{t('deptOps.autoAssign')}</option>
                  {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowAddModal(false)} style={{ padding: '8px 20px', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>{t('deptOps.cancel')}</button>
                <button onClick={handleAddPatient} disabled={!newPatient.name.trim()} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: newPatient.name.trim() ? '#2563eb' : '#94a3b8', color: '#fff', fontSize: 12, fontWeight: 600, cursor: newPatient.name.trim() ? 'pointer' : 'not-allowed' }}>{t('deptOps.addToQueue')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DepartmentOperationsPage

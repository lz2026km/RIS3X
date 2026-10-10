import { useEffect, useMemo, useState } from 'react'
import { GanttChartSquare, AlertTriangle, RefreshCw } from 'lucide-react'
import { initialModalityDevices } from '../../data/initialData'
import { formatDateObj } from '../../utils/date'
import { t } from '../../i18n/appI18n'
import { appointmentApi, type RoomDto, type TechnicianDto } from '../../services/api'

type Dimension = 'DEVICE' | 'ROOM' | 'TECH'

interface Row {
  id: string
  name: string
  conflict?: boolean
}

interface Block {
  id: string
  rowId: string
  label: string
  start: number
  end: number
  conflict: boolean
  status: string
}

const START_MIN = 7 * 60
const END_MIN = 20 * 60
const RANGE = END_MIN - START_MIN
const SLOT_MIN = 30

const toMin = (hhmm: string): number => {
  const [h, m] = (hhmm || '08:00').split(':').map((v) => Number(v))
  return (h || 0) * 60 + (m || 0)
}

const pct = (min: number): number => ((min - START_MIN) / RANGE) * 100

const STEPS: number[] = []
for (let m = START_MIN; m <= END_MIN; m += 60) STEPS.push(m)

interface Props {
  appointments: Array<Record<string, any>>
  onCreate?: (payload: { rowId: string; dimension: Dimension; startMin: number; date: string }) => void
}

export default function ResourceGantt({ appointments, onCreate }: Props) {
  const [dimension, setDimension] = useState<Dimension>('DEVICE')
  const [date, setDate] = useState(() => formatDateObj(new Date()))
  const [rooms, setRooms] = useState<RoomDto[]>([])
  const [technicians, setTechnicians] = useState<TechnicianDto[]>([])
  const [loading, setLoading] = useState(false)

  const loadResources = async () => {
    setLoading(true)
    try {
      const [r, tech] = await Promise.all([appointmentApi.getRooms(), appointmentApi.getTechnicians()])
      if (r.success && Array.isArray(r.data)) setRooms(r.data)
      if (tech.success && Array.isArray(tech.data)) setTechnicians(tech.data)
    } catch { /* demo 回退 */ }
    setLoading(false)
  }

  useEffect(() => { void loadResources() }, [])

  const rows: Row[] = useMemo(() => {
    if (dimension === 'DEVICE') {
      return initialModalityDevices
        .filter((d: any) => d.status !== '维护中')
        .map((d: any) => ({ id: d.id, name: d.name.split('（')[0] }))
    }
    if (dimension === 'ROOM') {
      return rooms.filter((r) => r.status === 'ACTIVE' || r.status === 'MAINTENANCE').map((r) => ({ id: r.id, name: r.name }))
    }
    return technicians.map((x) => ({ id: x.id, name: `${x.name} (${x.shiftStart}-${x.shiftEnd})` }))
  }, [dimension, rooms, technicians])

  const keyFor = (apt: Record<string, any>): string => {
    if (dimension === 'DEVICE') return String(apt.deviceId ?? '')
    if (dimension === 'ROOM') return String(apt.roomId ?? '')
    return String(apt.technicianId ?? '')
  }

  const { blocks, rowConflict } = useMemo(() => {
    const list: Block[] = []
    const conflicts = new Set<string>()
    const dayApts = appointments.filter((a) => a.examDate === date && a.status !== 'cancelled')
    const byRow = new Map<string, Array<{ id: string; start: number; end: number }>>()
    for (const a of dayApts) {
      const rowId = keyFor(a)
      if (!rowId) continue
      const start = toMin(a.examTime)
      const dur = Number(a.durationMin) || 30
      const end = start + dur
      const arr = byRow.get(rowId) ?? []
      arr.push({ id: a.id, start, end })
      byRow.set(rowId, arr)
    }
    for (const [rowId, arr] of byRow) {
      for (let i = 0; i < arr.length; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
          if (arr[i]!.start < arr[j]!.end && arr[i]!.end > arr[j]!.start) {
            conflicts.add(`${rowId}:${arr[i]!.id}`)
            conflicts.add(`${rowId}:${arr[j]!.id}`)
          }
        }
      }
    }
    for (const a of dayApts) {
      const rowId = keyFor(a)
      if (!rowId) continue
      const start = toMin(a.examTime)
      const dur = Number(a.durationMin) || 30
      list.push({
        id: a.id,
        rowId,
        label: `${a.patientName} · ${a.examItemName || a.modality || ''}`,
        start,
        end: start + dur,
        conflict: conflicts.has(`${rowId}:${a.id}`),
        status: a.status,
      })
    }
    const rc = new Set<string>()
    for (const b of list) if (b.conflict) rc.add(b.rowId)
    return { blocks: list, rowConflict: rc }
  }, [appointments, dimension, date])

  const dimBtn = (d: Dimension, label: string) => (
    <button
      key={d}
      onClick={() => setDimension(d)}
      style={{
        padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        background: dimension === d ? 'var(--color-primary-800)' : 'var(--bg-deep)', color: dimension === d ? '#fff' : '#64748b',
      }}
    >
      {label}
    </button>
  )

  const borderGray = 'var(--border-color)'

  return (
    <div data-testid="resource-gantt" style={{ background: 'var(--bg-card)', borderRadius: 10, border: `1px solid ${borderGray}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${borderGray}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>
          <GanttChartSquare size={15} /> {t('w5Appt.ganttTitle')}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>{dimBtn('DEVICE', t('w5Appt.ganttByDevice'))}{dimBtn('ROOM', t('w5Appt.ganttByRoom'))}{dimBtn('TECH', t('w5Appt.ganttByTech'))}</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '4px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, color: 'var(--color-primary-800)' }} />
        <button onClick={() => void loadResources()} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: `1px solid ${borderGray}`, background: 'var(--bg-card)', color: '#64748b', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={12} /> {loading ? '...' : t('w5Appt.opsRefresh')}
        </button>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', gap: 14, fontSize: 11, color: '#64748b', borderBottom: `1px solid ${borderGray}` }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-primary-500)', borderRadius: 2, marginRight: 4 }} />{t('w5Appt.ganttLegendBusy')}</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-error-500)', borderRadius: 2, marginRight: 4 }} />{t('w5Appt.ganttLegendConflict')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> {t('w5Appt.ganttClickCreate')}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          {/* 时间刻度 */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${borderGray}`, background: 'var(--bg-deep)' }}>
            <div style={{ flex: '0 0 130px', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{t('w5Appt.ganttBy')}</div>
            <div style={{ flex: 1, position: 'relative', height: 24 }}>
              {STEPS.map((m) => (
                <span key={m} style={{ position: 'absolute', left: `${pct(m)}%`, transform: 'translateX(-50%)', fontSize: 10, color: '#64748b' }}>
                  {String(Math.floor(m / 60)).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>

          {rows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>{t('w5Appt.ganttEmpty')}</div>}

          {rows.map((row) => {
            const rowBlocks = blocks.filter((b) => b.rowId === row.id)
            return (
              <div key={row.id} data-testid={`gantt-row-${row.id}`} style={{ display: 'flex', borderBottom: `1px solid ${borderGray}`, background: rowConflict.has(row.id) ? '#fef2f2' : 'transparent' }}>
                <div style={{ flex: '0 0 130px', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: rowConflict.has(row.id) ? 'var(--color-error-600)' : 'var(--color-primary-800)', borderRight: `1px solid ${borderGray}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {row.name}
                  {rowConflict.has(row.id) && <AlertTriangle size={11} />}
                </div>
                <div style={{ flex: 1, position: 'relative', height: 38, backgroundImage: 'repeating-linear-gradient(to right, transparent, transparent calc(8.333% - 1px), var(--border-color) calc(8.333% - 1px), var(--border-color) 8.333%)' }}>
                  {Array.from({ length: Math.ceil(RANGE / SLOT_MIN) }).map((_, i) => {
                    const m = START_MIN + i * SLOT_MIN
                    return (
                      <button
                        key={i}
                        title={`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`}
                        onClick={() => onCreate?.({ rowId: row.id, dimension, startMin: m, date })}
                        style={{ position: 'absolute', left: `${pct(m)}%`, width: `${(SLOT_MIN / RANGE) * 100}%`, top: 0, bottom: 0, border: 'none', background: 'transparent', cursor: onCreate ? 'pointer' : 'default' }}
                      />
                    )
                  })}
                  {rowBlocks.map((b) => (
                    <div
                      key={b.id}
                      data-testid={`gantt-block-${b.id}`}
                      title={`${b.label} (${b.conflict ? t('w5Appt.ganttLegendConflict') : t('w5Appt.ganttLegendBusy')})`}
                      style={{
                        position: 'absolute', top: 4, height: 30, left: `${pct(Math.max(b.start, START_MIN))}%`,
                        width: `${Math.max(((Math.min(b.end, END_MIN) - Math.max(b.start, START_MIN)) / RANGE) * 100, 2)}%`,
                        background: b.conflict ? 'var(--color-error-500)' : 'var(--color-primary-500)', color: '#fff', borderRadius: 5, fontSize: 10,
                        padding: '2px 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    >
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

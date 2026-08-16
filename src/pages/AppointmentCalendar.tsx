import type { Dispatch, SetStateAction } from 'react'
import { ChevronLeft, ChevronRight, Filter, Search, CalendarDays, List, Bell } from 'lucide-react'
import { initialModalityDevices } from '../data/initialData'

const primaryBlue = '#1e40af'
const textGray = '#64748b'
const borderGray = '#cbd5e1'
const whiteBg = 'var(--bg-card)'
const lightBlue = '#e8f0f8'

interface Appointment {
  id: string; patientName: string; examItemName: string; examDate: string; examTime: string
  deviceId: string; roomId: string; status: string; priority: string; gender: string; age: number
  modality: string; bodyPart: string; deviceName: string; roomName: string; patientInitials: string
  patientId: string; idCard: string; phone: string; examItemId: string
  referringDoctorId: string; referringDoctorName: string; clinicalDiagnosis: string
  notes: string; cancelReason?: string; createdAt: string; updatedAt: string
}

interface Props {
  viewMode: string
  // [v3.0.6.11-103 Wave 10] 重复页合并: AppointmentPage 增加 "management" 视图 (嵌入 AppointmentManagementPage)
  setViewMode: Dispatch<SetStateAction<"calendar" | "list" | "reminders" | "management">>
  calendarSubView: string
  setCalendarSubView: (v: 'day' | 'week' | 'month') => void
  weekDates: Date[]
  setCurrentWeekStart: (d: Date) => void
  currentWeekStart: Date
  selectedDevice: string
  setSelectedDevice: (v: string) => void
  searchKeyword: string
  setSearchKeyword: (v: string) => void
  appointments: Appointment[]
  getStatusConfig: (status: string) => { label: string; bg: string; color: string }
  formatDate: (d: Date) => string
  formatDateCht: (d: Date) => string
  timeSlots: string[]
  openDetail: (apt: any) => void
  showWaitlist: boolean
  setShowWaitlist: (v: boolean) => void
  filteredAppointments: Appointment[]
  filteredListAppointments: Appointment[]
  statsData: { label: string; value: number; color: string; bg: string }[]
}

export default function AppointmentCalendar(props: Props) {
  const { viewMode, setViewMode, calendarSubView, setCalendarSubView, weekDates, setCurrentWeekStart, currentWeekStart, selectedDevice, setSelectedDevice, searchKeyword, setSearchKeyword, appointments, getStatusConfig, formatDate, formatDateCht, timeSlots, openDetail, showWaitlist, setShowWaitlist, filteredListAppointments, statsData } = props

  return (
    <>
      {statsData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
          {statsData.map(stat => (
            <div key={stat.label} style={{ background: whiteBg, borderRadius: 8, padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: `1px solid ${borderGray}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: textGray, marginTop: 3 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: whiteBg, borderRadius: 10, padding: '12px 16px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 6, padding: 1 }}>
            {(['calendar', 'list', 'reminders'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '6px 12px', background: viewMode === mode ? whiteBg : 'transparent', color: viewMode === mode ? primaryBlue : textGray, border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {mode === 'calendar' ? <CalendarDays size={13} /> : mode === 'list' ? <List size={13} /> : <Bell size={13} />}
                {mode === 'calendar' ? '日历' : mode === 'list' ? '列表' : '提醒'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setShowWaitlist(!showWaitlist)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: showWaitlist ? lightBlue : 'transparent', color: primaryBlue, display: 'flex', alignItems: 'center', gap: 4 }}>等候名单</button>
          </div>
          {viewMode === 'calendar' && (
            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 6, padding: 1 }}>
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setCalendarSubView(v)} style={{ padding: '3px 10px', background: calendarSubView === v ? whiteBg : 'transparent', color: calendarSubView === v ? primaryBlue : textGray, border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{v === 'day' ? '日' : v === 'week' ? '周' : '月'}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} style={{ color: textGray }} />
            <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} style={{ padding: '5px 10px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, color: primaryBlue, background: whiteBg, cursor: 'pointer', outline: 'none' }}>
              <option value="all">全部设备</option>
              {initialModalityDevices.filter((d: any) => d.status !== '维护中').map((d: any) => <option key={d.id} value={d.id}>{d.name.split('（')[0]} · {d.modality}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: `1px solid ${borderGray}`, borderRadius: 6, padding: '4px 10px' }}>
            <Search size={13} style={{ color: textGray }} />
            <input type="text" placeholder="搜索患者/电话/项目…" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: primaryBlue, width: 140 }} />
          </div>
        </div>
      </div>

      {viewMode === 'calendar' && calendarSubView === 'week' && (
        <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: lightBlue }}>
            <button onClick={() => { const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); setCurrentWeekStart(d) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: primaryBlue }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, fontWeight: 700, color: primaryBlue }}>{formatDateCht(weekDates[0]!)} - {formatDateCht(weekDates[6]!)}</span>
            <button onClick={() => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + 7); setCurrentWeekStart(d) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: primaryBlue }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: lightBlue, borderBottom: `1px solid ${borderGray}` }}>
            {weekDates.map((d, i) => {
              const isToday = formatDate(d) === formatDate(new Date())
              return (<div key={i} style={{ padding: '8px 4px', textAlign: 'center', borderRight: i < 6 ? `1px solid ${borderGray}` : 'none', background: isToday ? 'var(--color-info-bg)' : 'transparent' }}>
                <div style={{ fontSize: 11, color: textGray }}>{['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? '#2563eb' : primaryBlue }}>{d.getDate()}</div>
              </div>)
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekDates.map((d, dayIdx) => {
              const dateStr = formatDate(d)
              const dayApts = appointments.filter(a => a.examDate === dateStr && a.status !== 'cancelled')
              return (<div key={dayIdx} style={{ minHeight: 100, borderRight: dayIdx < 6 ? `1px solid ${borderGray}` : 'none', borderBottom: `1px solid ${borderGray}`, padding: 4 }}>
                {dayApts.slice(0, 3).map(apt => (
                  <div key={apt.id} onClick={() => openDetail(apt)} style={{ padding: '1px 3px', borderRadius: 3, fontSize: 12, background: getStatusConfig(apt.status).bg, borderLeft: `2px solid ${getStatusConfig(apt.status).color}`, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {apt.patientName} {apt.examTime}
                  </div>
                ))}
                {dayApts.length > 3 && <div style={{ fontSize: 12, color: textGray }}>+{dayApts.length - 3}更多</div>}
              </div>)
            })}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && calendarSubView === 'day' && (
        <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: lightBlue }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: primaryBlue }}>{formatDateCht(currentWeekStart)} 日程</span>
          </div>
          <div>
            {timeSlots.map(slot => {
              const slotApts = appointments.filter(a => a.examDate === formatDate(currentWeekStart) && a.examTime === slot && a.status !== 'cancelled')
              return (<div key={slot} style={{ display: 'flex', borderBottom: `1px solid ${borderGray}`, minHeight: 36 }}>
                <div style={{ width: 60, padding: '6px 8px', fontSize: 12, fontWeight: 600, color: primaryBlue, borderRight: `1px solid ${borderGray}`, flexShrink: 0 }}>{slot}</div>
                <div style={{ flex: 1, padding: '4px 6px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {slotApts.map(apt => (
                    <div key={apt.id} onClick={() => openDetail(apt)} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: getStatusConfig(apt.status).bg, color: getStatusConfig(apt.status).color, fontWeight: 600, cursor: 'pointer', border: `1px solid ${getStatusConfig(apt.status).color}` }}>
                      {apt.patientName} · {apt.examItemName}
                    </div>
                  ))}
                  {slotApts.length === 0 && <span style={{ fontSize: 12, color: '#cbd5e1' }}>空闲</span>}
                </div>
              </div>)
            })}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && calendarSubView === 'month' && (
        <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: lightBlue, borderBottom: `1px solid ${borderGray}` }}>
            {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: textGray }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: 35 }, (_, i) => {
              const firstDay = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1)
              const startDay = firstDay.getDay()
              const d = new Date(firstDay)
              d.setDate(d.getDate() - startDay + i)
              const dateStr = formatDate(d)
              const isToday = dateStr === formatDate(new Date())
              const dayApts = appointments.filter(a => a.examDate === dateStr && a.status !== 'cancelled')
              return (<div key={i} style={{ minHeight: 60, border: `1px solid ${borderGray}`, padding: 2, background: isToday ? 'var(--color-info-bg)' : d.getMonth() !== currentWeekStart.getMonth() ? 'var(--bg-card)' : 'transparent' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? '#2563eb' : d.getMonth() !== currentWeekStart.getMonth() ? '#cbd5e1' : primaryBlue }}>{d.getDate()}</div>
                {dayApts.slice(0, 2).map(apt => <div key={apt.id} style={{ fontSize: 12, padding: '1px 3px', borderRadius: 3, background: getStatusConfig(apt.status).bg, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.patientName}</div>)}
                {dayApts.length > 2 && <div style={{ fontSize: 12, color: textGray }}>+{dayApts.length - 2}</div>}
              </div>)
            })}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderBottom: `1px solid ${borderGray}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: textGray }}>共 {filteredListAppointments.length} 条记录</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: `2px solid ${borderGray}` }}>
                  {['患者', '性别/年龄', '检查项目', '检查日期', '时段', '设备', '状态', '优先级', '操作'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: textGray, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredListAppointments.map(apt => (
                  <tr key={apt.id} style={{ borderBottom: `1px solid ${borderGray}`, cursor: 'pointer' }} onClick={() => openDetail(apt)}>
                    <td style={{ padding: '8px 10px' }}><div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue }}>{apt.patientName}</div></td>
                    <td style={{ padding: '8px 10px', color: textGray }}>{apt.gender}/{apt.age}岁</td>
                    <td style={{ padding: '8px 10px', color: primaryBlue, fontWeight: 600 }}>{apt.examItemName}</td>
                    <td style={{ padding: '8px 10px', color: textGray }}>{apt.examDate}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: primaryBlue }}>{apt.examTime}</td>
                    <td style={{ padding: '8px 10px', color: textGray }}>{apt.deviceName?.split('（')[0]}</td>
                    <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: getStatusConfig(apt.status).bg, color: getStatusConfig(apt.status).color }}>{getStatusConfig(apt.status).label}</span></td>
                    <td style={{ padding: '8px 10px', color: apt.priority === 'urgent' ? '#d97706' : apt.priority === 'critical' ? '#dc2626' : textGray, fontWeight: 600 }}>{apt.priority === 'urgent' ? '紧急' : apt.priority === 'critical' ? '危重' : '普通'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); openDetail(apt) }} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: lightBlue, color: primaryBlue, fontSize: 12, cursor: 'pointer' }}>详情</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

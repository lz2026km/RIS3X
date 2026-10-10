import type { Dispatch, SetStateAction } from 'react'
import { ChevronLeft, ChevronRight, Filter, Search, CalendarDays, List, Bell, CheckCircle2, CalendarClock, X } from 'lucide-react'
import { initialModalityDevices } from '../data/initialData'
import { useContextMenu, type ContextMenuItem } from '../components/common/ContextMenu'
import { DataTable } from '../components/common'
import BatchActionBar from '../components/batch/BatchActionBar'
import { t } from '../i18n/appI18n'

const primaryBlue = 'var(--color-primary-800)'
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
  // [W14-UX] 批量选择 + 右键上下文菜单
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: (checked: boolean) => void
  onBatchAction?: (action: string, ids: string[]) => void
  contextActions?: {
    onView?(apt: Appointment): void
    onCheckIn?(apt: Appointment): void
    onCancel?(apt: Appointment): void
    onReschedule?(apt: Appointment): void
    onPrint?(apt: Appointment): void
  }
}

export default function AppointmentCalendar(props: Props) {
  const { viewMode, setViewMode, calendarSubView, setCalendarSubView, weekDates, setCurrentWeekStart, currentWeekStart, selectedDevice, setSelectedDevice, searchKeyword, setSearchKeyword, appointments, getStatusConfig, formatDate, formatDateCht, timeSlots, openDetail, showWaitlist, setShowWaitlist, filteredListAppointments, statsData, selectedIds, onToggleSelect, onToggleSelectAll, onBatchAction, contextActions } = props

  // [W14-UX] 右键上下文菜单
  const { open: openContextMenu, menu: contextMenuNode } = useContextMenu('appointment-context-menu')
  const buildContextItems = (apt: Appointment): ContextMenuItem[] => [
    { key: 'view', label: '查看详情', onSelect: () => (contextActions?.onView ?? openDetail)(apt) },
    { key: 'checkin', label: '签到', onSelect: () => contextActions?.onCheckIn?.(apt) },
    { key: 'print', label: '打印', dividerBefore: true, onSelect: () => contextActions?.onPrint?.(apt) },
    { key: 'reschedule', label: '重排/改约', onSelect: () => contextActions?.onReschedule?.(apt) },
    {
      key: 'cancel',
      label: '取消预约',
      danger: true,
      confirm: '确认取消?',
      dividerBefore: true,
      onSelect: () => contextActions?.onCancel?.(apt),
    },
  ]
  const someSelected = Boolean(selectedIds && selectedIds.size > 0)
  const allSelected = Boolean(
    selectedIds && filteredListAppointments.length > 0 && filteredListAppointments.every((a) => selectedIds.has(a.id)),
  )

  return (
    <>
      {contextMenuNode}
      {statsData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
          {statsData.map(stat => (
            <div key={stat.label} style={{ background: whiteBg, borderRadius: 8, padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: `1px solid ${borderGray}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: textGray, marginTop: 3 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: whiteBg, borderRadius: 10, padding: '12px 16px', marginBottom: 'var(--space-3, 12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', background: 'var(--bg-card)', borderRadius: 6, padding: 1 }}>
            {(['calendar', 'list', 'reminders'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '6px 12px', background: viewMode === mode ? whiteBg : 'transparent', color: viewMode === mode ? primaryBlue : textGray, border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                {mode === 'calendar' ? <CalendarDays size={13} /> : mode === 'list' ? <List size={13} /> : <Bell size={13} />}
                {mode === 'calendar' ? '日历' : mode === 'list' ? '列表' : '提醒'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setShowWaitlist(!showWaitlist)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: showWaitlist ? lightBlue : 'transparent', color: primaryBlue, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>等候名单</button>
          </div>
          {viewMode === 'calendar' && (
            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 6, padding: 1 }}>
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setCalendarSubView(v)} style={{ padding: '3px 10px', background: calendarSubView === v ? whiteBg : 'transparent', color: calendarSubView === v ? primaryBlue : textGray, border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{v === 'day' ? '日' : v === 'week' ? '周' : '月'}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Filter size={14} style={{ color: textGray }} />
            <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} style={{ padding: '5px 10px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, color: primaryBlue, background: whiteBg, cursor: 'pointer',}}>
              <option value="all">全部设备</option>
              {initialModalityDevices.filter((d: any) => d.status !== '维护中').map((d: any) => <option key={d.id} value={d.id}>{d.name.split('（')[0]} · {d.modality}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: `1px solid ${borderGray}`, borderRadius: 6, padding: '4px 10px' }}>
            <Search size={13} style={{ color: textGray }} />
            <input type="text" placeholder="搜索患者/电话/项目…" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, color: primaryBlue, width: 140 }} />
          </div>
        </div>
      </div>

      {viewMode === 'calendar' && calendarSubView === 'week' && (
        <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: lightBlue }}>
            <button onClick={() => { const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); setCurrentWeekStart(d) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: primaryBlue }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 12, fontWeight: 700, color: primaryBlue }}>{formatDateCht(weekDates[0]!)} - {formatDateCht(weekDates[6]!)}</span>
            <button onClick={() => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + 7); setCurrentWeekStart(d) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: primaryBlue }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: lightBlue, borderBottom: `1px solid ${borderGray}` }}>
            {weekDates.map((d, i) => {
              const isToday = formatDate(d) === formatDate(new Date())
              return (<div key={i} style={{ padding: '8px 4px', textAlign: 'center', borderRight: i < 6 ? `1px solid ${borderGray}` : 'none', background: isToday ? 'var(--color-info-bg)' : 'transparent' }}>
                <div style={{ fontSize: 11, color: textGray }}>{['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? 'var(--color-primary-600)' : primaryBlue }}>{d.getDate()}</div>
              </div>)
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekDates.map((d, dayIdx) => {
              const dateStr = formatDate(d)
              const dayApts = appointments.filter(a => a.examDate === dateStr && a.status !== 'cancelled')
              return (<div key={dayIdx} style={{ minHeight: 100, borderRight: dayIdx < 6 ? `1px solid ${borderGray}` : 'none', borderBottom: `1px solid ${borderGray}`, padding: 'var(--space-1, 4px)' }}>
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
            <span style={{ fontSize: 12, fontWeight: 700, color: primaryBlue }}>{formatDateCht(currentWeekStart)} 日程</span>
          </div>
          <div>
            {timeSlots.map(slot => {
              const slotApts = appointments.filter(a => a.examDate === formatDate(currentWeekStart) && a.examTime === slot && a.status !== 'cancelled')
              return (<div key={slot} style={{ display: 'flex', borderBottom: `1px solid ${borderGray}`, minHeight: 36 }}>
                <div style={{ width: 60, padding: '6px 8px', fontSize: 12, fontWeight: 600, color: primaryBlue, borderRight: `1px solid ${borderGray}`, flexShrink: 0 }}>{slot}</div>
                <div style={{ flex: 1, padding: '4px 6px', display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
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
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? 'var(--color-primary-600)' : d.getMonth() !== currentWeekStart.getMonth() ? '#cbd5e1' : primaryBlue }}>{d.getDate()}</div>
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
            <DataTable
              rowKey="id"
              dataSource={filteredListAppointments}
              showPagination={false}
              showExport={false}
              showDensity={false}
              onRow={(apt) => ({
                onClick: () => openDetail(apt),
                onContextMenu: (e) => { e.preventDefault(); openContextMenu(e, buildContextItems(apt)) },
                style: { cursor: 'pointer', background: selectedIds?.has(apt.id) ? 'var(--color-info-bg)' : undefined },
              })}
              columns={[
                {
                  title: (
                    <input
                      type="checkbox"
                      aria-label="全选当前列表"
                      checked={allSelected}
                      onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                    />
                  ),
                  key: '__select',
                  width: 36,
                  render: (_: unknown, apt: Appointment) => (
                    <input
                      type="checkbox"
                      aria-label={`选择预约 ${apt.patientName}`}
                      checked={Boolean(selectedIds?.has(apt.id))}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect?.(apt.id)}
                    />
                  ),
                },
                {
                  title: '患者', dataIndex: 'patientName', key: 'patientName',
                  render: (_: unknown, apt: Appointment) => <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue }}>{apt.patientName}</div>,
                },
                {
                  title: '性别/年龄', key: 'genderAge',
                  render: (_: unknown, apt: Appointment) => <span style={{ color: textGray }}>{apt.gender}/{apt.age}岁</span>,
                },
                {
                  title: '检查项目', dataIndex: 'examItemName', key: 'examItemName',
                  render: (v: string) => <span style={{ color: primaryBlue, fontWeight: 600 }}>{v}</span>,
                },
                { title: '检查日期', dataIndex: 'examDate', key: 'examDate', render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
                {
                  title: '时段', dataIndex: 'examTime', key: 'examTime',
                  render: (v: string) => <span style={{ fontWeight: 600, color: primaryBlue }}>{v}</span>,
                },
                {
                  title: '设备', key: 'deviceName',
                  render: (_: unknown, apt: Appointment) => <span style={{ color: textGray }}>{apt.deviceName?.split('（')[0]}</span>,
                },
                {
                  title: '状态', dataIndex: 'status', key: 'status',
                  render: (v: string) => <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: getStatusConfig(v).bg, color: getStatusConfig(v).color }}>{getStatusConfig(v).label}</span>,
                },
                {
                  title: '优先级', dataIndex: 'priority', key: 'priority',
                  render: (v: string) => (
                    <span style={{ color: v === 'urgent' ? 'var(--color-warning-600)' : v === 'critical' ? 'var(--color-error-600)' : textGray, fontWeight: 600 }}>
                      {v === 'urgent' ? '紧急' : v === 'critical' ? '危重' : '普通'}
                    </span>
                  ),
                },
                {
                  title: '操作', key: 'actions',
                  render: (_: unknown, apt: Appointment) => (
                    <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
                      <button onClick={e => { e.stopPropagation(); openDetail(apt) }} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: lightBlue, color: primaryBlue, fontSize: 12, cursor: 'pointer' }}>详情</button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* [W14-UX] 列表视图批量操作栏 (签到/改约/取消) */}
      {viewMode === 'list' && someSelected && (
        <BatchActionBar
          selectedCount={selectedIds?.size ?? 0}
          onClear={() => onToggleSelectAll?.(false)}
          onAction={(action) => {
            const ids = Array.from(selectedIds ?? [])
            if (onBatchAction) {
              onBatchAction(action, ids)
              return
            }
            const targets = appointments.filter((a) => ids.includes(a.id))
            for (const apt of targets) {
              if (action === 'checkin') contextActions?.onCheckIn?.(apt)
              else if (action === 'cancel') contextActions?.onCancel?.(apt)
              else if (action === 'reschedule') contextActions?.onReschedule?.(apt)
              else if (action === 'print') contextActions?.onPrint?.(apt)
            }
          }}
          actions={[
            { key: 'checkin', label: t('w14Ux.batch.checkIn'), icon: <CheckCircle2 size={13} /> },
            { key: 'reschedule', label: t('w14Ux.batch.reschedule'), icon: <CalendarClock size={13} /> },
            { key: 'cancel', label: t('w14Ux.batch.cancel'), icon: <X size={13} />, confirm: t('w14Ux.batch.confirm') },
          ]}
        />
      )}
    </>
  )
}

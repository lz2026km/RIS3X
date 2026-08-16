// @deprecated [v3.0.6.11-103 Wave 10] 重复页面精简合并: 本页已嵌入 SchedulePage "技师排班" Tab (src/pages/SchedulePage.tsx), 文件保留, 旧路由 /ops/tech-schedule 已 redirect → /schedule。功能未删除, 请勿单独继续扩展本页。
// G005 放射RIS系统 v3.0.6.11-99 Wave 6B (tech-schedule) - 技师排班管理
// 功能: 月历矩阵(日期×技师) + 统计卡 + 新建/批量生成/筛选 + 单元格操作(确认/换班/请假/编辑/删除)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, message, Modal, Select, Spin, Tag, Tooltip } from 'antd'
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, Coffee, Moon, Pencil, Plus, RefreshCw,
  Sun, UserPlus, Users, CalendarPlus, X, ArrowRightLeft,
} from 'lucide-react'
import { techScheduleApi } from '../../services/api/techScheduleApi'
import type {
  TechCalendar, TechRoom, TechScheduleItem, TechShift, TechScheduleStatus, TechStats, TechTechnician,
} from '../../services/api/techScheduleApi'
import { invalidateApiCacheByPrefix } from '../../services/api/client'

// ============================================================
// 样式常量 (ops 深色主题)
// ============================================================
const C = {
  bg: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  text: '#f0f6fc',
  textMid: '#8b949e',
  textLight: '#6e7681',
  blue: '#3b82f6',
  green: '#4ade80',
  orange: '#fbbf24',
  red: '#f87171',
  purple: '#a78bfa',
  teal: '#2dd4bf',
}

const SHIFT_CONFIG: Record<TechShift, { label: string; color: string; icon: React.ReactNode }> = {
  DAY: { label: '白班', color: C.blue, icon: <Sun size={12} /> },
  NIGHT: { label: '夜班', color: C.purple, icon: <Moon size={12} /> },
  WEEKEND: { label: '周末班', color: C.orange, icon: <CalendarDays size={12} /> },
  BACKUP: { label: '备班', color: C.teal, icon: <Coffee size={12} /> },
}

const STATUS_CONFIG: Record<TechScheduleStatus, { label: string; color: string }> = {
  SCHEDULED: { label: '排定', color: C.textMid },
  CONFIRMED: { label: '已确认', color: C.green },
  SWAPPED: { label: '已换班', color: C.orange },
  ON_LEAVE: { label: '已请假', color: C.red },
}

const SHIFT_LIST: TechShift[] = ['DAY', 'NIGHT', 'WEEKEND', 'BACKUP']
const STATUS_LIST: TechScheduleStatus[] = ['SCHEDULED', 'CONFIRMED', 'SWAPPED', 'ON_LEAVE']

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const monthStr = (offsetMonth = 0) => {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonth)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const EMPTY_STATS: TechStats = {
  month: monthStr(), totalShifts: 0, technicianCount: 0, leaveCount: 0,
  nightShiftCount: 0, weekendShiftCount: 0, backupShiftCount: 0,
  confirmedCount: 0, swappedCount: 0, byTechnician: [], byShift: [],
}

interface CreateForm {
  date: string
  shift: TechShift
  technicianId: string
  roomId: string | null
  notes: string
}

const EMPTY_FORM: CreateForm = { date: todayStr(), shift: 'DAY', technicianId: '', roomId: null, notes: '' }

export default function TechSchedulePage() {
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [calendar, setCalendar] = useState<TechCalendar | null>(null)
  const [stats, setStats] = useState<TechStats>(EMPTY_STATS)
  const [technicians, setTechnicians] = useState<TechTechnician[]>([])
  const [rooms, setRooms] = useState<TechRoom[]>([])
  const [schedules, setSchedules] = useState<TechScheduleItem[]>([])
  const [month, setMonth] = useState(monthStr())

  // 筛选
  const [filterDate, setFilterDate] = useState('')
  const [filterTech, setFilterTech] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // 弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchForm, setBatchForm] = useState({ startDate: todayStr(), endDate: todayStr(), pattern: ['DAY', 'NIGHT', 'BACKUP'] as TechShift[] })
  const [detail, setDetail] = useState<TechScheduleItem | null>(null)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapForm, setSwapForm] = useState({ targetTechId: '', reason: '' })
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveReason, setLeaveReason] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<CreateForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [calRes, statsRes, metaRes, listRes] = await Promise.all([
        techScheduleApi.calendar(month),
        techScheduleApi.stats(month),
        techScheduleApi.meta(),
        techScheduleApi.list({ month }),
      ])
      if (!calRes.success || !statsRes.success || !metaRes.success || !listRes.success) throw new Error('tech-schedule api failed')
      setCalendar(calRes.data)
      setStats(statsRes.data ?? EMPTY_STATS)
      setTechnicians(metaRes.data?.technicians ?? [])
      setRooms(metaRes.data?.rooms ?? [])
      setSchedules(listRes.data?.data ?? [])
      setDataSource('api')
    } catch {
      // 回退本地演示数据
      const demo = buildDemoData(month)
      setCalendar(demo.calendar)
      setStats(demo.stats)
      setTechnicians(demo.technicians)
      setRooms(demo.rooms)
      setSchedules(demo.schedules)
      setDataSource('demo')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { void load() }, [load])

  const afterMutate = () => {
    void invalidateApiCacheByPrefix('/tech-schedules')
    void load()
  }

  // ================= 新建 =================
  const handleCreate = async () => {
    if (!createForm.date || !createForm.technicianId) {
      message.warning('请填写日期并选择技师')
      return
    }
    const res = await techScheduleApi.create({
      date: createForm.date,
      shift: createForm.shift,
      technicianId: createForm.technicianId,
      roomId: createForm.roomId,
      notes: createForm.notes || null,
    })
    if (res.success) {
      message.success(`排班已创建: ${res.data.technicianName} ${SHIFT_CONFIG[res.data.shift].label}`)
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      afterMutate()
    } else {
      message.error(res.error?.message ?? '创建失败')
    }
  }

  // ================= 批量生成 =================
  const handleBatch = async () => {
    if (!batchForm.startDate || !batchForm.endDate || batchForm.pattern.length === 0) {
      message.warning('请填写起止日期并选择班次模式')
      return
    }
    const res = await techScheduleApi.batchCreate({
      startDate: batchForm.startDate,
      endDate: batchForm.endDate,
      shiftPattern: batchForm.pattern,
    })
    if (res.success) {
      message.success(`批量生成完成: ${res.data.count} 条排班`)
      setBatchOpen(false)
      afterMutate()
    } else {
      message.error(res.error?.message ?? '批量生成失败')
    }
  }

  // ================= 确认 =================
  const handleConfirm = async (id: string) => {
    const res = await techScheduleApi.confirm(id)
    if (res.success) {
      message.success('排班已确认')
      setDetail(null)
      afterMutate()
    } else {
      message.error(res.error?.message ?? '确认失败')
    }
  }

  // ================= 换班 =================
  const handleSwap = async () => {
    if (!detail) return
    if (!swapForm.targetTechId) {
      message.warning('请选择目标技师')
      return
    }
    const res = await techScheduleApi.swap(detail.id, { targetTechId: swapForm.targetTechId, reason: swapForm.reason })
    if (res.success) {
      message.success(`换班成功: ${res.data.source.technicianName} ↔ ${res.data.target.technicianName}`)
      setSwapOpen(false)
      setDetail(null)
      setSwapForm({ targetTechId: '', reason: '' })
      afterMutate()
    } else {
      message.error(res.error?.message ?? '换班失败')
    }
  }

  // ================= 请假 =================
  const handleLeave = async () => {
    if (!detail) return
    if (!leaveReason.trim()) {
      message.warning('请填写请假原因（用于提示补位）')
      return
    }
    const res = await techScheduleApi.leave(detail.id, { reason: leaveReason })
    if (res.success) {
      message.warning(`${res.data.technicianName} 已请假，请安排补位`)
      setLeaveOpen(false)
      setDetail(null)
      setLeaveReason('')
      afterMutate()
    } else {
      message.error(res.error?.message ?? '请假登记失败')
    }
  }

  // ================= 编辑 =================
  const handleEdit = async () => {
    if (!detail) return
    const res = await techScheduleApi.update(detail.id, {
      date: editForm.date,
      shift: editForm.shift,
      technicianId: editForm.technicianId,
      roomId: editForm.roomId,
      notes: editForm.notes || null,
    })
    if (res.success) {
      message.success('排班已更新')
      setEditOpen(false)
      setDetail(null)
      afterMutate()
    } else {
      message.error(res.error?.message ?? '更新失败')
    }
  }

  // ================= 删除 =================
  const handleDelete = async (id: string) => {
    const res = await techScheduleApi.remove(id)
    if (res.success) {
      message.success('排班已删除')
      setDetail(null)
      afterMutate()
    } else {
      message.error(res.error?.message ?? '删除失败')
    }
  }

  // ================= 派生数据 =================
  const visibleTechs = useMemo(() => {
    const techs = filterTech ? technicians.filter((t) => t.id === filterTech) : technicians
    return techs.length > 0 ? techs : technicians
  }, [technicians, filterTech])

  const cellFor = (date: string, techId: string): TechScheduleItem | undefined =>
    schedules.find((s) => s.date === date && s.technicianId === techId)

  const monthLabel = calendar?.month ?? month

  const swapCandidates = useMemo(() => {
    if (!detail) return []
    const sameDay = new Set(schedules.filter((s) => s.date === detail.date).map((s) => s.technicianId))
    return technicians.filter((t) => t.id !== detail.technicianId && sameDay.has(t.id))
  }, [detail, technicians, schedules])

  const openCreateOn = (date: string) => {
    setCreateForm({ ...EMPTY_FORM, date })
    setCreateOpen(true)
  }

  return (
    <div data-testid="tech-schedule-page" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      {/* ================= 头部 ================= */}
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CalendarDays size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>技师排班管理</span>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: dataSource === 'api' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.25)',
            color: dataSource === 'api' ? C.green : C.orange,
            border: `1px solid ${dataSource === 'api' ? '#22c55e' : '#f59e0b'}`,
          }}>
            {dataSource === 'api' ? 'tech-schedules API 实时' : '演示数据'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>班次/换班/请假/统计 · 月历矩阵</span>
          <span title="刷新数据" style={{ cursor: 'pointer', display: 'inline-flex' }} onClick={() => void load()}>
            <RefreshCw size={16} />
          </span>
        </div>
      </div>

      {/* ================= 统计卡 ================= */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { title: '本月班次', value: stats.totalShifts, icon: <ClipboardList size={20} />, color: C.blue },
            { title: '排班技师', value: stats.technicianCount, icon: <Users size={20} />, color: C.teal },
            { title: '请假', value: stats.leaveCount, icon: <UserPlus size={20} />, color: C.red },
            { title: '夜班', value: stats.nightShiftCount, icon: <Moon size={20} />, color: C.purple },
          ].map((kpi) => (
            <div key={kpi.title} style={{ flex: 1, minWidth: 180, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.textMid }}>{kpi.title}</span>
                <span style={{ color: kpi.color }}>{kpi.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= 工具栏 ================= */}
      <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button size="small" icon={<ChevronLeft size={14} />} onClick={() => setMonth(shiftMonth(month, -1))} />
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>{monthLabel}</span>
          <Button size="small" icon={<ChevronRight size={14} />} onClick={() => setMonth(shiftMonth(month, 1))} />
          <Button size="small" onClick={() => setMonth(monthStr())}>本月</Button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
            style={inputStyle} data-testid="ts-filter-date"
          />
          <Select
            size="small" placeholder="全部技师" value={filterTech || undefined}
            onChange={(v) => setFilterTech(v ?? '')} allowClear style={{ width: 140 }}
            options={technicians.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Select
            size="small" placeholder="全部状态" value={filterStatus || undefined}
            onChange={(v) => setFilterStatus(v ?? '')} allowClear style={{ width: 130 }}
            options={STATUS_LIST.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
          />
          <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => { setCreateForm({ ...EMPTY_FORM }); setCreateOpen(true) }}>
            新建排班
          </Button>
          <Button size="small" icon={<CalendarPlus size={14} />} onClick={() => setBatchOpen(true)}>
            批量生成
          </Button>
        </div>
      </div>

      {/* ================= 月历矩阵 ================= */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <Spin spinning={loading}>
            {calendar && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f141b' }}>
                      <th style={thStyle}>技师</th>
                      {calendar.days.map((d) => {
                        const weekend = d.weekday === '周日' || d.weekday === '周六'
                        const isFiltered = filterDate && d.date !== filterDate
                        return (
                          <th key={d.date} style={{ ...thStyle, minWidth: 64, background: isFiltered ? '#1a1f27' : d.isToday ? 'rgba(59,130,246,0.18)' : weekend ? '#1c2129' : '#0f141b' }}>
                            <div style={{ fontWeight: 600, color: d.isToday ? C.blue : weekend ? C.orange : C.text }}>{d.date.slice(8)}</div>
                            <div style={{ fontSize: 11, fontWeight: 400, color: d.isToday ? C.blue : C.textMid }}>
                              {d.weekday}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTechs.map((tech, rowIdx) => (
                      <tr key={tech.id} style={{ background: rowIdx % 2 === 0 ? C.panel : '#12171f' }}>
                        <td style={{ ...tdStyle, background: '#0f141b', position: 'sticky', left: 0, minWidth: 110 }}>
                          <div style={{ fontWeight: 500, color: C.text }}>{tech.name}</div>
                          <div style={{ fontSize: 11, color: C.textLight }}>{tech.group}</div>
                        </td>
                        {calendar.days.map((d) => {
                          const isFiltered = filterDate && d.date !== filterDate
                          const item = cellFor(d.date, tech.id)
                          const statusOk = filterStatus ? item?.status === filterStatus : true
                          const dim = (isFiltered || (filterStatus && !statusOk))
                          const weekend = d.weekday === '周日' || d.weekday === '周六'
                          return (
                            <td key={d.date} style={{ ...tdStyle, textAlign: 'center', background: dim ? '#1a1f27' : weekend ? '#1c2129' : 'transparent', cursor: 'pointer' }}
                              onClick={() => { if (item) setDetail(item); else if (!isFiltered) openCreateOn(d.date) }}
                              title={item ? `${tech.name} ${SHIFT_CONFIG[item.shift].label} (${STATUS_CONFIG[item.status].label})` : `为 ${tech.name} 添加 ${d.date} 排班`}
                            >
                              {item ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: statusOk ? 1 : 0.35 }}>
                                  <Tag color={SHIFT_CONFIG[item.shift].color} style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                                    {SHIFT_CONFIG[item.shift].icon} {SHIFT_CONFIG[item.shift].label}
                                  </Tag>
                                  <span style={{ fontSize: 10, color: STATUS_CONFIG[item.status].color, fontWeight: 500 }}>
                                    {STATUS_CONFIG[item.status].label}
                                  </span>
                                  {item.roomName && <span style={{ fontSize: 10, color: C.textLight }}>{item.roomName}</span>}
                                </div>
                              ) : (
                                <span style={{ color: C.textLight, fontSize: 11 }}>-</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {visibleTechs.length === 0 && (
                      <tr><td colSpan={calendar.days.length + 1} style={{ ...tdStyle, textAlign: 'center', color: C.textMid, padding: 24 }}>暂无技师数据</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!calendar && !loading && <Empty description="暂无月历数据" style={{ padding: 40 }} />}
          </Spin>
        </div>

        {/* 图例 */}
        <div style={{ marginTop: 12, padding: '10px 16px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>班次图例:</span>
          {SHIFT_LIST.map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: SHIFT_CONFIG[s].color }}>
              {SHIFT_CONFIG[s].icon}{SHIFT_CONFIG[s].label}
            </span>
          ))}
          <span style={{ borderLeft: `1px solid ${C.border}`, height: 16 }} />
          {STATUS_LIST.map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: STATUS_CONFIG[s].color }}>
              {STATUS_CONFIG[s].label}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textLight }}>点击单元格: 详情/操作; 空单元格: 快速新建</span>
        </div>
      </div>

      {/* ================= 技师班次分布 ================= */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} color={C.teal} /> 技师班次分布 ({monthLabel})
          </div>
          {stats.byTechnician.length === 0 ? (
            <Empty description="本月暂无排班" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>技师</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>班次数</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>夜班</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>请假</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>占比</th>
                </tr>
              </thead>
              <tbody>
                {stats.byTechnician.map((t) => {
                  const pct = stats.totalShifts > 0 ? Math.round((t.count / stats.totalShifts) * 100) : 0
                  return (
                    <tr key={t.technicianId} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ ...tdStyle, textAlign: 'left' }}>{t.technicianName}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{t.count}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: C.purple }}>{t.nights}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: C.red }}>{t.leaves}</td>
                      <td style={{ ...tdStyle, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, maxWidth: 240, height: 6, borderRadius: 3, background: '#1c2129' }}>
                            <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: C.blue }} />
                          </div>
                          <span style={{ color: C.textMid, width: 36 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ================= 排班详情/操作弹窗 ================= */}
      <Modal
        title={detail ? `排班详情 · ${detail.date} ${SHIFT_CONFIG[detail.shift]?.label ?? detail.shift}` : ''}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={460}
        destroyOnClose
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              {[
                { label: '技师', value: detail.technicianName },
                { label: '检查室', value: detail.roomName ?? '未分配' },
                { label: '状态', value: STATUS_CONFIG[detail.status]?.label ?? detail.status },
                { label: '备注', value: detail.notes ?? '-' },
              ].map((f) => (
                <div key={f.label} style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: C.textMid }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
              {detail.swapReason && <div style={{ minWidth: 200 }}><div style={{ fontSize: 11, color: C.textMid }}>换班原因</div><div style={{ fontSize: 13, color: C.orange }}>{detail.swapReason}</div></div>}
              {detail.leaveReason && <div style={{ minWidth: 200 }}><div style={{ fontSize: 11, color: C.textMid }}>请假原因</div><div style={{ fontSize: 13, color: C.red }}>{detail.leaveReason}</div></div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.status !== 'CONFIRMED' && detail.status !== 'ON_LEAVE' && (
                <Tooltip title="确认该排班">
                  <Button size="small" type="primary" icon={<CheckCircle2 size={14} />} onClick={() => void handleConfirm(detail.id)}>确认</Button>
                </Tooltip>
              )}
              <Tooltip title="与目标技师交换班次">
                <Button size="small" icon={<ArrowRightLeft size={14} />} onClick={() => { setSwapForm({ targetTechId: '', reason: '' }); setSwapOpen(true) }}>换班</Button>
              </Tooltip>
              <Tooltip title="登记请假并提示补位">
                <Button size="small" icon={<UserPlus size={14} />} onClick={() => { setLeaveReason(''); setLeaveOpen(true) }}>请假</Button>
              </Tooltip>
              <Button size="small" icon={<Pencil size={14} />} onClick={() => {
                setEditForm({
                  date: detail.date, shift: detail.shift, technicianId: detail.technicianId,
                  roomId: detail.roomId, notes: detail.notes ?? '',
                })
                setEditOpen(true)
              }}>编辑</Button>
              <Button size="small" danger icon={<X size={14} />} onClick={() => void handleDelete(detail.id)}>删除</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= 新建排班弹窗 ================= */}
      <Modal title="新建排班" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void handleCreate()} width={440} destroyOnClose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <label style={labelStyle}>日期</label>
          <input type="date" value={createForm.date} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })} style={inputStyle} data-testid="ts-create-date" />
          <label style={labelStyle}>班次</label>
          <Select size="small" value={createForm.shift} onChange={(v) => setCreateForm({ ...createForm, shift: v })} style={{ width: '100%' }}
            options={SHIFT_LIST.map((s) => ({ value: s, label: `${SHIFT_CONFIG[s].label} (${s})` }))} />
          <label style={labelStyle}>技师</label>
          <Select size="small" placeholder="选择技师" value={createForm.technicianId || undefined} onChange={(v) => setCreateForm({ ...createForm, technicianId: v })}
            style={{ width: '100%' }}
            options={technicians.map((t) => ({ value: t.id, label: `${t.name}（${t.group}）` }))} />
          <label style={labelStyle}>检查室</label>
          <Select size="small" placeholder="可留空" value={createForm.roomId ?? undefined} onChange={(v) => setCreateForm({ ...createForm, roomId: v ?? null })} allowClear
            style={{ width: '100%' }}
            options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
          <label style={labelStyle}>备注</label>
          <input type="text" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="可选备注"
            style={inputStyle} />
        </div>
      </Modal>

      {/* ================= 批量生成弹窗 ================= */}
      <Modal title="批量生成排班" open={batchOpen} onCancel={() => setBatchOpen(false)} onOk={() => void handleBatch()} width={440} destroyOnClose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <label style={labelStyle}>起始日期</label>
          <input type="date" value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} style={inputStyle} />
          <label style={labelStyle}>结束日期</label>
          <input type="date" value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} style={inputStyle} />
          <label style={labelStyle}>班次模式 (按模式循环)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SHIFT_LIST.map((s) => {
              const on = batchForm.pattern.includes(s)
              return (
                <Button key={s} size="small"
                  style={{ borderColor: on ? SHIFT_CONFIG[s].color : C.border, color: on ? SHIFT_CONFIG[s].color : C.textMid }}
                  onClick={() => setBatchForm({
                    ...batchForm,
                    pattern: on ? batchForm.pattern.filter((x) => x !== s) : [...batchForm.pattern, s],
                  })}
                >
                  {SHIFT_CONFIG[s].icon} {SHIFT_CONFIG[s].label}
                </Button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: C.textLight }}>示例: [白班, 夜班, 备班] 会在每个日期循环生成 3 条排班，自动轮换技师与检查室，冲突自动跳过。</div>
        </div>
      </Modal>

      {/* ================= 换班弹窗 ================= */}
      <Modal title={detail ? `换班 · ${detail.technicianName} (${SHIFT_CONFIG[detail.shift]?.label ?? detail.shift})` : '换班'} open={swapOpen} onCancel={() => setSwapOpen(false)} onOk={() => void handleSwap()} width={420} destroyOnClose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <label style={labelStyle}>目标技师 (同日期同班次交换)</label>
          <Select size="small" placeholder="选择目标技师" value={swapForm.targetTechId || undefined} onChange={(v) => setSwapForm({ ...swapForm, targetTechId: v })}
            style={{ width: '100%' }}
            options={swapCandidates.map((t) => ({ value: t.id, label: t.name }))} />
          <label style={labelStyle}>换班原因</label>
          <input type="text" value={swapForm.reason} onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })} placeholder="如: 家中有事对调" style={inputStyle} />
        </div>
      </Modal>

      {/* ================= 请假弹窗 ================= */}
      <Modal title="请假登记" open={leaveOpen} onCancel={() => setLeaveOpen(false)} onOk={() => void handleLeave()} width={420} destroyOnClose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <label style={labelStyle}>请假原因 (将提示补位)</label>
          <input type="text" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="如: 突发疾病，请安排补位" style={inputStyle} />
        </div>
      </Modal>

      {/* ================= 编辑弹窗 ================= */}
      <Modal title="编辑排班" open={editOpen} onCancel={() => setEditOpen(false)} onOk={() => void handleEdit()} width={440} destroyOnClose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <label style={labelStyle}>日期</label>
          <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} style={inputStyle} />
          <label style={labelStyle}>班次</label>
          <Select size="small" value={editForm.shift} onChange={(v) => setEditForm({ ...editForm, shift: v })} style={{ width: '100%' }}
            options={SHIFT_LIST.map((s) => ({ value: s, label: `${SHIFT_CONFIG[s].label} (${s})` }))} />
          <label style={labelStyle}>技师</label>
          <Select size="small" placeholder="选择技师" value={editForm.technicianId || undefined} onChange={(v) => setEditForm({ ...editForm, technicianId: v })}
            style={{ width: '100%' }}
            options={technicians.map((t) => ({ value: t.id, label: `${t.name}（${t.group}）` }))} />
          <label style={labelStyle}>检查室</label>
          <Select size="small" placeholder="可留空" value={editForm.roomId ?? undefined} onChange={(v) => setEditForm({ ...editForm, roomId: v ?? null })} allowClear
            style={{ width: '100%' }}
            options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
          <label style={labelStyle}>备注</label>
          <input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="可选备注" style={inputStyle} />
        </div>
      </Modal>
    </div>
  )
}

const shiftMonth = (month: string, offset: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y ?? 2026, (m ?? 1) - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', background: '#0f141b', color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, outline: 'none',
  colorScheme: 'dark',
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: C.textMid }

const thStyle: React.CSSProperties = {
  padding: '8px 6px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', fontSize: 12,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 6px', borderBottom: `1px solid ${C.border}`, fontSize: 12,
}

function buildDemoData(month: string): { calendar: TechCalendar; stats: TechStats; technicians: TechTechnician[]; rooms: TechRoom[]; schedules: TechScheduleItem[] } {
  const technicians: TechTechnician[] = [
    { id: 'T-001', name: '刘洋', group: 'CT 室' },
    { id: 'T-002', name: '赵志刚', group: 'CT 组' },
    { id: 'T-003', name: '孙伟', group: 'MR 组' },
    { id: 'T-004', name: '王磊', group: 'DR 组' },
    { id: 'T-005', name: '陈静', group: 'DSA 组' },
    { id: 'T-006', name: '周婷', group: 'MG 组' },
  ]
  const rooms: TechRoom[] = [
    { id: 'R-CT1', name: 'CT-1 检查室' },
    { id: 'R-CT2', name: 'CT-2 检查室' },
    { id: 'R-MR1', name: 'MR-1 检查室' },
    { id: 'R-DR1', name: 'DR-1 检查室' },
    { id: 'R-DSA1', name: 'DSA-1 检查室' },
    { id: 'R-MG1', name: 'MG-1 检查室' },
  ]
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const daysInMonth = new Date(year, m, 0).getDate()
  const today = todayStr()
  const now = new Date().toISOString()
  const schedules: TechScheduleItem[] = []
  const shifts: TechShift[] = ['DAY', 'NIGHT', 'BACKUP']
  const statuses: TechScheduleStatus[] = ['CONFIRMED', 'SCHEDULED', 'SCHEDULED']
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    if ((d % 4) === 0) continue
    shifts.forEach((shift, p) => {
      const tech = technicians[(d + p * 2) % technicians.length]!
      schedules.push({
        id: `TS-DEMO-${date}-${p}`,
        date,
        shift,
        technicianId: tech.id,
        technicianName: tech.name,
        roomId: rooms[(d + p) % rooms.length]!.id,
        roomName: rooms[(d + p) % rooms.length]!.name,
        status: statuses[(d + p) % statuses.length]!,
        notes: null,
        swapReason: null,
        leaveReason: null,
        createdAt: now,
        updatedAt: now,
      })
    })
  }
  const days: TechCalendar['days'] = []
  const WEEKDAYS_LOCAL = WEEKDAYS
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    days.push({
      date,
      weekday: WEEKDAYS_LOCAL[new Date(year, m - 1, d).getDay()] ?? '',
      isToday: date === today,
      schedules: schedules.filter((s) => s.date === date),
    })
  }
  const stats: TechStats = {
    month,
    totalShifts: schedules.length,
    technicianCount: new Set(schedules.map((s) => s.technicianId)).size,
    leaveCount: schedules.filter((s) => s.status === 'ON_LEAVE').length,
    nightShiftCount: schedules.filter((s) => s.shift === 'NIGHT').length,
    weekendShiftCount: schedules.filter((s) => s.shift === 'WEEKEND').length,
    backupShiftCount: schedules.filter((s) => s.shift === 'BACKUP').length,
    confirmedCount: schedules.filter((s) => s.status === 'CONFIRMED').length,
    swappedCount: schedules.filter((s) => s.status === 'SWAPPED').length,
    byTechnician: technicians.map((t) => {
      const list = schedules.filter((s) => s.technicianId === t.id)
      return {
        technicianId: t.id,
        technicianName: t.name,
        count: list.length,
        nights: list.filter((s) => s.shift === 'NIGHT').length,
        leaves: list.filter((s) => s.status === 'ON_LEAVE').length,
      }
    }).filter((x) => x.count > 0),
    byShift: (['DAY', 'NIGHT', 'WEEKEND', 'BACKUP'] as TechShift[]).map((shift) => ({
      shift,
      label: SHIFT_CONFIG[shift].label,
      count: schedules.filter((s) => s.shift === shift).length,
    })),
  }
  return { calendar: { month, year, days, technicians }, stats, technicians, rooms, schedules }
}

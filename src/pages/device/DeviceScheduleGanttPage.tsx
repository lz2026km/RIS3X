/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 18 - 设备调度甘特图 V2 页面 (PACS 设备深功能)
 * 覆盖后端 DeviceScheduleService 全部端点:
 *   GET  /devices/schedule               设备×时间周视图 (检查/维护/空闲 三色)
 *   GET  /devices/schedule/stats         利用率统计
 *   GET  /devices/schedule/conflicts     冲突检测 + 建议调整
 *   POST /devices/schedule/blocks        创建排程块 (维护)
 *   PATCH /devices/schedule/blocks/:id   拖拽更新检查块时间
 *   DELETE /devices/schedule/blocks/:id  删除排程块
 *   GET  /devices/schedule/blocks/:id/suggest  冲突块建议位置
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card, Button, Select, Modal, Form, message, Tag, Space, Row, Col, Statistic, Empty, Spin, Alert, DatePicker, Input, TimePicker,
} from 'antd'
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Wrench, Plus, RefreshCw, GripVertical, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import {
  deviceScheduleApi,
  type DeviceWeekViewDto,
  type ScheduleBlockDto,
  type ConflictInfoDto,
  type DeviceScheduleStatsDto,
} from '../../services/api/deviceScheduleApi'

const WORK_START_HOUR = 8
const WORK_END_HOUR = 18
const DAY_WIDTH = 148
const ROW_HEIGHT = 640
const HOUR_HEIGHT = ROW_HEIGHT / (WORK_END_HOUR - WORK_START_HOUR)

const TYPE_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  EXAM: { color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6', label: '检查' },
  MAINTENANCE: { color: '#b45309', bg: '#fef3c7', border: '#f59e0b', label: '维护' },
  IDLE: { color: '#15803d', bg: '#dcfce7', border: '#86efac', label: '空闲' },
}

const IDLE_FALLBACK = { color: '#15803d', bg: '#dcfce7', border: '#86efac', label: '空闲' }

function parseBlockDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T${s.slice(11, 16)}:00`)
}

export default function DeviceScheduleGanttPage() {
  const { t } = useTranslation('v3deviceGantt')
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date()
    const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
  })
  const [view, setView] = useState<DeviceWeekViewDto | null>(null)
  const [stats, setStats] = useState<DeviceScheduleStatsDto | null>(null)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [blockForm] = Form.useForm()

  // 拖拽状态
  const dragRef = useRef<{ block: ScheduleBlockDto; startX: number; startMin: number; endMin: number } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ id: string; offsetMin: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchWeek = useCallback(async () => {
    try {
      const res = await deviceScheduleApi.getWeek(weekStart)
      if (res.success && res.data) setView(res.data as DeviceWeekViewDto)
      else message.error(res.error?.message ?? t('loadFailed', '加载失败'))
    } catch { message.error(t('loadFailed', '加载失败')) }
    try {
      const res = await deviceScheduleApi.getStats(weekStart)
      if (res.success && res.data) setStats(res.data as DeviceScheduleStatsDto)
    } catch { /* 统计不可用 */ }
  }, [weekStart, t])

  useEffect(() => {
    void fetchWeek()
  }, [fetchWeek])

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => {
      const d = new Date(`${prev}T00:00:00`)
      d.setDate(d.getDate() + delta * 7)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    })
  }

  const goToday = () => {
    const now = new Date()
    const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    const pad = (n: number) => String(n).padStart(2, '0')
    setWeekStart(`${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`)
  }

  // ── 拖拽逻辑 (按 15 分钟吸附) ──
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>, block: ScheduleBlockDto) => {
    if (block.type === 'IDLE') return
    e.preventDefault()
    const start = parseBlockDate(block.start)
    const end = parseBlockDate(block.end)
    dragRef.current = { block, startX: e.clientX, startMin: start.getHours() * 60 + start.getMinutes(), endMin: end.getHours() * 60 + end.getMinutes() }
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    setDragPreview({ id: block.id, offsetMin: 0 })
  }

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !dragPreview) return
    const deltaX = e.clientX - drag.startX
    const offsetMin = Math.round((deltaX / DAY_WIDTH) * 60 / 15) * 15
    const newStartMin = drag.startMin + offsetMin
    const newEndMin = drag.endMin + offsetMin
    const clamped = newStartMin < WORK_START_HOUR * 60 ? WORK_START_HOUR * 60 - drag.startMin : newEndMin > WORK_END_HOUR * 60 ? WORK_END_HOUR * 60 - drag.endMin : offsetMin
    setDragPreview({ id: drag.block.id, offsetMin: clamped })
  }

  const handleDragEnd = async () => {
    const drag = dragRef.current
    const preview = dragPreview
    dragRef.current = null
    if (!drag || !preview) return
    setDragPreview(null)
    if (preview.offsetMin === 0) return
    setSaving(true)
    try {
      const start = parseBlockDate(drag.block.start)
      const end = parseBlockDate(drag.block.end)
      const newStart = new Date(start.getTime() + preview.offsetMin * 60000)
      const newEnd = new Date(end.getTime() + preview.offsetMin * 60000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
      const res = await deviceScheduleApi.updateBlock(drag.block.id, { start: fmt(newStart), end: fmt(newEnd) })
      if (res.success && res.data) {
        if (res.data.conflicts.length > 0) {
          message.warning(t('moveConflicts', '已调整时间, 但检测到 {{count}} 处冲突', { count: res.data.conflicts.length }))
        } else {
          message.success(t('moveSuccess', '排程时间已调整'))
        }
        void fetchWeek()
      } else {
        message.error(res.error?.message ?? t('moveFailed', '调整失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('moveFailed', '调整失败')) }
    setSaving(false)
  }

  // ── 维护块创建 ──
  const handleCreateBlock = async () => {
    const values = await blockForm.validateFields()
    const day = values.date.format('YYYY-MM-DD')
    const start = dayjs(`${day}T${values.time[0].format('HH:mm')}:00`).format('YYYY-MM-DDTHH:mm:ss')
    const end = dayjs(`${day}T${values.time[1].format('HH:mm')}:00`).format('YYYY-MM-DDTHH:mm:ss')
    setSaving(true)
    try {
      const res = await deviceScheduleApi.createBlock({
        deviceId: values.deviceId,
        type: 'MAINTENANCE',
        title: values.title,
        start,
        end,
      })
      if (res.success && res.data) {
        message.success(t('blockCreated', '维护排程已创建'))
        setBlockModalOpen(false)
        blockForm.resetFields()
        void fetchWeek()
      } else {
        message.error(res.error?.message ?? t('blockFailed', '创建失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('blockFailed', '创建失败')) }
    setSaving(false)
  }

  const handleDeleteBlock = async (id: string) => {
    try {
      const res = await deviceScheduleApi.deleteBlock(id)
      if (res.success) {
        message.success(t('deleteSuccess', '已删除'))
        void fetchWeek()
      }
    } catch { message.error(t('deleteFailed', '删除失败')) }
  }

  // ── 应用冲突建议 ──
  const applySuggestion = async (conflict: ConflictInfoDto) => {
    setSaving(true)
    try {
      const res = await deviceScheduleApi.updateBlock(conflict.blockId, { start: conflict.suggestion.start, end: conflict.suggestion.end })
      if (res.success && res.data) {
        message.success(t('suggestionApplied', '已应用建议调整'))
        void fetchWeek()
      } else {
        message.error(res.error?.message ?? t('moveFailed', '调整失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('moveFailed', '调整失败')) }
    setSaving(false)
  }

  const allConflicts = useMemo(() => view?.devices.flatMap((d) => d.conflicts) ?? [], [view])
  const devices = useMemo(() => view?.devices ?? [], [view])

  const blockStyle = (b: ScheduleBlockDto, offsetMin: number): React.CSSProperties => {
    const start = parseBlockDate(b.start)
    const end = parseBlockDate(b.end)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = Math.max(end.getHours() * 60 + end.getMinutes(), startMin + 15)
    const top = ((startMin - WORK_START_HOUR * 60) / 60) * HOUR_HEIGHT + 24
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 18)
    const meta = TYPE_META[b.type] ?? IDLE_FALLBACK
    return {
      position: 'absolute',
      top,
      left: offsetMin !== 0 ? `calc(${(offsetMin / 60) * HOUR_HEIGHT}px + 2px)` : 2,
      height,
      width: DAY_WIDTH - 4,
      borderRadius: 4,
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      borderLeft: `3px solid ${meta.color}`,
      color: meta.color,
      fontSize: 10,
      padding: '2px 4px',
      overflow: 'hidden',
      cursor: b.type === 'IDLE' ? 'default' : 'grab',
      opacity: dragPreview?.id === b.id ? 0.6 : 1,
      boxSizing: 'border-box',
      zIndex: b.type === 'IDLE' ? 0 : 2,
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1500, margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={20} color="#1677ff" />
            {t('title', '设备调度甘特图 V2')}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t('subtitle', '设备×时间周视图 · 检查/维护/空闲三色 · 拖拽调整 · 冲突检测')}</div>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={14} />} onClick={() => void fetchWeek()}>{t('refresh', '刷新')}</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setBlockModalOpen(true)}>{t('addBlock', '新建维护排程')}</Button>
        </Space>
      </div>

      {/* 统计条 */}
      {stats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {[
            { label: t('statBlocks', '排程块'), value: stats.totalBlocks, color: '#1677ff' },
            { label: t('statExams', '检查块'), value: stats.examBlocks, color: '#1d4ed8' },
            { label: t('statMaint', '维护块'), value: stats.maintenanceBlocks, color: '#b45309' },
            { label: t('statConflicts', '冲突'), value: stats.conflicts, color: '#f5222d' },
            { label: t('statIdle', '空闲小时'), value: stats.idleHours, color: '#15803d' },
          ].map((s) => (
            <Col xs={12} md={4} key={s.label}>
              <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
                <Statistic title={s.label} value={s.value} valueStyle={{ fontSize: 18, color: s.color }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 周导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Button size="small" icon={<ChevronLeft size={14} />} onClick={() => shiftWeek(-1)} />
        <Button size="small" onClick={goToday}>{t('thisWeek', '本周')}</Button>
        <Button size="small" icon={<ChevronRight size={14} />} onClick={() => shiftWeek(1)} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
          {view ? `${view.weekStart} ~ ${dayjs(view.weekStart).add(6, 'day').format('YYYY-MM-DD')}` : weekStart}
        </span>
        <Tag color="blue" style={{ fontSize: 11 }}>{t('weekHint', '周一 ~ 周日')}</Tag>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
          <GripVertical size={11} style={{ verticalAlign: -1 }} /> {t('dragHint', '拖拽检查/维护块可调整时间 (15 分钟吸附)')}
        </span>
      </div>

      {/* 冲突告警 */}
      {allConflicts.length > 0 && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          icon={<AlertTriangle size={14} />}
          message={`${t('conflictDetected', '检测到重叠排程')}: ${allConflicts.length} ${t('conflictUnit', '处')}`}
          description={
            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
              {allConflicts.slice(0, 6).map((c) => (
                <div key={c.blockId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0', fontSize: 12 }}>
                  <span>
                    <b>{c.title}</b> ({c.deviceName}) 与 [{c.overlapWith.join(', ')}] 重叠 · {c.suggestion.reason}
                  </span>
                  <Button size="small" type="link" loading={saving} onClick={() => void applySuggestion(c)}>
                    {t('applySuggestion', '应用建议')}
                  </Button>
                </div>
              ))}
            </div>
          }
        />
      )}

      {/* 甘特图 */}
      <Card size="small" styles={{ body: { padding: 8 } }}>
        {!view ? (
          <Spin>
            <div style={{ height: 200 }} />
          </Spin>
        ) : devices.length === 0 ? (
          <Empty description={t('noDevice', '暂无设备')} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 160 + DAY_WIDTH * 7 }}>
              {/* 表头 */}
              <div style={{ display: 'flex', marginBottom: 4 }}>
                <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: '#64748b', fontWeight: 600, padding: '0 8px' }}>
                  {t('device', '设备')}
                </div>
                {view.days.map((d, i) => {
                  const isToday = d.date === dayjs().format('YYYY-MM-DD')
                  return (
                    <div key={d.date} style={{ width: DAY_WIDTH, flexShrink: 0, textAlign: 'center', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: isToday ? '#1677ff' : '#334155' }}>
                        {d.label}
                        {isToday && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>今</Tag>}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>{d.date.slice(5)}</div>
                      {i > 0 && <div style={{ height: 1, background: '#f1f5f9' }} />}
                    </div>
                  )
                })}
              </div>
              {/* 设备行 */}
              {devices.map((dev) => {
                const utilization = dev.utilization
                return (
                  <div key={dev.deviceId} style={{ display: 'flex', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ width: 160, flexShrink: 0, padding: 6, fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{dev.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        <Tag style={{ fontSize: 10, marginInlineEnd: 4 }}>{dev.modality}</Tag>
                        {t('utilization', '利用率')} {utilization}%
                      </div>
                      <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${utilization}%`, height: '100%', background: utilization > 70 ? '#16a34a' : utilization > 40 ? '#f59e0b' : '#e11d48' }} />
                      </div>
                      {dev.conflicts.length > 0 && (
                        <div style={{ color: '#f5222d', fontSize: 11, marginTop: 2 }}>
                          <AlertTriangle size={11} style={{ verticalAlign: -1 }} /> {dev.conflicts.length} {t('conflictUnit', '处冲突')}
                        </div>
                      )}
                    </div>
                    {view.days.map((day, di) => {
                      const dayBlocks = dev.blocks.filter((b) => b.start.slice(0, 10) === day.date)
                      const offsetMin = dragPreview && dayBlocks.some((b) => b.id === dragPreview.id) ? dragPreview.offsetMin : 0
                      return (
                        <div
                          key={day.date}
                          style={{
                            width: DAY_WIDTH, flexShrink: 0, position: 'relative', height: ROW_HEIGHT,
                            background: di % 2 === 0 ? '#f8fafc' : '#fff',
                            borderRight: '1px solid #f1f5f9',
                          }}
                        >
                          {/* 小时刻度 */}
                          {Array.from({ length: WORK_END_HOUR - WORK_START_HOUR + 1 }, (_, h) => (
                            <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT + 24, left: 0, right: 0, height: 1, background: '#eef2f7', pointerEvents: 'none' }}>
                              <span style={{ position: 'absolute', left: 3, top: -8, fontSize: 9, color: '#cbd5e1' }}>
                                {h + WORK_START_HOUR}:00
                              </span>
                            </div>
                          ))}
                          {dayBlocks.map((b) => {
                            const meta = TYPE_META[b.type] ?? IDLE_FALLBACK
                            const inConflict = allConflicts.some((c) => c.blockId === b.id)
                            return (
                              <div
                                key={b.id}
                                style={{ ...blockStyle(b, offsetMin) }}
                                title={`${b.title} (${meta.label}) ${b.start.slice(11, 16)}-${b.end.slice(11, 16)}`}
                                onPointerDown={(e) => handleDragStart(e, b)}
                                onPointerMove={handleDragMove}
                                onPointerUp={() => void handleDragEnd()}
                                onPointerCancel={() => { dragRef.current = null; setDragPreview(null) }}
                              >
                                {inConflict && <AlertTriangle size={9} style={{ color: '#f5222d', marginRight: 2 }} />}
                                <b>{b.title}</b>
                                {b.patientName && <span style={{ marginLeft: 2 }}>({b.patientName})</span>}
                                <div style={{ opacity: 0.75 }}>{b.start.slice(11, 16)}-{b.end.slice(11, 16)}</div>
                                {b.type === 'MAINTENANCE' && (
                                  <span
                                    style={{ position: 'absolute', top: 2, right: 3, cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); void handleDeleteBlock(b.id) }}
                                    title={t('delete', '删除')}
                                  >
                                    <Wrench size={10} />
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 3, marginRight: 4, verticalAlign: -1 }} />{t('legendExam', '检查块 (可拖拽)')}</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 3, marginRight: 4, verticalAlign: -1 }} />{t('legendMaint', '维护块')}</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#dcfce7', border: '1px dashed #86efac', borderRadius: 3, marginRight: 4, verticalAlign: -1 }} />{t('legendIdle', '空闲时段')}</span>
        <span><Clock size={12} style={{ verticalAlign: -1 }} /> {t('workHours', '工作时段 08:00-18:00')}</span>
      </div>

      {/* 新建维护排程 Modal */}
      <Modal
        title={t('addBlock', '新建维护排程')}
        open={blockModalOpen}
        onCancel={() => setBlockModalOpen(false)}
        onOk={() => void handleCreateBlock()}
        confirmLoading={saving}
        okText={t('save', '保存')}
        cancelText={t('cancel', '取消')}
      >
        <Form form={blockForm} layout="vertical" initialValues={{ date: dayjs(), time: [dayjs('09:00', 'HH:mm'), dayjs('10:00', 'HH:mm')] }}>
          <Form.Item name="deviceId" label={t('device', '设备')} rules={[{ required: true, message: t('deviceRequired', '请选择设备') }]}>
            <Select
              placeholder={t('devicePlaceholder', '选择设备机房')}
              options={(view?.devices ?? []).map((d) => ({ value: d.deviceId, label: `${d.name} (${d.modality})` }))}
            />
          </Form.Item>
          <Form.Item name="title" label={t('blockTitle', '排程标题')} rules={[{ required: true, message: t('titleRequired', '请输入标题') }]}>
            <Input placeholder={t('blockTitlePlaceholder', '如: 预防性维护 · 球管更换')} />
          </Form.Item>
          <Form.Item name="date" label={t('date', '日期')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="time" label={t('timeRange', '时间段')} rules={[{ required: true }]}>
            <TimePicker.RangePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

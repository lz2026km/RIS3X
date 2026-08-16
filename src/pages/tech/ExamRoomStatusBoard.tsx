/**
 * G005 v3.0.6.11-100 Wave 1B - 检查间实时状态看板 (房间级)
 * 数据源: GET /worklist/room-status (后端按 device.location 聚合派生)
 * 实时: 30s 轮询 + socket 'room-status-refresh' / 'worklist-refresh' 推送刷新
 */
import { Alert, Button, Card, Col, Row, Space, Spin, Tag, Tooltip } from 'antd'
import { Activity, AlertTriangle, Camera, CheckCircle2, Clock, Database, DoorOpen, Hourglass, Monitor, PauseCircle, RefreshCw, UserRound, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { worklistApi, type RoomStatusItemDto } from '../../services/api/worklistApi'
import { realtime } from '../../services/realtime'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { EmptyState } from '../../components/common/EmptyState'

const STATUS_META: Record<RoomStatusItemDto['status'], { label: string; color: string; bg: string; border: string }> = {
  in_use: { label: '检查中', color: '#059669', bg: '#d1fae5', border: '#34d399' },
  paused: { label: '已暂停', color: '#d97706', bg: '#fef3c7', border: '#fbbf24' },
  overdue: { label: '超时待检', color: '#dc2626', bg: '#fee2e2', border: '#f87171' },
  waiting: { label: '排队中', color: '#2563eb', bg: '#dbeafe', border: '#60a5fa' },
  idle: { label: '空闲', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
}

const MODALITY_COLORS: Record<string, string> = {
  CT: '#2563eb', MR: '#7c3aed', DR: '#0d9488', US: '#db2777', MG: '#9333ea', DSA: '#dc2626',
}

const formatIdle = (iso: string | null): string => {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '刚刚'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时 ${min % 60} 分`
  return `${Math.floor(h / 24)} 天`
}

const formatClock = (iso: string | null): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false })
}

export default function ExamRoomStatusBoard() {
  const [rooms, setRooms] = useState<RoomStatusItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'api' | 'demo'>('api')
  const [updatedAt, setUpdatedAt] = useState('')
  const [tick, setTick] = useState(0)
  const timerRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await worklistApi.getRoomStatus()
      if (res.success && Array.isArray((res.data as { rooms?: unknown })?.rooms)) {
        setRooms((res.data as { rooms: RoomStatusItemDto[] }).rooms)
        setSource('api')
        setError('')
        setUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      } else {
        setError(res.error?.message ?? '房间状态加载失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '房间状态加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 30s 轮询
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      void load()
      setTick((t) => t + 1)
    }, 30_000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [load])

  // 实时推送: room-status-refresh (本看板) + worklist-refresh (工作列表变化兜底)
  useEffect(() => {
    realtime.connect()
    const offRoom = realtime.subscribe('room-status-refresh', () => void load())
    const offWorklist = realtime.subscribe('worklist-refresh', () => void load())
    return () => {
      offRoom()
      offWorklist()
    }
  }, [load])

  const stats = useMemo(() => {
    const by = (s: RoomStatusItemDto['status']) => rooms.filter((r) => r.status === s).length
    return {
      total: rooms.length,
      inUse: by('in_use'),
      overdue: by('overdue'),
      paused: by('paused'),
      waiting: by('waiting'),
      idle: by('idle'),
      queue: rooms.reduce((a, r) => a + r.queueLength, 0),
    }
  }, [rooms])

  const statusOrder = useMemo(() => {
    const order: Record<RoomStatusItemDto['status'], number> = { in_use: 0, overdue: 1, paused: 2, waiting: 3, idle: 4 }
    return [...rooms].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
  }, [rooms])

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <PageHeader
        icon={<Monitor size={20} color="#3b82f6" />}
        title="检查间实时状态看板"
        subtitle={updatedAt ? `更新于 ${updatedAt} · 第 ${tick} 次轮询` : '房间级 / 30s 轮询 + 实时推送'}
        actions={
          <>
            <Tag color="cyan">v3.0.6.11-100 Wave 1B</Tag>
            <Tag color="geekblue">房间级 / 30s 轮询 + 实时推送</Tag>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
          </>
        }
      />

      {error && (
        <Alert type="warning" showIcon message="部分数据未加载" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <StatCardGrid minWidth={150} gap={12} style={{ marginBottom: 16 }}>
        <StatCard title="房间总数" value={stats.total} icon={<DoorOpen size={16} />} color="info" loading={loading} />
        <StatCard title="检查中" value={stats.inUse} icon={<Activity size={16} />} color="success" loading={loading} />
        <StatCard title="超时待检" value={stats.overdue} icon={<AlertTriangle size={16} />} color="error" loading={loading} />
        <StatCard title="已暂停" value={stats.paused} icon={<PauseCircle size={16} />} color="warning" loading={loading} />
        <StatCard title="排队等待" value={stats.waiting} icon={<Hourglass size={16} />} color="info" loading={loading} />
        <StatCard title="待检人次" value={stats.queue} icon={<Users size={16} />} color="primary" loading={loading} />
      </StatCardGrid>

      {loading && rooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : statusOrder.length === 0 ? (
        <EmptyState description="暂无检查间数据" />
      ) : (
        <Row gutter={[14, 14]}>
          {statusOrder.map((room) => {
            const meta = STATUS_META[room.status] ?? STATUS_META.idle!
            const isBusy = room.status === 'in_use' || room.status === 'paused' || room.status === 'overdue'
            return (
              <Col key={room.roomId} xs={24} sm={12} md={8} lg={6}>
                <Card
                  size="small"
                  style={{ borderRadius: 10, border: `1px solid ${isBusy ? meta.border : 'var(--border-color)'}`, borderTop: `3px solid ${meta.border}` }}
                  styles={{ body: { padding: 14 } }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                      <DoorOpen size={15} color={meta.color} />
                      {room.name}
                    </div>
                  }
                  extra={<Tag color={MODALITY_COLORS[room.modality] ?? 'default'} style={{ marginRight: 0 }}>{room.modality || '—'}</Tag>}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      <Users size={11} style={{ verticalAlign: -1, marginRight: 3 }} />待检 {room.queueLength}
                    </span>
                  </div>

                  {room.currentExam ? (
                    <div style={{ background: 'var(--content-bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                        <UserRound size={13} color="#3b82f6" />
                        {room.currentExam.patientName}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                        <span>状态 {room.currentExam.state}</span>
                        <span style={{ fontFamily: 'monospace' }}>{formatClock(room.currentExam.startedAt)} 开始</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--content-bg)', borderRadius: 8, padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: 12, border: '1px dashed var(--border-color)' }}>
                      <Camera size={16} style={{ marginBottom: 4, opacity: 0.5 }} />
                      <div>当前无在检患者</div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                    <Clock size={11} />
                    空闲时长 {formatIdle(room.idleSince)}
                    {room.status === 'overdue' && (
                      <Tooltip title="最早到达患者已等待超过 30 分钟">
                        <AlertTriangle size={11} color="#dc2626" style={{ marginLeft: 4 }} />
                      </Tooltip>
                    )}
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      {/* 数据源徽标 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Space>
          <CheckCircle2 size={14} color={source === 'api' ? '#10b981' : '#f59e0b'} />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {source === 'api'
              ? '数据源: GET /worklist/room-status (后端房间聚合实时) · WS room-status-refresh 推送'
              : '数据源: 演示回退 (接口不可用, 基于本地派生)'}
          </span>
          <Database size={14} color="#94a3b8" />
        </Space>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { Eye, Play, User, Wrench, Trash2 } from 'lucide-react'
import { Popconfirm } from 'antd'
import { C, StatusBadge, ModalityBadge, ProgressBar } from './DeviceStatusBadge'

interface ExamRoom {
  deviceId?: string
  name: string
  todaysBookings: number
  currentPatient?: string
}

interface DeviceData {
  id: string
  name: string
  status: string
  manufacturer: string
  model: string
  modality: string
  capacity: number
  acquisitionYear?: number
  utilization: number
  todayBookings: number
  healthScore?: number
  [key: string]: unknown
}

function DeviceCard({ device, examRooms, onDetail, onExam, onMaintenance, onDelete, selectable, selected, onToggleSelect }: {
  device: DeviceData
  examRooms: ExamRoom[]
  onDetail: () => void
  onExam: () => void
  onMaintenance: () => void
  onDelete?: () => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const room = examRooms.find(r => r.deviceId === device.id)
  const todayExams = room?.todaysBookings || 0
  const loadPct = Math.round((todayExams / device.capacity) * 100)
  const isInUse = device.status === '使用中'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white, borderRadius: 12, border: `1px solid ${selected ? C.accent : hovered ? C.accent : C.border}`,
        boxShadow: selected ? `0 0 0 2px ${C.accent}33` : hovered ? '0 4px 16px rgba(30,58,95,0.12)' : '0 1px 4px rgba(30,58,95,0.05)',
        overflow: 'hidden', transition: 'all 0.2s', transform: hovered ? 'translateY(-2px)' : 'none'
      }}
    >
      <div style={{
        padding: '14px 16px', background: 'var(--bg-primary)', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {selectable && (
              <input
                type="checkbox"
                aria-label={`选择设备 ${device.name}`}
                checked={Boolean(selected)}
                onChange={() => onToggleSelect?.()}
                style={{ marginRight: 2 }}
              />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {device.name.split('（')[0]}
            </span>
            <ModalityBadge modality={device.modality} />
          </div>
          <div style={{ fontSize: 12, color: C.textLight }}>
            {device.manufacturer} · {device.model}
          </div>
        </div>
        <StatusBadge status={device.status} />
      </div>

      <div style={{ padding: 14 }}>
        {isInUse && room?.currentPatient && (
          <div style={{
            background: `${C.success}0d`, border: `1px solid ${C.success}25`,
            borderRadius: 8, padding: '8px 10px', marginBottom: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <User size={11} color={C.success} />
              <span style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>当前患者</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 1 }}>
              {room.currentPatient}
            </div>
            <div style={{ fontSize: 12.5, color: C.textMid }}>
              {room.name}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            ['检查室', room?.name || '-'],
            ['今日检查', `${todayExams} 例`],
            ['累计检查', `${device.capacity * 30} 例/月`],
            ['购置年份', device.acquisitionYear ? `${device.acquisitionYear}年` : '-'],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '5px 8px' }}>
              <div style={{ fontSize: 12, color: C.textLight }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginTop: 1 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: C.textMid }}>今日工作量</span>
            <span style={{
              fontSize: 12, fontWeight: 800,
              color: loadPct > 90 ? C.danger : loadPct > 70 ? C.warning : C.success
            }}>
              {loadPct}%
            </span>
          </div>
          <ProgressBar value={todayExams} max={device.capacity} />
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 2, textAlign: 'right' }}>
            {todayExams} / {device.capacity} 例
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', background: `${C.accent}0d`, borderRadius: 6, marginBottom: 10
        }}>
          <span style={{ fontSize: 12, color: C.textMid }}>设备利用率</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{device.utilization}%</span>
        </div>

        <div style={{ fontSize: 12.5, color: C.textLight, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
          <span>最后维保：2026-04-{10 + Math.floor(Math.random() * 20)}</span>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: `1px solid ${C.border}`,
      }}>
        {[
          { label: '详情', icon: <Eye size={11} />, on: onDetail, color: C.accent },
          { label: isInUse ? '检查中' : '开始检查', icon: <Play size={11} />, on: onExam, color: C.success, disabled: device.status !== '空闲' && device.status !== '使用中' },
          { label: '维保', icon: <Wrench size={11} />, on: onMaintenance, color: C.warning },
          ...(onDelete ? [{ label: '删除', icon: <Trash2 size={11} />, on: onDelete, color: C.danger }] : []),
        ].map(btn => {
          const actionButton = (
            <button
              key={btn.label}
              onClick={btn.on}
              disabled={btn.disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 4px', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: 'transparent', color: btn.disabled ? C.textLight : btn.color,
                transition: 'background 0.15s',
                opacity: btn.disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!btn.disabled) (e.target as HTMLElement).style.background = `${btn.color}0f` }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
            >
              {btn.icon}
              {btn.label}
            </button>
          )
          return btn.label === '删除' && btn.on ? (
            <Popconfirm
              key={btn.label}
              title="确认删除该设备？"
              description="删除后不可恢复"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={btn.on}
            >
              {actionButton}
            </Popconfirm>
          ) : actionButton
        })}
      </div>
    </div>
  )
}

export { DeviceCard }
export type { DeviceData, ExamRoom }

export function DeviceList({ devices, examRooms, onDetail, onExam, onMaintenance, onDelete, selectedIds, onToggleSelect }: {
  devices: DeviceData[]
  examRooms: ExamRoom[]
  onDetail: (device: DeviceData) => void
  onExam: (device: DeviceData) => void
  onMaintenance: (device: DeviceData) => void
  onDelete?: (device: DeviceData) => void
  // [W14-UX] 批量选择
  selectedIds?: Set<string>
  onToggleSelect?: (device: DeviceData) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
      {devices.map(device => (
        <DeviceCard
          key={device.id}
          device={device}
          examRooms={examRooms}
          onDetail={() => onDetail(device)}
          onExam={() => onExam(device)}
          onMaintenance={() => onMaintenance(device)}
          onDelete={onDelete ? () => onDelete(device) : undefined}
          selectable={Boolean(onToggleSelect)}
          selected={Boolean(selectedIds?.has(device.id))}
          onToggleSelect={() => onToggleSelect?.(device)}
        />
      ))}
    </div>
  )
}

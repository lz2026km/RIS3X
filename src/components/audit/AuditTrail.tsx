import { useState, useMemo } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Timeline, Tag, Space, Card, Empty, Segmented } from 'antd'
import { Clock, User, Globe, ChevronDown, ChevronRight, Diff } from 'lucide-react'

interface AuditActor {
  id: string
  name: string
  role?: string
}

interface AuditTarget {
  type: string
  id: string
  name?: string
}

interface AuditEvent {
  id: string
  timestamp: string
  actor: AuditActor
  action: string
  target: AuditTarget
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ipAddress?: string
  metadata?: Record<string, unknown>
}

export interface AuditTrailProps {
  resourceType: string
  resourceId?: string
  events: AuditEvent[]
  renderers?: Record<string, (event: AuditEvent) => ReactNode>
  title?: string
}

const timelineItemStyle: CSSProperties = {
  padding: '4px 0',
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

function DiffView({ before, after }: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }) {
  if (!before && !after) return <span style={{ fontSize: 12, color: '#94a3b8' }}>无变更</span>
  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changes = Array.from(allKeys).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))

  if (changes.length === 0) return <span style={{ fontSize: 12, color: '#94a3b8' }}>无变更</span>

  return (
    <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 6, padding: 8, fontSize: 12, fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' }}>
      {changes.map((key) => (
        <div key={key} style={{ marginBottom: 4, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{key}:</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {before?.[key] !== undefined && (
              <div style={{ flex: 1, background: '#fef2f2', padding: '2px 6px', borderRadius: 4, color: '#dc2626' }}>
                <span style={{ fontSize: 12, color: '#dc2626' }}>- {JSON.stringify(before[key])}</span>
              </div>
            )}
            {after?.[key] !== undefined && (
              <div style={{ flex: 1, background: '#f0fdf4', padding: '2px 6px', borderRadius: 4, color: '#16a34a' }}>
                <span style={{ fontSize: 12, color: '#16a34a' }}>+ {JSON.stringify(after[key])}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const actionColorMap: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  sign: 'purple',
  submit: 'geekblue',
  approve: 'cyan',
  reject: 'orange',
  publish: 'gold',
  archive: 'default',
}

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(actionColorMap)) {
    if (action.toLowerCase().includes(key)) return color
  }
  return 'default'
}

export function AuditTrail({
  resourceType,
  events,
  renderers = {},
  title,
}: AuditTrailProps) {
  const [viewMode, setViewMode] = useState<string>('timeline')
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [events],
  )

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (events.length === 0) {
    return (
      <Card title={title ?? '审计轨迹'} size="small">
        <Empty description="暂无审计记录" />
      </Card>
    )
  }

  const timelineItems = sorted.map((event) => {
    const isExpanded = expandedEvents.has(event.id)
    const hasDiff = event.before || event.after
    const customRender = renderers[event.action]

    return {
      color: event.action.toLowerCase().includes('delete') ? 'red' : event.action.toLowerCase().includes('create') ? 'green' : 'blue',
      children: (
        <div style={timelineItemStyle} key={event.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <Space size={6} wrap>
              <User size={14} style={{ color: '#64748b' }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{event.actor.name}</span>
              {event.actor.role && <Tag style={{ fontSize: 11, lineHeight: '18px' }}>{event.actor.role}</Tag>}
              <Tag color={getActionColor(event.action)} style={{ fontSize: 11, lineHeight: '18px' }}>{event.action}</Tag>
            </Space>
            <Space size={12} wrap>
              {event.ipAddress && (
                <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={12} /> {event.ipAddress}
                </span>
              )}
              <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {formatTime(event.timestamp)}
              </span>
            </Space>
          </div>

          <div style={{ marginTop: 4, marginLeft: 22 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              操作对象: {event.target.type} / {event.target.name ?? event.target.id}
            </span>
          </div>

          {hasDiff && (
            <div style={{ marginLeft: 22, marginTop: 4 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#3b82f6' }}
                onClick={() => toggleExpand(event.id)}
                role="button"
                tabIndex={0}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Diff size={14} />
                <span>查看变更</span>
              </div>
              {isExpanded && <DiffView before={event.before} after={event.after} />}
            </div>
          )}

          {customRender && isExpanded && (
            <div style={{ marginLeft: 22, marginTop: 8 }}>{customRender(event)}</div>
          )}
        </div>
      ),
    }
  })

  return (
    <Card
      title={title ?? `审计轨迹: ${resourceType}`}
      size="small"
      extra={
        <Segmented
          size="small"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { label: '时间线', value: 'timeline' },
            { label: '列表', value: 'list' },
          ]}
        />
      }
    >
      {viewMode === 'timeline' ? (
        <Timeline items={timelineItems} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((event) => (
            <div
              key={event.id}
              style={{
                padding: 12,
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: 6,
                background: '#fafafa',
              }}
            >
              <Space size={6} wrap>
                <Tag color={getActionColor(event.action)}>{event.action}</Tag>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{event.actor.name}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatTime(event.timestamp)}</span>
                {event.ipAddress && <span style={{ fontSize: 12, color: '#94a3b8' }}>IP: {event.ipAddress}</span>}
              </Space>
              <div style={{ marginTop: 4 }}>
                <DiffView before={event.before} after={event.after} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default AuditTrail

/**
 * G005 放射RIS系统 v3.0.1 - 任务拖拽改派
 * 对标东软 / 英飞达 — 看板列间拖拽
 */
import React, { useState, useCallback } from 'react'
import { Card, Tag, Space, Avatar, Tooltip, message } from 'antd'
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { User, Clock, GripVertical } from 'lucide-react'

export interface WorklistItem {
  id: string
  patientName: string
  modality: string
  bodyPart: string
  status: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignee?: string
  age?: number
  gender?: string
  studyDate?: string
}

export interface WorklistColumn {
  id: string
  title: string
  color: string
  items: WorklistItem[]
}

export interface TaskDragAssignProps {
  columns: WorklistColumn[]
  onAssign?: (itemId: string, fromColumn: string, toColumn: string, assignee?: string) => void
  onItemClick?: (item: WorklistItem) => void
  assignees?: { id: string; name: string; color?: string }[]
}

const priorityColor: Record<WorklistItem['priority'], string> = {
  low: 'default',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
}

const DraggableCard: React.FC<{
  item: WorklistItem
  onClick?: (item: WorklistItem) => void
  columnId: string
}> = ({ item, onClick, columnId }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${columnId}::${item.id}`,
    data: { item, columnId },
  })

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} data-testid={`task-card-${item.id}`}>
      <Card
        size="small"
        hoverable
        onClick={() => onClick?.(item)}
        style={{ marginBottom: 8, borderLeft: `4px solid var(--ant-color-${priorityColor[item.priority]})` }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              <span {...attributes} {...listeners} style={{ marginRight: 6, color: '#94a3b8' }}>
                <GripVertical size={12} />
              </span>
              {item.patientName}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {item.age ? `${item.age}岁` : ''} {item.gender ?? ''} · {item.modality} · {item.bodyPart}
            </div>
            {item.studyDate && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                <Clock size={10} style={{ verticalAlign: 'middle' }} /> {item.studyDate}
              </div>
            )}
          </div>
          <Space orientation="vertical" size={4} align="end">
            <Tag color={priorityColor[item.priority]}>{item.priority}</Tag>
            {item.assignee && (
              <Tooltip title={item.assignee}>
                <Avatar size="small" style={{ background: '#1e3a5f' }}>
                  {item.assignee.slice(0, 1)}
                </Avatar>
              </Tooltip>
            )}
          </Space>
        </div>
      </Card>
    </div>
  )
}

const DroppableColumn: React.FC<{
  column: WorklistColumn
  onItemClick?: (item: WorklistItem) => void
}> = ({ column, onItemClick }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <div
      ref={setNodeRef}
      data-testid={`task-column-${column.id}`}
      style={{
        background: isOver ? '#eef2ff' : '#f8fafc',
        border: `1px solid ${isOver ? '#6366f1' : '#e2e8f0'}`,
        borderRadius: 8,
        padding: 8,
        minWidth: 240,
        minHeight: 400,
        transition: 'all 0.15s',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: column.color,
          marginBottom: 8,
          padding: '4px 8px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{column.title}</span>
        <Tag>{column.items.length}</Tag>
      </div>
      <div>
        {column.items.map((item) => (
          <DraggableCard
            key={item.id}
            item={item}
            columnId={column.id}
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  )
}

export const TaskDragAssign: React.FC<TaskDragAssignProps> = ({ columns: initialColumns, onAssign, onItemClick }) => {
  const [columns, setColumns] = useState(initialColumns)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const [fromCol, itemId] = String(active.id).split('::') as [string, string]
      const toCol = String(over.id)
      if (fromCol === toCol) return
      setColumns((cols) => {
        const next = cols.map((c) => ({ ...c, items: [...c.items] }))
        const from = next.find((c) => c.id === fromCol)
        const to = next.find((c) => c.id === toCol)
        if (!from || !to) return cols
        const idx = from.items.findIndex((i) => i.id === itemId)
        if (idx === -1) return cols
        const [item] = from.items.splice(idx, 1)
        if (item) to.items.push(item)
        onAssign?.(itemId, fromCol, toCol)
        message.success(`已分配:${item?.patientName ?? itemId} → ${to.title}`)
        return next
      })
    },
    [onAssign]
  )

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: 4 }}>
        {columns.map((c) => (
          <DroppableColumn key={c.id} column={c} onItemClick={onItemClick} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
        <User size={10} /> 提示:拖拽卡片到目标列完成改派
      </div>
    </DndContext>
  )
}

export default TaskDragAssign

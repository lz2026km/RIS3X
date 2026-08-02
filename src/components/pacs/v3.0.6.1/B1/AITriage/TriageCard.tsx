/**
 * G005 放射RIS系统 v3.0.6.1 - AI 分诊卡片 (单条)
 */
import React from 'react'
import { Card, Tag, Space, Button, Tooltip } from 'antd'
import { Clock, User, Activity, Brain } from 'lucide-react'
import { PriorityBadge } from './PriorityBadge'

export interface TriageItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  category: string
  confidence: number
  arrivedAt: string
  priority: 'STAT' | 'URGENT' | 'ROUTINE'
  aiFlag: boolean
  assignee?: string
}

export interface TriageCardProps {
  item: TriageItem
  compact?: boolean
  onAssign?: (id: string) => void
  onOpen?: (id: string) => void
}

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  STROKE: { label: '脑卒中', color: 'red' },
  PE: { label: '肺栓塞', color: 'volcano' },
  TRAUMA: { label: '多发伤', color: 'orange' },
  AAA: { label: '主动脉夹层', color: 'magenta' },
  HEMORRHAGE: { label: '脑出血', color: 'purple' },
  FRACTURE: { label: '骨折', color: 'gold' },
  OTHER: { label: '其他', color: 'blue' },
}

export const TriageCard: React.FC<TriageCardProps> = ({ item, compact = false, onAssign, onOpen }) => {
  const cat: { label: string; color: string } = CATEGORY_LABEL[item.category] ?? CATEGORY_LABEL.OTHER!
  return (
    <Card
      size="small"
      data-testid={`triage-card-${item.id}`}
      style={{ marginBottom: 8, borderLeft: `4px solid ${item.priority === 'STAT' ? '#dc2626' : '#f59e0b'}` }}
      bodyStyle={{ padding: compact ? 8 : 12 }}
    >
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color={cat.color} style={{ fontWeight: 600 }}>{cat.label}</Tag>
          <PriorityBadge priority={item.priority} />
          {item.aiFlag && <Tag color="purple" icon={<Brain size={10} />}>AI</Tag>}
          <Tag color="blue">{item.modality} {item.bodyPart}</Tag>
        </Space>
        <Space wrap size={4}>
          <User size={12} /> <span style={{ fontWeight: 500 }}>{item.patientName}</span>
          <Tag>{item.patientId}</Tag>
        </Space>
        <Space wrap size={4} style={{ fontSize: 12, color: '#64748b' }}>
          <Clock size={10} /> {item.arrivedAt}
          <Activity size={10} /> 置信度 {(item.confidence * 100).toFixed(0)}%
        </Space>
        {!compact && (
          <Space style={{ marginTop: 4 }}>
            <Button size="small" type="primary" onClick={() => onAssign?.(item.id)} data-testid={`assign-${item.id}`}>
              分派
            </Button>
            <Button size="small" onClick={() => onOpen?.(item.id)}>详情</Button>
            <Tooltip title="AI 推断依据">
              <Button size="small" type="text" icon={<Brain size={12} />}>AI 依据</Button>
            </Tooltip>
          </Space>
        )}
      </Space>
    </Card>
  )
}

export default TriageCard
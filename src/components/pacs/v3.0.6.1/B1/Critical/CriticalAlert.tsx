/**
 * G005 放射RIS系统 v3.0.6.1 - 危急值告警项
 */
import React from 'react'
import { Card, Tag, Space } from 'antd'
import { AlertCircle, Clock, CheckCircle } from 'lucide-react'
import type { CriticalFlowItem } from './CriticalFlow'

export interface CriticalAlertProps {
  item: CriticalFlowItem
  selected?: boolean
  onClick?: () => void
}

const CATEGORY_META = {
  LIFE_THREATENING: { color: 'red', label: '危及生命' },
  URGENT: { color: 'orange', label: '紧急' },
  IMPORTANT: { color: 'gold', label: '重要' },
}

export const CriticalAlert: React.FC<CriticalAlertProps> = ({ item, selected, onClick }) => {
  const cat = CATEGORY_META[item.category]
  const isAcked = !!item.acknowledgedAt
  return (
    <Card
      size="small"
      hoverable
      onClick={onClick}
      data-testid={`critical-alert-${item.id}`}
      style={{
        borderColor: selected ? '#3b82f6' : isAcked ? '#16a34a' : '#dc2626',
        borderLeft: `4px solid ${isAcked ? '#16a34a' : '#dc2626'}`,
      }}
    >
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap>
          <AlertCircle size={14} color={isAcked ? '#16a34a' : '#dc2626'} />
          <span style={{ fontWeight: 600 }}>{item.patientName}</span>
          <Tag>{item.patientId}</Tag>
          <Tag color={cat.color}>{cat.label}</Tag>
          {isAcked ? <Tag color="green" icon={<CheckCircle size={10} />}>已确认</Tag> : <Tag color="red" icon={<Clock size={10} />}>待确认</Tag>}
        </Space>
        <div style={{ fontSize: 12 }}>所见:{item.finding}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.triggeredAt}</div>
      </Space>
    </Card>
  )
}

export default CriticalAlert
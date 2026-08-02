/**
 * G005 放射RIS系统 v3.0.6.1 - CAD 检出卡片 (通用)
 */
import React from 'react'
import { Card, Tag, Space, Button, Progress } from 'antd'

export type CADSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export interface CADDetection {
  id: string
  patientId: string
  patientName: string
  finding: string
  confidence: number
  severity: CADSeverity
  location: string
  laterality: 'LEFT' | 'RIGHT' | 'BILATERAL'
  size_mm?: number
  followUp?: string
  aiEngine?: string
}

export interface DetectionCardProps {
  detection: CADDetection
  onAccept?: () => void
  onReject?: () => void
}

const SEV_META: Record<CADSeverity, { color: string; label: string }> = {
  LOW: { color: 'green', label: '低' },
  MODERATE: { color: 'orange', label: '中' },
  HIGH: { color: 'red', label: '高' },
  CRITICAL: { color: 'magenta', label: '危急' },
}

export const DetectionCard: React.FC<DetectionCardProps> = ({ detection, onAccept, onReject }) => {
  const sev = SEV_META[detection.severity]
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderLeft: `4px solid ${sev.color === 'magenta' ? '#c026d3' : sev.color === 'red' ? '#dc2626' : sev.color === 'orange' ? '#f59e0b' : '#16a34a'}` }}
      data-testid={`cad-${detection.id}`}
    >
      <Space orientation="vertical" size={6} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color={sev.color}>{sev.label}</Tag>
          <Tag color="blue">{detection.laterality}</Tag>
          <Tag>{detection.location}</Tag>
          {detection.size_mm && <Tag color="purple">{detection.size_mm} mm</Tag>}
          <span style={{ fontWeight: 600 }}>{detection.finding}</span>
        </Space>
        <div style={{ fontSize: 12 }}>
          患者:{detection.patientName} ({detection.patientId})
        </div>
        <Progress percent={Math.round(detection.confidence * 100)} size="small" />
        {detection.followUp && <div style={{ fontSize: 12, color: '#64748b' }}>建议:{detection.followUp}</div>}
        {detection.aiEngine && <Tag color="cyan">{detection.aiEngine}</Tag>}
        <Space>
          <Button size="small" type="primary" onClick={onAccept}>采纳</Button>
          <Button size="small" danger onClick={onReject}>拒绝</Button>
        </Space>
      </Space>
    </Card>
  )
}

export default DetectionCard
/**
 * G005 放射RIS系统 v3.0.6.1 - AI 胸部检出列表
 */
import React from 'react'
import { List, Tag, Space, Button, Progress } from 'antd'

export type ChestFindingType = 'NODULE' | 'MASS' | 'CALCIFICATION' | 'EFFUSION' | 'CONSOLIDATION'

export interface ChestFinding {
  id: string
  type: ChestFindingType
  location: string
  size_mm: number
  confidence: number
  lungRads?: string
  malignant: number
  followUp?: string
}

export interface DetectionListProps {
  findings: ChestFinding[]
  selected?: string | null
  onSelect?: (id: string) => void
  onAccept?: (id: string) => void
}

const TYPE_META: Record<ChestFindingType, { color: string; label: string }> = {
  NODULE: { color: 'orange', label: '结节' },
  MASS: { color: 'red', label: '肿块' },
  CALCIFICATION: { color: 'gold', label: '钙化' },
  EFFUSION: { color: 'blue', label: '积液' },
  CONSOLIDATION: { color: 'purple', label: '实变' },
}

export const DetectionList: React.FC<DetectionListProps> = ({ findings, selected, onSelect, onAccept }) => {
  return (
    <List
      size="small"
      dataSource={findings}
      data-testid="detection-list"
      renderItem={(f) => {
        const meta = TYPE_META[f.type]
        const isSel = f.id === selected
        return (
          <List.Item
            key={f.id}
            data-testid={`finding-${f.id}`}
            onClick={() => onSelect?.(f.id)}
            style={{
              cursor: 'pointer',
              padding: 8,
              background: isSel ? '#eef2ff' : 'transparent',
              borderRadius: 4,
              border: isSel ? '1px solid #6366f1' : '1px solid transparent',
            }}
            actions={[
              <Button key="acc" size="small" type="link" onClick={(e) => { e.stopPropagation(); onAccept?.(f.id) }}>采纳</Button>,
            ]}
          >
            <Space orientation="vertical" size={2} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color={meta.color}>{meta.label}</Tag>
                <Tag color="blue">{f.size_mm} mm</Tag>
                {f.lungRads && <Tag color="purple">Lung-RADS {f.lungRads}</Tag>}
                <Tag color={f.malignant > 0.5 ? 'red' : f.malignant > 0.2 ? 'orange' : 'green'}>
                  恶性 {(f.malignant * 100).toFixed(0)}%
                </Tag>
              </Space>
              <div style={{ fontSize: 12 }}>{f.location}</div>
              <Progress
                percent={Math.round(f.confidence * 100)}
                size="small"
                showInfo={false}
                strokeColor="#3b82f6"
              />
              {f.followUp && <div style={{ fontSize: 12, color: '#64748b' }}>建议:{f.followUp}</div>}
            </Space>
          </List.Item>
        )
      }}
    />
  )
}

export default DetectionList
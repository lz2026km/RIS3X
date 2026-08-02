/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens 乳腺 CAD
 */
import React from 'react'
import { Card, Row, Col, Statistic, Tag } from 'antd'
import { DetectionCard, type CADDetection } from './DetectionCard'

const MOCK: CADDetection[] = [
  { id: 'M001', patientId: 'P101', patientName: '陈丽', finding: '微钙化簇', confidence: 0.82, severity: 'MODERATE', location: '左乳外上', laterality: 'LEFT', size_mm: 8, followUp: '活检', aiEngine: 'syngo.Mammo CAD' },
  { id: 'M002', patientId: 'P102', patientName: '林芳', finding: '肿块伴毛刺', confidence: 0.91, severity: 'HIGH', location: '右乳中央区', laterality: 'RIGHT', size_mm: 16, followUp: '立即活检', aiEngine: 'syngo.Mammo CAD' },
]

export interface CADMammoProps {
  onAccept?: (d: CADDetection) => void
}

export const CADMammo: React.FC<CADMammoProps> = ({ onAccept }) => {
  return (
    <div data-testid="cad-mammo">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总检出" value={MOCK.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="高危"
              value={MOCK.filter((d) => d.severity === 'HIGH' || d.severity === 'CRITICAL').length}
              styles={{ content: {  color: '#dc2626'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均置信度" value={MOCK.reduce((s, d) => s + d.confidence, 0) / MOCK.length} precision={2} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Tag color="blue">BI-RADS 兼容</Tag>
          </Card>
        </Col>
      </Row>
      <Card size="small" title="乳腺 CAD 检出">
        {MOCK.map((d) => (
          <DetectionCard key={d.id} detection={d} onAccept={() => onAccept?.(d)} />
        ))}
      </Card>
    </div>
  )
}

export default CADMammo
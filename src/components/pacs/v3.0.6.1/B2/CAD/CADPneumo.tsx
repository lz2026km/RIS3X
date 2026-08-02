/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens CAD Pneumothorax (气胸检测)
 */
import React, { useState } from 'react'
import { Card, Row, Col, Statistic, Switch, Slider, Space } from 'antd'
import { Wind, AlertCircle } from 'lucide-react'
import { DetectionCard, type CADDetection } from './DetectionCard'

const MOCK: CADDetection[] = [
  { id: 'P001', patientId: 'P001', patientName: '王建国', finding: '右侧少量气胸', confidence: 0.89, severity: 'MODERATE', location: '右肺尖', laterality: 'RIGHT', size_mm: 18, followUp: '立即胸外科会诊', aiEngine: 'syngo.CT Pneumothorax CAD' },
  { id: 'P002', patientId: 'P002', patientName: '李美芳', finding: '左侧张力性气胸', confidence: 0.94, severity: 'CRITICAL', location: '左侧胸腔', laterality: 'LEFT', size_mm: 65, followUp: '紧急胸腔闭式引流', aiEngine: 'syngo.CT Pneumothorax CAD' },
]

export interface CADPneumoProps {
  onAccept?: (d: CADDetection) => void
}

export const CADPneumo: React.FC<CADPneumoProps> = ({ onAccept }) => {
  const [threshold, setThreshold] = useState(0.5)
  const [autoAck, setAutoAck] = useState(false)
  const filtered = MOCK.filter((d) => d.confidence >= threshold)

  return (
    <div data-testid="cad-pneumo">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="候选" value={MOCK.length} prefix={<Wind size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="危急"
              value={MOCK.filter((d) => d.severity === 'CRITICAL').length}
              styles={{ content: {  color: '#dc2626'  } }}
              prefix={<AlertCircle size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="阈值显示" value={filtered.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <span style={{ fontSize: 12 }}>阈值:{threshold.toFixed(2)}</span>
              <Slider min={0} max={1} step={0.05} value={threshold} onChange={setThreshold} />
              <Switch size="small" checked={autoAck} onChange={setAutoAck} checkedChildren="自动确认" unCheckedChildren="手动" />
            </Space>
          </Card>
        </Col>
      </Row>
      <Card size="small" title="气胸检测">
        {filtered.map((d) => (
          <DetectionCard key={d.id} detection={d} onAccept={() => onAccept?.(d)} />
        ))}
      </Card>
    </div>
  )
}

export default CADPneumo
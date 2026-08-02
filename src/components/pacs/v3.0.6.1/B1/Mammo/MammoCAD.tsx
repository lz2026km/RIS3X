/**
 * G005 放射RIS系统 v3.0.6.1 - GE 乳腺 CAD (钼靶)
 * 对标:GE Breast AI/CAD
 */
import React, { useState } from 'react'
import { Card, Row, Col, Tag, Statistic, Space, Button, Slider, Switch } from 'antd'
import { Eye, Zap } from 'lucide-react'
import { MammoOverlay, type MammoLesionMark } from './MammoOverlay'

export interface MammoCADProps {
  patientId?: string
  onAccept?: (mark: MammoLesionMark) => void
}

export const MammoCAD: React.FC<MammoCADProps> = ({ patientId = 'P20240618001', onAccept }) => {
  const [threshold, setThreshold] = useState(0.5)
  const [showOverlay, setShowOverlay] = useState(true)
  const [marks] = useState<MammoLesionMark[]>([
    { id: 'm1', x: 35, y: 40, type: 'MASS', confidence: 0.82, birads: '4A', size_mm: 12 },
    { id: 'm2', x: 65, y: 70, type: 'CALCIFICATION', confidence: 0.74, birads: '3', size_mm: 6 },
    { id: 'm3', x: 50, y: 55, type: 'MASS', confidence: 0.45, birads: '2', size_mm: 4 },
  ])

  const filtered = marks.filter((m) => m.confidence >= threshold)

  return (
    <div data-testid="mammo-cad">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}><Card size="small"><Statistic title="候选病灶" value={marks.length} prefix={<Eye size={14} />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="高置信" value={marks.filter((m) => m.confidence >= 0.8).length} styles={{ content: {  color: '#dc2626'  } }} prefix={<Zap size={14} />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="阈值显示" value={filtered.length} /></Card></Col>
        <Col span={9}>
          <Card size="small">
            <Space wrap>
              <span style={{ fontSize: 12 }}>显示阈值:{threshold.toFixed(2)}</span>
              <Slider min={0} max={1} step={0.05} value={threshold} onChange={setThreshold} style={{ width: 140 }} />
              <Switch size="small" checked={showOverlay} onChange={setShowOverlay} />
              <span style={{ fontSize: 12 }}>叠加</span>
              <Tag color="purple">患者 {patientId}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={14}>
          <MammoOverlay marks={filtered} show={showOverlay} onAccept={onAccept} />
        </Col>
        <Col span={10}>
          <Card size="small" title="病灶列表">
            {marks.map((m) => (
              <div
                key={m.id}
                data-testid={`mammo-mark-${m.id}`}
                style={{ padding: 8, marginBottom: 6, border: '1px solid #e2e8f0', borderRadius: 4 }}
              >
                <Space wrap>
                  <Tag color={m.type === 'MASS' ? 'red' : 'orange'}>{m.type === 'MASS' ? '肿块' : '钙化'}</Tag>
                  <Tag color="blue">{m.size_mm} mm</Tag>
                  <Tag color="purple">BI-RADS {m.birads}</Tag>
                  <Tag color={m.confidence >= 0.8 ? 'red' : m.confidence >= 0.5 ? 'orange' : 'green'}>
                    {(m.confidence * 100).toFixed(0)}%
                  </Tag>
                  <Button size="small" type="primary" onClick={() => onAccept?.(m)}>采纳</Button>
                  <Button size="small">拒绝</Button>
                </Space>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default MammoCAD
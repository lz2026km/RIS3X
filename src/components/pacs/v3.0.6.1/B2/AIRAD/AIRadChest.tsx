/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens AI-Rad Companion Chest (胸部 CT)
 * 对标:Siemens AI-Rad Companion - 肺结节自动检出 + Lung-RADS 分级
 */
import React, { useState } from 'react'
import { Card, Row, Col, Tag, Space, Statistic, Switch, Button } from 'antd'
import { Brain, Eye, TrendingUp } from 'lucide-react'
import { DetectionList, type ChestFinding } from './DetectionList'
import { NoduleView } from './NoduleView'
import { AIRadStats } from './AIRadStats'

const MOCK_FINDINGS: ChestFinding[] = [
  { id: 'F001', type: 'NODULE', location: '右肺上叶尖后段', size_mm: 8.5, confidence: 0.92, lungRads: '4A', malignant: 0.42, followUp: '3 个月低剂量 CT' },
  { id: 'F002', type: 'NODULE', location: '左肺下叶背段', size_mm: 5.2, confidence: 0.78, lungRads: '3', malignant: 0.12, followUp: '6 个月低剂量 CT' },
  { id: 'F003', type: 'CALCIFICATION', location: '右肺中叶', size_mm: 3.0, confidence: 0.85, lungRads: '2', malignant: 0.02, followUp: '常规年度筛查' },
  { id: 'F004', type: 'MASS', location: '左肺门', size_mm: 28.0, confidence: 0.96, lungRads: '4X', malignant: 0.88, followUp: '立即临床评估' },
  { id: 'F005', type: 'NODULE', location: '右肺下叶基底段', size_mm: 4.0, confidence: 0.65, lungRads: '2', malignant: 0.05, followUp: '12 个月随访' },
]

export interface AIRadChestProps {
  patientId?: string
  onAcceptFinding?: (id: string) => void
}

export const AIRadChest: React.FC<AIRadChestProps> = ({ patientId = 'P20240618001', onAcceptFinding }) => {
  const [findings] = useState<ChestFinding[]>(MOCK_FINDINGS)
  const [showAiOverlay, setShowAiOverlay] = useState(true)
  const [selected, setSelected] = useState<string | null>(MOCK_FINDINGS[0]?.id ?? null)

  const stats = {
    total: findings.length,
    highRisk: findings.filter((f) => Number(f.lungRads?.charAt(0) ?? '0') >= 4).length,
    malignant: findings.filter((f) => f.malignant > 0.5).length,
    avgConf: findings.length ? findings.reduce((s, f) => s + f.confidence, 0) / findings.length : 0,
  }

  const current = findings.find((f) => f.id === selected) ?? findings[0]

  return (
    <div data-testid="ai-rad-chest">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="检出总数" value={stats.total} prefix={<Eye size={14} color="#3b82f6" />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="高风险(Lung-RADS 4+)"
              value={stats.highRisk}
              styles={{ content: {  color: '#dc2626'  } }}
              prefix={<Brain size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="恶性概率 > 50%"
              value={stats.malignant}
              styles={{ content: {  color: '#dc2626'  } }}
              prefix={<TrendingUp size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均置信度"
              value={stats.avgConf}
              precision={2}
              styles={{ content: {  color: '#16a34a'  } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={10}>
          <Card size="small" title="AI 检出列表" extra={<Tag color="purple">AI-Rad Companion</Tag>}>
            <DetectionList findings={findings} selected={selected} onSelect={setSelected} onAccept={onAcceptFinding} />
          </Card>
        </Col>
        <Col span={14}>
          <Card
            size="small"
            title={current ? `病灶:${current.location}` : '病灶视图'}
            extra={
              <Space>
                <Switch size="small" checked={showAiOverlay} onChange={setShowAiOverlay} />
                <span style={{ fontSize: 12 }}>AI 叠加</span>
              </Space>
            }
          >
            <NoduleView finding={current} showOverlay={showAiOverlay} />
            <Space style={{ marginTop: 8 }}>
              <Tag color="blue">患者:{patientId}</Tag>
              <Tag color="purple">Lung-RADS {current?.lungRads}</Tag>
              <Button size="small" type="primary">采纳</Button>
              <Button size="small">拒绝</Button>
            </Space>
          </Card>
          <div style={{ height: 12 }} />
          <AIRadStats findings={findings} />
        </Col>
      </Row>
    </div>
  )
}

export default AIRadChest
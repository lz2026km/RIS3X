/**
 * G005 放射RIS系统 v3.0.6.1 - AI 模型卡片 (Model Card 标准)
 */
import React from 'react'
import { Card, Tag, Space, Descriptions, Progress, Button } from 'antd'
import { Box, FileText, Shield } from 'lucide-react'

export interface ModelCardProps {
  name: string
  version: string
  vendor: string
  taskType: string
  modality: string
  bodyPart: string
  trainedOn: string
  metrics: {
    accuracy: number
    recall: number
    precision: number
    f1: number
    auc: number
  }
  limitations?: string
  ethical?: string
  citation?: string
}

const MOCK: ModelCardProps = {
  name: 'CT-Lung-Nodule',
  version: 'v3.2',
  vendor: 'Internal',
  taskType: '结节检测',
  modality: 'CT',
  bodyPart: '胸部',
  trainedOn: 'LIDC-IDRI + 本院 12,000 例',
  metrics: { accuracy: 0.94, recall: 0.91, precision: 0.89, f1: 0.90, auc: 0.96 },
  limitations: '对 < 4mm 微小结节敏感度较低;实性结节优先',
  ethical: '仅供研究/辅助使用,最终诊断以放射医师为准',
  citation: 'G005 Team. (2024). CT Lung Nodule Detection v3.2',
}

export const ModelCard: React.FC<{ model?: ModelCardProps }> = ({ model = MOCK }) => {
  const m = model
  return (
    <Card size="small" title={<Space><Box size={14} />模型卡片 - {m.name}</Space>} data-testid="model-card">
      <Space wrap>
        <Tag color="blue">v{m.version}</Tag>
        <Tag color="purple">{m.vendor}</Tag>
        <Tag color="cyan">{m.taskType}</Tag>
        <Tag color="orange">{m.modality} {m.bodyPart}</Tag>
      </Space>
      <Descriptions size="small" column={2} bordered style={{ marginTop: 12 }}>
        <Descriptions.Item label="训练数据">{m.trainedOn}</Descriptions.Item>
        <Descriptions.Item label="版本">v{m.version}</Descriptions.Item>
        <Descriptions.Item label="任务">{m.taskType}</Descriptions.Item>
        <Descriptions.Item label="适用">{m.modality} {m.bodyPart}</Descriptions.Item>
        {m.limitations && <Descriptions.Item label="局限" span={2}>{m.limitations}</Descriptions.Item>}
        {m.ethical && <Descriptions.Item label="伦理声明" span={2}>{m.ethical}</Descriptions.Item>}
        {m.citation && <Descriptions.Item label="引用" span={2}><FileText size={12} /> {m.citation}</Descriptions.Item>}
      </Descriptions>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, marginBottom: 4 }}>性能指标</div>
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {Object.entries(m.metrics).map(([k, v]) => (
            <div key={k}>
              <Space style={{ fontSize: 12, width: '100%', justifyContent: 'space-between' }}>
                <span>{k.toUpperCase()}</span>
                <span>{(v * 100).toFixed(1)}%</span>
              </Space>
              <Progress percent={v * 100} size="small" showInfo={false} strokeColor="#3b82f6" />
            </div>
          ))}
        </Space>
      </div>
      <Space style={{ marginTop: 12 }}>
        <Button size="small" type="primary">部署</Button>
        <Button size="small" icon={<Shield size={12} />}>审计</Button>
        <Button size="small">导出 JSON</Button>
      </Space>
    </Card>
  )
}

export default ModelCard
/**
 * G005 放射RIS系统 v3.0.6.1 - 联邦学习 (Federated Learning) 协调
 */
import React from 'react'
import { Card, Row, Col, Tag, Space, Statistic, Progress, Table, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Network, Shield, Server } from 'lucide-react'

export interface FederatedNode {
  id: string
  name: string
  region: string
  samples: number
  rounds: number
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING'
  lastSyncAt: string
  modelVersion: string
}

const MOCK: FederatedNode[] = [
  { id: 'N001', name: '协和医院', region: '北京', samples: 12450, rounds: 28, status: 'ONLINE', lastSyncAt: '2024-06-18 09:00', modelVersion: 'v3.2' },
  { id: 'N002', name: '瑞金医院', region: '上海', samples: 9820, rounds: 28, status: 'ONLINE', lastSyncAt: '2024-06-18 08:55', modelVersion: 'v3.2' },
  { id: 'N003', name: '华西医院', region: '成都', samples: 8520, rounds: 27, status: 'SYNCING', lastSyncAt: '2024-06-18 08:50', modelVersion: 'v3.1' },
  { id: 'N004', name: '同济医院', region: '武汉', samples: 6210, rounds: 28, status: 'ONLINE', lastSyncAt: '2024-06-18 09:02', modelVersion: 'v3.2' },
  { id: 'N005', name: '湘雅医院', region: '长沙', samples: 5480, rounds: 26, status: 'OFFLINE', lastSyncAt: '2024-06-17 22:00', modelVersion: 'v3.1' },
]

export interface FederatedLearningProps {
  nodes?: FederatedNode[]
}

export const FederatedLearning: React.FC<FederatedLearningProps> = ({ nodes = MOCK }) => {
  const online = nodes.filter((n) => n.status === 'ONLINE' || n.status === 'SYNCING').length
  const totalSamples = nodes.reduce((s, n) => s + n.samples, 0)

  const columns: ColumnsType<FederatedNode> = [
    { title: '节点', dataIndex: 'name', render: (n: string, r) => <Space><Server size={12} />{n}<Tag>{r.region}</Tag></Space> },
    { title: '样本', dataIndex: 'samples', render: (v: number) => v.toLocaleString() },
    { title: '轮次', dataIndex: 'rounds', width: 80 },
    { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => (
      <Tag color={s === 'ONLINE' ? 'green' : s === 'SYNCING' ? 'blue' : 'red'}>{s}</Tag>
    ) },
    { title: '版本', dataIndex: 'modelVersion', width: 80, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '最后同步', dataIndex: 'lastSyncAt', width: 160 },
  ]

  return (
    <div data-testid="federated-learning">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="节点" value={nodes.length} prefix={<Network size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="在线" value={online} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总样本" value={totalSamples.toLocaleString()} prefix={<Shield size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <span style={{ fontSize: 12 }}>当前轮次</span>
            <Progress percent={Math.round((online / nodes.length) * 100)} size="small" strokeColor="#3b82f6" />
            <Tag color="purple" style={{ marginTop: 4 }}>Round 28/30</Tag>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="联邦节点">
        <Table<FederatedNode>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={nodes}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无联邦节点" /> }}
        />
        <Space style={{ marginTop: 8 }} wrap>
          <Tag color="blue">差分隐私 ε=1.0</Tag>
          <Tag color="purple">Secure Aggregation</Tag>
          <Tag color="cyan">同态加密</Tag>
          <Tag color="green">模型 v3.2</Tag>
        </Space>
      </Card>
    </div>
  )
}

export default FederatedLearning
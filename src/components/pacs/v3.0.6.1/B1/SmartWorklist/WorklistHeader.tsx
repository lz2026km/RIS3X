/**
 * G005 放射RIS系统 v3.0.6.1 - 工作列表头部统计
 */
import React from 'react'
import { Card, Row, Col, Statistic, Tag, Space, Button } from 'antd'
import { Users, AlertTriangle, Clock, RefreshCw } from 'lucide-react'

export interface WorklistHeaderStats {
  total: number
  stat: number
  waiting: number
  avgWait: number
}

export interface WorklistHeaderProps {
  stats: WorklistHeaderStats
  onRefresh?: () => void
  lastSync?: string
}

export const WorklistHeader: React.FC<WorklistHeaderProps> = ({ stats, onRefresh, lastSync }) => {
  return (
    <Card size="small" data-testid="worklist-header">
      <Row gutter={12}>
        <Col span={6}>
          <Statistic title="总条目" value={stats.total} prefix={<Users size={14} />} styles={{ content: {  fontSize: 18  } }} />
        </Col>
        <Col span={6}>
          <Statistic
            title="急诊"
            value={stats.stat}
            prefix={<AlertTriangle size={14} color="#dc2626" />}
            styles={{ content: {  color: '#dc2626', fontSize: 18  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="等待"
            value={stats.waiting}
            prefix={<Clock size={14} color="#f59e0b" />}
            styles={{ content: {  color: '#f59e0b', fontSize: 18  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="平均等待(分钟)"
            value={stats.avgWait}
            styles={{ content: {  color: stats.avgWait > 60 ? '#dc2626' : '#0f172a', fontSize: 18  } }}
          />
        </Col>
      </Row>
      <Space style={{ marginTop: 8 }}>
        <Tag color="blue">{lastSync ? `同步:${lastSync}` : '实时'}</Tag>
        {onRefresh && <Button size="small" icon={<RefreshCw size={12} />} onClick={onRefresh}>刷新</Button>}
      </Space>
    </Card>
  )
}

export default WorklistHeader
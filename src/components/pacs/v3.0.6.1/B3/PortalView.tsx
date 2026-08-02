/**
 * G005 放射RIS系统 v3.0.6.1 - Philips IntelliSpace Portal View (门户视图)
 */
import React from 'react'
import { Card, Row, Col, Tag, Space, Statistic, Tabs, Empty } from 'antd'
import { Globe, Activity, Eye } from 'lucide-react'

export interface PortalViewProps {
  totalStudies?: number
  unread?: number
  activeUsers?: number
}

export const PortalView: React.FC<PortalViewProps> = ({
  totalStudies = 12480,
  unread = 32,
  activeUsers = 18,
}) => {
  return (
    <div data-testid="portal-view">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="累计检查" value={totalStudies} prefix={<Globe size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="待审核" value={unread} styles={{ content: {  color: '#dc2626'  } }} prefix={<Activity size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="在线用户" value={activeUsers} prefix={<Eye size={14} />} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title="IntelliSpace Portal">
        <Tabs
          items={[
            { key: 'worklist', label: '工作列表', children: <Empty description="数据待接入" /> },
            { key: 'exam', label: '影像浏览', children: <Empty description="数据待接入" /> },
            { key: 'report', label: '报告', children: <Empty description="数据待接入" /> },
            { key: 'ai', label: 'AI Hub', children: <Empty description="数据待接入" /> },
          ]}
        />
        <Space wrap style={{ marginTop: 8 }}>
          <Tag color="blue">多院区</Tag>
          <Tag color="purple">权限分级</Tag>
          <Tag color="cyan">云端部署</Tag>
          <Tag color="green">DICOM 3.0</Tag>
        </Space>
      </Card>
    </div>
  )
}

export default PortalView
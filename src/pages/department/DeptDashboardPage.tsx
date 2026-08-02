import React from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Space, Typography } from 'antd'
import { Monitor, Users, Activity, Clock, AlertTriangle, FileText } from 'lucide-react'

const { Text } = Typography

const summaryData = {
  totalPatients: 156,
  totalStudies: 243,
  totalReports: 198,
  avgReportTime: 45,
  pendingReports: 45,
  criticalValues: 3,
  equipmentUtilization: 78,
}

const workloadData = [
  { doctorName: 'Dr. Wang', reportCount: 42, avgTime: 38, qualityScore: 95 },
  { doctorName: 'Dr. Li', reportCount: 38, avgTime: 42, qualityScore: 92 },
  { doctorName: 'Dr. Zhang', reportCount: 35, avgTime: 50, qualityScore: 88 },
  { doctorName: 'Dr. Liu', reportCount: 40, avgTime: 40, qualityScore: 93 },
]

const DeptDashboardPage: React.FC = () => {
  const columns = [
    { title: '医生', dataIndex: 'doctorName', key: 'name' },
    { title: '报告数', dataIndex: 'reportCount', key: 'count' },
    { title: '平均耗时(分)', dataIndex: 'avgTime', key: 'avgTime' },
    { title: '质量评分', dataIndex: 'qualityScore', key: 'score', render: (v: number) => <Tag color={v >= 90 ? 'green' : v >= 80 ? 'orange' : 'red'}>{v}</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Monitor size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>科室看板</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="患者数" value={summaryData.totalPatients} prefix={<Users size={16} />} /></Card></Col>
        <Col span={4}><Card><Statistic title="检查数" value={summaryData.totalStudies} prefix={<Activity size={16} />} /></Card></Col>
        <Col span={4}><Card><Statistic title="报告数" value={summaryData.totalReports} prefix={<FileText size={16} />} /></Card></Col>
        <Col span={4}><Card><Statistic title="平均报告时间" value={`${summaryData.avgReportTime}分`} prefix={<Clock size={16} />} /></Card></Col>
        <Col span={4}><Card><Statistic title="危急值" value={summaryData.criticalValues} prefix={<AlertTriangle size={16} />} styles={{ content: {  color: '#ff4d4f'  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="设备利用率" value={`${summaryData.equipmentUtilization}%`} prefix={<Monitor size={16} />} /></Card></Col>
      </Row>
      <Card title="医生工作量" style={{ marginBottom: 16 }}>
        <Table rowKey="doctorName" dataSource={workloadData} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default DeptDashboardPage

import React, { useState } from 'react'
import { Card, Table, Tag, Space, Typography, Row, Col, Statistic, Button, Upload, message } from 'antd'
import { UploadCloud, CheckCircle, Database } from 'lucide-react'

const { Text } = Typography

interface StoredInstance {
  id: string
  studyInstanceUid: string
  patientName: string
  patientId: string
  modality: string
  studyDate: string
  receivedAt: string
}

const mockInstances: StoredInstance[] = [
  { id: 'si-001', studyInstanceUid: '1.2.3.4.5.200', patientName: 'Zhang San', patientId: 'P001', modality: 'CT', studyDate: '2026-07-28', receivedAt: '2026-07-28T10:30:00Z' },
  { id: 'si-002', studyInstanceUid: '1.2.3.4.5.201', patientName: 'Li Si', patientId: 'P002', modality: 'MR', studyDate: '2026-07-27', receivedAt: '2026-07-27T14:00:00Z' },
]

const StowRsPage: React.FC = () => {
  const [instances] = useState(mockInstances)

  const columns = [
    { title: 'Study UID', dataIndex: 'studyInstanceUid', key: 'uid', render: (v: string) => <Text copyable style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</Text> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: 'ID', dataIndex: 'patientId', key: 'patientId' },
    { title: '模态', dataIndex: 'modality', key: 'modality', render: (v: string) => <Tag>{v}</Tag> },
    { title: '日期', dataIndex: 'studyDate', key: 'studyDate' },
    { title: '接收时间', dataIndex: 'receivedAt', key: 'receivedAt', render: (v: string) => new Date(v).toLocaleString() },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <UploadCloud size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>STOW-RS 存储</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="已存储实例" value={instances.length} prefix={<Database size={16} />} /></Card></Col>
        <Col span={8}><Card><Statistic title="成功存储" value={instances.length} prefix={<CheckCircle size={16} />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      <Card extra={<Upload beforeUpload={() => { message.info('上传功能对接后端'); return false }} showUploadList={false}><Button type="primary" icon={<UploadCloud size={14} />}>上传 DICOM</Button></Upload>}>
        <Table rowKey="id" dataSource={instances} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default StowRsPage

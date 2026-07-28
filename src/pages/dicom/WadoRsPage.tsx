import React, { useState } from 'react'
import { Card, Table, Tag, Space, Typography, Row, Col, Statistic, Button, Input } from 'antd'
import { Globe, Search, Download } from 'lucide-react'

const { Text } = Input

interface WadoStudy {
  studyInstanceUid: string
  patientName: string
  patientId: string
  studyDate: string
  studyDescription: string
  modality: string
  seriesCount: number
  instanceCount: number
}

const mockStudies: WadoStudy[] = [
  { studyInstanceUid: '1.2.3.4.5.100', patientName: 'Zhang San', patientId: 'P001', studyDate: '2026-07-28', studyDescription: 'Chest CT', modality: 'CT', seriesCount: 5, instanceCount: 320 },
  { studyInstanceUid: '1.2.3.4.5.101', patientName: 'Li Si', patientId: 'P002', studyDate: '2026-07-27', studyDescription: 'Brain MRI', modality: 'MR', seriesCount: 8, instanceCount: 512 },
]

const WadoRsPage: React.FC = () => {
  const [search, setSearch] = useState('')

  const filtered = mockStudies.filter(s =>
    s.patientName.toLowerCase().includes(search.toLowerCase()) ||
    s.studyInstanceUid.includes(search)
  )

  const columns = [
    { title: 'Study UID', dataIndex: 'studyInstanceUid', key: 'uid', render: (v: string) => <Text copyable style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</Text> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '日期', dataIndex: 'studyDate', key: 'studyDate' },
    { title: '描述', dataIndex: 'studyDescription', key: 'desc' },
    { title: '模态', dataIndex: 'modality', key: 'modality', render: (v: string) => <Tag>{v}</Tag> },
    { title: '序列', dataIndex: 'seriesCount', key: 'series' },
    { title: '实例', dataIndex: 'instanceCount', key: 'instances' },
    { title: '操作', key: 'action', render: () => (
      <Button size="small" icon={<Download size={14} />}>Retrieve</Button>
    )},
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>WADO-RS 检索</span>
      </Space>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input prefix={<Search size={14} />} placeholder="搜索患者名/Study UID" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 400 }} />
        </Space>
      </Card>
      <Card>
        <Table rowKey="studyInstanceUid" dataSource={filtered} columns={columns} pagination={{ pageSize: 10 }} size="small" />
      </Card>
    </div>
  )
}

export default WadoRsPage

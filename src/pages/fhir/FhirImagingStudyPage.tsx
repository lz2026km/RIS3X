import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Tag, Form, Input, Select, message, Empty, Modal, Descriptions, Tooltip, Badge } from 'antd'
import { Layers, Search, RefreshCw, Eye } from 'lucide-react'
import { fhirApi, type FhirImagingStudy } from '../../services/api/fhirApi'

const PAGE_SIZE = 10

export const FhirImagingStudyPage: React.FC = () => {
  const [studies, setStudies] = useState<FhirImagingStudy[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState<{ patient?: string; modality?: string }>({})
  const [searchForm] = Form.useForm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState<FhirImagingStudy | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = async (study: FhirImagingStudy) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedStudy(study)
    try {
      const res = await fhirApi.readImagingStudy(study.id!)
      if (res.success && res.data) {
        setSelectedStudy(res.data)
      } else {
        message.warning(res.error?.message ?? '影像检查详情加载失败，展示列表数据')
      }
    } catch {
      message.warning('影像检查详情加载失败，展示列表数据')
    }
    setDetailLoading(false)
  }

  const fetchStudies = useCallback(async (p: number = 1, params: { patient?: string; modality?: string } = {}) => {
    setLoading(true)
    try {
      const res = await fhirApi.searchImagingStudy({ _count: '200', ...params, page: String(p) })
      if (res.success && res.data) {
        const entries = res.data.entry || []
        setStudies(entries.map((e) => e.resource as FhirImagingStudy))
        setTotal(res.data.total || entries.length)
      }
    } catch {
      message.warning('影像检查列表加载失败，使用演示数据')
      setStudies([
        { id: 'is1', resourceType: 'ImagingStudy', status: 'available', started: '2026-01-15T09:00:00Z', numberOfSeries: 3, numberOfInstances: 156, subject: { reference: 'Patient/p1' }, procedureCode: [{ coding: [{ code: 'US-ABD', display: '腹部超声' }] }] },
        { id: 'is2', resourceType: 'ImagingStudy', status: 'available', started: '2026-01-16T14:30:00Z', numberOfSeries: 5, numberOfInstances: 320, subject: { reference: 'Patient/p2' }, procedureCode: [{ coding: [{ code: 'CT-CHEST', display: '胸部CT' }] }] },
      ])
      setTotal(2)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchStudies(page, search) }, [fetchStudies, page, search])

  const handleSearch = async () => {
    const values = searchForm.getFieldsValue()
    setSearch({ patient: values.patient, modality: values.modality })
    setPage(1)
  }

  const columns = [
    {
      title: '编号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Tooltip title={id}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id?.slice(0, 10)}...</span></Tooltip>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { available: 'green', registered: 'blue', unavailable: 'red' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '检查代码',
      key: 'procedureCode',
      render: (_: any, r: FhirImagingStudy) => r.procedureCode?.[0]?.coding?.[0]?.display || r.procedureCode?.[0]?.coding?.[0]?.code || '-',
    },
    {
      title: '患者',
      key: 'subject',
      render: (_: any, r: FhirImagingStudy) => r.subject?.reference || '-',
    },
    {
      title: '序列',
      dataIndex: 'numberOfSeries',
      key: 'numberOfSeries',
      render: (v: number) => v != null ? <Badge count={v} style={{ backgroundColor: '#2563eb' }} /> : '-',
    },
    {
      title: '实例数',
      dataIndex: 'numberOfInstances',
      key: 'numberOfInstances',
      render: (v: number) => v != null ? <Badge count={v} style={{ backgroundColor: '#52c41a' }} /> : '-',
    },
    {
      title: '开始时间',
      key: 'started',
      render: (_: any, r: FhirImagingStudy) => r.started ? new Date(r.started).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: FhirImagingStudy) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>详情</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR ImagingStudy 管理</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="patient" label="患者 ID">
            <Input placeholder="患者 ID / 参考" allowClear style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="modality" label="设备类型">
            <Select allowClear placeholder="全部" style={{ width: 120 }}>
              <Select.Option value="CT">CT</Select.Option>
              <Select.Option value="MR">MR</Select.Option>
              <Select.Option value="US">US</Select.Option>
              <Select.Option value="XA">XA</Select.Option>
              <Select.Option value="CR">CR</Select.Option>
              <Select.Option value="DX">DX</Select.Option>
              <Select.Option value="NM">NM</Select.Option>
              <Select.Option value="PT">PT</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>搜索</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>刷新</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={`影像检查列表 (${total})`}>
        <Table
          dataSource={studies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="影像检查详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>加载详情...</div>
        ) : selectedStudy ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedStudy.id}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color="green">{selectedStudy.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="患者">{selectedStudy.subject?.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{selectedStudy.started ? new Date(selectedStudy.started).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Series 数">{selectedStudy.numberOfSeries || '-'}</Descriptions.Item>
            <Descriptions.Item label="Instance 数">{selectedStudy.numberOfInstances || '-'}</Descriptions.Item>
            <Descriptions.Item label="检查代码" span={2}>{selectedStudy.procedureCode?.[0]?.coding?.[0]?.display || '-'}</Descriptions.Item>
            <Descriptions.Item label="位置">{selectedStudy.location?.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label="原因">{selectedStudy.reasonCode?.[0]?.coding?.[0]?.display || '-'}</Descriptions.Item>
            {selectedStudy.series && selectedStudy.series.length > 0 && (
              <Descriptions.Item label="Series 列表" span={2}>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {selectedStudy.series.map((s, i) => (
                    <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <Tag color="blue">{s.modality?.coding?.[0]?.code || '—'}</Tag>
                      <span style={{ fontSize: 12 }}>#{s.number || i + 1} - {s.description || '无描述'}</span>
                      <span style={{ color: '#999', marginLeft: 8 }}>({s.numberOfInstances || 0} 个实例)</span>
                    </div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : <Empty />}
      </Modal>
    </div>
  )
}

export default FhirImagingStudyPage

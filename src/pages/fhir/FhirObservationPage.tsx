import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Tag, Form, Input, message, Empty, Modal, Descriptions, Tooltip } from 'antd'
import { Activity, Search, RefreshCw, Eye } from 'lucide-react'
import { fhirApi, type FhirObservation } from '../../services/api/fhirApi'

const PAGE_SIZE = 10

export const FhirObservationPage: React.FC = () => {
  const [observations, setObservations] = useState<FhirObservation[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState<{ patient?: string }>({})
  const [searchForm] = Form.useForm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedObs, setSelectedObs] = useState<FhirObservation | null>(null)

  const fetchObservations = useCallback(async (p: number = 1, params: { patient?: string } = {}) => {
    setLoading(true)
    try {
      const res = await fhirApi.searchObservation({ _count: '200', ...params, page: String(p) })
      if (res.success && res.data) {
        const entries = res.data.entry || []
        setObservations(entries.map((e) => e.resource as FhirObservation))
        setTotal(res.data.total || entries.length)
      }
    } catch {
      message.warning('Observation 列表加载失败，使用演示数据')
      setObservations([
        { id: 'obs1', resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }], text: '体温' }, valueQuantity: { value: 36.5, unit: '°C' }, effectiveDateTime: '2026-01-15' },
        { id: 'obs2', resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }], text: '心率' }, valueQuantity: { value: 72, unit: 'bpm' }, effectiveDateTime: '2026-01-15' },
      ])
      setTotal(2)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchObservations(page, search) }, [fetchObservations, page, search])

  const handleSearch = async () => {
    const values = searchForm.getFieldsValue()
    setSearch({ patient: values.patient })
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
        const colorMap: Record<string, string> = { final: 'green', registered: 'blue', preliminary: 'orange', amended: 'red' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '代码',
      key: 'code',
      render: (_: any, r: FhirObservation) => (
        <span>{r.code?.text || r.code?.coding?.[0]?.display || r.code?.coding?.[0]?.code || '-'}</span>
      ),
    },
    {
      title: '值',
      key: 'value',
      render: (_: any, r: FhirObservation) => {
        if (r.valueQuantity) return `${r.valueQuantity.value} ${r.valueQuantity.unit || ''}`
        return '-'
      },
    },
    {
      title: '时间',
      dataIndex: 'effectiveDateTime',
      key: 'effectiveDateTime',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: FhirObservation) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => { setSelectedObs(r); setDetailOpen(true) }}>详情</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR Observation 管理</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="patient" label="患者 ID">
            <Input placeholder="患者 ID / 参考" allowClear style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>搜索</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>刷新</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={`Observation 列表 (${total})`}>
        <Table
          dataSource={observations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
          size="small"
        />
      </Card>

      <Modal
        title="Observation 详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={600}
      >
        {selectedObs ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedObs.id}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color="green">{selectedObs.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="代码">{selectedObs.code?.text || selectedObs.code?.coding?.[0]?.display}</Descriptions.Item>
            <Descriptions.Item label="编码">{selectedObs.code?.coding?.[0]?.code}</Descriptions.Item>
            <Descriptions.Item label="值">{selectedObs.valueQuantity ? `${selectedObs.valueQuantity.value} ${selectedObs.valueQuantity.unit}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="时间">{selectedObs.effectiveDateTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="参考范围" span={2}>
              {selectedObs.referenceRange?.[0] ? `${selectedObs.referenceRange[0].low?.value ?? '?'} - ${selectedObs.referenceRange[0].high?.value ?? '?'}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="解读" span={2}>
              {selectedObs.interpretation?.map(i => i.coding?.[0]?.code).join(', ') || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : <Empty />}
      </Modal>
    </div>
  )
}

export default FhirObservationPage

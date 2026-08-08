import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, message, Popconfirm, Descriptions, Empty, Tooltip } from 'antd'
import { Users, Plus, Edit, Trash, Search, RefreshCw, Eye } from 'lucide-react'
import { fhirApi, type FhirPatient } from '../../services/api/fhirApi'

const {  } = DatePicker

const PAGE_SIZE = 10

export const FhirPatientPage: React.FC = () => {
  const [patients, setPatients] = useState<FhirPatient[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState<{ name?: string; identifier?: string }>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<FhirPatient | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<FhirPatient | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [everythingOpen, setEverythingOpen] = useState(false)
  const [everythingLoading, setEverythingLoading] = useState(false)
  const [everythingEntries, setEverythingEntries] = useState<{ resourceType: string; id?: string; date?: string; summary?: string }[]>([])

  const fetchPatients = useCallback(async (p: number = 1, params: { name?: string; identifier?: string } = {}) => {
    setLoading(true)
    try {
      const res = await fhirApi.searchPatient({ _count: '200', ...params, page: String(p) })
      if (res.success && res.data) {
        const entries = res.data.entry || []
        setPatients(entries.map((e) => e.resource as FhirPatient))
        setTotal(res.data.total || entries.length)
      }
    } catch {
      message.warning('Patient 列表加载失败，使用演示数据')
      setPatients([
        { id: 'p1', resourceType: 'Patient', name: [{ family: '张', given: ['三'] }], gender: 'male', birthDate: '1985-06-15' },
        { id: 'p2', resourceType: 'Patient', name: [{ family: '李', given: ['四'] }], gender: 'female', birthDate: '1990-03-22' },
      ])
      setTotal(2)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPatients(page, search) }, [fetchPatients, page, search])

  const handleSearch = async () => {
    const values = searchForm.getFieldsValue()
    setSearch({ name: values.name, identifier: values.identifier })
    setPage(1)
  }

  const handleCreate = () => {
    setEditingPatient(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (patient: FhirPatient) => {
    setEditingPatient(patient)
    form.setFieldsValue({
      familyName: patient.name?.[0]?.family,
      givenName: patient.name?.[0]?.given?.join(' '),
      gender: patient.gender,
      birthDate: patient.birthDate,
      phone: patient.telecom?.[0]?.value,
      city: patient.address?.[0]?.city,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const body: Partial<FhirPatient> = {
        resourceType: 'Patient',
        name: [{ family: values.familyName, given: [values.givenName || ''] }],
        gender: values.gender,
        birthDate: values.birthDate,
        telecom: values.phone ? [{ system: 'phone', value: values.phone }] : undefined,
        address: values.city ? [{ city: values.city }] : undefined,
      }
      if (editingPatient?.id) {
        await fhirApi.updatePatient(editingPatient.id, body)
        message.success('Patient 已更新')
      } else {
        await fhirApi.createPatient(body)
        message.success('Patient 已创建')
      }
      setModalOpen(false)
      fetchPatients(page, search)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fhirApi.deletePatient(id)
    if (res.success) {
      message.success('Patient 已删除')
      fetchPatients(page, search)
    } else {
      message.error('删除失败')
    }
  }

  const handleDetail = async (patient: FhirPatient) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedPatient(patient)
    try {
      const res = await fhirApi.readPatient(patient.id!)
      if (res.success && res.data) {
        setSelectedPatient(res.data)
      } else {
        message.warning(res.error?.message ?? 'Patient 详情加载失败，展示列表数据')
      }
    } catch {
      message.warning('Patient 详情加载失败，展示列表数据')
    }
    setDetailLoading(false)
  }

  const handleEverything = async (patient: FhirPatient) => {
    setEverythingOpen(true)
    setEverythingLoading(true)
    setEverythingEntries([])
    try {
      const res = await fhirApi.patientEverything(patient.id!)
      if (res.success && res.data) {
        const entries = res.data.entry || []
        setEverythingEntries(entries.map((e) => {
          const r = e.resource as any
          return {
            resourceType: r.resourceType || '-',
            id: r.id || '-',
            date: r.effectiveDateTime || r.started || r.issued || r.birthDate || '-',
            summary: r.code?.text || r.code?.coding?.[0]?.display || r.name?.[0] ? `${r.name?.[0]?.family || ''} ${(r.name?.[0]?.given || []).join(' ')}`.trim() : '-',
          }
        }))
      } else {
        message.warning(res.error?.message ?? '360 视图加载失败')
      }
    } catch {
      message.warning('360 视图加载失败')
    }
    setEverythingLoading(false)
  }

  const columns = [
    {
      title: '编号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Tooltip title={id}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id?.slice(0, 12)}...</span></Tooltip>,
    },
    {
      title: '姓名',
      key: 'name',
      render: (_: any, r: FhirPatient) => r.name?.[0] ? `${r.name[0].family || ''} ${(r.name[0].given || []).join(' ')}`.trim() : '-',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      render: (g: string) => {
        const map: Record<string, { label: string; color: string }> = { male: { label: '男', color: 'blue' }, female: { label: '女', color: 'pink' }, other: { label: '其他', color: 'purple' } }
        const item = map[g] || { label: g || '-', color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    { title: '出生日期', dataIndex: 'birthDate', key: 'birthDate' },
    {
      title: '联系方式',
      key: 'telecom',
      render: (_: any, r: FhirPatient) => r.telecom?.[0]?.value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, r: FhirPatient) => (
        <Space size="small">
          <Button size="small" icon={<Eye size={12} />} onClick={() => handleDetail(r)}>详情</Button>
          <Button size="small" icon={<Edit size={12} />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除此 Patient?" onConfirm={() => handleDelete(r.id!)}>
            <Button size="small" danger icon={<Trash size={12} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Users size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR Patient 管理</span>
        <Tag color="blue">FHIR R4</Tag>
        <Tag color="green">CRUD</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="name" label="姓名">
            <Input placeholder="患者姓名" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="identifier" label="编号">
            <Input placeholder="患者 ID" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>搜索</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>刷新</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        size="small"
        title={`Patient 列表 (${total})`}
        extra={<Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>新建 Patient</Button>}
      >
        <Table
          dataSource={patients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          onRow={(r) => ({ onClick: () => handleDetail(r), style: { cursor: 'pointer' } })}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
          size="small"
        />
      </Card>

      <Modal
        title={editingPatient ? '编辑 Patient' : '新建 Patient'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="familyName" label="姓 (Family)" rules={[{ required: true }]}>
              <Input placeholder="例: 张" />
            </Form.Item>
            <Form.Item name="givenName" label="名 (Given)">
              <Input placeholder="例: 三" />
            </Form.Item>
            <Form.Item name="gender" label="性别">
              <Select placeholder="选择性别" allowClear options={[
                { value: 'male', label: '男' },
                { value: 'female', label: '女' },
                { value: 'other', label: '其他' },
              ]} />
            </Form.Item>
            <Form.Item name="birthDate" label="出生日期">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="phone" label="电话">
              <Input placeholder="联系电话" />
            </Form.Item>
            <Form.Item name="city" label="城市">
              <Input placeholder="所在城市" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Patient 详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<Eye size={12} />}
              loading={everythingLoading}
              onClick={() => selectedPatient && handleEverything(selectedPatient)}
            >
              360 视图 ($everything)
            </Button>
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>
          </Space>
        }
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>加载详情...</div>
        ) : selectedPatient ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedPatient.id}</Descriptions.Item>
            <Descriptions.Item label="资源类型">{selectedPatient.resourceType}</Descriptions.Item>
            <Descriptions.Item label="姓名">{selectedPatient.name?.[0]?.family} {(selectedPatient.name?.[0]?.given || []).join(' ')}</Descriptions.Item>
            <Descriptions.Item label="性别">{selectedPatient.gender}</Descriptions.Item>
            <Descriptions.Item label="出生日期">{selectedPatient.birthDate}</Descriptions.Item>
            <Descriptions.Item label="电话">{selectedPatient.telecom?.[0]?.value || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{selectedPatient.address?.[0]?.city || '-'}</Descriptions.Item>
          </Descriptions>
        ) : <Empty />}
      </Modal>

      <Modal
        title="Patient 360 视图 ($everything)"
        open={everythingOpen}
        onCancel={() => setEverythingOpen(false)}
        footer={<Button onClick={() => setEverythingOpen(false)}>关闭</Button>}
        width={720}
      >
        {everythingLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>加载患者全部资源...</div>
        ) : everythingEntries.length === 0 ? (
          <Empty description="暂无关联资源" />
        ) : (
          <Table
            dataSource={everythingEntries}
            rowKey={(r) => `${r.resourceType}-${r.id}`}
            size="small"
            pagination={false}
            columns={[
              { title: '资源类型', dataIndex: 'resourceType', render: (v: string) => <Tag color="blue">{v}</Tag> },
              { title: 'ID', dataIndex: 'id', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
              { title: '概要', dataIndex: 'summary' },
              { title: '时间', dataIndex: 'date' },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default FhirPatientPage

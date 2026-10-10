import { fhirApi, type FhirPatient } from '../../services/api/fhirApi'
import {
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Descriptions,
  Empty,
  Tooltip,
} from "antd";
import { Users, Plus, Edit, Trash, Search, RefreshCw, Eye } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { Inbox } from 'lucide-react'
import { usePagination } from '../../hooks/usePagination'
import { t } from '../../i18n/appI18n'
import { PageContainer } from "../../components/common";

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
  // [G005 2B] 受控分页: $everything 关联资源表 (数据可增长)
  const { pageData: pagedEverything, pagination: everythingPagination } = usePagination(everythingEntries, 10)

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
      message.warning(t('fhirPatient.listLoadFallback'))
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
        message.success(t('fhirPatient.updated'))
      } else {
        await fhirApi.createPatient(body)
        message.success(t('fhirPatient.created'))
      }
      setModalOpen(false)
      fetchPatients(page, search)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('fhirPatient.operationFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fhirApi.deletePatient(id)
    if (res.success) {
      message.success(t('fhirPatient.deleted'))
      fetchPatients(page, search)
    } else {
      message.error(t('fhirPatient.deleteFailed'))
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
        message.warning(res.error?.message ?? t('fhirPatient.detailLoadFallback'))
      }
    } catch {
      message.warning(t('fhirPatient.detailLoadFallback'))
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
        message.warning(res.error?.message ?? t('fhirPatient.everythingLoadFailed'))
      }
    } catch {
      message.warning(t('fhirPatient.everythingLoadFailed'))
    }
    setEverythingLoading(false)
  }

  const columns = [
    {
      title: t('fhirPatient.colId'),
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Tooltip title={id}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id?.slice(0, 12)}...</span></Tooltip>,
    },
    {
      title: t('fhirPatient.colName'),
      key: 'name',
      render: (_: any, r: FhirPatient) => r.name?.[0] ? `${r.name[0].family || ''} ${(r.name[0].given || []).join(' ')}`.trim() : '-',
    },
    {
      title: t('fhirPatient.colGender'),
      dataIndex: 'gender',
      key: 'gender',
      render: (g: string) => {
        const map: Record<string, { label: string; color: string }> = { male: { label: t('fhirPatient.genderMale'), color: 'blue' }, female: { label: t('fhirPatient.genderFemale'), color: 'pink' }, other: { label: t('fhirPatient.genderOther'), color: 'purple' } }
        const item = map[g] || { label: g || '-', color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    { title: t('fhirPatient.colBirthDate'), dataIndex: 'birthDate', key: 'birthDate' },
    {
      title: t('fhirPatient.colTelecom'),
      key: 'telecom',
      render: (_: any, r: FhirPatient) => r.telecom?.[0]?.value || '-',
    },
    {
      title: t('fhirPatient.colActions'),
      key: 'action',
      width: 180,
      render: (_: any, r: FhirPatient) => (
        <Space size="small">
          <Button size="small" icon={<Eye size={12} />} onClick={() => handleDetail(r)}>{t('fhirPatient.detail')}</Button>
          <Button size="small" icon={<Edit size={12} />} onClick={() => handleEdit(r)}>{t('fhirPatient.edit')}</Button>
          <Popconfirm title={t('fhirPatient.confirmDelete')} onConfirm={() => handleDelete(r.id!)}>
            <Button size="small" danger icon={<Trash size={12} />}>{t('fhirPatient.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer maxWidth="full" padding="var(--space-6, 24px)" style={{ background: 'var(--bg-primary)' }}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Users size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fhirPatient.title')}</span>
        <Tag color="blue">FHIR R4</Tag>
        <Tag color="green">CRUD</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="name" label={t('fhirPatient.colName')}>
            <Input placeholder={t('fhirPatient.namePlaceholder')} allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="identifier" label={t('fhirPatient.colId')}>
            <Input placeholder={t('fhirPatient.idPlaceholder')} allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>{t('fhirPatient.search')}</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>{t('fhirPatient.refresh')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        size="small"
        title={`${t('fhirPatient.patientList')} (${total})`}
        extra={<Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>{t('fhirPatient.newPatient')}</Button>}
      >
        <DataTable
          dataSource={patients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          onRow={(r) => ({ onClick: () => handleDetail(r), style: { cursor: 'pointer' } })}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editingPatient ? t('fhirPatient.editPatient') : t('fhirPatient.newPatient')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="familyName" label={t('fhirPatient.familyLabel')} rules={[{ required: true }]}>
              <Input placeholder={t('fhirPatient.familyPlaceholder')} />
            </Form.Item>
            <Form.Item name="givenName" label={t('fhirPatient.givenLabel')}>
              <Input placeholder={t('fhirPatient.givenPlaceholder')} />
            </Form.Item>
            <Form.Item name="gender" label={t('fhirPatient.colGender')}>
              <Select placeholder={t('fhirPatient.selectGender')} allowClear options={[
                { value: 'male', label: t('fhirPatient.genderMale') },
                { value: 'female', label: t('fhirPatient.genderFemale') },
                { value: 'other', label: t('fhirPatient.genderOther') },
              ]} />
            </Form.Item>
            <Form.Item name="birthDate" label={t('fhirPatient.colBirthDate')}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="phone" label={t('fhirPatient.phone')}>
              <Input placeholder={t('fhirPatient.phonePlaceholder')} />
            </Form.Item>
            <Form.Item name="city" label={t('fhirPatient.city')}>
              <Input placeholder={t('fhirPatient.cityPlaceholder')} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={t('fhirPatient.detailTitle')}
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
               {t('fhirPatient.patient360View')}
            </Button>
            <Button onClick={() => setDetailOpen(false)}>{t('fhirPatient.close')}</Button>
          </Space>
        }
        width={560}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>{t('fhirPatient.loadingDetail')}</div>
        ) : selectedPatient ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedPatient.id}</Descriptions.Item>
            <Descriptions.Item label={t('fhirPatient.resourceType')}>{selectedPatient.resourceType}</Descriptions.Item>
            <Descriptions.Item label={t('fhirPatient.colName')}>{selectedPatient.name?.[0]?.family} {(selectedPatient.name?.[0]?.given || []).join(' ')}</Descriptions.Item>
            <Descriptions.Item label={t('fhirPatient.colGender')}>{selectedPatient.gender}</Descriptions.Item>
            <Descriptions.Item label={t('fhirPatient.colBirthDate')}>{selectedPatient.birthDate}</Descriptions.Item>
            <Descriptions.Item label={t('fhirPatient.phone')}>{selectedPatient.telecom?.[0]?.value || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirPatient.address')} span={2}>{selectedPatient.address?.[0]?.city || '-'}</Descriptions.Item>
          </Descriptions>
        ) : <Empty description={t('fhirPatient.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>

      <Modal
        title={t('fhirPatient.patient360View')}
        open={everythingOpen}
        onCancel={() => setEverythingOpen(false)}
        footer={<Button onClick={() => setEverythingOpen(false)}>{t('fhirPatient.close')}</Button>}
        width={720}
      >
        {everythingLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>{t('fhirPatient.loadingResources')}</div>
        ) : everythingEntries.length === 0 ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('fhirPatient.noRelatedResources')} />
        ) : (
          <DataTable
            dataSource={pagedEverything}
            rowKey={(r) => `${r.resourceType}-${r.id}`}
            scroll={{ x: 'max-content' }}
            pagination={everythingPagination}
            columns={[
              { title: t('fhirPatient.colResourceType'), dataIndex: 'resourceType', render: (v: string) => <Tag color="blue">{v}</Tag> },
              { title: 'ID', dataIndex: 'id', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
              { title: t('fhirPatient.colSummary'), dataIndex: 'summary' },
              { title: t('fhirPatient.colTime'), dataIndex: 'date' },
            ]}
          />
        )}
      </Modal>
    </PageContainer>
  )
}

export default FhirPatientPage

import { DataTable } from "../../components/common";
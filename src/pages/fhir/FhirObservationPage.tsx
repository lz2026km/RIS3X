import { fhirApi, type FhirObservation } from '../../services/api/fhirApi'
import {
  Card,
  Button,
  Space,
  Tag,
  Form,
  Input,
  message,
  Empty,
  Modal,
  Descriptions,
  Tooltip,
} from "antd";
import { Activity, Search, RefreshCw, Eye } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { t } from '../../i18n/appI18n'

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
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = async (obs: FhirObservation) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedObs(obs)
    try {
      const res = await fhirApi.readObservation(obs.id!)
      if (res.success && res.data) {
        setSelectedObs(res.data)
      } else {
        message.warning(res.error?.message ?? t('fhirObs.detailLoadFailed'))
      }
    } catch {
      message.warning(t('fhirObs.detailLoadFailed'))
    }
    setDetailLoading(false)
  }

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
      message.warning(t('fhirObs.listLoadFailed'))
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
      title: t('fhirObs.colId'),
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Tooltip title={id}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id?.slice(0, 10)}...</span></Tooltip>,
    },
    {
      title: t('fhirObs.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { final: 'green', registered: 'blue', preliminary: 'orange', amended: 'red' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: t('fhirObs.colCode'),
      key: 'code',
      render: (_: any, r: FhirObservation) => (
        <span>{r.code?.text || r.code?.coding?.[0]?.display || r.code?.coding?.[0]?.code || '-'}</span>
      ),
    },
    {
      title: t('fhirObs.colValue'),
      key: 'value',
      render: (_: any, r: FhirObservation) => {
        if (r.valueQuantity) return `${r.valueQuantity.value} ${r.valueQuantity.unit || ''}`
        return '-'
      },
    },
    {
      title: t('fhirObs.colTime'),
      dataIndex: 'effectiveDateTime',
      key: 'effectiveDateTime',
    },
    {
      title: t('fhirObs.colAction'),
      key: 'action',
      width: 80,
      render: (_: any, r: FhirObservation) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>详情</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Activity size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fhirObs.title')}</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="patient" label={t('fhirObs.patientId')}>
            <Input placeholder={t('fhirObs.patientIdPlaceholder')} allowClear style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>{t('fhirObs.search')}</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>{t('fhirObs.refresh')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={`观察记录列表 (${total})`}>
        <DataTable
          dataSource={observations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={t('fhirObs.detailTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('fhirObs.close')}</Button>}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>{t('fhirObs.loadingDetail')}</div>
        ) : selectedObs ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedObs.id}</Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.colStatus')}><Tag color="green">{selectedObs.status}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.colCode')}>{selectedObs.code?.text || selectedObs.code?.coding?.[0]?.display}</Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.coding')}>{selectedObs.code?.coding?.[0]?.code}</Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.colValue')}>{selectedObs.valueQuantity ? `${selectedObs.valueQuantity.value} ${selectedObs.valueQuantity.unit}` : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.colTime')}>{selectedObs.effectiveDateTime || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.referenceRange')} span={2}>
              {selectedObs.referenceRange?.[0] ? `${selectedObs.referenceRange[0].low?.value ?? '?'} - ${selectedObs.referenceRange[0].high?.value ?? '?'}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('fhirObs.interpretation')} span={2}>
              {selectedObs.interpretation?.map(i => i.coding?.[0]?.code).join(', ') || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : <Empty description={t('fhirObs.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>
    </div>
  )
}

export default FhirObservationPage

import { DataTable } from "../../components/common";
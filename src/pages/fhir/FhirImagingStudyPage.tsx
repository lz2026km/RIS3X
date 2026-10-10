import { fhirApi, type FhirImagingStudy } from '../../services/api/fhirApi'
import {
  Card,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  message,
  Empty,
  Modal,
  Descriptions,
  Tooltip,
  Badge,
} from "antd";
import { Layers, Search, RefreshCw, Eye } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { t } from '../../i18n/appI18n'

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
        message.warning(res.error?.message ?? t('fis.detailLoadFailed'))
      }
    } catch {
      message.warning(t('fis.detailLoadFailed'))
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
      message.warning(t('fis.listLoadFailed'))
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
      title: t('fis.colId'),
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Tooltip title={id}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id?.slice(0, 10)}...</span></Tooltip>,
    },
    {
      title: t('fis.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { available: 'green', registered: 'blue', unavailable: 'red' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: t('fis.colProcedureCode'),
      key: 'procedureCode',
      render: (_: any, r: FhirImagingStudy) => r.procedureCode?.[0]?.coding?.[0]?.display || r.procedureCode?.[0]?.coding?.[0]?.code || '-',
    },
    {
      title: t('fis.colPatient'),
      key: 'subject',
      render: (_: any, r: FhirImagingStudy) => r.subject?.reference || '-',
    },
    {
      title: t('fis.colSeries'),
      dataIndex: 'numberOfSeries',
      key: 'numberOfSeries',
      render: (v: number) => v != null ? <Badge count={v} style={{ backgroundColor: 'var(--color-primary-600)' }} /> : '-',
    },
    {
      title: t('fis.colInstances'),
      dataIndex: 'numberOfInstances',
      key: 'numberOfInstances',
      render: (v: number) => v != null ? <Badge count={v} style={{ backgroundColor: '#52c41a' }} /> : '-',
    },
    {
      title: t('fis.colStarted'),
      key: 'started',
      render: (_: any, r: FhirImagingStudy) => r.started ? new Date(r.started).toLocaleString() : '-',
    },
    {
      title: t('fis.colAction'),
      key: 'action',
      width: 80,
      render: (_: any, r: FhirImagingStudy) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>{t('fis.detail')}</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Layers size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fis.title')}</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="patient" label={t('fis.patientId')}>
            <Input placeholder={t('fis.patientIdPlaceholder')} allowClear style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="modality" label={t('fis.modality')}>
            <Select allowClear placeholder={t('fis.all')} style={{ width: 120 }}>
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
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>{t('fis.search')}</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>{t('fis.refresh')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={`影像检查列表 (${total})`}>
        <DataTable
          dataSource={studies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={t('fis.detailTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('fis.close')}</Button>}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>{t('fis.loadingDetail')}</div>
        ) : selectedStudy ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedStudy.id}</Descriptions.Item>
            <Descriptions.Item label={t('fis.status')}><Tag color="green">{selectedStudy.status}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('fis.patient')}>{selectedStudy.subject?.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fis.colStarted')}>{selectedStudy.started ? new Date(selectedStudy.started).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fis.seriesCount')}>{selectedStudy.numberOfSeries || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fis.instanceCount')}>{selectedStudy.numberOfInstances || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fis.colProcedureCode')} span={2}>{selectedStudy.procedureCode?.[0]?.coding?.[0]?.display || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fis.location')}>{selectedStudy.location?.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fis.reason')}>{selectedStudy.reasonCode?.[0]?.coding?.[0]?.display || '-'}</Descriptions.Item>
            {selectedStudy.series && selectedStudy.series.length > 0 && (
              <Descriptions.Item label={t('fis.seriesList')} span={2}>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {selectedStudy.series.map((s, i) => (
                    <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <Tag color="blue">{s.modality?.coding?.[0]?.code || '—'}</Tag>
                      <span style={{ fontSize: 12 }}>#{s.number || i + 1} - {s.description || t('fis.noDescription')}</span>
                      <span style={{ color: '#999', marginLeft: 'var(--space-2, 8px)' }}>({s.numberOfInstances || 0}{t('fis.instanceSuffix')})</span>
                    </div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : <Empty description={t('fis.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>
    </div>
  )
}

export default FhirImagingStudyPage

import { DataTable } from "../../components/common";
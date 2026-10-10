import { fhirApi, type FhirDiagnosticReport } from '../../services/api/fhirApi'
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
} from "antd";
import { FileText, Search, RefreshCw, Eye } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { t } from '../../i18n/appI18n'

const PAGE_SIZE = 10

export const FhirDiagnosticReportPage: React.FC = () => {
  const [reports, setReports] = useState<FhirDiagnosticReport[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState<{ patient?: string; status?: string }>({})
  const [searchForm] = Form.useForm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<FhirDiagnosticReport | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = async (report: FhirDiagnosticReport) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedReport(report)
    try {
      const res = await fhirApi.readDiagnosticReport(report.id!)
      if (res.success && res.data) {
        setSelectedReport(res.data)
      } else {
        message.warning(res.error?.message ?? t('fhirReport.detailLoadFail'))
      }
    } catch {
      message.warning(t('fhirReport.detailLoadFail'))
    }
    setDetailLoading(false)
  }

  const fetchReports = useCallback(async (p: number = 1, params: { patient?: string; status?: string } = {}) => {
    setLoading(true)
    try {
      const res = await fhirApi.searchDiagnosticReport({ _count: '200', ...params, page: String(p) })
      if (res.success && res.data) {
        const entries = res.data.entry || []
        setReports(entries.map((e) => e.resource as FhirDiagnosticReport))
        setTotal(res.data.total || entries.length)
      }
    } catch {
      message.warning(t('fhirReport.listLoadFail'))
      setReports([
        { id: 'dr1', resourceType: 'DiagnosticReport', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '24624-7', display: 'Chest X-Ray Report' }], text: '胸部X光报告' }, effectiveDateTime: '2026-01-15', issued: '2026-01-15T10:30:00Z', subject: { reference: 'Patient/p1' } },
        { id: 'dr2', resourceType: 'DiagnosticReport', status: 'preliminary', code: { coding: [{ system: 'http://loinc.org', code: '34565-2', display: 'CT Abdomen Report' }], text: '腹部CT报告' }, effectiveDateTime: '2026-01-16', issued: '2026-01-16T14:20:00Z', subject: { reference: 'Patient/p2' } },
      ])
      setTotal(2)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchReports(page, search) }, [fetchReports, page, search])

  const handleSearch = async () => {
    const values = searchForm.getFieldsValue()
    setSearch({ patient: values.patient, status: values.status })
    setPage(1)
  }

  const columns = [
    {
      title: t('fhirReport.col.id'),
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Tooltip title={id}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id?.slice(0, 10)}...</span></Tooltip>,
    },
    {
      title: t('fhirReport.col.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { final: 'green', preliminary: 'orange', amended: 'red', registered: 'blue' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: t('fhirReport.col.code'),
      key: 'code',
      render: (_: any, r: FhirDiagnosticReport) => (
        <span>{r.code?.text || r.code?.coding?.[0]?.display || r.code?.coding?.[0]?.code || '-'}</span>
      ),
    },
    {
      title: t('fhirReport.col.patient'),
      key: 'subject',
      render: (_: any, r: FhirDiagnosticReport) => r.subject?.reference || '-',
    },
    {
      title: t('fhirReport.col.examTime'),
      dataIndex: 'effectiveDateTime',
      key: 'effectiveDateTime',
    },
    {
      title: t('fhirReport.col.issued'),
      key: 'issued',
      render: (_: any, r: FhirDiagnosticReport) => r.issued ? new Date(r.issued).toLocaleString() : '-',
    },
    {
      title: t('fhirReport.col.action'),
      key: 'action',
      width: 80,
      render: (_: any, r: FhirDiagnosticReport) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>{t('fhirReport.detail')}</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fhirReport.title')}</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="patient" label={t('fhirReport.form.patientId')}>
            <Input placeholder={t('fhirReport.ph.patientId')} allowClear style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="status" label={t('fhirReport.form.status')}>
            <Select allowClear placeholder={t('fhirReport.all')} style={{ width: 140 }}>
              <Select.Option value="final">{t('fhirReport.status.final')}</Select.Option>
              <Select.Option value="preliminary">{t('fhirReport.status.preliminary')}</Select.Option>
              <Select.Option value="amended">{t('fhirReport.status.amended')}</Select.Option>
              <Select.Option value="registered">{t('fhirReport.status.registered')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<Search size={14} />} htmlType="submit" loading={loading}>{t('fhirReport.search')}</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { searchForm.resetFields(); setSearch({}); setPage(1) }}>{t('fhirReport.refresh')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={t('fhirReport.listTitle', { count: total })}>
        <DataTable
          dataSource={reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={t('fhirReport.detailTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('fhirReport.close')}</Button>}
        width={650}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>{t('fhirReport.loadingDetail')}</div>
        ) : selectedReport ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={t('fhirReport.desc.id')}>{selectedReport.id}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.status')}><Tag color="green">{selectedReport.status}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.code')}>{selectedReport.code?.text || selectedReport.code?.coding?.[0]?.display}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.coding')}>{selectedReport.code?.coding?.[0]?.code}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.patient')}>{selectedReport.subject?.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.examTime')}>{selectedReport.effectiveDateTime || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.issued')}>{selectedReport.issued ? new Date(selectedReport.issued).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.performer')}>{selectedReport.performer?.map(p => p.reference).join(', ') || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.resultRef')} span={2}>{selectedReport.result?.map(r => r.reference).join(', ') || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('fhirReport.desc.attachments')} span={2}>
              {selectedReport.presentedForm?.length ? t('fhirReport.attachmentsCount', { count: selectedReport.presentedForm.length }) : '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : <Empty description={t('fhirReport.empty')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>
    </div>
  )
}

export default FhirDiagnosticReportPage

import { DataTable } from "../../components/common";
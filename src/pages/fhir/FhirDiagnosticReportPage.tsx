import { fhirApi, type FhirDiagnosticReport } from '../../services/api/fhirApi'
import { Card, Table, Button, Space, Tag, Form, Input, Select, message, Empty, Modal, Descriptions, Tooltip } from 'antd'
import { FileText, Search, RefreshCw, Eye } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'

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
        message.warning(res.error?.message ?? '诊断报告详情加载失败，展示列表数据')
      }
    } catch {
      message.warning('诊断报告详情加载失败，展示列表数据')
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
      message.warning('诊断报告列表加载失败，使用演示数据')
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
        const colorMap: Record<string, string> = { final: 'green', preliminary: 'orange', amended: 'red', registered: 'blue' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '代码',
      key: 'code',
      render: (_: any, r: FhirDiagnosticReport) => (
        <span>{r.code?.text || r.code?.coding?.[0]?.display || r.code?.coding?.[0]?.code || '-'}</span>
      ),
    },
    {
      title: '患者',
      key: 'subject',
      render: (_: any, r: FhirDiagnosticReport) => r.subject?.reference || '-',
    },
    {
      title: '检查时间',
      dataIndex: 'effectiveDateTime',
      key: 'effectiveDateTime',
    },
    {
      title: '签发时间',
      key: 'issued',
      render: (_: any, r: FhirDiagnosticReport) => r.issued ? new Date(r.issued).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: FhirDiagnosticReport) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>详情</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR DiagnosticReport 管理</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="patient" label="患者 ID">
            <Input placeholder="患者 ID / 参考" allowClear style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select allowClear placeholder="全部" style={{ width: 140 }}>
              <Select.Option value="final">最终</Select.Option>
              <Select.Option value="preliminary">初步</Select.Option>
              <Select.Option value="amended">已修订</Select.Option>
              <Select.Option value="registered">已登记</Select.Option>
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

      <Card size="small" title={`诊断报告列表 (${total})`}>
        <Table
          dataSource={reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false }}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="诊断报告详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={650}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>加载详情...</div>
        ) : selectedReport ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="ID">{selectedReport.id}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color="green">{selectedReport.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="代码">{selectedReport.code?.text || selectedReport.code?.coding?.[0]?.display}</Descriptions.Item>
            <Descriptions.Item label="编码">{selectedReport.code?.coding?.[0]?.code}</Descriptions.Item>
            <Descriptions.Item label="患者">{selectedReport.subject?.reference || '-'}</Descriptions.Item>
            <Descriptions.Item label="检查时间">{selectedReport.effectiveDateTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="签发时间">{selectedReport.issued ? new Date(selectedReport.issued).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="执行者">{selectedReport.performer?.map(p => p.reference).join(', ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="结果引用" span={2}>{selectedReport.result?.map(r => r.reference).join(', ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="附件" span={2}>
              {selectedReport.presentedForm?.length ? `${selectedReport.presentedForm.length} 个附件` : '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>
    </div>
  )
}

export default FhirDiagnosticReportPage

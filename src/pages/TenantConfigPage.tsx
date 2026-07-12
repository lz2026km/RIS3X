import { useState, useEffect } from 'react'
import { Card, Table, Tag, Statistic, Row, Col, Button, Spin, Alert } from 'antd'
import { SafetyCertificateOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { tenantApi, type ComplianceReport } from '../services/api/tenantApi'

export default function TenantConfigPage() {
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    const res = await tenantApi.getComplianceReport()
    if (res.success) setReport(res.data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const columns = [
    { title: '检查项', dataIndex: 'name', key: 'name' },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
    {
      title: '状态', dataIndex: 'passed', key: 'passed',
      render: (v: boolean) => v ? <Tag color="success" icon={<CheckCircleOutlined />}>通过</Tag> : <Tag color="error" icon={<CloseCircleOutlined />}>未通过</Tag>,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}><SafetyCertificateOutlined /> 合规配置</h2>
          <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>刷新</Button>
        </Row>
        {loading ? <Spin /> : !report ? <Alert message="无法获取合规报告" type="error" /> : (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="合规状态" value={report.compliant ? '合规' : '不合规'} valueStyle={{ color: report.compliant ? '#52c41a' : '#ff4d4f' }} prefix={report.compliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />} /></Col>
              <Col span={6}><Statistic title="合规评分" value={report.score} suffix="/100" /></Col>
              <Col span={6}><Statistic title="检查项" value={report.checks.length} /></Col>
            </Row>
            <Table dataSource={report.checks} columns={columns} rowKey="id" pagination={false} size="small" />
          </>
        )}
      </Card>
    </div>
  )
}

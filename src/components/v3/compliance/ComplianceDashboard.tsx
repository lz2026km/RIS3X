import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Row, Col, Progress, Tag, Table, Typography, Space, Statistic, Spin } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { BackendComplianceProvider } from '@/services/compliance'
import type { ComplianceReport, ComplianceCategory } from '@/services/compliance'

const { Title, Text } = Typography

const CATEGORY_MAP: Record<ComplianceCategory, string> = {
  identification: '身份鉴别',
  accessControl: '访问控制',
  securityAudit: '安全审计',
  residualInfo: '剩余信息保护',
  commConfidentiality: '通信保密性',
  dataIntegrity: '数据完整性',
  dataBackup: '数据备份恢复',
  personalInfo: '个人信息保护',
  securityMgmt: '安全管理制度',
  incidentResponse: '应急响应',
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function getStatusTag(implemented: boolean, score: number) {
  if (implemented && score >= 80) return <Tag icon={<CheckCircleOutlined />} color="success">已达标</Tag>
  if (implemented) return <Tag icon={<WarningOutlined />} color="warning">部分达标</Tag>
  if (score > 0) return <Tag icon={<WarningOutlined />} color="warning">未达标</Tag>
  return <Tag icon={<CloseCircleOutlined />} color="error">未实施</Tag>
}

export default function ComplianceDashboard() {
  const { t } = useTranslation()
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const provider = new BackendComplianceProvider()
    provider.getReport().then((r) => {
      setReport(r)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!report) return null

  const columns = [
    {
      title: '检测项',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: ComplianceCategory) => CATEGORY_MAP[cat] ?? cat,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: typeof report.items[0]) => getStatusTag(record.implemented, record.score),
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score: number) => (
        <Text style={{ color: getScoreColor(score), fontWeight: 600 }}>{score}</Text>
      ),
    },
    {
      title: '证据',
      dataIndex: 'evidence',
      key: 'evidence',
      width: 180,
      render: (v: string) => v || '-',
    },
  ]

  return (
    <div>
      <Space align="center" style={{ marginBottom: 24 }}>
        <SafetyCertificateOutlined style={{ fontSize: 24, color: '#1e3a5f' }} />
        <Title level={4} style={{ margin: 0 }}>等保三级合规评估</Title>
        <Tag color="blue">v3.0.2.3</Tag>
        <Text type="secondary">评估时间: {new Date(report.lastAssessedAt).toLocaleString('zh-CN')}</Text>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="综合评分"
              value={report.overallScore}
              suffix="/ 100"
              styles={{ content: {  color: getScoreColor(report.overallScore)  } }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="合规率"
              value={report.overallCompliance}
              suffix="%"
              styles={{ content: {  color: getScoreColor(report.overallCompliance)  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="检测项总数"
              value={report.items.length}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已达标"
              value={report.items.filter((i) => i.implemented).length}
              suffix={`/ ${report.items.length}`}
              styles={{ content: {  color: '#10b981'  } }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {report.categories.map((cat) => (
          <Col xs={24} sm={12} lg={6} key={cat.category}>
            <Card size="small" title={cat.name}>
              <Progress
                type="dashboard"
                percent={cat.averageScore}
                size={80}
                strokeColor={getScoreColor(cat.averageScore)}
              />
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Text type="secondary">{cat.implementedCount}/{cat.itemCount} 项达标</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="合规检查明细">
        <Table
          dataSource={report.items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}

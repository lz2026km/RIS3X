import { useState, useEffect } from 'react'
import { Card, Table, Tag, Statistic, Row, Col, Button, Spin, Alert, Tabs, Descriptions, Space, Badge, Progress } from 'antd'
import { SafetyCertificateOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, SettingOutlined, TeamOutlined, SafetyOutlined, FileProtectOutlined } from '@ant-design/icons'
import { tenantApi, type ComplianceReport } from '../services/api/tenantApi'

interface TenantInfo {
  id: string
  name: string
  license: string
  maxUsers: number
  activeUsers: number
  storageUsed: number
  storageLimit: number
  features: string[]
}

export default function TenantConfigPage() {
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [tenantInfo] = useState<TenantInfo>({
    id: 'tenant-001',
    name: '主租户',
    license: 'Enterprise',
    maxUsers: 200,
    activeUsers: 156,
    storageUsed: 1024 * 1024 * 1024 * 50,
    storageLimit: 1024 * 1024 * 1024 * 100,
    features: ['PACS', 'RIS', 'AI辅助诊断', '报告分发', '远程会诊'],
  })

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

  const checks = Array.isArray(report?.checks) ? report!.checks : []
  const storagePercent = Math.round((tenantInfo.storageUsed / tenantInfo.storageLimit) * 100)
  const passedCount = checks.filter((c) => c.passed).length

  return (
    <div style={{ padding: 24 }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <h2 style={{ margin: 0 }}><SafetyCertificateOutlined /> 租户配置管理</h2>
          <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>刷新</Button>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="合规状态" value={report?.compliant ? '合规' : '不合规'} styles={{ content: {  color: report?.compliant ? '#52c41a' : '#ff4d4f'  } }} prefix={report?.compliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="合规评分" value={report?.score ?? 0} suffix="/100" />
              <Progress percent={report?.score ?? 0} size="small" showInfo={false} status={report?.compliant ? 'success' : 'exception'} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="检查项" value={`${passedCount}/${checks.length}`} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="许可证" value={tenantInfo.license} prefix={<FileProtectOutlined />} />
            </Card>
          </Col>
        </Row>

        <Tabs items={[
          {
            key: 'overview',
            label: <span><SettingOutlined /> 概览</span>,
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="租户信息" size="small">
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="租户ID">{tenantInfo.id}</Descriptions.Item>
                      <Descriptions.Item label="名称">{tenantInfo.name}</Descriptions.Item>
                      <Descriptions.Item label="许可证类型">{tenantInfo.license}</Descriptions.Item>
                      <Descriptions.Item label="用户配额">
                        <Badge count={tenantInfo.activeUsers} overflowCount={9999} style={{ backgroundColor: '#1677ff' }} /> / {tenantInfo.maxUsers}
                      </Descriptions.Item>
                      <Descriptions.Item label="存储使用">
                        <Progress percent={storagePercent} size="small" status={storagePercent > 90 ? 'exception' : 'normal'} />
                        <span style={{ fontSize: 12, color: '#999' }}>{(tenantInfo.storageUsed / 1024 / 1024 / 1024).toFixed(1)} GB / {(tenantInfo.storageLimit / 1024 / 1024 / 1024).toFixed(0)} GB</span>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="已启用功能" size="small">
                    <Space wrap>
                      {tenantInfo.features.map((f) => <Tag key={f} color="blue">{f}</Tag>)}
                    </Space>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'checks',
            label: <span><SafetyOutlined /> 合规检查 ({checks.length})</span>,
            children: loading ? <Spin /> : !report ? <Alert title="无法获取合规报告" type="error" /> : (
              <Table dataSource={checks} columns={columns} rowKey="id" pagination={false} size="small" />
            ),
          },
          {
            key: 'security',
            label: <span><TeamOutlined /> 安全策略</span>,
            children: (
              <Card size="small">
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="密码策略">长度 ≥ 8 位，包含大小写字母和数字</Descriptions.Item>
                  <Descriptions.Item label="会话超时">30 分钟</Descriptions.Item>
                  <Descriptions.Item label="2FA 策略">管理员强制启用</Descriptions.Item>
                  <Descriptions.Item label="登录失败锁定">5 次失败后锁定 15 分钟</Descriptions.Item>
                  <Descriptions.Item label="IP 白名单">已配置</Descriptions.Item>
                  <Descriptions.Item label="审计日志保留">365 天</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]} />
      </Space>
    </div>
  )
}

import React, { useMemo, useState } from 'react'
import { Typography, Card, Row, Col, Statistic, Table, Tag, Alert, Space, Tabs, Progress, Empty, Badge } from 'antd'
import { Shield, Award, Activity, CheckCircle, AlertTriangle, FileText, BarChart3 } from 'lucide-react'
import { hipaaService } from '../../services/compliance/hipaa/HipaaService'
import { gdprService } from '../../services/compliance/gdpr/GdprService'
import { iso27001Service } from '../../services/compliance/iso27001/Iso27001Service'
import type { HipaaRule } from '../../types/security'
import { PageContainer, PageHeader } from '../../components/common'

const { Title, Text } = Typography

export default function HipaaPage() {
  const hipaa = useMemo(() => hipaaService.assess({ assessedBy: 'admin' }), [])
  const gdprStats = useMemo(() => gdprService.stats(), [])
  const iso = useMemo(() => iso27001Service.generateSoA({}), [])
  const [hipaaTab, setHipaaTab] = useState<HipaaRule>('privacy')

  const filterByRule = (rule: HipaaRule) => hipaa.safeguards.filter(s => {
    const item = [...hipaaService.getByRule(rule)]
    return true
  })

  const safeHarbor = hipaaService.checkSafeHarbor()

  return (
    <PageContainer background="slate" maxWidth="full" testId="hipaa-page">
      <PageHeader
        title="HIPAA & GDPR & ISO 27001 合规中心"
        icon={<Shield style={{ marginRight: 8 }} />}
        variant="inline"
        as="h2"
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card size="small"><Statistic title="HIPAA 综合" value={hipaa.overallScore} suffix="/100" prefix={<Award size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="HIPAA 隐私" value={hipaa.privacyScore} suffix="/100" prefix={<Shield size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="HIPAA 安全" value={hipaa.securityScore} suffix="/100" prefix={<Activity size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="GDPR 请求" value={gdprStats.totalRequests} prefix={<FileText size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="ISO 成熟度" value={iso.overallMaturity} suffix="/5" prefix={<BarChart3 size={14} />} /></Card></Col>
      </Row>

      {hipaa.gapItems.length > 0 && (
        <Alert type="warning" message={`${hipaa.gapItems.length} 项差距: ${hipaa.gapItems.join(', ')}`} style={{ marginBottom: 16 }} showIcon />
      )}

      <Tabs
        tabBarExtraContent={
          <Badge
            count={hipaa.gapItems.length}
            title={`${hipaa.gapItems.length} 项差距`}
            style={{ backgroundColor: hipaa.gapItems.length > 0 ? '#dc2626' : '#22c55e' }}
          />
        }
        items={[
        { key: 'hipaa', label: 'HIPAA 评估', children: (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}><Card size="small"><Statistic title="Safe Harbor" value={safeHarbor.total} suffix="类" prefix={<CheckCircle size={14} color="green" />} /></Card></Col>
              <Col span={4}><Card size="small"><Statistic title="符合项" value={hipaa.safeguards.filter(s => s.status === 'met').length} prefix={<CheckCircle size={14} color="green" />} /></Card></Col>
              <Col span={4}><Card size="small"><Statistic title="部分符合" value={hipaa.safeguards.filter(s => s.status === 'partially-met').length} prefix={<AlertTriangle size={14} color="orange" />} /></Card></Col>
              <Col span={4}><Card size="small"><Statistic title="不符合" value={hipaa.safeguards.filter(s => s.status === 'not-met').length} prefix={<AlertTriangle size={14} color="red" />} /></Card></Col>
            </Row>
            {hipaa.recommendations.length > 0 && (
              <Alert type="info" message={hipaa.recommendations.map((r, i) => <div key={i}>• {r}</div>)} style={{ marginBottom: 16 }} />
            )}
            <Table dataSource={hipaa.safeguards} rowKey="id" size="small" pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="暂无 HIPAA 措施" /> }}
              columns={[
                { title: '措施', dataIndex: 'name', key: 'name', width: 200 },
                { title: '规则', dataIndex: 'id', key: 'rule', width: 80, render: (v: string) => <Tag>{v.split('-')[0]}</Tag> },
                { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag>{v}</Tag> },
                { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'met' ? 'green' : 'orange'}>{v}</Tag> },
                { title: '评分', dataIndex: 'score', key: 'score', width: 60, render: (v: number) => <Progress percent={v} size="small" format={() => `${v}`} /> },
                { title: '证据', dataIndex: 'evidence', key: 'evidence', ellipsis: true },
              ]} />
          </div>
        )},
        { key: 'gdpr', label: 'GDPR', children: (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card size="small"><Statistic title="DSAR 请求" value={gdprStats.totalRequests} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="已处理" value={gdprStats.byStatus.completed ?? 0} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="逾期" value={gdprStats.overdue} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="处理活动" value={gdprService.listProcessingActivities().length} /></Card></Col>
            </Row>
            <Table dataSource={gdprService.listProcessingActivities()} rowKey="id" size="small" pagination={false} locale={{ emptyText: <Empty description="暂无处理活动" /> }}
              columns={[
                { title: '活动', dataIndex: 'name', key: 'name', width: 180 },
                { title: '法律基础', dataIndex: 'lawfulBasis', key: 'lawfulBasis', width: 120, render: (v: string) => <Tag>{v}</Tag> },
                { title: '数据类别', dataIndex: 'dataCategories', key: 'dataCategories', render: (v: string[]) => v.map((c, i) => <Tag key={i}>{c}</Tag>) },
                { title: '接收方', dataIndex: 'recipients', key: 'recipients', render: (v: string[]) => v.join(', ') },
                { title: '保留期', dataIndex: 'retentionDays', key: 'retentionDays', width: 80, render: (v: number) => `${Math.round(v / 365)}y` },
                { title: '跨境', dataIndex: 'crossBorderTransfer', key: 'crossBorderTransfer', width: 60, render: (v: boolean) => <Tag color={v ? 'red' : 'green'}>{v ? '是' : '否'}</Tag> },
              ]} />
          </div>
        )},
          { key: 'iso', label: 'ISO 27001', children: (
            <div>
              <Table dataSource={iso.controls} rowKey="id" size="small" pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="暂无 ISO 控制" /> }}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
                  { title: '控制', dataIndex: 'control', key: 'control', width: 150 },
                  { title: '类别', dataIndex: 'category', key: 'category', width: 130, render: (v: string) => <Tag>{v.split('-')[1]}</Tag> },
                  { title: '目标', dataIndex: 'objective', key: 'objective', width: 120 },
                  { title: '已实施', dataIndex: 'implemented', key: 'implemented', width: 70, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '是' : '否'}</Tag> },
                  { title: '成熟度', dataIndex: 'maturityLevel', key: 'maturityLevel', width: 80, render: (v: number) => <Progress percent={v * 20} size="small" format={p => `${v}/5`} /> },
                ]} />
            </div>
          )},
        ]} />
    </PageContainer>
  )
}

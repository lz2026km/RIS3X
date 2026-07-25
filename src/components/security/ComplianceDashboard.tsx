import React, { useMemo } from 'react'
import { Card, Row, Col, Statistic, Tag, Table, Progress, Typography, Alert, Space, Tabs, Empty } from 'antd'
import { Shield, CheckCircle, XCircle, AlertTriangle, BarChart3, Activity, Target, Award } from 'lucide-react'
import { mlpsService } from '../../services/compliance/mlps/MlpsService'
import { hipaaService } from '../../services/compliance/hipaa/HipaaService'
import { gdprService } from '../../services/compliance/gdpr/GdprService'
import { iso27001Service } from '../../services/compliance/iso27001/Iso27001Service'
import type { MlpsLevel, HipaaAssessment, IsoStatementApplicability } from '../../types/security'

const { Title, Text } = Typography

export default function ComplianceDashboard() {
  const mlps = useMemo(() => mlpsService.audit({ targetLevel: 3 }), [])
  const hipaa = useMemo(() => hipaaService.assess({}), [])
  const iso = useMemo(() => iso27001Service.generateSoA({}), [])
  const gdprStats = useMemo(() => gdprService.stats(), [])

  const renderMlps = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="等保 3 级评分" value={mlps.overallScore} suffix="/100" prefix={<Shield size={14} />} valueStyle={{ color: mlps.overallScore >= 85 ? '#3f8600' : '#faad14' }} /></Card></Col>
        {Object.entries(mlps.areaSummaries).map(([area, s]) => (
          <Col key={area} span={6}><Card size="small" title={area}><Progress percent={s.score} size="small" format={p => `${p}%`} /></Card></Col>
        ))}
      </Row>
      <Table dataSource={mlps.items} rowKey="id" size="small" pagination={false} scroll={{ y: 300 }} locale={{ emptyText: <Empty description="暂无等保数据" /> }}
        columns={[
          { title: '控制项', dataIndex: 'control', key: 'control', width: 120 },
          { title: '领域', dataIndex: 'area', key: 'area', width: 80, render: (v: string) => <Tag>{v}</Tag> },
          { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => {
            const m: Record<string, { color: string; label: string }> = { compliant: { color: 'green', label: '合规' }, partial: { color: 'orange', label: '部分' }, 'non-compliant': { color: 'red', label: '不合规' }, 'not-applicable': { color: 'default', label: 'N/A' } }
            return <Tag color={m[v]?.color}>{m[v]?.label ?? v}</Tag>
          }},
          { title: '评分', dataIndex: 'score', key: 'score', width: 60, render: (v: number) => <Progress percent={v} size="small" format={() => `${v}`} /> },
          { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
        ]} />
      {mlps.gapAnalysis.length > 0 && <Alert type="warning" message={`${mlps.gapAnalysis.length} 项差距待修复`} style={{ marginTop: 16 }} />}
    </div>
  )

  const renderHipaa = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="综合评分" value={hipaa.overallScore} suffix="/100" prefix={<Award size={14} />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="隐私规则" value={hipaa.privacyScore} suffix="/100" prefix={<Shield size={14} />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="安全规则" value={hipaa.securityScore} suffix="/100" prefix={<Activity size={14} />} /></Card></Col>
      </Row>
      <Table dataSource={hipaa.safeguards} rowKey="id" size="small" pagination={false} scroll={{ y: 300 }} locale={{ emptyText: <Empty description="暂无 HIPAA 数据" /> }}
        columns={[
          { title: '措施', dataIndex: 'name', key: 'name', width: 200 },
          { title: '类型', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag>{v}</Tag> },
          { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'met' ? 'green' : 'orange'}>{v}</Tag> },
          { title: '评分', dataIndex: 'score', key: 'score', width: 60 },
        ]} />
      {hipaa.recommendations.length > 0 && (
        <Alert type="info" message={hipaa.recommendations.join('; ')} style={{ marginTop: 16 }} />
      )}
    </div>
  )

  const renderIso = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="整体成熟度" value={iso.overallMaturity} suffix="/5" prefix={<Target size={14} />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="已接受风险" value={iso.risksAccepted} prefix={<CheckCircle size={14} color="green" />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="已处理风险" value={iso.risksTreated} prefix={<Activity size={14} color="blue" />} /></Card></Col>
      </Row>
      <Table dataSource={iso.controls} rowKey="id" size="small" pagination={false} scroll={{ y: 300 }} locale={{ emptyText: <Empty description="暂无 ISO 数据" /> }}
        columns={[
          { title: '控制 ID', dataIndex: 'id', key: 'id', width: 80 },
          { title: '控制', dataIndex: 'control', key: 'control', width: 150 },
          { title: '成熟度', dataIndex: 'maturityLevel', key: 'maturityLevel', width: 80, render: (v: number) => <Progress percent={v * 20} size="small" format={p => `${v}/5`} /> },
          { title: '差距', dataIndex: 'gaps', key: 'gaps', render: (g: string[]) => g.length > 0 ? g.map((x, i) => <Tag key={i} color="orange">{x}</Tag>) : <Tag color="green">无</Tag> },
        ]} />
    </div>
  )

  const renderGdpr = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="请求总数" value={gdprStats.totalRequests} prefix={<BarChart3 size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="逾期" value={gdprStats.overdue} valueStyle={{ color: '#cf1322' }} prefix={<AlertTriangle size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均响应" value={gdprStats.avgResponseDays} suffix="天" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="处理活动" value={gdprService.listProcessingActivities().length} /></Card></Col>
      </Row>
    </div>
  )

  return (
    <Card title={<><Shield size={16} style={{ marginRight: 8 }} />合规仪表板</>}>
      <Tabs items={[
        { key: 'mlps', label: '等保 2.0', children: renderMlps() },
        { key: 'hipaa', label: 'HIPAA', children: renderHipaa() },
        { key: 'iso', label: 'ISO 27001', children: renderIso() },
        { key: 'gdpr', label: 'GDPR', children: renderGdpr() },
      ]} />
    </Card>
  )
}

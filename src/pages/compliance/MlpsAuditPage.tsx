import React, { useState, useMemo } from 'react'
import { Typography, Card, Row, Col, Statistic, Table, Tag, Progress, Alert, Space, Select, Tabs, Empty } from 'antd'
import { Shield, Award, Activity, AlertTriangle, CheckCircle, Target, BarChart3 } from 'lucide-react'
import { mlpsService } from '../../services/compliance/mlps/MlpsService'
import type { MlpsLevel, MlpsAuditResult } from '../../types/security'

const { Title, Text } = Typography

const areaLabels: Record<string, string> = { physical: '物理安全', network: '网络安全', host: '主机安全', application: '应用安全', data: '数据安全', management: '安全管理' }

export default function MlpsAuditPage() {
  const [level, setLevel] = useState<MlpsLevel>(3)

  const result: MlpsAuditResult = useMemo(() => mlpsService.audit({ targetLevel: level, auditedBy: 'admin' }), [level])

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}><Shield style={{ marginRight: 8 }} />等保 2.0 合规审计 (L{level})</Title>
      <Space style={{ marginBottom: 16 }}>
        <Text>目标等级:</Text>
        <Select value={level} onChange={v => setLevel(v as MlpsLevel)} style={{ width: 100 }}>
          {[1, 2, 3, 4, 5].map(l => <Select.Option key={l} value={l}>L{l}</Select.Option>)}
        </Select>
        <Text type="secondary">共 {result.items.length} 项检查, 合规率 {result.overallScore}%</Text>
      </Space>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}><Card size="small"><Statistic title="综合评分" value={result.overallScore} suffix="/100" prefix={<Award size={14} />} styles={{ content: {  color: result.overallScore >= 85 ? '#3f8600' : '#faad14'  } }} /></Card></Col>
        {Object.entries(result.areaSummaries).map(([area, s]) => (
          <Col key={area} span={4}><Card size="small" title={areaLabels[area] ?? area}>
            <Statistic title={s.compliant + s.partial + s.nonCompliant + '项'} value={s.score} suffix="/100" styles={{ content: {  fontSize: 18  } }} />
            <Progress percent={s.score} size="small" format={p => `${p}%`} />
            <Space size={4} style={{ marginTop: 4 }}>
              <Tag color="green">{s.compliant}</Tag><Tag color="orange">{s.partial}</Tag><Tag color="red">{s.nonCompliant}</Tag>
            </Space>
          </Card></Col>
        ))}
      </Row>

      {result.gapAnalysis.length > 0 && (
        <Alert type="warning" title={`${result.gapAnalysis.length} 项差距项, 建议优先处理低分领域`} style={{ marginBottom: 16 }} showIcon />
      )}

      <Card title="检查项明细" extra={<Text type="secondary">{result.recommendation}</Text>}>
        <Table dataSource={result.items} rowKey="id" size="small" pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: <Empty description="无检查项" /> }}
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
            { title: '控制项', dataIndex: 'control', key: 'control', width: 120 },
            { title: '领域', dataIndex: 'area', key: 'area', width: 80, render: (v: string) => <Tag>{areaLabels[v] ?? v}</Tag> },
            { title: '等级', dataIndex: 'level', key: 'level', width: 50, render: (v: number) => <Tag>L{v}</Tag> },
            { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => {
              const m: Record<string, { color: string; label: string }> = { compliant: { color: 'green', label: '合规' }, partial: { color: 'orange', label: '部分' }, 'non-compliant': { color: 'red', label: '不合规' }, 'not-applicable': { color: 'default', label: 'N/A' } }
              return <Tag color={m[v]?.color}>{m[v]?.label ?? v}</Tag>
            }},
            { title: '得分', dataIndex: 'score', key: 'score', width: 100, render: (v: number) => <Progress percent={v} size="small" format={p => `${v}`} strokeColor={v >= 90 ? '#52c41a' : v >= 60 ? '#faad14' : '#f5222d'} /> },
            { title: '实施', dataIndex: 'implementation', key: 'implementation', ellipsis: true },
          ]} />
      </Card>
    </div>
  )
}

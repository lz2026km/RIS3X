import React, { useState } from 'react';
import { Card, Row, Col, Tag, Statistic, Table, Progress, Tabs, Select, Space, Badge } from 'antd';
import { BarChart3, TrendingUp, TrendingDown, Activity, Users, DollarSign, Smile, AlertTriangle } from 'lucide-react';
import { MOCK_QUALITY_METRICS } from '@/data/eyeQualityMock';
import { MOCK_PATIENT_SATISFACTION } from '@/data/eyeTypicalCasesMock';
import { PageContainer, PageHeader } from '@/components/common';
const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };

const categoryIcons: Record<string, React.ReactNode> = { productivity: <Activity size={16} color="#1677ff" />, clinical: <BarChart3 size={16} color="#22c55e" />, operational: <Users size={16} color="#f59e0b" />, financial: <DollarSign size={16} color="#10b981" />, satisfaction: <Smile size={16} color="#8b5cf6" /> };
const categoryColors: Record<string, string> = { productivity: '#1677ff', clinical: '#22c55e', operational: '#f59e0b', financial: '#10b981', satisfaction: '#8b5cf6' };
const CATEGORY_LABELS_DICT: Record<string, string> = { productivity: '效率', clinical: '临床', operational: '运营', financial: '财务', satisfaction: '满意度' };

const EyeKpiDashboardPage: React.FC = () => {
  const [tab, setTab] = useState('all');
  const filtered = tab === 'all' ? MOCK_QUALITY_METRICS : MOCK_QUALITY_METRICS.filter(m => m.category === tab);
  const avgSat = MOCK_PATIENT_SATISFACTION.reduce((s, p) => s + p.overallScore, 0) / MOCK_PATIENT_SATISFACTION.length;
  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-kpi-dashboard-page">
      <PageHeader
        title="眼科质控看板"
        icon={<BarChart3 size={24} color="#1677ff" />}
        variant="inline"
        actions={<Tag color="blue">{filtered.length} 指标</Tag>}
      />
    {/* v3.0.6.8-23c (A8-P0-4): auto-fit 响应式 KPI 网格 */}
    <div data-testid="eye-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
      <Card size="small"><Statistic title="日均检查" value={42} suffix="人次" prefix={<Activity size={16} />} /></Card>
      <Card size="small"><Statistic title="AI采纳率" value={72.3} suffix="%" prefix={<BarChart3 size={16} />} valueStyle={{ color: '#22c55e' }} /></Card>
      <Card size="small"><Statistic title="患者满意度" value={avgSat.toFixed(1)} suffix="分" prefix={<Smile size={16} color="#8b5cf6" />} /></Card>
      <Card size="small"><Statistic title="平均候诊" value={22} suffix="min" prefix={<AlertTriangle size={16} color="#f59e0b" />} /></Card>
      <Card size="small"><Statistic title="次均费用" value={385} suffix="元" prefix={<DollarSign size={16} color="#10b981" />} /></Card>
      <Card size="small"><Statistic title="危急值响应" value={28} suffix="min" prefix={<AlertTriangle size={16} color="#ef4444" />} /></Card>
    </div>
    <Card size="small">
      <Tabs
        activeKey={tab}
        onChange={setTab}
        tabBarExtraContent={
          <Badge
            count={filtered.length}
            title={`当前 ${filtered.length} 项指标`}
            style={{ backgroundColor: '#1677ff' }}
          />
        }
        items={[
          { key: 'all', label: '全部指标' },
          ...Object.entries(categoryIcons).map(([k]) => ({ key: k, label: { productivity: '效率', clinical: '临床', operational: '运营', financial: '财务', satisfaction: '满意度' }[k] || k })),
        ]}
      />
      <Table dataSource={filtered} rowKey="id" size="small" pagination={{ pageSize: 10 }}
        columns={[
          { title: '类别', dataIndex: 'category', key: 'category', width: 70, render: (v: string) => <Tag color={categoryColors[v]}>{CATEGORY_LABELS_DICT[v] || v}</Tag> },
          { title: '指标', dataIndex: 'name', key: 'name', width: 200 },
          { title: '值', dataIndex: 'value', key: 'value', width: 80, render: (v: number, r: any) => <span style={{ fontWeight: 600 }}>{v}{r.unit}</span> },
          { title: '目标', dataIndex: 'target', key: 'target', width: 60, render: (v: number) => v },
          { title: '达成率', key: 'rate', width: 120, render: (_, r: any) => <PercentBar value={r.value} target={r.target} /> },
          { title: '趋势', dataIndex: 'trend', key: 'trend', width: 60, render: (v: string) => v === 'up' ? <TrendingUp size={14} color="#22c55e" /> : v === 'down' ? <TrendingDown size={14} color="#ef4444" /> : <span style={{ color: '#94a3b8' }}>→</span> },
          { title: '周期', dataIndex: 'period', key: 'period', width: 50 },
          { title: '医生', dataIndex: 'doctorId', key: 'doctorId', width: 80, render: (v: string) => v ? <Tag>{MODALITY_LABELS[v] || v}</Tag> : '-' },
        ]} />
    </Card>
    <Card size="small" title="患者满意度趋势" style={{ marginTop: 8 }}>
      <Row gutter={12}>{['沟通', '候诊', '环境', '推荐'].map((s, i) => {
        const scores = MOCK_PATIENT_SATISFACTION.map(p => [p.communicationScore, p.waitTimeScore, p.facilityScore, p.recommendationScore][i]);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return <Col span={6} key={s}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#64748b' }}>{s}</div><Progress type="dashboard" percent={avg} size={60} strokeColor={avg >= 90 ? '#22c55e' : avg >= 80 ? '#1677ff' : '#f59e0b'} /><div style={{ fontSize: 12, fontWeight: 600 }}>{avg}分</div></div></Col>;
      })}</Row>
    </Card>
  </PageContainer>
  );
};

const PercentBar: React.FC<{ value: number; target: number }> = ({ value, target }) => {
  const pct = Math.min(Math.round((value / target) * 100), 100);
  return <Progress percent={pct} size="small" strokeColor={pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'} style={{ margin: 0 }} />;
};
export default EyeKpiDashboardPage;

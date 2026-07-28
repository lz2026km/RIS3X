import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Spin, Empty } from 'antd';
import { TrendingUp, TrendingDown, Minus, Gauge, Activity, Zap, ShieldCheck, BarChart3, Clock, Inbox } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DeviceOEE {
  id: string; name: string; model: string; modality: string;
  oee: number; availability: number; performance: number; quality: number; trend: 'up' | 'down' | 'stable';
}

const COLORS = { red: '#ff4d4f', yellow: '#faad14', green: '#52c41a', blue: '#1677ff' };

const PIE_COLORS = ['#ff4d4f', '#faad14', '#1677ff', '#722ed1'];

const trendIcon = (t: string) => {
  if (t === 'up') return <TrendingUp size={14} color={COLORS.green} />;
  if (t === 'down') return <TrendingDown size={14} color={COLORS.red} />;
  return <Minus size={14} color="#999" />;
};

const oeeColor = (v: number) => (v < 60 ? COLORS.red : v < 85 ? COLORS.yellow : COLORS.green);

export const OEEDashboardPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceOEE[]>([]);
  const [timeRange, setTimeRange] = useState('today');
  const [trendData, setTrendData] = useState<{ date: string; oee: number; availability: number; performance: number; quality: number }[]>([]);
  const [causeData, setCauseData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/oee/list').then(r => r.json()).catch(() => ({ success: false, data: [] })),
      fetch('/api/oee/trend/CT-01').then(r => r.json()).catch(() => ({ success: false, data: [] })),
      fetch('/api/oee/causes').then(r => r.json()).catch(() => ({ success: false, data: [] })),
    ]).then(([listRes, trendRes, causeRes]) => {
      if (listRes.success && Array.isArray(listRes.data)) setDevices(listRes.data);
      if (trendRes.success && Array.isArray(trendRes.data)) setTrendData(trendRes.data);
      if (causeRes.success && Array.isArray(causeRes.data)) setCauseData(causeRes.data);
      setLoading(false);
    });
  }, [timeRange]);

  const avgMetric = (key: keyof DeviceOEE) => Math.round(devices.reduce((s, d) => s + (d[key] as number), 0) / devices.length * 10) / 10;
  const avgOEE = avgMetric('oee');
  const avgAvail = avgMetric('availability');
  const avgPerf = avgMetric('performance');
  const avgQual = avgMetric('quality');

  const sorted = [...devices].sort((a, b) => b.oee - a.oee);

  const columns = [
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { title: '型号', dataIndex: 'model', key: 'model' },
    { title: 'Modality', dataIndex: 'modality', key: 'modality' },
    { title: 'OEE%', dataIndex: 'oee', key: 'oee', render: (v: number) => <span style={{ color: oeeColor(v), fontWeight: 600 }}>{v}%</span>, sorter: (a: DeviceOEE, b: DeviceOEE) => a.oee - b.oee },
    { title: '可用性%', dataIndex: 'availability', key: 'availability', render: (v: number) => `${v}%` },
    { title: '性能%', dataIndex: 'performance', key: 'performance', render: (v: number) => `${v}%` },
    { title: '质量%', dataIndex: 'quality', key: 'quality', render: (v: number) => `${v}%` },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (t: string) => trendIcon(t) },
  ];

  const KpiCard = ({ title, value, icon, color, suffix }: { title: string; value: number; icon: React.ReactNode; color: string; suffix?: string }) => (
    <Card size="small" hoverable style={{ borderLeft: `4px solid ${color}` }}>
      <Statistic title={<Space><span style={{ color }}>{icon}</span>{title}</Space>} value={value} suffix={suffix || '%'} valueStyle={{ color }} precision={1} />
    </Card>
  );

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Gauge size={20} color={COLORS.blue} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>设备 OEE 看板</span>
            <Tag color="blue">Overall Equipment Effectiveness</Tag>
          </Space>
          <Space>
            {['today', 'week', 'month', 'custom'].map(t => (
              <Button key={t} type={timeRange === t ? 'primary' : 'default'} size="small" onClick={() => setTimeRange(t)}>
                {{ today: '今日', week: '本周', month: '本月', custom: '自定义' }[t]}
              </Button>
            ))}
          </Space>
        </Space>
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <Empty description="暂无设备 OEE 数据" image={<Inbox size={48} color="#94a3b8" />} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Gauge size={20} color={COLORS.blue} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>设备 OEE 看板</span>
          <Tag color="blue">Overall Equipment Effectiveness</Tag>
        </Space>
        <Space>
          {['today', 'week', 'month', 'custom'].map(t => (
            <Button key={t} type={timeRange === t ? 'primary' : 'default'} size="small" onClick={() => setTimeRange(t)}>
              {{ today: '今日', week: '本周', month: '本月', custom: '自定义' }[t]}
            </Button>
          ))}
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><KpiCard title="综合 OEE" value={avgOEE} icon={<Gauge size={16} />} color={oeeColor(avgOEE)} /></Col>
        <Col span={6}><KpiCard title="可用性" value={avgAvail} icon={<Clock size={16} />} color={COLORS.blue} /></Col>
        <Col span={6}><KpiCard title="性能" value={avgPerf} icon={<Zap size={16} />} color={COLORS.blue} /></Col>
        <Col span={6}><KpiCard title="质量" value={avgQual} icon={<ShieldCheck size={16} />} color={COLORS.blue} /></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card size="small" title={<Space><BarChart3 size={14} color={COLORS.blue} />OEE 趋势</Space>}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="oee" stroke={COLORS.blue} name="OEE" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="availability" stroke={COLORS.green} name="可用性" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="performance" stroke={COLORS.yellow} name="性能" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="quality" stroke="#722ed1" name="质量" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><Activity size={14} color={COLORS.blue} />低 OEE 原因分析</Space>}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={causeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {causeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<Space><BarChart3 size={14} color={COLORS.blue} />设备 OEE 列表（按 OEE 降序）</Space>}>
        <Table dataSource={sorted} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10 }}
          rowClassName={(r: DeviceOEE) => r.oee < 60 ? 'oee-row-red' : r.oee < 85 ? 'oee-row-yellow' : ''}
        />
      </Card>

      <style>{`
        .oee-row-red { background: #fff2f0 !important; }
        .oee-row-yellow { background: #fffbe6 !important; }
        .oee-row-red:hover td, .oee-row-yellow:hover td { filter: brightness(0.95); }
      `}</style>
    </div>
  );
};

export default OEEDashboardPage;

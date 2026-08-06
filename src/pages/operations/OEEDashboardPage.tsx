// [G005 W1-1] OEE 看板 - 接入后端 /oee/list|detail|trend|stats
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Spin, Empty, Alert, Select } from 'antd';
import { TrendingUp, TrendingDown, Minus, Gauge, Activity, Zap, ShieldCheck, BarChart3, Clock, Inbox, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { oeeApi } from '../../services/api';
import type { OeeDeviceMetric, OeePoint, OeeDeviceDetail, OeeStats } from '../../services/api';

const COLORS = { red: '#ff4d4f', yellow: '#faad14', green: '#52c41a', blue: '#1677ff' };

const PIE_COLORS = ['#ff4d4f', '#faad14', '#1677ff', '#722ed1'];

const trendIcon = (t: string) => {
  if (t === 'up') return <TrendingUp size={14} color={COLORS.green} />;
  if (t === 'down') return <TrendingDown size={14} color={COLORS.red} />;
  return <Minus size={14} color="#999" />;
};

const oeeColor = (v: number) => (v < 60 ? COLORS.red : v < 85 ? COLORS.yellow : COLORS.green);

export const OEEDashboardPage: React.FC = () => {
  const [devices, setDevices] = useState<OeeDeviceMetric[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<OeePoint[]>([]);
  const [stats, setStats] = useState<OeeStats | null>(null);
  const [causeData, setCauseData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listRes, statsRes] = await Promise.all([oeeApi.list(), oeeApi.getStats()]);
    if (!listRes.success) {
      setError(listRes.error?.message ?? '设备 OEE 数据加载失败');
      setLoading(false);
      return;
    }
    const list = listRes.data ?? [];
    setDevices(list);
    setStats(statsRes.success ? statsRes.data : null);
    const target = list.some(d => d.id === selectedDevice)
      ? selectedDevice
      : (list[0]?.id ?? null);
    setSelectedDevice(target);
    if (target) {
      const [trendRes, detailRes] = await Promise.all([oeeApi.getTrend(target), oeeApi.getDetail(target)]);
      if (trendRes.success) setTrendData(trendRes.data ?? []);
      const detail: OeeDeviceDetail | null = detailRes.success ? detailRes.data : null;
      if (detail) {
        setCauseData([
          { name: '停机故障', value: detail.breakdownLoss },
          { name: '换型调整', value: detail.setupLoss },
          { name: '速度减速', value: detail.speedLoss },
          { name: '缺陷返工', value: detail.defectLoss },
        ]);
      }
    } else {
      setTrendData([]);
      setCauseData([]);
    }
    setLoading(false);
  }, [selectedDevice]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
  };

  const avgMetric = (key: keyof OeeDeviceMetric) =>
    devices.length === 0
      ? 0
      : Math.round(devices.reduce((s, d) => s + (d[key] as number), 0) / devices.length * 10) / 10;
  const avgOEE = avgMetric('oee');
  const avgAvail = avgMetric('availability');
  const avgPerf = avgMetric('performance');
  const avgQual = avgMetric('quality');

  const sorted = [...devices].sort((a, b) => b.oee - a.oee);

  const columns = [
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { title: '型号', dataIndex: 'model', key: 'model' },
    { title: 'Modality', dataIndex: 'modality', key: 'modality' },
    { title: 'OEE%', dataIndex: 'oee', key: 'oee', render: (v: number) => <span style={{ color: oeeColor(v), fontWeight: 600 }}>{v}%</span>, sorter: (a: OeeDeviceMetric, b: OeeDeviceMetric) => a.oee - b.oee },
    { title: '可用性%', dataIndex: 'availability', key: 'availability', render: (v: number) => `${v}%` },
    { title: '性能%', dataIndex: 'performance', key: 'performance', render: (v: number) => `${v}%` },
    { title: '质量%', dataIndex: 'quality', key: 'quality', render: (v: number) => `${v}%` },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (t: string) => trendIcon(t) },
  ];

  const KpiCard = ({ title, value, icon, color, suffix }: { title: string; value: number; icon: React.ReactNode; color: string; suffix?: string }) => (
    <Card size="small" hoverable style={{ borderLeft: `4px solid ${color}` }}>
      <Statistic title={<Space><span style={{ color }}>{icon}</span>{title}</Space>} value={value} suffix={suffix || '%'} styles={{ content: { color } }} precision={1} />
    </Card>
  );

  if (loading && devices.length === 0) {
    return (
      <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" description="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Gauge size={20} color={COLORS.blue} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>设备 OEE 看板</span>
            <Tag color="blue">Overall Equipment Effectiveness</Tag>
          </Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>重试</Button>
        </Space>
        <Alert type="error" showIcon message="加载失败" description={error} />
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
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>刷新</Button>
        </Space>
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <Empty description="暂无设备 OEE 数据" image={<Inbox size={48} color="#94a3b8" />} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <Gauge size={20} color={COLORS.blue} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>设备 OEE 看板</span>
          <Tag color="blue">Overall Equipment Effectiveness</Tag>
          {stats && <Tag color="purple">设备数 {stats.totalDevices} · 最高 {stats.highest}% · 最低 {stats.lowest}%</Tag>}
        </Space>
        <Space>
          <Select
            value={selectedDevice ?? undefined}
            onChange={handleDeviceChange}
            style={{ width: 240 }}
            placeholder="选择设备查看趋势"
            options={devices.map(d => ({ value: d.id, label: `${d.name} (${d.id})` }))}
          />
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>刷新</Button>
        </Space>
      </Space>

      {error && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="部分数据加载失败" description={error} closable onClose={() => setError(null)} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><KpiCard title="综合 OEE" value={avgOEE} icon={<Gauge size={16} />} color={oeeColor(avgOEE)} /></Col>
        <Col span={6}><KpiCard title="可用性" value={avgAvail} icon={<Clock size={16} />} color={COLORS.blue} /></Col>
        <Col span={6}><KpiCard title="性能" value={avgPerf} icon={<Zap size={16} />} color={COLORS.blue} /></Col>
        <Col span={6}><KpiCard title="质量" value={avgQual} icon={<ShieldCheck size={16} />} color={COLORS.blue} /></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card size="small" title={<Space><BarChart3 size={14} color={COLORS.blue} />OEE 趋势{selectedDevice ? ` - ${selectedDevice}` : ''}</Space>}>
            {trendData.length === 0 ? (
              <Empty description="暂无趋势数据" style={{ padding: 40 }} />
            ) : (
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
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><Activity size={14} color={COLORS.blue} />低 OEE 原因分析{selectedDevice ? ` - ${selectedDevice}` : ''}</Space>}>
            {causeData.length === 0 ? (
              <Empty description="暂无原因数据" style={{ padding: 40 }} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={causeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {causeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<Space><BarChart3 size={14} color={COLORS.blue} />设备 OEE 列表（按 OEE 降序）</Space>}>
        <Table dataSource={sorted} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10 }}
          rowClassName={(r: OeeDeviceMetric) => r.oee < 60 ? 'oee-row-red' : r.oee < 85 ? 'oee-row-yellow' : ''}
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

// [G005 W1-1] OEE 看板 - 接入后端 /oee/list|detail|trend|stats
import { ChartContainer } from '../../components/charts'
import { oeeApi } from '../../services/api';
import { OeeDeviceDetail, OeeDeviceMetric, OeePoint, OeeStats } from '../../services/api'
import OeeOverviewSection from './OeeOverviewSection';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Spin, Empty, Alert, Select } from 'antd';
import { TrendingUp, TrendingDown, Minus, Gauge, Activity, Zap, ShieldCheck, BarChart3, Clock, Inbox, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { t } from '../../i18n/appI18n';

const COLORS = { red: '#ff4d4f', yellow: '#faad14', green: '#52c41a', blue: '#2563eb' };

const PIE_COLORS = ['#ff4d4f', '#faad14', '#2563eb', '#722ed1'];

const trendIcon = (t: string) => {
  if (t === 'up') return <TrendingUp size={14} color={COLORS.green} />;
  if (t === 'down') return <TrendingDown size={14} color={COLORS.red} />;
  return <Minus size={14} color="var(--text-secondary)" />;
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
  // [W2-C] 受控分页
  const [devicePage, setDevicePage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listRes, statsRes] = await Promise.all([oeeApi.list(), oeeApi.getStats()]);
    if (!listRes.success) {
      setError(listRes.error?.message ?? t('oeePage.loadFailed'));
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
          { name: t('oeePage.cause.breakdown'), value: detail.breakdownLoss },
          { name: t('oeePage.cause.setup'), value: detail.setupLoss },
          { name: t('oeePage.cause.speed'), value: detail.speedLoss },
          { name: t('oeePage.cause.defect'), value: detail.defectLoss },
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
    { title: t('oeePage.colName'), dataIndex: 'name', key: 'name' },
    { title: t('oeePage.colModel'), dataIndex: 'model', key: 'model' },
    { title: t('oeePage.colModality'), dataIndex: 'modality', key: 'modality' },
    { title: 'OEE%', dataIndex: 'oee', key: 'oee', render: (v: number) => <span style={{ color: oeeColor(v), fontWeight: 600 }}>{v}%</span>, sorter: (a: OeeDeviceMetric, b: OeeDeviceMetric) => a.oee - b.oee },
    { title: t('oeePage.colAvailability'), dataIndex: 'availability', key: 'availability', render: (v: number) => `${v}%` },
    { title: t('oeePage.colPerformance'), dataIndex: 'performance', key: 'performance', render: (v: number) => `${v}%` },
    { title: t('oeePage.colQuality'), dataIndex: 'quality', key: 'quality', render: (v: number) => `${v}%` },
    { title: t('oeePage.colTrend'), dataIndex: 'trend', key: 'trend', render: (t: string) => trendIcon(t) },
  ];

  const KpiCard = ({ title, value, icon, color, suffix }: { title: string; value: number; icon: React.ReactNode; color: string; suffix?: string }) => (
    <Card size="small" hoverable style={{ borderLeft: `4px solid ${color}` }}>
      <Statistic title={<Space><span style={{ color }}>{icon}</span>{title}</Space>} value={value} suffix={suffix || '%'} styles={{ content: { color } }} precision={1} />
    </Card>
  );

  if (loading && devices.length === 0) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" description={t('oeePage.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Gauge size={20} color={COLORS.blue} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>{t('oeePage.title')}</span>
            <Tag color="blue">{t('oeePage.overallEquipment')}</Tag>
          </Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>{t('oeePage.retry')}</Button>
        </Space>
        <Alert type="error" showIcon message={t('oeePage.loadError')} description={error} />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Gauge size={20} color={COLORS.blue} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>{t('oeePage.title')}</span>
            <Tag color="blue">{t('oeePage.overallEquipment')}</Tag>
          </Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>{t('oeePage.refresh')}</Button>
        </Space>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <Empty description={t('oeePage.noData')} image={<Inbox size={48} color="var(--text-secondary)" />} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <Gauge size={20} color={COLORS.blue} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>{t('oeePage.title')}</span>
          <Tag color="blue">{t('oeePage.overallEquipment')}</Tag>
          {stats && <Tag color="purple">{t('oeePage.statsTag', { total: stats.totalDevices, high: stats.highest, low: stats.lowest })}</Tag>}
        </Space>
        <Space>
          <Select
            value={selectedDevice ?? undefined}
            onChange={handleDeviceChange}
            style={{ width: 240 }}
            placeholder={t('oeePage.selectDevice')}
            options={devices.map(d => ({ value: d.id, label: `${d.name} (${d.id})` }))}
          />
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>{t('oeePage.refresh')}</Button>
        </Space>
      </Space>

      {error && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('oeePage.partialFailed')} description={error} closable onClose={() => setError(null)} />}

      <OeeOverviewSection />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><KpiCard title={t('oeePage.kpiOee')} value={avgOEE} icon={<Gauge size={16} />} color={oeeColor(avgOEE)} /></Col>
        <Col span={6}><KpiCard title={t('oeePage.kpiAvailability')} value={avgAvail} icon={<Clock size={16} />} color={COLORS.blue} /></Col>
        <Col span={6}><KpiCard title={t('oeePage.kpiPerformance')} value={avgPerf} icon={<Zap size={16} />} color={COLORS.blue} /></Col>
        <Col span={6}><KpiCard title={t('oeePage.kpiQuality')} value={avgQual} icon={<ShieldCheck size={16} />} color={COLORS.blue} /></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card size="small" title={<Space><BarChart3 size={14} color={COLORS.blue} />{t('oeePage.trendTitle')}{selectedDevice ? ` - ${selectedDevice}` : ''}</Space>}>
            {trendData.length === 0 ? (
              <Empty image={<BarChart3 size={56} style={{opacity:0.4}}/>} description={t('oeePage.noTrend')} style={{ padding: 40 }} />
            ) : (
              <ChartContainer height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="oee" stroke={COLORS.blue} name="OEE" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="availability" stroke={COLORS.green} name={t('oeePage.kpiAvailability')} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="performance" stroke={COLORS.yellow} name={t('oeePage.kpiPerformance')} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="quality" stroke="#722ed1" name={t('oeePage.kpiQuality')} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><Activity size={14} color={COLORS.blue} />{t('oeePage.causeTitle')}{selectedDevice ? ` - ${selectedDevice}` : ''}</Space>}>
            {causeData.length === 0 ? (
              <Empty image={<BarChart3 size={56} style={{opacity:0.4}}/>} description={t('oeePage.noCause')} style={{ padding: 40 }} />
            ) : (
              <ChartContainer height={260}>
                <PieChart>
                  <Pie data={causeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {causeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<Space><BarChart3 size={14} color={COLORS.blue} />{t('oeePage.listTitle')}</Space>}>
        <Table dataSource={sorted} columns={columns} rowKey="id" size="small" pagination={{ current: devicePage, pageSize: 10, total: sorted.length, onChange: setDevicePage, showSizeChanger: false, showTotal: (t) => `共 ${t} 台` }}
          rowClassName={(r: OeeDeviceMetric) => r.oee < 60 ? 'oee-row-red' : r.oee < 85 ? 'oee-row-yellow' : ''}
        scroll={{ x: 'max-content' }}
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

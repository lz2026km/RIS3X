import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Row, Col, Select, Button, DatePicker, Space, Tag, Statistic, Empty, message,
} from 'antd';
import dayjs from 'dayjs';
import {
  TrendingUp, Download, Calendar, Filter, BarChart3, Gauge, Target,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart,
} from 'recharts';
import { analyticsStatsApi } from '../../services/api';

const { RangePicker } = DatePicker;

interface ForecastPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
  upper: number | null;
  lower: number | null;
}

const generateForecast = (dept: string): ForecastPoint[] => {
  const points: ForecastPoint[] = [];
  for (let i = -30; i <= 30; i++) {
    const d = new Date(2026, 4, 3 + i);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const base = dept === '放射科' ? 120 : dept === 'CT室' ? 80 : dept === 'MRI室' ? 50 : 100;
    const noise = Math.sin(i * 0.3) * 15 + (Math.random() - 0.5) * 20;
    const trend = i * 0.4;
    if (i <= 0) {
      points.push({ date: dateStr, actual: Math.round(base + noise + trend), forecast: null, upper: null, lower: null });
    } else {
      const f = Math.round(base + trend);
      points.push({ date: dateStr, actual: null, forecast: f, upper: f + 15, lower: Math.max(0, f - 15) });
    }
  }
  return points;
};

const mockUtilization = { current: 78, target: 85, max: 100 };
const mockAccuracy = { value: 93.5, previous: 91.2 };

export default function PredictivePage() {
  const [department, setDepartment] = useState('放射科');
  const [dateRange, setDateRange] = useState<[string, string]>(['2026-04-03', '2026-06-02']);
  const [dashboard, setDashboard] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      const res = await analyticsStatsApi.getDashboard()
      if (res.success && res.data) setDashboard(res.data)
    })()
  }, [])

  const chartData = useMemo(() => generateForecast(department), [department]);

  const handleExport = () => {
    const csv = '日期,实际值,预测值,上限,下限\n' + chartData.map(p => `${p.date},${p.actual ?? ''},${p.forecast ?? ''},${p.upper ?? ''},${p.lower ?? ''}`).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `预测分析_${department}_${dateRange[0]}_${dateRange[1]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const gaugeAngle = (mockUtilization.current / mockUtilization.max) * 180;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #dc2626, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>预测分析</h2>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>工作量预测与资源利用率分析</span>
          </div>
        </Space>
        <Button icon={<Download size={14} />} onClick={handleExport}>导出报告</Button>
      </div>

      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <Space>
              <Filter size={14} color="#94a3b8" />
              <Select value={department} onChange={setDepartment} style={{ width: 140 }} options={['放射科', 'CT室', 'MRI室', '超声科'].map(d => ({ label: d, value: d }))} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Calendar size={14} color="#94a3b8" />
              <RangePicker
                value={[dateRange[0] ? dayjs(dateRange[0]) : null, dateRange[1] ? dayjs(dateRange[1]) : null] as any}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                  }
                }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={<Space><BarChart3 size={16} /> 工作量预测</Space>} variant="borderless" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={5} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="upper" stroke="transparent" fill="#f97316" fillOpacity={0.08} />
                <Area type="monotone" dataKey="lower" stroke="transparent" fill="#f97316" fillOpacity={0.08} />
                <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="实际值" />
                <Line type="monotone" dataKey="forecast" stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" dot={false} name="预测值" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card title={<Space><Gauge size={16} /> 资源利用率</Space>} variant="borderless" style={{ borderRadius: 12 }}>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ position: 'relative', width: 160, height: 100, margin: '0 auto', overflow: 'hidden' }}>
                  <div style={{
                    width: 160, height: 80, borderRadius: '160px 160px 0 0',
                    background: '#f0f0f0', position: 'absolute', bottom: 0,
                  }} />
                  <div style={{
                    width: 160, height: 80, borderRadius: '160px 160px 0 0',
                    background: `conic-gradient(#f97316 ${gaugeAngle}deg, transparent ${gaugeAngle}deg)`,
                    position: 'absolute', bottom: 0,
                    transformOrigin: 'bottom center',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 28, fontWeight: 700, color: '#1e293b',
                  }}>{mockUtilization.current}%</div>
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Tag color="orange">目标 {mockUtilization.target}%</Tag>
                  <Tag color="blue">上限 {mockUtilization.max}%</Tag>
                </Space>
              </div>
            </Card>

            <Card title={<Space><Target size={16} /> 预测准确率</Space>} variant="borderless" style={{ borderRadius: 12 }}>
              <Statistic
                value={mockAccuracy.value}
                suffix="%"
                valueStyle={{ color: '#f97316', fontSize: 36, fontWeight: 700 }}
              />
              <div style={{ height: 8, borderRadius: 4, background: '#f0f0f0', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${mockAccuracy.value}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #f97316, #dc2626)' }} />
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                较上月提升 {(mockAccuracy.value - mockAccuracy.previous).toFixed(1)}%
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

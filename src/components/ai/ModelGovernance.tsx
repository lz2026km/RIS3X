/**
 * G005 放射RIS系统 v3.0.6.5 - 模型治理 (漂移 + A/B)
 * A5-AI-ORCH / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Select, Table, Tag, Space, Button, Progress, Tabs, message, Statistic, Row, Col, Empty, Badge } from 'antd';
import { GitCompare, Activity, AlertTriangle, CheckCircle2, TrendingUp, Settings } from 'lucide-react';
import { LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { modelMonitor } from '../../services/ai/governance/ModelMonitor';
import { AI_MARKETPLACE_ALGORITHMS } from '../../data/aiMarketplace';
import type { AIModelMetrics, AIModelVariant, AIModelABComparison } from '../../types/ai/orchestrator';

const STATUS_COLORS = {
  stable: 'green',
  warning: 'gold',
  critical: 'red',
} as const;

export const ModelGovernance: React.FC = () => {
  const [algorithmId, setAlgorithmId] = useState(AI_MARKETPLACE_ALGORITHMS[0]!.id);
  const [variants, setVariants] = useState<AIModelVariant[]>([]);
  const [metrics, setMetrics] = useState<AIModelMetrics[]>([]);
  const [comparison, setComparison] = useState<AIModelABComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void load();
  }, [algorithmId]);

  const load = async () => {
    setLoading(true);
    try {
      const [v, m] = await Promise.all([modelMonitor.getVariants(algorithmId), modelMonitor.getMetrics(algorithmId)]);
      setVariants(v);
      setMetrics(m);
      if (v.length >= 2) {
        const c = await modelMonitor.compareVariants(algorithmId, v[0]!.id, v[1]!.id);
        setComparison(c);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetTraffic = async (variantId: string, percent: number) => {
    try {
      await modelMonitor.setVariantTraffic(algorithmId, variantId, percent);
      message.success('流量已调整');
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const totalDrift = metrics.length > 0 ? metrics.reduce((s, m) => s + m.driftScore, 0) / metrics.length : 0;
  const avgLatency = metrics.length > 0 ? metrics.reduce((s, m) => s + m.avgLatencyMs, 0) / metrics.length : 0;
  const avgSuccess = metrics.length > 0 ? metrics.reduce((s, m) => s + m.successRate, 0) / metrics.length : 0;

  return (
    <div data-testid="model-governance" style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Settings size={24} color="#06b6d4" />
        <h2 style={{ margin: 0 }}>模型治理</h2>
        <Select
          value={algorithmId}
          onChange={setAlgorithmId}
          style={{ width: 280 }}
          options={AI_MARKETPLACE_ALGORITHMS.map((a) => ({ value: a.id, label: `${a.name} (v${a.version})` }))}
        />
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>平均漂移</span>}
              value={(totalDrift * 100).toFixed(1)}
              suffix="%"
              prefix={
                totalDrift < 0.1 ? <CheckCircle2 size={14} color="#10b981" /> :
                totalDrift < 0.25 ? <AlertTriangle size={14} color="#f59e0b" /> :
                <AlertTriangle size={14} color="#ef4444" />
              }
              styles={{ content: {  color: totalDrift < 0.1 ? '#10b981' : totalDrift < 0.25 ? '#f59e0b' : '#ef4444'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>平均成功率</span>}
              value={(avgSuccess * 100).toFixed(1)}
              suffix="%"
              styles={{ content: {  color: '#10b981'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>平均延迟</span>}
              value={Math.round(avgLatency)}
              suffix="ms"
              styles={{ content: {  color: '#3b82f6'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>变体数</span>}
              value={variants.length}
              prefix={<GitCompare size={14} color="#8b5cf6" />}
              styles={{ content: {  color: '#f1f5f9'  } }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="metrics"
        tabBarExtraContent={
          <Badge
            count={metrics.length}
            title={`变体 ${metrics.length} 个`}
            style={{ backgroundColor: '#7c3aed' }}
          />
        }
        items={[
          {
            key: 'metrics',
            label: '变体指标',
            children: metrics.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <div>
                {metrics.map((m) => (
                  <Card
                    key={m.variantId}
                    size="small"
                    style={{ background: '#1e293b', borderColor: '#334155', marginBottom: 12 }}
                    title={
                      <Space>
                        <span>{variants.find((v) => v.id === m.variantId)?.name ?? m.variantId}</span>
                        <Tag color={STATUS_COLORS[m.driftStatus]}>漂移 {m.driftStatus}</Tag>
                      </Space>
                    }
                  >
                    <Row gutter={12}>
                      <Col span={14}>
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart data={m.accuracyTrend}>
                            <defs>
                              <linearGradient id={`grad-${m.variantId}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleDateString().slice(5)} stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" domain={[0.7, 1]} />
                            <RTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                            <Area type="monotone" dataKey="accuracy" stroke="#3b82f6" fill={`url(#grad-${m.variantId})`} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Col>
                      <Col span={10}>
                        <Row gutter={8}>
                          <Col span={12}><Statistic title="总调用" value={m.totalCalls} styles={{ content: {  fontSize: 14, color: '#f1f5f9'  } }} /></Col>
                          <Col span={12}><Statistic title="P95" value={m.p95LatencyMs} suffix="ms" styles={{ content: {  fontSize: 14, color: '#3b82f6'  } }} /></Col>
                          <Col span={12}><Statistic title="P99" value={m.p99LatencyMs} suffix="ms" styles={{ content: {  fontSize: 14, color: '#f59e0b'  } }} /></Col>
                          <Col span={12}><Statistic title="漂移分" value={m.driftScore.toFixed(3)} styles={{ content: {  fontSize: 14, color: '#f1f5f9'  } }} /></Col>
                        </Row>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </div>
            ),
          },
          {
            key: 'ab',
            label: 'A/B 对比',
            children: comparison ? (
              <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
                <Space style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>对比</span>
                  <Tag color="blue">{comparison.variantA.name}</Tag>
                  <span>vs</span>
                  <Tag color="purple">{comparison.variantB.name}</Tag>
                  <Tag color={comparison.winner === 'A' ? 'green' : comparison.winner === 'B' ? 'green' : 'gold'}>
                    胜出: {comparison.winner === 'tie' ? '平' : comparison.winner}
                  </Tag>
                </Space>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 12 }}>
                  {comparison.recommendation} · 统计显著性 p={(comparison.statisticalSignificance).toFixed(3)}
                </div>
                <Row gutter={12}>
                  <Col span={12}>
                    <Card size="small" title={comparison.variantA.name} style={{ background: '#0f172a', borderColor: '#334155' }}>
                      <Row gutter={8}>
                        <Col span={12}><Statistic title="成功率" value={(comparison.metricsA.successRate * 100).toFixed(1)} suffix="%" styles={{ content: {  fontSize: 16  } }} /></Col>
                        <Col span={12}><Statistic title="延迟" value={comparison.metricsA.avgLatencyMs} suffix="ms" styles={{ content: {  fontSize: 16  } }} /></Col>
                        <Col span={12}><Statistic title="漂移" value={comparison.metricsA.driftScore.toFixed(3)} styles={{ content: {  fontSize: 16  } }} /></Col>
                        <Col span={12}><Statistic title="调用" value={comparison.metricsA.totalCalls} styles={{ content: {  fontSize: 16  } }} /></Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={comparison.variantB.name} style={{ background: '#0f172a', borderColor: '#334155' }}>
                      <Row gutter={8}>
                        <Col span={12}><Statistic title="成功率" value={(comparison.metricsB.successRate * 100).toFixed(1)} suffix="%" styles={{ content: {  fontSize: 16  } }} /></Col>
                        <Col span={12}><Statistic title="延迟" value={comparison.metricsB.avgLatencyMs} suffix="ms" styles={{ content: {  fontSize: 16  } }} /></Col>
                        <Col span={12}><Statistic title="漂移" value={comparison.metricsB.driftScore.toFixed(3)} styles={{ content: {  fontSize: 16  } }} /></Col>
                        <Col span={12}><Statistic title="调用" value={comparison.metricsB.totalCalls} styles={{ content: {  fontSize: 16  } }} /></Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Empty description="变体不足 2 个，无法对比" />
            ),
          },
          {
            key: 'traffic',
            label: '流量分配',
            children: (
              <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={variants}
                  pagination={false}
                  columns={[
                    { title: '变体', dataIndex: 'name', key: 'name' },
                    { title: '版本', dataIndex: 'version', key: 'version' },
                    {
                      title: '流量',
                      dataIndex: 'trafficPercent',
                      key: 'traffic',
                      render: (p: number, r: AIModelVariant) => (
                        <Space>
                          <Progress percent={p} size="small" style={{ width: 120 }} />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{p}%</span>
                          <Select
                            size="small"
                            value={p}
                            onChange={(v) => handleSetTraffic(r.id, v)}
                            style={{ width: 70 }}
                            options={[0, 10, 20, 30, 50, 70, 100].map((v) => ({ value: v, label: `${v}%` }))}
                          />
                        </Space>
                      ),
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      key: 'enabled',
                      render: (e: boolean) => <Tag color={e ? 'green' : 'red'}>{e ? '启用' : '停用'}</Tag>,
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default ModelGovernance;

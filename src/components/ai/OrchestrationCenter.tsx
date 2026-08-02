/**
 * G005 放射RIS系统 v3.0.6.5 - AI 编排中心 UI
 * A5-AI-ORCH / 60 点
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Input, Select, Button, Table, Tag, Space, Tabs, Progress, message, Tooltip, Badge } from 'antd';
import { Search, Cpu, Zap, ShieldCheck, GitBranch, Settings, Star, Download, Trash2 } from 'lucide-react';
import { aiOrchestrator } from '../../services/ai/orchestrator/AIOrchestrator';
import { marketplaceService } from '../../services/ai/marketplace/MarketplaceService';
import type { AIAlgorithm, AIAlgorithmType, AIRouteDecision } from '../../types/ai/orchestrator';

const { Search: AntSearch } = Input;

const TYPE_LABELS: Record<AIAlgorithmType, string> = {
  detection: '病灶检测',
  segmentation: '分割',
  classification: '分类/分级',
  quantification: '量化分析',
  triage: '急诊分诊',
  reporting: '报告生成',
  quality: '质控',
  temporal: '时序分析',
};

const TYPE_COLORS: Record<AIAlgorithmType, string> = {
  detection: 'blue',
  segmentation: 'cyan',
  classification: 'purple',
  quantification: 'gold',
  triage: 'red',
  reporting: 'green',
  quality: 'magenta',
  temporal: 'orange',
};

export interface OrchestrationCenterProps {
  onSelectAlgorithm?: (a: AIAlgorithm) => void;
}

export const OrchestrationCenter: React.FC<OrchestrationCenterProps> = ({ onSelectAlgorithm }) => {
  const [algorithms, setAlgorithms] = useState<AIAlgorithm[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AIAlgorithmType | undefined>();
  const [showInstalled, setShowInstalled] = useState<boolean | undefined>();
  const [routeStudyId, setRouteStudyId] = useState('S20260619-001');
  const [routeModality, setRouteModality] = useState('CT');
  const [routeBodyPart, setRouteBodyPart] = useState('胸部');
  const [routePriority, setRoutePriority] = useState<'stat' | 'urgent' | 'routine'>('urgent');
  const [decision, setDecision] = useState<AIRouteDecision | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    setAlgorithms(aiOrchestrator.getAlgorithms());
  }, []);

  const filtered = useMemo(() => {
    return algorithms.filter((a) => {
      if (search && !(a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (showInstalled !== undefined && a.installed !== showInstalled) return false;
      return true;
    });
  }, [algorithms, search, typeFilter, showInstalled]);

  const handleInstall = async (id: string) => {
    try {
      await marketplaceService.install(id);
      message.success('安装成功');
      setAlgorithms([...aiOrchestrator.getAlgorithms()]);
    } catch (e) {
      message.error('安装失败: ' + (e as Error).message);
    }
  };

  const handleUninstall = async (id: string) => {
    try {
      await marketplaceService.uninstall(id);
      message.success('卸载成功');
      setAlgorithms([...aiOrchestrator.getAlgorithms()]);
    } catch (e) {
      message.error('卸载失败: ' + (e as Error).message);
    }
  };

  const handleRoute = async () => {
    setRouting(true);
    try {
      const d = await aiOrchestrator.routeStudy({
        studyId: routeStudyId,
        modality: routeModality,
        bodyPart: routeBodyPart,
        priority: routePriority,
        clinicalHistory: '',
        patient: { age: 55, gender: 'M' },
      });
      setDecision(d);
    } finally {
      setRouting(false);
    }
  };

  const columns = [
    {
      title: '算法',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, r: AIAlgorithm) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.vendor} · v{r.version}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t: AIAlgorithmType) => <Tag color={TYPE_COLORS[t]}>{TYPE_LABELS[t]}</Tag>,
    },
    {
      title: '模态/部位',
      key: 'modality',
      width: 160,
      render: (_: unknown, r: AIAlgorithm) => (
        <div>
          <div style={{ fontSize: 12 }}>{r.modality.join('/')}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.bodyParts.slice(0, 2).join('·')}</div>
        </div>
      ),
    },
    {
      title: '性能',
      key: 'perf',
      width: 160,
      render: (_: unknown, r: AIAlgorithm) => (
        <div style={{ fontSize: 12 }}>
          <div>Acc: {(r.accuracy * 100).toFixed(1)}%</div>
          <div>Sen: {(r.sensitivity * 100).toFixed(1)}% · Spe: {(r.specificity * 100).toFixed(1)}%</div>
        </div>
      ),
    },
    {
      title: '延迟',
      dataIndex: 'avgLatencyMs',
      key: 'latency',
      width: 100,
      render: (l: number) => <Tag color={l < 1000 ? 'green' : l < 3000 ? 'blue' : 'orange'}>{l}ms</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => <Tag color={s === 'stable' ? 'green' : s === 'beta' ? 'blue' : 'orange'}>{s}</Tag>,
    },
    {
      title: '评分',
      key: 'rating',
      width: 90,
      render: (_: unknown, r: AIAlgorithm) => (
        <span>
          <Star size={12} fill="#fbbf24" color="#fbbf24" /> {r.ratingAvg} ({r.ratingCount})
        </span>
      ),
    },
    {
      title: '安装',
      key: 'install',
      width: 100,
      render: (_: unknown, r: AIAlgorithm) =>
        r.installed ? (
          <Button size="small" icon={<Trash2 size={12} />} onClick={() => handleUninstall(r.id)}>
            卸载
          </Button>
        ) : (
          <Button size="small" type="primary" icon={<Download size={12} />} onClick={() => handleInstall(r.id)}>
            安装
          </Button>
        ),
    },
  ];

  return (
    <div data-testid="orchestration-center" style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Cpu size={24} color="#3b82f6" />
        <h2 style={{ margin: 0, color: '#f1f5f9' }}>AI 编排中心</h2>
        <Badge count={algorithms.filter((a) => a.installed).length} showZero color="#10b981" />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>已安装</span>
        <div style={{ flex: 1 }} />
        <Tag icon={<ShieldCheck size={12} />}>NMPA 认证</Tag>
      </div>

      <Tabs
        defaultActiveKey="algorithms"
        tabBarExtraContent={
          <Badge
            count={algorithms.length}
            title={`算法 ${algorithms.length} 个`}
            style={{ backgroundColor: '#8b5cf6' }}
          />
        }
        items={[
          {
            key: 'algorithms',
            label: '算法库',
            children: (
              <div>
                <Space style={{ marginBottom: 12 }} wrap>
                  <AntSearch placeholder="搜索算法/标签" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
                  <Select
                    placeholder="类型"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    style={{ width: 140 }}
                    allowClear
                    options={(Object.keys(TYPE_LABELS) as AIAlgorithmType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
                  />
                  <Select
                    placeholder="安装状态"
                    value={showInstalled}
                    onChange={setShowInstalled}
                    style={{ width: 120 }}
                    allowClear
                    options={[
                      { value: true, label: '已安装' },
                      { value: false, label: '未安装' },
                    ]}
                  />
                </Space>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={filtered}
                  columns={columns}
                  pagination={{ pageSize: 10 }}
                  onRow={(r) => ({ onClick: () => onSelectAlgorithm?.(r), style: { cursor: 'pointer' } })}
                />
              </div>
            ),
          },
          {
            key: 'routing',
            label: '路由试算',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card title="Study 参数" size="small">
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Study ID</div>
                      <Input value={routeStudyId} onChange={(e) => setRouteStudyId(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>模态</div>
                      <Select
                        value={routeModality}
                        onChange={setRouteModality}
                        style={{ width: '100%' }}
                        options={['CT', 'MR', 'CR', 'DX', 'MG', 'US'].map((v) => ({ value: v, label: v }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>部位</div>
                      <Input value={routeBodyPart} onChange={(e) => setRouteBodyPart(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>优先级</div>
                      <Select
                        value={routePriority}
                        onChange={setRoutePriority}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'stat', label: '急诊' },
                          { value: 'urgent', label: '加急' },
                          { value: 'routine', label: '常规' },
                        ]}
                      />
                    </div>
                    <Button type="primary" icon={<Zap size={14} />} loading={routing} onClick={handleRoute} block>
                      路由试算
                    </Button>
                  </Space>
                </Card>
                <Card title="路由结果" size="small">
                  {decision ? (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <GitBranch size={14} color="#10b981" /> <strong>主算法</strong>
                        <div style={{ marginTop: 4, padding: 8, background: '#020617', borderRadius: 4 }}>
                          <Tag color="green">{(decision.primary.confidence * 100).toFixed(0)}%</Tag>
                          {decision.primary.algorithmId}
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{decision.primary.reason}</div>
                        </div>
                      </div>
                      <div>
                        <strong>次选</strong>
                        {decision.secondary.map((s, i) => (
                          <div key={i} style={{ padding: 6, background: '#020617', borderRadius: 4, marginTop: 4, fontSize: 12 }}>
                            <Tag>{(s.confidence * 100).toFixed(0)}%</Tag> {s.algorithmId} — {s.reason}
                          </div>
                        ))}
                      </div>
                      {decision.rejected.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong>拒绝</strong>
                          {decision.rejected.slice(0, 3).map((r, i) => (
                            <div key={i} style={{ padding: 4, fontSize: 12, color: '#fca5a5' }}>
                              ✗ {r.algorithmId}: {r.reason}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                        预计延迟: {decision.estimatedLatencyMs}ms · 策略: {decision.policy}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>点击"路由试算"以查看结果</div>
                  )}
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default OrchestrationCenter;

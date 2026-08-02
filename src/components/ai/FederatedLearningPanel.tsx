/**
 * G005 放射RIS系统 v3.0.6.5 - 联邦学习面板
 * A5-AI-ORCH / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Progress, message, Statistic, Row, Col, Tooltip, Badge, Timeline, Tabs } from 'antd';
import { Users, Cpu, Lock, Shield, Activity, GitMerge, PlayCircle, StopCircle } from 'lucide-react';
import { federatedClient } from '../../services/ai/federated/FederatedClient';
import { secureAggregator } from '../../services/ai/federated/SecureAggregator';
import type { AIFederatedRound, AIFederatedUpdate } from '../../types/ai/orchestrator';

const STATUS_COLORS: Record<string, string> = {
  recruiting: 'blue',
  training: 'gold',
  aggregating: 'cyan',
  completed: 'green',
  failed: 'red',
};

export const FederatedLearningPanel: React.FC = () => {
  const [rounds, setRounds] = useState<AIFederatedRound[]>([]);
  const [currentRound, setCurrentRound] = useState<AIFederatedRound | null>(null);
  const [updates, setUpdates] = useState<AIFederatedUpdate[]>([]);
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [budget, setBudget] = useState({ total: 0, used: 0, remaining: 0, perRound: 0 });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const [r, c, b] = await Promise.all([federatedClient.listRounds(), federatedClient.getCurrentRound(), federatedClient.getPrivacyBudget()]);
    setRounds(r);
    setCurrentRound(c);
    setBudget(b);
    if (c) {
      const u = await federatedClient.listUpdates(c.id);
      setUpdates(u);
    }
  };

  const handleJoin = async () => {
    if (!currentRound) {
      message.warning('当前无可加入轮次');
      return;
    }
    try {
      const r = await federatedClient.joinRound(currentRound.id);
      message.success(`已加入轮次 ${currentRound.roundNumber}`);
      void load();
      return r;
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleTrain = async () => {
    if (!currentRound) return;
    setTraining(true);
    setProgress(0);
    try {
      const result = await federatedClient.trainLocal(currentRound.id, (p) => {
        setProgress((p.epoch / p.totalEpochs) * 100);
      });
      await federatedClient.uploadUpdate(currentRound.id, {
        gradientsBlob: result.gradientsBlob,
        sampleCount: result.sampleCount,
        maskedNorm: result.maskedNorm,
      });
      message.success(`本轮训练完成：${result.sampleCount} 样本, Loss ${result.loss.toFixed(4)}`);
      void load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setTraining(false);
    }
  };

  const handleAggregate = async () => {
    if (!currentRound) return;
    try {
      const result = await secureAggregator.runFullPipeline(currentRound.id);
      if (result.ok) message.success('聚合完成，全局模型已更新');
      else message.warning('聚合未完成: ' + result.error);
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns = [
    { title: '轮次', dataIndex: 'roundNumber', key: 'roundNumber', width: 70 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={STATUS_COLORS[s]}>{s}</Tag>,
    },
    {
      title: '参与者',
      key: 'participants',
      width: 160,
      render: (_: unknown, r: AIFederatedRound) => (
        <div>
          <Progress
            percent={(r.participants / r.targetParticipants) * 100}
            size="small"
            showInfo={false}
            strokeColor="#3b82f6"
          />
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {r.participants} / {r.targetParticipants} (最低 {r.minParticipants})
          </div>
        </div>
      ),
    },
    { title: '模型', dataIndex: 'modelVersion', key: 'modelVersion', width: 120 },
    {
      title: '精度',
      dataIndex: 'globalAccuracy',
      key: 'globalAccuracy',
      width: 90,
      render: (a: number | undefined) => a ? `${(a * 100).toFixed(1)}%` : '—',
    },
    {
      title: '隐私预算',
      dataIndex: 'privacyBudget',
      key: 'privacyBudget',
      width: 90,
      render: (p: number) => <Tag color={p > 2.5 ? 'red' : p > 1.5 ? 'gold' : 'green'}>ε={p.toFixed(1)}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 160,
      render: (s: string, r: AIFederatedRound) => (
        <div style={{ fontSize: 12 }}>
          <div>开始: {new Date(s).toLocaleString()}</div>
          {r.completedAt && <div style={{ color: '#10b981' }}>完成: {new Date(r.completedAt).toLocaleString()}</div>}
        </div>
      ),
    },
  ];

  return (
    <div data-testid="federated-learning-panel" style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Lock size={24} color="#8b5cf6" />
        <h2 style={{ margin: 0 }}>联邦学习控制台</h2>
        <Badge count={rounds.filter((r) => r.status === 'recruiting' || r.status === 'aggregating').length} showZero color="#3b82f6" />
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>隐私预算</span>}
              value={budget.remaining}
              precision={2}
              suffix="ε"
              prefix={<Shield size={16} color="#8b5cf6" />}
              styles={{ content: {  color: '#f1f5f9'  } }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              已用 {budget.used.toFixed(2)} / 总额 {budget.total.toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>本站点</span>}
              value="协和医院"
              prefix={<Users size={16} color="#3b82f6" />}
              styles={{ content: {  color: '#f1f5f9', fontSize: 16  } }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>数据量: 12,580 例</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>完成轮次</span>}
              value={rounds.filter((r) => r.status === 'completed').length}
              prefix={<GitMerge size={16} color="#10b981" />}
              styles={{ content: {  color: '#f1f5f9'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>总参与方</span>}
              value={rounds.reduce((max, r) => Math.max(max, r.participants), 0)}
              prefix={<Activity size={16} color="#06b6d4" />}
              styles={{ content: {  color: '#f1f5f9'  } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="当前轮次"
        size="small"
        style={{ background: '#1e293b', borderColor: '#334155', marginBottom: 16 }}
        extra={
          <Space>
            {currentRound?.status === 'recruiting' && (
              <Button type="primary" icon={<PlayCircle size={14} />} onClick={handleJoin}>
                加入并训练
              </Button>
            )}
            {currentRound && (currentRound.status === 'aggregating' || currentRound.status === 'recruiting') && (
              <Button icon={<GitMerge size={14} />} onClick={handleAggregate}>
                触发聚合
              </Button>
            )}
          </Space>
        }
      >
        {currentRound ? (
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>轮次 #{currentRound.roundNumber} · {currentRound.modelVersion}</div>
              <div style={{ marginTop: 8 }}>
                <Tag color={STATUS_COLORS[currentRound.status]}>{currentRound.status}</Tag>
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                  参与方 {currentRound.participants}/{currentRound.targetParticipants}
                </span>
              </div>
              {training && (
                <div style={{ marginTop: 12 }}>
                  <Progress percent={Math.round(progress)} status="active" strokeColor="#3b82f6" />
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>本地训练中...</div>
                </div>
              )}
            </Col>
            <Col span={12}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>已上传更新</div>
              <Table
                size="small"
                rowKey="id"
                dataSource={updates}
                pagination={false}
                columns={[
                  { title: '站点', dataIndex: 'siteName', key: 'siteName' },
                  { title: '样本', dataIndex: 'sampleCount', key: 'sampleCount', width: 80 },
                  { title: 'Norm', dataIndex: 'maskedNorm', key: 'maskedNorm', width: 80, render: (n: number) => n.toFixed(2) },
                  {
                    title: '状态',
                    dataIndex: 'verified',
                    key: 'verified',
                    width: 80,
                    render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '已验证' : '待验证'}</Tag>,
                  },
                ]}
                style={{ marginTop: 8 }}
              />
            </Col>
          </Row>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>当前无活跃轮次</div>
        )}
      </Card>

      <Card title="历史轮次" size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
        <Table size="small" rowKey="id" dataSource={rounds} columns={columns} pagination={false} />
      </Card>
    </div>
  );
};

export default FederatedLearningPanel;

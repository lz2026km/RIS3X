/**
 * G005 RIS v3.0.6.11-101 Wave 6B - R3.QUALITY.V2 CriticalEscalationV2
 * 危急值升级链 V2 可视化 (F12)
 * - 升级链配置: 3 级别 (一级电话/二级值班/三级科主任) + 每级超时时间 (可编辑)
 * - 阶梯图/时间线: 每级状态 (已通知/已确认/超时) + 当前级超时倒计时 + 手动升级按钮
 * - 状态机: 通知中 → 待确认 → 已确认 / 已升级 / 已关闭 (超时自动升级)
 * - 响应耗时统计 (按级别平均确认耗时 / 升级率)
 * API 不可用 (mock 模式无 MSW handler) 时回退内置演示数据。
 */
import { criticalEscalationApi, type EscalationChain, type EscalationLevel, type ChainStatus, type EscalationConfig, type EscalationStats } from '../../../../services/api/criticalEscalationApi';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  InputNumber,
  Table,
  Steps,
  message,
  Spin,
  Alert,
  Descriptions,
  Modal,
  Empty,
  Select,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Siren, Clock, ArrowUp, CheckCircle2, XCircle, Settings, Activity, ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_META: Record<ChainStatus, { label: string; color: string }> = {
  NOTIFYING: { label: '通知中', color: 'blue' },
  PENDING_CONFIRM: { label: '待确认', color: 'gold' },
  CONFIRMED: { label: '已确认', color: 'green' },
  ESCALATED: { label: '已升级', color: 'volcano' },
  CLOSED: { label: '已关闭', color: 'default' },
};

const LEVEL_META: Record<EscalationLevel, { label: string; color: string }> = {
  1: { label: '一级电话', color: 'blue' },
  2: { label: '二级值班', color: 'gold' },
  3: { label: '三级科主任', color: 'red' },
};

const SEVERITY_META: Record<string, string> = {
  critical: 'red',
  emergency: 'volcano',
  warning: 'gold',
  info: 'blue',
};

// ================= 演示回退数据 (API 不可用) =================

const DEMO_CONFIG: EscalationConfig = {
  levels: [
    { level: 1, name: '一级电话', role: '值班医师', timeoutMinutes: 15, channels: ['电话', '短信'] },
    { level: 2, name: '二级值班', role: '值班主任医师', timeoutMinutes: 10, channels: ['电话', '短信', '应用内'] },
    { level: 3, name: '三级科主任', role: '科主任', timeoutMinutes: 5, channels: ['电话', '应用内'] },
  ],
  rules: [
    { key: 'auto-timeout', name: '超时自动升级', description: '当前级别超时未确认, 自动升级至下一级别', enabled: true },
    { key: 'manual-escalate', name: '手动升级', description: '值班医生可根据危急程度手动立即升级', enabled: true },
    { key: 'max-level-cap', name: '最高级别封顶', description: '达到三级科主任后不再自动升级', enabled: true },
  ],
  statusLabels: { NOTIFYING: '通知中', PENDING_CONFIRM: '待确认', CONFIRMED: '已确认', ESCALATED: '已升级', CLOSED: '已关闭' },
  stepLabels: { NOTIFIED: '已通知', CONFIRMED: '已确认', TIMEOUT: '超时' },
};

const DEMO_CHAINS: EscalationChain[] = [
  {
    id: 'ESC-1',
    criticalValueId: 'CV-20260814-001',
    patientName: '李明',
    modality: 'CT',
    title: '主动脉夹层可能',
    severity: 'critical',
    status: 'CONFIRMED',
    currentLevel: 1,
    startedAt: '2026-08-14T09:00:00.000Z',
    currentLevelStartedAt: '2026-08-14T09:00:00.000Z',
    currentDeadline: '2026-08-14T09:15:00.000Z',
    escalatedCount: 0,
    acknowledgedBy: '值班医师 王浩',
    acknowledgedAt: '2026-08-14T09:08:00.000Z',
    steps: [{ level: 1, levelName: '一级电话', role: '值班医师', status: 'CONFIRMED', timeoutMinutes: 15, startedAt: '2026-08-14T09:00:00.000Z', deadline: '2026-08-14T09:15:00.000Z', notifiedAt: '2026-08-14T09:00:00.000Z', confirmedAt: '2026-08-14T09:08:00.000Z', confirmedBy: '值班医师 王浩' }],
    history: [
      { at: '2026-08-14T09:00:00.000Z', reason: '启动升级链, 一级电话通知值班医师' },
      { at: '2026-08-14T09:08:00.000Z', reason: '值班医师 8 分钟确认危急值' },
    ],
  },
  {
    id: 'ESC-2',
    criticalValueId: 'CV-20260814-002',
    patientName: '张伟',
    modality: 'MR',
    title: '急性大面积脑梗死',
    severity: 'emergency',
    status: 'ESCALATED',
    currentLevel: 2,
    startedAt: '2026-08-14T10:00:00.000Z',
    currentLevelStartedAt: '2026-08-14T10:18:00.000Z',
    currentDeadline: '2026-08-14T10:28:00.000Z',
    escalatedCount: 1,
    steps: [
      { level: 1, levelName: '一级电话', role: '值班医师', status: 'TIMEOUT', timeoutMinutes: 15, startedAt: '2026-08-14T10:00:00.000Z', deadline: '2026-08-14T10:15:00.000Z', notifiedAt: '2026-08-14T10:00:00.000Z' },
      { level: 2, levelName: '二级值班', role: '值班主任医师', status: 'NOTIFIED', timeoutMinutes: 10, startedAt: '2026-08-14T10:18:00.000Z', deadline: '2026-08-14T10:28:00.000Z', notifiedAt: '2026-08-14T10:18:00.000Z' },
    ],
    history: [
      { at: '2026-08-14T10:00:00.000Z', reason: '启动升级链, 一级电话通知值班医师' },
      { at: '2026-08-14T10:18:00.000Z', reason: '一级超时 18 分钟未确认, 自动升级二级值班' },
    ],
  },
  {
    id: 'ESC-3',
    criticalValueId: 'CV-20260814-003',
    patientName: '赵敏',
    modality: 'CT',
    title: '肝破裂出血',
    severity: 'critical',
    status: 'NOTIFYING',
    currentLevel: 1,
    startedAt: '2026-08-14T11:00:00.000Z',
    currentLevelStartedAt: '2026-08-14T11:00:00.000Z',
    currentDeadline: '2026-08-14T11:15:00.000Z',
    escalatedCount: 0,
    steps: [{ level: 1, levelName: '一级电话', role: '值班医师', status: 'NOTIFIED', timeoutMinutes: 15, startedAt: '2026-08-14T11:00:00.000Z', deadline: '2026-08-14T11:15:00.000Z', notifiedAt: '2026-08-14T11:00:00.000Z' }],
    history: [{ at: '2026-08-14T11:00:00.000Z', reason: '启动升级链, 一级电话通知值班医师' }],
  },
];

const DEMO_STATS: EscalationStats = {
  total: 4,
  byStatus: { NOTIFYING: 1, PENDING_CONFIRM: 0, CONFIRMED: 1, ESCALATED: 1, CLOSED: 1 },
  avgResponseMinutes: 8.2,
  avgEscalationCount: 1.2,
  escalationRate: 50,
  closedRate: 25,
  byLevel: [
    { level: 1, levelName: '一级电话', count: 4, confirmed: 2, escalated: 2, avgResponseMinutes: 8 },
    { level: 2, levelName: '二级值班', count: 2, confirmed: 0, escalated: 1, avgResponseMinutes: 0 },
    { level: 3, levelName: '三级科主任', count: 1, confirmed: 1, escalated: 0, avgResponseMinutes: 3 },
  ],
};

const isoAhead = (minutes: number): string => new Date(Date.now() + minutes * 60000).toISOString();

// 让演示链的倒计时有意义: 未终态链 deadline 相对当前时间
const demoChainsWithLiveDeadline = (): EscalationChain[] =>
  DEMO_CHAINS.map((c) => {
    if (c.status === 'CONFIRMED' || c.status === 'CLOSED') return c;
    const offset = c.currentLevel === 1 ? 9 : 4;
    const deadline = isoAhead(offset);
    return { ...c, currentDeadline: deadline, steps: c.steps.map((s, i) => (i === c.steps.length - 1 ? { ...s, deadline } : s)) };
  });

// ================= 主组件 =================

export const CriticalEscalationV2: React.FC = () => {
  const [config, setConfig] = useState<EscalationConfig>(DEMO_CONFIG);
  const [chains, setChains] = useState<EscalationChain[]>(demoChainsWithLiveDeadline);
  const [stats, setStats] = useState<EscalationStats>(DEMO_STATS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTimeouts, setDraftTimeouts] = useState<Record<EscalationLevel, number>>({
    1: DEMO_CONFIG.levels[0]!.timeoutMinutes,
    2: DEMO_CONFIG.levels[1]!.timeoutMinutes,
    3: DEMO_CONFIG.levels[2]!.timeoutMinutes,
  });
  const [detail, setDetail] = useState<EscalationChain | null>(null);
  const [confirming, setConfirming] = useState<EscalationChain | null>(null);
  const [confirmBy, setConfirmBy] = useState('值班医师');
  const [tick, setTick] = useState(0);

  // 倒计时刷新
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  void tick;

  const load = useCallback(async () => {
    const [cfg, chainRes, statRes] = await Promise.all([
      criticalEscalationApi.getConfig().catch(() => ({ success: false as const, data: null as unknown as EscalationConfig })),
      criticalEscalationApi.listChains().catch(() => ({ success: false as const, data: null as unknown as EscalationChain[] })),
      criticalEscalationApi.getStats().catch(() => ({ success: false as const, data: null as unknown as EscalationStats })),
    ]);
    if (cfg.success) {
      setConfig(cfg.data);
      setDraftTimeouts({
        1: cfg.data.levels.find((l) => l.level === 1)?.timeoutMinutes ?? 15,
        2: cfg.data.levels.find((l) => l.level === 2)?.timeoutMinutes ?? 10,
        3: cfg.data.levels.find((l) => l.level === 3)?.timeoutMinutes ?? 5,
      });
    } else {
      setConfig(DEMO_CONFIG);
    }
    if (chainRes.success && chainRes.data.length > 0) setChains(chainRes.data);
    else setChains(demoChainsWithLiveDeadline());
    if (statRes.success) setStats(statRes.data);
    else setStats(DEMO_STATS);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const runTick = async (id: string) => {
    const res = await criticalEscalationApi.tick(id).catch(() => ({ success: false as const, data: null as unknown as EscalationChain, error: undefined }));
    if (res.success) {
      const updated = res.data;
      if (updated.escalatedCount > (chains.find((c) => c.id === id)?.escalatedCount ?? 0)) {
        message.warning(`${updated.id}: 当前级别超时未确认, 已自动升级至 ${LEVEL_META[updated.currentLevel]?.label}`);
      }
      await load();
    }
  };

  const runEscalate = async (c: EscalationChain) => {
    const res = await criticalEscalationApi.escalate(c.id, { reason: '危急程度高, 手动升级', escalatedBy: '当前用户' }).catch(() => ({ success: false as const, data: null as unknown as EscalationChain, error: undefined }));
    if (res.success) {
      message.success(`${c.id} 已升级至 ${LEVEL_META[res.data.currentLevel]?.label}`);
      await load();
    } else {
      message.error(res.error?.message ?? '升级失败');
    }
  };

  const runClose = async (c: EscalationChain) => {
    const res = await criticalEscalationApi.closeChain(c.id, { closedBy: '当前用户', comment: '升级链关闭' }).catch(() => ({ success: false as const, data: null as unknown as EscalationChain, error: undefined }));
    if (res.success) {
      message.success(`${c.id} 已关闭`);
      await load();
    } else {
      message.error(res.error?.message ?? '关闭失败');
    }
  };

  const runAcknowledge = async () => {
    if (!confirming) return;
    const res = await criticalEscalationApi
      .acknowledge(confirming.id, { confirmedBy: confirmBy.trim() || '值班医师', comment: '已电话确认并通知临床' })
      .catch(() => ({ success: false as const, data: null as unknown as EscalationChain, error: undefined }));
    if (res.success) {
      message.success(`${confirming.id} 已在 ${LEVEL_META[confirming.currentLevel]?.label} 确认`);
      setConfirming(null);
      await load();
    } else {
      message.error(res.error?.message ?? '确认失败');
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const levels = config.levels.map((l) => ({ level: l.level, name: l.name, role: l.role, timeoutMinutes: draftTimeouts[l.level] ?? l.timeoutMinutes, channels: l.channels }));
      const res = await criticalEscalationApi.updateConfig(levels).catch(() => ({ success: false as const, data: null as unknown as { levels: EscalationConfig['levels'] } }));
      if (res.success) {
        setConfig({ ...config, levels: res.data.levels });
        message.success('升级链配置已保存');
      } else {
        message.warning('保存失败 (演示模式, 仅本地生效)');
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remainingMin = (deadline: string): number => Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 60000));

  const columns: ColumnsType<EscalationChain> = [
    { title: '链', dataIndex: 'id', key: 'id', width: 80, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 80 },
    { title: '危急值', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '级别', dataIndex: 'severity', key: 'severity', width: 80, render: (v: string) => <Tag color={SEVERITY_META[v] ?? 'blue'}>{v}</Tag> },
    {
      title: '当前级别',
      dataIndex: 'currentLevel',
      key: 'currentLevel',
      width: 100,
      render: (v: EscalationLevel, r) => <Tag color={LEVEL_META[v]?.color}>{LEVEL_META[v]?.label}{r.escalatedCount > 0 ? ` (升级×${r.escalatedCount})` : ''}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: ChainStatus) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label}</Tag>,
    },
    {
      title: '超时倒计时',
      key: 'countdown',
      width: 120,
      render: (_, r) => {
        if (r.status === 'CONFIRMED' || r.status === 'CLOSED') return <span style={{ color: '#94a3b8' }}>-</span>;
        const min = remainingMin(r.currentDeadline);
        return (
          <Space size={4}>
            <Clock size={12} color={min <= 2 ? '#dc2626' : min <= 5 ? '#f59e0b' : '#10b981'} />
            <strong style={{ color: min <= 2 ? '#dc2626' : min <= 5 ? '#f59e0b' : '#10b981' }}>{min}</strong>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>分钟</span>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, r) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Activity size={12} />} onClick={() => void runTick(r.id)}>超时检查</Button>
          {(r.status === 'NOTIFYING' || r.status === 'PENDING_CONFIRM' || r.status === 'ESCALATED') && (
            <>
              <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => { setConfirmBy('值班医师'); setConfirming(r); }}>确认</Button>
              <Tooltip title={r.currentLevel >= 3 ? '已达最高升级级别' : '手动升级至下一级别'}>
                <Button size="small" danger icon={<ArrowUp size={12} />} disabled={r.currentLevel >= 3} onClick={() => void runEscalate(r)}>升级</Button>
              </Tooltip>
            </>
          )}
          {r.status !== 'CLOSED' && (
            <Button size="small" icon={<XCircle size={12} />} onClick={() => void runClose(r)}>关闭</Button>
          )}
          <Button size="small" onClick={() => setDetail(r)}>阶梯图</Button>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div data-testid="critical-escalation-v2" role="region" aria-label="危急值升级链 V2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card size="small" style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #7c3aed 100%)', border: 'none' }} styles={{ body: { padding: 12 } }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <Siren size={18} color="#fff" />
            <strong style={{ color: '#fff', fontSize: 16 }}>危急值升级链 V2 · 超时自动升级</strong>
            <Tag color="red">F12</Tag>
            <Tag color="gold">状态机: 通知中→待确认→已确认/已升级/已关闭</Tag>
          </Space>
          <Button size="small" icon={<Settings size={12} />} onClick={() => setEditing(!editing)}>
            {editing ? '收起配置' : '升级链配置'}
          </Button>
        </Space>
      </Card>

      {editing && (
        <Card size="small" title={<Space><Settings size={14} /> 升级链配置 (级别 + 每级超时时间 + 升级规则)</Space>}>
          <Row gutter={[12, 12]}>
            {config.levels.map((l) => (
              <Col xs={24} md={8} key={l.level}>
                <Card size="small" style={{ borderTop: `4px solid ${LEVEL_META[l.level]?.color}` }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Tag color={LEVEL_META[l.level]?.color}>{l.name}</Tag>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{l.role}</span>
                    </Space>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{l.channels.join('/')}</span>
                  </Space>
                  <div style={{ margin: '8px 0 4px', fontSize: 12 }}>超时时间 (分钟)</div>
                  <InputNumber
                    size="small"
                    min={1}
                    max={240}
                    style={{ width: '100%' }}
                    value={draftTimeouts[l.level]}
                    onChange={(v) => setDraftTimeouts((prev) => ({ ...prev, [l.level]: Number(v ?? 15) }))}
                  />
                </Card>
              </Col>
            ))}
          </Row>
          <Space wrap style={{ marginTop: 12 }}>
            {config.rules.map((r) => (
              <Tooltip key={r.key} title={r.description}>
                <Tag color={r.enabled ? 'green' : 'default'}>{r.name}</Tag>
              </Tooltip>
            ))}
            <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} loading={saving} onClick={() => void saveConfig()}>
              保存配置
            </Button>
          </Space>
        </Card>
      )}

      <Row gutter={12}>
        <Col xs={24} sm={6}>
          <Card size="small"><Statistic title="升级链总数" value={stats.total} prefix={<Siren size={14} />} valueStyle={{ color: '#1e40af' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small"><Statistic title="平均确认耗时" value={stats.avgResponseMinutes} suffix="分钟" prefix={<Clock size={14} />} valueStyle={{ color: '#0d9488' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small"><Statistic title="升级率" value={stats.escalationRate} suffix="%" prefix={<ArrowUp size={14} />} valueStyle={{ color: '#f59e0b' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small"><Statistic title="平均升级次数" value={stats.avgEscalationCount} prefix={<ShieldAlert size={14} />} valueStyle={{ color: '#dc2626' }} /></Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={<Space><Activity size={14} /> 升级链列表 (超时倒计时 + 手动升级)</Space>}
        extra={<Space><Tag color="purple">{stats.byStatus.ESCALATED ?? 0} 已升级</Tag><Tag color="green">{stats.byStatus.CONFIRMED ?? 0} 已确认</Tag></Space>}
      >
        {chains.length === 0 ? (
          <Empty description="暂无升级链" />
        ) : (
          <Table size="small" rowKey="id" columns={columns} dataSource={chains} pagination={{ pageSize: 6, showSizeChanger: false }} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Card size="small" title={<Space><Clock size={14} /> 按级别响应耗时统计</Space>}>
        <Row gutter={[8, 8]}>
          {stats.byLevel.map((l) => (
            <Col xs={24} md={8} key={l.level}>
              <Card size="small" style={{ borderLeft: `4px solid ${LEVEL_META[l.level]?.color}` }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13 }}>{l.levelName}</strong>
                  <Tag color={LEVEL_META[l.level]?.color}>{l.count} 次</Tag>
                </Space>
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                  确认 {l.confirmed} 次 · 超时 {l.escalated} 次 · 平均 {l.avgResponseMinutes} 分钟
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ===== 确认弹窗 ===== */}
      <Modal title={confirming ? `确认危急值 · ${confirming.id}` : ''} open={!!confirming} onCancel={() => setConfirming(null)} onOk={() => void runAcknowledge()} okText="确认" width={420}>
        {confirming && (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="患者">{confirming.patientName}</Descriptions.Item>
              <Descriptions.Item label="危急值">{confirming.title}</Descriptions.Item>
              <Descriptions.Item label="当前级别">{LEVEL_META[confirming.currentLevel]?.label} ({confirming.steps[confirming.steps.length - 1]?.role})</Descriptions.Item>
              <Descriptions.Item label="超时剩余">{remainingMin(confirming.currentDeadline)} 分钟</Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 4 }}>确认人</div>
            <Select size="small" style={{ width: '100%' }} value={confirmBy} onChange={setConfirmBy} options={['值班医师', '值班主任医师', '科主任', '护士站'].map((v) => ({ value: v, label: v }))} />
          </Space>
        )}
      </Modal>

      {/* ===== 阶梯图弹窗 ===== */}
      <Modal title={detail ? `升级链阶梯图 · ${detail.id}` : ''} open={!!detail} footer={null} onCancel={() => setDetail(null)} width={560}>
        {detail && <ChainStaircase chain={detail} />}
      </Modal>
    </div>
  );
};

// ================= 阶梯图 / 时间线 =================

const ChainStaircase: React.FC<{ chain: EscalationChain }> = ({ chain }) => {
  const levelOf = (level: EscalationLevel) => LEVEL_META[level];
  const fmt = (v?: string) => (v ? new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-');
  const remainingMin = (deadline: string): number => Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 60000));

  const statusForStep = (status: EscalationChain['steps'][number]['status']): 'finish' | 'process' | 'error' | 'wait' => {
    if (status === 'CONFIRMED') return 'finish';
    if (status === 'TIMEOUT') return 'error';
    return 'process';
  };

  const steps = useMemo(() => chain.steps.map((s, i) => ({
    title: (
      <Space size={6}>
        <Tag color={levelOf(s.level)?.color}>{s.levelName}</Tag>
        {s.status === 'CONFIRMED' ? <Tag color="green">已确认</Tag> : s.status === 'TIMEOUT' ? <Tag color="red">超时</Tag> : <Tag color="blue">已通知</Tag>}
      </Space>
    ),
    description: (
      <Space direction="vertical" size={2}>
        <span style={{ fontSize: 12 }}>角色: {s.role} · 开始 {fmt(s.startedAt)} · 截止 {fmt(s.deadline)}</span>
        {s.status === 'NOTIFIED' && s.deadline && (
          <span style={{ fontSize: 12, color: remainingMin(s.deadline) <= 2 ? '#dc2626' : '#f59e0b' }}>
            超时倒计时: {remainingMin(s.deadline)} 分钟
          </span>
        )}
        {s.status === 'CONFIRMED' && s.confirmedBy && (
          <span style={{ fontSize: 12, color: '#10b981' }}>{s.confirmedBy} 于 {fmt(s.confirmedAt)} 确认</span>
        )}
        {s.status === 'TIMEOUT' && <span style={{ fontSize: 12, color: '#dc2626' }}>超时未确认, 自动升级</span>}
        {i < chain.steps.length - 1 && <ArrowUp size={12} style={{ color: '#dc2626', marginTop: 4 }} />}
      </Space>
    ),
    status: statusForStep(s.status),
  })), [chain.steps]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Alert
        type={chain.status === 'CLOSED' ? 'info' : chain.status === 'CONFIRMED' ? 'success' : chain.status === 'ESCALATED' ? 'warning' : 'info'}
        showIcon
        title={`状态: ${STATUS_META[chain.status]?.label} · 当前 ${LEVEL_META[chain.currentLevel]?.label}`}
        description={
          <Space size={4}>
            <span style={{ fontSize: 12 }}>开始 {fmt(chain.startedAt)} · 升级 {chain.escalatedCount} 次 · 确认人 {chain.acknowledgedBy ?? '-'}</span>
          </Space>
        }
      />
      <Steps direction="vertical" size="small" current={chain.steps.length - 1} items={steps} />
      <Card size="small" title={<span style={{ fontSize: 12 }}>升级记录</span>}>
        <Space direction="vertical" size={4}>
          {chain.history.map((h, i) => (
            <div key={i} style={{ fontSize: 12, color: '#475569' }}>
              <Tag color="blue" style={{ fontSize: 11 }}>{fmt(h.at)}</Tag> {h.reason}
            </div>
          ))}
        </Space>
      </Card>
    </Space>
  );
};

export default CriticalEscalationV2;

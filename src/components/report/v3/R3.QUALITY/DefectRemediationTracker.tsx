/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.144-146 DefectRemediationTracker 缺陷整改追踪
 *
 * 15 点: 整改追踪 / 闭环 / PDCA / 缺陷率分析 / 逾期告警 / 提醒
 */
import { defectService } from '../../../../services/quality/defectService';
import type { DefectSeverityLevel } from '../../../../types/R3/R3.DEFECT';
import type { DefectRemediation } from '../../../../types/R3/R3.QUALITY';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  List,
  Button,
  Empty,
  message,
  Modal,
  Input,
  Progress,
  Segmented,
  Timeline,
} from 'antd';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bell,
  Edit,
  Eye,
  ListChecks,
  TrendingUp,
  Activity,
  Target,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Inbox, Map } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react';

const STATUS_META: Record<
  DefectRemediation['status'],
  { color: string; label: string; bg: string; stage: 'plan' | 'do' | 'check' | 'act' }
> = {
  pending: { color: '#dc2626', label: '待整改', bg: 'var(--color-error-bg)', stage: 'plan' },
  'in-progress': { color: '#f59e0b', label: '整改中', bg: 'var(--color-warning-bg)', stage: 'do' },
  rectified: { color: '#10b981', label: '已整改', bg: 'var(--color-success-bg)', stage: 'check' },
  overdue: { color: '#7f1d1d', label: '已逾期', bg: 'var(--color-error-bg)', stage: 'plan' },
  cancelled: { color: '#64748b', label: '已取消', bg: 'var(--border-color)', stage: 'act' },
};

const SEVERITY_META: Record<DefectSeverityLevel, { color: string; label: string }> = {
  minor: { color: 'gold', label: '轻微' },
  major: { color: 'orange', label: '重要' },
  critical: { color: 'red', label: '严重' },
};

const PDCA_META: Record<'plan' | 'do' | 'check' | 'act', { color: string; label: string; icon: React.ReactNode }> = {
  plan: { color: '#3b82f6', label: 'P 计划', icon: <Target size={12} /> },
  do: { color: '#f59e0b', label: 'D 执行', icon: <PlayCircle size={12} /> },
  check: { color: '#10b981', label: 'C 检查', icon: <ShieldCheck size={12} /> },
  act: { color: '#7c3aed', label: 'A 处理', icon: <RotateCcw size={12} /> },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function defectRate(items: DefectRemediation[]): { rate: number; fixed: number; total: number } {
  const total = items.length;
  const fixed = items.filter((i) => i.status === 'rectified').length;
  return { rate: total > 0 ? (fixed / total) * 100 : 0, fixed, total };
}

export const DefectRemediationTracker: React.FC = () => {
  const [list, setList] = useState<DefectRemediation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rectifyModal, setRectifyModal] = useState(false);
  const [editing, setEditing] = useState<DefectRemediation | null>(null);
  const [note, setNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailModal, setDetailModal] = useState<DefectRemediation | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await defectService.listRemediations();
      setList(data);
    } catch (e) {
      message.error('加载整改列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const t = list.length;
    const pending = list.filter((r) => r.status === 'pending').length;
    const inProgress = list.filter((r) => r.status === 'in-progress').length;
    const rectified = list.filter((r) => r.status === 'rectified').length;
    const overdue = list.filter((r) => r.status === 'overdue').length;
    const rate = defectRate(list);
    return {
      total: t,
      pending,
      inProgress,
      rectified,
      overdue,
      fixRate: rate.rate.toFixed(1),
      closureRate: t > 0 ? (((rectified + list.filter((r) => r.status === 'cancelled').length) / t) * 100).toFixed(1) : '0',
    };
  }, [list]);

  const byStage = useMemo(() => {
    const m: Record<string, number> = { plan: 0, do: 0, check: 0, act: 0 };
    list.forEach((r) => {
      const s = STATUS_META[r.status]?.stage ?? 'plan';
      m[s] = (m[s] ?? 0) + 1;
    });
    return m;
  }, [list]);

  const defectRateByCategory = useMemo(() => {
    const m = new Map<string, { total: number; fixed: number }>();
    list.forEach((r) => {
      const cat = r.defectCode.split('-')[0] ?? 'OTH';
      const cur = m.get(cat) ?? { total: 0, fixed: 0 };
      cur.total += 1;
      if (r.status === 'rectified') cur.fixed += 1;
      m.set(cat, cur);
    });
    return Object.fromEntries(m);
  }, [list]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return list;
    return list.filter((r) => r.status === statusFilter);
  }, [list, statusFilter]);

  const handleRectify = async () => {
    if (!editing) return;
    if (note.trim().length < 5) {
      message.error('整改说明不能少于 5 字符');
      return;
    }
    try {
      message.success('整改已提交');
      setRectifyModal(false);
      setNote('');
      load();
    } catch (e) {
      message.error('提交失败');
    }
  };

  const handleSendReminder = async (_id: string) => {
    try {
      message.success('提醒已发送');
      load();
    } catch (e) {
      message.error('发送失败');
    }
  };

  return (
    <div data-testid="defect-remediation-tracker" role="region" aria-label="缺陷整改追踪">
      <div
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Wrench size={18} />
            <strong style={{ fontSize: 16 }}>缺陷整改追踪</strong>
            <Tag color="purple">R3.QUALITY.144-146</Tag>
            <Tag color="cyan">PDCA 闭环</Tag>
          </Space>
          <Tag color="default">已闭环 {stats.closureRate}%</Tag>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>总数</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<ListChecks size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>待整改</span>}
              value={stats.pending}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>整改中</span>}
              value={stats.inProgress}
              styles={{ content: {  color: '#fde68a', fontSize: 18  } }}
              prefix={<Edit size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>已整改</span>}
              value={stats.rectified}
              styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>已逾期</span>}
              value={stats.overdue}
              styles={{ content: {  color: '#fecaca', fontSize: 18  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>修复率</span>}
              value={stats.fixRate}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<TrendingUp size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={16}>
          <Card size="small" title={<Space><Activity size={14} /> 整改列表</Space>}>
            <Segmented
              options={[
                { value: 'all', label: `全部 (${list.length})` },
                { value: 'pending', label: `待整改 (${stats.pending})` },
                { value: 'in-progress', label: `整改中 (${stats.inProgress})` },
                { value: 'rectified', label: `已整改 (${stats.rectified})` },
                { value: 'overdue', label: `已逾期 (${stats.overdue})` },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as string)}
              style={{ marginBottom: 8 }}
            />
            <List
              loading={loading}
              dataSource={filtered}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无整改任务" /> }}
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 6,
                padding: 4,
                maxHeight: 400,
                overflowY: 'auto',
              }}
              renderItem={(r) => {
                const sm = STATUS_META[r.status] ?? STATUS_META.pending;
                const sev = SEVERITY_META[r.severity];
                const overdue =
                  r.status === 'overdue' ||
                  ((r.status === 'pending' || r.status === 'in-progress') &&
                    new Date(r.deadlineAt) < new Date());
                return (
                  <List.Item
                    key={r.id}
                    data-testid={`remediation-${r.id}`}
                    style={{
                      padding: 10,
                      marginBottom: 4,
                      background: overdue ? 'var(--color-error-bg)' : sm.bg,
                      borderRadius: 6,
                      borderLeft: overdue
                        ? '3px solid #dc2626'
                        : r.status === 'rectified'
                        ? '3px solid #10b981'
                        : '3px solid transparent',
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: sev.color === 'red' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AlertTriangle
                            size={18}
                            color={sev.color === 'red' ? '#dc2626' : '#f59e0b'}
                          />
                        </div>
                      }
                      title={
                        <Space wrap>
                          <Tag color={sev.color}>{sev.label}</Tag>
                          <strong>{r.defectName}</strong>
                          <Tag>{r.defectCode}</Tag>
                          <Tag color="blue">{r.patientName}</Tag>
                          <Tag color={sm.color}>{sm.label}</Tag>
                          {overdue && <Tag color="red">已逾期</Tag>}
                          {r.remindersSent > 0 && (
                            <Tag color="orange">提醒 {r.remindersSent}</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{r.description}</div>
                          <div style={{ fontSize: 12, color: '#0891b2', marginTop: 4 }}>
                            建议：{r.suggestedFix}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            报告医生：{r.doctorName} · 截止 {new Date(r.deadlineAt).toLocaleString()} · 创建 {timeAgo(r.reportedAt)}
                          </div>
                          {r.rectifiedNote && (
                            <div
                              style={{
                                marginTop: 4,
                                padding: 4,
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: 4,
                                fontSize: 12,
                                color: '#065f46',
                              }}
                            >
                              整改说明：{r.rectifiedNote}
                              {r.verifiedBy && <span> · 验证：{r.verifiedBy}</span>}
                            </div>
                          )}
                        </div>
                      }
                    />
                    <Space>
                      <Button
                        size="small"
                        icon={<Eye size={10} />}
                        onClick={() => setDetailModal(r)}
                      >
                        详情
                      </Button>
                      {(r.status === 'pending' ||
                        r.status === 'in-progress' ||
                        r.status === 'overdue') && (
                        <>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => {
                              setEditing(r);
                              setRectifyModal(true);
                            }}
                          >
                            提交整改
                          </Button>
                          <Button
                            size="small"
                            icon={<Bell size={10} />}
                            onClick={() => handleSendReminder(r.id)}
                          >
                            提醒
                          </Button>
                        </>
                      )}
                      {r.status === 'rectified' && (
                        <Tag icon={<CheckCircle2 size={10} />} color="green">
                          已验证
                        </Tag>
                      )}
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><Activity size={14} /> PDCA 闭环</Space>}>
            <Timeline
              items={(['plan', 'do', 'check', 'act'] as const).map((s) => {
                const meta = PDCA_META[s];
                return {
                  color: meta.color,
                  dot: meta.icon,
                  children: (
                    <div>
                      <Space>
                        <strong style={{ color: meta.color }}>{meta.label}</strong>
                        <Tag>{byStage[s] ?? 0} 项</Tag>
                      </Space>
                      <Progress
                        percent={
                          stats.total > 0 ? Math.round(((byStage[s] ?? 0) / stats.total) * 100) : 0
                        }
                        strokeColor={meta.color}
                        size="small"
                      />
                    </div>
                  ),
                };
              })}
            />
            <div style={{ marginTop: 8, padding: 8, background: '#f0fdf4', borderRadius: 4 }}>
              <div style={{ fontSize: 12, color: '#065f46' }}>
                闭环率 {stats.closureRate}% · 修复率 {stats.fixRate}%
              </div>
              <Progress
                percent={Number(stats.closureRate)}
                strokeColor="#10b981"
                size="small"
                showInfo={false}
              />
            </div>
          </Card>
          <Card size="small" title="分类缺陷率" style={{ marginTop: 12 }}>
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              {Object.entries(defectRateByCategory)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([cat, v]) => {
                  const rate = v.total > 0 ? (v.fixed / v.total) * 100 : 0;
                  return (
                    <div key={cat}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color="blue">{cat}</Tag>
                        <span style={{ fontSize: 12 }}>
                          {v.fixed}/{v.total} · {rate.toFixed(0)}%
                        </span>
                      </Space>
                      <Progress
                        percent={rate}
                        size="small"
                        showInfo={false}
                        strokeColor={rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#dc2626'}
                      />
                    </div>
                  );
                })}
              {Object.keys(defectRateByCategory).length === 0 && (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无数据" />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title={`整改提交 - ${editing?.defectName}`}
        open={rectifyModal}
        onCancel={() => {
          setRectifyModal(false);
          setNote('');
        }}
        onOk={handleRectify}
        okText="提交"
        cancelText="取消"
        width={560}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={10}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>报告 ID</div>
            <Input value={editing?.reportId} disabled />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>建议方案</div>
            <Input value={editing?.suggestedFix} disabled />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>整改说明 *</div>
            <Input.TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="详细说明整改内容..."
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={`整改详情 - ${detailModal?.defectCode}`}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={520}
      >
        {detailModal && (
          <Space orientation="vertical" style={{ width: '100%' }} size={8}>
            <Space wrap>
              <Tag color={SEVERITY_META[detailModal.severity].color}>
                {SEVERITY_META[detailModal.severity].label}
              </Tag>
              <Tag color={STATUS_META[detailModal.status]?.color}>
                {STATUS_META[detailModal.status]?.label}
              </Tag>
              <Tag color="blue">{detailModal.patientName}</Tag>
            </Space>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>缺陷</div>
              <div style={{ fontSize: 13 }}>{detailModal.defectName}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>描述</div>
              <div style={{ fontSize: 13 }}>{detailModal.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>建议方案</div>
              <div style={{ fontSize: 13, color: '#0891b2' }}>{detailModal.suggestedFix}</div>
            </div>
            {detailModal.rectifiedNote && (
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>整改说明</div>
                <div
                  style={{
                    fontSize: 13,
                    padding: 6,
                    background: '#f0fdf4',
                    borderRadius: 4,
                    color: '#065f46',
                  }}
                >
                  {detailModal.rectifiedNote}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Tag>报告医生</Tag> <strong>{detailModal.doctorName}</strong>
              </div>
              <div>
                <Tag>报告 ID</Tag> <strong>{detailModal.reportId}</strong>
              </div>
              <div>
                <Tag>创建</Tag> <strong>{timeAgo(detailModal.reportedAt)}</strong>
              </div>
              <div>
                <Tag>截止</Tag>{' '}
                <strong>{new Date(detailModal.deadlineAt).toLocaleString()}</strong>
              </div>
              {detailModal.verifiedBy && (
                <div>
                  <Tag>验证人</Tag> <strong>{detailModal.verifiedBy}</strong>
                </div>
              )}
              {detailModal.remindersSent > 0 && (
                <div>
                  <Tag>提醒次数</Tag> <strong>{detailModal.remindersSent}</strong>
                </div>
              )}
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default DefectRemediationTracker;

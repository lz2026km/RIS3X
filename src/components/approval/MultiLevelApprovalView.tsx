import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Typography, Button, Alert, Descriptions, Steps, Input, Modal, message, Badge, Progress, Empty } from 'antd';
import { ClipboardList, CheckCircle2, XCircle, Clock, User, Send, Search, AlertTriangle } from 'lucide-react';
import { multiLevelApprovalService } from '../../services/approval/MultiLevelApproval';
import type { MultiLevelApprovalState, ApprovalAction, ApprovalParticipant, ApprovalDecision } from '../../types/sign';

const { Text, Title } = Typography;

export interface MultiLevelApprovalViewProps {
  userId?: string;
  onAction?: (state: MultiLevelApprovalState) => void;
}

const DECISION_META: Record<Exclude<ApprovalDecision, 'pending'>, { color: string; label: string; icon: React.ReactNode }> = {
  approved: { color: 'green', label: '通过', icon: <CheckCircle2 size={12} /> },
  rejected: { color: 'red', label: '驳回', icon: <XCircle size={12} /> },
  skipped: { color: 'orange', label: '跳过', icon: <Send size={12} /> },
  escalated: { color: 'purple', label: '升级', icon: <AlertTriangle size={12} /> },
};

export const MultiLevelApprovalView: React.FC<MultiLevelApprovalViewProps> = ({ userId, onAction }) => {
  const [inflight, setInflight] = useState<MultiLevelApprovalState[]>([]);
  const [completed, setCompleted] = useState<MultiLevelApprovalState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MultiLevelApprovalState | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inf, cmp] = await Promise.all([
        multiLevelApprovalService.listInflight(),
        multiLevelApprovalService.listCompleted(),
      ]);
      setInflight(inf);
      setCompleted(cmp);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userId]);

  const handleApprove = async (state: MultiLevelApprovalState, decision: 'approved' | 'rejected') => {
    if (!state.currentLevelId) return;
    setActionLoading(true);
    try {
      const updated = await multiLevelApprovalService.approve(state.approvalId, {
        levelId: state.currentLevelId,
        approverId: userId ?? 'anonymous',
        approverName: '当前审批人',
        approverRole: 'director',
        decision,
        comment,
        ipAddress: '127.0.0.1',
        deviceId: 'web',
      });
      message.success(decision === 'approved' ? '已批准' : '已驳回');
      setDetail(updated);
      onAction?.(updated);
      setComment('');
      void load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    'in-progress': 'blue',
    completed: 'green',
    rejected: 'red',
    expired: 'default',
    draft: 'orange',
  };

  const columns = [
    {
      title: '报告 ID',
      dataIndex: 'reportId',
      key: 'reportId',
      render: (r: string) => <Text copyable>{r}</Text>,
    },
    {
      title: '发起人',
      key: 'initiator',
      render: (_: unknown, r: MultiLevelApprovalState) => (
        <Space>
          <User size={12} />
          <Text>{r.initiatedByName}</Text>
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: string) => (
        <Tag color={p === 'stat' ? 'red' : p === 'urgent' ? 'orange' : 'blue'}>{p}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColor[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '当前层级',
      dataIndex: 'currentLevelId',
      key: 'currentLevelId',
      render: (_: unknown, r: MultiLevelApprovalState) => {
        const lv = r.levels.find((l) => l.levelId === r.currentLevelId);
        return lv ? <Tag>{lv.label} ({lv.role})</Tag> : <Text type="secondary">已完成</Text>;
      },
    },
    {
      title: '待审批',
      dataIndex: 'pendingApprovers',
      key: 'pendingApprovers',
      render: (p: ApprovalParticipant[]) => (
        <Space size={4}>
          {p.map((a) => <Tag key={a.userId}>{a.userName}</Tag>)}
          {p.length === 0 && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: MultiLevelApprovalState) => (
        <Button size="small" onClick={() => setDetail(r)}>详情</Button>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <ClipboardList size={18} />
          <span>多级审批</span>
          <Tag color="blue">进行中 {inflight.length}</Tag>
          <Tag color="green">已完成 {completed.length}</Tag>
        </Space>
      }
      extra={<Button icon={<Send size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>}
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Title level={5}>进行中</Title>
      <Table size="small" dataSource={inflight} columns={columns} rowKey="approvalId" pagination={false} style={{ marginBottom: 16 }} locale={{ emptyText: <Empty description="无进行中审批" /> }} />

      <Title level={5}>已完成</Title>
      <Table size="small" dataSource={completed} columns={columns} rowKey="approvalId" pagination={false} locale={{ emptyText: <Empty description="无已完成审批" /> }} />

      <Modal
        title={`审批详情 - ${detail?.reportId ?? ''}`}
        open={!!detail}
        onCancel={() => { setDetail(null); setComment(''); }}
        footer={null}
        width={640}
      >
        {detail && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="审批 ID">{detail.approvalId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[detail.status] ?? 'default'}>{detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发起人">{detail.initiatedByName}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={detail.priority === 'stat' ? 'red' : detail.priority === 'urgent' ? 'orange' : 'blue'}>{detail.priority}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发起时间">{new Date(detail.initiatedAt).toLocaleString('zh-CN')}</Descriptions.Item>
              <Descriptions.Item label="到期时间">{new Date(detail.expiresAt).toLocaleString('zh-CN')}</Descriptions.Item>
              {detail.finishedAt && (
                <Descriptions.Item label="完成时间">{new Date(detail.finishedAt).toLocaleString('zh-CN')}</Descriptions.Item>
              )}
              {detail.reason && <Descriptions.Item label="原因" span={2}>{detail.reason}</Descriptions.Item>}
            </Descriptions>

            <Title level={5}>审批流程</Title>
            <Steps
              size="small"
              current={detail.completedLevelIds.length}
              items={detail.levels.map((l) => ({
                title: `${l.label} (${l.role})`,
                status: detail.completedLevelIds.includes(l.levelId)
                  ? 'finish'
                  : l.levelId === detail.currentLevelId
                    ? 'process'
                    : 'wait',
              }))}
            />

            {detail.actions.length > 0 && (
              <>
                <Title level={5}>审批记录</Title>
                {detail.actions.map((a, i) => {
                  const meta = DECISION_META[a.decision];
                  return (
                    <Alert
                      key={i}
                      type={a.decision === 'approved' ? 'success' : 'error'}
                      showIcon
                      icon={meta?.icon}
                      title={
                        <Space>
                          <Text strong>{a.approverName}</Text>
                          <Tag color={meta?.color}>{meta?.label}</Tag>
                          <Text type="secondary">{new Date(a.actedAt).toLocaleString('zh-CN')}</Text>
                        </Space>
                      }
                      description={a.comment}
                      style={{ marginBottom: 4 }}
                    />
                  );
                })}
              </>
            )}

            {detail.status === 'in-progress' && (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                  placeholder="审批意见..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <Space>
                  <Button type="primary" icon={<CheckCircle2 size={14} />} loading={actionLoading} onClick={() => void handleApprove(detail, 'approved')}>
                    批准
                  </Button>
                  <Button danger icon={<XCircle size={14} />} loading={actionLoading} onClick={() => void handleApprove(detail, 'rejected')}>
                    驳回
                  </Button>
                </Space>
              </Space>
            )}
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default MultiLevelApprovalView;

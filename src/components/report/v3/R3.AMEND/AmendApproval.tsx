/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AMEND 修订审批
 * A5-REPORT / 10 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, List, Tag, Button, Empty, Alert, Input, Modal, message, Row, Col, Statistic } from 'antd';
import { ShieldCheck, ShieldX, Clock, User, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AmendApproval, AmendApprovalStatus } from '../../../../types/R3/R3.AMEND';
import { amendService } from '../../../../services/amend/amendService';

const { Title, Text, Paragraph } = Typography;

export interface AmendApprovalProps {
  reportId?: string;
  approverId?: string;
  approverName?: string;
  approverTitle?: string;
  onProcessed?: (approval: AmendApproval) => void;
}

const STATUS_META: Record<AmendApprovalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待审批', color: 'gold', icon: <Clock size={12} /> },
  approved: { label: '已通过', color: 'green', icon: <CheckCircle2 size={12} /> },
  rejected: { label: '已驳回', color: 'red', icon: <ShieldX size={12} /> },
  'auto-approved': { label: '自动通过', color: 'blue', icon: <ShieldCheck size={12} /> },
};

export const AmendApprovalView: React.FC<AmendApprovalProps> = ({
  reportId,
  approverId = 'D001',
  approverName = '张明远',
  approverTitle = '主任医师',
  onProcessed,
}) => {
  const [approvals, setApprovals] = useState<AmendApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; approval: AmendApproval | null; reason: string }>({
    open: false,
    approval: null,
    reason: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const list = await amendService.listApprovals(reportId);
      setApprovals(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [reportId]);

  const handleApprove = async (id: string) => {
    try {
      const result = await amendService.approve(id, approverId, approverName, approverTitle);
      if (result) {
        message.success('审批通过');
        onProcessed?.(result);
        void load();
      }
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.approval) return;
    if (!rejectModal.reason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    try {
      const result = await amendService.reject(rejectModal.approval.id, approverId, approverName, rejectModal.reason);
      if (result) {
        message.success('已驳回');
        onProcessed?.(result);
        setRejectModal({ open: false, approval: null, reason: '' });
        void load();
      }
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const pending = approvals.filter((a) => a.status === 'pending');
  const approved = approvals.filter((a) => a.status === 'approved');
  const rejected = approvals.filter((a) => a.status === 'rejected');

  return (
    <Card
      title={
        <Space>
          <ShieldCheck size={18} />
          <span>修订审批</span>
          {pending.length > 0 && <Tag color="gold">{pending.length} 待审批</Tag>}
        </Space>
      }
      extra={
        <Button onClick={() => void load()} loading={loading}>刷新</Button>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic title="待审批" value={pending.length} prefix={<Clock size={14} />} styles={{ content: {  color: '#f59e0b'  } }} />
        </Col>
        <Col span={8}>
          <Statistic title="已通过" value={approved.length} prefix={<CheckCircle2 size={14} />} styles={{ content: {  color: '#10b981'  } }} />
        </Col>
        <Col span={8}>
          <Statistic title="已驳回" value={rejected.length} prefix={<ShieldX size={14} />} styles={{ content: {  color: '#ef4444'  } }} />
        </Col>
      </Row>

      {approvals.length === 0 ? (
        <Empty description={loading ? '加载中...' : '暂无审批记录'} />
      ) : (
        <List
          dataSource={approvals}
          renderItem={(item) => {
            const meta = STATUS_META[item.status];
            return (
              <List.Item
                actions={
                  item.status === 'pending'
                    ? [
                        <Button
                          key="approve"
                          type="primary"
                          size="small"
                          icon={<CheckCircle2 size={12} />}
                          onClick={() => void handleApprove(item.id)}
                        >
                          通过
                        </Button>,
                        <Button
                          key="reject"
                          danger
                          size="small"
                          icon={<ShieldX size={12} />}
                          onClick={() => setRejectModal({ open: true, approval: item, reason: '' })}
                        >
                          驳回
                        </Button>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  avatar={<Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>}
                  title={
                    <Space>
                      <Text strong>报告 {item.reportId}</Text>
                      {item.isAutoApprove && <Tag color="blue" size="small">自动</Tag>}
                    </Space>
                  }
                  description={
                    <Space orientation="vertical" size={2}>
                      <Space size={4}>
                        <User size={12} />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.requesterName}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>→</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.approverName ?? '待审批'}</Text>
                      </Space>
                      <Text style={{ fontSize: 12 }}>{item.reason}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
                      {item.rejectedReason && (
                        <Alert type="error" showIcon title={`驳回原因: ${item.rejectedReason}`} style={{ marginTop: 4 }} />
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      <Modal
        title={
          <Space>
            <AlertTriangle size={16} color="#f59e0b" />
            <span>驳回审批</span>
          </Space>
        }
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, approval: null, reason: '' })}
        onOk={handleReject}
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>请填写驳回原因 (必填):</Paragraph>
        <Input.TextArea
          value={rejectModal.reason}
          onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
          rows={4}
          placeholder="例如：修订原因不充分，建议补充影像所见后再申请"
        />
      </Modal>
    </Card>
  );
};

export default AmendApprovalView;
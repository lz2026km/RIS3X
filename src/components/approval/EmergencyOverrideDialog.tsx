import React, { useEffect, useState } from 'react';
import { Card, Tag, Space, Typography, Button, Alert, Descriptions, Modal, Form, Input, Select, message, Steps, Badge, List, Statistic, Row, Col } from 'antd';
import { AlertTriangle, ShieldAlert, Eye, CheckCircle2, XCircle, User, Clock, Fingerprint, Loader2 } from 'lucide-react';
import { emergencyOverrideService } from '../../services/approval/EmergencyOverride';
import { biometricService } from '../../services/sign/biometricService';
import type { EmergencyOverrideRecord, EmergencyOverrideRequest, EmergencyEyeApproval, ApprovalRole } from '../../types/sign';

const { Text, Title, Paragraph } = Typography;

export interface EmergencyOverrideDialogProps {
  userId: string;
  userName: string;
  onAuthorized?: (record: EmergencyOverrideRecord) => void;
}

export const EmergencyOverrideDialog: React.FC<EmergencyOverrideDialogProps> = ({ userId, userName, onAuthorized }) => {
  const [records, setRecords] = useState<EmergencyOverrideRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initModal, setInitModal] = useState(false);
  const [detail, setDetail] = useState<EmergencyOverrideRecord | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await emergencyOverrideService.expireStale();
      const list = await emergencyOverrideService.list();
      setRecords(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleInitiate = async () => {
    try {
      const vals = await form.validateFields();
      const witnesses = await emergencyOverrideService.listWitnessPool();
      const req: EmergencyOverrideRequest = {
        reportId: vals.reportId,
        initiatorId: userId,
        initiatorName: userName,
        reason: vals.reason,
        severity: vals.severity,
        eyesRequired: 3,
        witnesses: witnesses.slice(0, 3).map((w) => ({ ...w })),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        justificationDoc: vals.justificationDoc,
      };
      const record = await emergencyOverrideService.initiate(req);
      message.success('应急请求已发起，等待 3 位见证人授权');
      setInitModal(false);
      form.resetFields();
      void load();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error((e as Error).message);
    }
  };

  const handleApproveAsWitness = async (record: EmergencyOverrideRecord) => {
    const code = `EMRG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const bioRes = await biometricService.verify({ userId, method: 'face' });
    const eye: EmergencyEyeApproval = {
      witnessId: userId,
      witnessName: userName,
      witnessRole: 'director' as ApprovalRole,
      approvalCode: code,
      approvedAt: new Date().toISOString(),
      ipAddress: '127.0.0.1',
      biometricVerified: bioRes.success,
    };
    const updated = await emergencyOverrideService.approve(record.id, eye);
    message.success(`见证授权成功 (代码: ${code})`);
    if (updated.status === 'authorized') {
      onAuthorized?.(updated);
    }
    setDetail(updated);
    void load();
  };

  const statusMeta: Record<string, { color: string; label: string }> = {
    pending: { color: 'orange', label: '待授权' },
    authorized: { color: 'green', label: '已授权' },
    rejected: { color: 'red', label: '已拒绝' },
    expired: { color: 'default', label: '已过期' },
    consumed: { color: 'purple', label: '已消费' },
  };

  return (
    <Card
      title={
        <Space>
          <AlertTriangle size={18} color="#dc2626" />
          <span>紧急越权 (3-eye Principle)</span>
          <Tag color="red" icon={<ShieldAlert size={12} />}>应急通道</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => void load()} loading={loading}>刷新</Button>
          <Button type="primary" danger icon={<AlertTriangle size={14} />} onClick={() => setInitModal(true)}>
            发起应急授权
          </Button>
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      {records.length === 0 ? (
        <Alert type="info" showIcon title="暂无应急授权记录" />
      ) : (
        <List
          dataSource={records}
          renderItem={(r) => {
            const meta = statusMeta[r.status] ?? { color: 'default', label: r.status };
            const progress = r.approvals.length;
            const required = r.request.eyesRequired;
            return (
              <List.Item
                actions={[
                  <Button size="small" onClick={() => setDetail(r)}>详情</Button>,
                  r.status === 'pending' && !r.approvals.find((a) => a.witnessId === userId) && (
                    <Button size="small" type="primary" onClick={() => void handleApproveAsWitness(r)}>
                      作为见证人授权
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{r.request.reportId}</Text>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Tag color={r.request.severity === 'life-threatening' ? 'red' : r.request.severity === 'critical' ? 'orange' : 'gold'}>
                        {r.request.severity}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <Text type="secondary">发起人: {r.request.initiatorName}</Text>
                      <Text type="secondary">见证: {progress}/{required}</Text>
                      <Text type="secondary">原因: {r.request.reason}</Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      <Modal
        title="发起应急授权"
        open={initModal}
        onOk={handleInitiate}
        onCancel={() => setInitModal(false)}
      >
        <Alert type="warning" showIcon title="紧急授权需 3 位见证人 (3-eye principle) 同时授权方可生效" style={{ marginBottom: 12 }} />
        <Form form={form} layout="vertical">
          <Form.Item name="reportId" label="报告 ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="severity" label="严重程度" rules={[{ required: true }]} initialValue="critical">
            <Select options={[
              { value: 'high', label: '高' },
              { value: 'critical', label: '危急' },
              { value: 'life-threatening', label: '生命危急' },
            ]} />
          </Form.Item>
          <Form.Item name="reason" label="应急原因" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="justificationDoc" label="事件编号/文档"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`应急详情 - ${detail?.request.reportId ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={560}
      >
        {detail && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={statusMeta[detail.status]?.color}>{statusMeta[detail.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Tag color={detail.request.severity === 'life-threatening' ? 'red' : 'orange'}>{detail.request.severity}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="所需见证">{detail.request.eyesRequired} 人</Descriptions.Item>
              <Descriptions.Item label="发起人">{detail.request.initiatorName}</Descriptions.Item>
              <Descriptions.Item label="发起时间">{new Date(detail.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
              <Descriptions.Item label="到期时间">{new Date(detail.request.expiresAt).toLocaleString('zh-CN')}</Descriptions.Item>
              {detail.authorizedAt && (
                <Descriptions.Item label="授权时间">{new Date(detail.authorizedAt).toLocaleString('zh-CN')}</Descriptions.Item>
              )}
              <Descriptions.Item label="原因" span={2}>{detail.request.reason}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>见证进度 ({detail.approvals.length}/{detail.request.eyesRequired})</Title>
            <Steps
              size="small"
              current={detail.approvals.length}
              items={detail.request.witnesses.map((w, i) => {
                const app = detail.approvals.find((a) => a.witnessId === w.userId);
                return {
                  title: w.userName,
                  subTitle: w.role,
                  status: app ? 'finish' : 'process',
                  icon: app ? <CheckCircle2 size={14} /> : <Clock size={14} />,
                };
              })}
            />

            {detail.approvals.length > 0 && (
              <>
                <Title level={5}>见证记录</Title>
                {detail.approvals.map((a, i) => (
                  <Alert
                    key={i}
                    type="success"
                    showIcon
                    icon={<CheckCircle2 size={14} />}
                    message={
                      <Space>
                        <Text strong>{a.witnessName}</Text>
                        <Tag>{a.witnessRole}</Tag>
                        <Text type="secondary">{new Date(a.approvedAt).toLocaleString('zh-CN')}</Text>
                        {a.biometricVerified && <Tag color="green" icon={<Fingerprint size={12} />}>生物验证</Tag>}
                      </Space>
                    }
                    description={`授权码: ${a.approvalCode}`}
                  />
                ))}
              </>
            )}
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default EmergencyOverrideDialog;

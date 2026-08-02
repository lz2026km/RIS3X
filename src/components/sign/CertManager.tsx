import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Typography, Button, Alert, Badge, Tooltip, Descriptions, Modal, Form, Input, Select, InputNumber, message, Empty } from 'antd';
import { Key, ShieldCheck, AlertTriangle, RefreshCw, Plus, RotateCcw, Ban, PlayCircle, PauseCircle } from 'lucide-react';
import type { CertificateInfo } from '../../types/R3/R3.SIGN';
import type { CertLifecycleStatus, CertLifecycleEvent } from '../../types/sign';
import { certLifecycleService } from '../../services/sign/CertLifecycleService';

const { Text, Title } = Typography;

const STATUS_META: Record<CertLifecycleStatus, { color: string; label: string }> = {
  'pending-csr': { color: 'blue', label: '待提交 CSR' },
  'pending-issue': { color: 'orange', label: '待签发' },
  active: { color: 'green', label: '有效' },
  suspended: { color: 'gold', label: '挂起' },
  expired: { color: 'default', label: '已过期' },
  revoked: { color: 'red', label: '已吊销' },
  renewed: { color: 'purple', label: '已续期' },
};

export interface CertManagerProps {
  userId?: string;
  onSelect?: (cert: CertificateInfo) => void;
  showActions?: boolean;
}

export const CertManager: React.FC<CertManagerProps> = ({ userId, onSelect, showActions = true }) => {
  const [certs, setCerts] = useState<CertificateInfo[]>([]);
  const [events, setEvents] = useState<CertLifecycleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCert, setSelectedCert] = useState<CertificateInfo | null>(null);
  const [issueModal, setIssueModal] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await certLifecycleService.listCertificates();
      const evt = await certLifecycleService.listEvents();
      setCerts(userId ? list.filter((c) => c.subject.userId === userId) : list);
      setEvents(evt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userId]);

  const handleIssue = async () => {
    try {
      const vals = await form.validateFields();
      await certLifecycleService.issue({
        userId: vals.userId,
        userName: vals.userName,
        userTitle: vals.userTitle,
        organization: vals.organization,
        certType: vals.certType,
        validityDays: vals.validityDays,
        reason: vals.reason,
      });
      message.success('证书签发成功');
      setIssueModal(false);
      form.resetFields();
      void load();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error((e as Error).message);
    }
  };

  const handleRenew = async () => {
    if (!selectedCert) return;
    try {
      const vals = await form.validateFields();
      await certLifecycleService.renew({
        certId: selectedCert.id,
        newValidityDays: vals.newValidityDays,
        reason: vals.reason,
        operatorId: 'current-user',
        operatorName: '当前用户',
      });
      message.success('证书已续期');
      setRenewModal(false);
      setSelectedCert(null);
      form.resetFields();
      void load();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error((e as Error).message);
    }
  };

  const columns = [
    {
      title: '序列号',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
      render: (s: string) => <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{s}</Text>,
    },
    {
      title: '持有人',
      key: 'holder',
      render: (_: unknown, r: CertificateInfo) => (
        <Space>
          <Badge status={r.status === 'active' ? 'success' : r.status === 'expired' ? 'warning' : 'error'} />
          <Text>{r.subject.commonName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({r.subject.role})</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'certType',
      key: 'certType',
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: '有效期',
      key: 'validity',
      render: (_: unknown, r: CertificateInfo) => {
        const days = Math.floor((new Date(r.notAfter).getTime() - Date.now()) / 86400000);
        return (
          <Space size={4}>
            <Text style={{ fontSize: 12 }}>{r.notBefore.slice(0, 10)} ~ {r.notAfter.slice(0, 10)}</Text>
            {days > 0 ? (
              <Tag color={days > 30 ? 'green' : 'orange'}>{days}天</Tag>
            ) : (
              <Tag color="red">已过期</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: CertLifecycleStatus) => {
        const meta = STATUS_META[s] ?? { color: 'default', label: s };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: CertificateInfo) => (
        <Space>
          {onSelect && r.status === 'active' && (
            <Button size="small" type="primary" onClick={() => onSelect(r)} icon={<Key size={12} />}>
              选用
            </Button>
          )}
          {showActions && r.status === 'active' && (
            <Tooltip title="续期">
              <Button size="small" icon={<RotateCcw size={12} />} onClick={() => { setSelectedCert(r); setRenewModal(true); }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const certEvents = selectedCert ? events.filter((e) => e.certId === selectedCert.id) : [];

  return (
    <Card
      title={
        <Space>
          <ShieldCheck size={18} />
          <span>证书管理</span>
          <Tag>{certs.length} 张</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>
          {showActions && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setIssueModal(true)}>
              签发证书
            </Button>
          )}
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      <Table
        size="small"
        dataSource={certs}
        columns={columns}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无证书" /> }}
        onRow={(r) => ({
          onClick: () => setSelectedCert(r),
          style: { cursor: 'pointer', background: selectedCert?.id === r.id ? '#f0f5ff' : undefined },
        })}
      />

      {selectedCert && certEvents.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 12 }}>证书事件 - {selectedCert.serialNumber}</Title>
          <Table
            size="small"
            dataSource={certEvents}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: <Empty description="暂无证书事件" /> }}
            columns={[
              { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag>{t}</Tag> },
              { title: '时间', dataIndex: 'occurredAt', key: 'occurredAt', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
              { title: '操作人', dataIndex: 'actorName', key: 'actorName' },
              { title: '原因', dataIndex: 'reason', key: 'reason' },
            ]}
          />
        </>
      )}

      <Modal title="签发新证书" open={issueModal} onOk={handleIssue} onCancel={() => setIssueModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label="用户 ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="userName" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="userTitle" label="职称"><Input /></Form.Item>
          <Form.Item name="organization" label="机构"><Input /></Form.Item>
          <Form.Item name="certType" label="证书类型" rules={[{ required: true }]} initialValue="RSA-SHA256">
            <Select options={[{ value: 'RSA-SHA256', label: 'RSA-SHA256' }, { value: 'SM3-SM2', label: 'SM3-SM2' }]} />
          </Form.Item>
          <Form.Item name="validityDays" label="有效天数" rules={[{ required: true }]} initialValue={365}>
            <InputNumber min={1} max={3650} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="签发原因"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="续期证书" open={renewModal} onOk={handleRenew} onCancel={() => setRenewModal(false)}>
        {selectedCert && <p>证书: {selectedCert.serialNumber}</p>}
        <Form form={form} layout="vertical">
          <Form.Item name="newValidityDays" label="续期天数" rules={[{ required: true }]} initialValue={365}>
            <InputNumber min={1} max={3650} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="续期原因" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CertManager;

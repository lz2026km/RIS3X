// [v3.0.6.8-82] 口腔模块共享组件
import React, { useState } from 'react';
import { Space, Tag, Empty } from 'antd';
import { Table, Button, Alert, message, Modal, Descriptions } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Activity, Plus } from 'lucide-react';

export interface DentalHeaderProps {
  title: string;
  version?: string;
  icon?: React.ReactNode;
  tags?: React.ReactNode[];
  children?: React.ReactNode;
  extra?: React.ReactNode;
}

/** 口腔页面统一页头 */
export const DentalPageHeader: React.FC<DentalHeaderProps> = ({
  title, version = 'v3.0.6.8-82', icon, tags = [], children, extra,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
    <Space>
      {icon || <Activity size={20} color="#2563eb" />}
      <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
      <Tag color="cyan">{version}</Tag>
      {tags}
      {children}
    </Space>
    {extra && <Space>{extra}</Space>}
  </div>
);

export const EmptyState: React.FC<{ tip?: string; onCreate?: () => void; createLabel?: string }> = ({
  tip = '暂无数据',
  onCreate,
  createLabel = '新建',
}) => (
  <Empty description={tip} image={Empty.PRESENTED_IMAGE_SIMPLE}>
    {onCreate && <Button type="primary" icon={<Plus size={14} />} onClick={onCreate}>{createLabel}</Button>}
  </Empty>
);

export const TreatmentActions: React.FC<{ record: DentalTreatment }> = ({ record }) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const [followedUp, setFollowedUp] = useState(false);

  const handleFollowUp = () => {
    setFollowedUp(true);
    message.success(`随访已安排: ${record.patientName || record.patientId || record.id}`);
  };

  return (
    <Space size={4}>
      <Button size="small" onClick={() => setDetailOpen(true)}>详情</Button>
      <Button size="small" type="link" disabled={followedUp} onClick={handleFollowUp}>
        {followedUp ? '随访已安排' : '随访'}
      </Button>
      <Modal
        title={`治疗记录详情 - ${record.patientName || record.patientId || record.id}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={520}
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="患者">{record.patientName || '-'}</Descriptions.Item>
          <Descriptions.Item label="患者ID">{record.patientId || '-'}</Descriptions.Item>
          <Descriptions.Item label="牙位">{record.toothNo ? `#${record.toothNo}` : '-'}</Descriptions.Item>
          <Descriptions.Item label="牙面">{record.toothSurface || '-'}</Descriptions.Item>
          <Descriptions.Item label="诊断" span={2}>{record.diagnosis || '-'}</Descriptions.Item>
          <Descriptions.Item label="治疗计划" span={2}>{record.plan || '-'}</Descriptions.Item>
          <Descriptions.Item label="费用">{record.cost != null ? `¥${record.cost}` : '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={record.status === 'Completed' || record.status === 'completed' ? 'green' : record.status === 'InProgress' ? 'orange' : 'default'}>
              {record.status === 'Completed' || record.status === 'completed' ? '已完成' : record.status === 'InProgress' ? '进行中' : record.status || '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>{record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
        </Descriptions>
      </Modal>
    </Space>
  );
};

export interface DentalTreatment {
  id: string;
  patientName?: string;
  patientId?: string;
  toothNo?: number;
  toothSurface?: string;
  diagnosis?: string;
  plan?: string;
  cost?: number;
  status?: string;
  createdAt?: string;
}

/** 口腔治疗列表通用 Table */
export const DentalTreatmentTable: React.FC<{
  data: DentalTreatment[];
  showSurface?: boolean;
  showActions?: boolean;
  size?: 'small' | 'middle' | 'large';
}> = ({ data, showSurface = false, showActions = false, size = 'small' }) => {
  const baseColumns: ColumnsType<DentalTreatment> = [
    { title: '患者', dataIndex: 'patientName', width: 100 },
    { title: '牙位', dataIndex: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
  ];
  if (showSurface) baseColumns.push({ title: '面', dataIndex: 'toothSurface', width: 60 });
  baseColumns.push(
    { title: '诊断', dataIndex: 'diagnosis', width: 180 },
    { title: '计划', dataIndex: 'plan', width: 180 },
    { title: '费用', dataIndex: 'cost', width: 80, render: (v?: number) => v != null ? `¥${v}` : '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (s?: string) =>
      <Tag color={s === 'Completed' ? 'green' : s === 'InProgress' ? 'orange' : s === 'completed' ? 'success' : 'default'}>{s || '-'}</Tag> },
  );
  if (showActions) {
    baseColumns.push({
      title: '操作', width: 180,
      render: (_, t) => (
        <Space>
          <Button size="small" onClick={async () => {
            await fetch(`/api/v1/dental/treatments/${t.id}/start`, { method: 'POST' });
            message.success('已开始');
          }}>开始</Button>
          <Button size="small" onClick={async () => {
            await fetch(`/api/v1/dental/treatments/${t.id}/complete`, { method: 'POST' });
            message.success('已完成');
          }}>完成</Button>
        </Space>
      ),
    });
  }
  return <Table dataSource={data} rowKey="id" columns={baseColumns} pagination={false} size={size} />;
};

/** 口腔治疗页面通用容器 */
export const DentalPageLayout: React.FC<{
  header: DentalHeaderProps;
  alert?: { message: string; type?: 'info' | 'success' | 'warning' | 'error' };
  children?: React.ReactNode;
}> = ({ header, alert, children }) => (
  <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
    <DentalPageHeader {...header} />
    {alert && <Alert title={alert.message} type={alert.type || 'info'} showIcon style={{ marginBottom: 12 }} />}
    {children}
  </div>
);
// [v3.0.6.8-82] 口腔模块共享组件
import React, { useState } from 'react';
import { Space, Tag, Empty } from 'antd';
import { Button, Alert, message, Modal, Descriptions } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Activity, Plus } from 'lucide-react';
import { t } from '../../i18n/appI18n';
import { DataTable } from "../../components/common";

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
      {icon || <Activity size={20} color="var(--color-primary-600)" />}
      <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
      <Tag color="cyan">{version}</Tag>
      {tags}
      {children}
    </Space>
    {extra && <Space>{extra}</Space>}
  </div>
);

export const EmptyState: React.FC<{ tip?: string; onCreate?: () => void; createLabel?: string }> = ({
  tip = t('dentalShared.noData'),
  onCreate,
  createLabel = t('dentalShared.create'),
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
    message.success(t('dentalShared.followUpScheduled', { name: record.patientName || record.patientId || record.id }));
  };

  return (
    <Space size={4}>
      <Button size="small" onClick={() => setDetailOpen(true)}>{t('dentalShared.detail')}</Button>
      <Button size="small" type="link" disabled={followedUp} onClick={handleFollowUp}>
        {followedUp ? t('dentalShared.followedUp') : t('dentalShared.followUp')}
      </Button>
      <Modal
        title={t('dentalShared.detailTitle', { name: record.patientName || record.patientId || record.id })}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('dentalShared.close')}</Button>}
        width={520}
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label={t('dentalShared.patient')}>{record.patientName || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.patientId')}>{record.patientId || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.toothNo')}>{record.toothNo ? `#${record.toothNo}` : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.toothSurface')}>{record.toothSurface || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.diagnosis')} span={2}>{record.diagnosis || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.plan')} span={2}>{record.plan || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.cost')}>{record.cost != null ? `¥${record.cost}` : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.status')}>
            <Tag color={record.status === 'Completed' || record.status === 'completed' ? 'green' : record.status === 'InProgress' ? 'orange' : 'default'}>
              {record.status === 'Completed' || record.status === 'completed' ? t('dentalShared.statusCompleted') : record.status === 'InProgress' ? t('dentalShared.statusInProgress') : record.status || '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('dentalShared.createdAt')} span={2}>{record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
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
}> = ({ data, showSurface = false, showActions = false }) => {
  const baseColumns: ColumnsType<DentalTreatment> = [
    { title: t('dentalShared.patient'), dataIndex: 'patientName', width: 100 },
    { title: t('dentalShared.toothNo'), dataIndex: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
  ];
  if (showSurface) baseColumns.push({ title: t('dentalShared.surface'), dataIndex: 'toothSurface', width: 60 });
  baseColumns.push(
    { title: t('dentalShared.diagnosis'), dataIndex: 'diagnosis', width: 180 },
    { title: t('dentalShared.plan'), dataIndex: 'plan', width: 180 },
    { title: t('dentalShared.cost'), dataIndex: 'cost', width: 80, render: (v?: number) => v != null ? `¥${v}` : '-' },
    { title: t('dentalShared.status'), dataIndex: 'status', width: 100, render: (s?: string) =>
      <Tag color={s === 'Completed' ? 'green' : s === 'InProgress' ? 'orange' : s === 'completed' ? 'success' : 'default'}>{s || '-'}</Tag> },
  );
  if (showActions) {
    baseColumns.push({
      title: t('dentalShared.actions'), width: 180,
      render: (_, rec) => (
        <Space>
          <Button size="small" onClick={async () => {
            try {
              await fetch(`/api/v1/dental/treatments/${rec.id}/start`, { method: 'POST' });
              message.success(t('dentalShared.started'));
            } catch (e) {
              console.warn('[F03] Error:', (e as Error)?.message);
            }
          }}>{t('dentalShared.start')}</Button>
          <Button size="small" onClick={async () => {
            try {
              await fetch(`/api/v1/dental/treatments/${rec.id}/complete`, { method: 'POST' });
              message.success(t('dentalShared.completed'));
            } catch (e) {
              console.warn('[F03] Error:', (e as Error)?.message);
            }
          }}>{t('dentalShared.complete')}</Button>
        </Space>
      ),
    });
  }
  return <DataTable dataSource={data} rowKey="id" columns={baseColumns} pagination={false} scroll={{ x: 'max-content' }} />;
};

/** 口腔治疗页面通用容器 */
export const DentalPageLayout: React.FC<{
  header: DentalHeaderProps;
  alert?: { message: string; type?: 'info' | 'success' | 'warning' | 'error' };
  children?: React.ReactNode;
}> = ({ header, alert, children }) => (
  <div style={{ padding: 24, background: 'var(--bg-card)',}}>
    <DentalPageHeader {...header} />
    {alert && <Alert title={alert.message} type={alert.type || 'info'} showIcon style={{ marginBottom: 12 }} />}
    {children}
  </div>
);
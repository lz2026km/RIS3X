// [v3.0.6.11-104 Wave 2D] 待审模板区块
// 接入 GET /templates/pending · POST /templates/:id/approve · /templates/:id/reject
import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Space, Tag, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { Check, ClipboardList, RefreshCw, X } from 'lucide-react';
import { templatesApi, type TemplateDto } from '../services/api/templatesApi';
import { DataTable } from '../components/common/DataTable';
import { DashboardCard } from '../components/dashboard/DashboardCard';
import { StateView } from '../components/common/StateView';
import { getCurrentUser } from '../utils/auth';
import { t } from '../i18n/appI18n';

export function TemplatePendingSection() {
  const [pending, setPending] = useState<TemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TemplateDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await templatesApi.listPending();
    if (res.success) setPending(res.data ?? []);
    else setError(res.error?.message ?? t('w2d.loadFailed'));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (row: TemplateDto) => {
    setActingId(row.id);
    const approver = getCurrentUser()?.name ?? 'admin';
    const res = await templatesApi.approve(row.id, approver);
    setActingId(null);
    if (res.success) {
      message.success(t('tplExt.approved'));
      void load();
    } else {
      message.error(res.error?.message ?? t('w2d.loadFailed'));
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      message.warning(t('tplExt.rejectReasonRequired'));
      return;
    }
    setActingId(rejectTarget.id);
    const res = await templatesApi.reject(rejectTarget.id, rejectReason.trim());
    setActingId(null);
    if (res.success) {
      message.success(t('tplExt.rejected'));
      setRejectTarget(null);
      setRejectReason('');
      void load();
    } else {
      message.error(res.error?.message ?? t('w2d.loadFailed'));
    }
  };

  const columns: TableColumnsType<TemplateDto> = [
    { title: t('tplExt.name'), dataIndex: 'name', key: 'name' },
    { title: t('tplExt.category'), dataIndex: 'category', key: 'category' },
    { title: t('tplExt.bodyPart'), dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: t('w2d.modality'), dataIndex: 'modality', key: 'modality', render: (v?: string) => v ?? '-' },
    {
      title: t('w2d.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v?: string) => <Tag color="orange">{v ?? 'pending'}</Tag>,
    },
    { title: t('tplExt.submitter'), dataIndex: 'createdById', key: 'createdById' },
    {
      title: t('w2d.actions'),
      key: 'actions',
      render: (_: unknown, row: TemplateDto) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<Check size={12} />}
            loading={actingId === row.id}
            onClick={() => void handleApprove(row)}
          >
            {t('tplExt.approve')}
          </Button>
          <Button size="small" danger icon={<X size={12} />} loading={actingId === row.id} onClick={() => { setRejectTarget(row); setRejectReason(''); }}>
            {t('tplExt.reject')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <DashboardCard
        title={t('tplExt.pending')}
        icon={<ClipboardList size={15} />}
        extra={
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>
            {t('w2d.refresh')}
          </Button>
        }
      >
        <StateView loading={loading} error={error} empty={pending.length === 0} emptyDescription={t('tplExt.noPending')} onRetry={() => void load()}>
          <DataTable<TemplateDto>
            rowKey="id"
            dataSource={pending}
            columns={columns}
            emptyText={t('tplExt.noPending')}
          />
        </StateView>
      </DashboardCard>

      <Modal
        open={!!rejectTarget}
        title={t('tplExt.reject')}
        okText={t('tplExt.reject')}
        cancelText={t('w2d.cancel')}
        onOk={() => void handleReject()}
        onCancel={() => setRejectTarget(null)}
        confirmLoading={!!rejectTarget && actingId === rejectTarget.id}
      >
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          {rejectTarget?.name}
        </div>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t('tplExt.rejectReasonRequired')}
        />
      </Modal>
    </>
  );
}

export default TemplatePendingSection;

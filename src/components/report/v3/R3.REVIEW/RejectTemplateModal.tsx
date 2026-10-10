/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.038 R3.REVIEW.039 R3.REVIEW.041 RejectTemplateModal 退回模板
 */
import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, Space, Tag, message, Button, List, Alert } from 'antd';
import {
  XCircle,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { RejectTemplate, RejectCategory } from '../../../types/R3/R3.REVIEW';
import { t } from '../../../../i18n/appI18n';

const CATEGORY_META: Record<RejectCategory, { label: string; color: string }> = {
  'unclear-description': { label: t('w9e.rejectTemplate.catUnclear'), color: 'orange' },
  'terminology-error': { label: t('w9e.rejectTemplate.catTerminology'), color: 'purple' },
  'left-right-confusion': { label: t('w9e.rejectTemplate.catLeftRight'), color: 'red' },
  'missing-key-finding': { label: t('w9e.rejectTemplate.catMissingKey'), color: 'volcano' },
  'inconsistent-with-image': { label: t('w9e.rejectTemplate.catInconsistent'), color: 'red' },
  'missing-recommendation': { label: t('w9e.rejectTemplate.catMissingRec'), color: 'gold' },
  'critical-not-marked': { label: t('w9e.rejectTemplate.catCritical'), color: 'red' },
  other: { label: t('w9e.rejectTemplate.catOther'), color: 'default' },
};

export interface RejectTemplateModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onConfirm: (taskId: string, reason: string, category: RejectCategory) => Promise<void>;
  reviewerId: string;
  reviewerName: string;
}

export const RejectTemplateModal: React.FC<RejectTemplateModalProps> = ({
  open,
  taskId,
  onClose,
  onConfirm,
  reviewerId,
  reviewerName,
}) => {
  const [templates, setTemplates] = useState<RejectTemplate[]>([]);
  const [selected, setSelected] = useState<RejectTemplate | null>(null);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<RejectCategory>('unclear-description');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      reviewService.listRejectTemplates().then((t) => setTemplates(t));
    }
  }, [open]);

  useEffect(() => {
    if (selected) {
      setReason(selected.presetComment);
      setCategory(selected.category);
    }
  }, [selected]);

  const handleConfirm = async () => {
    if (!taskId) return;
    if (reason.trim().length < 5) {
      message.error(t('w9e.rejectTemplate.reasonTooShort'));
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(taskId, reason, category);
      message.success(t('w9e.rejectTemplate.rejected'));
      handleClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('w9e.rejectTemplate.rejectFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelected(null);
    setReason('');
    setCategory('unclear-description');
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <XCircle size={16} color="var(--color-error-600)" />
          <span>{t('w9e.rejectTemplate.title')}</span>
          <Tag color="purple">R3.REVIEW.038</Tag>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={760}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {t('w9e.rejectTemplate.cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger
          icon={<XCircle size={12} />}
          loading={submitting}
          onClick={handleConfirm}
          disabled={reason.trim().length < 5}
        >
          {t('w9e.rejectTemplate.confirmReject')}
        </Button>,
      ]}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        icon={<AlertTriangle size={14} />}
        message={t('w9e.rejectTemplate.alertMsg')}
        style={{ marginBottom: 'var(--space-3, 12px)' }}
      />

      <Form layout="vertical">
        <Form.Item
          label={
            <Space>
              <ListChecks size={14} />
              {t('w9e.rejectTemplate.selectTemplate')}
            </Space>
          }
        >
          <List
            size="small"
            dataSource={templates}
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: 'var(--space-1, 4px)',
            }}
            renderItem={(t) => (
              <List.Item
                onClick={() => setSelected(t)}
                style={{
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 4,
                  marginBottom: 2,
                  background: selected?.id === t.id ? '#fef2f2' : 'transparent',
                  border: selected?.id === t.id ? '1px solid #fca5a5' : '1px solid transparent',
                }}
                data-testid={`reject-template-${t.id}`}
              >
                <Space>
                  <Tag color={CATEGORY_META[t.category].color}>{CATEGORY_META[t.category].label}</Tag>
                  <strong style={{ fontSize: 12 }}>{t.title}</strong>
                  {selected?.id === t.id && <CheckCircle2 size={12} color="#10b981" />}
                </Space>
              </List.Item>
            )}
          />
        </Form.Item>

        <Form.Item label={t('w9e.rejectTemplate.categoryLabel')} required>
          <Select
            value={category}
            onChange={(v) => setCategory(v as RejectCategory)}
            options={Object.entries(CATEGORY_META).map(([k, v]) => ({ value: k, label: v.label }))}
            aria-label={t('w9e.rejectTemplate.categoryLabel')}
          />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <span>{t('w9e.rejectTemplate.reasonLabel')}</span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('w9e.rejectTemplate.reasonHint')}</span>
            </Space>
          }
          required
        >
          <Input.TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            showCount
            placeholder={t('w9e.rejectTemplate.reasonPlaceholder')}
            data-testid="reject-reason-input"
            aria-label={t('w9e.rejectTemplate.reasonLabel')}
          />
        </Form.Item>

        <div
          style={{
            background: 'var(--bg-primary)',
            padding: 'var(--space-2, 8px)',
            borderRadius: 4,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          <FileText size={12} style={{ marginRight: 'var(--space-1, 4px)' }} />
          {t('w9e.rejectTemplate.footer', { name: reviewerName, id: reviewerId })}
        </div>
      </Form>
    </Modal>
  );
};

export default RejectTemplateModal;

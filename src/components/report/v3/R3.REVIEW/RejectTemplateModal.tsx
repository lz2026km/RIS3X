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

const CATEGORY_META: Record<RejectCategory, { label: string; color: string }> = {
  'unclear-description': { label: '描述不清', color: 'orange' },
  'terminology-error': { label: '术语错误', color: 'purple' },
  'left-right-confusion': { label: '左右混淆', color: 'red' },
  'missing-key-finding': { label: '缺关键所见', color: 'volcano' },
  'inconsistent-with-image': { label: '与图像不符', color: 'red' },
  'missing-recommendation': { label: '缺建议', color: 'gold' },
  'critical-not-marked': { label: '危急值未标', color: 'red' },
  other: { label: '其他', color: 'default' },
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
      message.error('驳回原因不能少于 5 字符');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(taskId, reason, category);
      message.success('已驳回');
      handleClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? '驳回失败');
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
          <XCircle size={16} color="#dc2626" />
          <span>退回报告</span>
          <Tag color="purple">R3.REVIEW.038</Tag>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={760}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
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
          确认退回
        </Button>,
      ]}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        icon={<AlertTriangle size={14} />}
        message="退回后报告将进入整改状态，医生需修改后重新提交"
        style={{ marginBottom: 12 }}
      />

      <Form layout="vertical">
        <Form.Item
          label={
            <Space>
              <ListChecks size={14} />
              选择退回模板（点击应用）
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
              padding: 4,
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

        <Form.Item label="驳回分类" required>
          <Select
            value={category}
            onChange={(v) => setCategory(v as RejectCategory)}
            options={Object.entries(CATEGORY_META).map(([k, v]) => ({ value: k, label: v.label }))}
            aria-label="驳回分类"
          />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <span>驳回原因</span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>必填，最少 5 字符，最多 500 字符</span>
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
            placeholder="详细说明驳回原因..."
            data-testid="reject-reason-input"
            aria-label="驳回原因"
          />
        </Form.Item>

        <div
          style={{
            background: '#f8fafc',
            padding: 8,
            borderRadius: 4,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          <FileText size={12} style={{ marginRight: 4 }} />
          驳回人：{reviewerName}（{reviewerId}） · 驳回后将通知报告医生
        </div>
      </Form>
    </Modal>
  );
};

export default RejectTemplateModal;

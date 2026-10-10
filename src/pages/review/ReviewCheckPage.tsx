// @deprecated [v3.0.6.11-104 Wave 5C] 已嵌入 ReviewCenterPage (/review-center 综合审核枢纽) 作为 Tab; 旧路由 /review-check redirect 兼容。文件保留供回滚参考。
// [v3.0.6.11-81] W1-B P0: 初核 + 终核 + 复审综合页面 (真实后端化)
// 背景: 后端无 /review /reviews 端点 (初核/终核/复审 仅存在于 MSW mock)。
// 处理: 改用真实报告状态机 (reports.controller):
//   初核 → GET /reports?state=INITIAL_REVIEW
//   终核 → GET /reports?state=FINAL_REVIEW
//   复审 → GET /reports?state=CO_SIGN_REVIEW
//   通过 → POST /reports/:id/transition (REVIEWED); 驳回 → transition (REJECTED)
//   双签待办 → GET /cosign/pending (cosign.controller)
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Form,
  message,
  Tabs,
  Modal,
} from "antd";
import { CheckCircle2, XCircle, FileSearch, Shield, RefreshCw, ClipboardCheck, FileCheck, PenTool } from 'lucide-react';
import { reportApi } from '@/services/api/reportApi';
import { cosignApi } from '@/services/api/reviewApi';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { t } from '../../i18n/appI18n';

const { TextArea } = Input;

function toList(data: any): any[] {
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export const ReviewCheckPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('initial');

  // 初核 (INITIAL_REVIEW)
  const [initialItems, setInitialItems] = useState<any[]>([]);
  const [initialFilter, setInitialFilter] = useState({ status: '' });
  const [initialActionModal, setInitialActionModal] = useState<{ type: string; item: any } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // 终核 (FINAL_REVIEW)
  const [finalItems, setFinalItems] = useState<any[]>([]);
  const [finalActionModal, setFinalActionModal] = useState<{ type: string; item: any } | null>(null);

  // 复审 (CO_SIGN_REVIEW)
  const [reviews, setReviews] = useState<any[]>([]);
  const [cosignPending, setCosignPending] = useState(0);

  // 分页
  const PAGE_SIZE = 10;
  const [initialPage, setInitialPage] = useState(1);
  const [finalPage, setFinalPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);

  // 加载 (真实报告状态机)
  const loadInitial = useCallback(async () => {
    try {
      const r = await reportApi.list({ state: 'INITIAL_REVIEW', take: '100' });
      if (r.success) setInitialItems(toList(r.data));
    } catch (e: any) { message.error(e.message); }
  }, []);

  const loadFinal = useCallback(async () => {
    try {
      const r = await reportApi.list({ state: 'FINAL_REVIEW', take: '100' });
      if (r.success) setFinalItems(toList(r.data));
    } catch (e: any) { message.error(e.message); }
  }, []);

  const loadReviews = useCallback(async () => {
    try {
      const r = await reportApi.list({ state: 'CO_SIGN_REVIEW', take: '100' });
      if (r.success) setReviews(toList(r.data));
      const c = await cosignApi.listPending({ pageSize: 100 });
      if (c.success) setCosignPending(Array.isArray(c.data) ? c.data.length : 0);
    } catch (e: any) { message.error(e.message); }
  }, []);

  useEffect(() => { loadInitial(); loadFinal(); loadReviews(); }, [loadInitial, loadFinal, loadReviews]);

  // 初核操作: 通过 → REVIEWED, 驳回 → REJECTED
  const handleInitialAction = async () => {
    if (!initialActionModal) return;
    const { type, item } = initialActionModal;
    setBusy(true);
    try {
      if (type === 'approve') {
        const r = await reportApi.review(item.id);
        if (r.success) { message.success(t('reviewCheck.opSuccess')); setInitialActionModal(null); setActionReason(''); loadInitial(); }
      } else if (type === 'reject') {
        const r = await reportApi.reject(item.id, actionReason || t('reviewCheck.initialReject'));
        if (r.success) { message.success(t('reviewCheck.opSuccess')); setInitialActionModal(null); setActionReason(''); loadInitial(); }
      }
    } catch (e: any) { message.error(e.message); }
    finally { setBusy(false); }
  };

  // 终核操作
  const handleFinalAction = async () => {
    if (!finalActionModal) return;
    const { type, item } = finalActionModal;
    setBusy(true);
    try {
      if (type === 'approve') {
        const r = await reportApi.review(item.id);
        if (r.success) { message.success(t('reviewCheck.opSuccess')); setFinalActionModal(null); setActionReason(''); loadFinal(); }
      } else if (type === 'reject') {
        const r = await reportApi.reject(item.id, actionReason || t('reviewCheck.finalReject'));
        if (r.success) { message.success(t('reviewCheck.opSuccess')); setFinalActionModal(null); setActionReason(''); loadFinal(); }
      }
    } catch (e: any) { message.error(e.message); }
    finally { setBusy(false); }
  };

  // 复审操作
  const handleReviewAction = async (id: string, type: string) => {
    setReviewActionBusy(true);
    try {
      if (type === 'approve') {
        const r = await reportApi.review(id);
        if (r.success) { message.success(t('reviewCheck.opSuccess')); loadReviews(); }
      } else if (type === 'reject') {
        const r = await reportApi.reject(id, t('reviewCheck.reviewReject'));
        if (r.success) { message.success(t('reviewCheck.opSuccess')); loadReviews(); }
      }
    } catch (e: any) { message.error(e.message); }
    finally { setReviewActionBusy(false); }
  };

  const filteredInitial = initialItems.filter((i: any) => !initialFilter.status || String(i.state ?? i.status) === initialFilter.status);
  const [busy, setBusy] = useState(false);
  const [reviewActionBusy, setReviewActionBusy] = useState(false);

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <ClipboardCheck size={20} color="var(--color-primary-600)" />
        <FileCheck size={20} color="#52c41a" />
        <Shield size={20} color="#722ed1" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('reviewCheck.title')}</span>
        <Tag color="cyan">{t('reviewCheck.tagStateMachine')}</Tag>
        <Tag color="green">{t('reviewCheck.tagReportFlow')}</Tag>
      </Space>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('reviewCheck.statInitialPending')} value={filteredInitial.length} color="warning" icon={<FileSearch size={18} />} />
        <StatCard title={t('reviewCheck.statFinalPending')} value={finalItems.length} color="primary" icon={<FileCheck size={18} />} />
        <StatCard title={t('reviewCheck.statReviewPending')} value={reviews.length} color="#722ed1" icon={<Shield size={18} />} />
        <StatCard title={t('reviewCheck.statCosignPending')} value={cosignPending} color="success" icon={<CheckCircle2 size={18} />} />
      </StatCardGrid>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 初核 */}
        <Tabs.TabPane tab={<span><FileSearch size={14} /> {t('reviewCheck.tabInitial')}</span>} key="initial">
          <Card
            title={`${t('reviewCheck.initialTasks')} (${filteredInitial.length})`}
            size="small"
            extra={
              <Space>
                <Select
                  size="small"
                  value={initialFilter.status || undefined}
                  onChange={v => setInitialFilter({ status: v })}
                  allowClear
                  placeholder={t('reviewCheck.status')}
                  style={{ width: 120 }}
                  options={[
                    { value: 'INITIAL_REVIEW', label: t('reviewCheck.statusPending') },
                    { value: 'REVIEWED', label: t('reviewCheck.statusApproved') },
                    { value: 'REJECTED', label: t('reviewCheck.statusRejected') },
                  ]}
                />
                <Button icon={<RefreshCw size={12} />} onClick={loadInitial}>{t('reviewCheck.refresh')}</Button>
              </Space>
            }
          >
            <DataTable scroll={{ x: 'max-content' }}
              dataSource={filteredInitial}
              rowKey={(r) => r.id ?? r.reportId ?? ''}
              pagination={{ current: initialPage, pageSize: PAGE_SIZE, total: filteredInitial.length, onChange: setInitialPage, showSizeChanger: false }}
              columns={[
                { title: t('reviewCheck.colReportId'), key: 'id', render: (_, r) => r.reportId ?? r.id },
                { title: t('reviewCheck.colPatient'), dataIndex: 'patientName' },
                { title: t('reviewCheck.colModality'), dataIndex: 'modality' },
                { title: t('reviewCheck.colStatus'), dataIndex: 'state', render: (s) => <Tag color={s === 'REVIEWED' ? 'green' : s === 'REJECTED' ? 'red' : 'orange'}>{s ?? '-'}</Tag> },
                { title: t('reviewCheck.colCreated'), key: 'at', render: (_, r) => r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN') : '-' },
                {
                  title: t('reviewCheck.colAction'),
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} onClick={() => setInitialActionModal({ type: 'approve', item })}>{t('reviewCheck.approve')}</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} onClick={() => setInitialActionModal({ type: 'reject', item })}>{t('reviewCheck.reject')}</Button>
                    </Space>
                  ),
                },
              ]}
           
            />
          </Card>
        </Tabs.TabPane>

        {/* 终核 */}
        <Tabs.TabPane tab={<span><FileCheck size={14} /> {t('reviewCheck.tabFinal')}</span>} key="final">
          <Card
            title={`${t('reviewCheck.finalTasks')} (${finalItems.length})`}
            size="small"
            extra={
              <Space>
                <Button icon={<RefreshCw size={12} />} onClick={loadFinal}>{t('reviewCheck.refresh')}</Button>
              </Space>
            }
          >
            <DataTable scroll={{ x: 'max-content' }}
              dataSource={finalItems}
              rowKey={(r) => r.id ?? r.reportId ?? ''}
              pagination={{ current: finalPage, pageSize: PAGE_SIZE, total: finalItems.length, onChange: setFinalPage, showSizeChanger: false }}
              columns={[
                { title: t('reviewCheck.colReportId'), key: 'id', render: (_, r) => r.reportId ?? r.id },
                { title: t('reviewCheck.colPatient'), dataIndex: 'patientName' },
                { title: t('reviewCheck.colStatus'), dataIndex: 'state', render: (s) => <Tag color={s === 'REVIEWED' ? 'green' : 'orange'}>{s ?? '-'}</Tag> },
                { title: t('reviewCheck.colCreated'), key: 'at', render: (_, r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('zh-CN') : '-' },
                {
                  title: t('reviewCheck.colAction'),
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} onClick={() => setFinalActionModal({ type: 'approve', item })}>{t('reviewCheck.approve')}</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} onClick={() => setFinalActionModal({ type: 'reject', item })}>{t('reviewCheck.reject')}</Button>
                    </Space>
                  ),
                },
              ]}
           
            />
          </Card>
        </Tabs.TabPane>

        {/* 复审 */}
        <Tabs.TabPane tab={<span><Shield size={14} /> {t('reviewCheck.tabReview')}</span>} key="review">
          <Card
            title={t('reviewCheck.reviewTasks')}
            size="small"
            extra={<Button icon={<RefreshCw size={12} />} onClick={loadReviews}>{t('reviewCheck.refresh')}</Button>}
          >
            <DataTable scroll={{ x: 'max-content' }}
              dataSource={reviews}
              rowKey={(r) => r.id ?? r.reportId ?? ''}
              pagination={{ current: reviewPage, pageSize: PAGE_SIZE, total: reviews.length, onChange: setReviewPage, showSizeChanger: false }}
              columns={[
                { title: t('reviewCheck.colReportId'), key: 'id', render: (_, r) => r.reportId ?? r.id },
                { title: t('reviewCheck.colPatient'), dataIndex: 'patientName' },
                { title: t('reviewCheck.colModality'), dataIndex: 'modality' },
                { title: t('reviewCheck.colStatus'), dataIndex: 'state', render: (s) => <Tag color={s === 'REVIEWED' ? 'green' : s === 'REJECTED' ? 'red' : 'orange'}>{s ?? '-'}</Tag> },
                {
                  title: t('reviewCheck.colAction'),
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} loading={reviewActionBusy} disabled={reviewActionBusy} onClick={() => handleReviewAction(item.id, 'approve')}>{t('reviewCheck.approve')}</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} loading={reviewActionBusy} disabled={reviewActionBusy} onClick={() => handleReviewAction(item.id, 'reject')}>{t('reviewCheck.reject')}</Button>
                    </Space>
                  ),
                },
              ]}
           
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* 初核操作 Modal */}
      <Modal
        title={`${t('reviewCheck.initialModal')} - ${initialActionModal?.type === 'approve' ? t('reviewCheck.approve') : t('reviewCheck.reject')}`}
        open={!!initialActionModal}
        onCancel={() => setInitialActionModal(null)}
        onOk={handleInitialAction}
        confirmLoading={busy}
      >
        {initialActionModal && (
          <div>
            <AlertTitle text={`${t('reviewCheck.reportPrefix')} ${initialActionModal.item.reportId ?? initialActionModal.item.id} | ${initialActionModal.item.patientName ?? '-'}`} />
            {initialActionModal.type === 'reject' && (
              <Form.Item label={t('reviewCheck.rejectReason')}>
                <TextArea rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} />
              </Form.Item>
            )}
          </div>
        )}
      </Modal>

      {/* 终核操作 Modal */}
      <Modal
        title={`${t('reviewCheck.finalModal')} - ${finalActionModal?.type === 'approve' ? t('reviewCheck.approve') : t('reviewCheck.reject')}`}
        open={!!finalActionModal}
        onCancel={() => setFinalActionModal(null)}
        onOk={handleFinalAction}
        confirmLoading={busy}
      >
        {finalActionModal && (
          <div>
            <AlertTitle text={`${t('reviewCheck.reportPrefix')} ${finalActionModal.item.reportId ?? finalActionModal.item.id}`} />
            {finalActionModal.type === 'reject' && (
              <Form.Item label={t('reviewCheck.rejectReason')}>
                <TextArea rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} />
              </Form.Item>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

function AlertTitle({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, fontSize: 12 }}>
      <PenTool size={12} style={{ marginRight: 6, color: 'var(--color-primary-600)' }} />
      {text}
    </div>
  );
}

export default ReviewCheckPage;

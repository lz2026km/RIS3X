// [v3.0.6.11-81] W1-B P0: 初核 + 终核 + 复审综合页面 (真实后端化)
// 背景: 后端无 /review /reviews 端点 (初核/终核/复审 仅存在于 MSW mock)。
// 处理: 改用真实报告状态机 (reports.controller):
//   初核 → GET /reports?state=INITIAL_REVIEW
//   终核 → GET /reports?state=FINAL_REVIEW
//   复审 → GET /reports?state=CO_SIGN_REVIEW
//   通过 → POST /reports/:id/transition (REVIEWED); 驳回 → transition (REJECTED)
//   双签待办 → GET /cosign/pending (cosign.controller)
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Select, Input, Form, Row, Col, message, Tabs, Statistic, Modal, Table } from 'antd';
import { CheckCircle2, XCircle, FileSearch, Shield, RefreshCw, ClipboardCheck, FileCheck, PenTool } from 'lucide-react';
import { reportApi } from '@/services/api/reportApi';
import { cosignApi } from '@/services/api/reviewApi';

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
        if (r.success) { message.success('操作成功'); setInitialActionModal(null); setActionReason(''); loadInitial(); }
      } else if (type === 'reject') {
        const r = await reportApi.reject(item.id, actionReason || '初核驳回');
        if (r.success) { message.success('操作成功'); setInitialActionModal(null); setActionReason(''); loadInitial(); }
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
        if (r.success) { message.success('操作成功'); setFinalActionModal(null); setActionReason(''); loadFinal(); }
      } else if (type === 'reject') {
        const r = await reportApi.reject(item.id, actionReason || '终核驳回');
        if (r.success) { message.success('操作成功'); setFinalActionModal(null); setActionReason(''); loadFinal(); }
      }
    } catch (e: any) { message.error(e.message); }
    finally { setBusy(false); }
  };

  // 复审操作
  const handleReviewAction = async (id: string, type: string) => {
    try {
      if (type === 'approve') {
        const r = await reportApi.review(id);
        if (r.success) { message.success('操作成功'); loadReviews(); }
      } else if (type === 'reject') {
        const r = await reportApi.reject(id, '复审驳回');
        if (r.success) { message.success('操作成功'); loadReviews(); }
      }
    } catch (e: any) { message.error(e.message); }
  };

  const filteredInitial = initialItems.filter((i: any) => !initialFilter.status || String(i.state ?? i.status) === initialFilter.status);
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <ClipboardCheck size={20} color="#2563eb" />
        <FileCheck size={20} color="#52c41a" />
        <Shield size={20} color="#722ed1" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>初核 · 终核 · 复审</span>
        <Tag color="cyan">W1-B (v3.0.6.11-81) 真实状态机</Tag>
        <Tag color="green">reports INITIAL/FINAL/CO_SIGN_REVIEW</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}><Card size="small"><Statistic title="初核待审" value={filteredInitial.length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="终核待审" value={finalItems.length} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="复审待审" value={reviews.length} styles={{ content: { color: '#722ed1' } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="双签待办" value={cosignPending} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 初核 */}
        <Tabs.TabPane tab={<span><FileSearch size={14} /> 初核 (INITIAL_REVIEW)</span>} key="initial">
          <Card
            title={`初核任务 (${filteredInitial.length})`}
            size="small"
            extra={
              <Space>
                <Select
                  size="small"
                  value={initialFilter.status || undefined}
                  onChange={v => setInitialFilter({ status: v })}
                  allowClear
                  placeholder="状态"
                  style={{ width: 120 }}
                  options={[
                    { value: 'INITIAL_REVIEW', label: '待审' },
                    { value: 'REVIEWED', label: '已通过' },
                    { value: 'REJECTED', label: '已驳回' },
                  ]}
                />
                <Button icon={<RefreshCw size={12} />} onClick={loadInitial}>刷新</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredInitial}
              rowKey={(r) => r.id ?? r.reportId ?? ''}
              pagination={{ current: initialPage, pageSize: PAGE_SIZE, total: filteredInitial.length, onChange: setInitialPage, showSizeChanger: false }}
              columns={[
                { title: '报告 ID', key: 'id', render: (_, r) => r.reportId ?? r.id },
                { title: '患者', dataIndex: 'patientName' },
                { title: '模态', dataIndex: 'modality' },
                { title: '状态', dataIndex: 'state', render: (s) => <Tag color={s === 'REVIEWED' ? 'green' : s === 'REJECTED' ? 'red' : 'orange'}>{s ?? '-'}</Tag> },
                { title: '创建', key: 'at', render: (_, r) => r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN') : '-' },
                {
                  title: '操作',
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} onClick={() => setInitialActionModal({ type: 'approve', item })}>通过</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} onClick={() => setInitialActionModal({ type: 'reject', item })}>驳回</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>

        {/* 终核 */}
        <Tabs.TabPane tab={<span><FileCheck size={14} /> 终核 (FINAL_REVIEW)</span>} key="final">
          <Card
            title={`终核任务 (${finalItems.length})`}
            size="small"
            extra={
              <Space>
                <Button icon={<RefreshCw size={12} />} onClick={loadFinal}>刷新</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={finalItems}
              rowKey={(r) => r.id ?? r.reportId ?? ''}
              pagination={{ current: finalPage, pageSize: PAGE_SIZE, total: finalItems.length, onChange: setFinalPage, showSizeChanger: false }}
              columns={[
                { title: '报告 ID', key: 'id', render: (_, r) => r.reportId ?? r.id },
                { title: '患者', dataIndex: 'patientName' },
                { title: '状态', dataIndex: 'state', render: (s) => <Tag color={s === 'REVIEWED' ? 'green' : 'orange'}>{s ?? '-'}</Tag> },
                { title: '创建', key: 'at', render: (_, r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('zh-CN') : '-' },
                {
                  title: '操作',
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} onClick={() => setFinalActionModal({ type: 'approve', item })}>通过</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} onClick={() => setFinalActionModal({ type: 'reject', item })}>驳回</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>

        {/* 复审 */}
        <Tabs.TabPane tab={<span><Shield size={14} /> 复审 (CO_SIGN_REVIEW)</span>} key="review">
          <Card
            title="复审任务"
            size="small"
            extra={<Button icon={<RefreshCw size={12} />} onClick={loadReviews}>刷新</Button>}
          >
            <Table
              size="small"
              dataSource={reviews}
              rowKey={(r) => r.id ?? r.reportId ?? ''}
              pagination={{ current: reviewPage, pageSize: PAGE_SIZE, total: reviews.length, onChange: setReviewPage, showSizeChanger: false }}
              columns={[
                { title: '报告 ID', key: 'id', render: (_, r) => r.reportId ?? r.id },
                { title: '患者', dataIndex: 'patientName' },
                { title: '模态', dataIndex: 'modality' },
                { title: '状态', dataIndex: 'state', render: (s) => <Tag color={s === 'REVIEWED' ? 'green' : s === 'REJECTED' ? 'red' : 'orange'}>{s ?? '-'}</Tag> },
                {
                  title: '操作',
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} onClick={() => handleReviewAction(item.id, 'approve')}>通过</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} onClick={() => handleReviewAction(item.id, 'reject')}>驳回</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* 初核操作 Modal */}
      <Modal
        title={`初核 - ${initialActionModal?.type === 'approve' ? '通过' : '驳回'}`}
        open={!!initialActionModal}
        onCancel={() => setInitialActionModal(null)}
        onOk={handleInitialAction}
        confirmLoading={busy}
      >
        {initialActionModal && (
          <div>
            <AlertTitle text={`报告: ${initialActionModal.item.reportId ?? initialActionModal.item.id} | ${initialActionModal.item.patientName ?? '-'}`} />
            {initialActionModal.type === 'reject' && (
              <Form.Item label="驳回原因">
                <TextArea rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} />
              </Form.Item>
            )}
          </div>
        )}
      </Modal>

      {/* 终核操作 Modal */}
      <Modal
        title={`终核 - ${finalActionModal?.type === 'approve' ? '通过' : '驳回'}`}
        open={!!finalActionModal}
        onCancel={() => setFinalActionModal(null)}
        onOk={handleFinalAction}
        confirmLoading={busy}
      >
        {finalActionModal && (
          <div>
            <AlertTitle text={`报告: ${finalActionModal.item.reportId ?? finalActionModal.item.id}`} />
            {finalActionModal.type === 'reject' && (
              <Form.Item label="驳回原因">
                <TextArea rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} />
              </Form.Item>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

function AlertTitle({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, fontSize: 13 }}>
      <PenTool size={12} style={{ marginRight: 6, color: '#2563eb' }} />
      {text}
    </div>
  );
}

export default ReviewCheckPage;

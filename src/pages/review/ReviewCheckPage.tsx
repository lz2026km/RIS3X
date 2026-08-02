// [v3.0.6.8-48] PR4: 初核 + 终核 + 复审综合页面
import React, { useState, useEffect } from 'react';
import {
  Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message,
  Tabs, List, Empty, Statistic, Alert, InputNumber, Modal, Badge, Timeline,
  Table, Drawer, Descriptions, Switch, Tooltip, Avatar, Steps, Progress,
} from 'antd';
import {
  CheckCircle2, XCircle, FileSearch, Eye, Shield, Users, Activity,
  Clock, AlertTriangle, ChevronRight, Save, X, RefreshCw, Plus,
  Filter, ClipboardCheck, FileCheck, AlertCircle, BarChart3, History, Send,
} from 'lucide-react';
import { initialCheckApi, finalCheckApi, reviewApi } from '@/services/api/reviewApi';

const { TextArea } = Input;

export const ReviewCheckPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('initial');
  // 初核
  const [initialItems, setInitialItems] = useState<any[]>([]);
  const [initialSummary, setInitialSummary] = useState<any>(null);
  const [initialFilter, setInitialFilter] = useState({ status: '' });
  const [initialDetail, setInitialDetail] = useState<any>(null);
  const [initialActionModal, setInitialActionModal] = useState<{ type: string; item: any } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // 终核
  const [finalItems, setFinalItems] = useState<any[]>([]);
  const [finalSummary, setFinalSummary] = useState<any>(null);
  const [finalDetail, setFinalDetail] = useState<any>(null);
  const [finalActionModal, setFinalActionModal] = useState<{ type: string; item: any } | null>(null);
  const [scoreValue, setScoreValue] = useState(85);

  // 复审
  const [reviews, setReviews] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any>(null);
  const [sla, setSla] = useState<any>(null);

  // 加载
  const loadInitial = async () => {
    try {
      const r = await initialCheckApi.list({ pageSize: 30 });
      if (r.success) setInitialItems(r.data);
      const s = await initialCheckApi.summary();
      if (s.success) setInitialSummary(s.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadFinal = async () => {
    try {
      const r = await finalCheckApi.list({ pageSize: 30 });
      if (r.success) setFinalItems(r.data);
      const s = await finalCheckApi.summary();
      if (s.success) setFinalSummary(s.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadReviews = async () => {
    try {
      const r = await reviewApi.list({ pageSize: 30 });
      if (r.success) setReviews(r.data);
      const w = await reviewApi.workload();
      if (w.success) setWorkload(w.data);
      const s = await reviewApi.sla();
      if (s.success) setSla(s.data);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { loadInitial(); loadFinal(); loadReviews(); }, []);

  // 初核操作
  const handleInitialAction = async () => {
    if (!initialActionModal) return;
    const { type, item } = initialActionModal;
    setBusy(true);
    try {
      let r;
      if (type === 'approve') r = await initialCheckApi.approve(item.id, { note: actionReason });
      else if (type === 'reject') r = await initialCheckApi.reject(item.id, { reason: actionReason });
      else if (type === 'override') r = await initialCheckApi.override(item.id, { reason: actionReason });
      if (r.success) { message.success('操作成功'); setInitialActionModal(null); setActionReason(''); loadInitial(); }
    } catch (e: any) { message.error(e.message); }
    finally { setBusy(false); }
  };

  // 终核操作
  const handleFinalAction = async () => {
    if (!finalActionModal) return;
    const { type, item } = finalActionModal;
    setBusy(true);
    try {
      let r;
      if (type === 'score') r = await finalCheckApi.score(item.id, { score: scoreValue });
      else if (type === 'approve') r = await finalCheckApi.approve(item.id, { finalNote: actionReason });
      else if (type === 'reject') r = await finalCheckApi.reject(item.id, { reason: actionReason, requiredChanges: [] });
      if (r.success) { message.success('操作成功'); setFinalActionModal(null); setActionReason(''); loadFinal(); }
    } catch (e: any) { message.error(e.message); }
    finally { setBusy(false); }
  };

  // 复审操作
  const handleReviewAction = async (id: string, type: string) => {
    try {
      let r;
      if (type === 'approve') r = await reviewApi.approve(id, { note: 'approved' });
      else if (type === 'reject') r = await reviewApi.reject(id, { reason: 'test reject' });
      if (r.success) { message.success('操作成功'); loadReviews(); }
    } catch (e: any) { message.error(e.message); }
  };

  const filteredInitial = initialItems.filter((i: any) => !initialFilter.status || i.status === initialFilter.status);
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <ClipboardCheck size={20} color="#1677ff" />
        <FileCheck size={20} color="#52c41a" />
        <Shield size={20} color="#722ed1" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>初核 · 终核 · 复审</span>
        <Tag color="cyan">PR4 (v3.0.6.8-48)</Tag>
        <Tag color="purple">Medisoft mediSIGHT 对标</Tag>
        <Tag color="green">15 client + 41 端点</Tag>
      </Space>

      {initialSummary && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={5}><Card size="small"><Statistic title="初核待审" value={initialSummary.pending} styles={{ content: {  color: '#faad14'  } }} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="初核已通过" value={initialSummary.approved} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="终核已通过" value={finalSummary?.approved || 0} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
          <Col span={5}><Card size="small"><Statistic title="复审工作量" value={workload?.pending || 0} styles={{ content: {  color: '#1677ff'  } }} /></Card></Col>
        </Row>
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 初核 */}
        <Tabs.TabPane tab={<span><FileSearch size={14} /> 初核 (21 端点)</span>} key="initial">
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
                    { value: 'pending', label: '待审' },
                    { value: 'approved', label: '已通过' },
                    { value: 'rejected', label: '已驳回' },
                    { value: 'overridden', label: '已覆盖' },
                  ]}
                />
                <Button icon={<RefreshCw size={12} />} onClick={loadInitial}>刷新</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredInitial}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '报告 ID', dataIndex: 'reportId' },
                { title: '患者', dataIndex: 'patientName' },
                { title: '模态', dataIndex: 'modality' },
                { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'orange'}>{s}</Tag> },
                { title: '检查项', render: (_, i) => `${i.checkItems?.filter((c: any) => c.passed).length || 0}/${i.checkItems?.length || 0}` },
                { title: '审阅人', dataIndex: 'reviewerName' },
                { title: '时间', dataIndex: 'createdAt', render: (d) => new Date(d).toLocaleString('zh-CN') },
                {
                  title: '操作',
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} disabled={item.status !== 'pending'} onClick={() => setInitialActionModal({ type: 'approve', item })}>通过</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} disabled={item.status !== 'pending'} onClick={() => setInitialActionModal({ type: 'reject', item })}>驳回</Button>
                      <Button type="link" size="small" icon={<AlertTriangle size={12} />} disabled={item.status !== 'pending'} onClick={() => setInitialActionModal({ type: 'override', item })}>覆盖</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Tabs.TabPane>

        {/* 终核 */}
        <Tabs.TabPane tab={<span><FileCheck size={14} /> 终核 (20 端点)</span>} key="final">
          <Card
            title={`终核任务 (${finalItems.length})`}
            size="small"
            extra={
              <Space>
                <Statistic title="平均评分" value={finalSummary?.avgScore || 0} styles={{ content: {  color: '#52c41a', fontSize: 14  } }} />
                <Statistic title="平均 TAT" value={(finalSummary?.avgTAT || 0).toFixed(1)} suffix="h" styles={{ content: {  color: '#1677ff', fontSize: 14  } }} />
                <Button icon={<RefreshCw size={12} />} onClick={loadFinal}>刷新</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={finalItems}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '报告 ID', dataIndex: 'reportId' },
                { title: '模板', dataIndex: 'templateName' },
                { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'approved' ? 'green' : 'orange'}>{s}</Tag> },
                { title: '优先级', dataIndex: 'priority', render: (p) => <Tag color={p === 'urgent' ? 'red' : p === 'high' ? 'orange' : 'default'}>{p}</Tag> },
                { title: '评分', dataIndex: 'score' },
                { title: '审阅人', dataIndex: 'reviewerId' },
                { title: '创建', dataIndex: 'createdAt', render: (d) => new Date(d).toLocaleDateString('zh-CN') },
                {
                  title: '操作',
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" onClick={() => { setScoreValue(85); setFinalActionModal({ type: 'score', item }); }}>评分</Button>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} disabled={item.status === 'approved'} onClick={() => setFinalActionModal({ type: 'approve', item })}>通过</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} disabled={item.status === 'approved'} onClick={() => setFinalActionModal({ type: 'reject', item })}>驳回</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Tabs.TabPane>

        {/* 复审 */}
        <Tabs.TabPane tab={<span><Shield size={14} /> 复审 (14 端点)</span>} key="review">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="总任务" value={reviews.length} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="待审" value={reviews.filter(r => r.status === 'pending').length} styles={{ content: {  color: '#faad14'  } }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="已完成" value={reviews.filter(r => r.status === 'approved').length} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="SLA 达成" value={sla ? `${sla.onTime}/${sla.total}` : '-'} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
          </Row>
          <Card
            title="复审任务"
            size="small"
            extra={<Button icon={<RefreshCw size={12} />} onClick={loadReviews}>刷新</Button>}
          >
            <Table
              size="small"
              dataSource={reviews}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '编号', dataIndex: 'id' },
                { title: '类型', dataIndex: 'type', render: (t) => <Tag color="blue">{t}</Tag> },
                { title: '报告', dataIndex: 'reportId' },
                { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'orange'}>{s}</Tag> },
                { title: '优先级', dataIndex: 'priority', render: (p) => <Tag color={p === 'urgent' ? 'red' : p === 'high' ? 'orange' : 'default'}>{p}</Tag> },
                { title: '指派', dataIndex: 'assigneeName' },
                { title: 'SLA 剩余', render: (_, r) => <span style={{ color: r.sla?.breached ? '#ff4d4f' : '#52c41a' }}>{r.sla?.remaining || 0}h</span> },
                {
                  title: '操作',
                  render: (_, item) => (
                    <Space>
                      <Button type="link" size="small" icon={<CheckCircle2 size={12} />} disabled={item.status === 'approved'} onClick={() => handleReviewAction(item.id, 'approve')}>通过</Button>
                      <Button type="link" danger size="small" icon={<XCircle size={12} />} disabled={item.status === 'approved'} onClick={() => handleReviewAction(item.id, 'reject')}>驳回</Button>
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
        title={`初核 - ${initialActionModal?.type}`}
        open={!!initialActionModal}
        onCancel={() => setInitialActionModal(null)}
        onOk={handleInitialAction}
        confirmLoading={busy}
      >
        {initialActionModal && (
          <div>
            <Alert title={`报告: ${initialActionModal.item.reportId} | ${initialActionModal.item.patientName}`} type="info" showIcon style={{ marginBottom: 12 }} />
            <Form.Item label="原因/备注">
              <TextArea rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} />
            </Form.Item>
          </div>
        )}
      </Modal>

      {/* 终核操作 Modal */}
      <Modal
        title={`终核 - ${finalActionModal?.type}`}
        open={!!finalActionModal}
        onCancel={() => setFinalActionModal(null)}
        onOk={handleFinalAction}
        confirmLoading={busy}
      >
        {finalActionModal && (
          <div>
            <Alert title={`报告: ${finalActionModal.item.reportId}`} type="info" showIcon style={{ marginBottom: 12 }} />
            {finalActionModal.type === 'score' && (
              <Form.Item label="评分 (0-100)">
                <InputNumber min={0} max={100} value={scoreValue} onChange={v => setScoreValue(v || 85)} style={{ width: '100%' }} />
              </Form.Item>
            )}
            {finalActionModal.type !== 'score' && (
              <Form.Item label="备注">
                <TextArea rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} />
              </Form.Item>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReviewCheckPage;

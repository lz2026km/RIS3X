// [v3.0.6.8-49] PR5: CA 签名 + 修订综合页面
import React, { useState, useEffect } from 'react';
import {
  Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message,
  Tabs, List, Empty, Statistic, Alert, InputNumber, Modal, Timeline,
  Table, Drawer, Descriptions, Switch, Tooltip, Avatar, Steps, Progress, Badge,
} from 'antd';
import {
  Shield, FileSignature, Key, Link2, Edit3, History, CheckCircle2, XCircle,
  ChevronRight, Save, X, RefreshCw, Plus, Send, ShieldCheck, Award, Clock,
  AlertTriangle, Hash, Activity, Lock, QrCode, Stamp, FileCheck, Search,
} from 'lucide-react';
import { signApi, amendApi } from '@/services/api/signAmendApi';

const { TextArea } = Input;

export const SignAmendPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cert');
  // CA 证书
  const [certs, setCerts] = useState<any[]>([]);
  const [certFilter, setCertFilter] = useState({ status: '' });
  const [certModal, setCertModal] = useState<{ type: 'apply' | 'revoke' | 'sign' | 'verify' | null; data: any }>({ type: null, data: {} });
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [chainProof, setChainProof] = useState<any>(null);

  // 修订
  const [amends, setAmends] = useState<any[]>([]);
  const [amendFilter, setAmendFilter] = useState({ status: '' });
  const [amendModal, setAmendModal] = useState<{ type: 'start' | 'complete' | 'approve' | 'reject' | 'history' | null; data: any }>({ type: null, data: {} });
  const [amendHistory, setAmendHistory] = useState<any>(null);

  // 加载
  const loadCerts = async () => {
    try {
      const r = await signApi.listCertificates({ pageSize: 30 });
      if (r.success) setCerts(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadAmends = async () => {
    try {
      const r = await amendApi.listAmendments({ pageSize: 30 });
      if (r.success) setAmends(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { loadCerts(); loadAmends(); }, []);

  // CA 操作
  const handleCertApply = async () => {
    try {
      const r = await signApi.requestCertificate(certModal.data);
      if (r.success) { message.success('申请成功'); setCertModal({ type: null, data: {} }); loadCerts(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleRevoke = async () => {
    if (!certModal.data.id) return;
    try {
      const r = await signApi.revokeCertificate(certModal.data.id, { reason: certModal.data.reason || 'admin revoke' });
      if (r.success) { message.success('吊销成功'); setCertModal({ type: null, data: {} }); loadCerts(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleSign = async () => {
    try {
      const r = await signApi.signReport(certModal.data.reportId, { certificateId: certModal.data.certId, reportHash: 'mock-hash-' + Date.now() });
      if (r.success) { message.success('签名成功: ' + r.data.signatureHash.slice(0, 12)); setCertModal({ type: null, data: {} }); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleVerify = async () => {
    if (!certModal.data.signatureHash) return message.warning('请输入签名 hash');
    try {
      const r = await signApi.verifySignature(certModal.data.signatureHash);
      if (r.success) { setVerifyResult(r.data); message.success(r.data.valid ? '签名有效' : '签名无效'); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleTimestamp = async () => {
    try {
      const r = await signApi.issueTimestamp({ dataHash: 'mock-' + Date.now(), reportId: certModal.data.reportId });
      if (r.success) { message.success('时间戳: ' + r.data.timestamp); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleChainProof = async () => {
    if (!certModal.data.reportId) return;
    try {
      const r = await signApi.getBlockchainProof(certModal.data.reportId);
      if (r.success) { setChainProof(r.data); message.success('区块链存证: ' + r.data.txHash.slice(0, 12)); }
    } catch (e: any) { message.error(e.message); }
  };

  // 修订操作
  const handleAmendStart = async () => {
    if (!amendModal.data.reportId || !amendModal.data.reason) return message.warning('请填写报告 ID 和原因');
    try {
      const r = await amendApi.startAmendment(amendModal.data.reportId, { reason: amendModal.data.reason });
      if (r.success) { message.success('修订已启动'); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendComplete = async () => {
    if (!amendModal.data.id) return;
    try {
      const r = await amendApi.completeAmendment(amendModal.data.id, { finalReason: amendModal.data.reason, changes: amendModal.data.changes || '已修订' });
      if (r.success) { message.success('修订完成'); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendApprove = async () => {
    if (!amendModal.data.id) return;
    try {
      const r = await amendApi.approveAmendment(amendModal.data.id, { comment: amendModal.data.comment });
      if (r.success) { message.success('已批准'); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendReject = async () => {
    if (!amendModal.data.id) return;
    try {
      const r = await amendApi.rejectAmendment(amendModal.data.id, { reason: amendModal.data.reason });
      if (r.success) { message.success('已驳回'); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendHistory = async () => {
    if (!amendModal.data.reportId) return;
    try {
      const r = await amendApi.getAmendmentHistory(amendModal.data.reportId);
      if (r.success) { setAmendHistory(r.data); }
    } catch (e: any) { message.error(e.message); }
  };

  const filteredCerts = certs.filter((c: any) => !certFilter.status || c.status === certFilter.status);
  const filteredAmends = amends.filter((a: any) => !amendFilter.status || a.status === amendFilter.status);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Shield size={20} color="#1677ff" />
        <Edit3 size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>CA 签名 + 修订</span>
        <Tag color="cyan">PR5 (v3.0.6.8-49)</Tag>
        <Tag color="purple">Nuance/GE Centricity 对标</Tag>
        <Tag color="green">15 client + 77 端点</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="有效证书" value={certs.filter(c => c.status === 'valid').length} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已过期" value={certs.filter(c => c.status === 'expired').length} styles={{ content: {  color: '#faad14'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已吊销" value={certs.filter(c => c.status === 'revoked').length} styles={{ content: {  color: '#ff4d4f'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="修订中" value={amends.filter(a => a.status === 'in_progress').length} styles={{ content: {  color: '#1677ff'  } }} /></Card></Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* CA 证书管理 */}
        <Tabs.TabPane tab={<span><Shield size={14} /> CA 证书 (44 端点)</span>} key="cert">
          <Card
            title={`数字证书 (${filteredCerts.length})`}
            size="small"
            extra={
              <Space>
                <Select size="small" value={certFilter.status || undefined} onChange={v => setCertFilter({ status: v })} allowClear placeholder="状态" style={{ width: 120 }} options={[
                  { value: 'valid', label: '有效' },
                  { value: 'expired', label: '已过期' },
                  { value: 'revoked', label: '已吊销' },
                  { value: 'suspended', label: '已暂停' },
                ]} />
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setCertModal({ type: 'apply', data: { algorithm: 'SM2' } })}>申请证书</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredCerts}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '序列号', dataIndex: 'serialNumber' },
                { title: '持卡人', render: (_, c) => c.subject.commonName },
                { title: '部门', render: (_, c) => c.subject.department },
                { title: '算法', dataIndex: 'algorithm' },
                { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'valid' ? 'green' : s === 'expired' ? 'orange' : 'red'}>{s}</Tag> },
                { title: '有效期', render: (_, c) => `${c.validFrom?.slice(0,10)} ~ ${c.validTo?.slice(0,10)}` },
                {
                  title: '操作',
                  render: (_, c) => (
                    <Space>
                      <Button type="link" size="small" icon={<FileSignature size={12} />} onClick={() => setCertModal({ type: 'sign', data: { certId: c.id, reportId: 'RPT-001' } })}>签名</Button>
                      <Button type="link" size="small" icon={<Link2 size={12} />} onClick={() => setCertModal({ type: 'verify', data: { signatureHash: '' } })}>验证</Button>
                      <Button type="link" size="small" icon={<Lock size={12} />} onClick={() => setCertModal({ type: 'revoke', data: c })} danger>吊销</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          {/* 区块链存证演示 */}
          <Card title="区块链存证" size="small" style={{ marginTop: 16 }}>
            <Space>
              <Input placeholder="报告 ID (如 RPT-001)" value={certModal.data.reportId || ''} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, reportId: e.target.value } })} style={{ width: 300 }} />
              <Button icon={<Link2 size={14} />} onClick={handleChainProof}>查询存证</Button>
              <Button icon={<Stamp size={14} />} onClick={handleTimestamp}>签发时间戳</Button>
            </Space>
            {chainProof && (
              <Alert
                style={{ marginTop: 12 }}
                type="success"
                title={`区块链存证: TxHash ${chainProof.txHash?.slice(0, 16)}...`}
                description={
                  <div>
                    <div>报告: {chainProof.reportId}</div>
                    <div>区块: #{chainProof.blockNumber} on {chainProof.chain}</div>
                    <div>时间: {chainProof.createdAt}</div>
                  </div>
                }
                showIcon
              />
            )}
          </Card>
        </Tabs.TabPane>

        {/* 报告修订 */}
        <Tabs.TabPane tab={<span><Edit3 size={14} /> 报告修订 (33 端点)</span>} key="amend">
          <Card
            title={`修订记录 (${filteredAmends.length})`}
            size="small"
            extra={
              <Space>
                <Select size="small" value={amendFilter.status || undefined} onChange={v => setAmendFilter({ status: v })} allowClear placeholder="状态" style={{ width: 120 }} options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'in_progress', label: '进行中' },
                  { value: 'completed', label: '完成' },
                  { value: 'rejected', label: '已驳回' },
                ]} />
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setAmendModal({ type: 'start', data: {} })}>发起修订</Button>
                <Button size="small" icon={<History size={12} />} onClick={() => setAmendModal({ type: 'history', data: { reportId: 'RPT-001' } })}>历史</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredAmends}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: '报告', dataIndex: 'reportId' },
                { title: '版本', dataIndex: 'version' },
                { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'completed' ? 'green' : s === 'in_progress' ? 'blue' : s === 'rejected' ? 'red' : 'orange'}>{s}</Tag> },
                { title: '原因', dataIndex: 'reason', ellipsis: true },
                { title: '作者', dataIndex: 'authorName' },
                { title: '时间', render: (_, a) => a.startTime?.slice(0,16) },
                {
                  title: '操作',
                  render: (_, a) => (
                    <Space>
                      <Button type="link" size="small" onClick={() => setAmendModal({ type: 'complete', data: a })} disabled={a.status === 'completed'}>完成</Button>
                      <Button type="link" size="small" onClick={() => setAmendModal({ type: 'approve', data: a })} disabled={a.status === 'completed'}>批准</Button>
                      <Button type="link" danger size="small" onClick={() => setAmendModal({ type: 'reject', data: a })}>驳回</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          {amendHistory && (
            <Card title={`修订历史: ${amendHistory.reportId}`} size="small" style={{ marginTop: 16 }}>
              <Timeline
                items={(amendHistory.history || []).map((a: any) => ({
                  color: a.status === 'completed' ? 'green' : a.status === 'rejected' ? 'red' : 'blue',
                  children: <div><Tag color="blue">v{a.version}</Tag> {a.authorName} - {a.status} - {a.reason} <span style={{ color: '#999' }}>· {a.startTime?.slice(0, 16)}</span></div>,
                }))}
              />
            </Card>
          )}
        </Tabs.TabPane>
      </Tabs>

      {/* 证书申请/吊销/签名/验证 Modal */}
      <Modal
        title={
          certModal.type === 'apply' ? '申请数字证书' :
          certModal.type === 'revoke' ? '吊销证书' :
          certModal.type === 'sign' ? '报告 CA 签名' :
          certModal.type === 'verify' ? '验证签名' : ''
        }
        open={!!certModal.type && certModal.type !== 'history' && certModal.type !== 'verify' || (certModal.type === 'verify' && verifyResult)}
        onCancel={() => { setCertModal({ type: null, data: {} }); setVerifyResult(null); }}
        footer={null}
        width={500}
      >
        {certModal.type === 'apply' && (
          <Form layout="vertical" size="small">
            <Form.Item label="持卡人姓名"><Input value={certModal.data.commonName} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, commonName: e.target.value } })} /></Form.Item>
            <Form.Item label="用户 ID"><Input value={certModal.data.userId} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, userId: e.target.value } })} /></Form.Item>
            <Form.Item label="部门"><Input value={certModal.data.department} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, department: e.target.value } })} /></Form.Item>
            <Form.Item label="职称"><Input value={certModal.data.title} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, title: e.target.value } })} /></Form.Item>
            <Form.Item label="算法"><Select value={certModal.data.algorithm} onChange={v => setCertModal({ ...certModal, data: { ...certModal.data, algorithm: v } })} options={[{value:'SM2',label:'国密 SM2'},{value:'RSA-2048',label:'RSA-2048'},{value:'RSA-4096',label:'RSA-4096'},{value:'ECDSA-P256',label:'ECDSA-P256'}]} /></Form.Item>
            <Button type="primary" block onClick={handleCertApply}>提交申请</Button>
          </Form>
        )}
        {certModal.type === 'revoke' && (
          <div>
            <Alert title={`将吊销证书 ${certModal.data.id} (${certModal.data.subject?.commonName})`} type="warning" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="吊销原因"><TextArea rows={3} value={certModal.data.reason} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, reason: e.target.value } })} /></Form.Item>
            <Button type="primary" danger block onClick={handleRevoke}>确认吊销</Button>
          </div>
        )}
        {certModal.type === 'sign' && (
          <div>
            <Alert title={`使用证书 ${certModal.data.certId} 签名报告 ${certModal.data.reportId}`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="报告 Hash (模拟)"><Input value={'mock-hash-' + (certModal.data.reportId || 'xxx')} disabled /></Form.Item>
            <Button type="primary" block onClick={handleSign}>执行签名</Button>
          </div>
        )}
        {certModal.type === 'verify' && (
          <div>
            <Form.Item label="签名 Hash"><Input.Search value={certModal.data.signatureHash} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, signatureHash: e.target.value } })} enterButton="验证" onSearch={handleVerify} /></Form.Item>
            {verifyResult && (
              <Alert title={verifyResult.valid ? '✓ 签名有效' : '✗ 签名无效'} type={verifyResult.valid ? 'success' : 'error'} showIcon style={{ marginTop: 12 }} description={`签署人: ${verifyResult.signer || '未知'} | 时间: ${verifyResult.signedAt || '未知'}`} />
            )}
          </div>
        )}
      </Modal>

      {/* 修订 Modal */}
      <Modal
        title={
          amendModal.type === 'start' ? '发起修订' :
          amendModal.type === 'complete' ? '完成修订' :
          amendModal.type === 'approve' ? '批准修订' :
          amendModal.type === 'reject' ? '驳回修订' :
          amendModal.type === 'history' ? '修订历史' : ''
        }
        open={!!amendModal.type}
        onCancel={() => { setAmendModal({ type: null, data: {} }); setAmendHistory(null); }}
        footer={null}
        width={500}
      >
        {amendModal.type === 'start' && (
          <Form layout="vertical" size="small">
            <Form.Item label="报告 ID"><Input value={amendModal.data.reportId} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reportId: e.target.value } })} /></Form.Item>
            <Form.Item label="修订原因"><TextArea rows={3} value={amendModal.data.reason} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reason: e.target.value } })} /></Form.Item>
            <Button type="primary" block onClick={handleAmendStart}>发起修订</Button>
          </Form>
        )}
        {amendModal.type === 'complete' && (
          <div>
            <Alert title={`完成修订 ${amendModal.data.id} (${amendModal.data.reportId})`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="最终说明"><TextArea rows={2} value={amendModal.data.reason} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reason: e.target.value } })} /></Form.Item>
            <Form.Item label="修订内容"><TextArea rows={3} value={amendModal.data.changes} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, changes: e.target.value } })} /></Form.Item>
            <Button type="primary" block onClick={handleAmendComplete}>标记完成</Button>
          </div>
        )}
        {amendModal.type === 'approve' && (
          <div>
            <Alert title={`批准修订 ${amendModal.data.id}`} type="success" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="批注 (可选)"><TextArea rows={2} value={amendModal.data.comment} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, comment: e.target.value } })} /></Form.Item>
            <Button type="primary" block onClick={handleAmendApprove}>确认批准</Button>
          </div>
        )}
        {amendModal.type === 'reject' && (
          <div>
            <Alert title={`驳回修订 ${amendModal.data.id}`} type="warning" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="驳回原因"><TextArea rows={3} value={amendModal.data.reason} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reason: e.target.value } })} /></Form.Item>
            <Button type="primary" danger block onClick={handleAmendReject}>确认驳回</Button>
          </div>
        )}
        {amendModal.type === 'history' && (
          <Form layout="vertical" size="small">
            <Form.Item label="报告 ID"><Input.Search value={amendModal.data.reportId} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reportId: e.target.value } })} enterButton="查询" onSearch={handleAmendHistory} /></Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default SignAmendPage;

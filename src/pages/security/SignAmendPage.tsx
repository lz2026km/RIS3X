// [v3.0.6.8-49] PR5: CA 签名 + 修订综合页面
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Input, Form, Row, Col, message, Tabs, Statistic, Alert, Modal, Timeline, Table } from 'antd';
import { Shield, FileSignature, Link2, Edit3, History, Plus, Lock, Stamp, Send } from 'lucide-react';
import { signApi, amendApi } from '@/services/api/signAmendApi';
import { t } from '../../i18n/appI18n';

const { TextArea } = Input;

const AMEND_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  in_progress: '进行中',
  completed: '完成',
  rejected: '已驳回',
};

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

  // 分页
  const PAGE_SIZE = 10;
  const [certPage, setCertPage] = useState(1);
  const [amendPage, setAmendPage] = useState(1);

  // 加载
  const loadCerts = async () => {
    try {
      const r = await signApi.listCertificates();
      if (r.success) setCerts(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadAmends = async () => {
    try {
      const r = await amendApi.listAmendments();
      if (r.success) setAmends(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { loadCerts(); loadAmends(); }, []);

  // CA 操作
  const handleCertApply = async () => {
    try {
      const r = await signApi.requestCertificate(certModal.data);
      if (r.success) { message.success(t('signAmend.applySuccess')); setCertModal({ type: null, data: {} }); loadCerts(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleRevoke = async () => {
    if (!certModal.data.id) return;
    try {
      const r = await signApi.revokeCertificate(certModal.data.id, { reason: certModal.data.reason || '管理员吊销' });
      if (r.success) { message.success(t('signAmend.revokeSuccess')); setCertModal({ type: null, data: {} }); loadCerts(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleSign = async () => {
    try {
      const r = await signApi.signReport(certModal.data.reportId, { certificateId: certModal.data.certId, reportHash: 'mock-hash-' + Date.now() });
      if (r.success) { message.success('签名成功: ' + r.data.signatureHash.slice(0, 12)); setCertModal({ type: null, data: {} }); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleVerify = async () => {
    if (!certModal.data.signatureHash) return message.warning(t('signAmend.enterSignatureHash'));
    try {
      const r = await signApi.verifySignature(certModal.data.signatureHash);
      if (r.success) { setVerifyResult(r.data); message.success(r.data.valid ? t('signAmend.signatureValidMsg') : t('signAmend.signatureInvalidMsg')); }
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
    if (!amendModal.data.reportId || !amendModal.data.reason) return message.warning(t('signAmend.requiredReportIdAndReason'));
    try {
      const r = await amendApi.startAmendment(amendModal.data.reportId, { reason: amendModal.data.reason });
      if (r.success) { message.success(t('signAmend.amendStarted')); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendComplete = async () => {
    if (!amendModal.data.id) return;
    try {
      const r = await amendApi.completeAmendment(amendModal.data.id, { finalReason: amendModal.data.reason, changes: amendModal.data.changes || '已修订' });
      if (r.success) { message.success(t('signAmend.amendCompleted')); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendApprove = async () => {
    if (!amendModal.data.id) return;
    try {
      const r = await amendApi.approveAmendment(amendModal.data.id, { comment: amendModal.data.comment });
      if (r.success) { message.success(t('signAmend.approved')); setAmendModal({ type: null, data: {} }); loadAmends(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleAmendReject = async () => {
    if (!amendModal.data.id) return;
    try {
      const r = await amendApi.rejectAmendment(amendModal.data.id, { reason: amendModal.data.reason });
      if (r.success) { message.success(t('signAmend.rejected')); setAmendModal({ type: null, data: {} }); loadAmends(); }
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
        <Shield size={20} color="#2563eb" />
        <Edit3 size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('signAmend.title')}</span>
        <Tag color="cyan">PR5 (v3.0.6.8-49)</Tag>
        <Tag color="purple">{t('signAmend.benchmark')}</Tag>
        <Tag color="green">{t('signAmend.scaleTag')}</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('signAmend.statValid')} value={certs.filter(c => c.status === 'valid').length} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('signAmend.statExpired')} value={certs.filter(c => c.status === 'expired').length} styles={{ content: {  color: '#faad14'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('signAmend.statRevoked')} value={certs.filter(c => c.status === 'revoked').length} styles={{ content: {  color: '#ff4d4f'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('signAmend.statAmending')} value={amends.filter(a => a.status === 'in_progress').length} styles={{ content: {  color: '#2563eb'  } }} /></Card></Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* CA 证书管理 */}
        <Tabs.TabPane tab={<span><Shield size={14} /> {t('signAmend.caCertTab')}</span>} key="cert">
          <Card
            title={`数字证书 (${filteredCerts.length})`}
            size="small"
            extra={
              <Space>
                <Select size="small" value={certFilter.status || undefined} onChange={v => setCertFilter({ status: v })} allowClear placeholder={t('signAmend.status')} style={{ width: 120 }} options={[
                  { value: 'valid', label: t('signAmend.statusValid') },
                  { value: 'expired', label: t('signAmend.statusExpired') },
                  { value: 'revoked', label: t('signAmend.statusRevoked') },
                  { value: 'suspended', label: t('signAmend.statusSuspended') },
                ]} />
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setCertModal({ type: 'apply', data: { algorithm: 'SM2' } })}>{t('signAmend.applyCert')}</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredCerts}
              rowKey="id"
              pagination={{ current: certPage, pageSize: PAGE_SIZE, total: filteredCerts.length, onChange: setCertPage, showSizeChanger: false }}
              columns={[
                { title: t('signAmend.colSerialNumber'), dataIndex: 'serialNumber' },
                { title: t('signAmend.colHolder'), render: (_, c) => c.subject.commonName },
                { title: t('signAmend.colDepartment'), render: (_, c) => c.subject.department },
                { title: t('signAmend.colAlgorithm'), dataIndex: 'algorithm' },
                { title: t('signAmend.colStatus'), dataIndex: 'status', render: (s) => <Tag color={s === 'valid' ? 'green' : s === 'expired' ? 'orange' : 'red'}>{s}</Tag> },
                { title: t('signAmend.colValidity'), render: (_, c) => `${c.validFrom?.slice(0,10)} ~ ${c.validTo?.slice(0,10)}` },
                {
                  title: t('signAmend.colActions'),
                  render: (_, c) => (
                    <Space>
                      <Button type="link" size="small" icon={<FileSignature size={12} />} onClick={() => setCertModal({ type: 'sign', data: { certId: c.id, reportId: 'RPT-001' } })}>{t('signAmend.sign')}</Button>
                      <Button type="link" size="small" icon={<Link2 size={12} />} onClick={() => setCertModal({ type: 'verify', data: { signatureHash: '' } })}>{t('signAmend.verify')}</Button>
                      <Button type="link" size="small" icon={<Lock size={12} />} onClick={() => setCertModal({ type: 'revoke', data: c })} danger>{t('signAmend.revoke')}</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>

          {/* 区块链存证演示 */}
          <Card title={t('signAmend.blockchainProof')} size="small" style={{ marginTop: 16 }}>
            <Space>
              <Input placeholder={t('signAmend.reportIdPlaceholder')} value={certModal.data.reportId || ''} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, reportId: e.target.value } })} style={{ width: 300 }} />
              <Button icon={<Link2 size={14} />} onClick={handleChainProof}>{t('signAmend.queryProof')}</Button>
              <Button icon={<Stamp size={14} />} onClick={handleTimestamp}>{t('signAmend.issueTimestamp')}</Button>
            </Space>
            {chainProof && (
              <Alert
                style={{ marginTop: 12 }}
                type="success"
                title={`区块链存证: TxHash ${chainProof.txHash?.slice(0, 16)}...`}
                description={
                  <div>
                    <div>{t('signAmend.reportLabel')} {chainProof.reportId}</div>
                    <div>{t('signAmend.blockLabel')} #{chainProof.blockNumber} on {chainProof.chain}</div>
                    <div>{t('signAmend.timeLabel')} {chainProof.createdAt}</div>
                  </div>
                }
                showIcon
              />
            )}
          </Card>
        </Tabs.TabPane>

        {/* 报告修订 */}
        <Tabs.TabPane tab={<span><Edit3 size={14} /> {t('signAmend.amendTab')}</span>} key="amend">
          <Card
            title={`修订记录 (${filteredAmends.length})`}
            size="small"
            extra={
              <Space>
                <Select size="small" value={amendFilter.status || undefined} onChange={v => setAmendFilter({ status: v })} allowClear placeholder={t('signAmend.status')} style={{ width: 120 }} options={[
                  { value: 'draft', label: t('signAmend.statusDraft') },
                  { value: 'in_progress', label: t('signAmend.statusInProgress') },
                  { value: 'completed', label: t('signAmend.statusCompleted') },
                  { value: 'rejected', label: t('signAmend.statusRejected') },
                ]} />
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setAmendModal({ type: 'start', data: {} })}>{t('signAmend.startAmend')}</Button>
                <Button size="small" icon={<History size={12} />} onClick={() => setAmendModal({ type: 'history', data: { reportId: 'RPT-001' } })}>{t('signAmend.history')}</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredAmends}
              rowKey="id"
              pagination={{ current: amendPage, pageSize: PAGE_SIZE, total: filteredAmends.length, onChange: setAmendPage, showSizeChanger: false }}
              columns={[
                { title: t('signAmend.colNumber'), dataIndex: 'id' },
                { title: t('signAmend.colReport'), dataIndex: 'reportId' },
                { title: t('signAmend.colVersion'), dataIndex: 'version' },
                { title: t('signAmend.colStatus'), dataIndex: 'status', render: (s) => <Tag color={s === 'completed' ? 'green' : s === 'in_progress' ? 'blue' : s === 'rejected' ? 'red' : 'orange'}>{AMEND_STATUS_LABEL[s] ?? s}</Tag> },
                { title: t('signAmend.colReason'), dataIndex: 'reason', ellipsis: true },
                { title: t('signAmend.colAuthor'), dataIndex: 'authorName' },
                { title: t('signAmend.colTime'), render: (_, a) => a.startTime?.slice(0,16) },
                {
                  title: t('signAmend.colActions'),
                  render: (_, a) => (
                    <Space>
                      <Button type="link" size="small" onClick={() => setAmendModal({ type: 'complete', data: a })} disabled={a.status === 'completed'}>{t('signAmend.complete')}</Button>
                      <Button type="link" size="small" onClick={() => setAmendModal({ type: 'approve', data: a })} disabled={a.status === 'completed'}>{t('signAmend.approve')}</Button>
                      <Button type="link" danger size="small" onClick={() => setAmendModal({ type: 'reject', data: a })}>{t('signAmend.reject')}</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>

          {amendHistory && (
            <Card title={`修订历史: ${amendHistory.reportId}`} size="small" style={{ marginTop: 16 }}>
              <Timeline
                items={(amendHistory.history || []).map((a: any) => ({
                  color: a.status === 'completed' ? 'green' : a.status === 'rejected' ? 'red' : 'blue',
                  children: <div><Tag color="blue">v{a.version}</Tag> {a.authorName} - {AMEND_STATUS_LABEL[a.status] ?? a.status} - {a.reason} <span style={{ color: '#999' }}>· {a.startTime?.slice(0, 16)}</span></div>,
                }))}
              />
            </Card>
          )}
        </Tabs.TabPane>
      </Tabs>

      {/* 证书申请/吊销/签名/验证 Modal */}
      <Modal
        title={
          certModal.type === 'apply' ? t('signAmend.applyCertTitle') :
          certModal.type === 'revoke' ? t('signAmend.revokeCertTitle') :
          certModal.type === 'sign' ? t('signAmend.signReportTitle') :
          certModal.type === 'verify' ? t('signAmend.verifyTitle') : ''
        }
        open={!!certModal.type && certModal.type !== 'history' && certModal.type !== 'verify' || (certModal.type === 'verify' && verifyResult)}
        onCancel={() => { setCertModal({ type: null, data: {} }); setVerifyResult(null); }}
        footer={null}
        width={500}
      >
        {certModal.type === 'apply' && (
          <Form layout="vertical" size="small">
            <Form.Item label={t('signAmend.holderName')}><Input value={certModal.data.commonName} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, commonName: e.target.value } })} /></Form.Item>
            <Form.Item label={t('signAmend.userId')}><Input value={certModal.data.userId} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, userId: e.target.value } })} /></Form.Item>
            <Form.Item label={t('signAmend.department')}><Input value={certModal.data.department} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, department: e.target.value } })} /></Form.Item>
            <Form.Item label={t('signAmend.jobTitle')}><Input value={certModal.data.title} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, title: e.target.value } })} /></Form.Item>
            <Form.Item label={t('signAmend.algorithm')}><Select value={certModal.data.algorithm} onChange={v => setCertModal({ ...certModal, data: { ...certModal.data, algorithm: v } })} options={[{value:'SM2',label:t('signAmend.gmSm2')},{value:'RSA-2048',label:'RSA-2048'},{value:'RSA-4096',label:'RSA-4096'},{value:'ECDSA-P256',label:'ECDSA-P256'}]} /></Form.Item>
            <Button type="primary" block icon={<Send size={14} />} onClick={handleCertApply}>{t('signAmend.submitApply')}</Button>
          </Form>
        )}
        {certModal.type === 'revoke' && (
          <div>
            <Alert title={`将吊销证书 ${certModal.data.id} (${certModal.data.subject?.commonName})`} type="warning" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('signAmend.revokeReason')}><TextArea rows={3} value={certModal.data.reason} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, reason: e.target.value } })} /></Form.Item>
            <Button type="primary" danger block onClick={handleRevoke}>{t('signAmend.confirmRevoke')}</Button>
          </div>
        )}
        {certModal.type === 'sign' && (
          <div>
            <Alert title={`使用证书 ${certModal.data.certId} 签名报告 ${certModal.data.reportId}`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('signAmend.reportHashMock')}><Input value={'mock-hash-' + (certModal.data.reportId || 'xxx')} disabled /></Form.Item>
            <Button type="primary" block onClick={handleSign}>{t('signAmend.doSign')}</Button>
          </div>
        )}
        {certModal.type === 'verify' && (
          <div>
            <Form.Item label={t('signAmend.signatureHash')}><Input.Search value={certModal.data.signatureHash} onChange={e => setCertModal({ ...certModal, data: { ...certModal.data, signatureHash: e.target.value } })} enterButton={t('signAmend.verify')} onSearch={handleVerify} /></Form.Item>
            {verifyResult && (
              <Alert title={verifyResult.valid ? t('signAmend.signatureValid') : t('signAmend.signatureInvalid')} type={verifyResult.valid ? 'success' : 'error'} showIcon style={{ marginTop: 12 }} description={`签署人: ${verifyResult.signer || '未知'} | 时间: ${verifyResult.signedAt || '未知'}`} />
            )}
          </div>
        )}
      </Modal>

      {/* 修订 Modal */}
      <Modal
        title={
          amendModal.type === 'start' ? t('signAmend.startAmendTitle') :
          amendModal.type === 'complete' ? t('signAmend.completeAmendTitle') :
          amendModal.type === 'approve' ? t('signAmend.approveAmendTitle') :
          amendModal.type === 'reject' ? t('signAmend.rejectAmendTitle') :
          amendModal.type === 'history' ? t('signAmend.amendHistoryTitle') : ''
        }
        open={!!amendModal.type}
        onCancel={() => { setAmendModal({ type: null, data: {} }); setAmendHistory(null); }}
        footer={null}
        width={500}
      >
        {amendModal.type === 'start' && (
          <Form layout="vertical" size="small">
            <Form.Item label={t('signAmend.reportId')}><Input value={amendModal.data.reportId} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reportId: e.target.value } })} /></Form.Item>
            <Form.Item label={t('signAmend.amendReason')}><TextArea rows={3} value={amendModal.data.reason} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reason: e.target.value } })} /></Form.Item>
            <Button type="primary" block onClick={handleAmendStart}>{t('signAmend.startAmend')}</Button>
          </Form>
        )}
        {amendModal.type === 'complete' && (
          <div>
            <Alert title={`完成修订 ${amendModal.data.id} (${amendModal.data.reportId})`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('signAmend.finalNote')}><TextArea rows={2} value={amendModal.data.reason} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reason: e.target.value } })} /></Form.Item>
            <Form.Item label={t('signAmend.amendChanges')}><TextArea rows={3} value={amendModal.data.changes} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, changes: e.target.value } })} /></Form.Item>
            <Button type="primary" block onClick={handleAmendComplete}>{t('signAmend.markComplete')}</Button>
          </div>
        )}
        {amendModal.type === 'approve' && (
          <div>
            <Alert title={`批准修订 ${amendModal.data.id}`} type="success" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('signAmend.commentOptional')}><TextArea rows={2} value={amendModal.data.comment} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, comment: e.target.value } })} /></Form.Item>
            <Button type="primary" block onClick={handleAmendApprove}>{t('signAmend.confirmApprove')}</Button>
          </div>
        )}
        {amendModal.type === 'reject' && (
          <div>
            <Alert title={`驳回修订 ${amendModal.data.id}`} type="warning" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('signAmend.rejectReason')}><TextArea rows={3} value={amendModal.data.reason} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reason: e.target.value } })} /></Form.Item>
            <Button type="primary" danger block onClick={handleAmendReject}>{t('signAmend.confirmReject')}</Button>
          </div>
        )}
        {amendModal.type === 'history' && (
          <Form layout="vertical" size="small">
            <Form.Item label={t('signAmend.reportId')}><Input.Search value={amendModal.data.reportId} onChange={e => setAmendModal({ ...amendModal, data: { ...amendModal.data, reportId: e.target.value } })} enterButton={t('signAmend.query')} onSearch={handleAmendHistory} /></Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default SignAmendPage;

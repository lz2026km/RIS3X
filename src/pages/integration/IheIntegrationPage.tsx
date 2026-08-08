/**
 * G005 v3.0.6.11-75 W3-1 - IHE 集成引擎页
 * iheApi.getStatus 真实数据 + 状态卡 + 交易统计 + 配置入口 + loading/error
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, Space, Tag, Table, Button, Row, Col, Statistic, message, Alert, Spin, Input, Modal, Divider,
} from 'antd';
import { Globe, Activity, RefreshCw, ArrowLeftRight, Server, Network, Database, FileSearch, IdCard, CalendarRange } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { IheStatus } from '../../services/api/integrationApi';

const IheIntegrationPage: React.FC = () => {
  const [status, setStatus] = useState<IheStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixModal, setPixModal] = useState(false);
  const [pdqModal, setPdqModal] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [pixResult, setPixResult] = useState<string>('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await iheApi.getStatus();
      if (res.success && res.data) setStatus(res.data);
      else setError(res.error?.message ?? '获取 IHE 状态失败');
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取 IHE 状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStatus() }, [fetchStatus]);

  const handlePixQuery = async () => {
    if (!patientId.trim()) { message.warning('请输入患者 ID'); return }
    const res = await iheApi.pixQuery({ patientId: patientId.trim(), sourceDomain: status?.affinityDomain.assigningAuthorityId ?? 'HOSP', targetDomains: ['OTHER-HOSP', 'CDC'] });
    if (res.success) {
      const hits = (res.data as { results?: Array<{ patientId: string; assigningAuthority: string }> }).results ?? [];
      setPixResult(hits.length > 0 ? hits.map((h) => `${h.patientId} @ ${h.assigningAuthority}`).join('\n') : '未找到交叉引用记录');
    } else {
      setPixResult('查询失败: ' + (res.error?.message ?? ''));
    }
  };

  const handlePdqQuery = async () => {
    if (!patientId.trim()) { message.warning('请输入患者 ID'); return }
    const res = await iheApi.pdqQuery({ patientId: patientId.trim(), limit: 5 });
    if (res.success) {
      const results = (res.data as { results?: Array<{ patientId: string; name: { family: string; given: string[] }; confidence: number }> }).results ?? [];
      setPixResult(results.length > 0 ? results.map((r) => `${r.name.family}${r.name.given.join('')} · ${r.patientId} · 置信度 ${(r.confidence * 100).toFixed(0)}%`).join('\n') : '未找到患者记录');
    } else {
      setPixResult('查询失败: ' + (res.error?.message ?? ''));
    }
  };

  const domain = status?.affinityDomain;
  const pixCount = status?.metrics.pixRecords ?? 0;
  const pdqCount = status?.metrics.pdqCache ?? 0;
  const transactions = status?.transactions ?? [];

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>IHE 集成引擎</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">{status?.profile ?? 'PIX · PDQ · PAM'}</Tag>
        {loading && <Spin size="small" />}
      </Space>

      {error && (
        <Alert type="error" showIcon message="状态加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void fetchStatus()}>重试</Button>} />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small" loading={loading}><Statistic title="PIX 记录" value={pixCount} prefix={<IdCard size={14} />} /></Card></Col>
        <Col span={6}><Card size="small" loading={loading}><Statistic title="PDQ 缓存" value={pdqCount} prefix={<FileSearch size={14} />} /></Card></Col>
        <Col span={6}><Card size="small" loading={loading}><Statistic title="PAM 日志条目" value={status?.metrics.pamLogSize ?? 0} prefix={<CalendarRange size={14} />} /></Card></Col>
        <Col span={6}><Card size="small" loading={loading}><Statistic title="支持事务" value={transactions.length} prefix={<Activity size={14} />} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={<Space><Server size={14} />Affinity Domain</Space>}
            extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchStatus()} loading={loading}>刷新</Button>}
            style={{ marginBottom: 16 }}
          >
            {loading ? <Spin /> : domain ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div><Tag color="blue">名称</Tag> {domain.name} {domain.nameEn ? <span style={{ color: '#64748b' }}>({domain.nameEn})</span> : null}</div>
                <div><Tag>Home Community ID</Tag> <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{domain.homeCommunityId}</code></div>
                <div><Tag>Assigning Authority</Tag> <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{domain.assigningAuthorityId}</code></div>
                <Divider style={{ margin: '4px 0' }} />
                <Space size={4} wrap>
                  {domain.pixManagerEndpoint && <Tag icon={<Network size={10} />} color="purple">PIX: {domain.pixManagerEndpoint}</Tag>}
                  {domain.pdqSupplierEndpoint && <Tag icon={<Network size={10} />} color="orange">PDQ: {domain.pdqSupplierEndpoint}</Tag>}
                  {domain.atnaEndpoint && <Tag icon={<Network size={10} />} color="red">ATNA: {domain.atnaEndpoint}</Tag>}
                </Space>
              </Space>
            ) : (
              <Tag color="default">暂无数据</Tag>
            )}
          </Card>

          <Card size="small" title={<Space><Database size={14} />配置与联调入口</Space>}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Button block icon={<IdCard size={14} />} onClick={() => { setPixModal(true); setPixResult('') }}>PIX 患者索引查询</Button>
              <Button block icon={<FileSearch size={14} />} onClick={() => { setPdqModal(true); setPixResult('') }}>PDQ 患者人口学查询</Button>
              <Button block icon={<ArrowLeftRight size={14} />} onClick={() => message.success('PIX 增量更新通知已发送(模拟)')}>PIX 增量更新通知</Button>
              <Button block icon={<CalendarRange size={14} />} onClick={() => message.info('PAM 就诊状态消息由 HL7 ADT 驱动')}>PAM 就诊管理文档</Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card size="small" title={<Space><ArrowLeftRight size={14} />支持的 IHE 事务</Space>}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : (
              <Table
                dataSource={transactions.map((t, i) => ({ key: i, transaction: t }))}
                rowKey="key" pagination={false} size="small"
                columns={[
                  { title: '事务', dataIndex: 'transaction', render: (t: string) => <Tag color="blue">{t}</Tag> },
                  { title: '说明', render: (_, r) => <span style={{ fontSize: 12, color: '#64748b' }}>{TRANSACTION_DESC[r.transaction as string] ?? 'IHE 集成事务'}</span> },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal title="PIX 患者索引查询" open={pixModal} onCancel={() => setPixModal(false)} footer={null} width={460}>
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
          <Input.Search
            placeholder="输入患者 ID (本地域)"
            enterButton="查询"
            onSearch={handlePixQuery}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, minHeight: 80, whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{pixResult || '查询结果将在此显示'}</pre>
        </Space>
      </Modal>

      <Modal title="PDQ 患者人口学查询" open={pdqModal} onCancel={() => setPdqModal(false)} footer={null} width={460}>
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
          <Input.Search
            placeholder="输入患者 ID 或姓名"
            enterButton="查询"
            onSearch={handlePdqQuery}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, minHeight: 80, whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{pixResult || '查询结果将在此显示'}</pre>
        </Space>
      </Modal>
    </div>
  );
};

const TRANSACTION_DESC: Record<string, string> = {
  'PIX Feed': '患者标识交叉引用注册',
  'PIX Query': '跨域患者标识查询',
  'PDQ Query': '患者人口学数据查询',
  'PAM Message': '就诊通知管理',
  'PAM Query': '就诊状态查询',
  'ATNA Audit': '审计追踪节点访问',
};

export default IheIntegrationPage;

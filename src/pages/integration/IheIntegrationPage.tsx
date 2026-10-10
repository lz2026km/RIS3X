/**
 * G005 v3.0.6.11-75 W3-1 - IHE 集成引擎页
 * iheApi.getStatus 真实数据 + 状态卡 + 交易统计 + 配置入口 + loading/error
 */
import { iheApi } from '../../services/api/integrationApi';
import { IheStatus } from '../../services/api/integrationApi'
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  message,
  Alert,
  Spin,
  Input,
  Modal,
  Divider,
  Descriptions,
} from "antd";
import { Globe, Activity, RefreshCw, ArrowLeftRight, Server, Network, Database, FileSearch, IdCard, CalendarRange } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n/appI18n';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const IheIntegrationPage: React.FC = () => {
  const [status, setStatus] = useState<IheStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixModal, setPixModal] = useState(false);
  const [pdqModal, setPdqModal] = useState(false);
  const [pamModal, setPamModal] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [pixResult, setPixResult] = useState<string>('');
  // [G005 2B] 事务详情 Modal
  const [detailTxn, setDetailTxn] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await iheApi.getStatus();
      if (res.success && res.data) setStatus(res.data);
      else setError(res.error?.message ?? t('iheInt.statusFailed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('iheInt.statusFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStatus() }, [fetchStatus]);

  const handlePixQuery = async () => {
    if (!patientId.trim()) { message.warning(t('iheInt.enterPatientId')); return }
    const res = await iheApi.pixQuery({ patientId: patientId.trim(), sourceDomain: status?.affinityDomain.assigningAuthorityId ?? 'HOSP', targetDomains: ['OTHER-HOSP', 'CDC'] });
    if (res.success) {
      const hits = (res.data as { results?: Array<{ patientId: string; assigningAuthority: string }> }).results ?? [];
      setPixResult(hits.length > 0 ? hits.map((h) => `${h.patientId} @ ${h.assigningAuthority}`).join('\n') : t('iheInt.noCrossReference'));
    } else {
      setPixResult(`${t('iheInt.queryFailed')}: ` + (res.error?.message ?? ''));
    }
  };

  const handlePdqQuery = async () => {
    if (!patientId.trim()) { message.warning(t('iheInt.enterPatientId')); return }
    const res = await iheApi.pdqQuery({ patientId: patientId.trim(), limit: 5 });
    if (res.success) {
      const results = (res.data as { results?: Array<{ patientId: string; name: { family: string; given: string[] }; confidence: number }> }).results ?? [];
      setPixResult(results.length > 0 ? results.map((r) => `${r.name.family}${r.name.given.join('')} · ${r.patientId} · ${t('iheInt.confidence')} ${(r.confidence * 100).toFixed(0)}%`).join('\n') : t('iheInt.noPatientRecord'));
    } else {
      setPixResult(`${t('iheInt.queryFailed')}: ` + (res.error?.message ?? ''));
    }
  };

  const domain = status?.affinityDomain;
  const pixCount = status?.metrics.pixRecords ?? 0;
  const pdqCount = status?.metrics.pdqCache ?? 0;
  const transactions = status?.transactions ?? [];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} wrap>
        <Globe size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('iheInt.title')}</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">{status?.profile ?? 'PIX · PDQ · PAM'}</Tag>
        {loading && <Spin size="small" />}
      </Space>

      {error && (
        <Alert type="error" showIcon message={t('iheInt.statusFailedTitle')} description={error} style={{ marginBottom: 'var(--space-4, 16px)' }}
          action={<Button size="small" onClick={() => void fetchStatus()}><RefreshCw size={14} /> {t('iheInt.retry')}</Button>} />
      )}

      <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('iheInt.statPixRecords')} value={pixCount} loading={loading} icon={<IdCard size={18} />} color="primary" />
        <StatCard title={t('iheInt.statPdqCache')} value={pdqCount} loading={loading} icon={<FileSearch size={18} />} color="primary" />
        <StatCard title={t('iheInt.statPamLog')} value={status?.metrics.pamLogSize ?? 0} loading={loading} icon={<CalendarRange size={18} />} color="primary" />
        <StatCard title={t('iheInt.statTransactions')} value={transactions.length} loading={loading} icon={<Activity size={18} />} color="info" />
      </StatCardGrid>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={<Space><Server size={14} />{t('iheInt.affinityDomain')}</Space>}
            extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchStatus()} loading={loading}>{t('iheInt.refresh')}</Button>}
            style={{ marginBottom: 'var(--space-4, 16px)' }}
          >
            {loading ? <Spin /> : domain ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div><Tag color="blue">{t('iheInt.name')}</Tag> {domain.name} {domain.nameEn ? <span style={{ color: 'var(--text-muted, #64748b)' }}>({domain.nameEn})</span> : null}</div>
                <div><Tag>{t('iheInt.homeCommunityId')}</Tag> <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4 }}>{domain.homeCommunityId}</code></div>
                <div><Tag>{t('iheInt.assigningAuthority')}</Tag> <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4 }}>{domain.assigningAuthorityId}</code></div>
                <Divider style={{ margin: '4px 0' }} />
                <Space size={4} wrap>
                  {domain.pixManagerEndpoint && <Tag icon={<Network size={10} />} color="purple">PIX: {domain.pixManagerEndpoint}</Tag>}
                  {domain.pdqSupplierEndpoint && <Tag icon={<Network size={10} />} color="orange">PDQ: {domain.pdqSupplierEndpoint}</Tag>}
                  {domain.atnaEndpoint && <Tag icon={<Network size={10} />} color="red">ATNA: {domain.atnaEndpoint}</Tag>}
                </Space>
              </Space>
            ) : (
              <Tag color="default">{t('iheInt.noData')}</Tag>
            )}
          </Card>

          <Card size="small" title={<Space><Database size={14} />{t('iheInt.configEntry')}</Space>}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Button block icon={<IdCard size={14} />} onClick={() => { setPixModal(true); setPixResult('') }}>{t('iheInt.pixQueryBtn')}</Button>
              <Button block icon={<FileSearch size={14} />} onClick={() => { setPdqModal(true); setPixResult('') }}>{t('iheInt.pdqQueryBtn')}</Button>
              <Button block icon={<ArrowLeftRight size={14} />} onClick={async () => {
                try {
                  const res = await iheApi.pixUpdateNotification({
                    patientId: 'PAT-10086', assigningAuthority: status?.affinityDomain.assigningAuthorityId ?? 'HOSP',
                    identifiers: [{ domain: 'HOSP', value: 'PAT-10086', assigningAuthority: 'HOSP' }],
                    name: { family: '测试', given: ['患者'] }, birthDate: '1990-01-01', gender: 'U',
                  });
                  if (res.success) message.success(`${t('iheInt.pixUpdateSent')} (${res.data?.messageId ?? ''})`);
                  else message.warning(`${t('iheInt.pixUpdateUndelivered')}: ${res.error?.message ?? ''}`);
                } catch (e) {
                  message.warning(`${t('iheInt.pixUpdateUndelivered')}: ` + (e instanceof Error ? e.message : String(e)));
                }
              }}>{t('iheInt.pixUpdateBtn')}</Button>
              <Button block icon={<CalendarRange size={14} />} onClick={() => setPamModal(true)}>{t('iheInt.pamDocBtn')}</Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card size="small" title={<Space><ArrowLeftRight size={14} />{t('iheInt.supportedTxns')}</Space>}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)' }}><Spin /></div>
            ) : (
              <DataTable
                dataSource={transactions.map((t, i) => ({ key: i, transaction: t }))}
                rowKey="key" pagination={false}
                columns={[
                  { title: t('iheInt.colTransaction'), dataIndex: 'transaction', render: (v: string) => <Tag color="blue">{v}</Tag> },
                  { title: t('iheInt.colStandard'), render: (_, r) => <Tag color="purple">{TRANSACTION_STANDARD[r.transaction as string] ?? 'HL7 v2.x'}</Tag> },
                  { title: t('iheInt.colDescription'), render: (_, r) => <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{txnDesc(r.transaction as string)}</span> },
                  { title: t('iheInt.colStatus'), render: () => <Tag color="green">{t('iheInt.enabled')}</Tag> },
                  { title: t('iheInt.colActions'), render: (_, r) => <Button size="small" onClick={() => setDetailTxn(r.transaction as string)}>{t('iheInt.viewDetail')}</Button> },
                ]}
              scroll={{ x: 'max-content' }} />
            )}
          </Card>
        </Col>
      </Row>

      <Modal title={t('iheInt.pixQueryBtn')} open={pixModal} onCancel={() => setPixModal(false)} footer={null} width={460}>
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 'var(--space-3, 12px)' }}>
          <Input.Search
            placeholder={t('iheInt.pixPlaceholder')}
            enterButton={t('iheInt.query')}
            onSearch={handlePixQuery}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 'var(--space-3, 12px)', borderRadius: 8, minHeight: 80, whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{pixResult || t('iheInt.resultPlaceholder')}</pre>
        </Space>
      </Modal>

      <Modal title={t('iheInt.pdqQueryBtn')} open={pdqModal} onCancel={() => setPdqModal(false)} footer={null} width={460}>
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 'var(--space-3, 12px)' }}>
          <Input.Search
            placeholder={t('iheInt.pdqPlaceholder')}
            enterButton={t('iheInt.query')}
            onSearch={handlePdqQuery}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 'var(--space-3, 12px)', borderRadius: 8, minHeight: 80, whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{pixResult || t('iheInt.resultPlaceholder')}</pre>
        </Space>
      </Modal>

      <Modal title={`${t('iheInt.txnDetailTitle')} - ${detailTxn ?? ''}`} open={!!detailTxn} onCancel={() => setDetailTxn(null)} footer={<Button type="primary" onClick={() => setDetailTxn(null)}>{t('iheInt.close')}</Button>} width={480}>
        {detailTxn && (
          <Descriptions bordered column={1} size="small" style={{ marginTop: 'var(--space-3, 12px)' }}>
            <Descriptions.Item label={t('iheInt.txnName')}>{detailTxn}</Descriptions.Item>
            <Descriptions.Item label={t('iheInt.colStandard')}>{TRANSACTION_STANDARD[detailTxn] ?? 'HL7 v2.x'}</Descriptions.Item>
            <Descriptions.Item label={t('iheInt.colDescription')}>{txnDesc(detailTxn)}</Descriptions.Item>
            <Descriptions.Item label={t('iheInt.colStatus')}><Tag color="green">{t('iheInt.enabled')}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal title={t('iheInt.pamTitle')} open={pamModal} onCancel={() => setPamModal(false)} footer={<Button type="primary" onClick={() => setPamModal(false)}>{t('iheInt.close')}</Button>} width={520}>
        <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 'var(--space-2, 8px)' }}>
          <Alert type="info" showIcon message={t('iheInt.pamAlert')} />
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label={t('iheInt.pamTxn')}>{t('iheInt.pamTxnValue')}</Descriptions.Item>
            <Descriptions.Item label={t('iheInt.messageSource')}>{t('iheInt.messageSourceValue')}</Descriptions.Item>
            <Descriptions.Item label={t('iheInt.pamLogEntries')}>{status?.metrics.pamLogSize ?? 0}</Descriptions.Item>
            <Descriptions.Item label={t('iheInt.currentConfig')}>{t('iheInt.pamConfigDesc')}</Descriptions.Item>
          </Descriptions>
        </Space>
      </Modal>
    </PageContainer>
  );
};

const TRANSACTION_DESC: Record<string, string> = {
  'PIX Feed': 'iheInt.txnPixFeed',
  'PIX Query': 'iheInt.txnPixQuery',
  'PDQ Query': 'iheInt.txnPdqQuery',
  'PAM Message': 'iheInt.txnPamMessage',
  'PAM Query': 'iheInt.txnPamQuery',
  'ATNA Audit': 'iheInt.txnAtnaAudit',
};
const txnDesc = (k: string) => TRANSACTION_DESC[k] ? t(TRANSACTION_DESC[k]) : t('iheInt.txnDescFallback');

const TRANSACTION_STANDARD: Record<string, string> = {
  'PIX Feed': 'IHE ITI-8 / HL7 v2.x',
  'PIX Query': 'IHE ITI-9 / HL7 v2.x',
  'PDQ Query': 'IHE ITI-21 / HL7 v2.x',
  'PAM Message': 'IHE ITI-30 / ADT',
  'PAM Query': 'IHE ITI-31 / Q22',
  'ATNA Audit': 'IHE ITI-20 / ATNA',
};

export default IheIntegrationPage;

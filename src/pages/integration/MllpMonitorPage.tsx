/**
 * G005 v3.0.6.11-75 W3-1 - MLLP 监控页
 * hl7Api 真实端点: 服务状态 + 连接日志 + 消息档案; 30s 轮询; loading/error
 */
import { MllpMonitor } from '../../components/integration/MllpMonitor';
import { usePagination } from '../../hooks/usePagination';
import { hl7Api } from '../../services/api/integrationApi';
import { ConnectionLogEntry, Hl7ArchiveRecord, MllpStatus } from '../../services/api/integrationApi'
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  Alert,
  Spin,
  Tabs,
  Select,
  Empty,
  message,
  Badge,
} from "antd";
import { Activity, Server, BookOpen, Cpu, Network, Play, Square, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common"

const POLL_MS = 30_000;

const ACK_META: Record<string, { color: string; label: string }> = {
  SUCCESS: { color: 'success', label: t('mllpMon.ack.success') },
  FAILED: { color: 'error', label: t('mllpMon.ack.failed') },
  PENDING: { color: 'warning', label: t('mllpMon.ack.pending') },
};

const DIRECTION_LABEL: Record<string, string> = { INBOUND: t('mllpMon.dir.inbound'), OUTBOUND: t('mllpMon.dir.outbound') };

const EVENT_LABEL: Record<string, string> = { connect: t('mllpMon.event.connect'), disconnect: t('mllpMon.event.disconnect'), message: t('mllpMon.event.message'), error: t('mllpMon.event.error') };

const MllpMonitorPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MllpStatus | null>(null);
  const [logs, setLogs] = useState<ConnectionLogEntry[]>([]);
  const [archive, setArchive] = useState<Hl7ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operating, setOperating] = useState(false);
  const [msgType, setMsgType] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // [W3-C] 受控分页: 消息档案表 + 连接事件表
  const archivePagination = usePagination(archive, 10);
  const logsPagination = usePagination(logs, 10);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, logsRes, archiveRes] = await Promise.all([
        hl7Api.getMllpStatus(),
        hl7Api.getMllpLogs(30),
        hl7Api.getArchive(msgType ? { messageType: msgType } : undefined),
      ]);
      if (statusRes.success && statusRes.data) setStatus(statusRes.data);
      if (logsRes.success && Array.isArray(logsRes.data)) setLogs(logsRes.data);
      if (archiveRes.success && Array.isArray(archiveRes.data)) setArchive(archiveRes.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mllpMon.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [msgType]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    pollRef.current = setInterval(() => { void fetchAll() }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAll]);

  const handleStart = async () => {
    setOperating(true);
    try {
      const res = await hl7Api.startMllp();
      if (res.success) { message.success(t('mllpMon.startSuccess')); void fetchAll() }
      else message.error(res.error?.message ?? t('mllpMon.startFail'));
    } catch (e) { message.error(e instanceof Error ? e.message : t('mllpMon.startFail')) } finally { setOperating(false) }
  };

  const handleStop = async () => {
    setOperating(true);
    try {
      const res = await hl7Api.stopMllp();
      if (res.success) { message.success(t('mllpMon.stopSuccess')); void fetchAll() }
      else message.error(res.error?.message ?? t('mllpMon.stopFail'));
    } catch (e) { message.error(e instanceof Error ? e.message : t('mllpMon.stopFail')) } finally { setOperating(false) }
  };

  const uptimeText = status ? `${Math.floor((status.uptimeMs ?? 0) / 3600000)}h ${Math.floor(((status.uptimeMs ?? 0) % 3600000) / 60000)}m` : '-';

  return (
    <PageContainer padding={24}>
      <Card size="small" className="shadow-sm" style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
          <Space>
            <Activity size={18} color="#7c3aed" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('mllpMon.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{t('mllpMon.subtitle')} · TCP {status?.port ?? 2575}</div>
            </div>
          </Space>
          <Space wrap>
            <Badge status={status?.running ? 'processing' : 'default'} text={status?.running ? t('mllpMon.running') : t('mllpMon.stopped')} />
            <Tag color="purple">v3.0.6.11-75</Tag>
            <Tag color="cyan">{t('mllpMon.autoPoll')}</Tag>
            <Button size="small" icon={<BookOpen size={12} />} onClick={() => navigate('/integration/ihe-connectathon')}>IHE Connectathon</Button>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchAll()}>{t('mllpMon.refresh')}</Button>
          </Space>
        </div>
      </Card>

      {error && (
        <Alert type="error" showIcon message={t('mllpMon.loadFailTitle')} description={error} style={{ marginBottom: 'var(--space-4, 16px)' }}
          action={<Button size="small" onClick={() => void fetchAll()}><RefreshCw size={14} /> {t('mllpMon.retry')}</Button>} />
      )}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<Space><Server size={14} />{t('mllpMon.serviceStatus')}</Space>}
            extra={
              <Space size={4}>
                {status?.running
                  ? <Button size="small" danger icon={<Square size={12} />} onClick={handleStop} loading={operating}>{t('mllpMon.stop')}</Button>
                  : <Button size="small" type="primary" icon={<Play size={12} />} onClick={handleStart} loading={operating}>{t('mllpMon.start')}</Button>}
              </Space>
            }
            style={{ marginBottom: 'var(--space-3, 12px)' }}
          >
            {loading ? <Spin /> : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <StatCardGrid minWidth={200} gap={8}>
                  <StatCard title={t('mllpMon.stat.port')} value={status?.port ?? '-'} color="primary" />
                  <StatCard title={t('mllpMon.stat.connections')} value={status?.totalConnections ?? 0} color="primary" />
                  <StatCard title={t('mllpMon.stat.messages')} value={status?.totalMessages ?? 0} color="primary" />
                </StatCardGrid>
                <StatCardGrid minWidth={200} gap={8}>
                  <StatCard title={t('mllpMon.stat.uptime')} value={uptimeText} color="primary" />
                  <StatCard title="TLS" value={status?.tlsEnabled ? t('mllpMon.on') : t('mllpMon.off')} color={status?.tlsEnabled ? 'success' : '#999'} />
                </StatCardGrid>
                <DividerCustom label={t('mllpMon.whitelist')} />
                {status?.whitelist?.length ? (
                  <Space size={4} wrap>
                    {status.whitelist.map((cidr) => <Tag key={cidr} color="geekblue">{cidr}</Tag>)}
                  </Space>
                ) : <Tag>{t('mllpMon.notConfigured')}</Tag>}
              </Space>
            )}
          </Card>

          <Card size="small" title={<Space><Network size={14} />{t('mllpMon.connectionEvents')}</Space>}>
            {loading ? <Spin /> : logs.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <DataTable
                rowKey="id" scroll={{ x: 'max-content' }} pagination={logsPagination.pagination}
                dataSource={logsPagination.pageData}
                columns={[
                  { title: t('mllpMon.col.event'), dataIndex: 'event', width: 90, render: (v: string) => <Tag color={v === 'error' ? 'red' : v === 'message' ? 'blue' : 'default'}>{EVENT_LABEL[v] ?? v}</Tag> },
                  { title: t('mllpMon.col.peer'), dataIndex: 'peer', ellipsis: true },
                  { title: t('mllpMon.col.time'), dataIndex: 'timestamp', width: 130, render: (v: string) => new Date(v).toLocaleTimeString('zh-CN') },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Tabs
            items={[
              {
                key: 'live',
                label: <Space><Cpu size={13} />{t('mllpMon.tab.live')}</Space>,
                children: <MllpMonitor />,
              },
              {
                key: 'archive',
                label: <Space><Activity size={13} />{t('mllpMon.tab.archive')}</Space>,
                children: (
                  <Card size="small" extra={
                    <Select
                      size="small"
                      style={{ width: 140 }}
                      placeholder={t('mllpMon.ph.messageType')}
                      allowClear
                      value={msgType || undefined}
                      onChange={(v) => setMsgType(v ?? '')}
                      options={['ORM', 'ORU', 'ADT', 'DFT'].map((mt) => ({ value: mt, label: mt }))}
                    />
                  }>
                    {loading ? (
                      <div style={{ textAlign: 'center', padding: 'var(--space-8, 32px)' }}><Spin /></div>
                    ) : archive.length === 0 ? <Empty image={<BellOff size={48} style={{opacity:0.4}}/>} description={t('mllpMon.emptyArchive')} /> : (
                      <DataTable
                        rowKey="id"
                        dataSource={archivePagination.pageData}
                        pagination={archivePagination.pagination}
                        columns={[
                          { title: 'ID', dataIndex: 'id', width: 60 },
                          { title: t('mllpMon.col.messageType'), dataIndex: 'messageType', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
                          { title: t('mllpMon.col.direction'), dataIndex: 'direction', width: 90, render: (v: string) => <Tag color={v === 'INBOUND' ? 'green' : v === 'OUTBOUND' ? 'purple' : 'orange'}>{DIRECTION_LABEL[v] ?? v}</Tag> },
                          { title: 'ACK', dataIndex: 'ackStatus', width: 90, render: (v: string) => <Tag color={ACK_META[v]?.color}>{ACK_META[v]?.label ?? v}</Tag> },
                          { title: t('mllpMon.col.controlId'), dataIndex: 'controlId', width: 130, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
                          { title: t('mllpMon.col.retry'), dataIndex: 'retryCount', width: 60 },
                          { title: t('mllpMon.col.time'), dataIndex: 'createdAt', width: 150, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
                        ]}
                      scroll={{ x: 'max-content' }}
                      />
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </PageContainer>
  );
};

const DividerCustom: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-1, 4px)' }}>{label}</div>
);

export default MllpMonitorPage;

/**
 * G005 v3.0.6.11-75 W3-1 - MLLP 监控页
 * hl7Api 真实端点: 服务状态 + 连接日志 + 消息档案; 30s 轮询; loading/error
 */
import { MllpMonitor } from '../../components/integration/MllpMonitor';
import { usePagination } from '../../hooks/usePagination';
import { hl7Api } from '../../services/api/integrationApi';
import { ConnectionLogEntry, Hl7ArchiveRecord, MllpStatus } from '../../services/api/integrationApi'
import {
  Card, Space, Tag, Button, Row, Col, Statistic, Table, Alert, Spin, Tabs, Select, Empty, message, Badge,
} from 'antd';
import { Activity, Server, BookOpen, Cpu, Network, Play, Square, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react'

const POLL_MS = 30_000;

const ACK_META: Record<string, { color: string; label: string }> = {
  SUCCESS: { color: 'success', label: '成功' },
  FAILED: { color: 'error', label: '失败' },
  PENDING: { color: 'warning', label: '待确认' },
};

const DIRECTION_LABEL: Record<string, string> = { INBOUND: '入站', OUTBOUND: '出站' };

const EVENT_LABEL: Record<string, string> = { connect: '连接', disconnect: '断开', message: '消息', error: '错误' };

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
      setError(e instanceof Error ? e.message : 'MLLP 数据加载失败');
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
      if (res.success) { message.success('MLLP 服务已启动'); void fetchAll() }
      else message.error(res.error?.message ?? '启动失败');
    } catch (e) { message.error(e instanceof Error ? e.message : '启动失败') } finally { setOperating(false) }
  };

  const handleStop = async () => {
    setOperating(true);
    try {
      const res = await hl7Api.stopMllp();
      if (res.success) { message.success('MLLP 服务已停止'); void fetchAll() }
      else message.error(res.error?.message ?? '停止失败');
    } catch (e) { message.error(e instanceof Error ? e.message : '停止失败') } finally { setOperating(false) }
  };

  const uptimeText = status ? `${Math.floor((status.uptimeMs ?? 0) / 3600000)}h ${Math.floor(((status.uptimeMs ?? 0) % 3600000) / 60000)}m` : '-';

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Card size="small" className="shadow-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Activity size={18} color="#7c3aed" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>MLLP 监控</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>HL7 v2.x Minimal Lower Layer Protocol · TCP {status?.port ?? 2575}</div>
            </div>
          </Space>
          <Space wrap>
            <Badge status={status?.running ? 'processing' : 'default'} text={status?.running ? '运行中' : '已停止'} />
            <Tag color="purple">v3.0.6.11-75</Tag>
            <Tag color="cyan">30s 自动轮询</Tag>
            <Button size="small" icon={<BookOpen size={12} />} onClick={() => navigate('/integration/ihe-connectathon')}>IHE Connectathon</Button>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchAll()}>刷新</Button>
          </Space>
        </div>
      </Card>

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void fetchAll()}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<Space><Server size={14} />服务状态</Space>}
            extra={
              <Space size={4}>
                {status?.running
                  ? <Button size="small" danger icon={<Square size={12} />} onClick={handleStop} loading={operating}>停止</Button>
                  : <Button size="small" type="primary" icon={<Play size={12} />} onClick={handleStart} loading={operating}>启动</Button>}
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            {loading ? <Spin /> : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Row gutter={8}>
                  <Col span={8}><Statistic title="端口" value={status?.port ?? '-'} valueStyle={{ fontSize: 18 }} /></Col>
                  <Col span={8}><Statistic title="连接数" value={status?.totalConnections ?? 0} valueStyle={{ fontSize: 18 }} /></Col>
                  <Col span={8}><Statistic title="消息数" value={status?.totalMessages ?? 0} valueStyle={{ fontSize: 18 }} /></Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}><Statistic title="运行时长" value={uptimeText} valueStyle={{ fontSize: 16 }} /></Col>
                  <Col span={12}><Statistic title="TLS" value={status?.tlsEnabled ? '开启' : '关闭'} valueStyle={{ fontSize: 16, color: status?.tlsEnabled ? '#52c41a' : '#999' }} /></Col>
                </Row>
                <DividerCustom label="白名单" />
                {status?.whitelist?.length ? (
                  <Space size={4} wrap>
                    {status.whitelist.map((cidr) => <Tag key={cidr} color="geekblue">{cidr}</Tag>)}
                  </Space>
                ) : <Tag>未配置</Tag>}
              </Space>
            )}
          </Card>

          <Card size="small" title={<Space><Network size={14} />连接事件</Space>}>
            {loading ? <Spin /> : logs.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Table
                rowKey="id" size="small" scroll={{ x: 'max-content' }} pagination={logsPagination.pagination}
                dataSource={logsPagination.pageData}
                columns={[
                  { title: '事件', dataIndex: 'event', width: 90, render: (v: string) => <Tag color={v === 'error' ? 'red' : v === 'message' ? 'blue' : 'default'}>{EVENT_LABEL[v] ?? v}</Tag> },
                  { title: '对端', dataIndex: 'peer', ellipsis: true },
                  { title: '时间', dataIndex: 'timestamp', width: 130, render: (v: string) => new Date(v).toLocaleTimeString('zh-CN') },
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
                label: <Space><Cpu size={13} />实时模拟</Space>,
                children: <MllpMonitor />,
              },
              {
                key: 'archive',
                label: <Space><Activity size={13} />消息档案</Space>,
                children: (
                  <Card size="small" extra={
                    <Select
                      size="small"
                      style={{ width: 140 }}
                      placeholder="消息类型"
                      allowClear
                      value={msgType || undefined}
                      onChange={(v) => setMsgType(v ?? '')}
                      options={['ORM', 'ORU', 'ADT', 'DFT'].map((t) => ({ value: t, label: t }))}
                    />
                  }>
                    {loading ? (
                      <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
                    ) : archive.length === 0 ? <Empty image={<BellOff size={48} style={{opacity:0.4}}/>} description="暂无 HL7 消息档案" /> : (
                      <Table
                        rowKey="id" size="small"
                        dataSource={archivePagination.pageData}
                        pagination={archivePagination.pagination}
                        columns={[
                          { title: 'ID', dataIndex: 'id', width: 60 },
                          { title: '消息类型', dataIndex: 'messageType', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
                          { title: '方向', dataIndex: 'direction', width: 90, render: (v: string) => <Tag color={v === 'INBOUND' ? 'green' : v === 'OUTBOUND' ? 'purple' : 'orange'}>{DIRECTION_LABEL[v] ?? v}</Tag> },
                          { title: 'ACK', dataIndex: 'ackStatus', width: 90, render: (v: string) => <Tag color={ACK_META[v]?.color}>{ACK_META[v]?.label ?? v}</Tag> },
                          { title: '控制标识', dataIndex: 'controlId', width: 130, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
                          { title: '重试', dataIndex: 'retryCount', width: 60 },
                          { title: '时间', dataIndex: 'createdAt', width: 150, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
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
    </div>
  );
};

const DividerCustom: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>{label}</div>
);

export default MllpMonitorPage;

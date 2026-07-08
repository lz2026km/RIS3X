/**
 * G005 放射RIS系统 v3.0.6.0 - MLLP 监控 UI
 * 30 升级点:实时连接状态 / 报文流 / ACK / 解析 / 统计 / 帧可视化
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Space, Button, Tag, Tooltip, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, InputNumber, Switch,
} from 'antd';
import {
  Activity, Play, Square, RefreshCw, Server, Wifi, WifiOff, Send, Trash2,
  CheckCircle2, AlertCircle, FileText, Code, Database, Clock, Hash,
  ChevronRight, ChevronDown, Eye, Copy, Zap,
} from 'lucide-react';
import { getDefaultMllpServer, Hl7MllpServer } from '@services/integration/hl7/Hl7MllpServer';
import { parse, validate, type Hl7ParsedMessage } from '@services/integration/hl7V2/Hl7V2Parser';
import { HL7V2_SAMPLES } from '../../data/hl7v2Messages';
import type { MllpServerStats, MllpConnection, MllpEvent } from '../../types/integration';

export const MllpMonitor: React.FC = () => {
  const [server, setServer] = useState<Hl7MllpServer>(() => getDefaultMllpServer());
  const [stats, setStats] = useState<MllpServerStats>(() => server.stats());
  const [events, setEvents] = useState<MllpEvent[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [port, setPort] = useState<number>(server.getConfig().port);
  const [maxBytes, setMaxBytes] = useState<number>(server.getConfig().maxFrameBytes);
  const [autoAck, setAutoAck] = useState<boolean>(server.getConfig().autoAck);
  const [selectedEvent, setSelectedEvent] = useState<MllpEvent | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<{ raw: string; parsed: Hl7ParsedMessage | null; validation: ReturnType<typeof validate> | null } | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendSampleId, setSendSampleId] = useState<string>(HL7V2_SAMPLES[0]?.id ?? '');
  const [sendPeer, setSendPeer] = useState<string>('sim://client-1');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = (e: MllpEvent) => {
      setEvents((prev) => {
        const next = [e, ...prev];
        return next.length > 200 ? next.slice(0, 200) : next;
      });
    };
    const off = server.onMessage(handler);
    return () => { off(); };
  }, [server]);

  useEffect(() => {
    if (autoRefresh) {
      tickRef.current = setInterval(() => setStats(server.stats()), 1000);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }
  }, [autoRefresh, server]);

  const handleStart = useCallback(async () => {
    server.updateConfig({ port, maxFrameBytes: maxBytes, autoAck });
    await server.start();
    setStats(server.stats());
    message.success(`MLLP 已在端口 ${port} 启动`);
  }, [server, port, maxBytes, autoAck]);

  const handleStop = useCallback(async () => {
    await server.stop();
    setStats(server.stats());
    message.info('MLLP 已停止');
  }, [server]);

  const handleClear = useCallback(() => {
    setEvents([]);
    message.success('事件日志已清空');
  }, []);

  const handleSendSample = useCallback(() => {
    const sample = HL7V2_SAMPLES.find((s) => s.id === sendSampleId);
    if (!sample) { message.error('样本不存在'); return; }
    try {
      const ack = server.receiveFramed('\u000b' + sample.message + '\u001c\r', sendPeer);
      message.success(`已发送 ${sample.nameEn} → ACK ${ack.slice(0, 40)}...`);
    } catch (err) {
      message.error('发送失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [server, sendSampleId, sendPeer]);

  const handleEventClick = useCallback((e: MllpEvent) => {
    setSelectedEvent(e);
    if (e.type === 'message') {
      setSelectedMessage({ raw: e.raw, parsed: e.message, validation: validate(e.message) });
    } else if (e.type === 'ack') {
      const inner = e.ack.replace(/[\u000b\u001c\r]/g, '');
      const parsed = parse(inner);
      setSelectedMessage({ raw: inner, parsed, validation: validate(parsed) });
    } else {
      setSelectedMessage(null);
    }
  }, []);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="状态" value={stats.running ? '运行中' : '已停止'} prefix={stats.running ? <Wifi className="w-3 h-3" style={{ color: '#10b981' }} /> : <WifiOff className="w-3 h-3" style={{ color: '#dc2626' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="端口" value={stats.port} prefix={<Server className="w-3 h-3" style={{ color: '#7c3aed' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="连接" value={stats.connections.length} prefix={<Activity className="w-3 h-3" style={{ color: '#0891b2' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="报文" value={stats.totalMessages} prefix={<FileText className="w-3 h-3" style={{ color: '#3b82f6' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="ACK" value={stats.totalAckSent} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="错误" value={stats.totalError} prefix={<AlertCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <div className="flex items-center justify-between">
          <Space><Server className="w-4 h-4" /><span>MLLP 服务器控制</span></Space>
          <Space>
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />自动刷新
          </Space>
        </div>
      }>
        <Row gutter={8} className="mb-2">
          <Col span={4}><div className="text-xs text-slate-500">端口</div><InputNumber className="w-full" value={port} onChange={(v) => setPort(v ?? 2575)} disabled={stats.running} /></Col>
          <Col span={6}><div className="text-xs text-slate-500">最大帧字节</div><InputNumber className="w-full" value={maxBytes} onChange={(v) => setMaxBytes(v ?? 4_000_000)} disabled={stats.running} /></Col>
          <Col span={4}><div className="text-xs text-slate-500">自动 ACK</div><Switch checked={autoAck} onChange={setAutoAck} disabled={stats.running} className="mt-1" /></Col>
          <Col span={10} className="flex items-end gap-2 justify-end">
            {!stats.running ? (
              <Button type="primary" icon={<Play className="w-3 h-3" />} onClick={handleStart}>启动</Button>
            ) : (
              <Button danger icon={<Square className="w-3 h-3" />} onClick={handleStop}>停止</Button>
            )}
            <Button icon={<Send className="w-3 h-3" />} onClick={() => setSendModalOpen(true)}>发送样本</Button>
            <Button icon={<RefreshCw className="w-3 h-3" />} onClick={() => setStats(server.stats())}>刷新</Button>
            <Button icon={<Trash2 className="w-3 h-3" />} onClick={handleClear}>清空</Button>
          </Col>
        </Row>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <Card size="small" className="col-span-2 shadow-sm" title={<Space><Activity className="w-4 h-4" /><span>事件流</span><Tag>{events.length}</Tag></Space>}>
          <div className="space-y-1 max-h-[460px] overflow-y-auto">
            {events.length === 0 ? <Empty description="暂无事件" /> : events.map((e, i) => (
              <div key={i} onClick={() => handleEventClick(e)} className={`p-1.5 border rounded cursor-pointer text-xs ${selectedEvent === e ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <Tag color={eventColor(e)}>{e.type.toUpperCase()}</Tag>
                  <span className="text-slate-400 text-[10px]">{new Date(e.ts).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-700 truncate font-mono text-[10px] mt-0.5">{eventSummary(e)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={<Space><FileText className="w-4 h-4" /><span>报文详情</span></Space>} extra={selectedEvent && <Tag color={eventColor(selectedEvent)}>{selectedEvent.type}</Tag>}>
          {selectedMessage ? (
            <Tabs
              items={[
                {
                  key: 'raw', label: '原始报文',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-[400px] font-mono whitespace-pre-wrap">{selectedMessage.raw}</pre>
                  ),
                },
                {
                  key: 'parsed', label: `段解析 (${selectedMessage.parsed?.segments.length ?? 0})`,
                  children: selectedMessage.parsed ? (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {selectedMessage.parsed.segments.map((s, i) => (
                        <div key={i} className="border-l-4 border-blue-300 pl-2 py-1 bg-slate-50">
                          <div className="text-xs font-semibold text-blue-700">{s.name}</div>
                          <div className="text-[10px] font-mono text-slate-600 break-all">
                            {s.fields.slice(0, 8).map((f, j) => (
                              <span key={j} className="mr-2">[{j}]{f.raw}</span>
                            ))}
                            {s.fields.length > 8 && <span className="text-slate-400">… +{s.fields.length - 8}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <Empty />,
                },
                {
                  key: 'meta', label: '元信息',
                  children: selectedMessage.parsed ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <KV k="类型" v={selectedMessage.parsed.messageType} />
                      <KV k="版本" v={selectedMessage.parsed.version} />
                      <KV k="控制 ID" v={selectedMessage.parsed.messageControlId} />
                      <KV k="发送方" v={`${selectedMessage.parsed.sendingApplication}@${selectedMessage.parsed.sendingFacility}`} />
                      <KV k="接收方" v={`${selectedMessage.parsed.receivingApplication}@${selectedMessage.parsed.receivingFacility}`} />
                      <KV k="时间戳" v={selectedMessage.parsed.timestamp} />
                      <KV k="段数" v={String(selectedMessage.parsed.segments.length)} />
                      <KV k="患者" v={selectedMessage.parsed.patient ? '有' : '无'} />
                    </div>
                  ) : <Empty />,
                },
                {
                  key: 'validate', label: '验证',
                  children: selectedMessage.validation ? (
                    <div className="space-y-1">
                      <Alert type={selectedMessage.validation.passed ? 'success' : 'error'} showIcon message={selectedMessage.validation.passed ? '✓ 验证通过' : `✗ ${selectedMessage.validation.errors} 个错误`} />
                      {selectedMessage.validation.issues.map((iss, i) => (
                        <div key={i} className={`p-1.5 text-xs rounded ${iss.level === 'error' ? 'bg-red-50 text-red-700' : iss.level === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50'}`}>
                          <Tag color={iss.level === 'error' ? 'red' : iss.level === 'warning' ? 'orange' : 'default'}>{iss.code}</Tag>
                          {iss.message}
                          {iss.segment && <span className="text-slate-500"> @ {iss.segment}-{iss.field}</span>}
                        </div>
                      ))}
                    </div>
                  ) : <Empty />,
                },
              ]}
            />
          ) : <Empty description="点击事件查看详情" />}
        </Card>
      </div>

      <Card size="small" className="shadow-sm" title={<Space><Database className="w-4 h-4" /><span>连接池</span></Space>}>
        <ConnectionList list={stats.connections} onDisconnect={(p) => server.disconnect(p)} />
      </Card>

      <Modal
        title={<Space><Send className="w-4 h-4" /><span>发送样本报文</span></Space>}
        open={sendModalOpen}
        onCancel={() => setSendModalOpen(false)}
        onOk={handleSendSample}
        okText="发送"
      >
        <Form layout="vertical">
          <Form.Item label="目标 Peer">
            <Input value={sendPeer} onChange={(e) => setSendPeer(e.target.value)} prefix={<Zap className="w-3 h-3" />} />
          </Form.Item>
          <Form.Item label="选择样本">
            <Select value={sendSampleId} onChange={setSendSampleId} className="w-full"
              options={HL7V2_SAMPLES.map((s) => ({ value: s.id, label: `${s.nameEn} (${s.type}^${s.trigger})` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const KV: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="p-1.5 bg-slate-50 rounded">
    <div className="text-slate-500 text-[10px]">{k}</div>
    <div className="font-mono text-slate-700 break-all">{v || '-'}</div>
  </div>
);

const ConnectionList: React.FC<{ list: MllpConnection[]; onDisconnect: (p: string) => void }> = ({ list, onDisconnect }) => {
  if (list.length === 0) return <Empty description="暂无连接" />;
  return (
    <div className="space-y-1">
      {list.map((c) => (
        <div key={c.id} className="flex items-center justify-between p-2 border rounded text-xs">
          <div className="flex items-center gap-2">
            <Tag color={c.status === 'connected' ? 'green' : c.status === 'idle' ? 'orange' : 'red'}>{c.status}</Tag>
            <span className="font-mono">{c.remote}</span>
            <span className="text-slate-500">消息: {c.messages}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px]">{new Date(c.lastActivity).toLocaleTimeString()}</span>
            <Button size="small" danger onClick={() => onDisconnect(c.remote)}>断开</Button>
          </div>
        </div>
      ))}
    </div>
  );
};

function eventColor(e: MllpEvent): string {
  switch (e.type) {
    case 'start': return 'blue';
    case 'stop': return 'default';
    case 'connect': return 'cyan';
    case 'disconnect': return 'orange';
    case 'message': return 'purple';
    case 'ack': return e.ackCode === 'AA' ? 'green' : e.ackCode === 'AE' ? 'orange' : 'red';
    case 'error': return 'red';
    default: return 'default';
  }
}

function eventSummary(e: MllpEvent): string {
  switch (e.type) {
    case 'message': return `${e.message.messageType} [${e.message.messageControlId}] (${e.bytes}B)`;
    case 'ack': return `ACK ${e.ackCode} [${e.controlId}]`;
    case 'connect': return `${e.peer} connected`;
    case 'disconnect': return `${e.peer} disconnected (${e.reason ?? 'n/a'})`;
    case 'start': return `server started on :${e.port}`;
    case 'stop': return 'server stopped';
    case 'error': return `${e.code ?? 'ERR'}: ${e.message}`;
  }
}

export default MllpMonitor;

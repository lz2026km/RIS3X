/**
 * G005 放射RIS系统 v3.0.6.0 - MLLP 监控 UI
 * 30 升级点:实时连接状态 / 报文流 / ACK / 解析 / 统计 / 帧可视化
 */

import { HL7V2_SAMPLES } from '../../data/hl7v2Messages';
import type { MllpServerStats, MllpConnection, MllpEvent } from '../../types/integration';
import { getDefaultMllpServer, Hl7MllpServer } from '@services/integration/hl7/Hl7MllpServer';
import { parse, validate, type Hl7ParsedMessage } from '@services/integration/hl7V2/Hl7V2Parser';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs, Empty, Statistic, Row, Col, Alert, InputNumber, Switch } from 'antd';
import { Activity, Play, Square, RefreshCw, Server, Wifi, WifiOff, Send, Trash2, CheckCircle2, AlertCircle, FileText, Database, Zap } from 'lucide-react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

export const MllpMonitor: React.FC = () => {
  const [server, _setServer] = useState<Hl7MllpServer>(() => getDefaultMllpServer());
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
    return undefined;
  }, [autoRefresh, server]);

  const handleStart = useCallback(async () => {
    server.updateConfig({ port, maxFrameBytes: maxBytes, autoAck });
    await server.start();
    setStats(server.stats());
    message.success(t('mllp.started', { port }));
  }, [server, port, maxBytes, autoAck]);

  const handleStop = useCallback(async () => {
    await server.stop();
    setStats(server.stats());
    message.info(t('mllp.stopped'));
  }, [server]);

  const handleClear = useCallback(() => {
    setEvents([]);
    message.success(t('mllp.logCleared'));
  }, []);

  const handleSendSample = useCallback(() => {
    const sample = HL7V2_SAMPLES.find((s) => s.id === sendSampleId);
    if (!sample) { message.error(t('mllp.sampleNotFound')); return; }
    try {
      const ack = server.receiveFramed('\u000b' + sample.message + '\u001c\r', sendPeer);
      message.success(t('mllp.sentSample', { name: sample.nameEn, ack: ack.slice(0, 40) }));
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
        <Col span={4}><Card size="small"><Statistic title={t('mllp.stat.status')} value={stats.running ? t('mllp.running') : t('mllp.stoppedState')} prefix={stats.running ? <Wifi className="w-3 h-3" style={{ color: '#10b981' }} /> : <WifiOff className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('mllp.stat.port')} value={stats.port} prefix={<Server className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('mllp.stat.connections')} value={stats.connections.length} prefix={<Activity className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('mllp.stat.messages')} value={stats.totalMessages} prefix={<FileText className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('mllp.stat.ack')} value={stats.totalAckSent} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('mllp.stat.errors')} value={stats.totalError} prefix={<AlertCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <div className="flex items-center justify-between">
          <Space><Server className="w-4 h-4" /><span>{t('mllp.controlTitle')}</span></Space>
          <Space>
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />{t('mllp.autoRefresh')}
          </Space>
        </div>
      }>
        <Row gutter={8} className="mb-2">
          <Col span={4}><div className="text-xs text-slate-500">{t('mllp.port')}</div><InputNumber className="w-full" value={port} onChange={(v) => setPort(v ?? 2575)} disabled={stats.running} /></Col>
          <Col span={6}><div className="text-xs text-slate-500">{t('mllp.maxFrameBytes')}</div><InputNumber className="w-full" value={maxBytes} onChange={(v) => setMaxBytes(v ?? 4_000_000)} disabled={stats.running} /></Col>
          <Col span={4}><div className="text-xs text-slate-500">{t('mllp.autoAck')}</div><Switch checked={autoAck} onChange={setAutoAck} disabled={stats.running} className="mt-1" /></Col>
          <Col span={10} className="flex items-end gap-2 justify-end">
            {!stats.running ? (
              <Button type="primary" icon={<Play className="w-3 h-3" />} onClick={handleStart}>{t('mllp.start')}</Button>
            ) : (
              <Button danger icon={<Square className="w-3 h-3" />} onClick={handleStop}>{t('mllp.stop')}</Button>
            )}
            <Button icon={<Send className="w-3 h-3" />} onClick={() => setSendModalOpen(true)}>{t('mllp.sendSample')}</Button>
            <Button icon={<RefreshCw className="w-3 h-3" />} onClick={() => setStats(server.stats())}>{t('mllp.refresh')}</Button>
            <Button icon={<Trash2 className="w-3 h-3" />} onClick={handleClear}>{t('mllp.clear')}</Button>
          </Col>
        </Row>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <Card size="small" className="col-span-2 shadow-sm" title={<Space><Activity className="w-4 h-4" /><span>{t('mllp.eventStream')}</span><Tag>{events.length}</Tag></Space>}>
          <div className="space-y-1 max-h-[460px] overflow-y-auto">
            {events.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('mllp.noEvents')} /> : events.map((e, i) => (
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

        <Card size="small" className="col-span-3 shadow-sm" title={<Space><FileText className="w-4 h-4" /><span>{t('mllp.messageDetail')}</span></Space>} extra={selectedEvent && <Tag color={eventColor(selectedEvent)}>{selectedEvent.type}</Tag>}>
          {selectedMessage ? (
            <Tabs
              items={[
                {
                  key: 'raw', label: t('mllp.tab.raw'),
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-[400px] font-mono whitespace-pre-wrap">{selectedMessage.raw}</pre>
                  ),
                },
                {
                  key: 'parsed', label: t('mllp.tab.segmentParse', { count: selectedMessage.parsed?.segments.length ?? 0 }),
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
                  ) : <Empty description={t('mllp.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />,
                },
                {
                  key: 'meta', label: t('mllp.tab.meta'),
                  children: selectedMessage.parsed ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <KV k={t('mllp.meta.type')} v={selectedMessage.parsed.messageType} />
                      <KV k={t('mllp.meta.version')} v={selectedMessage.parsed.version} />
                      <KV k={t('mllp.meta.controlId')} v={selectedMessage.parsed.messageControlId} />
                      <KV k={t('mllp.meta.sender')} v={`${selectedMessage.parsed.sendingApplication}@${selectedMessage.parsed.sendingFacility}`} />
                      <KV k={t('mllp.meta.receiver')} v={`${selectedMessage.parsed.receivingApplication}@${selectedMessage.parsed.receivingFacility}`} />
                      <KV k={t('mllp.meta.timestamp')} v={selectedMessage.parsed.timestamp} />
                      <KV k={t('mllp.meta.segmentCount')} v={String(selectedMessage.parsed.segments.length)} />
                      <KV k={t('mllp.meta.patient')} v={selectedMessage.parsed.patient ? t('mllp.yes') : t('mllp.no')} />
                    </div>
                  ) : <Empty description={t('mllp.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />,
                },
                {
                  key: 'validate', label: t('mllp.tab.validate'),
                  children: selectedMessage.validation ? (
                    <div className="space-y-1">
                      <Alert type={selectedMessage.validation.passed ? 'success' : 'error'} showIcon title={selectedMessage.validation.passed ? t('mllp.validatePassed') : t('mllp.validateErrors', { count: selectedMessage.validation.errors })} />
                      {selectedMessage.validation.issues.map((iss, i) => (
                        <div key={i} className={`p-1.5 text-xs rounded ${iss.level === 'error' ? 'bg-red-50 text-red-700' : iss.level === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50'}`}>
                          <Tag color={iss.level === 'error' ? 'red' : iss.level === 'warning' ? 'orange' : 'default'}>{iss.code}</Tag>
                          {iss.message}
                          {iss.segment && <span className="text-slate-500"> @ {iss.segment}-{iss.field}</span>}
                        </div>
                      ))}
                    </div>
                  ) : <Empty description={t('mllp.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />,
                },
              ]}
            />
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('mllp.clickEvent')} />}
        </Card>
      </div>

      <Card size="small" className="shadow-sm" title={<Space><Database className="w-4 h-4" /><span>{t('mllp.connectionPool')}</span></Space>}>
        <ConnectionList list={stats.connections} onDisconnect={(p) => server.disconnect(p)} />
      </Card>

      <Modal
        title={<Space><Send className="w-4 h-4" /><span>{t('mllp.sendModalTitle')}</span></Space>}
        open={sendModalOpen}
        onCancel={() => setSendModalOpen(false)}
        onOk={handleSendSample}
        okText={t('mllp.send')}
      >
        <Form layout="vertical">
          <Form.Item label={t('mllp.targetPeer')}>
            <Input value={sendPeer} onChange={(e) => setSendPeer(e.target.value)} prefix={<Zap className="w-3 h-3" />} />
          </Form.Item>
          <Form.Item label={t('mllp.selectSample')}>
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
  if (list.length === 0) return <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('mllp.noConnections')} />;
  return (
    <div className="space-y-1">
      {list.map((c) => (
        <div key={c.id} className="flex items-center justify-between p-2 border rounded text-xs">
          <div className="flex items-center gap-2">
            <Tag color={c.status === 'connected' ? 'green' : c.status === 'idle' ? 'orange' : 'red'}>{c.status}</Tag>
            <span className="font-mono">{c.remote}</span>
            <span className="text-slate-500">{t('mllp.messagesLabel')} {c.messages}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px]">{new Date(c.lastActivity).toLocaleTimeString()}</span>
            <Button size="small" danger onClick={() => onDisconnect(c.remote)}>{t('mllp.disconnect')}</Button>
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
    case 'connect': return t('mllp.event.connected', { peer: e.peer });
    case 'disconnect': return t('mllp.event.disconnected', { peer: e.peer, reason: e.reason ?? 'n/a' });
    case 'start': return t('mllp.event.started', { port: e.port });
    case 'stop': return t('mllp.event.stopped');
    case 'error': return `${e.code ?? 'ERR'}: ${e.message}`;
  }
}

export default MllpMonitor;

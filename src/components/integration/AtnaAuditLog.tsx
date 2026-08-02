/**
 * G005 放射RIS系统 v3.0.6.0 - ATNA 审计日志查看器
 * 20 升级点:事件查询 / 哈希链验证 / 导出 / SYSLOG / 事件录入
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, InputNumber, Badge,
} from 'antd';
import {
  Shield, Search, Download, Trash2, CheckCircle2, AlertCircle, Activity,
  Hash, RefreshCw, Eye, Code, FileText, Database, Lock, ChevronRight,
} from 'lucide-react';
import {
  logEvent, queryLog, verifyChain, exportLog, getLogStats, purgeExpired,
  logPatientRecordEvent, logReportViewEvent, logDicomExportEvent, logLoginEvent,
  toSyslogRfc5424,
} from '@services/integration/audit/AtnaLogger';
import type { AtnaAuditLogEntry, AtnaEventOutcome, AtnaEventAction } from '../../types/integration';

export const AtnaAuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AtnaAuditLogEntry[]>([]);
  const [stats, setStats] = useState(getLogStats());
  const [chain, setChain] = useState<{ ok: boolean; brokenAt?: number; total: number }>({ ok: true, total: 0 });
  const [filters, setFilters] = useState<{ userID: string; eventCode: string; outcome: AtnaEventOutcome | ''; limit: number }>({
    userID: '', eventCode: '', outcome: '', limit: 100,
  });
  const [selected, setSelected] = useState<AtnaAuditLogEntry | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState<{
    eventId: string; outcome: AtnaEventOutcome; actionCode: AtnaEventAction; userID: string; userName: string; patientId: string;
  }>({ eventId: '110107', outcome: 'Success', actionCode: 'R', userID: 'u-001', userName: '王主任', patientId: 'p-038' });

  const refresh = useCallback(() => {
    setEntries(queryLog({ userID: filters.userID || undefined, eventCode: filters.eventCode || undefined, outcome: filters.outcome || undefined, limit: filters.limit }));
    setStats(getLogStats());
    setChain(verifyChain());
  }, [filters]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleExport = useCallback((fmt: 'json' | 'csv') => {
    const data = exportLog(fmt);
    const blob = new Blob([data], { type: fmt === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `atna-log-${Date.now()}.${fmt}`; a.click();
    URL.revokeObjectURL(url);
    message.success(`已导出 ${fmt.toUpperCase()}`);
  }, []);

  const handleLogEvent = useCallback(() => {
    const e = logEvent({
      eventId: { code: logForm.eventId, displayName: 'Custom Event', codeSystem: 'DCM' },
      outcome: logForm.outcome,
      actionCode: logForm.actionCode,
      userID: logForm.userID,
      userName: logForm.userName,
      sourceID: 'G005-RIS',
      participantObjects: [{
        participantObjectType: '1', participantObjectTypeCodeRole: '1',
        participantObjectID: logForm.patientId,
      }],
    });
    setEntries((prev) => [e, ...prev]);
    setStats(getLogStats());
    setLogOpen(false);
    message.success(`已记录 ATNA 事件 #${e.sequence}`);
  }, [logForm]);

  const handleSeed = useCallback(() => {
    for (let i = 0; i < 12; i++) {
      if (i % 4 === 0) logPatientRecordEvent({ outcome: 'Success', userID: 'u-001', userName: '王主任', sourceID: 'RIS', patientId: 'p-038', actionCode: 'C' });
      else if (i % 4 === 1) logReportViewEvent({ outcome: 'Success', userID: 'u-002', userName: '陈医师', sourceID: 'RIS', reportId: `rep-${i}`, patientId: 'p-038' });
      else if (i % 4 === 2) logDicomExportEvent({ outcome: 'Success', userID: 'u-001', userName: '王主任', sourceID: 'RIS', studyInstanceUID: `1.2.3.${i}` });
      else logLoginEvent({ outcome: i % 2 === 0 ? 'Success' : 'MinorFailure', userID: 'u-003', userName: '技术员', sourceID: 'RIS', sourceAddress: '192.168.1.10' });
    }
    refresh();
    message.success('已写入 12 条示例审计');
  }, [refresh]);

  const handlePurge = useCallback(() => {
    const n = purgeExpired();
    refresh();
    message.success(`已清理 ${n} 条过期记录`);
  }, [refresh]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="事件总数" value={stats.count} prefix={<Database className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="序列号" value={stats.sequence} prefix={<Hash className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="容量 / 保留" value={`${stats.count}/${stats.capacity}`} suffix={`${stats.retentionDays}天`} prefix={<Shield className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 14  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="哈希链" value={chain.ok ? '✓ 完整' : `✗ 断裂 @${chain.brokenAt}`} prefix={chain.ok ? <Lock className="w-3 h-3" style={{ color: '#10b981' }} /> : <AlertCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 14, color: chain.ok ? '#10b981' : '#dc2626'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="筛选结果" value={entries.length} prefix={<Search className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <div className="flex items-center justify-between">
          <Space><Search className="w-4 h-4" /><span>查询 / 过滤</span></Space>
          <Space>
            <Button size="small" icon={<Activity className="w-3 h-3" />} onClick={handleSeed}>生成示例</Button>
            <Button size="small" icon={<Shield className="w-3 h-3" />} onClick={() => setLogOpen(true)}>记录事件</Button>
            <Button size="small" icon={<RefreshCw className="w-3 h-3" />} onClick={() => { setChain(verifyChain()); refresh(); }}>验证链</Button>
            <Button size="small" icon={<Trash2 className="w-3 h-3" />} danger onClick={handlePurge}>清理过期</Button>
            <Button size="small" icon={<Download className="w-3 h-3" />} onClick={() => handleExport('json')}>JSON</Button>
            <Button size="small" icon={<Download className="w-3 h-3" />} onClick={() => handleExport('csv')}>CSV</Button>
          </Space>
        </div>
      }>
        <Row gutter={8}>
          <Col span={6}><div className="text-xs text-slate-500 mb-1">用户 ID</div><Input value={filters.userID} onChange={(e) => setFilters((f) => ({ ...f, userID: e.target.value }))} /></Col>
          <Col span={6}><div className="text-xs text-slate-500 mb-1">事件代码 (DCM)</div><Input value={filters.eventCode} onChange={(e) => setFilters((f) => ({ ...f, eventCode: e.target.value }))} placeholder="110110 / 110107" /></Col>
          <Col span={6}><div className="text-xs text-slate-500 mb-1">结果</div><Select value={filters.outcome} onChange={(v) => setFilters((f) => ({ ...f, outcome: v as AtnaEventOutcome | '' }))} className="w-full" allowClear options={[
            { value: 'Success', label: '成功' },
            { value: 'MinorFailure', label: 'MinorFailure' },
            { value: 'SeriousFailure', label: 'SeriousFailure' },
            { value: 'MajorFailure', label: 'MajorFailure' },
          ]} /></Col>
          <Col span={4}><div className="text-xs text-slate-500 mb-1">条数</div><InputNumber className="w-full" min={1} max={1000} value={filters.limit} onChange={(v) => setFilters((f) => ({ ...f, limit: v ?? 100 }))} /></Col>
          <Col span={2} className="flex items-end"><Button type="primary" icon={<Search className="w-3 h-3" />} onClick={refresh} block>查询</Button></Col>
        </Row>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><FileText className="w-4 h-4" /><span>审计列表</span><Tag>{entries.length}</Tag></Space>}>
          <div className="space-y-1 max-h-[480px] overflow-y-auto">
            {entries.length === 0 ? <Empty /> : entries.map((e) => (
              <div key={e.id} onClick={() => setSelected(e)} className={`p-2 border-2 rounded cursor-pointer text-xs ${selected?.id === e.id ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <Tag color={outcomeColor(e.eventOutcome)}>{e.eventOutcome}</Tag>
                  <span className="text-[10px] text-slate-400">{new Date(e.recordedAt).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1 text-slate-700 font-mono text-[10px]">{e.eventId.code} · {e.eventId.displayName}</div>
                <div className="text-slate-500 text-[10px]">user={e.userID} action={e.eventActionCode ?? '-'}</div>
                <div className="font-mono text-[10px] text-slate-400 mt-0.5">hash: {e.hash}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="shadow-sm" title={<Space><Eye className="w-4 h-4" /><span>事件详情</span></Space>} extra={selected && <Tag color={outcomeColor(selected.eventOutcome)}>{selected.eventOutcome}</Tag>}>
          {selected ? (
            <Tabs
              tabBarExtraContent={
                <Badge
                  count={3}
                  title="事件详情 3 项"
                  style={{ backgroundColor: '#0ea5e9' }}
                />
              }
              items={[
                {
                  key: 'json', label: 'JSON',
                  children: <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-[460px] font-mono">{JSON.stringify(selected, null, 2)}</pre>,
                },
                {
                  key: 'syslog', label: 'SYSLOG',
                  children: <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-[460px] font-mono whitespace-pre-wrap">{toSyslogRfc5424(selected)}</pre>,
                },
                {
                  key: 'objects', label: `PO (${selected.participantObjects.length})`,
                  children: (
                    <div className="space-y-2">
                      {selected.participantObjects.map((p, i) => (
                        <div key={i} className="p-2 border rounded text-xs">
                          <div className="flex items-center gap-2">
                            <Tag color="blue">type {p.participantObjectType}</Tag>
                            <Tag color="cyan">role {p.participantObjectTypeCodeRole}</Tag>
                            <span className="font-mono">{p.participantObjectID}</span>
                          </div>
                          {p.participantObjectName && <div className="mt-1 text-slate-500">name: {p.participantObjectName}</div>}
                          {p.participantObjectContainsStudy && (
                            <div className="mt-1 text-slate-500">
                              contains: {p.participantObjectContainsStudy.map((s) => s.studyInstanceUID).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          ) : <Empty />}
        </Card>
      </div>

      <Modal title={<Space><Shield className="w-4 h-4" /><span>记录 ATNA 事件</span></Space>} open={logOpen} onCancel={() => setLogOpen(false)} onOk={handleLogEvent} okText="记录">
        <Form layout="vertical" size="small">
          <Form.Item label="事件代码 (DCM)"><Input value={logForm.eventId} onChange={(e) => setLogForm((f) => ({ ...f, eventId: e.target.value }))} /></Form.Item>
          <Form.Item label="结果"><Select value={logForm.outcome} onChange={(v) => setLogForm((f) => ({ ...f, outcome: v as AtnaEventOutcome }))} options={['Success', 'MinorFailure', 'SeriousFailure', 'MajorFailure'].map((v) => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="动作"><Select value={logForm.actionCode} onChange={(v) => setLogForm((f) => ({ ...f, actionCode: v as AtnaEventAction }))} options={['C', 'R', 'U', 'D', 'E'].map((v) => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="用户 ID"><Input value={logForm.userID} onChange={(e) => setLogForm((f) => ({ ...f, userID: e.target.value }))} /></Form.Item>
          <Form.Item label="用户姓名"><Input value={logForm.userName} onChange={(e) => setLogForm((f) => ({ ...f, userName: e.target.value }))} /></Form.Item>
          <Form.Item label="患者 ID (ParticipantObject)"><Input value={logForm.patientId} onChange={(e) => setLogForm((f) => ({ ...f, patientId: e.target.value }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

function outcomeColor(o: AtnaEventOutcome): string {
  if (o === 'Success') return 'green';
  if (o === 'MinorFailure') return 'orange';
  if (o === 'SeriousFailure') return 'volcano';
  return 'red';
}

export default AtnaAuditLog;

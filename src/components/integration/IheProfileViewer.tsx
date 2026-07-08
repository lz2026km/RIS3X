/**
 * G005 放射RIS系统 v3.0.6.0 - IHE Profile 查看器
 * 20 升级点:Profile 元信息 / 角色 / 事务 / 测试执行
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, Tree, List, InputNumber,
} from 'antd';
import {
  Server, FileText, Activity, Database, Globe, Layers, Play, CheckCircle2,
  XCircle, AlertCircle, ListTree, Link2, Hash, ChevronRight, Zap, Clock,
  Code2, ArrowRight, Search,
} from 'lucide-react';
import {
  IHE_PROFILES, registerDocument, provideAndRegister, queryRegistry, retrieveDocument,
  pixFeed, pixQuery, pdqQuery, sendPamMessage, getDefaultAffinityDomain, type IheProfileMeta,
} from '@services/integration/ihe/IheProfiles';
import type { IheProfileId, IheXdsDocument, IhePdqResult, IhePixFeedResult, PamResult } from '../../types/integration';

export const IheProfileViewer: React.FC = () => {
  const [selected, setSelected] = useState<IheProfileMeta>(IHE_PROFILES[0]!);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [domain] = useState(getDefaultAffinityDomain());

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="Profiles" value={IHE_PROFILES.length} prefix={<Layers className="w-3 h-3" style={{ color: '#dc2626' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Home Community" value={domain.homeCommunityId} prefix={<Globe className="w-3 h-3" style={{ color: '#3b82f6' }} />} valueStyle={{ fontSize: 12 }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Registry" value={domain.registryUniqueId} prefix={<Server className="w-3 h-3" style={{ color: '#7c3aed' }} />} valueStyle={{ fontSize: 12 }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Assigning Authority" value={domain.assigningAuthorityId} prefix={<Hash className="w-3 h-3" style={{ color: '#10b981' }} />} valueStyle={{ fontSize: 12 }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><ListTree className="w-4 h-4" /><span>IHE Profiles</span></Space>}>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {IHE_PROFILES.map((p) => (
              <div key={p.id} onClick={() => { setSelected(p); setActiveTab('overview'); }}
                className={`p-2 border-2 rounded cursor-pointer transition ${selected.id === p.id ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <Tag color="red">{p.acronym}</Tag>
                  <span className="text-[10px] text-slate-400">{p.domain}</span>
                </div>
                <div className="text-xs font-semibold mt-1">{p.nameEn}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{p.actors.length} actors · {p.transactions.length} transactions</div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Activity className="w-4 h-4" /><span>{selected.nameEn}</span><Tag color="red">{selected.acronym}</Tag></Space>
          </div>
        }>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'overview', label: '概览',
                children: (
                  <div className="space-y-2 text-xs">
                    <KV k="Profile ID" v={selected.id} />
                    <KV k="名称(中文)" v={selected.name} />
                    <KV k="名称(英文)" v={selected.nameEn} />
                    <KV k="缩写" v={selected.acronym} />
                    <KV k="领域" v={selected.domain} />
                    <KV k="Actors 数量" v={String(selected.actors.length)} />
                    <KV k="Transactions 数量" v={String(selected.transactions.length)} />
                  </div>
                ),
              },
              {
                key: 'actors', label: `角色 (${selected.actors.length})`,
                children: (
                  <Table size="small" rowKey="name" pagination={false} dataSource={selected.actors}
                    columns={[
                      { title: 'Actor', dataIndex: 'name', key: 'name', render: (v) => <Tag color="blue">{v}</Tag> },
                      { title: 'Role', dataIndex: 'role', key: 'role' },
                    ]}
                  />
                ),
              },
              {
                key: 'transactions', label: `事务 (${selected.transactions.length})`,
                children: (
                  <Table size="small" rowKey="id" pagination={false} dataSource={selected.transactions}
                    columns={[
                      { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (v) => <span className="font-mono text-cyan-600">{v}</span> },
                      { title: '名称', dataIndex: 'name', key: 'name' },
                      { title: '描述', dataIndex: 'description', key: 'description' },
                    ]}
                  />
                ),
              },
              {
                key: 'playground', label: '测试执行',
                children: <Playground profile={selected} />,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

const KV: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex border-b border-slate-100 py-1">
    <div className="w-32 text-slate-500">{k}</div>
    <div className="flex-1 font-mono break-all">{v}</div>
  </div>
);

const Playground: React.FC<{ profile: IheProfileMeta }> = ({ profile }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ type: string; payload: unknown } | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>, type: string) => {
    setBusy(true);
    setResult(null);
    const start = Date.now();
    try {
      const r = await action();
      setResult({ type, payload: { result: r, durationMs: Date.now() - start } });
      message.success(`${type} 完成`);
    } catch (err) {
      message.error('执行失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <Alert type="info" showIcon message={`当前 Profile: ${profile.nameEn}`} description="点击下方按钮可触发相应的 IHE 交易(浏览器内 mock 实现)" />
      <div className="grid grid-cols-2 gap-2">
        {profile.id === 'XDS.b' && (
          <>
            <Button block icon={<Zap className="w-3 h-3" />} loading={busy} onClick={() => run(async () => registerDocument({
              patientId: 'p-038', title: '测试报告',
              classCode: { code: '51852-2', display: 'Letter' },
              typeCode: { code: '51848-0', display: 'Radiology Report' },
              formatCode: { code: 'application/pdf', display: 'PDF' },
              mimeType: 'application/pdf', content: 'sample',
            }), 'registerDocument')} >注册文档</Button>
            <Button block icon={<Search className="w-3 h-3" />} loading={busy} onClick={() => run(async () => queryRegistry({ patientId: 'p-038' }), 'queryRegistry')}>查询 Registry</Button>
            <Button block icon={<Link2 className="w-3 h-3" />} loading={busy} onClick={() => run(async () => provideAndRegister({
              submissionSetId: `ss-${Date.now()}`,
              patientId: 'p-038', sourceId: '1.2.3.4', submissionTime: '20260619103000',
              author: { person: 'D001', institution: 'H001', role: 'attending', specialty: 'radiology' },
              contentTypeCode: '51852-2',
              documentEntries: [],
            }), 'provideAndRegister')}>提供并注册</Button>
            <Button block icon={<Database className="w-3 h-3" />} loading={busy} onClick={() => run(async () => retrieveDocument('urn:uuid:xxx'), 'retrieveDocument')}>检索文档</Button>
          </>
        )}
        {profile.id === 'PIX' && (
          <>
            <Button block icon={<Zap className="w-3 h-3" />} loading={busy} onClick={() => run(async () => pixFeed({
              patientId: 'p-038', assigningAuthority: '1.2.3.4', identifiers: [{ domain: 'H001', value: 'P0001', assigningAuthority: 'H001' }],
              name: { family: '张', given: ['三'] }, birthDate: '19800101', gender: 'M',
            }), 'pixFeed')}>PIX Feed</Button>
            <Button block icon={<Search className="w-3 h-3" />} loading={busy} onClick={() => run(async () => pixQuery('P0001', 'H001', ['G005', 'EMR']), 'pixQuery')}>PIX Query</Button>
          </>
        )}
        {profile.id === 'PDQ' && (
          <Button block icon={<Search className="w-3 h-3" />} loading={busy} onClick={() => run(async () => pdqQuery({ familyName: '张', gender: 'M' }), 'pdqQuery')}>PDQ 查询</Button>
        )}
        {profile.id === 'PAM' && (
          <Button block icon={<Zap className="w-3 h-3" />} loading={busy} onClick={() => run(async () => sendPamMessage({
            messageType: 'ADT^A01', patientId: 'p-038', assigningAuthority: '1.2.3.4',
            visitNumber: 'VN-001', classCode: 'O', attendingDoctor: 'D001',
            assignedLocation: { facility: 'CT Room' },
          }), 'sendPamMessage')}>ADT^A01</Button>
        )}
        {profile.id === 'ATNA' && (
          <Button block icon={<Activity className="w-3 h-3" />} loading={busy} onClick={() => run(async () => ({ sent: true, endpoint: 'audit://g005.local/iti-20', ts: new Date().toISOString() }), 'atnaAudit')}>发送审计</Button>
        )}
        {!['XDS.b', 'PIX', 'PDQ', 'PAM', 'ATNA'].includes(profile.id) && (
          <Alert type="warning" message={`${profile.nameEn} 暂未提供 mock 交易执行`} />
        )}
      </div>
      {result && (
        <Card size="small" title={<Space><Code2 className="w-4 h-4" /><span>{result.type} 响应</span></Space>}>
          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-[300px] font-mono">{JSON.stringify(result.payload, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
};

export default IheProfileViewer;

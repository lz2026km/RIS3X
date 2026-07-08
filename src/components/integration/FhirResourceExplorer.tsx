/**
 * G005 放射RIS系统 v3.0.6.0 - FHIR 资源浏览器
 * 30 升级点:CRUD / 搜索 / Bundle / 验证 / 资源类型切换 / 资源创建表单
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card, Space, Button, Tag, Tooltip, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, Tree, InputNumber, Switch,
} from 'antd';
import {
  Braces, Database, Search, Plus, Trash2, Edit3, Save, X, Eye, Copy,
  CheckCircle2, AlertCircle, FileJson, Server, Activity, Layers,
  RefreshCw, Download, Globe, Send, ChevronRight, ListFilter, ListTree,
} from 'lucide-react';
import { getDefaultFhirServer, FhirServer, RESOURCE_TYPES } from '@services/integration/fhir/FhirServer';
import { FHIR_SAMPLES } from '../../data/fhirResources';
import type { FhirResourceEnvelope, FhirOperationOutcome } from '../../types/integration';

export const FhirResourceExplorer: React.FC = () => {
  const [server, setServer] = useState<FhirServer>(() => getDefaultFhirServer());
  const [type, setType] = useState<string>('Patient');
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [results, setResults] = useState<FhirResourceEnvelope[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ type: string; id: string; json: string } | null>(null);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleKind, setBundleKind] = useState<'collection' | 'transaction'>('collection');
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [operationOutcome, setOperationOutcome] = useState<FhirOperationOutcome | null>(null);

  useEffect(() => {
    const handle = setResults(server.listByType(type));
    return () => { clearTimeout(handle); };
  }, [server, type]);

  const handleSearch = useCallback(() => {
    const r = server.search(type, searchParams);
    if ('entry' in r && r.type === 'searchset') {
      setResults(r.entry.map((e) => ({
        resourceType: type as never,
        id: ((e.resource as { id?: string })?.id ?? ''),
        resource: e.resource as Record<string, unknown>,
      })));
    } else {
      setOperationOutcome(r as FhirOperationOutcome);
    }
  }, [server, type, searchParams]);

  const handleSeed = useCallback(() => {
    let n = 0;
    FHIR_SAMPLES.filter((s) => s.resourceType === type).forEach((s) => {
      const r = server.create(s.resource as Record<string, unknown>);
      if (r.ok) n += 1;
    });
    setResults(server.listByType(type));
    setSeedMessage(`已加载 ${n} 个 ${type} 样本`);
    setTimeout(() => setSeedMessage(null), 3000);
  }, [server, type]);

  const handleDelete = useCallback((id: string) => {
    Modal.confirm({
      title: `确认删除 ${type}/${id}?`,
      onOk: () => {
        const r = server.delete(type, id);
        if (r.ok) {
          message.success('已删除');
          setResults(server.listByType(type));
          if (selectedId === id) setSelectedId(null);
        } else {
          setOperationOutcome(r.outcome);
        }
      },
    });
  }, [server, type, selectedId]);

  const handleEdit = useCallback((id: string) => {
    const r = server.read(type, id);
    if (!r) return;
    setEditing({ type, id, json: JSON.stringify((r.resource as { resource: Record<string, unknown> }).resource, null, 2) });
  }, [server, type]);

  const handleUpdateSave = useCallback(() => {
    if (!editing) return;
    try {
      const obj = JSON.parse(editing.json) as Record<string, unknown>;
      const r = server.update(editing.type, editing.id, obj);
      if (r.ok) {
        message.success('已更新');
        setEditing(null);
        setResults(server.listByType(editing.type));
      } else {
        setOperationOutcome(r.outcome);
      }
    } catch (err) {
      message.error('JSON 解析失败');
    }
  }, [editing, server]);

  const handleBuildBundle = useCallback(() => {
    const rs = server.listByType(type);
    if (rs.length === 0) { message.warning('无资源'); return; }
    const bundle = {
      resourceType: 'Bundle' as const,
      type: bundleKind,
      total: rs.length,
      entry: rs.map((r) => ({
        resource: r.resource,
        fullUrl: `${server.getBaseUrl()}/${r.resourceType}/${r.id}`,
        request: bundleKind === 'transaction' ? { method: 'POST', url: r.resourceType } : undefined,
      })),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bundle-${type}-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    setBundleOpen(false);
    message.success(`Bundle 已导出 (${rs.length} 资源)`);
  }, [server, type, bundleKind]);

  const selected = useMemo(() => results.find((r) => r.id === selectedId) ?? null, [results, selectedId]);
  const stats = server.metadata();
  const allTypes = useMemo(() => Array.from(new Set([...RESOURCE_TYPES, ...stats.types])), [stats.types]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="资源总数" value={stats.total} prefix={<Database className="w-3 h-3" style={{ color: '#ea580c' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="资源类型" value={stats.types.length} prefix={<ListTree className="w-3 h-3" style={{ color: '#7c3aed' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="FHIR Server" value={server.getBaseUrl()} prefix={<Server className="w-3 h-3" style={{ color: '#0891b2' }} />} valueStyle={{ fontSize: 13 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="FHIR 版本" value={server.getVersion()} prefix={<Globe className="w-3 h-3" style={{ color: '#10b981' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="审计" value={server.getAuditLog().length} prefix={<Activity className="w-3 h-3" style={{ color: '#dc2626' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <div className="flex items-center justify-between">
          <Space><Search className="w-4 h-4" /><span>搜索</span></Space>
          <Space>
            <Button size="small" icon={<Database className="w-3 h-3" />} onClick={handleSeed}>加载样本</Button>
            <Button size="small" icon={<Plus className="w-3 h-3" />} type="primary" onClick={() => setCreateOpen(true)}>新建</Button>
            <Button size="small" icon={<Layers className="w-3 h-3" />} onClick={() => setBundleOpen(true)}>Bundle</Button>
          </Space>
        </div>
      }>
        <Row gutter={8}>
          <Col span={4}>
            <div className="text-xs text-slate-500 mb-1">资源类型</div>
            <Select className="w-full" value={type} onChange={setType} showSearch
              options={allTypes.map((t) => ({ value: t, label: t }))} />
          </Col>
          <Col span={6}>
            <div className="text-xs text-slate-500 mb-1">_id</div>
            <Input value={searchParams['_id'] ?? ''} onChange={(e) => setSearchParams((p) => ({ ...p, _id: e.target.value }))} placeholder="资源 ID" />
          </Col>
          <Col span={4}>
            <div className="text-xs text-slate-500 mb-1">状态 / 性别</div>
            <Input value={searchParams['status'] ?? searchParams['gender'] ?? ''} onChange={(e) => setSearchParams((p) => ({ ...p, status: e.target.value, gender: e.target.value }))} />
          </Col>
          <Col span={6}>
            <div className="text-xs text-slate-500 mb-1">姓名 / 标识</div>
            <Input value={searchParams['name'] ?? searchParams['identifier'] ?? ''} onChange={(e) => setSearchParams((p) => ({ ...p, name: e.target.value, identifier: e.target.value }))} />
          </Col>
          <Col span={4} className="flex items-end gap-2">
            <Button type="primary" icon={<Search className="w-3 h-3" />} onClick={handleSearch}>搜索</Button>
            <Button icon={<RefreshCw className="w-3 h-3" />} onClick={() => { setSearchParams({}); setResults(server.listByType(type)); }}>重置</Button>
          </Col>
        </Row>
        {seedMessage && <Alert className="mt-2" type="success" showIcon message={seedMessage} />}
        {operationOutcome && <Alert className="mt-2" type="error" showIcon message={`${operationOutcome.issue[0]?.code ?? 'error'}: ${operationOutcome.issue[0]?.diagnostics ?? ''}`} closable onClose={() => setOperationOutcome(null)} />}
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <Card size="small" className="col-span-2 shadow-sm" title={<Space><ListFilter className="w-4 h-4" /><span>资源列表 ({type})</span><Tag>{results.length}</Tag></Space>}>
          {results.length === 0 ? <Empty description="无资源" /> : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-2 border-2 rounded cursor-pointer text-xs ${selectedId === r.id ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <Tag color="orange">{r.resourceType}</Tag>
                    <Tag color="blue">{r.id}</Tag>
                  </div>
                  <div className="mt-1 text-slate-700 truncate font-mono text-[10px]">{resourceDisplay(r.resource)}</div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <Button size="small" type="text" icon={<Edit3 className="w-3 h-3" />} onClick={(e) => { e.stopPropagation(); handleEdit(r.id); }} />
                    <Button size="small" type="text" danger icon={<Trash2 className="w-3 h-3" />} onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><FileJson className="w-4 h-4" /><span>资源详情</span></Space>
            {selected && <Tag color="orange">{selected.resourceType}/{selected.id}</Tag>}
          </div>
        }>
          {selected ? (
            <Tabs
              items={[
                {
                  key: 'json', label: 'JSON',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">{JSON.stringify(selected.resource, null, 2)}</pre>
                  ),
                },
                {
                  key: 'overview', label: '概览',
                  children: (
                    <div className="space-y-2 text-xs">
                      <KV k="resourceType" v={String(selected.resource['resourceType'])} />
                      <KV k="id" v={String(selected.resource['id'] ?? '')} />
                      <KV k="status" v={String(selected.resource['status'] ?? '-')} />
                      <KV k="subject" v={displayRef(selected.resource['subject'])} />
                      <KV k="code" v={displayCode(selected.resource['code'])} />
                      <KV k="effective" v={String(selected.resource['effectiveDateTime'] ?? selected.resource['birthDate'] ?? '-')} />
                    </div>
                  ),
                },
              ]}
            />
          ) : <Empty description="选择资源查看详情" />}
        </Card>
      </div>

      <Modal title={<Space><Plus className="w-4 h-4" /><span>创建 {type}</span></Space>} open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} width={680}>
        <CreateResource type={type} onSubmit={(r) => {
          const res = server.create(r as Record<string, unknown>);
          if (res.ok) {
            message.success(`已创建 ${res.resource.resourceType}/${res.resource.id}`);
            setResults(server.listByType(type));
            setCreateOpen(false);
          } else {
            setOperationOutcome(res.outcome);
          }
        }} />
      </Modal>

      <Modal title={<Space><Edit3 className="w-4 h-4" /><span>编辑 {editing?.type}/{editing?.id}</span></Space>} open={!!editing} onCancel={() => setEditing(null)} onOk={handleUpdateSave} okText="保存" width={680}>
        <Input.TextArea rows={18} value={editing?.json ?? ''} onChange={(e) => setEditing((cur) => cur ? { ...cur, json: e.target.value } : cur)} className="font-mono text-xs" />
      </Modal>

      <Modal title={<Space><Layers className="w-4 h-4" /><span>导出 Bundle</span></Space>} open={bundleOpen} onCancel={() => setBundleOpen(false)} onOk={handleBuildBundle} okText="导出">
        <Form layout="vertical">
          <Form.Item label="Bundle 类型">
            <Select value={bundleKind} onChange={setBundleKind} options={[
              { value: 'collection', label: 'collection (查询/快照)' },
              { value: 'transaction', label: 'transaction (事务 POST)' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const KV: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex border-b border-slate-100 py-1">
    <div className="w-24 text-slate-500">{k}</div>
    <div className="flex-1 font-mono break-all">{v || '-'}</div>
  </div>
);

const CreateResource: React.FC<{ type: string; onSubmit: (r: unknown) => void }> = ({ type, onSubmit }) => {
  const sample = FHIR_SAMPLES.find((s) => s.resourceType === type);
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (sample) {
      const r = sample.resource as Record<string, unknown>;
      return {
        id: String(r['id'] ?? ''),
        status: String(r['status'] ?? ''),
        subject: displayRef(r['subject']),
        text: String((r['code'] as Record<string, unknown>)?.['text'] ?? ''),
      };
    }
    return { id: '', status: '', subject: '', text: '' };
  });
  return (
    <div className="space-y-2">
      <Form layout="vertical">
        <Form.Item label="ID"><Input value={form['id']} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="留空自动生成" /></Form.Item>
        <Form.Item label="状态"><Input value={form['status']} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} /></Form.Item>
        <Form.Item label="主题引用"><Input value={form['subject']} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Patient/xxx" /></Form.Item>
        <Form.Item label="文本 / 描述"><Input.TextArea rows={3} value={form['text']} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} /></Form.Item>
        <div className="flex justify-end">
          <Button type="primary" icon={<Save className="w-3 h-3" />} onClick={() => {
            const r: Record<string, unknown> = {
              resourceType: type,
              id: form['id'] || undefined,
              status: form['status'] || undefined,
              text: form['text'] || undefined,
            };
            if (form['subject']) r['subject'] = { reference: form['subject'] };
            onSubmit(r);
          }}>创建</Button>
        </div>
      </Form>
    </div>
  );
};

function displayRef(v: unknown): string {
  if (!v) return '-';
  if (typeof v === 'object' && v !== null) {
    const r = v as Record<string, unknown>;
    return `${r['reference'] ?? ''} ${r['display'] ?? ''}`.trim();
  }
  return String(v);
}

function displayCode(v: unknown): string {
  if (!v || typeof v !== 'object') return '-';
  const c = v as Record<string, unknown>;
  const coding = (c['coding'] as Array<Record<string, unknown>> | undefined)?.[0];
  return coding ? `${coding['code'] ?? ''} ${coding['display'] ?? ''}` : (c['text'] as string ?? '-');
}

function resourceDisplay(r: Record<string, unknown>): string {
  const name = r['name'];
  if (Array.isArray(name) && name[0]) {
    const n = name[0] as Record<string, unknown>;
    return `${n['text'] ?? `${n['family'] ?? ''}${Array.isArray(n['given']) ? n['given'].join('') : ''}`}`;
  }
  if (typeof name === 'object' && name && 'text' in name) return String((name as Record<string, unknown>)['text']);
  return r['id'] as string ?? '-';
}

export default FhirResourceExplorer;

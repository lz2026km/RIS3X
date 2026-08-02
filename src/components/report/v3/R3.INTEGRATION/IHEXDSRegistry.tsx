/**
 * G005 放射RIS系统 v3.0.5.1 - IHE XDS.b Registry
 * R3.INTEGRATION 组 D:IHE XDS.b / XDR / ATNA
 * 20 升级点:ebXML 提交 / Stored Query / 文档条目 / 关联
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Space, Button, Tag, Tooltip, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, Tree, Tag as AntTag,
} from 'antd';
import {
  Server, Download, Send, Copy, Eye, Shield, CheckCircle2, XCircle, Hash, FileText,
  RefreshCw, AlertCircle, Activity, Layers, Database, FileCode, Braces, Globe, FolderTree, Link2, Plus, Search,
} from 'lucide-react';
import { XDS_REGISTRY_MOCK, XDS_REGISTRIES_MOCK } from '@data/reportIntegrationMock';
import {
  listXdsRegistries, getXdsRegistry, registerToXds, queryXdsRegistry, buildXdsSubmitTransactionRequest,
  buildFindDocumentsQuery, validateXds,
} from '@services/integration/iheXdsService';
import type { XdsRegistry, XdsDocumentEntry, XdsFolder, XdsSubmissionSet } from '@types/R3/R3.INTEGRATION';

interface Props {
  reportId?: string;
  patientId?: string;
  onRegister?: (registry: XdsRegistry) => void;
}

const AVAILABILITY_COLORS: Record<string, string> = { Online: 'green', Offline: 'red', Nearline: 'orange', Unavailable: 'red' };
const STATUS_COLORS: Record<string, string> = { approved: 'green', deprecated: 'orange' };

export const IHEXDSRegistry: React.FC<Props> = ({ reportId, patientId, onRegister }) => {
  const [registries, setRegistries] = useState<XdsRegistry[]>(XDS_REGISTRIES_MOCK);
  const [selectedId, setSelectedId] = useState<string | null>(XDS_REGISTRY_MOCK.id);
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [genForm, setGenForm] = useState({
    title: '胸部 CT 增强报告', titleEn: 'Chest CT Enhanced Report', comments: '常规放射学检查',
    sourceId: '1.2.840.113556.1.8000.2554.1.1', modality: 'CT', bodyPart: '胸部',
  });
  const [queryPatientId, setQueryPatientId] = useState('p-038');
  const [queryResults, setQueryResults] = useState<XdsDocumentEntry[]>([]);

  const selected = useMemo(() => registries.find((r) => r.id === selectedId) ?? null, [registries, selectedId]);

  const handleValidate = useCallback(() => {
    if (!selected) return;
    const r = validateXds(selected);
    if (r.passed) message.success('XDS.b 注册验证通过');
    else message.error('XDS.b 注册验证失败');
  }, [selected]);

  const handleRegister = useCallback(async () => {
    if (!reportId) { message.warning('请先选择报告'); return; }
    setRegistering(true);
    const reg = await registerToXds({
      reportId, patientId: patientId ?? 'p-038', patientName: '张三',
      modality: genForm.modality, bodyPart: genForm.bodyPart,
      sourceId: genForm.sourceId,
      title: genForm.title, titleEn: genForm.titleEn, comments: genForm.comments,
      classCode: { code: '51852-2', display: '评估与计划' },
      typeCode: { code: '51848-0', display: '放射学报告' },
      formatCode: { code: 'urn:ihe:rad:XDSDCM:1.2.840.10008.5.1.4.1.1.88.11', display: 'DICOM SR' },
    });
    setRegistries((arr) => [reg, ...arr]);
    setSelectedId(reg.id);
    setRegistering(false);
    setShowRegister(false);
    message.success('已注册到 XDS.b Registry');
    onRegister?.(reg);
  }, [reportId, patientId, genForm, onRegister]);

  const handleQuery = useCallback(async () => {
    const results = await queryXdsRegistry(queryPatientId);
    setQueryResults(results);
    message.success(`查询到 ${results.length} 个文档`);
  }, [queryPatientId]);

  const copyXml = useCallback(() => {
    if (!selected) return;
    navigator.clipboard.writeText(buildXdsSubmitTransactionRequest(selected));
    message.success('ebXML 已复制');
  }, [selected]);

  const downloadXml = useCallback(() => {
    if (!selected) return;
    const xml = buildXdsSubmitTransactionRequest(selected);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selected.id}.xml`; a.click();
    URL.revokeObjectURL(url);
    message.success('ebXML 已下载');
  }, [selected]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title="Registry" value={registries.length} prefix={<Server className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="文档条目" value={registries.reduce((a, r) => a + r.documentEntries.length, 0)} prefix={<FileText className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="文件夹" value={registries.reduce((a, r) => a + r.folders.length, 0)} prefix={<FolderTree className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="关联" value={registries.reduce((a, r) => a + r.associations.length, 0)} prefix={<Link2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><Server className="w-4 h-4" /><span>XDS Registry</span></Space>} extra={
          <Space>
            <Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowRegister(true)} disabled={!reportId}>注册</Button>
          </Space>
        }>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {registries.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === r.id ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color="red">XDS.b</Tag>
                  {r.responses[0]?.rs === 'Success' ? <Tag color="green" icon={<CheckCircle2 className="w-3 h-3" />}>成功</Tag> : <Tag color="red">失败</Tag>}
                </div>
                <div className="text-sm font-mono truncate">{r.id}</div>
                <div className="text-xs text-slate-500 truncate">患者: {r.patientId}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{r.documentEntries.length} 文档</span>
                  <span>{r.folders.length} 文件夹</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Globe className="w-4 h-4" /><span>XDS Registry 详情</span>{selected && <Tag color="red">{selected.registryId}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleValidate}>验证</Button>
                <Button size="small" icon={<Eye className="w-3 h-3" />} onClick={() => setShowXml(true)}>查看 ebXML</Button>
                <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={copyXml}>复制 ebXML</Button>
                <Button size="small" type="primary" icon={<Download className="w-3 h-3" />} onClick={downloadXml}>下载</Button>
              </Space>
            )}
          </div>
        }>
          {selected ? (
            <Tabs
              items={[
                {
                  key: 'overview',
                  label: '概览',
                  children: (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Registry ID</div>
                          <div className="font-mono text-red-600">{selected.registryId}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">主社区</div>
                          <div className="font-mono text-xs">{selected.homeCommunityId}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Source ID</div>
                          <div className="font-mono text-xs">{selected.sourceId}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Repository</div>
                          <div className="font-mono text-xs">{selected.repositoryUniqueIds.join(', ')}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">注册时间</div>
                          <div>{new Date(selected.registeredAt).toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">注册节点</div>
                          <div>{selected.registeredBy}</div>
                        </div>
                      </div>

                      <Divider className="my-2" />

                      <h5 className="text-sm font-semibold">SubmissionSet</h5>
                      <div className="p-2 bg-slate-50 rounded text-xs space-y-1">
                        <div><b>EntryUUID:</b> <span className="font-mono">{selected.submissionSet.entryUUID}</span></div>
                        <div><b>Title:</b> {selected.submissionSet.title} / {selected.submissionSet.titleEn}</div>
                        <div><b>类型:</b> <Tag>{selected.submissionSet.submissionSetType}</Tag></div>
                        <div><b>作者:</b> {selected.submissionSet.author.map((a) => a.authorPerson).join(', ')}</div>
                      </div>

                      <h5 className="text-sm font-semibold mt-2">DocumentEntry ({selected.documentEntries.length})</h5>
                      <Table
                        size="small"
                        rowKey="entryUUID"
                        dataSource={selected.documentEntries}
                        pagination={false}
                        scroll={{ y: 200 }}
                        columns={[
                          { title: 'Title', dataIndex: 'titleEn', key: 'titleEn', render: (v, r) => <div><div className="text-xs font-semibold">{v}</div><div className="text-[10px] text-slate-400">{r.title}</div></div> },
                          { title: 'Class', dataIndex: 'classCode', key: 'classCode', render: (c) => <Tag color="red">{c.code}</Tag> },
                          { title: 'Type', dataIndex: 'typeCode', key: 'typeCode', render: (c) => <Tag color="orange">{c.code}</Tag> },
                          { title: 'Format', dataIndex: 'formatCode', key: 'formatCode', render: (c) => <Tag color="purple">{c.code.split(':').pop()}</Tag> },
                          { title: 'Availability', dataIndex: 'availability', key: 'availability', render: (v) => <Tag color={AVAILABILITY_COLORS[v]}>{v}</Tag> },
                          { title: 'Size', dataIndex: 'size', key: 'size', render: (v) => `${(v / 1024).toFixed(1)} KB` },
                          { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
                        ]}
                      />

                      <h5 className="text-sm font-semibold mt-2">Folders ({selected.folders.length})</h5>
                      <div className="space-y-1">
                        {selected.folders.map((f) => (
                          <div key={f.entryUUID} className="p-1.5 bg-slate-50 rounded text-xs flex items-center gap-2">
                            <FolderTree className="w-3 h-3" style={{ color: '#7c3aed' }} />
                            <span className="font-semibold">{f.titleEn}</span>
                            <Tag color="purple">{f.folderType}</Tag>
                            <span className="text-slate-400 ml-auto text-[10px]">{f.lastUpdateTime}</span>
                          </div>
                        ))}
                      </div>

                      <h5 className="text-sm font-semibold mt-2">Associations ({selected.associations.length})</h5>
                      <div className="space-y-1">
                        {selected.associations.map((a) => (
                          <div key={a.entryUUID} className="p-1.5 bg-slate-50 rounded text-xs flex items-center gap-2">
                            <Link2 className="w-3 h-3" style={{ color: '#10b981' }} />
                            <Tag color="green">{a.associationType}</Tag>
                            <span className="font-mono text-[10px] truncate">{a.sourceObject.split(':').pop()} → {a.targetObject.split(':').pop()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'ebxml',
                  label: 'ebXML 2.1',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">
                      {buildXdsSubmitTransactionRequest(selected)}
                    </pre>
                  ),
                },
                {
                  key: 'query',
                  label: 'Stored Query',
                  children: (
                    <div className="space-y-3">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 mb-1">按患者 ID 查询</div>
                          <Input value={queryPatientId} onChange={(e) => setQueryPatientId(e.target.value)} />
                        </div>
                        <Button type="primary" icon={<Search className="w-3 h-3" />} onClick={handleQuery}>查询</Button>
                      </div>
                      {queryResults.length > 0 && (
                        <Table size="small" rowKey="entryUUID" dataSource={queryResults} pagination={false} columns={[
                          { title: 'EntryUUID', dataIndex: 'entryUUID', key: 'entryUUID', render: (v) => <span className="font-mono text-[10px]">{v.split(':').pop()}</span> },
                          { title: 'Title', dataIndex: 'titleEn', key: 'titleEn' },
                          { title: 'Class', dataIndex: 'classCode', key: 'classCode', render: (c) => c.code },
                          { title: 'Author', dataIndex: 'legalAuthenticator', key: 'legalAuthenticator' },
                          { title: 'Time', dataIndex: 'creationTime', key: 'creationTime' },
                        ]} />
                      )}
                      <Divider className="my-2" />
                      <div className="text-xs font-semibold text-slate-600 mb-1">查询 XML 模板:</div>
                      <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto font-mono">
                        {buildFindDocumentsQuery(queryPatientId, "urn:ihe:iti:2017:Status:Approved")}
                      </pre>
                    </div>
                  ),
                },
              ]}
            />
          ) : <Empty description="请选择 Registry" />}
        </Card>
      </div>

      <Modal title={<Space><Server className="w-4 h-4" /><span>注册到 XDS.b Registry</span></Space>} open={showRegister} onCancel={() => setShowRegister(false)} footer={null}>
        <Form layout="vertical">
          <Form.Item label="标题"><Input value={genForm.title} onChange={(e) => setGenForm((f) => ({ ...f, title: e.target.value }))} /></Form.Item>
          <Form.Item label="英文标题"><Input value={genForm.titleEn} onChange={(e) => setGenForm((f) => ({ ...f, titleEn: e.target.value }))} /></Form.Item>
          <Form.Item label="注释"><Input.TextArea rows={2} value={genForm.comments} onChange={(e) => setGenForm((f) => ({ ...f, comments: e.target.value }))} /></Form.Item>
          <Form.Item label="Source ID"><Input value={genForm.sourceId} onChange={(e) => setGenForm((f) => ({ ...f, sourceId: e.target.value }))} /></Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowRegister(false)}>取消</Button>
          <Button type="primary" onClick={handleRegister} loading={registering}>注册</Button>
        </div>
      </Modal>

      <Modal title={<Space><Braces className="w-4 h-4" /><span>ebXML 2.1 提交包</span></Space>} open={showXml} onCancel={() => setShowXml(false)} footer={null} width={900}>
        {selected && <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[600px] font-mono">{buildXdsSubmitTransactionRequest(selected)}</pre>}
      </Modal>
    </div>
  );
};

export default IHEXDSRegistry;

/**
 * G005 放射RIS系统 v3.0.5.1 - FHIR R4 DiagnosticReport 导出
 * R3.INTEGRATION 组 C:FHIR
 * 20 升级点:R4 规范 / Bundle / 资源映射 / SMART on FHIR OAuth2
 */
import { FHIR_DR_DOCUMENTS_MOCK, FHIR_DR_MOCK } from '@data/reportIntegrationMock';
import { generateFhirDr, downloadFhirDr, sendFhirDr, validateFhir, buildFhirBundle } from '@services/integration/fhirDiagnosticService';
import type { FhirDiagnosticReport } from '@types/R3/R3.INTEGRATION';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs, Empty, Statistic, Row, Col, Divider, Alert } from 'antd';
import { Braces, Download, Send, Copy, CheckCircle2, FileJson, Layers, Server, Globe, Lock, Key, Plus } from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';
import { Inbox } from 'lucide-react'

interface Props {
  reportId?: string;
  patientId?: string;
  onExport?: (dr: FhirDiagnosticReport) => void;
}

const STATUS_COLORS: Record<FhirDiagnosticReport['status'], string> = {
  registered: 'default', partial: 'blue', preliminary: 'orange', final: 'green',
  amended: 'cyan', corrected: 'cyan', appended: 'blue', cancelled: 'red',
  'entered-in-error': 'red', unknown: 'default',
};

const STATUS_LABELS: Record<FhirDiagnosticReport['status'], string> = {
  registered: '已注册', partial: '部分', preliminary: '初步', final: '最终',
  amended: '已修订', corrected: '已更正', appended: '已补充', cancelled: '已取消',
  'entered-in-error': '错误录入', unknown: '未知',
};

export const FHIRDiagnosticReportComponent: React.FC<Props> = ({ reportId, patientId, onExport }) => {
  const [documents, setDocuments] = useState<FhirDiagnosticReport[]>(FHIR_DR_DOCUMENTS_MOCK);
  const [selectedId, setSelectedId] = useState<string | null>(FHIR_DR_MOCK.id);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; statusCode: number; durationMs: number } | null>(null);
  const [showOAuth, setShowOAuth] = useState(false);
  const [genForm, setGenForm] = useState({ modality: 'CT', bodyPart: '胸部', findings: '', impression: '' });
  const [fhirServerUrl, setFhirServerUrl] = useState('https://fhir.hospital.com/api/FHIR/R4');

  const selected = useMemo(() => documents.find((d) => d.id === selectedId) ?? null, [documents, selectedId]);

  const handleValidate = useCallback(() => {
    if (!selected) return;
    const r = validateFhir(selected);
    if (r.passed) message.success('FHIR R4 验证通过');
    else message.error('FHIR R4 验证失败');
  }, [selected]);

  const handleDownload = useCallback(async () => {
    if (!selected) return;
    const r = await downloadFhirDr(selected.id);
    if (!r) return;
    const blob = new Blob([r.content], { type: r.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
    message.success(`已下载 ${r.filename}`);
  }, [selected]);

  const handleGenerate = useCallback(async () => {
    if (!reportId) { message.warning('请先选择报告'); return; }
    setGenerating(true);
    const dr = await generateFhirDr({
      reportId, patientId: patientId ?? 'p-038', modality: genForm.modality, bodyPart: genForm.bodyPart,
      findings: genForm.findings, impression: genForm.impression,
    });
    setDocuments((arr) => [dr, ...arr]);
    setSelectedId(dr.id);
    setGenerating(false);
    setShowGenerate(false);
    message.success('FHIR DiagnosticReport 已生成');
    onExport?.(dr);
  }, [reportId, patientId, genForm, onExport]);

  const handleSend = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    const r = await sendFhirDr(selected.id, fhirServerUrl);
    setSendResult({ success: r.success, statusCode: r.statusCode, durationMs: r.durationMs });
    setSending(false);
    if (r.success) message.success('FHIR 服务器接收成功');
  }, [selected, fhirServerUrl]);

  const handleBundle = useCallback(() => {
    const bundle = buildFhirBundle(documents, 'collection');
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fhir-bundle.json'; a.click();
    URL.revokeObjectURL(url);
    message.success(`Bundle 已下载 (${bundle.total} 资源)`);
  }, [documents]);

  const copyJson = useCallback(() => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.json);
    message.success('JSON 已复制');
  }, [selected]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="DiagnosticReport" value={documents.length} prefix={<FileJson className="w-3 h-3" style={{ color: '#ea580c' }} />} styles={{ content: {  fontSize: 18  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已验证" value={documents.filter((d) => d.validation.passed).length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已发送" value={0} prefix={<Globe className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Bundle" value={documents.length} prefix={<Layers className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} suffix="资源" />
          </Card>
        </Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><FileJson className="w-4 h-4" /><span>FHIR 列表</span></Space>} extra={
          <Space>
            <Button size="small" icon={<Layers className="w-3 h-3" />} onClick={handleBundle}>Bundle</Button>
            <Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowGenerate(true)} disabled={!reportId}>生成</Button>
          </Space>
        }>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {documents.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === d.id ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color="orange">FHIR R4</Tag>
                  <Tag color={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status]}</Tag>
                </div>
                <div className="text-sm font-mono truncate">{d.id}</div>
                <div className="text-xs text-slate-500 truncate">{d.code.text}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{(d.json.length / 1024).toFixed(1)} KB</span>
                  <span>{d.result.length + d.media.length + d.note.length} refs</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Braces className="w-4 h-4" /><span>DiagnosticReport 详情</span>{selected && <Tag color="orange">{selected.id}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleValidate}>验证</Button>
                <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={copyJson}>复制 JSON</Button>
                <Button size="small" icon={<Lock className="w-3 h-3" />} onClick={() => setShowOAuth(true)}>OAuth2</Button>
                <Button size="small" type="primary" icon={<Send className="w-3 h-3" />} onClick={() => setShowSend(true)}>POST 到 FHIR 服务器</Button>
                <Button size="small" icon={<Download className="w-3 h-3" />} onClick={handleDownload}>下载</Button>
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
                          <div className="text-slate-500">resourceType</div>
                          <div className="font-mono text-orange-600">DiagnosticReport</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">id</div>
                          <div className="font-mono text-orange-600">{selected.id}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">status</div>
                          <div><Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag></div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">code</div>
                          <div>{selected.code.coding.map((c) => <Tag key={c.code} color="orange">{c.code} {c.display}</Tag>)}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">subject</div>
                          <div className="font-mono text-blue-600">{selected.subject.reference}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">effectiveDateTime</div>
                          <div>{new Date(selected.effectiveDateTime).toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">issued</div>
                          <div>{new Date(selected.issued).toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">performer</div>
                          <div>{selected.performer.map((p) => p.display).join(', ')}</div>
                        </div>
                      </div>

                      {selected.conclusion && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="text-xs font-semibold text-blue-700 mb-1">conclusion</div>
                          <div className="text-sm">{selected.conclusion}</div>
                        </div>
                      )}

                      <Divider className="my-2" />

                      <h5 className="text-sm font-semibold">引用资源</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {selected.result.map((r, i) => (
                          <div key={i} className="p-1.5 bg-slate-50 rounded text-xs">
                            <Tag color="cyan">Observation</Tag>
                            <span className="font-mono">{r.reference}</span>
                          </div>
                        ))}
                        {selected.imagingStudy.map((r, i) => (
                          <div key={i} className="p-1.5 bg-slate-50 rounded text-xs">
                            <Tag color="purple">ImagingStudy</Tag>
                            <span className="font-mono">{r.reference}</span>
                          </div>
                        ))}
                        {selected.media.map((m, i) => (
                          <div key={i} className="p-1.5 bg-slate-50 rounded text-xs">
                            <Tag color="orange">Media</Tag>
                            <span className="font-mono">{m.link.reference}</span>
                            {m.comment && <div className="text-slate-500 text-[10px] mt-0.5">{m.comment}</div>}
                          </div>
                        ))}
                        {selected.presentedForm.map((p, i) => (
                          <div key={i} className="p-1.5 bg-slate-50 rounded text-xs">
                            <Tag color="green">Attachment</Tag>
                            <span className="font-mono">{p.url}</span>
                            <Tag>{(p.size ?? 0) / 1024} KB</Tag>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'json',
                  label: 'JSON 源',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">
                      {selected.json}
                    </pre>
                  ),
                },
              ]}
            />
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请选择 FHIR 文档" />}
        </Card>
      </div>

      <Modal title={<Space><FileJson className="w-4 h-4" /><span>生成 FHIR DiagnosticReport</span></Space>} open={showGenerate} onCancel={() => setShowGenerate(false)} footer={null}>
        <Form layout="vertical">
          <Form.Item label="模态"><Select value={genForm.modality} onChange={(v) => setGenForm((f) => ({ ...f, modality: v }))} options={['CT', 'MR', 'DR', 'US', 'MG'].map((m) => ({ value: m, label: m }))} /></Form.Item>
          <Form.Item label="部位"><Input value={genForm.bodyPart} onChange={(e) => setGenForm((f) => ({ ...f, bodyPart: e.target.value }))} /></Form.Item>
          <Form.Item label="影像所见"><Input.TextArea rows={2} value={genForm.findings} onChange={(e) => setGenForm((f) => ({ ...f, findings: e.target.value }))} /></Form.Item>
          <Form.Item label="诊断意见"><Input.TextArea rows={2} value={genForm.impression} onChange={(e) => setGenForm((f) => ({ ...f, impression: e.target.value }))} /></Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowGenerate(false)}>取消</Button>
          <Button type="primary" onClick={handleGenerate} loading={generating}>生成</Button>
        </div>
      </Modal>

      <Modal title={<Space><Server className="w-4 h-4" /><span>发送到 FHIR 服务器</span></Space>} open={showSend} onCancel={() => setShowSend(false)} footer={null}>
        {sendResult ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <div className="text-base font-semibold">FHIR 服务器接收成功</div>
            <div className="text-xs text-slate-500">HTTP {sendResult.statusCode} · {sendResult.durationMs}ms</div>
          </div>
        ) : (
          <>
            <Form layout="vertical">
              <Form.Item label="FHIR Server URL"><Input value={fhirServerUrl} onChange={(e) => setFhirServerUrl(e.target.value)} /></Form.Item>
            </Form>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowSend(false)}>取消</Button>
              <Button type="primary" onClick={handleSend} loading={sending}>发送</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal title={<Space><Lock className="w-4 h-4" /><span>SMART on FHIR OAuth2</span></Space>} open={showOAuth} onCancel={() => setShowOAuth(false)} footer={null}>
        <div className="space-y-3">
          <Alert type="info" title="SMART on FHIR OAuth2 认证" description="使用 OpenID Connect + OAuth2 进行身份认证与授权" />
          <div className="text-xs space-y-1">
            <div>授权端点: <span className="font-mono text-blue-600">https://fhir.hospital.com/oauth2/authorize</span></div>
            <div>Token 端点: <span className="font-mono text-blue-600">https://fhir.hospital.com/oauth2/token</span></div>
            <div>客户端 ID: <span className="font-mono">g005-ris-client</span></div>
            <div>Scope: <Tag color="cyan">patient/DiagnosticReport.read patient/Patient.read launch/patient offline_access</Tag></div>
          </div>
          <Button type="primary" block icon={<Key className="w-3 h-3" />}>发起授权</Button>
        </div>
      </Modal>
    </div>
  );
};

export default FHIRDiagnosticReportComponent;

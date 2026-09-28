/**
 * G005 放射RIS系统 v3.0.5.1 - FHIR R4 DiagnosticReport 导出
 * R3.INTEGRATION 组 C:FHIR
 * 20 升级点:R4 规范 / Bundle / 资源映射 / SMART on FHIR OAuth2
 */
import { FHIR_DR_DOCUMENTS_MOCK, FHIR_DR_MOCK } from '@data/reportIntegrationMock';
import { generateFhirDr, downloadFhirDr, sendFhirDr, validateFhir, buildFhirBundle } from '@services/integration/fhirDiagnosticService';
import { smartAuthApi } from '@services/api/smartAuthApi';
import type { FhirDiagnosticReport } from '@/types/R3/R3.INTEGRATION';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs, Empty, Statistic, Row, Col, Divider, Alert } from 'antd';
import { Braces, Download, Send, Copy, CheckCircle2, FileJson, Layers, Server, Globe, Lock, Key, Plus } from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

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
  registered: t('reportIntegration.fhir.status.registered'), partial: t('reportIntegration.fhir.status.partial'), preliminary: t('reportIntegration.fhir.status.preliminary'), final: t('reportIntegration.fhir.status.final'),
  amended: t('reportIntegration.fhir.status.amended'), corrected: t('reportIntegration.fhir.status.corrected'), appended: t('reportIntegration.fhir.status.appended'), cancelled: t('reportIntegration.fhir.status.cancelled'),
  'entered-in-error': t('reportIntegration.fhir.status.enteredInError'), unknown: t('reportIntegration.fhir.status.unknown'),
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
  const [authorizing, setAuthorizing] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [genForm, setGenForm] = useState({ modality: 'CT', bodyPart: '胸部', findings: '', impression: '' });
  const [fhirServerUrl, setFhirServerUrl] = useState('https://fhir.hospital.com/api/FHIR/R4');

  const selected = useMemo(() => documents.find((d) => d.id === selectedId) ?? null, [documents, selectedId]);

  const handleValidate = useCallback(() => {
    if (!selected) return;
    const r = validateFhir(selected);
    if (r.passed) message.success(t('reportIntegration.fhir.validatePassed'));
    else message.error(t('reportIntegration.fhir.validateFailed'));
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
    message.success(t('reportIntegration.fhir.downloaded', { filename: r.filename }));
  }, [selected]);

  const handleGenerate = useCallback(async () => {
    if (!reportId) { message.warning(t('reportIntegration.selectReport')); return; }
    setGenerating(true);
    const dr = await generateFhirDr({
      reportId, patientId: patientId ?? 'p-038', modality: genForm.modality, bodyPart: genForm.bodyPart,
      findings: genForm.findings, impression: genForm.impression,
    });
    setDocuments((arr) => [dr, ...arr]);
    setSelectedId(dr.id);
    setGenerating(false);
    setShowGenerate(false);
    message.success(t('reportIntegration.fhir.generated'));
    onExport?.(dr);
  }, [reportId, patientId, genForm, onExport]);

  const handleSend = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    const r = await sendFhirDr(selected.id, fhirServerUrl);
    setSendResult({ success: r.success, statusCode: r.statusCode, durationMs: r.durationMs });
    setSending(false);
    if (r.success) message.success(t('reportIntegration.fhir.serverReceived'));
  }, [selected, fhirServerUrl]);

  const handleBundle = useCallback(() => {
    const bundle = buildFhirBundle(documents, 'collection');
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fhir-bundle.json'; a.click();
    URL.revokeObjectURL(url);
    message.success(t('reportIntegration.fhir.bundleDownloaded', { count: bundle.total }));
  }, [documents]);

  const copyJson = useCallback(() => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.json);
    message.success(t('reportIntegration.fhir.jsonCopied'));
  }, [selected]);

  // [G005] SMART on FHIR 授权: 复用 smartAuthApi.authorize → 取回授权码; 无 code 时跳转授权页
  const handleAuthorize = useCallback(async () => {
    setAuthorizing(true);
    try {
      const redirectUri = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://ris.hospital.com/oauth/callback';
      const res = await smartAuthApi.authorize({
        client_id: 'g005-ris-client',
        redirect_uri: redirectUri,
        scope: 'patient/DiagnosticReport.read patient/Patient.read launch/patient offline_access',
        state: Math.random().toString(36).slice(2),
        patient: patientId,
        user_id: reportId,
      });
      if (res.success && res.data?.redirectUrl) {
        const match = res.data.redirectUrl.match(/[?&]code=([^&]+)/);
        if (match) {
          setAuthCode(decodeURIComponent(match[1] ?? ''));
          message.success(t('smartAuth.authSuccess'));
        } else {
          window.open(res.data.redirectUrl, '_blank', 'noopener,noreferrer');
          message.info(t('smartAuth.noCode'));
        }
      } else {
        message.error(res.error?.message ?? t('smartAuth.authFailed'));
      }
    } catch {
      message.error(t('smartAuth.authRequestFailed'));
    } finally {
      setAuthorizing(false);
    }
  }, [patientId, reportId]);

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
            <Statistic title={t('reportIntegration.verified')} value={documents.filter((d) => d.validation.passed).length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title={t('reportIntegration.dicomSr.stat.sent')} value={0} prefix={<Globe className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title={t('reportIntegration.fhir.stat.bundles')} value={documents.length} prefix={<Layers className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} suffix={t('reportIntegration.fhir.resources')} />
          </Card>
        </Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><FileJson className="w-4 h-4" /><span>{t('reportIntegration.fhir.listTitle')}</span></Space>} extra={
          <Space>
            <Button size="small" icon={<Layers className="w-3 h-3" />} onClick={handleBundle}>Bundle</Button>
            <Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowGenerate(true)} disabled={!reportId}>{t('reportIntegration.generate')}</Button>
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
                  <span>{t('reportIntegration.fhir.refs', { count: d.result.length + d.media.length + d.note.length })}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Braces className="w-4 h-4" /><span>{t('reportIntegration.fhir.detailTitle')}</span>{selected && <Tag color="orange">{selected.id}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleValidate}>{t('reportIntegration.validate')}</Button>
                <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={copyJson}>{t('reportIntegration.fhir.copyJson')}</Button>
                <Button size="small" icon={<Lock className="w-3 h-3" />} onClick={() => setShowOAuth(true)}>OAuth2</Button>
                <Button size="small" type="primary" icon={<Send className="w-3 h-3" />} onClick={() => setShowSend(true)}>{t('reportIntegration.fhir.postToServer')}</Button>
                <Button size="small" icon={<Download className="w-3 h-3" />} onClick={handleDownload}>{t('reportIntegration.download')}</Button>
              </Space>
            )}
          </div>
        }>
          {selected ? (
            <Tabs
              items={[
                {
                  key: 'overview',
                  label: t('reportIntegration.tab.overview'),
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

                      <h5 className="text-sm font-semibold">{t('reportIntegration.fhir.referencedResources')}</h5>
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
                  label: t('reportIntegration.tab.jsonSource'),
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">
                      {selected.json}
                    </pre>
                  ),
                },
              ]}
            />
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportIntegration.fhir.selectDocument')} />}
        </Card>
      </div>

      <Modal title={<Space><FileJson className="w-4 h-4" /><span>{t('reportIntegration.fhir.generateTitle')}</span></Space>} open={showGenerate} onCancel={() => setShowGenerate(false)} footer={null}>
        <Form layout="vertical">
          <Form.Item label={t('reportIntegration.fhir.modality')}><Select value={genForm.modality} onChange={(v) => setGenForm((f) => ({ ...f, modality: v }))} options={['CT', 'MR', 'DR', 'US', 'MG'].map((m) => ({ value: m, label: m }))} /></Form.Item>
          <Form.Item label={t('reportIntegration.fhir.bodyPart')}><Input value={genForm.bodyPart} onChange={(e) => setGenForm((f) => ({ ...f, bodyPart: e.target.value }))} /></Form.Item>
          <Form.Item label={t('aiDraft.section.findings')}><Input.TextArea rows={2} value={genForm.findings} onChange={(e) => setGenForm((f) => ({ ...f, findings: e.target.value }))} /></Form.Item>
          <Form.Item label={t('aiDraft.section.impression')}><Input.TextArea rows={2} value={genForm.impression} onChange={(e) => setGenForm((f) => ({ ...f, impression: e.target.value }))} /></Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowGenerate(false)}>{t('reportIntegration.cancel')}</Button>
          <Button type="primary" onClick={handleGenerate} loading={generating}>{t('reportIntegration.generate')}</Button>
        </div>
      </Modal>

      <Modal title={<Space><Server className="w-4 h-4" /><span>{t('reportIntegration.fhir.sendTitle')}</span></Space>} open={showSend} onCancel={() => setShowSend(false)} footer={null}>
        {sendResult ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <div className="text-base font-semibold">{t('reportIntegration.fhir.serverReceived')}</div>
            <div className="text-xs text-slate-500">HTTP {sendResult.statusCode} · {sendResult.durationMs}ms</div>
          </div>
        ) : (
          <>
            <Form layout="vertical">
              <Form.Item label="FHIR Server URL"><Input value={fhirServerUrl} onChange={(e) => setFhirServerUrl(e.target.value)} /></Form.Item>
            </Form>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowSend(false)}>{t('reportIntegration.cancel')}</Button>
              <Button type="primary" onClick={handleSend} loading={sending}>{t('reportIntegration.send')}</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal title={<Space><Lock className="w-4 h-4" /><span>SMART on FHIR OAuth2</span></Space>} open={showOAuth} onCancel={() => setShowOAuth(false)} footer={null}>
        <div className="space-y-3">
          <Alert type="info" title={t('reportIntegration.fhir.oauthTitle')} description={t('reportIntegration.fhir.oauthDesc')} />
          <div className="text-xs space-y-1">
            <div>{t('reportIntegration.fhir.authorizeEndpoint')} <span className="font-mono text-blue-600">https://fhir.hospital.com/oauth2/authorize</span></div>
            <div>{t('reportIntegration.fhir.tokenEndpoint')} <span className="font-mono text-blue-600">https://fhir.hospital.com/oauth2/token</span></div>
            <div>{t('reportIntegration.fhir.clientId')} <span className="font-mono">g005-ris-client</span></div>
            <div>Scope: <Tag color="cyan">patient/DiagnosticReport.read patient/Patient.read launch/patient offline_access</Tag></div>
          </div>
          <Button type="primary" block icon={<Key className="w-3 h-3" />} loading={authorizing} onClick={() => void handleAuthorize()}>{t('reportIntegration.fhir.authorize')}</Button>
          {authCode && (
            <Alert
              type="success"
              title={t('smartAuth.authSuccess')}
              description={<span className="font-mono text-xs break-all">code = {authCode}</span>}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default FHIRDiagnosticReportComponent;

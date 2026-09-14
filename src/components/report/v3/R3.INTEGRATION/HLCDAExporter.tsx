/**
 * G005 放射RIS系统 v3.0.5.1 - HL7 CDA R2 导出
 * R3.INTEGRATION 组 A:HL7 CDA
 * 20 升级点:完整 XML 构造 / 解析 / 验证 / 下载 / 签名
 */
import { CDA_DOCUMENTS_MOCK, CDA_DEMO } from '@data/reportIntegrationMock';
import { generateCda, downloadCda, parseCda, validateCda } from '@services/integration/hl7CdaService';
import { CDA_SECTION_CODES } from '@services/integration/hl7CdaService'
import type { CdaDocument, CdaSection, CdaSectionCode } from '@types/R3/R3.INTEGRATION';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs, Empty, Statistic, Row, Col, Divider, Alert } from 'antd';
import { FileCode, Download, Shield, CheckCircle2, FileText, Copy, Code2, Braces, Layers, Plus } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useCallback, useMemo } from 'react';
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId?: string;
  patientId?: string;
  onExport?: (cda: CdaDocument) => void;
}

export const HLCDAExporter: React.FC<Props> = ({ reportId, patientId, onExport }) => {
  const [documents, setDocuments] = useState<CdaDocument[]>(CDA_DOCUMENTS_MOCK);
  const [selectedId, setSelectedId] = useState<string | null>(CDA_DEMO.id);
  const [_showXml, _setShowXml] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ passed: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ReturnType<typeof parseCda> | null>(null);
  const [genForm, setGenForm] = useState({
    title: '胸部 CT 增强检查报告',
    titleEn: 'Chest CT Enhanced Report',
    sections: CDA_SECTION_CODES.slice(0, 3).map((s) => s.code),
  });

  const selected = useMemo(() => documents.find((d) => d.id === selectedId) ?? null, [documents, selectedId]);

  const handleValidate = useCallback(() => {
    if (!selected) return;
    const r = validateCda(selected.xml);
    setValidationResult(r);
    if (r.passed) message.success(t('reportIntegration.cda.validatePassed'));
    else message.error(t('reportIntegration.cda.validateFailed'));
  }, [selected]);

  const handleParse = useCallback(() => {
    if (!selected) return;
    const p = parseCda(selected.xml);
    setParsedPreview(p);
    message.success(t('reportIntegration.cda.parseDone'));
  }, [selected]);

  const handleDownload = useCallback(async () => {
    if (!selected) return;
    const r = await downloadCda(selected.id);
    if (!r) { message.error(t('reportIntegration.downloadFailed')); return; }
    const blob = new Blob([r.content], { type: r.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
    message.success(t('reportIntegration.cda.downloaded', { filename: r.filename }));
  }, [selected]);

  const handleGenerate = useCallback(async () => {
    if (!reportId) {
      message.warning(t('reportIntegration.selectReport'));
      return;
    }
    setGenerating(true);
    const sections: CdaSection[] = genForm.sections.map((code, i) => {
      const meta = CDA_SECTION_CODES.find((s) => s.code === code);
      return {
        code, title: meta?.title ?? t('reportIntegration.cda.section'), titleEn: meta?.titleEn ?? 'Section',
        order: i, text: `本章节由系统自动生成。`, entries: [],
      };
    });
    const doc = await generateCda({
      reportId, patientId: patientId ?? 'p-038', patientName: '张三',
      title: genForm.title, titleEn: genForm.titleEn,
      effectiveTime: new Date().toISOString(),
      sections,
    });
    setDocuments((arr) => [doc, ...arr]);
    setSelectedId(doc.id);
    setGenerating(false);
    setShowGenerate(false);
    message.success(t('reportIntegration.cda.generated'));
    onExport?.(doc);
  }, [reportId, patientId, genForm, onExport]);

  const copyXml = () => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.xml);
    message.success(t('reportIntegration.cda.xmlCopied'));
  };

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title={t('reportIntegration.cda.stat.documents')} value={documents.length} prefix={<FileCode className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('reportIntegration.cda.stat.validated')} value={documents.filter((d) => d.validation.passed).length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('reportIntegration.cda.stat.totalSize')} value={(documents.reduce((a, d) => a + d.size, 0) / 1024).toFixed(1)} suffix="KB" prefix={<Layers className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('reportIntegration.signatureAlgorithm')} value="SM2" prefix={<Shield className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><FileText className="w-4 h-4" /><span>{t('reportIntegration.cda.listTitle')}</span></Space>} extra={<Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowGenerate(true)} disabled={!reportId}>{t('reportIntegration.generate')}</Button>}>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {documents.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === d.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color="purple">CDA R2</Tag>
                  {d.validation.passed ? <Tag color="green" icon={<CheckCircle2 className="w-3 h-3" />}>{t('reportIntegration.verified')}</Tag> : <Tag color="red">{t('reportIntegration.notPassed')}</Tag>}
                </div>
                <div className="text-sm font-mono truncate">{d.id}</div>
                <div className="text-xs text-slate-500 truncate">{d.title}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{(d.size / 1024).toFixed(1)} KB</span>
                  <span>{t('reportIntegration.sectionCount', { count: d.sections.length })}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Braces className="w-4 h-4" /><span>{t('reportIntegration.cda.detailTitle')}</span>{selected && <Tag color="purple">{selected.id}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleValidate}>{t('reportIntegration.validate')}</Button>
                <Button size="small" icon={<Code2 className="w-3 h-3" />} onClick={handleParse}>{t('reportIntegration.parse')}</Button>
                <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={copyXml}>{t('reportIntegration.cda.copyXml')}</Button>
                <Button size="small" type="primary" icon={<Download className="w-3 h-3" />} onClick={handleDownload}>{t('reportIntegration.download')}</Button>
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
                          <div className="text-slate-500">ID</div>
                          <div className="font-mono text-blue-600">{selected.id}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.cda.setIdVersion')}</div>
                          <div className="font-mono text-blue-600">{selected.setId} / v{selected.version}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.cda.titleLabel')}</div>
                          <div>{selected.title} / {selected.titleEn}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.time')}</div>
                          <div>{new Date(selected.effectiveTime).toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.patient')}</div>
                          <div>{selected.recordTarget.name} ({selected.recordTarget.idExtension})</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.cda.author')}</div>
                          <div>{selected.author.name}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.cda.custodian')}</div>
                          <div>{selected.custodian.name}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">{t('reportIntegration.cda.legalAuthenticator')}</div>
                          <div>{selected.legalAuthenticator.name}</div>
                        </div>
                      </div>

                      {validationResult && (
                        <Alert
                          type={validationResult.passed ? 'success' : 'error'}
                          showIcon
                          title={validationResult.passed ? t('reportIntegration.cda.validatePassedDetail') : t('reportIntegration.cda.validateFailedDetail')}
                          description={
                            <div className="space-y-1 mt-1">
                              {validationResult.errors.length > 0 && validationResult.errors.map((e, i) => <div key={i} className="text-xs text-red-600">• {e}</div>)}
                              {validationResult.warnings.length > 0 && validationResult.warnings.map((w, i) => <div key={i} className="text-xs text-amber-600">⚠ {w}</div>)}
                            </div>
                          }
                        />
                      )}

                      <Divider className="my-2" />

                      <h5 className="text-sm font-semibold">{t('reportIntegration.sectionList', { count: selected.sections.length })}</h5>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selected.sections.map((s) => (
                          <div key={s.code} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-xs">
                            <Tag color="purple">{s.code}</Tag>
                            <span className="font-semibold">{s.title}</span>
                            <span className="text-slate-500">/ {s.titleEn}</span>
                            <Tag>{t('reportIntegration.entries', { count: s.entries.length })}</Tag>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'xml',
                  label: t('reportIntegration.tab.xmlSource'),
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">
                      {selected.xml}
                    </pre>
                  ),
                },
                {
                  key: 'parsed',
                  label: t('reportIntegration.tab.parsedResult'),
                  children: parsedPreview ? (
                    <div className="space-y-2 text-sm">
                      <div className="text-xs text-slate-500">ID: <span className="font-mono text-blue-600">{parsedPreview.id}</span></div>
                      <div className="text-xs text-slate-500">{t('reportIntegration.cda.titleLabel')}: {parsedPreview.title}</div>
                      <Divider className="my-1" />
                      {parsedPreview.sections.map((s, i) => (
                        <div key={i} className="border-l-2 border-purple-300 pl-2">
                          <div className="text-xs"><Tag color="purple">{s.code}</Tag><span className="font-semibold">{s.title}</span></div>
                          <div className="text-xs text-slate-600 mt-1">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportIntegration.cda.clickParse')} />,
                },
              ]}
            />
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportIntegration.cda.selectDocument')} />}
        </Card>
      </div>

      <Modal
        title={<Space><FileCode className="w-4 h-4" /><span>{t('reportIntegration.cda.generateTitle')}</span></Space>}
        open={showGenerate}
        onCancel={() => setShowGenerate(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical">
          <Form.Item label={t('reportIntegration.cda.titleLabel')}><Input value={genForm.title} onChange={(e) => setGenForm((f) => ({ ...f, title: e.target.value }))} /></Form.Item>
          <Form.Item label={t('reportIntegration.cda.titleEnLabel')}><Input value={genForm.titleEn} onChange={(e) => setGenForm((f) => ({ ...f, titleEn: e.target.value }))} /></Form.Item>
          <Form.Item label={t('reportIntegration.cda.includedSections')}>
            <Select mode="multiple" value={genForm.sections} onChange={(v) => setGenForm((f) => ({ ...f, sections: v as CdaSectionCode[] }))} options={CDA_SECTION_CODES.map((s) => ({ value: s.code, label: `${s.title} (${s.code})` }))} />
          </Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowGenerate(false)}>{t('reportIntegration.cancel')}</Button>
          <Button type="primary" onClick={handleGenerate} loading={generating}>{t('reportIntegration.generate')}</Button>
        </div>
      </Modal>
    </div>
  );
};

export default HLCDAExporter;

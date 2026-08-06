/**
 * G005 放射RIS系统 v3.0.5.1 - HL7 CDA R2 导出
 * R3.INTEGRATION 组 A:HL7 CDA
 * 20 升级点:完整 XML 构造 / 解析 / 验证 / 下载 / 签名
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs, Empty, Statistic, Row, Col, Divider, Alert } from 'antd';
import { FileCode, Download, Shield, CheckCircle2, FileText, Copy, Code2, Braces, Layers, Plus } from 'lucide-react';
import { CDA_DOCUMENTS_MOCK, CDA_DEMO } from '@data/reportIntegrationMock';
import { generateCda, downloadCda, parseCda, validateCda } from '@services/integration/hl7CdaService';
import { CDA_SECTION_CODES } from '@services/integration/hl7CdaService';
import type { CdaDocument, CdaSection, CdaSectionCode } from '@types/R3/R3.INTEGRATION';

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
    if (r.passed) message.success('CDA 验证通过');
    else message.error('CDA 验证失败');
  }, [selected]);

  const handleParse = useCallback(() => {
    if (!selected) return;
    const p = parseCda(selected.xml);
    setParsedPreview(p);
    message.success('CDA 解析完成');
  }, [selected]);

  const handleDownload = useCallback(async () => {
    if (!selected) return;
    const r = await downloadCda(selected.id);
    if (!r) { message.error('下载失败'); return; }
    const blob = new Blob([r.content], { type: r.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
    message.success(`已下载 ${r.filename}`);
  }, [selected]);

  const handleGenerate = useCallback(async () => {
    if (!reportId) {
      message.warning('请先选择报告');
      return;
    }
    setGenerating(true);
    const sections: CdaSection[] = genForm.sections.map((code, i) => {
      const meta = CDA_SECTION_CODES.find((s) => s.code === code);
      return {
        code, title: meta?.title ?? '章节', titleEn: meta?.titleEn ?? 'Section',
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
    message.success('CDA 已生成');
    onExport?.(doc);
  }, [reportId, patientId, genForm, onExport]);

  const copyXml = () => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.xml);
    message.success('XML 已复制');
  };

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title="CDA 文档" value={documents.length} prefix={<FileCode className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="验证通过" value={documents.filter((d) => d.validation.passed).length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总大小" value={(documents.reduce((a, d) => a + d.size, 0) / 1024).toFixed(1)} suffix="KB" prefix={<Layers className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="签名算法" value="SM2" prefix={<Shield className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><FileText className="w-4 h-4" /><span>CDA 列表</span></Space>} extra={<Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowGenerate(true)} disabled={!reportId}>生成</Button>}>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {documents.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === d.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color="purple">CDA R2</Tag>
                  {d.validation.passed ? <Tag color="green" icon={<CheckCircle2 className="w-3 h-3" />}>已验证</Tag> : <Tag color="red">未通过</Tag>}
                </div>
                <div className="text-sm font-mono truncate">{d.id}</div>
                <div className="text-xs text-slate-500 truncate">{d.title}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{(d.size / 1024).toFixed(1)} KB</span>
                  <span>{d.sections.length} 章节</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Braces className="w-4 h-4" /><span>CDA 详情</span>{selected && <Tag color="purple">{selected.id}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleValidate}>验证</Button>
                <Button size="small" icon={<Code2 className="w-3 h-3" />} onClick={handleParse}>解析</Button>
                <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={copyXml}>复制 XML</Button>
                <Button size="small" type="primary" icon={<Download className="w-3 h-3" />} onClick={handleDownload}>下载</Button>
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
                          <div className="text-slate-500">ID</div>
                          <div className="font-mono text-blue-600">{selected.id}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Set ID / 版本</div>
                          <div className="font-mono text-blue-600">{selected.setId} / v{selected.version}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">标题</div>
                          <div>{selected.title} / {selected.titleEn}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">时间</div>
                          <div>{new Date(selected.effectiveTime).toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">患者</div>
                          <div>{selected.recordTarget.name} ({selected.recordTarget.idExtension})</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">作者</div>
                          <div>{selected.author.name}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">保管方</div>
                          <div>{selected.custodian.name}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">法律签署</div>
                          <div>{selected.legalAuthenticator.name}</div>
                        </div>
                      </div>

                      {validationResult && (
                        <Alert
                          type={validationResult.passed ? 'success' : 'error'}
                          showIcon
                          title={validationResult.passed ? '✓ CDA 验证通过(HL7 CDA R2 + 模板)' : '✗ CDA 验证失败'}
                          description={
                            <div className="space-y-1 mt-1">
                              {validationResult.errors.length > 0 && validationResult.errors.map((e, i) => <div key={i} className="text-xs text-red-600">• {e}</div>)}
                              {validationResult.warnings.length > 0 && validationResult.warnings.map((w, i) => <div key={i} className="text-xs text-amber-600">⚠ {w}</div>)}
                            </div>
                          }
                        />
                      )}

                      <Divider className="my-2" />

                      <h5 className="text-sm font-semibold">章节列表 ({selected.sections.length})</h5>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selected.sections.map((s) => (
                          <div key={s.code} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-xs">
                            <Tag color="purple">{s.code}</Tag>
                            <span className="font-semibold">{s.title}</span>
                            <span className="text-slate-500">/ {s.titleEn}</span>
                            <Tag>{s.entries.length} entries</Tag>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'xml',
                  label: 'XML 源',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">
                      {selected.xml}
                    </pre>
                  ),
                },
                {
                  key: 'parsed',
                  label: '解析结果',
                  children: parsedPreview ? (
                    <div className="space-y-2 text-sm">
                      <div className="text-xs text-slate-500">ID: <span className="font-mono text-blue-600">{parsedPreview.id}</span></div>
                      <div className="text-xs text-slate-500">标题: {parsedPreview.title}</div>
                      <Divider className="my-1" />
                      {parsedPreview.sections.map((s, i) => (
                        <div key={i} className="border-l-2 border-purple-300 pl-2">
                          <div className="text-xs"><Tag color="purple">{s.code}</Tag><span className="font-semibold">{s.title}</span></div>
                          <div className="text-xs text-slate-600 mt-1">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : <Empty description="点击'解析'查看" />,
                },
              ]}
            />
          ) : <Empty description="请选择 CDA 文档" />}
        </Card>
      </div>

      <Modal
        title={<Space><FileCode className="w-4 h-4" /><span>生成 CDA 文档</span></Space>}
        open={showGenerate}
        onCancel={() => setShowGenerate(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical">
          <Form.Item label="标题"><Input value={genForm.title} onChange={(e) => setGenForm((f) => ({ ...f, title: e.target.value }))} /></Form.Item>
          <Form.Item label="英文标题"><Input value={genForm.titleEn} onChange={(e) => setGenForm((f) => ({ ...f, titleEn: e.target.value }))} /></Form.Item>
          <Form.Item label="包含章节">
            <Select mode="multiple" value={genForm.sections} onChange={(v) => setGenForm((f) => ({ ...f, sections: v as CdaSectionCode[] }))} options={CDA_SECTION_CODES.map((s) => ({ value: s.code, label: `${s.title} (${s.code})` }))} />
          </Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowGenerate(false)}>取消</Button>
          <Button type="primary" onClick={handleGenerate} loading={generating}>生成</Button>
        </div>
      </Modal>
    </div>
  );
};

export default HLCDAExporter;

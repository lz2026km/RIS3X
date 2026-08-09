/**
 * G005 放射RIS系统 v3.0.5.1 - DICOM SR 导出
 * R3.INTEGRATION 组 B:DICOM SR
 * 20 升级点:完整 DataSet / TID2000/2010 / C-STORE 发送
 */
import { DICOM_SR_DOCUMENTS_MOCK, DICOM_SR_MOCK } from '@data/reportIntegrationMock';
import { generateDicomSr, downloadDicomSr, sendDicomSr, dumpDicomSr, validateDicomSr } from '@services/integration/dicomSrService';
import type { DicomSrDocument } from '@types/R3/R3.INTEGRATION';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Tabs, Table, Empty, Statistic, Row, Col, Divider, Tag as AntTag } from 'antd';
import { Database, Download, CheckCircle2, Copy, Send, Layers, Server, Braces, Plus } from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';
import { Inbox } from 'lucide-react'

interface Props {
  reportId?: string;
  patientId?: string;
  onExport?: (sr: DicomSrDocument) => void;
}

const VR_COLORS: Record<string, string> = {
  AE: 'gray', AS: 'gray', AT: 'gray', CS: 'blue', DA: 'cyan', DS: 'orange', DT: 'cyan',
  FL: 'orange', FD: 'orange', IS: 'orange', LO: 'green', LT: 'green', OB: 'red', OD: 'red',
  OF: 'red', OL: 'red', OV: 'red', OW: 'red', PN: 'green', SH: 'green', SL: 'orange',
  SQ: 'purple', SS: 'orange', ST: 'green', SV: 'orange', TM: 'cyan', UC: 'green', UI: 'purple',
  UL: 'orange', UN: 'red', UR: 'purple', US: 'orange', UT: 'green',
};

export const DicomSRExporter: React.FC<Props> = ({ reportId, patientId, onExport }) => {
  const [documents, setDocuments] = useState<DicomSrDocument[]>(DICOM_SR_DOCUMENTS_MOCK);
  const [selectedId, setSelectedId] = useState<string | null>(DICOM_SR_MOCK.id);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; statusCode: number; durationMs: number } | null>(null);
  const [genForm, setGenForm] = useState({ findings: '', impression: '', recommendation: '' });
  const [sendForm, setSendForm] = useState({ aeTitle: 'PACS_RECEIVER', host: 'pacs.hospital.com', port: 11112 });

  const selected = useMemo(() => documents.find((d) => d.id === selectedId) ?? null, [documents, selectedId]);

  const handleDownload = useCallback(async () => {
    if (!selected) return;
    const r = await downloadDicomSr(selected.id);
    if (!r) { message.error('下载失败'); return; }
    const blob = new Blob([r.content], { type: r.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
    message.success(`已下载 ${r.filename}`);
  }, [selected]);

  const handleValidate = useCallback(() => {
    if (!selected) return;
    const r = validateDicomSr(selected);
    if (r.passed) message.success('DICOM SR 验证通过');
    else {
      message.error('DICOM SR 验证失败');
      Modal.error({ title: '验证失败', content: <ul>{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> });
    }
  }, [selected]);

  const handleGenerate = useCallback(async () => {
    if (!reportId) { message.warning('请先选择报告'); return; }
    setGenerating(true);
    const sr = await generateDicomSr({
      reportId, patientId: patientId ?? 'p-038', patientName: '张三',
      findings: genForm.findings, impression: genForm.impression, recommendation: genForm.recommendation,
    });
    setDocuments((arr) => [sr, ...arr]);
    setSelectedId(sr.id);
    setGenerating(false);
    setShowGenerate(false);
    message.success('DICOM SR 已生成');
    onExport?.(sr);
  }, [reportId, patientId, genForm, onExport]);

  const handleSend = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    const r = await sendDicomSr(selected.id, sendForm);
    setSendResult({ ...r });
    setSending(false);
    if (r.success) message.success('C-STORE 发送成功');
  }, [selected, sendForm]);

  const copyDataset = useCallback(() => {
    if (!selected) return;
    navigator.clipboard.writeText(dumpDicomSr(selected));
    message.success('DataSet 已复制');
  }, [selected]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title="SR 文档" value={documents.length} prefix={<Database className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已验证" value={documents.filter((d) => d.validation.passed).length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已发送" value={0} prefix={<Send className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总大小" value={(documents.reduce((a, d) => a + d.size, 0) / 1024).toFixed(1)} suffix="KB" prefix={<Layers className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="shadow-sm" title={<Space><Database className="w-4 h-4" /><span>DICOM SR 列表</span></Space>} extra={<Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowGenerate(true)} disabled={!reportId}>生成</Button>}>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {documents.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === d.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color="cyan">DICOM SR</Tag>
                  {d.validation.passed ? <Tag color="green" icon={<CheckCircle2 className="w-3 h-3" />}>已验证</Tag> : <Tag color="red">未通过</Tag>}
                </div>
                <div className="text-sm font-mono truncate">{d.id}</div>
                <div className="text-xs text-slate-500 truncate">{d.templateId} · {d.completionFlag}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{(d.size / 1024).toFixed(1)} KB</span>
                  <span>{d.contentSequence.length} 内容</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Braces className="w-4 h-4" /><span>DICOM SR 详情</span>{selected && <Tag color="cyan">{selected.sopClassUID.split('.').pop()}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleValidate}>验证</Button>
                <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={copyDataset}>复制</Button>
                <Button size="small" type="primary" icon={<Send className="w-3 h-3" />} onClick={() => setShowSend(true)}>C-STORE</Button>
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
                          <div className="text-slate-500">SOP Instance UID</div>
                          <div className="font-mono text-cyan-600 break-all">{selected.sopInstanceUID}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">SOP Class UID</div>
                          <div className="font-mono text-cyan-600 break-all">{selected.sopClassUID}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Study UID</div>
                          <div className="font-mono text-xs">{selected.studyInstanceUID}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Series UID</div>
                          <div className="font-mono text-xs">{selected.seriesInstanceUID}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">模板</div>
                          <div className="font-mono">{selected.templateId}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">完成/验证</div>
                          <div>
                            <Tag color={selected.completionFlag === 'COMPLETE' ? 'green' : 'orange'}>{selected.completionFlag}</Tag>
                            <Tag color={selected.verificationFlag === 'VERIFIED' ? 'green' : 'orange'}>{selected.verificationFlag}</Tag>
                          </div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">Transfer Syntax</div>
                          <div className="font-mono text-xs">{selected.transferSyntaxUID}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-slate-500">生成</div>
                          <div className="text-xs">{new Date(selected.generatedAt).toLocaleString()}</div>
                        </div>
                      </div>

                      <Divider className="my-2" />

                      <h5 className="text-sm font-semibold">Content Sequence</h5>
                      {selected.contentSequence.map((seq, i) => (
                        <div key={i} className="border-l-4 border-cyan-300 pl-2 mb-2">
                          <div className="text-sm font-semibold text-cyan-700">
                            <Tag color="cyan">{seq.conceptCode.code}</Tag>
                            {seq.conceptCode.codeMeaning}
                            <span className="text-xs text-slate-500 ml-2">/ {seq.conceptCode.codeMeaningEn}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{seq.items.length} items · continuity: {seq.continuity}</div>
                          <div className="ml-2 mt-1 space-y-1">
                            {seq.items.map((it, j) => (
                              <div key={j} className="text-xs p-1.5 bg-slate-50 rounded">
                                <div className="flex items-center gap-1">
                                  <Tag color="blue">{it.relationshipType}</Tag>
                                  <Tag color="purple">{it.valueType}</Tag>
                                  <span className="font-mono text-slate-700">{it.conceptCode.codeMeaning}</span>
                                </div>
                                {it.textValue && <div className="ml-1 mt-1 text-slate-600">{it.textValue}</div>}
                                {it.numValue !== undefined && <div className="ml-1 mt-1 text-slate-600">数值: {it.numValue} {it.unitCode?.code}</div>}
                                {it.codeValue && <div className="ml-1 mt-1 text-slate-600">代码: {it.codeValue.code} ({it.codeValue.codeMeaning})</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'elements',
                  label: `Data Elements (${selected.dataElements.length})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="tag"
                      dataSource={selected.dataElements}
                      pagination={false}
                      scroll={{ x: 'max-content', y: 400 }}
                      columns={[
                        { title: 'Tag', dataIndex: 'tag', key: 'tag', width: 100, render: (v) => <span className="font-mono text-xs">({v})</span> },
                        { title: 'VR', dataIndex: 'vr', key: 'vr', width: 60, render: (v) => <AntTag color={VR_COLORS[v] ?? 'default'}>{v}</AntTag> },
                        { title: 'Name', dataIndex: 'name', key: 'name', render: (v, r: any) => <div><div className="text-xs">{v}</div><div className="text-[10px] text-slate-400">{r.nameEn}</div></div> },
                        { title: 'Length', dataIndex: 'length', key: 'length', width: 70, render: (v) => <span className="text-xs">{v}</span> },
                        { title: 'Value', dataIndex: 'value', key: 'value', render: (v) => <span className="text-xs font-mono break-all">{Array.isArray(v) ? v.join('\\') : String(v)}</span> },
                      ]}
                    />
                  ),
                },
                {
                  key: 'dataset',
                  label: 'DataSet 文本',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono">
                      {dumpDicomSr(selected)}
                    </pre>
                  ),
                },
              ]}
            />
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请选择 SR 文档" />}
        </Card>
      </div>

      <Modal
        title={<Space><Database className="w-4 h-4" /><span>生成 DICOM SR</span></Space>}
        open={showGenerate}
        onCancel={() => setShowGenerate(false)}
        footer={null}
      >
        <Form layout="vertical">
          <Form.Item label="影像所见"><Input.TextArea rows={3} value={genForm.findings} onChange={(e) => setGenForm((f) => ({ ...f, findings: e.target.value }))} placeholder="例:右肺上叶..." /></Form.Item>
          <Form.Item label="诊断意见"><Input.TextArea rows={2} value={genForm.impression} onChange={(e) => setGenForm((f) => ({ ...f, impression: e.target.value }))} placeholder="例:右肺上叶周围型肺癌..." /></Form.Item>
          <Form.Item label="建议"><Input.TextArea rows={2} value={genForm.recommendation} onChange={(e) => setGenForm((f) => ({ ...f, recommendation: e.target.value }))} placeholder="例:建议穿刺活检..." /></Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowGenerate(false)}>取消</Button>
          <Button type="primary" onClick={handleGenerate} loading={generating}>生成</Button>
        </div>
      </Modal>

      <Modal
        title={<Space><Server className="w-4 h-4" /><span>DICOM C-STORE 发送</span></Space>}
        open={showSend}
        onCancel={() => setShowSend(false)}
        footer={null}
      >
        {sendResult ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <div className="text-base font-semibold">发送成功</div>
            <div className="text-xs text-slate-500">状态码: 0x{sendResult.statusCode.toString(16).padStart(4, '0').toUpperCase()}</div>
            <div className="text-xs text-slate-500">耗时: {sendResult.durationMs}ms</div>
          </div>
        ) : (
          <>
            <Form layout="vertical">
              <Form.Item label="AE Title"><Input value={sendForm.aeTitle} onChange={(e) => setSendForm((f) => ({ ...f, aeTitle: e.target.value }))} /></Form.Item>
              <Form.Item label="主机"><Input value={sendForm.host} onChange={(e) => setSendForm((f) => ({ ...f, host: e.target.value }))} /></Form.Item>
              <Form.Item label="端口"><Input type="number" value={sendForm.port} onChange={(e) => setSendForm((f) => ({ ...f, port: Number(e.target.value) }))} /></Form.Item>
            </Form>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowSend(false)}>取消</Button>
              <Button type="primary" icon={<Send className="w-3 h-3" />} onClick={handleSend} loading={sending}>发送</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default DicomSRExporter;

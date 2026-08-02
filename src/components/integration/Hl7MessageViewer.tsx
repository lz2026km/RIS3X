/**
 * G005 放射RIS系统 v3.0.6.0 - HL7 报文查看器
 * 20 升级点:段/字段/组件树形展示 / 验证 / 样本浏览 / 构造器
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, Tree, InputNumber,
} from 'antd';
import {
  FileText, Code, CheckCircle2, AlertCircle, Search, Copy, ListTree,
  Database, ChevronRight, Send, Activity, Eye, Hash, Layers,
} from 'lucide-react';
import { parse, validate, buildAdtMessage, buildOrmMessage, buildOruMessage, buildAckMessage, type Hl7ParsedMessage, type Hl7ValidationResult } from '@services/integration/hl7V2/Hl7V2Parser';
import { HL7V2_SAMPLES } from '@data/hl7v2Messages';
import type { Hl7MessageSample } from '@data/hl7v2Messages';

export const Hl7MessageViewer: React.FC = () => {
  const [selected, setSelected] = useState<Hl7MessageSample>(HL7V2_SAMPLES[0]!);
  const [parsed, setParsed] = useState<{ msg: Hl7ParsedMessage; validation: Hl7ValidationResult } | null>(() => {
    try { return { msg: parse(HL7V2_SAMPLES[0]!.message), validation: validate(HL7V2_SAMPLES[0]!.message) }; }
    catch { return null; }
  });
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderType, setBuilderType] = useState<'ADT' | 'ORM' | 'ORU' | 'ACK'>('ADT');

  const handleSelect = useCallback((s: Hl7MessageSample) => {
    setSelected(s);
    try {
      setParsed({ msg: parse(s.message), validation: validate(s.message) });
    } catch (err) {
      message.error('解析失败: ' + (err instanceof Error ? err.message : String(err)));
      setParsed(null);
    }
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(selected.message);
    message.success('已复制');
  }, [selected]);

  const segmentTree = useMemo(() => {
    if (!parsed) return [];
    return parsed.msg.segments.map((s) => ({
      title: (
        <Space size={4}>
          <Tag color={segmentColor(s.name)}>{s.name}</Tag>
          <span className="text-xs text-slate-500">{s.fields.length} 字段</span>
        </Space>
      ),
      key: `${s.order}-${s.name}`,
      children: s.fields.map((f, i) => ({
        title: (
          <div className="text-xs">
            <span className="text-slate-500 font-mono mr-1">[{i}]</span>
            <span className="font-mono break-all">{f.raw || '(空)'}</span>
            {f.components.length > 1 && <Tag className="ml-1" color="blue">{f.components.length} comps</Tag>}
          </div>
        ),
        key: `${s.order}-${s.name}-${i}`,
      })),
    }));
  }, [parsed]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="样本数" value={HL7V2_SAMPLES.length} prefix={<Database className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="ADT" value={HL7V2_SAMPLES.filter((s) => s.type === 'ADT').length} prefix={<Activity className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="ORU" value={HL7V2_SAMPLES.filter((s) => s.type === 'ORU').length} prefix={<FileText className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="段数" value={parsed?.msg.segments.length ?? 0} prefix={<Layers className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="字节" value={new Blob([selected.message]).size} prefix={<Hash className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 16  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="状态" value={parsed?.validation.passed ? '✓ 通过' : `✗ ${parsed?.validation.errors ?? 0}`} styles={{ content: {  fontSize: 14, color: parsed?.validation.passed ? '#10b981' : '#dc2626'  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="col-span-1 shadow-sm" title={<Space><ListTree className="w-4 h-4" /><span>样本列表</span></Space>} bodyStyle={{ padding: 8 }}>
          <div className="space-y-1 max-h-[520px] overflow-y-auto">
            {HL7V2_SAMPLES.map((s) => (
              <div key={s.id} onClick={() => handleSelect(s)} className={`p-2 border-2 rounded cursor-pointer transition ${selected.id === s.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <Tag color={typeColor(s.type)}>{s.type}^{s.trigger}</Tag>
                  <span className="text-[10px] text-slate-400">v{s.version}</span>
                </div>
                <div className="text-xs font-semibold mt-1">{s.nameEn}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{s.scenario}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Code className="w-4 h-4" /><span>{selected.nameEn}</span><Tag color={typeColor(selected.type)}>{selected.type}^{selected.trigger}</Tag></Space>
            <Space>
              <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={handleCopy}>复制</Button>
              <Button size="small" icon={<Send className="w-3 h-3" />} onClick={() => setBuilderOpen(true)}>构造器</Button>
            </Space>
          </div>
        }>
          {parsed ? (
            <Tabs
              items={[
                {
                  key: 'tree', label: '段结构',
                  children: (
                    <div className="max-h-[500px] overflow-auto">
                      <Tree treeData={segmentTree} defaultExpandAll showLine />
                    </div>
                  ),
                },
                {
                  key: 'meta', label: '元信息',
                  children: (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <KV k="消息类型" v={parsed.msg.messageType} />
                      <KV k="版本" v={parsed.msg.version} />
                      <KV k="控制 ID" v={parsed.msg.messageControlId} />
                      <KV k="发送应用" v={parsed.msg.sendingApplication} />
                      <KV k="发送设施" v={parsed.msg.sendingFacility} />
                      <KV k="接收应用" v={parsed.msg.receivingApplication} />
                      <KV k="接收设施" v={parsed.msg.receivingFacility} />
                      <KV k="时间戳" v={parsed.msg.timestamp} />
                      <KV k="处理 ID" v={parsed.msg.processingId} />
                      <KV k="编码" v={`FS=${parsed.msg.encoding.fieldSeparator} CS=${parsed.msg.encoding.componentSeparator}`} />
                      <KV k="PID 段" v={parsed.msg.patient ? `${parsed.msg.patient.fields.length} 字段` : '无'} />
                      <KV k="PV1 段" v={parsed.msg.visit ? `${parsed.msg.visit.fields.length} 字段` : '无'} />
                    </div>
                  ),
                },
                {
                  key: 'raw', label: '原始报文',
                  children: (
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[500px] font-mono whitespace-pre-wrap">{selected.message}</pre>
                  ),
                },
                {
                  key: 'validate', label: '验证',
                  children: (
                    <div className="space-y-1">
                      <Alert type={parsed.validation.passed ? 'success' : 'error'} showIcon
                        title={parsed.validation.passed ? '✓ 验证通过' : `✗ ${parsed.validation.errors} 个错误, ${parsed.validation.warnings} 个警告`} />
                      {parsed.validation.issues.map((iss, i) => (
                        <div key={i} className={`p-2 text-xs rounded ${iss.level === 'error' ? 'bg-red-50 text-red-700' : iss.level === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50'}`}>
                          <Space>
                            <Tag color={iss.level === 'error' ? 'red' : iss.level === 'warning' ? 'orange' : 'default'}>{iss.code}</Tag>
                            <span className="font-mono">{iss.location ?? ''}</span>
                            <span>{iss.message}</span>
                          </Space>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          ) : <Empty description="解析失败" />}
        </Card>
      </div>

      <Modal title={<Space><Send className="w-4 h-4" /><span>HL7 报文构造器</span></Space>} open={builderOpen} onCancel={() => setBuilderOpen(false)} footer={null} width={600}>
        <Builder type={builderType} onChange={setBuilderType} />
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

const Builder: React.FC<{ type: 'ADT' | 'ORM' | 'ORU' | 'ACK'; onChange: (t: 'ADT' | 'ORM' | 'ORU' | 'ACK') => void }> = ({ type, onChange }) => {
  const [patient, setPatient] = useState({ id: 'P0001', name: '张三', birthDate: '19800101', sex: 'M' });
  const [order, setOrder] = useState({ orderId: 'ORD-001', procedureCode: 'CT-CHEST', procedureName: '胸部CT' });
  const [out, setOut] = useState<string>('');

  const build = useCallback(() => {
    let s = '';
    if (type === 'ADT') s = buildAdtMessage({ trigger: 'A01', patientId: patient.id, patientName: patient.name, birthDate: patient.birthDate, sex: patient.sex as 'M' | 'F' | 'O' });
    else if (type === 'ORM') s = buildOrmMessage({ patientId: patient.id, patientName: patient.name, orderId: order.orderId, procedureCode: order.procedureCode, procedureName: order.procedureName });
    else if (type === 'ORU') s = buildOruMessage({ patientId: patient.id, patientName: patient.name, accessionNumber: order.orderId, procedureCode: order.procedureCode, observations: [{ code: 'FINDING', name: '影像所见', value: '示例所见', valueType: 'TX' }] });
    else s = buildAckMessage({ ackCode: 'AA', originalControlId: 'MSG-001' });
    setOut(s);
  }, [type, patient, order]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">类型:</span>
        <Select value={type} onChange={onChange} size="small" className="w-32" options={[
          { value: 'ADT', label: 'ADT' },
          { value: 'ORM', label: 'ORM' },
          { value: 'ORU', label: 'ORU' },
          { value: 'ACK', label: 'ACK' },
        ]} />
        <Button size="small" type="primary" onClick={build}>生成</Button>
        <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={() => { navigator.clipboard.writeText(out); message.success('已复制'); }}>复制</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Form layout="vertical" size="small">
          <Form.Item label="患者 ID"><Input value={patient.id} onChange={(e) => setPatient((p) => ({ ...p, id: e.target.value }))} /></Form.Item>
          <Form.Item label="姓名"><Input value={patient.name} onChange={(e) => setPatient((p) => ({ ...p, name: e.target.value }))} /></Form.Item>
          <Form.Item label="出生日期"><Input value={patient.birthDate} onChange={(e) => setPatient((p) => ({ ...p, birthDate: e.target.value }))} /></Form.Item>
          <Form.Item label="性别"><Input value={patient.sex} onChange={(e) => setPatient((p) => ({ ...p, sex: e.target.value }))} /></Form.Item>
        </Form>
        <Form layout="vertical" size="small">
          <Form.Item label="申请 ID"><Input value={order.orderId} onChange={(e) => setOrder((o) => ({ ...o, orderId: e.target.value }))} /></Form.Item>
          <Form.Item label="项目代码"><Input value={order.procedureCode} onChange={(e) => setOrder((o) => ({ ...o, procedureCode: e.target.value }))} /></Form.Item>
          <Form.Item label="项目名称"><Input value={order.procedureName} onChange={(e) => setOrder((o) => ({ ...o, procedureName: e.target.value }))} /></Form.Item>
        </Form>
      </div>
      {out && <pre className="bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-auto max-h-[200px] font-mono whitespace-pre-wrap">{out}</pre>}
    </div>
  );
};

function typeColor(type: string): string {
  if (type === 'ADT') return 'green';
  if (type === 'ORM') return 'orange';
  if (type === 'ORU') return 'blue';
  if (type === 'ACK') return 'purple';
  if (type === 'DFT') return 'cyan';
  if (type === 'MDM') return 'magenta';
  if (type === 'QBP') return 'gold';
  if (type === 'RSP') return 'geekblue';
  return 'default';
}

function segmentColor(name: string): string {
  if (name === 'MSH') return 'purple';
  if (name === 'PID') return 'green';
  if (name === 'PV1') return 'cyan';
  if (name === 'OBR' || name === 'ORC') return 'orange';
  if (name === 'OBX') return 'blue';
  if (name === 'MSA') return 'magenta';
  if (name === 'NTE') return 'gold';
  if (name === 'NK1') return 'lime';
  if (name === 'AL1') return 'volcano';
  return 'default';
}

export default Hl7MessageViewer;

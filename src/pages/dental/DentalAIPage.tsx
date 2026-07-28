// [v3.0.6.8-53] 口腔 AI 辅助诊断页面
import React, { useState } from 'react';
import { Card, Space, Tag, Button, Row, Col, Statistic, message, Divider, Alert, Tabs, Empty, List, Modal, Table } from 'antd';
import { Brain, Activity, AlertTriangle, CheckCircle2, Scan, Eye } from 'lucide-react';

export const DentalAIPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('caries');
  const [loading, setLoading] = useState(false);
  const [cariesResult, setCariesResult] = useState<any>(null);
  const [periapicalResult, setPeriapicalResult] = useState<any>(null);
  const [boneLossResult, setBoneLossResult] = useState<any>(null);
  const [rootCanalResult, setRootCanalResult] = useState<any>(null);
  const [oralCavityResult, setOralCavityResult] = useState<any>(null);

  const handleInfer = async (endpoint: string, setter: Function) => {
    setLoading(true);
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"imageBase64":""}' });
      const d = await r.json();
      if (d.success) { setter(d.data); message.success('AI 检测完成'); }
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  const endpoints: Record<string, { name: string; url: string; setter: Function }> = {
    caries: { name: '龋齿检测', url: '/api/v1/dental/ai/caries-detection', setter: setCariesResult },
    periapical: { name: '根尖周炎分级', url: '/api/v1/dental/ai/periapical-grading', setter: setPeriapicalResult },
    boneloss: { name: '牙周骨丧失', url: '/api/v1/dental/ai/bone-loss', setter: setBoneLossResult },
    rootcanal: { name: '根管检测', url: '/api/v1/dental/ai/root-canal-detection', setter: setRootCanalResult },
    oral: { name: '口腔黏膜筛查', url: '/api/v1/dental/ai/oral-cavity-screening', setter: setOralCavityResult },
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5' }}>
      <Space style={{ marginBottom: 16 }}>
        <Brain size={20} color="#722ed1" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔 AI 辅助诊断</span>
        <Tag color="cyan">v3.0.6.8-53</Tag>
        <Tag color="magenta">混合推理 (ONNX + API)</Tag>
      </Space>
      <Row gutter={16}>
        {Object.entries(endpoints).map(([key, ep]) => (
          <Col span={8} key={key} style={{ marginBottom: 16 }}>
            <Card size="small" title={ep.name} extra={<Button size="small" loading={loading && activeTab === key} icon={<Scan size={12} />} onClick={() => { setActiveTab(key); handleInfer(ep.url, ep.setter); }}>运行</Button>}>
              {key === 'caries' && cariesResult && (
                <div>{cariesResult.detections.map((d: any, i: number) => <Tag key={i} color="orange">{d.toothNo}-{d.surface} ({(d.confidence*100).toFixed(0)}%)</Tag>)}</div>
              )}
              {key === 'periapical' && periapicalResult && (
                <div><Tag color="orange">PI: {periapicalResult.periapicalIndex}</Tag><Tag color="blue">RCP: {periapicalResult.rcpScore}</Tag></div>
              )}
              {key === 'boneloss' && boneLossResult && <div><Tag color="orange">上颌: {boneLossResult.boneLoss.maxilla}%</Tag><Tag color="blue">下颌: {boneLossResult.boneLoss.mandible}%</Tag></div>}
              {key === 'rootcanal' && rootCanalResult && <div>{rootCanalResult.canals.map((c: any, i: number) => <Tag key={i} color="purple">{c.toothNo} ({c.canalCount}根管)</Tag>)}</div>}
              {key === 'oral' && oralCavityResult && <div>{oralCavityResult.findings.map((f: any, i: number) => <Tag key={i} color={f.risk === 'moderate' ? 'orange' : 'green'}>{f.location}: {f.type}</Tag>)}</div>}
              
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
export default DentalAIPage;

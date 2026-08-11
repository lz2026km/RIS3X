// [v3.0.6.8-36] PR 3: Toric 散光晶体规划 + 真实 Barrett II/Kane/Hill-RBF
// 对标: ZEISS IOLMaster 700 + Alcon/J&J Toric Calculator
import { Card, Space, Tag, Button, Select, Form, Row, Col, Divider, message, Tabs, List, Empty, Statistic, Alert, InputNumber, Radio } from 'antd';
import { Calculator, Compass, TrendingUp } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useCallback, useEffect } from 'react';

interface IOLResult {
  formula: string;
  power: number;
  method: string;
  source: string;
  calculatedAt: string;
}

interface ToricPlan {
  iolModel: string;
  iolCylinderPower: string;
  preOpCornealAstigmatism: string;
  surgicallyInducedAstigmatism: string;
  residualAstigmatism: string;
  suggestedAxis: number;
  alignmentMarks: { preOp: string; iol: string };
  method: string;
  note: string;
}

const IOL_MODELS = [
  { value: 'SA60AT', label: 'Alcon AcrySof SA60AT (单焦)' },
  { value: 'TECNIS-1PC', label: 'J&J TECNIS 1-Piece (单焦)' },
  { value: 'CT-LUCIA', label: 'Zeiss CT-LUCIA (单焦)' },
  { value: 'SN6AT3-SN6AT9', label: 'Alcon AcrySof Toric T3-T9' },
  { value: 'TECNIS-Toric', label: 'J&J TECNIS Toric' },
  { value: 'PanOptix', label: 'Alcon PanOptix (三焦)' },
  { value: 'TECNIS-Symfony', label: 'J&J TECNIS Symfony (连续视程)' },
];

const FORMULAS = [
  { value: 'Barrett-true-K', label: 'Barrett Universal II (真实)' },
  { value: 'Kane', label: 'Kane (现代化)' },
  { value: 'Hill-RBF', label: 'Hill-RBF 2.0 (RBF 神经网络)' },
  { value: 'SRK-T', label: 'SRK/T' },
  { value: 'Hoffer-Q', label: 'Hoffer Q' },
  { value: 'Holladay-1', label: 'Holladay 1' },
];

export const ToricPlannerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('iol');
  // IOL 计算
  const [eye, setEye] = useState<'OD' | 'OS'>('OD');
  const [AL, setAL] = useState(23.5);
  const [K1, setK1] = useState(43.0);
  const [K2, setK2] = useState(43.5);
  const [ACD, setACD] = useState(3.0);
  const [LT, setLT] = useState(4.5);
  const [CCT, setCCT] = useState(0.55);
  const [iolModel, setIolModel] = useState('SA60AT');
  const [formula, setFormula] = useState('Barrett-true-K');
  const [_aConstant, setAConstant] = useState<number | null>(null); // [v3.0.6.8-84] 自动加载
  const [results, setResults] = useState<IOLResult[]>([]);
  const [busy, setBusy] = useState(false);

  // Toric
  const [preOpK1, setPreOpK1] = useState(42.5);
  const [preOpK2, setPreOpK2] = useState(44.0);
  const [preOpAxis, setPreOpAxis] = useState(90);
  const [SIA, setSIA] = useState(0.3);
  const [toricModel, setToricModel] = useState('SN6AT5');
  const [toricCylinder, setToricCylinder] = useState(2.25);
  const [toricPlan, setToricPlan] = useState<ToricPlan | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);

  // 术后预测
  const [targetPower, setTargetPower] = useState(21.0);
  const [postopPrediction, setPostopPrediction] = useState<any>(null);

  // [v3.0.6.8-84] 加载 IOL 常数 (自动应用)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/v1/eye/iol/constant/${iolModel}`);
        const data = await r.json();
        if (cancelled) return;
        if (data.success && data.data && data.data[formula]) {
          const c = data.data[formula];
          setAConstant(c.aConst ?? null);
        } else {
          setAConstant(null);
        }
      } catch {
        if (!cancelled) setAConstant(null);
      }
    })();
    return () => { cancelled = true; };
  }, [iolModel, formula]);

  // 计算 IOL 度数
  const handleCalculateIOL = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/eye/iol/calculate/${formula}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ AL, K1, K2, ACD, LT, CCT, eye, iolModel }),
      });
      const data = await r.json();
      if (data.success) {
        setResults(prev => [data.data, ...prev].slice(0, 10));
        message.success(`${data.data.formula}: ${data.data.power} D`);
      }
    } catch (e: any) {
      message.error(`计算失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [AL, K1, K2, ACD, LT, CCT, formula, iolModel, eye]);

  // Toric 规划
  const handleToricPlan = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/eye/iol/toric/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eye, preOpK1, preOpK2, preOpAxis, inducedAstigmatism: SIA, iolModel: toricModel, iolCylinderPower: toricCylinder }),
      });
      const data = await r.json();
      if (data.success) setToricPlan(data.data);

      // 同时获取候选晶体
      const cR = await fetch(`/api/v1/eye/iol/toric/candidate?cornealAst=${Math.abs(preOpK1 - preOpK2)}&sia=${SIA}`);
      const cData = await cR.json();
      if (cData.success) setCandidates(cData.data);
    } catch (e: any) {
      message.error(`Toric 规划失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [eye, preOpK1, preOpK2, preOpAxis, SIA, toricModel, toricCylinder]);

  // 术后预测
  const handlePostopPredict = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/eye/iol/predict/postop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPower, K1, K2, AL, ACD }),
      });
      const data = await r.json();
      if (data.success) setPostopPrediction(data.data);
    } catch (e: any) {
      message.error(`预测失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [targetPower, K1, K2, AL, ACD]);

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Calculator size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼科 IOL 规划</span>
        <Tag color="cyan">PR3</Tag>
        <Tag color="purple">v3.0.6.8-36</Tag>
        <Tag color="blue">Barrett II / Kane / Hill-RBF 真实</Tag>
        {/* [v3.0.6.11-88 Round10] /eye/iol/toric|predict 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          { key: 'iol', label: <span><Calculator size={14} /> IOL 度数</span>, children: (
          <Row gutter={16}>
            <Col span={10}>
              <Card title="生物参数" size="small">
                <Form layout="vertical" size="small">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="眼别">
                        <Radio.Group value={eye} onChange={e => setEye(e.target.value)}>
                          <Radio.Button value="OD">OD 右</Radio.Button>
                          <Radio.Button value="OS">OS 左</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="IOL 型号">
                    <Select value={iolModel} onChange={setIolModel} options={IOL_MODELS} />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="眼轴长 AL (mm)">
                        <InputNumber value={AL} onChange={v => setAL(v || 23.5)} min={15} max={35} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="前房深度 ACD (mm)">
                        <InputNumber value={ACD} onChange={v => setACD(v || 3.0)} min={1.5} max={5} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="K1 (D)">
                        <InputNumber value={K1} onChange={v => setK1(v || 43.0)} min={30} max={60} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="K2 (D)">
                        <InputNumber value={K2} onChange={v => setK2(v || 43.5)} min={30} max={60} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="晶体厚度 LT (mm)">
                        <InputNumber value={LT} onChange={v => setLT(v || 4.5)} min={3} max={6} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="中央角膜厚度 CCT (mm)">
                        <InputNumber value={CCT} onChange={v => setCCT(v || 0.55)} min={0.4} max={0.8} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="公式">
                    <Select value={formula} onChange={setFormula} options={FORMULAS} />
                  </Form.Item>
                  <Button type="primary" block icon={<Calculator size={14} />} loading={busy} onClick={handleCalculateIOL}>
                    计算 IOL 度数
                  </Button>
                </Form>
              </Card>
            </Col>
            <Col span={14}>
              <Card title="计算结果" size="small">
                {results.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击计算按钮" />
                ) : (
                  <List
                    size="small"
                    dataSource={results}
                    renderItem={r => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <div style={{
                              width: 80, height: 80, borderRadius: 8,
                              background: 'linear-gradient(135deg, #2563eb, #69b1ff)',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexDirection: 'column',
                            }}>
                              <div style={{ fontSize: 22, fontWeight: 700 }}>{r.power}</div>
                              <div style={{ fontSize: 10 }}>D</div>
                            </div>
                          }
                          title={
                            <Space>
                              <Tag color="blue">{r.formula}</Tag>
                              <Tag color="green">{r.method}</Tag>
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {r.source} · {new Date(r.calculatedAt).toLocaleString('zh-CN')}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>
          ) },

          { key: 'toric', label: <span><Compass size={14} /> Toric 散光</span>, children: (
          <Row gutter={16}>
            <Col span={10}>
              <Card title="术前参数" size="small">
                <Form layout="vertical" size="small">
                  <Form.Item label="眼别">
                    <Radio.Group value={eye} onChange={e => setEye(e.target.value)}>
                      <Radio.Button value="OD">OD</Radio.Button>
                      <Radio.Button value="OS">OS</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="K1 (陡)">
                        <InputNumber value={preOpK1} onChange={v => setPreOpK1(v || 42.5)} min={30} max={60} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="K2 (平)">
                        <InputNumber value={preOpK2} onChange={v => setPreOpK2(v || 44.0)} min={30} max={60} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="陡轴轴位 (°)">
                    <InputNumber value={preOpAxis} onChange={v => setPreOpAxis(v || 90)} min={0} max={180} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="手术源性散光 SIA (D)">
                    <InputNumber value={SIA} onChange={v => setSIA(v || 0.3)} min={0} max={2} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="晶体型号">
                    <Select value={toricModel} onChange={setToricModel} options={IOL_MODELS.filter(m => m.value.includes('Toric'))} />
                  </Form.Item>
                  <Form.Item label="晶体散光 (D)">
                    <InputNumber value={toricCylinder} onChange={v => setToricCylinder(v || 2.25)} min={0} max={6} step={0.25} style={{ width: '100%' }} />
                  </Form.Item>
                  <Button type="primary" block icon={<Compass size={14} />} loading={busy} onClick={handleToricPlan}>
                    Toric 规划
                  </Button>
                </Form>
              </Card>
            </Col>
            <Col span={14}>
              <Card title="Toric 规划结果" size="small">
                {toricPlan ? (
                  <Row gutter={[16, 12]}>
                    <Col span={12}>
                      <Statistic
                        title="角膜散光 (术前)"
                        value={toricPlan.preOpCornealAstigmatism}
                        styles={{ content: {  color: '#2563eb', fontSize: 18  } }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="SIA"
                        value={toricPlan.surgicallyInducedAstigmatism}
                        styles={{ content: {  color: '#faad14', fontSize: 18  } }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="残余散光"
                        value={toricPlan.residualAstigmatism}
                        styles={{ content: { 
                          color: parseFloat(toricPlan.residualAstigmatism) < 0.5 ? '#52c41a' : '#ff4d4f',
                          fontSize: 18,
                         } }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="建议 IOL 轴位"
                        value={toricPlan.suggestedAxis + '°'}
                        styles={{ content: {  color: '#722ed1', fontSize: 18  } }}
                      />
                    </Col>
                    <Col span={24}>
                      <Divider style={{ margin: '4px 0' }} />
                      <Alert
                        title={toricPlan.method}
                        description={toricPlan.note}
                        type="info"
                        showIcon
                      />
                    </Col>
                    <Col span={24}>
                      <Card size="small" title="候选 Toric 晶体">
                        {candidates.length > 0 ? (
                          <List
                            size="small"
                            dataSource={candidates}
                            renderItem={c => (
                              <List.Item
                                actions={c.recommended ? [<Tag color="green">推荐</Tag>] : []}
                              >
                                <List.Item.Meta
                                  title={
                                    <Space>
                                      <Tag color="blue">{c.model}</Tag>
                                      <span style={{ fontSize: 12 }}>散光: {c.cylinderPower}</span>
                                    </Space>
                                  }
                                  description={
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                      残余: {c.residualAstigmatism}
                                    </span>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                        ) : (
                          <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />
                        )}
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击 Toric 规划" />
                )}
              </Card>
            </Col>
          </Row>
          ) },

          { key: 'postop', label: <span><TrendingUp size={14} /> 术后预测</span>, children: (
          <Row gutter={16}>
            <Col span={10}>
              <Card title="预测参数" size="small">
                <Form layout="vertical" size="small">
                  <Form.Item label="目标 IOL 度数 (D)">
                    <InputNumber value={targetPower} onChange={v => setTargetPower(v || 21.0)} min={0} max={40} step={0.5} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="眼轴长 AL (mm)">
                    <InputNumber value={AL} onChange={v => setAL(v || 23.5)} min={15} max={35} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="K1 / K2 (D)">
                    <Space>
                      <InputNumber value={K1} onChange={v => setK1(v || 43.0)} min={30} max={60} step={0.01} />
                      <InputNumber value={K2} onChange={v => setK2(v || 43.5)} min={30} max={60} step={0.01} />
                    </Space>
                  </Form.Item>
                  <Form.Item label="前房深度 ACD (mm)">
                    <InputNumber value={ACD} onChange={v => setACD(v || 3.0)} min={1.5} max={5} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                  <Button type="primary" block icon={<TrendingUp size={14} />} loading={busy} onClick={handlePostopPredict}>
                    预测术后
                  </Button>
                </Form>
              </Card>
            </Col>
            <Col span={14}>
              <Card title="术后预测结果" size="small">
                {postopPrediction ? (
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Statistic
                        title="预测等效球镜"
                        value={postopPrediction.predictedSE}
                        styles={{ content: {  color: '#2563eb', fontSize: 24  } }}
                        suffix="D"
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="预测 UCVA"
                        value={postopPrediction.predictedUCVA}
                        styles={{ content: {  color: '#52c41a', fontSize: 24  } }}
                      />
                    </Col>
                    <Col span={24}>
                      <Divider style={{ margin: '4px 0' }} />
                      <Alert
                        title={postopPrediction.method}
                        description={`目标度数: ${postopPrediction.targetPower} D · 置信度: ${(postopPrediction.confidence * 100).toFixed(0)}%`}
                        type="success"
                        showIcon
                      />
                    </Col>
                  </Row>
                ) : (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击术后预测" />
                )}
              </Card>
            </Col>
          </Row>
          ) },
        ]}
      />
    </div>
  );
};

export default ToricPlannerPage;

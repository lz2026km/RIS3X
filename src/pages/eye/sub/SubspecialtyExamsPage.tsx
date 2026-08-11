// [v3.0.6.8-37] PR 4: 8 亚专科纵深
// 对标: Medisoft mediSIGHT 8 亚专科模块
// 5 专科量表 + 接触镜 + 低视力
import { Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message, Empty, Statistic, Alert, InputNumber, Radio } from 'antd';
import { Eye, Activity, Compass, Layers, Zap, Glasses, Accessibility, Save } from 'lucide-react';
import { Inbox } from 'lucide-react'
// [v3.0.6.11-88 Round10] 接触镜验配走 API 层 (后端 POST /eye/contact-lens/fitting)
import { eyeApi } from '../../../services/api/eyeApi'
import React, { useState } from 'react';

const {  } = Input;

// 5 专科 + 接触镜 + 低视力 = 7 页面 (PR 4 新增)

export const StrabismusPage: React.FC = () => {
  const [eye, setEye] = useState<'OD' | 'OS'>('OD');
  const [horiz, setHoriz] = useState(10);
  const [vert, setVert] = useState(0);
  const [torsion, setTorsion] = useState(0);
  const [patientId, setPatientId] = useState('P000001');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/strabismus/synoptophore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, eye, horizontalPrism: horiz, verticalPrism: vert, torsion }),
      });
      const data = await r.json();
      if (data.success) { setResult(data.data); message.success('同视机检查完成'); }
    } catch (e: any) { message.error(e.message); }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Eye size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>斜视专科</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">同视机 + 三棱镜</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="同视机检查" size="small">
            <Form layout="vertical" size="small">
              <Form.Item label="患者 ID"><Input value={patientId} onChange={e => setPatientId(e.target.value)} /></Form.Item>
              <Form.Item label="眼别">
                <Radio.Group value={eye} onChange={e => setEye(e.target.value)}>
                  <Radio.Button value="OD">OD 右</Radio.Button>
                  <Radio.Button value="OS">OS 左</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item label={`水平斜视 (Δ) - ${horiz > 0 ? '内斜' : horiz < 0 ? '外斜' : '正位'}`}>
                <InputNumber value={horiz} onChange={v => setHoriz(v || 0)} min={-50} max={50} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={`垂直斜视 (Δ) - ${vert > 0 ? '上斜' : vert < 0 ? '下斜' : '正位'}`}>
                <InputNumber value={vert} onChange={v => setVert(v || 0)} min={-20} max={20} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={`旋转斜视 (°)`}>
                <InputNumber value={torsion} onChange={v => setTorsion(v || 0)} min={-30} max={30} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" block icon={<Save size={14} />} onClick={handleSubmit}>保存</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="检查结果" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Statistic title="水平" value={`${result.result.horizontal.value} ${result.result.horizontal.unit}`}
                    styles={{ content: {  color: Math.abs(result.result.horizontal.value) > 10 ? '#ff4d4f' : '#52c41a'  } }} />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.result.horizontal.type}</div>
                </Col>
                <Col span={8}>
                  <Statistic title="垂直" value={`${result.result.vertical.value} ${result.result.vertical.unit}`} />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.result.vertical.type}</div>
                </Col>
                <Col span={8}>
                  <Statistic title="旋转" value={`${result.result.torsion.value}${result.result.torsion.unit}`} />
                </Col>
                <Col span={24}>
                  <Divider style={{ margin: '4px 0' }} />
                  <Alert title={result.diagnosis} type={result.diagnosis === '正常' ? 'success' : 'warning'} showIcon />
                </Col>
                <Col span={24}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>方法: {result.method}</div>
                </Col>
              </Row>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击保存按钮" />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const NeuroOphthalmologyPage: React.FC = () => {
  const [test, setTest] = useState<'ishihara' | 'farnsworth' | 'd15'>('ishihara');
  const [errors, setErrors] = useState(0);
  const [p100Lat, setP100Lat] = useState(105);
  const [p100Amp, setP100Amp] = useState(8.5);
  const [result, setResult] = useState<any>(null);

  const handleColor = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/neuro/color-vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P000001', test, errors, eye: 'OD' }),
      });
      const data = await r.json();
      if (data.success) { setResult({ ...data.data, type: 'color' }); message.success('色觉检查完成'); }
    } catch (e: any) { message.error(e.message); }
  };

  const handlePvep = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/neuro/pvep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P000001', eye: 'OD', p100Latency: p100Lat, p100Amplitude: p100Amp }),
      });
      const data = await r.json();
      if (data.success) { setResult({ ...data.data, type: 'pvep' }); message.success('PVEP 检查完成'); }
    } catch (e: any) { message.error(e.message); }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>神经眼科</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">色觉 + PVEP</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="色觉检查" size="small">
            <Form layout="vertical" size="small">
              <Form.Item label="测试方法">
                <Radio.Group value={test} onChange={e => setTest(e.target.value)}>
                  <Radio.Button value="ishihara">Ishihara</Radio.Button>
                  <Radio.Button value="d15">D-15</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="错误数">
                <InputNumber value={errors} onChange={v => setErrors(v || 0)} min={0} max={38} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" block onClick={handleColor}>检查</Button>
            </Form>
          </Card>
          <Card title="PVEP (图形视觉诱发电位)" size="small" style={{ marginTop: 16 }}>
            <Form layout="vertical" size="small">
              <Form.Item label="P100 潜伏期 (ms)">
                <InputNumber value={p100Lat} onChange={v => setP100Lat(v || 105)} min={80} max={200} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="P100 振幅 (μV)">
                <InputNumber value={p100Amp} onChange={v => setP100Amp(v || 8.5)} min={1} max={30} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" block onClick={handlePvep}>检查</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="检查结果" size="small">
            {result ? (
              result.type === 'color' ? (
                <Alert title={result.diagnosis} description={`${result.method} | 错误: ${result.errors}`} type={result.diagnosis.includes('异常') ? 'warning' : 'success'} showIcon />
              ) : (
                <Row gutter={[16, 16]}>
                  <Col span={12}><Statistic title="P100 潜伏期" value={`${result.p100Latency.value} ${result.p100Latency.unit}`} styles={{ content: {  color: result.p100Latency.normal ? '#52c41a' : '#ff4d4f'  } }} /></Col>
                  <Col span={12}><Statistic title="P100 振幅" value={`${result.p100Amplitude.value} ${result.p100Amplitude.unit}`} /></Col>
                  <Col span={24}><Alert title={result.diagnosis} type={result.diagnosis.includes('正常') ? 'success' : 'warning'} showIcon /></Col>
                </Row>
              )
            ) : <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const OcularOncologyPage: React.FC = () => {
  const [od, setOd] = useState(14);
  const [os, setOs] = useState(15);
  const [ref, setRef] = useState(12);
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/oncology/exophthalmometry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P000001', odValue: od, osValue: os, reference: ref }),
      });
      const data = await r.json();
      if (data.success) { setResult(data.data); message.success('眼突计检查完成'); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Compass size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼眶肿瘤</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">Hertel 眼突计</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="Hertel 眼突计" size="small">
            <Form layout="vertical" size="small">
              <Form.Item label="右眼 OD (mm)"><InputNumber value={od} onChange={v => setOd(v || 14)} min={5} max={30} step={0.5} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="左眼 OS (mm)"><InputNumber value={os} onChange={v => setOs(v || 15)} min={5} max={30} step={0.5} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="参考值 (mm)"><InputNumber value={ref} onChange={v => setRef(v || 12)} min={8} max={20} step={0.5} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>检查</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="结果" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={8}><Statistic title="OD" value={result.od.value} suffix="mm" /></Col>
                <Col span={8}><Statistic title="OS" value={result.os.value} suffix="mm" /></Col>
                <Col span={8}><Statistic title="差值" value={result.difference} suffix="mm" styles={{ content: {  color: result.difference > 2 ? '#ff4d4f' : '#52c41a'  } }} /></Col>
                <Col span={24}><Alert title={result.diagnosis} type={result.diagnosis === '双眼对称' ? 'success' : 'warning'} showIcon /></Col>
              </Row>
            ) : <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const CorneaPage: React.FC = () => {
  const [kmax, setKmax] = useState(46.5);
  const [pachy, setPachy] = useState(540);
  const [bad, setBad] = useState(1.2);
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/cornea/pentacam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P000001', eye: 'OD', kmax, thinnestPachy: pachy, pachyMin: pachy, pachyMinX: 0, pachyMinY: -0.5 }),
      });
      const data = await r.json();
      if (data.success) { setResult(data.data); message.success('Pentacam + BAD 检查完成'); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>角膜病</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">Pentacam + BAD 指数</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="Pentacam 检查" size="small">
            <Form layout="vertical" size="small">
              <Form.Item label="Kmax 最大曲率 (D)"><InputNumber value={kmax} onChange={v => setKmax(v || 46.5)} min={35} max={70} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="最薄点角膜厚度 (μm)"><InputNumber value={pachy} onChange={v => setPachy(v || 540)} min={300} max={700} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="BAD 指数"><InputNumber value={bad} onChange={v => setBad(v || 1.2)} min={-5} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>检查</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="结果" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={8}><Statistic title="Kmax" value={result.kmax.value} suffix="D" styles={{ content: {  color: result.kmax.value > 47 ? '#ff4d4f' : '#52c41a'  } }} /></Col>
                <Col span={8}><Statistic title="最薄点" value={result.thinnestPachy.value} suffix="μm" styles={{ content: {  color: result.thinnestPachy.value < 480 ? '#ff4d4f' : '#52c41a'  } }} /></Col>
                <Col span={8}><Statistic title="BAD 评分" value={result.badScore} styles={{ content: {  color: result.badScore >= 2 ? '#ff4d4f' : '#52c41a'  } }} /></Col>
                <Col span={24}><Alert title={result.diagnosis} type={result.isKeratoconus ? 'error' : 'success'} showIcon /></Col>
              </Row>
            ) : <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const ContactLensFittingPage: React.FC = () => {
  const [lensType, setLensType] = useState('RGP');
  const [brand, setBrand] = useState('Bausch + Lomb');
  const [bc, setBc] = useState(7.8);
  const [dia, setDia] = useState(14.0);
  const [power, setPower] = useState(-3.0);
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      // [v3.0.6.11-88 Round10] raw fetch → eyeApi.contactLensFitting (后端 POST /eye/contact-lens/fitting 真实存在)
      const res = await eyeApi.contactLensFitting({ patientId: 'P000001', lensType, brand, bc, dia, power });
      if (res.success) { setResult(res.data); message.success('接触镜试戴记录保存'); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Glasses size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>接触镜验配</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">RGP / Scleral / OK镜</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="试戴参数" size="small">
            <Form layout="vertical" size="small">
              <Form.Item label="镜片类型">
                <Select value={lensType} onChange={setLensType} options={[
                  { value: 'RGP', label: 'RGP 硬性透气' },
                  { value: 'Scleral', label: '巩膜镜' },
                  { value: 'OK', label: 'OK 镜 (角膜塑形)' },
                  { value: 'Soft', label: '软性' },
                ]} />
              </Form.Item>
              <Form.Item label="品牌"><Input value={brand} onChange={e => setBrand(e.target.value)} /></Form.Item>
              <Form.Item label="基弧 BC (mm)"><InputNumber value={bc} onChange={v => setBc(v || 7.8)} min={6} max={12} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="直径 DIA (mm)"><InputNumber value={dia} onChange={v => setDia(v || 14.0)} min={10} max={24} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="度数 (D)"><InputNumber value={power} onChange={v => setPower(v || -3.0)} min={-30} max={30} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block icon={<Save size={14} />} onClick={handleSubmit}>保存试戴</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="试戴结果" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={12}><Statistic title="试戴 ID" value={result.fittingId} /></Col>
                <Col span={12}><Statistic title="类型" value={result.lensType} /></Col>
                <Col span={8}><Statistic title="基弧" value={result.bc} suffix="mm" /></Col>
                <Col span={8}><Statistic title="直径" value={result.dia} suffix="mm" /></Col>
                <Col span={8}><Statistic title="度数" value={result.power} suffix="D" /></Col>
                <Col span={24}><Alert title={`配适: ${result.fit}`} type="success" showIcon /></Col>
              </Row>
            ) : <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const LowVisionPage: React.FC = () => {
  const [reDist, setReDist] = useState('0.1');
  const [reNear, setReNear] = useState('0.5');
  const [leDist, setLeDist] = useState('0.08');
  const [leNear, setLeNear] = useState('0.4');
  const [reDevice, setReDevice] = useState('普通眼镜 + 手持放大镜 4X');
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      const r = await fetch('/api/v1/eye/low-vision/prescription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P000001', reDist, reNear, leDist, leNear, reDevice, leDevice: reDevice, recommendation: '手持放大镜 4X' }),
      });
      const data = await r.json();
      if (data.success) { setResult(data.data); message.success('低视力处方已开具'); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Accessibility size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>低视力康复</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">助视器处方</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="视力参数" size="small">
            <Form layout="vertical" size="small">
              <Row gutter={8}>
                <Col span={12}><Form.Item label="OD 远视力"><Input value={reDist} onChange={e => setReDist(e.target.value)} /></Form.Item></Col>
                <Col span={12}><Form.Item label="OD 近视力"><Input value={reNear} onChange={e => setReNear(e.target.value)} /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Form.Item label="OS 远视力"><Input value={leDist} onChange={e => setLeDist(e.target.value)} /></Form.Item></Col>
                <Col span={12}><Form.Item label="OS 近视力"><Input value={leNear} onChange={e => setLeNear(e.target.value)} /></Form.Item></Col>
              </Row>
              <Form.Item label="助视器推荐"><Input value={reDevice} onChange={e => setReDevice(e.target.value)} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>开具处方</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="处方" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="OD 右眼">
                    <div>远: {result.rightEye.distance}</div>
                    <div>近: {result.rightEye.near}</div>
                    <div>助视: {result.rightEye.device}</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="OS 左眼">
                    <div>远: {result.leftEye.distance}</div>
                    <div>近: {result.leftEye.near}</div>
                    <div>助视: {result.leftEye.device}</div>
                  </Card>
                </Col>
                <Col span={24}><Alert title="推荐助视器" description={result.deviceRecommendation} type="success" showIcon /></Col>
              </Row>
            ) : <Empty description="暂无数据" image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ===== [v3.0.6.8-83] Cataract + Refractive (PR4 补齐) =====
export const CataractPage: React.FC = () => {
  const [nuclearGrade, setNuclearGrade] = useState(2);
  const [corticalGrade, setCorticalGrade] = useState(1);
  const [pscGrade, setPscGrade] = useState(0);
  const [va, setVa] = useState('0.3');
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/cataract/lens-opacity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P000001', eye: 'OD', nuclearGrade, corticalGrade, pscGrade, bestCorrectedVA: va }),
      });
      const data = await r.json();
      if (data.success) { setResult(data.data); message.success('晶状体混浊分级完成'); }
    } catch (e: any) { message.error(e.message); }
  };
  const gradeColor = (g: number) => g >= 3 ? '#ff4d4f' : g >= 2 ? '#faad14' : '#52c41a';
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Eye size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>白内障专科</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-83</Tag>
        <Tag color="blue">LOCS III 分级</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="晶状体混浊 LOCS III 分级" size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={`核混浊 NO (Grade ${nuclearGrade})`}><InputNumber value={nuclearGrade} onChange={v => setNuclearGrade(v || 0)} min={0} max={5} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={`皮质混浊 C (Grade ${corticalGrade})`}><InputNumber value={corticalGrade} onChange={v => setCorticalGrade(v || 0)} min={0} max={5} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={`后囊下 P (Grade ${pscGrade})`}><InputNumber value={pscGrade} onChange={v => setPscGrade(v || 0)} min={0} max={5} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="最佳矫正视力"><Input value={va} onChange={e => setVa(e.target.value)} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>评估</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="结果" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={8}><Statistic title="核 NO" value={result.nuclearGrade} styles={{ content: {  color: gradeColor(result.nuclearGrade)  } }} /></Col>
                <Col span={8}><Statistic title="皮质 C" value={result.corticalGrade} styles={{ content: {  color: gradeColor(result.corticalGrade)  } }} /></Col>
                <Col span={8}><Statistic title="后囊下 P" value={result.pscGrade} styles={{ content: {  color: gradeColor(result.pscGrade)  } }} /></Col>
                <Col span={24}><Statistic title="总分级" value={result.totalScore} styles={{ content: {  color: result.totalScore >= 4 ? '#ff4d4f' : '#52c41a'  } }} /></Col>
                <Col span={24}><Alert title={result.diagnosis} description={`建议: ${result.recommendation}`} type={result.needsSurgery ? 'warning' : 'success'} showIcon /></Col>
              </Row>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击评估" />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const RefractivePage: React.FC = () => {
  const [sphereOD, setSphereOD] = useState(-3.5);
  const [cylinderOD, setCylinderOD] = useState(-0.75);
  const [axisOD, setAxisOD] = useState(180);
  const [sphereOS, setSphereOS] = useState(-3.0);
  const [cylinderOS, setCylinderOS] = useState(-0.5);
  const [axisOS, setAxisOS] = useState(170);
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      const r = await fetch('/api/v1/eye/subspecialty/refractive/prescription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 'P000001',
          rightEye: { sphere: sphereOD, cylinder: cylinderOD, axis: axisOD },
          leftEye: { sphere: sphereOS, cylinder: cylinderOS, axis: axisOS },
        }),
      });
      const data = await r.json();
      if (data.success) { setResult(data.data); message.success('屈光处方完成'); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Zap size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>屈光手术专科</span>
        {/* [v3.0.6.11-88 Round10] /eye/subspecialty|low-vision|contact-lens 后端未实现, MSW 演示数据 */}
        <Tag color="orange">演示数据 (MSW)</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-83</Tag>
        <Tag color="blue">LASIK / ICL / SMILE</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="屈光参数" size="small">
            <Form layout="vertical" size="small">
              <Divider style={{ margin: '4px 0' }}>OD 右眼</Divider>
              <Form.Item label="球镜 S (D)"><InputNumber value={sphereOD} onChange={v => setSphereOD(v || 0)} min={-20} max={20} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="柱镜 C (D)"><InputNumber value={cylinderOD} onChange={v => setCylinderOD(v || 0)} min={-10} max={0} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="轴位 AXIS (°)"><InputNumber value={axisOD} onChange={v => setAxisOD(v || 0)} min={0} max={180} step={1} style={{ width: '100%' }} /></Form.Item>
              <Divider style={{ margin: '4px 0' }}>OS 左眼</Divider>
              <Form.Item label="球镜 S (D)"><InputNumber value={sphereOS} onChange={v => setSphereOS(v || 0)} min={-20} max={20} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="柱镜 C (D)"><InputNumber value={cylinderOS} onChange={v => setCylinderOS(v || 0)} min={-10} max={0} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="轴位 AXIS (°)"><InputNumber value={axisOS} onChange={v => setAxisOS(v || 0)} min={0} max={180} step={1} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>开具处方</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="处方方案" size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title="OD 右眼">
                    <div>S: {result.prescription.rightEye.sphere} D</div>
                    <div>C: {result.prescription.rightEye.cylinder} D</div>
                    <div>AXIS: {result.prescription.rightEye.axis}°</div>
                    <div>SE: {result.prescription.rightEye.se} D</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="OS 左眼">
                    <div>S: {result.prescription.leftEye.sphere} D</div>
                    <div>C: {result.prescription.leftEye.cylinder} D</div>
                    <div>AXIS: {result.prescription.leftEye.axis}°</div>
                    <div>SE: {result.prescription.leftEye.se} D</div>
                  </Card>
                </Col>
                <Col span={24}>
                  <Alert
                    title={`推荐术式: ${result.recommendedProcedure}`}
                    description={`理由: ${result.procedureRationale}`}
                    type="info" showIcon />
                </Col>
                <Col span={24}>
                  <Alert
                    title={`预期术后视力: ${result.expectedPostopVA}`}
                    description={`风险等级: ${result.riskLevel}`}
                    type={result.riskLevel === 'low' ? 'success' : 'warning'} showIcon />
                </Col>
              </Row>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击开具处方" />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

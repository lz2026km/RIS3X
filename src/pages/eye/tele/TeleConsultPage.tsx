// [v3.0.6.8-41] PR 8: 远程眼科 (WebRTC) + 视光中心闭环
// 对标: Topcon Harmony + Biotronics3D 3Dnet Cloud + 视光中心 (OK?角膜塑形?
import React, { useState, useEffect } from 'react';
import {
  Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message,
  Tabs, List, Empty, Statistic, Alert, InputNumber, Radio, Tooltip, Modal, Progress,
  Timeline, Switch, Slider, Avatar,
} from 'antd';
import {
  Video, MonitorSmartphone, Wifi, Globe, Cloud, Eye, Sparkles, Activity,
  Phone, Mic, MicOff, VideoOff, Settings, Share2, Save, History, Plus, Send,
  ChevronRight, RefreshCw, Layers, Signal, RadioIcon, Boxes,
} from 'lucide-react';

const { TextArea } = Input;

export const TeleConsultPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tele');
  // 远程会诊
  const [patientId, setPatientId] = useState('P000001');
  const [studyId, setStudyId] = useState('STU-20260620-00001');
  const [mode, setMode] = useState<'video' | 'screen' | 'data'>('video');
  const [participants, setParticipants] = useState<string[]>(['D001', 'D002']);
  const [session, setSession] = useState<any>(null);
  const [turnInfo, setTurnInfo] = useState<any>(null);
  const [consult, setConsult] = useState<any>(null);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // 视光中心
  const [reSphere, setReSphere] = useState(-2.5);
  const [reCylinder, setReCylinder] = useState(-0.75);
  const [reAxis, setReAxis] = useState(180);
  const [leSphere, setLeSphere] = useState(-2.75);
  const [leCylinder, setLeCylinder] = useState(-1.0);
  const [leAxis, setLeAxis] = useState(175);
  const [prescriptionType, setPrescriptionType] = useState('眼镜');
  const [refraction, setRefraction] = useState<any>(null);
  const [okLens, setOkLens] = useState<any>(null);
  const [targetReduction, setTargetReduction] = useState(3.0);

  // 视光中心 - 加载
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/v1/eye/optometry/vision-record/P000001');
        const data = await r.json();
        if (data.success) {
          // set last record to form
          const last = data.data.history[0];
          if (last) {
            setReSphere(last.rightEye.sphere);
            setReCylinder(last.rightEye.cylinder);
            setReAxis(last.rightEye.axis);
            setLeSphere(last.leftEye.sphere);
            setLeCylinder(last.leftEye.cylinder);
            setLeAxis(last.leftEye.axis);
          }
        }
      } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    })();
  }, []);

  // 远程会诊 - 加载 TURN
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/v1/eye/tele/turn');
        const data = await r.json();
        if (data.success) setTurnInfo(data.data);
      } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    })();
  }, []);

  // 创建会诊
  const handleCreateSession = async () => {
    try {
      const r = await fetch('/api/v1/eye/tele/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, studyId, participants, mode }),
      });
      const data = await r.json();
      if (data.success) { setSession(data.data); message.success('会诊会话已建立); }
    } catch (e: any) { message.error(e.message); }
  };

  // 远程?
  const handleStream = async () => {
    try {
      const r = await fetch('/api/v1/eye/tele/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId, targetHospital: 'PUMC-眼科', protocol: 'dicom-tls' }),
      });
      const data = await r.json();
      if (data.success) { message.success(`远程流已建立: ${data.data.endpoint}`); }
    } catch (e: any) { message.error(e.message); }
  };

  // 会诊意见见
  const handleConsult = async () => {
    try {
      const r = await fetch('/api/v1/eye/tele/consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session?.sessionId, specialistId: 'D005', question: '请评估该眼底彩照DR 分级和AMD 风险' }),
      });
      const data = await r.json();
      if (data.success) { setConsult(data.data); message.success('会诊意见见已发布); }
    } catch (e: any) { message.error(e.message); }
  };

  // 验光
  const handleRefraction = async () => {
    try {
      const r = await fetch('/api/v1/eye/optometry/refraction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          reSphere, reCylinder, reAxis,
          leSphere, leCylinder, leAxis,
          prescriptionType,
        }),
      });
      const data = await r.json();
      if (data.success) { setRefraction(data.data); message.success('验光处方已保存); }
    } catch (e: any) { message.error(e.message); }
  };

  // OK ?
  const handleOkLens = async () => {
    try {
      const r = await fetch('/api/v1/eye/optometry/ok-lens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, k1: 43.0, k2: 43.5, kAxis: 180, targetReduction }),
      });
      const data = await r.json();
      if (data.success) { setOkLens(data.data); message.success('OK 镜设计已生成'); }
    } catch (e: any) { message.error(e.message); }
  };

  // 录像计时
  useEffect(() => {
    if (recording) {
      const interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [recording]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Video size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>远程眼科 + 视光中心</span>
        <Tag color="cyan">PR8</Tag>
        <Tag color="purple">v3.0.6.8-41</Tag>
        <Tag color="blue">WebRTC + 5G 边缘</Tag>
        <Tag color="green">OK?/ 角膜塑形</Tag>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          { key: 'tele', label: <span><Video size={14} /> 远程会诊</span>, children: (
          <Row gutter={16}>
            <Col span={10}>
              <Card title="会诊参数" size="small">
                <Form layout="vertical" size="small">
                  <Form.Item label="患者ID">
                    <Input value={patientId} onChange={e => setPatientId(e.target.value)} />
                  </Form.Item>
                  <Form.Item label="Study ID">
                    <Input value={studyId} onChange={e => setStudyId(e.target.value)} />
                  </Form.Item>
                  <Form.Item label="会诊模式">
                    <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
                      <Radio.Button value="video"><Video size={12} /> 视频</Radio.Button>
                      <Radio.Button value="screen"><MonitorSmartphone size={12} /> 屏幕共享</Radio.Button>
                      <Radio.Button value="data"><Layers size={12} /> 数据</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item label="参与专家 (ID 列表)">
                    <Select
                      mode="tags"
                      value={participants}
                      onChange={setParticipants}
                      options={[
                        { value: 'D001', label: 'D001 张主? },
                        { value: 'D002', label: 'D002 王医? },
                        { value: 'D003', label: 'D003 李医? },
                        { value: 'D005', label: 'D005 孙会诊专? },
                      ]}
                    />
                  </Form.Item>
                  <Space>
                    <Button type="primary" icon={<Video size={14} />} onClick={handleCreateSession}>建立会诊</Button>
                    <Button icon={<Share2 size={14} />} onClick={handleStream} disabled={!session}>远程?/Button>
                    <Button icon={<Send size={14} />} onClick={handleConsult} disabled={!session}>会诊意见见</Button>
                  </Space>
                </Form>
              </Card>

              {turnInfo && (
                <Card title="5G + TURN 网络" size="small" style={{ marginTop: 16 }}>
                  <Row gutter={[8, 8]}>
                    <Col span={12}><Statistic title="延迟 P95" value={turnInfo.latency.p95} suffix="ms" valueStyle={{ color: '#52c41a' }} /></Col>
                    <Col span={12}><Statistic title="上行带宽" value={turnInfo.bandwidth.up} suffix="Mbps" /></Col>
                    <Col span={24}>
                      <Alert
                        message="5G 边缘切片"
                        description={`节点: ${turnInfo && turnInfo['5G'] ? turnInfo['5G'].edgeNodeId : 'N/A'} | 切片: ${turnInfo && turnInfo['5G'] ? turnInfo['5G'].slice : 'N/A'}`}
                        type="success"
                        showIcon
                      />
                    </Col>
                  </Row>
                </Card>
              )}
            </Col>

            <Col span={14}>
              <Card
                title={
                  <Space>
                    <MonitorSmartphone size={16} color="#1677ff" />
                    实时会诊画面
                    {session && <Tag color="green">{session.status === 'active' ? 'LIVE' : session.status}</Tag>}
                  </Space>
                }
                size="small"
              >
                <div style={{
                  width: '100%',
                  height: 320,
                  background: '#000',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#888',
                  position: 'relative',
                }}>
                  {session ? (
                    <>
                      <Video size={64} color={videoOn ? '#1677ff' : '#444'} />
                      <div style={{ marginTop: 16, fontSize: 14 }}>会诊 {session.sessionId}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>患者{session.patientId} | {session.mode} | {session.participants.length} 参与?/div>
                    </>
                  ) : (
                    <>
                      <MonitorSmartphone size={64} color="#444" />
                      <div style={{ marginTop: 16, color: '#666' }}>点击"建立会诊"启动 WebRTC 会诊</div>
                    </>
                  )}
                  {recording && (
                    <div style={{ position: 'absolute', top: 8, right: 8, color: '#ff4d4f', fontWeight: 700 }}>
                      ?REC {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <Space>
                  <Button
                    shape="circle"
                    icon={micOn ? <Mic size={14} /> : <MicOff size={14} />}
                    onClick={() => setMicOn(!micOn)}
                    danger={!micOn}
                  />
                  <Button
                    shape="circle"
                    icon={videoOn ? <Video size={14} /> : <VideoOff size={14} />}
                    onClick={() => setVideoOn(!videoOn)}
                    danger={!videoOn}
                  />
                  <Button
                    shape="circle"
                    icon={<Phone size={14} />}
                    danger
                    disabled={!session}
                  />
                  <Button
                    shape="circle"
                    icon={recording ? <Activity size={14} /> : <Video size={14} />}
                    onClick={() => setRecording(!recording)}
                    danger={recording}
                  />
                  <Button icon={<Settings size={14} />}>设置</Button>
                </Space>
              </Card>

              {consult && (
                <Card
                  title={
                    <Space>
                      <Send size={16} color="#52c41a" />
                      会诊意见见
                    </Space>
                  }
                  size="small"
                  style={{ marginTop: 16 }}
                >
                  <Alert
                    message={`状? ${consult.status} | SLA: ${consult.sla.responseTime}`}
                    type="info"
                    showIcon
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                    专家: {consult.specialistId}<br />
                    申请时间: {new Date(consult.requestedAt).toLocaleString('zh-CN')}
                  </div>
                </Card>
              )}
            </Col>
          </Row>
          ) },

          { key: 'optometry', label: <span><Globe size={14} /> 视光中心</span>, children: (
          <Row gutter={16}>
            <Col span={10}>
              <Card title="验光参数" size="small">
                <Form layout="vertical" size="small">
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 600 }}>OD 右眼</div>
                  <Row gutter={8}>
                    <Col span={8}><Form.Item label="球镜 (DS)"><InputNumber value={reSphere} onChange={v => setReSphere(v || 0)} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="柱镜 (DC)"><InputNumber value={reCylinder} onChange={v => setReCylinder(v || 0)} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="轴位 (°)"><InputNumber value={reAxis} onChange={v => setReAxis(v || 0)} step={1} min={0} max={180} style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 600 }}>OS 左眼</div>
                  <Row gutter={8}>
                    <Col span={8}><Form.Item label="球镜 (DS)"><InputNumber value={leSphere} onChange={v => setLeSphere(v || 0)} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="柱镜 (DC)"><InputNumber value={leCylinder} onChange={v => setLeCylinder(v || 0)} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="轴位 (°)"><InputNumber value={leAxis} onChange={v => setLeAxis(v || 0)} step={1} min={0} max={180} style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                  <Form.Item label="处方类型">
                    <Radio.Group value={prescriptionType} onChange={e => setPrescriptionType(e.target.value)}>
                      <Radio.Button value="眼镜">眼镜</Radio.Button>
                      <Radio.Button value="隐形">隐形眼镜</Radio.Button>
                      <Radio.Button value="渐进">渐进多焦</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  <Button type="primary" block icon={<Save size={14} />} onClick={handleRefraction}>保存验光处方</Button>
                </Form>
              </Card>

              <Card title="OK ?(角膜塑形?" size="small" style={{ marginTop: 16 }}>
                <Form layout="vertical" size="small">
                  <Form.Item label="目标减少度数 (D)">
                    <Slider min={1} max={6} step={0.5} value={targetReduction} onChange={setTargetReduction} marks={{ 1: '1D', 3: '3D', 6: '6D' }} />
                  </Form.Item>
                  <Button type="primary" block icon={<Sparkles size={14} />} onClick={handleOkLens}>生成 OK 镜设?/Button>
                </Form>
              </Card>
            </Col>

            <Col span={14}>
              <Card title="视光结果" size="small">
                {refraction ? (
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Card size="small" title="OD 右眼">
                        <div>S: {refraction.rightEye.sphere} DS</div>
                        <div>C: {refraction.rightEye.cylinder} DC × {refraction.rightEye.axis}°</div>
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small" title="OS 左眼">
                        <div>S: {refraction.leftEye.sphere} DS</div>
                        <div>C: {refraction.leftEye.cylinder} DC × {refraction.leftEye.axis}°</div>
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Alert
                        message={`处方类型: ${refraction.prescriptionType} | 有效期至: ${refraction.validUntil.slice(0, 10)}`}
                        type="success"
                        showIcon
                      />
                    </Col>
                  </Row>
                ) : <Empty description="点击保存验光处方" />}
              </Card>

              {okLens && (
                <Card
                  title={
                    <Space>
                      <Sparkles size={16} color="#722ed1" />
                      OK ?(角膜塑形? 设计
                    </Space>
                  }
                  size="small"
                  style={{ marginTop: 16 }}
                >
                  <Row gutter={[16, 16]}>
                    <Col span={8}><Statistic title="基弧 (BC)" value={okLens.design.baseCurve.toFixed(2)} suffix="mm" /></Col>
                    <Col span={8}><Statistic title="反转弧深? value={okLens.design.returnZoneDepth} suffix="mm" /></Col>
                    <Col span={8}><Statistic title="着陆角" value={okLens.design.landingZoneAngle} suffix="°" /></Col>
                    <Col span={8}><Statistic title="直径" value={okLens.design.diameter} suffix="mm" /></Col>
                    <Col span={8}><Statistic title="目标减少" value={Math.abs(okLens.design.targetReduction)} suffix="D" /></Col>
                    <Col span={8}><Statistic title="品牌" value={okLens.design.brand} /></Col>
                    <Col span={24}>
                      <Alert message={okLens.fittingNotes} type="info" showIcon />
                    </Col>
                  </Row>
                </Card>
              )}
            </Col>
          </Row>
          ) },
        ]}
      />
    </div>
  );
};

export default TeleConsultPage;

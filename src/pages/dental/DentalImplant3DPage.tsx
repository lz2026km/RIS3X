// [v3.0.6.8-88] Phase 1: 种植 3D 规划
// 对标: 3Shape Implant Studio + SimPlant + CoDiagnostiX
import React, { useState, useEffect, useRef } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, Form, InputNumber, message, Spin, Alert, Badge, Progress, Divider, Segmented, Slider } from 'antd';
import { Box, Eye, Save, CheckCircle2, Crosshair, AlertTriangle, Download, RotateCcw, BarChart3, Layers } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';

export const DentalImplant3DPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [nerveData, setNerveData] = useState<any>(null);
  const [boneData, setBoneData] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'list' | 'plan'>('list');
  const [selBrand, setSelBrand] = useState('straumann');
  const [selModel, setSelModel] = useState('BLT-RC-4.1x10');
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const [activeSlice, setActiveSlice] = useState(50);
  // MPR view state
  const [viewAxial, setViewAxial] = useState<'axial'|'sagittal'|'coronal'>('axial');
  const [ww, setWw] = useState(1500);
  const [wc, setWc] = useState(500);

  useEffect(() => {
    dentalApi.listImplantPlans3d().then(r => { if (Array.isArray(r)) setPlans(r); }).catch(() => {});
    dentalApi.getImplantBrands().then(r => { if (Array.isArray(r)) setBrands(r); }).catch(() => {});
  }, []);

  useEffect(() => {
    dentalApi.getImplantModels(selBrand).then(r => {
      if (Array.isArray(r)) setModels(r);
      if (r && r.length > 0) setSelModel(r[0].id);
    }).catch(() => {});
  }, [selBrand]);

  const handleSelectPlan = async (plan: any) => {
    setCurrent(plan);
    setMode('plan');
    // [v3.0.6.8-105] 修复: �?set selBrand, 加载 models, 然后�?plan �?model 覆盖
    setSelBrand(plan.brand);
    try {
      const ms = await dentalApi.getImplantModels(plan.brand);
      if (Array.isArray(ms)) {
        setModels(ms);
        setSelModel(plan.model); // 直接使用 plan �?model, 不被 useEffect 覆盖
      }
      const nd = await dentalApi.getImplantNerveDistance(plan.id);
      if (nd && nd.distances) setNerveData(nd);
      const bd = await dentalApi.getImplantBoneDensityRoi(plan.id);
      if (bd) setBoneData(bd);
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  };

  const handleValidate = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const v = await dentalApi.validateImplantPlan(current.id);
      setValidation(v);
      message.success('验证完成');
    } catch (e: any) { message.error(e.message); }
    setBusy(false);
  };

  const handleApprove = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await dentalApi.approveImplantPlan(current.id);
      message.success('规划已审�?);
      setMode('list');
    } catch (e: any) { message.error(e.message); }
    setBusy(false);
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const plan = await dentalApi.createImplantPlan3d({
        patientId: 'P100001',
        toothNo: 36,
        brand: selBrand,
        model: selModel,
      });
      setCurrent(plan);
      setMode('plan');
      message.success('新建 3D 规划');
    } catch (e: any) { message.error(e.message); }
    setBusy(false);
  };

  // 简化的 MPR Canvas
  const drawMprCanvas = () => {
    const canvas = canvas3dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, w, h);
    // 模拟 CBCT 切片
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath(); ctx.ellipse(w/2, h/2, w/3, h/2.5, 0, 0, Math.PI*2); ctx.fill();
    // 牙弓轮廓
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -60; i <= 60; i++) {
      const px = w/2 + i;
      const py = h/2 + Math.sin(i * 0.05) * 30;
      i === -60 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    // 植入�?
    if (current) {
      const ex = w/2 + 30, ey = h/2 - 10;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(0.1);
      ctx.fillStyle = '#1677ff';
      ctx.fillRect(-4, -30, 8, 60);
      ctx.strokeStyle = '#69b1ff'; ctx.lineWidth = 1;
      ctx.strokeRect(-4, -30, 8, 60);
      ctx.beginPath(); ctx.arc(0, -30, 6, 0, Math.PI*2);
      ctx.fillStyle = '#52c41a'; ctx.fill();
      ctx.restore();
      // 神经�?
      ctx.strokeStyle = '#ff4d4f'; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
      ctx.beginPath();
      ctx.moveTo(w/2-80, h/2+30); ctx.lineTo(w/2+20, h/2+10); ctx.lineTo(w/2+60, h/2+20);
      ctx.stroke(); ctx.setLineDash([]);
    }
    // 十字准心
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('Axial | WW:'+ww+' WC:'+wc, 4, 12);
  };

  useEffect(() => { if (mode === 'plan') drawMprCanvas(); }, [mode, current, activeSlice, ww, wc]);

  const safeDist = current?.distanceToNerve || 3.2;
  const safe = safeDist >= 2;

  if (mode === 'list') {
    return (
      <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 16 }}>
          <Box size={20} color="#1677ff" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>种植 3D 规划中心</span>
          <Tag color="cyan">v3.0.6.8-88</Tag>
          <Tag color="blue">Implant Studio 对标</Tag>
        </Space>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card size="small"><Statistic title="总规�? value={plans.length} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="待审�? value={plans.filter((p:any)=>p.status==='planning').length} valueStyle={{color:'#faad14'}} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="已审�? value={plans.filter((p:any)=>p.status==='approved').length} valueStyle={{color:'#52c41a'}} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="已有导板" value={plans.filter((p:any)=>p.guideDesigned).length} /></Card></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Card title="新建设计" size="small">
              <Form layout="vertical" size="small">
                <Form.Item label="品牌"><Select value={selBrand} onChange={v => setSelBrand(v)} options={brands.map((b:any)=>({value:b.id,label:b.name}))} /></Form.Item>
                <Form.Item label="型号"><Select value={selModel} onChange={v => setSelModel(v)} options={models.map((m:any)=>({value:m.id,label:`${m.name} (${m.diameters[0]}/${m.lengths[0]})`}))} /></Form.Item>
                <Form.Item label="牙位 (FDI)">
                  <InputNumber
                    min={11}
                    max={48}
                    step={1}
                    defaultValue={36}
                    onChange={v => { /* store if needed */ }}
                    style={{width:'100%'}}
                  />
                </Form.Item>
                <Button type="primary" block icon={<Box size={14}/>} onClick={handleCreate} loading={busy}>新建 3D 规划</Button>
              </Form>
            </Card>
          </Col>
          <Col span={16}>
            <Card title="规划列表" size="small">
              {plans.map((p:any) => (
                <Card key={p.id} size="small" hoverable onClick={() => handleSelectPlan(p)} style={{marginBottom:8, cursor:'pointer',borderColor:p.status==='approved'?'#52c41a':p.status==='planning'?'#faad14':'#d9d9d9'}}>
                  <Space style={{justifyContent:'space-between',width:'100%'}}>
                    <div>
                      <Tag color="purple">FDI #{p.toothNo}</Tag>
                      <Tag color="blue">{p.brandName || p.brand}</Tag>
                      <span style={{fontSize:13}}>{p.patientName} - {p.assignedDentist}</span>
                    </div>
                    <Badge status={p.status==='approved'?'success':p.status==='planning'?'processing':'default'} text={p.status} />
                  </Space>
                  <div style={{fontSize:11,color:'#999',marginTop:4}}>
                    {p.model} | 神距: {p.distanceToNerve}mm | 骨密�? {p.boneDensityAtApex}HU | {p.createdAt?.slice(0,10)}
                  </div>
                </Card>
              ))}
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14}/>} onClick={() => setMode('list')}>返回列表</Button>
        <Box size={18} color="#1677ff" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>种植 3D 规划 - #{current.toothNo}</span>
        <Tag color="cyan">v3.0.6.8-88</Tag>
        <Tag color={current.status==='approved'?'green':'purple'}>{current.status}</Tag>
        <Segmented
          size="small"
          value={viewAxial}
          onChange={v => setViewAxial(v as any)}
          options={[
            { value: 'axial', label: 'Axial' },
            { value: 'sagittal', label: 'Sagittal' },
            { value: 'coronal', label: 'Coronal' },
          ]}
        />
      </Space>
      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title={<Space><Crosshair size={14}/>CBCT MPR 引导</Space>}
            extra={
              <Space>
                <Button size="small" onClick={()=>setActiveSlice(Math.max(1,activeSlice-1))}>-</Button>
                <InputNumber value={activeSlice} onChange={v=>setActiveSlice(v||50)} min={1} max={200} size="small" style={{width:60}}/>
                <Button size="small" onClick={()=>setActiveSlice(Math.min(200,activeSlice+1))}>+</Button>
                <Slider value={activeSlice} min={0} max={200} onChange={setActiveSlice} style={{width:100}} />
              </Space>
            }>
            <canvas ref={canvas3dRef} width={480} height={360} style={{width:'100%',height:300,borderRadius:8}} />
            <Row gutter={8} style={{marginTop:8}}>
              <Col span={12}><Form.Item label="窗宽" size="small"><InputNumber value={ww} onChange={v=>setWw(v||1500)} min={100} max={4000} step={100} style={{width:'100%'}} /></Form.Item></Col>
              <Col span={12}><Form.Item label="窗位" size="small"><InputNumber value={wc} onChange={v=>setWc(v||500)} min={-1000} max={2000} step={100} style={{width:'100%'}} /></Form.Item></Col>
            </Row>
          </Card>
          <Card size="small" title={<Space><Layers size={14}/>种植体参�?/Space>} style={{marginTop:8}}>
            <Row gutter={12}>
              <Col span={12}><Form.Item label="品牌" size="small"><Select value={selBrand} onChange={v=>{setSelBrand(v);}} options={brands.map((b:any)=>({value:b.id,label:b.name}))} /></Form.Item></Col>
              <Col span={12}><Form.Item label="型号" size="small"><Select value={selModel} onChange={v=>setSelModel(v)} options={models.map((m:any)=>({value:m.id,label:m.name}))} /></Form.Item></Col>
            </Row>
            <Row gutter={8}>
              <Col span={8}><Form.Item label="穿出 x" size="small" style={{margin:0}}><InputNumber value={current.entryPoint?.x} min={0} max={300} step={0.5} style={{width:'100%'}} /></Form.Item></Col>
              <Col span={8}><Form.Item label="穿出 y" size="small" style={{margin:0}}><InputNumber value={current.entryPoint?.y} min={0} max={300} step={0.5} style={{width:'100%'}} /></Form.Item></Col>
              <Col span={8}><Form.Item label="角度 MD °" size="small" style={{margin:0}}><InputNumber value={current.angleMesioDistal} min={-30} max={30} step={0.5} style={{width:'100%'}} /></Form.Item></Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Row gutter={12}>
            <Col span={12}>
              <Card size="small" title={<Space><AlertTriangle size={14}/>安全分析</Space>}>
                <Statistic title="距神经管" value={`${safeDist} mm`} valueStyle={{color:safe?'#52c41a':'#ff4d4f'}} prefix={safe?null:<AlertTriangle size={14}/>} />
                <Progress percent={Math.min(100, safeDist / 4 * 100)} size="small" strokeColor={safe?'#52c41a':'#ff4d4f'} style={{marginTop:8}} />
                <div style={{fontSize:12,color:'#666',marginTop:4}}>安全阈�? �?mm</div>
                <Divider style={{margin:'6px 0'}} />
                {nerveData?.closestNerve && <Alert type={nerveData.closestNerve.safe?'success':'error'} message={`最邻近神经: ${nerveData.closestNerve.distance}mm`} showIcon />}
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={<Space><BarChart3 size={14}/>骨密�?/Space>}>
                <Statistic title="骨质�? value={boneData?.overallQuality || 'D2/D3'} valueStyle={{color:'#1677ff',fontSize:13}} />
                <div style={{display:'flex',gap:4,marginTop:8}}>
                  {boneData?.measurements?.slice(0,3).map((m:any,i:number)=>(
                    <div key={i} style={{flex:1,textAlign:'center',padding:4,background:'#f0f5ff',borderRadius:4}}>
                      <div style={{fontSize:10,color:'#999'}}>{m.region}</div>
                      <div style={{fontWeight:600,fontSize:13}}>{m.hu}HU</div>
                    </div>
                  ))}
                </div>
                <Progress percent={Math.min(100,(boneData?.averageHU||750)/1500*100)} size="small" strokeColor="#722ed1" style={{marginTop:4}} />
                <div style={{fontSize:11,color:'#999',marginTop:2}}>平均 {boneData?.averageHU || 750} HU</div>
              </Card>
            </Col>
          </Row>
          <Card size="small" title={<Space><CheckCircle2 size={14}/>规划验证</Space>} style={{marginTop:8}}>
            <Button type="primary" onClick={handleValidate} loading={busy} icon={<CheckCircle2 size={14}/>}>运行验证</Button>
            {validation && (
              <div style={{marginTop:8}}>
                <Alert type={validation.data?.valid?'success':'error'} message={validation.data?.valid?'规划通过, 无冲�?:'存在冲突'} showIcon />
                {validation.data?.decisions?.map((d:any,i:number)=>(
                  <Tag key={i} color={d.severity==='info'?'blue':d.severity==='critical'?'red':'orange'} style={{marginTop:4}}>{d.action}</Tag>
                ))}
              </div>
            )}
            <Divider style={{margin:'8px 0'}} />
            <Space style={{width:'100%',justifyContent:'space-between'}}>
              {current.status === 'planning' && <Button type="primary" icon={<Save size={14}/>} onClick={handleApprove}>审批规划</Button>}
              <Button icon={<Download size={14}/>} onClick={()=>message.warning('功能建设�?)}>导板导出</Button>
              <Button icon={<AlertTriangle size={14}/>} onClick={()=>window.open('/dental/cad','_blank')}>修复设计</Button>
            </Space>
          </Card>
          {current.guideDesigned && (
            <Alert style={{marginTop:8}} message={<Space><CheckCircle2 size={14} color="#52c41a"/>手术导板已设�?/Space>} description={`导板文件: ${current.guideFile}`} type="success" showIcon />
          )}
        </Col>
      </Row>
    </div>
  );
};
export default DentalImplant3DPage;

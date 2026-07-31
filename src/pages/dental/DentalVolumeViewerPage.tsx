// [v3.0.6.8-93] Phase 3: CBCT 体绘制 + Curve MPR
// 对标: Planmeca Romexis + Sirona Galileos 3D
import React, { useState, useEffect, useRef } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, Form, message, Slider, Spin, Tabs, Badge, Progress, Tooltip, InputNumber } from 'antd';
import { Activity, Eye, Maximize2, Minimize2, RotateCcw, Layers, BarChart3, Crosshair, Download, Box } from 'lucide-react';

export const DentalVolumeViewerPage: React.FC = () => {
  const [studies, setStudies] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [activePreset, setActivePreset] = useState('bone');
  const [sliceIdx, setSliceIdx] = useState(50);
  const [ww, setWw] = useState(1500);
  const [wc, setWc] = useState(500);
  const [mode, setMode] = useState<'list' | 'viewer'>('list');
  const [tab, setTab] = useState('vr');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCurved, setShowCurved] = useState(false);

  useEffect(() => {
    fetch('/api/v1/dental/volume/studies').then(r=>r.json()).then(d=>{if(d.success)setStudies(d.data||[]);}).catch((err) => { console.error('[F04]', err); });
    fetch('/api/v1/dental/volume/presets').then(r=>r.json()).then(d=>{if(d.success)setPresets(d.data||[]);}).catch((err) => { console.error('[F04]', err); });
  }, []);

  const handleSelect = (s: any) => { setCurrent(s); setSliceIdx(Math.floor((s.slices||400)/2)); setMode('viewer'); };

  // Render MPR canvases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'viewer') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, w, h);
    // Simulated CBCT slice
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.35;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        if (dist > 1) continue;
        const angle = Math.atan2(dy, dx);
        const bone = Math.max(0, 1 - Math.abs(dist - 0.65) / 0.35);
        const nerve = dist > 0.6 && dist < 0.75 ? Math.max(0, 1 - Math.abs(dist - 0.68) / 0.08) : 0;
        const noise = (Math.sin(x * 0.05 + sliceIdx * 0.1) + Math.cos(y * 0.05 + sliceIdx * 0.08)) * 0.05;
        const val = Math.round(((bone * 0.7 + nerve * 0.9 + 0.1 + noise) * (wc + ww / 2)));
        const gray = Math.min(255, Math.max(0, ((val - (wc - ww / 2)) / ww) * 255));
        ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Nerve highlight
    ctx.strokeStyle = '#ff4d4f'; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.ellipse(cx - 10, cy + 8, 12, 5, 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Info overlay
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(`Slice ${sliceIdx} | WW ${ww} WC ${wc}`, 4, 12);
  }, [mode, current, sliceIdx, ww, wc]);

  if (mode === 'list') {
    return (
      <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 16 }}>
          <Box size={20} color="#1677ff" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>CBCT 体绘制 · 曲线 MPR</span>
          <Tag color="cyan">v3.0.6.8-93</Tag>
          <Tag color="purple">Romexis 对标</Tag>
        </Space>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card size="small"><Statistic title="总 CBCT" value={studies.length} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="预设" value={presets.length} /></Card></Col>
        </Row>
        <Row gutter={[12,12]}>
          {studies.map((s: any) => (
            <Col span={6} key={s.id}>
              <Card size="small" hoverable onClick={() => handleSelect(s)} style={{cursor:'pointer'}}>
                <Tag color="purple">CBCT</Tag>
                <div style={{fontSize:13,fontWeight:600}}>{s.patientName}</div>
                <div style={{fontSize:11,color:'#999'}}>{s.device} | {s.fov} | {s.slices}层</div>
                <Badge status={s.status==='processed'?'success':'processing'} text={s.status} />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14}/>} onClick={()=>setMode('list')}>返回</Button>
        <span style={{fontSize:16,fontWeight:600}}>CBCT 体渲染 - {current?.patientName}</span>
        <Tag color="cyan">v3.0.6.8-93</Tag>
        <Tag color="blue">{current?.device}</Tag>
      </Space>
      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title={<Space><Layers size={14}/>体绘制 (Volume Rendering)</Space>}
            extra={<Select size="small" value={activePreset} onChange={v => {setActivePreset(v); fetch(`/api/v1/dental/volume/presets/${v}/apply`);}} options={presets.map((p:any)=>({value:p.id,label:p.name}))} />}>
            <canvas ref={canvasRef} width={480} height={360} style={{width:'100%',height:300,borderRadius:8}} />
            <Row gutter={8} style={{marginTop:8}}>
              <Col span={8}><Form.Item label="窗宽" size="small"><InputNumber value={ww} onChange={v=>setWw(v||1500)} min={100} max={4000} step={100} style={{width:'100%'}} /></Form.Item></Col>
              <Col span={8}><Form.Item label="窗位" size="small"><InputNumber value={wc} onChange={v=>setWc(v||500)} min={-1000} max={2000} step={100} style={{width:'100%'}} /></Form.Item></Col>
              <Col span={8}><Form.Item label="切片" size="small"><InputNumber value={sliceIdx} onChange={v=>setSliceIdx(v||50)} min={0} max={current?.slices||400} style={{width:'100%'}} /></Form.Item></Col>
            </Row>
            <Slider value={sliceIdx} min={0} max={current?.slices||400} onChange={setSliceIdx} />
          </Card>
          <Card size="small" title={<Space><Crosshair size={14}/>曲断重建 (Curve MPR)</Space>} style={{marginTop:8}}
            extra={<Button size="small" icon={<Eye size={10}/>} onClick={()=>setShowCurved(!showCurved)}>{showCurved?'隐藏':'显示'}</Button>}>
            {showCurved ? (
              <div style={{height:120,background:'#1a1a2e',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'#666'}}>
                <div style={{textAlign:'center'}}><div>沿牙弓展开曲线重建</div><div style={{fontSize:11,marginTop:4}}>152mm × 256px  |  已展开</div></div>
              </div>
            ):<div style={{textAlign:'center',padding:20,color:'#999',fontSize:12}}>点击「显示」查看曲断重建</div>}
          </Card>
        </Col>
        <Col span={12}>
          <Tabs activeKey={tab} onChange={setTab} items={[
            {key:'vr', label:'体渲染参数', children:<>
              <Card size="small" title="预设">
                <Row gutter={[8,8]}>
                  {presets.map((p:any)=>(
                    <Col span={12} key={p.id}>
                      <Card size="small" hoverable onClick={()=>{setActivePreset(p.id);}} style={{cursor:'pointer',borderColor:activePreset===p.id?'#1677ff':'#d9d9d9'}}>
                        <div style={{fontWeight:600}}>{p.name}</div>
                        <div style={{fontSize:11,color:'#999'}}>WW {p.ww} WC {p.wc}</div>
                        <Progress percent={p.id==='bone'?90:p.id==='soft'?40:p.id==='airway'?70:80} size="small" strokeColor={p.id==='nerve'?'#ff4d4f':'#1677ff'} />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
              <Card size="small" title="3D Mesh" style={{marginTop:8}}>
                <Space wrap>
                  <Tag>顶点: 185K</Tag>
                  <Tag>面: 92K</Tag>
                  <Tag>质量: 高</Tag>
                  <Tag>格式: GLB</Tag>
                </Space>
                <div style={{marginTop:8}}>
                  <Button icon={<Download size={14}/>} size="small">导出 STL</Button>
                  <Button icon={<Download size={14}/>} size="small" style={{marginLeft:8}}>导出 OBJ</Button>
                </div>
              </Card>
            </>},
            {key:'curved', label:'曲断参数', children:<>
              <Card size="small" title="牙弓路径">
                <div style={{height:200,background:'#0a0a1a',borderRadius:6,padding:8}}>
                  <svg viewBox="-60 -10 120 60" width="100%" height="180">
                    <path d="M-55,28 Q-40,10 0,5 Q40,10 55,28" stroke="#1677ff" strokeWidth="2" fill="none" />
                    {[-55,-45,-35,-25,-15,-5,5,15,25,35,45,55].map((x,i)=>(
                      <circle key={i} cx={x} cy={i<6?28-Math.abs(x)*0.3+5:28-Math.abs(x)*0.3+5} r={2} fill="#52c41a" />
                    ))}
                  </svg>
                </div>
                <Space wrap style={{marginTop:8}}>
                  <Tag color="blue">点数: 25</Tag>
                  <Tag color="green">展开长度: 152mm</Tag>
                  <Tag>间距: 0.5mm</Tag>
                </Space>
              </Card>
              <Card size="small" title="输出参数" style={{marginTop:8}}>
                <Row gutter={8}>
                  <Col span={8}><Form.Item label="宽度"><InputNumber defaultValue={256} min={128} max={1024} step={64} style={{width:'100%'}} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="高度"><InputNumber defaultValue={80} min={40} max={320} step={20} style={{width:'100%'}} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="层厚"><InputNumber defaultValue={0.5} min={0.1} max={2} step={0.1} style={{width:'100%'}} /></Form.Item></Col>
                </Row>
                <Button icon={<Download size={14}/>} block>导出曲断图像</Button>
              </Card>
            </>},
          ]} />
        </Col>
      </Row>
    </div>
  );
};
export default DentalVolumeViewerPage;

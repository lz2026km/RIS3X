// [v3.0.6.8-89] Phase 1: 手术导板设计 + 种植上部系统
// 对标: 3Shape Implant Studio Guide Module
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, Form, InputNumber, message, Tabs, Alert, Badge, Progress, Divider, List } from 'antd';
import { Activity, CheckCircle2, Download, Printer, Eye, Layers, Box, Settings, Save } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';

const GUIDE_TYPES = [
  { value: 'fully-guided', label: '全程导板 (Fully Guided)' },
  { value: 'partially-guided', label: '半程导板 (Partially)' },
  { value: 'pilot-drill', label: '先锋钻导�? },
  { value: 'sleeveless', label: '无套筒导�? },
];

export const DentalGuidePage: React.FC = () => {
  const [guides, setGuides] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [sleeves, setSleeves] = useState<any[]>([]);
  const [abutments, setAbutments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('guides');
  const [newGuide, setNewGuide] = useState({ plan3dId: '', type: 'fully-guided', material: 'resin-print', sleeveType: '' });

  useEffect(() => {
    dentalApi.listSurgicalGuides().then(r => { if (Array.isArray(r)) setGuides(r); }).catch(() => {});
    dentalApi.listImplantPlans3d().then(r => { if (Array.isArray(r)) setPlans(r); }).catch(() => {});
    dentalApi.getGuideSleeves().then(r => { if (Array.isArray(r)) setSleeves(r); }).catch(() => {});
    dentalApi.getGuideMaterials().then(r => { if (Array.isArray(r)) setMaterials(r); }).catch(() => {});
  }, []);

  const handleBrandChange = (brand: string) => {
    dentalApi.getAbutments(brand).then(r => { if (Array.isArray(r)) setAbutments(r); }).catch(() => {});
    dentalApi.getGuideSleeves(brand).then(r => { if (Array.isArray(r)) setSleeves(r); }).catch(() => {});
  };

  const handleCreate = async () => {
    if (!newGuide.plan3dId) { message.warning('请选择种植规划'); return; }
    setBusy(true);
    try {
      await dentalApi.createSurgicalGuide(newGuide);
      message.success('导板设计已创�?);
      const list = await dentalApi.listSurgicalGuides();
      if (Array.isArray(list)) setGuides(list);
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    setBusy(false);
  };

  const handleExportStl = async (id: string) => {
    setBusy(true);
    try {
      const res = await dentalApi.exportSurgicalGuide(id);
      message.success(`导板已生�? ${res.size}`);
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    setBusy(false);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>手术导板设计 · 种植上部系统</span>
        <Tag color="cyan">v3.0.6.8-89</Tag>
        <Tag color="purple">Guide Module</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="导板总数" value={guides.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="设计�? value={guides.filter((g:any)=>g.status==='designing').length} valueStyle={{color:'#faad14'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已导�?STL" value={guides.filter((g:any)=>g.guideFile).length} valueStyle={{color:'#52c41a'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="基台选项" value={abutments.length} /></Card></Col>
      </Row>
      <Tabs activeKey={tab} onChange={setTab} items={[
        {key:'guides', label:'手术导板', children:<>
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" title="新建导板">
                <Form layout="vertical" size="small">
                  <Form.Item label="关联规划"><Select value={newGuide.plan3dId} onChange={v => {const p=plans.find((pl:any)=>pl.id===v);setNewGuide({...newGuide,plan3dId:v});if(p)handleBrandChange(p.brand);}} options={plans.map((p:any)=>({value:p.id,label:`#${p.toothNo} ${p.patientName} (${p.brand})`}))} /></Form.Item>
                  <Form.Item label="导板类型"><Select value={newGuide.type} onChange={v=>setNewGuide({...newGuide,type:v})} options={GUIDE_TYPES} /></Form.Item>
                  <Form.Item label="材料"><Select value={newGuide.material} onChange={v=>setNewGuide({...newGuide,material:v})} options={materials.map((m:any)=>({value:m.id,label:m.name}))} /></Form.Item>
                  <Form.Item label="金属套筒"><Select value={newGuide.sleeveType} onChange={v=>setNewGuide({...newGuide,sleeveType:v})} options={sleeves.map((s:any)=>({value:s.type,label:`${s.type} (Ø${s.diameter}mm)`}))} /></Form.Item>
                  <Button type="primary" block icon={<Save size={14}/>} onClick={handleCreate} loading={busy}>创建设计</Button>
                </Form>
              </Card>
            </Col>
            <Col span={16}>
              <Card size="small" title="导板列表">
                {guides.map((g:any)=>(
                  <Card key={g.id} size="small" style={{marginBottom:8,borderLeft:`4px solid ${g.status==='designed'?'#52c41a':'#faad14'}`}}>
                    <Space style={{justifyContent:'space-between',width:'100%'}}>
                      <div>
                        <Tag color="purple">FDI #{g.toothNo}</Tag>
                        <Tag color="blue">{g.type}</Tag>
                        <span style={{fontSize:13}}>{g.patientName} - {g.createdBy}</span>
                      </div>
                      <Badge status={g.status==='designed'?'success':'processing'} text={g.status} />
                    </Space>
                    <div style={{fontSize:11,color:'#999',marginTop:4}}>
                      {g.material} | {g.sleeveType || '待选择套筒'} | {g.fixationPin ? '含固定钉' : '不含固定�?} | {g.createdAt?.slice(0,10)}
                    </div>
                    <Divider style={{margin:'4px 0'}} />
                    <Space>
                      {g.status === 'designing' && <Button size="small" icon={<Eye size={10}/>}>预览</Button>}
                      <Button size="small" icon={<Download size={10}/>} onClick={()=>handleExportStl(g.id)}>导出 STL</Button>
                      {g.guideFile && <Tag color="green" icon={<CheckCircle2 size={10}/>}>已导�?/Tag>}
                    </Space>
                  </Card>
                ))}
              </Card>
            </Col>
          </Row>
        </>},
        {key:'abutment', label:'基台/上部选择', children:<>
          <Row gutter={12}>
            <Col span={12}>
              <Card size="small" title="基台选项">
                <Select placeholder="选择品牌" onChange={handleBrandChange} style={{width:200,marginBottom:12}} options={[
                  {value:'straumann',label:'Straumann'},{value:'nobel',label:'Nobel'},{value:'osstem',label:'Osstem'},{value:'neobiotech',label:'Neobiotech'},
                ]} />
                <List size="small" dataSource={abutments} renderItem={(a:any)=>(
                  <List.Item>
                    <Space>
                      <Tag color={a.type.includes('zirconia')?'magenta':'blue'}>{a.type}</Tag>
                      <span style={{fontSize:12}}>{a.material} ¥{a.price}</span>
                      <Tag>{a.angle}°</Tag>
                    </Space>
                  </List.Item>
                )} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="金属套筒选择">
                <Select placeholder="选择品牌" onChange={v => dentalApi.getGuideSleeves(v as string).then(r=>{if(Array.isArray(r))setSleeves(r);})} style={{width:200,marginBottom:12}} options={[
                  {value:'straumann',label:'Straumann'},{value:'nobel',label:'Nobel'},{value:'osstem',label:'Osstem'},{value:'neobiotech',label:'Neobiotech'},
                ]} />
                <List size="small" dataSource={sleeves} renderItem={(s:any)=>(
                  <List.Item>
                    <Space>
                      <Tag color="blue">{s.type}</Tag>
                      <span style={{fontSize:12}}>Ø{s.diameter} × {s.height}mm</span>
                      <span style={{fontSize:11,color:'#999'}}>适配: {s.compatible?.slice(0,2).join(', ')}...</span>
                    </Space>
                  </List.Item>
                )} />
              </Card>
            </Col>
          </Row>
        </>},
      ]} />
    </div>
  );
};
export default DentalGuidePage;

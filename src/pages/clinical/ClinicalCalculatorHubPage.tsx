// [v3.0.6.8-78] 临床计算器中心
import React, { useState } from 'react';
import { Card, Space, Tag, Row, Col, Form, Input, Select, Button, Statistic, Table, Modal, Result, Tabs, Badge, Tooltip, message } from 'antd';
import { Calculator, Beaker, Activity, Stethoscope, Brain, Heart, Eye, Layers, ArrowRight, Download } from 'lucide-react';

type Calc = { id:string; name:string; category:string; icon:string; description:string; inputs:string[]; calculate:(vals:any)=>any };

const calculators: Calc[] = [
  { id:'egfr', name:'eGFR (CKD-EPI)', category:'Kidney', icon:'beaker', description:'CKD-EPI 2021 creatinine-based eGFR',
    inputs:['serumCreatinine','age','sex'],
    calculate:(v)=>{
      const scr = parseFloat(v.serumCreatinine)||0;
      const age = parseFloat(v.age)||0;
      const kappa = v.sex==='female'?0.7:0.9;
      const alpha = v.sex==='female'?-0.241:-0.302;
      const mult = v.sex==='female'?1.012:1;
      if(scr<=0||age<=0) return {error:'Invalid input'};
      const min = Math.min(scr/kappa, 1);
      const max = Math.max(scr/kappa, 1);
      const egfr = 142 * Math.pow(min, alpha) * Math.pow(max, -1.200) * Math.pow(0.9938, age) * mult;
      return {value:egfr.toFixed(1), unit:'mL/min/1.73m²', risk:egfr>=90?'G1:Normal':egfr>=60?'G2:Mild↓':egfr>=45?'G3a:Mild-Mod↓':egfr>=30?'G3b:Mod-Sev↓':egfr>=15?'G4:Severe↓':'G5:Kidney Failure'};
    }
  },
  { id:'cha2', name:'CHA2DS2-VASc', category:'Cardio', icon:'heart', description:'Stroke risk in AF',
    inputs:['age','sex','htn','dm','chf','stroke','vascular'],
    calculate:(v)=>{
      let score=0;
      const age=parseInt(v.age)||0;
      if(age>=75) score+=2; else if(age>=65) score+=1;
      if(v.sex==='female') score+=1;
      if(v.htn==='yes') score+=1;
      if(v.dm==='yes') score+=1;
      if(v.chf==='yes') score+=1;
      if(v.stroke==='yes') score+=2;
      if(v.vascular==='yes') score+=1;
      const risk = score>=2?'High - Anticoagulation':score===1?'Moderate - Consider':'Low - No anticoag';
      return {value:score, unit:'pts', risk};
    }
  },
  { id:'hasbled', name:'HAS-BLED', category:'Cardio', icon:'heart', description:'Bleeding risk on anticoagulation',
    inputs:['htn','renal','liver','stroke','bleed','inr','age','drugs','alcohol'],
    calculate:(v)=>{
      let score=0;
      if(v.htn==='yes') score++;
      if(v.renal==='yes') score++;
      if(v.liver==='yes') score++;
      if(v.stroke==='yes') score++;
      if(v.bleed==='yes') score++;
      if(v.inr==='unstable') score++;
      if(parseInt(v.age)>=65) score++;
      if(v.drugs==='yes') score++;
      if(v.alcohol==='yes') score++;
      const risk = score>=3?'High bleeding risk - Cautious':score>=1?'Moderate':'Low';
      return {value:score, unit:'pts', risk};
    }
  },
  { id:'wells-pe', name:'Wells Score (PE)', category:'PE', icon:'activity', description:'Pre-test probability of PE',
    inputs:['clinicalSigns','peLikely','hr','immobilization','prevDVT','hemoptysis','malignancy'],
    calculate:(v)=>{
      let score=0;
      if(v.clinicalSigns==='yes') score+=3;
      if(v.peLikely==='yes') score+=3;
      if(v.hr==='yes') score+=1.5;
      if(v.immobilization==='yes') score+=1.5;
      if(v.prevDVT==='yes') score+=1.5;
      if(v.hemoptysis==='yes') score+=1;
      if(v.malignancy==='yes') score+=1;
      const risk = score>6?'High':score>=2?'Moderate':'Low';
      return {value:score, unit:'pts', risk};
    }
  },
  { id:'child', name:'Child-Pugh', category:'Liver', icon:'beaker', description:'Liver disease severity',
    inputs:['bilirubin','albumin','inr','ascites','encephalopathy'],
    calculate:(v)=>{
      let score=0;
      const bili=parseFloat(v.bilirubin)||0;
      const alb=parseFloat(v.albumin)||0;
      if(bili<2) score+=1; else if(bili<3) score+=2; else score+=3;
      if(alb>3.5) score+=1; else if(alb>2.8) score+=2; else score+=3;
      const inr=parseFloat(v.inr)||0;
      if(inr<1.7) score+=1; else if(inr<2.3) score+=2; else score+=3;
      if(v.ascites==='none') score+=1; else if(v.ascites==='mild') score+=2; else score+=3;
      if(v.encephalopathy==='none') score+=1; else if(v.encephalopathy==='grade1') score+=2; else score+=3;
      const grade = score>=10?'C (Severe)':score>=7?'B (Moderate)':'A (Mild)';
      return {value:score, unit:'pts', risk:grade};
    }
  },
  { id:'timi', name:'TIMI (STEMI)', category:'Cardio', icon:'heart', description:'14-day mortality in STEMI',
    inputs:['age','riskFactors','priorAngina','stChanges','anteriorST','bbb'],
    calculate:(v)=>{
      let score=0;
      if(parseInt(v.age)>=75) score+=3; else if(parseInt(v.age)>=65) score+=2;
      if(v.riskFactors==='yes') score+=1;
      if(v.priorAngina==='yes') score+=1;
      if(v.stChanges==='yes') score+=1;
      if(v.anteriorST==='yes') score+=1;
      if(v.bbb==='yes') score+=1;
      const mortality = score>=5?'~12%':score>=3?'~5%':'~1%';
      return {value:score, unit:'pts', risk:`14d mortality ${mortality}`};
    }
  },
];

export const ClinicalCalculatorHubPage: React.FC = () => {
  const [selected, setSelected] = useState<Calc | null>(null);
  const [inputs, setInputs] = useState<Record<string,string>>({});
  const [result, setResult] = useState<any>(null);
  const [history] = useState([
    { time:'2026-06-28 10:23', calc:'eGFR', patient:'Zhang Wei', result:'78.5 mL/min/1.73m²' },
    { time:'2026-06-28 09:45', calc:'CHA2DS2-VASc', patient:'Li Na', result:'3 pts - High' },
    { time:'2026-06-27 16:12', calc:'Wells PE', patient:'Wang Fang', result:'4.5 - Moderate' },
  ]);

  const handleCalc = () => {
    if(!selected) return;
    const r = selected.calculate(inputs);
    if(r.error) { message.error(r.error); return; }
    setResult(r);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Calculator size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Clinical Calculator Hub</span>
        <Tag color="cyan">v3.0.6.8-78</Tag>
        <Tag color="green">{calculators.length} formulas</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={14}>
          <Row gutter={[12,12]}>
            {calculators.map(c => (
              <Col span={8} key={c.id}>
                <Card size="small" hoverable onClick={()=>{setSelected(c);setInputs({});setResult(null);}} style={{borderColor:selected?.id===c.id?'#1677ff':'#d9d9d9'}}>
                  <Space>
                    {c.icon==='heart'?<Heart size={16} color="#ff4d4f"/>:c.icon==='beaker'?<Beaker size={16} color="#722ed1"/>:<Activity size={16} color="#1677ff"/>}
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
                      <div style={{fontSize:11,color:'#999'}}>{c.category}</div>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
          {selected && (
            <Card size="small" title={<Space><ArrowRight size={14}/>{selected.name}</Space>} style={{marginTop:16}}>
              <div style={{fontSize:12,color:'#666',marginBottom:12}}>{selected.description}</div>
              <Form layout="vertical" size="small">
                <Row gutter={12}>
                  {selected.inputs.map(inp => (
                    <Col span={12} key={inp}>
                      <Form.Item label={inp}>
                        {['sex','htn','dm','chf','stroke','vascular','renal','liver','bleed','inr','drugs','alcohol','clinicalSigns','peLikely','hr','immobilization','prevDVT','hemoptysis','malignancy','ascites','encephalopathy','riskFactors','priorAngina','stChanges','anteriorST','bbb'].includes(inp)?
                          <Select value={inputs[inp]} onChange={v=>setInputs({...inputs,[inp]:v})} options={[{value:'yes',label:'是'},{value:'no',label:'否'}].concat(inp==='sex'?[{value:'female',label:'女'},{value:'male',label:'男'}]:[]).concat(inp==='ascites'?[{value:'mild',label:'轻度'},{value:'moderate',label:'中度'}]:[]).concat(inp==='encephalopathy'?[{value:'grade1',label:'一级-二级'},{value:'grade2',label:'三级-四级'}]:[]).concat(inp==='inr'?[{value:'unstable',label:'不稳定'}]:[])} />:
                          <Input type="number" value={inputs[inp]||''} onChange={e=>setInputs({...inputs,[inp]:e.target.value})} />
                        }
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Space>
                  <Button type="primary" onClick={handleCalc}>Calculate</Button>
                  <Button onClick={()=>{setInputs({});setResult(null);}}>重置</Button>
                </Space>
              </Form>
              {result && (
                <Result
                  status={result.risk?.includes('High')||result.risk?.includes('Severe')?'warning':result.risk?.includes('Low')||result.risk?.includes('Normal')?'success':'info'}
                  title={`${result.value} ${result.unit}`}
                  subTitle={result.risk}
                />
              )}
            </Card>
          )}
        </Col>
        <Col span={10}>
          <Card size="small" title="Recent Calculations" extra={<Button icon={<Download size={12}/>} onClick={() => message.success('计算记录已导出')}>导出</Button>}>
            <Table dataSource={history} pagination={false} columns={[
              {title:'Time',dataIndex:'time'},{title:'Calc',dataIndex:'calc',render:(c:string)=><Tag color="blue">{c}</Tag>},
              {title:'Patient',dataIndex:'patient'},{title:'Result',dataIndex:'result'},
            ]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default ClinicalCalculatorHubPage;
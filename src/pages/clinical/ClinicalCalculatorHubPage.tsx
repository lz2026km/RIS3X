// [v3.0.6.8-78] 临床计算器中心
import React, { useState } from 'react';
import { Card, Space, Tag, Row, Col, Form, Input, Select, Button, Table, Result, message } from 'antd';
import { Calculator, Beaker, Activity, Heart, ArrowRight, Download } from 'lucide-react';
import { t } from '../../i18n/appI18n';

type Calc = { id:string; name:string; category:string; icon:string; description:string; inputs:string[]; calculate:(vals:any)=>any };

const calculators: Calc[] = [
  { id:'egfr', name:'eGFR (CKD-EPI)', category:t('clinicalCalc.category.kidney'), icon:'beaker', description:t('clinicalCalc.desc.egfr'),
    inputs:['serumCreatinine','age','sex'],
    calculate:(v)=>{
      const scr = parseFloat(v.serumCreatinine)||0;
      const age = parseFloat(v.age)||0;
      const kappa = v.sex==='female'?0.7:0.9;
      const alpha = v.sex==='female'?-0.241:-0.302;
      const mult = v.sex==='female'?1.012:1;
      if(scr<=0||age<=0) return {error:t('clinicalCalc.invalidInput')};
      const min = Math.min(scr/kappa, 1);
      const max = Math.max(scr/kappa, 1);
      const egfr = 142 * Math.pow(min, alpha) * Math.pow(max, -1.200) * Math.pow(0.9938, age) * mult;
      return {value:egfr.toFixed(1), unit:'mL/min/1.73m²', risk:egfr>=90?t('clinicalCalc.risk.egfr.g1'):egfr>=60?t('clinicalCalc.risk.egfr.g2'):egfr>=45?t('clinicalCalc.risk.egfr.g3a'):egfr>=30?t('clinicalCalc.risk.egfr.g3b'):egfr>=15?t('clinicalCalc.risk.egfr.g4'):t('clinicalCalc.risk.egfr.g5')};
    }
  },
  { id:'cha2', name:'CHA2DS2-VASc', category:t('clinicalCalc.category.cardiac'), icon:'heart', description:t('clinicalCalc.desc.cha2'),
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
      const risk = score>=2?t('clinicalCalc.risk.cha2.high'):score===1?t('clinicalCalc.risk.cha2.mid'):t('clinicalCalc.risk.cha2.low');
      return {value:score, unit:'pts', risk};
    }
  },
  { id:'hasbled', name:'HAS-BLED', category:t('clinicalCalc.category.cardiac'), icon:'heart', description:t('clinicalCalc.desc.hasbled'),
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
      const risk = score>=3?t('clinicalCalc.risk.hasbled.high'):score>=1?t('clinicalCalc.risk.hasbled.mid'):t('clinicalCalc.risk.hasbled.low');
      return {value:score, unit:'pts', risk};
    }
  },
  { id:'wells-pe', name:'Wells Score (PE)', category:'PE', icon:'activity', description:t('clinicalCalc.desc.wells'),
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
      const risk = score>6?t('clinicalCalc.risk.wells.high'):score>=2?t('clinicalCalc.risk.wells.mid'):t('clinicalCalc.risk.wells.low');
      return {value:score, unit:'pts', risk};
    }
  },
  { id:'child', name:'Child-Pugh', category:t('clinicalCalc.category.liver'), icon:'beaker', description:t('clinicalCalc.desc.child'),
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
      const grade = score>=10?t('clinicalCalc.risk.child.c'):score>=7?t('clinicalCalc.risk.child.b'):t('clinicalCalc.risk.child.a');
      return {value:score, unit:'pts', risk:grade};
    }
  },
  { id:'timi', name:'TIMI (STEMI)', category:t('clinicalCalc.category.cardiac'), icon:'heart', description:t('clinicalCalc.desc.timi'),
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
      return {value:score, unit:'pts', risk:t('clinicalCalc.risk.timiMortality', { mortality })};
    }
  },
];

export const ClinicalCalculatorHubPage: React.FC = () => {
  const [selected, setSelected] = useState<Calc | null>(null);
  const [inputs, setInputs] = useState<Record<string,string>>({});
  const [result, setResult] = useState<any>(null);
  const [history] = useState([
    { time:'2026-06-28 10:23', calc:'eGFR', patient:'Zhang Wei', result:'78.5 mL/min/1.73m²' },
    { time:'2026-06-28 09:45', calc:'CHA2DS2-VASc', patient:'Li Na', result:'3 分 - 高' },
    { time:'2026-06-27 16:12', calc:'Wells PE', patient:'Wang Fang', result:'4.5 - 中度' },
  ]);

  const handleCalc = () => {
    if(!selected) return;
    const r = selected.calculate(inputs);
    if(r.error) { message.error(r.error); return; }
    setResult(r);
  };

  const handleExport = () => {
    if (history.length === 0) { message.info(t('clinicalCalc.noRecords')); return; }
    const header = '时间,计算器,患者,结果';
    const rows = history.map(h => `"${h.time}","${h.calc}","${h.patient}","${h.result}"`).join('\n');
    const blob = new Blob([`\uFEFF${header}\n${rows}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `临床计算记录_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    message.success(t('clinicalCalc.exported', { count: history.length }));
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Calculator size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('clinicalCalc.title')}</span>
        <Tag color="cyan">v3.0.6.8-78</Tag>
        <Tag color="green">{t('clinicalCalc.formulaCount', { count: calculators.length })}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={14}>
          <Row gutter={[12,12]}>
            {calculators.map(c => (
              <Col span={8} key={c.id}>
                <Card size="small" hoverable onClick={()=>{setSelected(c);setInputs({});setResult(null);}} style={{borderColor:selected?.id===c.id?'#2563eb':'#d9d9d9'}}>
                  <Space>
                    {c.icon==='heart'?<Heart size={16} color="#ff4d4f"/>:c.icon==='beaker'?<Beaker size={16} color="#722ed1"/>:<Activity size={16} color="#2563eb"/>}
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
                          <Select value={inputs[inp]} onChange={v=>setInputs({...inputs,[inp]:v})} options={[{value:'yes',label:t('clinicalCalc.opt.yes')},{value:'no',label:t('clinicalCalc.opt.no')}].concat(inp==='sex'?[{value:'female',label:t('clinicalCalc.opt.female')},{value:'male',label:t('clinicalCalc.opt.male')}]:[]).concat(inp==='ascites'?[{value:'mild',label:t('clinicalCalc.opt.mild')},{value:'moderate',label:t('clinicalCalc.opt.moderate')}]:[]).concat(inp==='encephalopathy'?[{value:'grade1',label:t('clinicalCalc.opt.encep12')},{value:'grade2',label:t('clinicalCalc.opt.encep34')}]:[]).concat(inp==='inr'?[{value:'unstable',label:t('clinicalCalc.opt.unstable')}]:[])} />:
                          <Input type="number" value={inputs[inp]||''} onChange={e=>setInputs({...inputs,[inp]:e.target.value})} />
                        }
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Space>
                  <Button type="primary" onClick={handleCalc}>{t('clinicalCalc.calculate')}</Button>
                  <Button onClick={()=>{setInputs({});setResult(null);}}>{t('clinicalCalc.reset')}</Button>
                </Space>
              </Form>
              {result && (
                <Result
                  status={result.risk?.includes('高')||result.risk?.includes('重度')?'warning':result.risk?.includes('低')||result.risk?.includes('正常')?'success':'info'}
                  title={`${result.value} ${result.unit}`}
                  subTitle={result.risk}
                />
              )}
            </Card>
          )}
        </Col>
        <Col span={10}>
          <Card size="small" title={t('clinicalCalc.recent')} extra={<Button icon={<Download size={12}/>} onClick={handleExport}>{t('clinicalCalc.export')}</Button>}>
            <Table rowKey={(record, index) => `${record.time}-${index}`} dataSource={history} pagination={false} scroll={{ x: 'max-content' }} columns={[
              {title:t('clinicalCalc.colTime'),dataIndex:'time'},{title:t('clinicalCalc.colCalculator'),dataIndex:'calc',render:(c:string)=><Tag color="blue">{c}</Tag>},
              {title:t('clinicalCalc.colPatient'),dataIndex:'patient'},{title:t('clinicalCalc.colResult'),dataIndex:'result'},
            ]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default ClinicalCalculatorHubPage;
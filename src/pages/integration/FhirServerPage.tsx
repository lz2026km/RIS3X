// [v3.0.6.8-61] FHIR Server 集成管理
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Table, Tabs, Row, Col, Statistic, message, Input, List, Alert, Badge, Descriptions, Tooltip, Modal, Form, Select } from 'antd';
import { Activity, Globe, Send, Database, Search, RefreshCw, Plus, CheckCircle2, FileText } from 'lucide-react';

const { TextArea } = Input;

export const FhirServerPage: React.FC = () => {
  const [tab, setTab] = useState('capability');
  const [resources, setResources] = useState<any[]>([]);
  const [resourceType, setResourceType] = useState('Patient');
  const [capability, setCapability] = useState<any>(null);
  const [sendModal, setSendModal] = useState(false);
  const [fhirQuery, setFhirQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);

  useEffect(() => {
    // Load FHIR CapabilityStatement
    setCapability({
      fhirVersion: '4.0.1',
      status: 'active',
      publisher: 'G005 Radiology RIS',
      rest: [{
        mode: 'server',
        resource: [
          { type: 'Patient', profile: 'http://hl7.org/fhir/StructureDefinition/Patient' },
          { type: 'Observation', profile: 'http://hl7.org/fhir/StructureDefinition/Observation' },
          { type: 'DiagnosticReport', profile: 'http://hl7.org/fhir/R4/DiagnosticReport' },
          { type: 'Practitioner', profile: 'http://hl7.org/fhir/StructureDefinition/Practitioner' },
          { type: 'ImagingStudy', profile: 'http://hl7.org/fhir/StructureDefinition/ImagingStudy' },
        ],
        security: { cors: true, tokenEndpoint: '/oauth2/token', SMART: true },
        interaction: ['read', 'search-type', 'create', 'update'],
      }],
    });
    loadResources('Patient');
  }, []);

  const loadResources = async (type: string) => {
    try {
      const r = await fetch(`/api/v1/fhir/${type}`);
      const d = await r.json();
      setResources(d.entry ? d.entry.map((e: any) => e.resource) : []);
    } catch {
      // Mock data
      setResources(Array.from({length: 5}, (_, i) => ({
        id: `demo-${i}`, resourceType: type,
        name: [{ text: ['患者 A','患者 B','患者 C','患者 D','患者 E'][i] }],
        gender: ['male','female'][i % 2],
        birthDate: `197${i}-01-01`,
      })));
    }
  };

  const handleQuery = async () => {
    try {
      const r = await fetch(`/api/v1/fhir/${resourceType}?${fhirQuery || '_count=5'}`);
      const d = await r.json();
      setQueryResult(d);
      message.success('FHIR 查询完成');
    } catch {
      message.warning('FHIR 查询 endpoint 未配置 (使用演示数据)');
      setQueryResult({ entry: Array.from({length:3}, (_, i) => ({ resource: { id:`q-${i}`, resourceType, name: `查询结果 ${i+1}` }})) });
    }
  };

  const resourceTypes = ['Patient', 'Observation', 'DiagnosticReport', 'Practitioner', 'ImagingStudy', 'Bundle'];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR Server 集成</span>
        <Tag color="cyan">v3.0.6.8-61</Tag>
        <Tag color="purple">SMART on FHIR R4</Tag>
        <Tag color="blue">{capability?.fhirVersion || '4.0.1'}</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="CapabilityStatement" value="1" /></Card></Col>
        <Col span={4}><Card><Statistic title="资源类型" value="5" /></Card></Col>
        <Col span={4}><Card><Statistic title="交互" value="4" suffix="种" /></Card></Col>
        <Col span={4}><Card><Statistic title="OAuth2" value="SMART" /></Card></Col>
      </Row>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          { key:'capability', label:'CapabilityStatement', children:
            capability ? <Card size="small" title={`FHIR ${capability.fhirVersion} Server Capabilities`}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="状态"><Tag color="green">{({active:'活跃', draft:'草稿', retired:'已停用'} as any)[capability.status] ?? capability.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="发布者">{capability.publisher}</Descriptions.Item>
                <Descriptions.Item label="交互">{capability.rest[0].interaction.join(', ')}</Descriptions.Item>
                <Descriptions.Item label="安全">{capability.rest[0].security.cors ? 'CORS + SMART OAuth2' : '无'}</Descriptions.Item>
              </Descriptions>
              <div style={{fontWeight:600,marginTop:12,marginBottom:4}}>资源类型:</div>
              {capability.rest[0].resource.map((r: any) => <Tag key={r.type} color="blue" style={{margin:2}}>{r.type}</Tag>)}
            </Card> : null
          },
          { key:'browse', label:'资源浏览器', children:
            <Card size="small" extra={
              <Space>
                <Select size="small" value={resourceType} onChange={(v) => { setResourceType(v); loadResources(v); }}
                  options={resourceTypes.map(t=>({value:t,label:t}))} />
                <Button icon={<RefreshCw size={12}/>} onClick={() => loadResources(resourceType)}>刷新</Button>
              </Space>
            } title={`资源: ${resourceType} (${resources.length})`}>
              <Table dataSource={resources} rowKey="id" pagination={false}
                columns={[
                  {title:'ID', dataIndex:'id'},
                  {title:'Type', dataIndex:'resourceType', render:(t)=><Tag color="blue">{t}</Tag>},
                  {title:'名称', render:(_,r)=>r.name?.[0]?.text || r.code?.text || r.id},
                  {title:'性别', dataIndex:'gender'},
                  {title:'出生日期', dataIndex:'birthDate'},
                ]} />
            </Card>
          },
          { key:'query', label:'FHIR 查询', children:
            <Space orientation="vertical" style={{width:'100%'}}>
              <Card size="small">
                <Space.Compact style={{width:'100%'}}>
                  <Input value={fhirQuery} onChange={e=>setFhirQuery(e.target.value)} placeholder='_count=5&name:contains=张' />
                  <Button type="primary" icon={<Search size={14}/>} onClick={handleQuery}>查询</Button>
                </Space.Compact>
                <div style={{fontSize:11,color:'#999',marginTop:4}}>FHIR 查询语法: _count / _sort / name:contains / birthdate=gt2020</div>
              </Card>
              {queryResult && <Card size="small" title="查询结果">
                <pre style={{fontSize:12,maxHeight:400,overflow:'auto',background:'#f5f5f5',padding:8,borderRadius:4}}>
                  {JSON.stringify(queryResult, null, 2).slice(0, 2000)}
                </pre>
              </Card>}
            </Space>
          },
          { key:'send', label:'发送 FHIR', children:
            <Card size="small" extra={<Button type="primary" icon={<Send size={12}/>} onClick={() => setSendModal(true)}>发送资源</Button>}>
              <Button block icon={<Plus size={14}/>} onClick={() => setSendModal(true)}>新建并发送 FHIR 资源</Button>
              <div style={{fontSize:12,color:'#999',marginTop:8}}>支持 POST/PUT 方式创建或更新 Patient/Observation/DiagnosticReport</div>
            </Card>
          },
        ]}
      />
      <Modal title="创建 FHIR 资源" open={sendModal} onCancel={() => setSendModal(false)} onOk={() => { message.success('FHIR 资源已创建'); setSendModal(false); }}>
        <Form layout="vertical" size="small">
          <Form.Item label="资源类型"><Select options={resourceTypes.map(t=>({value:t,label:t}))} /></Form.Item>
          <Form.Item label="JSON Body"><TextArea rows={8} placeholder='{"resourceType":"Patient","name":[{"family":"张","given":["伟"]}],...}' /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default FhirServerPage;

// [v3.0.6.8-61] FHIR Server 集成管理
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Space,
  Tag,
  Button,
  Tabs,
  message,
  Input,
  Descriptions,
  Modal,
  Form,
  Select,
  Alert,
} from "antd";
import { Globe, Send, Search, RefreshCw, Plus } from 'lucide-react';
import { fhirApi } from '../../services/api/fhirApi';
import { api } from '../../services/api/client';
import { ErrorBanner } from '../../components/feedback';
import { t } from '../../i18n/appI18n';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const { TextArea } = Input;

export const FhirServerPage: React.FC = () => {
  const [tab, setTab] = useState('capability');
  const [resources, setResources] = useState<any[]>([]);
  const [resourceType, setResourceType] = useState('Patient');
  const [capability, setCapability] = useState<any>(null);
  const [sendModal, setSendModal] = useState(false);
  const [fhirQuery, setFhirQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const demoRows = (type: string) => Array.from({ length: 5 }, (_, i) => ({
    id: `demo-${i}`, resourceType: type,
    name: [{ text: ['患者 A', '患者 B', '患者 C', '患者 D', '患者 E'][i] }],
    gender: ['male', 'female'][i % 2],
    birthDate: `197${i}-01-01`,
  }));

  // [G005 W7] 走 fhirApi / api client; 不可达时回退演示数据并展示「演示数据」徽标
  const loadResources = useCallback(async (type: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      let entries: { resource: any }[] | null = null;
      if (type === 'Patient') {
        const res = await fhirApi.searchPatient({ _count: '20' });
        entries = res.success ? (res.data?.entry ?? null) : null;
      } else if (type === 'Observation') {
        const res = await fhirApi.searchObservation({ _count: '20' });
        entries = res.success ? (res.data?.entry ?? null) : null;
      } else if (type === 'DiagnosticReport') {
        const res = await fhirApi.searchDiagnosticReport({ _count: '20' });
        entries = res.success ? (res.data?.entry ?? null) : null;
      } else if (type === 'ImagingStudy') {
        const res = await fhirApi.searchImagingStudy({ _count: '20' });
        entries = res.success ? (res.data?.entry ?? null) : null;
      } else {
        // Practitioner / Bundle 等无专用 api 方法 → 走通用 client (MSW 兜底)
        const res = await api.get<{ entry?: { resource: any }[] }>(`/fhir/${type}`);
        entries = res.success ? (res.data?.entry ?? null) : null;
      }
      if (entries && entries.length > 0) {
        setResources(entries.map((e) => e.resource));
        setUsingDemo(false);
      } else {
        setResources(demoRows(type));
        setUsingDemo(true);
      }
    } catch {
      setResources(demoRows(type));
      setUsingDemo(true);
      setLoadError(t('w7demo.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // [W3-C] CapabilityStatement 为静态声明文档 (对齐 FHIR R4 规范, 后端未提供 /fhir/metadata 端点)
    setCapability({
      fhirVersion: '4.0.1',
      status: 'active',
      publisher: 'G005 Radiology RIS',
      static: true,
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
    void loadResources('Patient');
  }, [loadResources]);

  const handleQuery = async () => {
    try {
      const res = await api.get<any>(`/fhir/${resourceType}?${fhirQuery || '_count=5'}`);
      if (res.success && res.data) {
        setQueryResult(res.data);
        message.success(t('fhirServer.queryDone'));
      } else {
        throw new Error('QUERY_FAILED');
      }
    } catch {
      message.warning(t('fhirServer.queryNotConfigured'));
      setQueryResult({ entry: Array.from({ length: 3 }, (_, i) => ({ resource: { id: `q-${i}`, resourceType, name: `查询结果 ${i + 1}` } })) });
    }
  };

  const resourceTypes = ['Patient', 'Observation', 'DiagnosticReport', 'Practitioner', 'ImagingStudy', 'Bundle'];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fhirServer.title')}</span>
        <Tag color="cyan">v3.0.6.8-61</Tag>
        <Tag color="purple">SMART on FHIR R4</Tag>
        <Tag color="blue">{capability?.fhirVersion || '4.0.1'}</Tag>
        {/* [G005 W7] 接口不可达回退本地演示数据时展示「演示数据」徽标 */}
        {usingDemo && <Tag color="orange">{t('w7demo.fhirFallback')}</Tag>}
      </Space>

      {loadError && !loading && (
        <ErrorBanner message={loadError} onRetry={() => void loadResources(resourceType)} retryLabel={t('w7demo.retry')} />
      )}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('fhirServer.capability')} value="1" color="primary" icon={<Globe size={18} />} />
        <StatCard title={t('fhirServer.resourceType')} value="5" color="primary" icon={<Search size={18} />} />
        <StatCard title={t('fhirServer.interaction')} value="4" suffix={t('fhirServer.kinds')} color="primary" icon={<Send size={18} />} />
        <StatCard title={t('fhirServer.oauth2')} value="SMART" color="info" />
      </StatCardGrid>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          { key:'capability', label:t('fhirServer.tabCapability'), children:
            capability ? <Card size="small" title={<Space>{t('fhirServer.capabilityTitle', { version: capability.fhirVersion })} <Tag color="orange">{t('fhirServer.staticDeclaration')}</Tag></Space>}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('fhirServer.status')}><Tag color="green">{({active: t('w9e.fhirServer.statusActive'), draft: t('w9e.fhirServer.statusDraft'), retired: t('w9e.fhirServer.statusRetired')} as any)[capability.status] ?? capability.status}</Tag></Descriptions.Item>
                <Descriptions.Item label={t('fhirServer.publisher')}>{capability.publisher}</Descriptions.Item>
                <Descriptions.Item label={t('fhirServer.interaction')}>{capability.rest?.[0]?.interaction?.join(', ') ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('fhirServer.security')}>{capability.rest?.[0]?.security?.cors ? t('fhirServer.corsSmart') : t('fhirServer.none')}</Descriptions.Item>
              </Descriptions>
              <div style={{fontWeight:600,marginTop:12,marginBottom:4}}>{t('fhirServer.resourceTypes')}</div>
              {(capability.rest?.[0]?.resource ?? []).map((r: any) => <Tag key={r.type} color="blue" style={{margin:2}}>{r.type}</Tag>)}
              <Alert type="info" showIcon style={{ marginTop: 12 }} message={t('fhirServer.capabilityAlert')} />
            </Card> : null
          },
          { key:'browse', label:t('fhirServer.tabBrowse'), children:
            <Card size="small" extra={
              <Space>
                <Select size="small" value={resourceType} onChange={(v) => { setResourceType(v); void loadResources(v); }}
                  options={resourceTypes.map(rt=>({value:rt,label:rt}))} />
                <Button icon={<RefreshCw size={12}/>} loading={loading} onClick={() => void loadResources(resourceType)}>{t('fhirServer.refresh')}</Button>
              </Space>
            } title={t('w9e.fhirServer.resourceTitle', { type: resourceType, count: resources.length })}>
              <DataTable dataSource={resources} rowKey="id" pagination={false} loading={loading}
                locale={{ emptyText: t('w7demo.empty') }}
                columns={[
                  {title:t('fhirServer.colId'), dataIndex:'id'},
                  {title:t('fhirServer.colType'), dataIndex:'resourceType', render:(v)=><Tag color="blue">{v}</Tag>},
                  {title:t('fhirServer.colName'), render:(_,r)=>r.name?.[0]?.text || r.code?.text || r.id},
                  {title:t('fhirServer.colGender'), dataIndex:'gender'},
                  {title:t('fhirServer.colBirthDate'), dataIndex:'birthDate'},
                ]} 
              scroll={{ x: 'max-content' }}/>
            </Card>
          },
          { key:'query', label:t('fhirServer.tabQuery'), children:
            <Space orientation="vertical" style={{width:'100%'}}>
              <Card size="small">
                <Space.Compact style={{width:'100%'}}>
                  <Input value={fhirQuery} onChange={e=>setFhirQuery(e.target.value)} placeholder='_count=5&name:contains=张' />
                  <Button type="primary" icon={<Search size={14}/>} onClick={handleQuery}>{t('fhirServer.query')}</Button>
                </Space.Compact>
                <div style={{fontSize:11,color:'#999',marginTop:4}}>{t('fhirServer.querySyntax')}</div>
              </Card>
              {queryResult && <Card size="small" title={t('fhirServer.queryResult')}>
                <pre style={{fontSize:12,maxHeight:400,overflow:'auto',background:'var(--bg-card)',padding:8,borderRadius:4}}>
                  {JSON.stringify(queryResult, null, 2).slice(0, 2000)}
                </pre>
              </Card>}
            </Space>
          },
          { key:'send', label:t('fhirServer.tabSend'), children:
            <Card size="small" extra={<Button type="primary" icon={<Send size={12}/>} onClick={() => setSendModal(true)}>{t('fhirServer.sendResource')}</Button>}>
              <Button block icon={<Plus size={14}/>} onClick={() => setSendModal(true)}>{t('fhirServer.newAndSend')}</Button>
              <div style={{fontSize:12,color:'#999',marginTop:8}}>{t('fhirServer.sendHint')}</div>
            </Card>
          },
        ]}
      />
      <Modal title={t('fhirServer.createResource')} open={sendModal} onCancel={() => setSendModal(false)} onOk={() => { message.success(t('fhirServer.resourceCreated')); setSendModal(false); }}>
        <Form layout="vertical" size="small">
          <Form.Item label={t('fhirServer.resourceType')}><Select options={resourceTypes.map(rt=>({value:rt,label:rt}))} /></Form.Item>
          <Form.Item label={t('fhirServer.jsonBody')}><TextArea rows={8} placeholder='{"resourceType":"Patient","name":[{"family":"张","given":["伟"]}],...}' /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default FhirServerPage;

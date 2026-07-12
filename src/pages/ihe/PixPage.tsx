import React, { useState, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Tabs, Row, Col, message, Input, Form, Select, Modal, Popconfirm, Alert } from 'antd';
import { Send, Search, Plus, Delete, Users, Fingerprint, Activity } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';

const { TextArea } = Input;

interface PixMapping {
  id: string;
  assigningAuthority: string;
  externalId: string;
  internalPatientId: string;
}

interface PixFeedResult {
  success: boolean;
  ack: string;
  storedPid?: string;
  transaction?: string;
}

interface PixQueryResult {
  transaction: string;
  count: number;
  patientId: string;
  sourceDomain: string;
  results: Array<{
    patientId: string;
    assigningAuthority: string;
    identifiers: Array<{ domain: string; value: string; assigningAuthority: string }>;
    name: { family: string; given: string[] };
  }>;
}

interface PdqResult {
  patientId: string;
  assigningAuthority: string;
  identifiers: Array<{ domain: string; value: string }>;
  name: { family: string; given: string[] };
  birthDate: string;
  gender: string;
  address?: string;
  phone?: string;
  confidence: number;
}

const DEMO_MAPPINGS: PixMapping[] = [
  { id: '1', assigningAuthority: 'HOSPITAL_A', externalId: 'P001', internalPatientId: 'G005-00001' },
  { id: '2', assigningAuthority: 'CLINIC_B', externalId: 'CL-1002', internalPatientId: 'G005-00002' },
  { id: '3', assigningAuthority: 'HOSPITAL_C', externalId: 'HC-2034', internalPatientId: 'G005-00003' },
];

export const PixPage: React.FC = () => {
  const [tab, setTab] = useState('feed');
  const [feedForm] = Form.useForm();
  const [queryForm] = Form.useForm();
  const [pdqForm] = Form.useForm();

  const [feedResult, setFeedResult] = useState<PixFeedResult | null>(null);
  const [queryResult, setQueryResult] = useState<PixQueryResult | null>(null);
  const [pdqResults, setPdqResults] = useState<PdqResult[]>([]);
  const [mappings, setMappings] = useState<PixMapping[]>(DEMO_MAPPINGS);
  const [mappingModal, setMappingModal] = useState(false);
  const [mappingForm] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [pdqLoading, setPdqLoading] = useState(false);

  const handleFeed = useCallback(async () => {
    setSending(true);
    setFeedResult(null);
    let pid = '';
    try {
      const values = await feedForm.validateFields();
      pid = values.patientId;
      const body = {
        patientId: values.patientId,
        assigningAuthority: values.assigningAuthority,
        identifiers: (values.identifiers?.split('\n').filter(Boolean) as string[] ?? []).map((l: string) => {
          const [domain, value] = l.split('|');
          return { domain: domain?.trim() || '', value: value?.trim() || '', assigningAuthority: values.assigningAuthority };
        }),
        name: { family: values.familyName || values.patientId, given: [values.givenName || ''] },
        birthDate: values.birthDate || '2000-01-01',
        gender: values.gender || 'U',
      };
      const res = await iheApi.pixFeed(body);
      if (res.success) {
        setFeedResult({ success: true, ack: res.data.ack, storedPid: res.data.storedPid || pid });
        message.success('PIX Feed 发送成功');
      } else {
        setFeedResult({ success: false, ack: 'AE' });
        message.error('PIX Feed 发送失败');
      }
    } catch {
      message.warning('使用模拟响应');
      setFeedResult({ success: true, ack: 'AA', storedPid: pid || feedForm.getFieldValue('patientId') });
    }
    setSending(false);
  }, [feedForm]);

  const handleQuery = useCallback(async () => {
    setQuerying(true);
    setQueryResult(null);
    const qv = queryForm.getFieldsValue();
    try {
      const values = await queryForm.validateFields();
      const body = {
        patientId: values.patientId,
        sourceDomain: values.sourceDomain,
        targetDomains: (values.targetDomains?.split('\n').filter(Boolean) as string[] ?? []).map((s: string) => s.trim()),
      };
      const res = await iheApi.pixQuery(body);
      if (res.success) {
        setQueryResult(res.data);
        message.success('PIX Query 完成');
      } else {
        message.error('PIX Query 失败');
      }
    } catch {
      message.warning('使用模拟数据');
      const mockPid = qv.patientId || 'P001';
      const mockSrc = qv.sourceDomain || 'HOSPITAL_A';
      const domains = (qv.targetDomains || 'HOSPITAL_B').split('\n').filter(Boolean).map((s: string) => s.trim());
      setQueryResult({
        transaction: `TXN-${Date.now()}`,
        count: domains.length,
        patientId: mockPid,
        sourceDomain: mockSrc,
        results: domains.map((d: string) => ({
          patientId: mockPid,
          assigningAuthority: d,
          identifiers: [{ domain: d, value: `${d}-${mockPid}`, assigningAuthority: d }],
          name: { family: '张', given: ['三'] },
        })),
      });
    }
    setQuerying(false);
  }, [queryForm]);

  const handlePdqQuery = useCallback(async () => {
    setPdqLoading(true);
    setPdqResults([]);
    try {
      const values = await pdqForm.validateFields();
      const body = {
        patientId: values.patientId,
        familyName: values.name,
        birthDate: values.birthDate,
        gender: values.gender,
      };
      const res = await iheApi.pdqQuery(body);
      if (res.success) {
        setPdqResults(res.data.results.sort((a, b) => b.confidence - a.confidence));
        message.success('PDQ 查询完成');
      } else {
        message.error('PDQ 查询失败');
      }
    } catch {
      message.warning('使用模拟数据');
      setPdqResults([
        { patientId: 'P001', assigningAuthority: 'HOSPITAL_A', identifiers: [{ domain: 'HOSPITAL_A', value: 'P001' }], name: { family: '张', given: ['三'] }, birthDate: '1985-06-15', gender: 'M', address: '测试地址1', phone: '13800138001', confidence: 0.98 },
        { patientId: 'CL-1002', assigningAuthority: 'CLINIC_B', identifiers: [{ domain: 'CLINIC_B', value: 'CL-1002' }], name: { family: '张', given: ['三'] }, birthDate: '1985-06-15', gender: 'M', address: '测试地址2', phone: '13800138002', confidence: 0.85 },
      ]);
    }
    setPdqLoading(false);
  }, [pdqForm]);

  const handleAddMapping = async () => {
    try {
      const values = await mappingForm.validateFields();
      const newMapping: PixMapping = { id: `${Date.now()}`, ...values };
      setMappings([...mappings, newMapping]);
      setMappingModal(false);
      mappingForm.resetFields();
      message.success('Mapping 已添加');
    } catch { /* ignore */ }
  };

  const handleDeleteMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id));
    message.success('Mapping 已删除');
  };

  const identitiesColumns = [
    { title: 'Assigning Authority', dataIndex: 'assigningAuthority', key: 'aa' },
    { title: 'Patient ID', dataIndex: 'patientId', key: 'pid' },
    { title: 'Identifiers', key: 'ids', render: (_: any, r: any) => r.identifiers?.map((i: any) => <Tag key={i.domain}>{i.domain}: {i.value}</Tag>) },
    { title: 'Name', key: 'name', render: (_: any, r: any) => r.name ? `${r.name.family} ${r.name.given?.join(' ')}` : '-' },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Fingerprint size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>PIX 主索引管理</span>
        <Tag color="cyan">v3.0.6.8</Tag>
        <Tag color="green">ITI-8 Feed</Tag>
        <Tag color="blue">ITI-9 Query</Tag>
        <Tag color="orange">PDQ</Tag>
      </Space>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          { key: 'feed', label: <span><Send size={14} style={{ marginRight: 4 }} />PIX Feed</span>, children:
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="Patient Identity Feed (ITI-8)">
                  <Form form={feedForm} layout="vertical" size="small">
                    <Form.Item name="patientId" label="Patient ID" rules={[{ required: true }]}>
                      <Input placeholder="例如: P001" />
                    </Form.Item>
                    <Form.Item name="assigningAuthority" label="Assigning Authority" rules={[{ required: true }]}>
                      <Input placeholder="例如: HOSPITAL_A" />
                    </Form.Item>
                    <Form.Item name="identifiers" label="Identifiers (每行 domain|value)">
                      <TextArea rows={3} placeholder="HOSPITAL_A|P001" />
                    </Form.Item>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Form.Item name="familyName" label="Family Name">
                          <Input placeholder="姓" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="givenName" label="Given Name">
                          <Input placeholder="名" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item>
                      <Button type="primary" icon={<Send size={14} />} loading={sending} onClick={handleFeed}>发送 PIX Feed</Button>
                    </Form.Item>
                  </Form>
                  {feedResult && (
                    <Alert type={feedResult.success ? 'success' : 'error'}
                      message={`ACK: ${feedResult.ack}${feedResult.storedPid ? ` | Stored PID: ${feedResult.storedPid}` : ''}${feedResult.transaction ? ` | TXN: ${feedResult.transaction}` : ''}`}
                      showIcon style={{ marginTop: 8 }} />
                  )}
                </Card>
              </Col>
            </Row>
          },
          { key: 'query', label: <span><Search size={14} style={{ marginRight: 4 }} />PIX Query</span>, children:
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="PIX Query (ITI-9)">
                  <Form form={queryForm} layout="vertical" size="small">
                    <Form.Item name="patientId" label="Patient ID" rules={[{ required: true }]}>
                      <Input placeholder="例如: P001" />
                    </Form.Item>
                    <Form.Item name="sourceDomain" label="Source Domain" rules={[{ required: true }]}>
                      <Input placeholder="例如: HOSPITAL_A" />
                    </Form.Item>
                    <Form.Item name="targetDomains" label="Target Domains (每行一个)" rules={[{ required: true }]}>
                      <TextArea rows={3} placeholder="HOSPITAL_B&#10;CLINIC_C" />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" icon={<Search size={14} />} loading={querying} onClick={handleQuery}>查询</Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
              <Col span={12}>
                {queryResult && (
                  <Card size="small" title={`查询结果 (${queryResult.count} 条)`}>
                    <Table dataSource={queryResult.results} rowKey={(r) => `${r.assigningAuthority}-${r.patientId}`} pagination={false} columns={identitiesColumns} size="small" />
                    {queryResult.transaction && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Transaction: {queryResult.transaction}</div>}
                  </Card>
                )}
              </Col>
            </Row>
          },
          { key: 'mapping', label: <span><Users size={14} style={{ marginRight: 4 }} />PIX Mapping</span>, children:
            <Card size="small" title="PIX Identifier Mapping" extra={<Button type="primary" icon={<Plus size={14} />} onClick={() => setMappingModal(true)}>新增 Mapping</Button>}>
              <Table dataSource={mappings} rowKey="id" pagination={false}
                columns={[
                  { title: 'Assigning Authority', dataIndex: 'assigningAuthority' },
                  { title: 'External ID', dataIndex: 'externalId' },
                  { title: 'Internal Patient ID', dataIndex: 'internalPatientId' },
                  { title: 'Action', render: (_: any, r: PixMapping) =>
                    <Popconfirm title="确认删除?" onConfirm={() => handleDeleteMapping(r.id)}>
                      <Button size="small" danger icon={<Delete size={12} />}>删除</Button>
                    </Popconfirm>
                  },
                ]} />
            </Card>
          },
          { key: 'pdq', label: <span><Activity size={14} style={{ marginRight: 4 }} />PDQ 查询</span>, children:
            <Row gutter={16}>
              <Col span={10}>
                <Card size="small" title="Patient Demographics Query (ITI-21)">
                  <Form form={pdqForm} layout="vertical" size="small">
                    <Form.Item name="patientId" label="Patient ID">
                      <Input placeholder="例如: P001" />
                    </Form.Item>
                    <Form.Item name="name" label="Name">
                      <Input placeholder="患者姓名" />
                    </Form.Item>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Form.Item name="birthDate" label="Birth Date">
                          <Input placeholder="YYYY-MM-DD" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="gender" label="Gender">
                          <Select allowClear placeholder="选择性别" options={[
                            { value: 'M', label: '男' },
                            { value: 'F', label: '女' },
                            { value: 'O', label: '其他' },
                          ]} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item>
                      <Button type="primary" icon={<Search size={14} />} loading={pdqLoading} onClick={handlePdqQuery}>查询</Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
              <Col span={14}>
                {pdqResults.length > 0 && (
                  <Card size="small" title={`PDQ 结果 (${pdqResults.length})`}>
                    <Table dataSource={pdqResults} rowKey={(r) => `${r.assigningAuthority}-${r.patientId}`} pagination={false} size="small"
                      columns={[
                        { title: 'Patient ID', dataIndex: 'patientId' },
                        { title: 'Authority', dataIndex: 'assigningAuthority' },
                        { title: 'Name', render: (_: any, r: PdqResult) => `${r.name.family} ${r.name.given?.join(' ')}` },
                        { title: 'Birth Date', dataIndex: 'birthDate' },
                        { title: 'Gender', dataIndex: 'gender' },
                        { title: 'Phone', dataIndex: 'phone' },
                        { title: 'Confidence', dataIndex: 'confidence', render: (v: number) => <Tag color={v >= 0.9 ? 'green' : v >= 0.7 ? 'orange' : 'red'}>{(v * 100).toFixed(0)}%</Tag> },
                      ]} />
                  </Card>
                )}
              </Col>
            </Row>
          },
        ]}
      />

      <Modal title="新增 PIX Mapping" open={mappingModal} onCancel={() => setMappingModal(false)} onOk={handleAddMapping}>
        <Form form={mappingForm} layout="vertical" size="small">
          <Form.Item name="assigningAuthority" label="Assigning Authority" rules={[{ required: true }]}>
            <Input placeholder="例如: HOSPITAL_A" />
          </Form.Item>
          <Form.Item name="externalId" label="External ID" rules={[{ required: true }]}>
            <Input placeholder="例如: P001" />
          </Form.Item>
          <Form.Item name="internalPatientId" label="Internal Patient ID" rules={[{ required: true }]}>
            <Input placeholder="例如: G005-00001" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PixPage;

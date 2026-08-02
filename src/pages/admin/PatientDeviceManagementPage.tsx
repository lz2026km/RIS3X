// [v3.0.6.8-46] PR2: 患者 + 设备 CRUD 综合管理页面
import React, { useState, useEffect } from 'react';
import {
  Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message,
  Tabs, List, Empty, Statistic, Alert, InputNumber, Modal, Timeline,
  Table, Drawer, Descriptions, Switch, Tooltip, Avatar,
} from 'antd';
import {
  User, Box, Activity, Search, Plus, Edit3, Trash2, Wrench, QrCode,
  Calendar, MapPin, Phone, Mail, Heart, Stethoscope, FileText,
  ChevronRight, Clock, AlertCircle, RefreshCw, Save, X, History, BarChart3,
} from 'lucide-react';
import { patientApi } from '@/services/api/patientApi';
import { deviceApi } from '@/services/api/deviceApi';

const { TextArea } = Input;

export const PatientDeviceManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('patients');
  // 患者
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientDetail, setPatientDetail] = useState<any>(null);
  const [patientExams, setPatientExams] = useState<any[]>([]);
  const [patientReports, setPatientReports] = useState<any[]>([]);
  const [patientTimeline, setPatientTimeline] = useState<any[]>([]);
  const [patientModal, setPatientModal] = useState<{ type: 'create' | 'update' | null; data: any }>({ type: null, data: {} });
  const [patientFilter, setPatientFilter] = useState({ keyword: '', gender: '' });

  // 设备
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [deviceHistory, setDeviceHistory] = useState<any[]>([]);
  const [deviceModal, setDeviceModal] = useState<{ type: 'create' | 'update' | 'status' | 'maintain' | null; data: any }>({ type: null, data: {} });
  const [deviceFilter, setDeviceFilter] = useState({ modality: '' });

  // 加载
  const loadPatients = async () => {
    try {
      const r = await patientApi.list({ pageSize: 50 });
      if (r.success) setPatients(r.data);
    } catch (e: any) { message.error(e.message); }
  };
  const loadDevices = async () => {
    try {
      const r = await deviceApi.list();
      if (r.success) setDevices(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { loadPatients(); loadDevices(); }, []);

  // 患者详情
  const handleSelectPatient = async (p: any) => {
    setSelectedPatient(p);
    const id = p.id || p.patientId;
    try {
      const [eR, rR, tR] = await Promise.all([
        patientApi.getExams(id),
        patientApi.getReports(id),
        patientApi.getTimeline(id),
      ]);
      setPatientExams(eR.data || []);
      setPatientReports(rR.data || []);
      setPatientTimeline(tR.data || []);
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  };

  // 患者 CRUD
  const handlePatientSave = async () => {
    if (!patientModal.data.name) return message.warning('请填写姓名');
    try {
      let r;
      if (patientModal.type === 'create') r = await patientApi.create(patientModal.data);
      else r = await patientApi.update(selectedPatient.id, patientModal.data);
      if (r.success) { message.success('保存成功'); setPatientModal({ type: null, data: {} }); loadPatients(); }
    } catch (e: any) { message.error(e.message); }
  };

  // 设备维护
  const handleDeviceMaintain = async (id: string, reason: string) => {
    try {
      const r = await deviceApi.triggerMaintenance(id, reason);
      if (r.success) { message.success('维护指令已发出'); loadDevices(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleDeviceStatus = async (id: string, status: string) => {
    try {
      const r = await deviceApi.updateStatus(id, status);
      if (r.success) { message.success(`状态已更新: ${status}`); loadDevices(); }
    } catch (e: any) { message.error(e.message); }
  };

  const filteredPatients = patients.filter(p => {
    if (patientFilter.keyword && !p.name?.includes(patientFilter.keyword) && !p.id?.includes(patientFilter.keyword)) return false;
    if (patientFilter.gender && p.gender !== patientFilter.gender) return false;
    return true;
  });

  const filteredDevices = devices.filter(d => {
    if (deviceFilter.modality && d.modality !== deviceFilter.modality) return false;
    return true;
  });

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <User size={20} color="#1677ff" />
        <Box size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>患者 + 设备管理</span>
        <Tag color="cyan">PR2 (v3.0.6.8-46)</Tag>
        <Tag color="purple">Medisoft mediSIGHT 对标</Tag>
        <Tag color="green">22 client + 14 端点</Tag>
      </Space>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 患者管理 */}
        <Tabs.TabPane tab={<span><User size={14} /> 患者管理</span>} key="patients">
          <Row gutter={16}>
            <Col span={10}>
              <Card
                title={`患者列表 (${filteredPatients.length})`}
                size="small"
                extra={
                  <Space>
                    <Input.Search
                      size="small"
                      placeholder="姓名/ID"
                      value={patientFilter.keyword}
                      onChange={e => setPatientFilter({ ...patientFilter, keyword: e.target.value })}
                      style={{ width: 120 }}
                    />
                    <Select
                      size="small"
                      placeholder="性别"
                      value={patientFilter.gender || undefined}
                      onChange={v => setPatientFilter({ ...patientFilter, gender: v })}
                      allowClear
                      style={{ width: 80 }}
                      options={[{ value: 'M', label: '男' }, { value: 'F', label: '女' }]}
                    />
                    <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setPatientModal({ type: 'create', data: {} })}>新增</Button>
                  </Space>
                }
              >
                <List
                  size="small"
                  dataSource={filteredPatients}
                  renderItem={p => (
                    <List.Item
                      className={selectedPatient?.id === p.id ? 'ant-list-item-selected' : ''}
                      onClick={() => handleSelectPatient(p)}
                      style={{ cursor: 'pointer' }}
                      actions={[<Tag color="blue" key="id">{p.id}</Tag>]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar style={{ background: '#1677ff' }}>{p.name?.slice(0, 1)}</Avatar>}
                        title={<span>{p.name} ({p.gender}, {p.age}岁)</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {p.diagnosis || p.medicalHistory?.slice(0, 30) || '无诊断'}
                          </span>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            <Col span={14}>
              {selectedPatient ? (
                <Card
                  title={
                    <Space>
                      <User size={16} />
                      {selectedPatient.name}
                      <Tag color="blue">{selectedPatient.id}</Tag>
                    </Space>
                  }
                  size="small"
                  extra={
                    <Button icon={<Edit3 size={12} />} onClick={() => setPatientModal({ type: 'update', data: { ...selectedPatient } })}>编辑</Button>
                  }
                >
                  <Descriptions column={3} size="small" bordered>
                    <Descriptions.Item label="性别">{selectedPatient.gender}</Descriptions.Item>
                    <Descriptions.Item label="年龄">{selectedPatient.age} 岁</Descriptions.Item>
                    <Descriptions.Item label="电话">{selectedPatient.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="身份证">{selectedPatient.idCard || '-'}</Descriptions.Item>
                    <Descriptions.Item label="血型">{selectedPatient.bloodType || '-'}</Descriptions.Item>
                    <Descriptions.Item label="类型">{selectedPatient.patientType || '门诊'}</Descriptions.Item>
                    <Descriptions.Item label="地址" span={3}>{selectedPatient.address || '-'}</Descriptions.Item>
                    <Descriptions.Item label="过敏史" span={3}>{selectedPatient.allergyHistory || '无'}</Descriptions.Item>
                    <Descriptions.Item label="既往史" span={3}>{selectedPatient.medicalHistory || '无'}</Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: '8px 0' }} />

                  <Tabs
                    size="small"
                    items={[
                      { key: 'exams', label: <span><Stethoscope size={12} /> 检查 ({patientExams.length})</span>, children: (
                        <Table size="small" dataSource={patientExams} rowKey="id" pagination={false}
                          columns={[
                            { title: '编号', dataIndex: 'id' },
                            { title: '模态', dataIndex: 'modality' },
                            { title: '部位', dataIndex: 'bodyPart' },
                            { title: '状态', dataIndex: 'status' },
                            { title: '日期', dataIndex: 'examAt' },
                          ]} />
                      )},
                      { key: 'reports', label: <span><FileText size={12} /> 报告 ({patientReports.length})</span>, children: (
                        <List size="small" dataSource={patientReports} renderItem={r => (
                          <List.Item>{r.id} - {r.modality} - {r.diagnosis}</List.Item>
                        )} />
                      )},
                      { key: 'timeline', label: <span><History size={12} /> 时间线 ({patientTimeline.length})</span>, children: (
                        <Timeline items={(patientTimeline || []).slice(0, 10).map((e: any) => ({
                          children: <div><b>{e.eventType || e.type}</b>: {e.description || e.content} <span style={{ color: '#999' }}>· {e.date || e.timestamp}</span></div>,
                        }))} />
                      )},
                    ]}
                  />
                </Card>
              ) : <Card><Empty description="选择左侧患者查看详情" /></Card>}
            </Col>
          </Row>
        </Tabs.TabPane>

        {/* 设备管理 */}
        <Tabs.TabPane tab={<span><Box size={14} /> 设备管理</span>} key="devices">
          <Row gutter={16}>
            <Col span={10}>
              <Card
                title={`设备列表 (${filteredDevices.length})`}
                size="small"
                extra={
                  <Space>
                    <Select
                      size="small"
                      placeholder="模态"
                      value={deviceFilter.modality || undefined}
                      onChange={v => setDeviceFilter({ ...deviceFilter, modality: v })}
                      allowClear
                      style={{ width: 100 }}
                      options={['CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map(m => ({ value: m, label: m }))}
                    />
                    <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setDeviceModal({ type: 'create', data: {} })}>新增</Button>
                  </Space>
                }
              >
                <List
                  size="small"
                  dataSource={filteredDevices}
                  renderItem={d => (
                    <List.Item
                      className={selectedDevice?.id === d.id ? 'ant-list-item-selected' : ''}
                      onClick={async () => {
                        setSelectedDevice(d);
                        try {
                          const hR = await deviceApi.getMaintenanceHistory(d.id);
                          setDeviceHistory(hR.data || []);
                        } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
                      }}
                      style={{ cursor: 'pointer' }}
                      actions={[
                        <Tag color={d.status === '运行中' ? 'green' : d.status === '维护中' ? 'orange' : 'default'} key="s">
                          {d.status}
                        </Tag>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar style={{ background: '#52c41a' }}>{d.modality}</Avatar>}
                        title={<span>{d.name || d.model}</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {d.room || '-'} | {d.manufacturer} {d.model}
                          </span>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            <Col span={14}>
              {selectedDevice ? (
                <Card
                  title={
                    <Space>
                      <Box size={16} />
                      {selectedDevice.name || selectedDevice.model}
                      <Tag color="blue">{selectedDevice.modality}</Tag>
                      <Tag color={selectedDevice.status === '运行中' ? 'green' : 'orange'}>{selectedDevice.status}</Tag>
                    </Space>
                  }
                  size="small"
                  extra={
                    <Space wrap>
                      <Select
                        size="small"
                        value={selectedDevice.status}
                        onChange={v => handleDeviceStatus(selectedDevice.id, v)}
                        style={{ width: 110 }}
                        options={[
                          { value: '运行中', label: '运行中' },
                          { value: '待机', label: '待机' },
                          { value: '维护中', label: '维护中' },
                          { value: '故障', label: '故障' },
                        ]}
                      />
                      <Button size="small" icon={<Wrench size={12} />} onClick={() => setDeviceModal({ type: 'maintain', data: selectedDevice })}>维护</Button>
                      <Button size="small" icon={<Edit3 size={12} />} onClick={() => setDeviceModal({ type: 'update', data: { ...selectedDevice } })}>编辑</Button>
                    </Space>
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}><Statistic title="本月扫描" value={selectedDevice.totalMonthlyScans || 0} /></Col>
                    <Col span={8}><Statistic title="使用率" value={((selectedDevice.utilization || 0) * 100).toFixed(0)} suffix="%" /></Col>
                    <Col span={8}><Statistic title="资产价值" value={((selectedDevice.totalValue || 0) / 10000).toFixed(1)} suffix="万" /></Col>
                  </Row>
                  <Descriptions column={2} size="small" bordered style={{ marginTop: 12 }}>
                    <Descriptions.Item label="厂家">{selectedDevice.manufacturer || '-'}</Descriptions.Item>
                    <Descriptions.Item label="型号">{selectedDevice.model || '-'}</Descriptions.Item>
                    <Descriptions.Item label="房间">{selectedDevice.room || '-'}</Descriptions.Item>
                    <Descriptions.Item label="建筑">{selectedDevice.building || '-'}</Descriptions.Item>
                    <Descriptions.Item label="下次维护">{selectedDevice.nextMaintenanceAt || '-'}</Descriptions.Item>
                    <Descriptions.Item label="负责人">{selectedDevice.responsibleEngineer || '-'}</Descriptions.Item>
                  </Descriptions>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>维护历史 ({deviceHistory.length})</div>
                  <Timeline size="small" items={deviceHistory.slice(0, 5).map((h: any) => ({
                    children: <div>{h.date} - {h.type} - {h.notes}</div>,
                  }))} />
                </Card>
              ) : <Card><Empty description="选择左侧设备查看详情" /></Card>}
            </Col>
          </Row>
        </Tabs.TabPane>
      </Tabs>

      {/* 患者 Modal */}
      <Modal
        title={patientModal.type === 'create' ? '新增患者' : '编辑患者'}
        open={!!patientModal.type}
        onCancel={() => setPatientModal({ type: null, data: {} })}
        onOk={handlePatientSave}
        width={600}
      >
        <Form layout="vertical" size="small">
          <Row gutter={8}>
            <Col span={12}><Form.Item label="姓名"><Input value={patientModal.data.name} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, name: e.target.value } })} /></Form.Item></Col>
            <Col span={6}><Form.Item label="性别"><Select value={patientModal.data.gender} onChange={v => setPatientModal({ ...patientModal, data: { ...patientModal.data, gender: v } })} options={[{value:'M',label:'男'},{value:'F',label:'女'}]} /></Form.Item></Col>
            <Col span={6}><Form.Item label="年龄"><InputNumber value={patientModal.data.age} onChange={v => setPatientModal({ ...patientModal, data: { ...patientModal.data, age: v } })} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="电话"><Input value={patientModal.data.phone} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, phone: e.target.value } })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="血型"><Select value={patientModal.data.bloodType} onChange={v => setPatientModal({ ...patientModal, data: { ...patientModal.data, bloodType: v } })} options={['A','B','AB','O'].map(b=>({value:b,label:b}))} /></Form.Item></Col>
            <Col span={24}><Form.Item label="地址"><Input value={patientModal.data.address} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, address: e.target.value } })} /></Form.Item></Col>
            <Col span={24}><Form.Item label="诊断"><TextArea rows={2} value={patientModal.data.diagnosis} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, diagnosis: e.target.value } })} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 设备维护 Modal */}
      <Modal
        title="触发设备维护"
        open={deviceModal.type === 'maintain'}
        onCancel={() => setDeviceModal({ type: null, data: {} })}
        onOk={() => handleDeviceMaintain(deviceModal.data.id, '定期维护')}
        width={400}
      >
        <Alert title="将为该设备创建维护指令" type="info" showIcon style={{ marginBottom: 8 }} />
        <p>设备: {deviceModal.data.name} ({deviceModal.data.id})</p>
      </Modal>
    </div>
  );
};

export default PatientDeviceManagementPage;

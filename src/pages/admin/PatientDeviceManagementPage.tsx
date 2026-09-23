// [v3.0.6.8-46] PR2: 患者 + 设备 CRUD 综合管理页面
import { deviceApi } from '@/services/api/deviceApi';
import { patientApi } from '@/services/api/patientApi';
import { Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message, Tabs, List, Empty, Statistic, Alert, InputNumber, Modal, Timeline, Table, Descriptions, Avatar } from 'antd';
import { User, Box, Plus, Edit3, Wrench, Stethoscope, FileText, History } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Inbox } from 'lucide-react'
import { LoadingBanner } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

const { TextArea } = Input;

export const PatientDeviceManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('patients');
  // 患者
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [_patientDetail, _setPatientDetail] = useState<any>(null);
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
  const [loading, setLoading] = useState(true);
  const loadPatients = async () => {
    try {
      const r = await patientApi.list({ pageSize: 50 });
      if (r.success) setPatients(Array.isArray(r.data) ? r.data : r.data?.items ?? []);
    } catch (e: any) { message.error(e.message); }
  };
  const loadDevices = async () => {
    try {
      const r = await deviceApi.list();
      if (r.success) setDevices(r.data ?? []);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadPatients(), loadDevices()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    if (!patientModal.data.name) { message.warning(t('patientDevice.nameRequired')); return; }
    try {
      let r;
      if (patientModal.type === 'create') r = await patientApi.create(patientModal.data);
      else r = await patientApi.update(selectedPatient.id, patientModal.data);
      if (r.success) { message.success(t('patientDevice.saveSuccess')); setPatientModal({ type: null, data: {} }); loadPatients(); }
    } catch (e: any) { message.error(e.message); }
  };

  // 设备维护
  const handleDeviceMaintain = async (id: string, reason: string) => {
    try {
      const r = await deviceApi.logMaintenance(id, { type: 'corrective', note: reason });
      if (r.success) { message.success(t('patientDevice.maintenanceSent')); loadDevices(); }
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
        <User size={20} color="#2563eb" />
        <Box size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('patientDevice.title')}</span>
        <Tag color="cyan">PR2 (v3.0.6.8-46)</Tag>
        <Tag color="purple">{t('patientDevice.benchmark')}</Tag>
        <Tag color="green">{t('patientDevice.endpointTag')}</Tag>
      </Space>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 患者管理 */}
        <Tabs.TabPane tab={<span><User size={14} /> {t('patientDevice.patientMgmt')}</span>} key="patients">
          <Row gutter={16}>
            <Col span={10}>
              <Card
                title={`${t('patientDevice.patientList')} (${filteredPatients.length})`}
                size="small"
                extra={
                  <Space>
                    <Input.Search
                      size="small"
                      placeholder={t('patientDevice.nameOrId')}
                      value={patientFilter.keyword}
                      onChange={e => setPatientFilter({ ...patientFilter, keyword: e.target.value })}
                      style={{ width: 120 }}
                    />
                    <Select
                      size="small"
                      placeholder={t('patientDevice.gender')}
                      value={patientFilter.gender || undefined}
                      onChange={v => setPatientFilter({ ...patientFilter, gender: v })}
                      allowClear
                      style={{ width: 80 }}
                      options={[{ value: 'M', label: t('patientDevice.male') }, { value: 'F', label: t('patientDevice.female') }]}
                    />
                    <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setPatientModal({ type: 'create', data: {} })}>{t('patientDevice.add')}</Button>
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
                        avatar={<Avatar style={{ background: '#2563eb' }}>{p.name?.slice(0, 1)}</Avatar>}
                        title={<span>{p.name} ({p.gender}, {p.age}{t('patientDevice.years')})</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {p.diagnosis || p.medicalHistory?.slice(0, 30) || t('patientDevice.noDiagnosis')}
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
                    <Button icon={<Edit3 size={12} />} onClick={() => setPatientModal({ type: 'update', data: { ...selectedPatient } })}>{t('patientDevice.edit')}</Button>
                  }
                >
                  <Descriptions column={3} size="small" bordered>
                    <Descriptions.Item label={t('patientDevice.gender')}>{selectedPatient.gender}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.age')}>{selectedPatient.age} {t('patientDevice.years')}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.phone')}>{selectedPatient.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.idCard')}>{selectedPatient.idCard || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.bloodType')}>{selectedPatient.bloodType || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.type')}>{selectedPatient.patientType || t('patientDevice.outpatient')}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.address')} span={3}>{selectedPatient.address || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.allergyHistory')} span={3}>{selectedPatient.allergyHistory || t('patientDevice.none')}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.medicalHistory')} span={3}>{selectedPatient.medicalHistory || t('patientDevice.none')}</Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: '8px 0' }} />

                  <Tabs
                    size="small"
                    items={[
                      { key: 'exams', label: <span><Stethoscope size={12} /> {t('patientDevice.exams')} ({patientExams.length})</span>, children: (
                        <Table size="small" dataSource={patientExams} rowKey="id" pagination={false}
                          columns={[
                            { title: t('patientDevice.colId'), dataIndex: 'id' },
                            { title: t('patientDevice.colModality'), dataIndex: 'modality' },
                            { title: t('patientDevice.colBodyPart'), dataIndex: 'bodyPart' },
                            { title: t('patientDevice.colStatus'), dataIndex: 'status' },
                            { title: t('patientDevice.colDate'), dataIndex: 'examAt' },
                          ]} 
                        scroll={{ x: 'max-content' }}/>
                      )},
                      { key: 'reports', label: <span><FileText size={12} /> {t('patientDevice.reports')} ({patientReports.length})</span>, children: (
                        <List size="small" dataSource={patientReports} renderItem={r => (
                          <List.Item>{r.id} - {r.modality} - {r.diagnosis}</List.Item>
                        )} />
                      )},
                      { key: 'timeline', label: <span><History size={12} /> {t('patientDevice.timeline')} ({patientTimeline.length})</span>, children: (
                        <Timeline items={(patientTimeline || []).slice(0, 10).map((e: any) => ({
                          children: <div><b>{e.eventType || e.type}</b>: {e.description || e.content} <span style={{ color: '#999' }}>· {e.date || e.timestamp}</span></div>,
                        }))} />
                      )},
                    ]}
                  />
                </Card>
              ) : <Card><Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('patientDevice.selectPatient')} /></Card>}
            </Col>
          </Row>
        </Tabs.TabPane>

        {/* 设备管理 */}
        <Tabs.TabPane tab={<span><Box size={14} /> {t('patientDevice.deviceMgmt')}</span>} key="devices">
          <Row gutter={16}>
            <Col span={10}>
              <Card
                title={`${t('patientDevice.deviceList')} (${filteredDevices.length})`}
                size="small"
                extra={
                  <Space>
                    <Select
                      size="small"
                      placeholder={t('patientDevice.colModality')}
                      value={deviceFilter.modality || undefined}
                      onChange={v => setDeviceFilter({ ...deviceFilter, modality: v })}
                      allowClear
                      style={{ width: 100 }}
                      options={['CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map(m => ({ value: m, label: m }))}
                    />
                    <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setDeviceModal({ type: 'create', data: {} })}>{t('patientDevice.add')}</Button>
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
                          const hR = await deviceApi.getMaintenanceDue();
                          setDeviceHistory(hR.data?.items ?? []);
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
                      <Button size="small" icon={<Wrench size={12} />} onClick={() => setDeviceModal({ type: 'maintain', data: selectedDevice })}>{t('patientDevice.maintain')}</Button>
                      <Button size="small" icon={<Edit3 size={12} />} onClick={() => setDeviceModal({ type: 'update', data: { ...selectedDevice } })}>{t('patientDevice.edit')}</Button>
                    </Space>
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}><Statistic title={t('patientDevice.monthlyScans')} value={selectedDevice.totalMonthlyScans || 0} /></Col>
                    <Col span={8}><Statistic title={t('patientDevice.utilization')} value={((selectedDevice.utilization || 0) * 100).toFixed(0)} suffix="%" /></Col>
                    <Col span={8}><Statistic title={t('patientDevice.assetValue')} value={((selectedDevice.totalValue || 0) / 10000).toFixed(1)} suffix={t('patientDevice.tenThousand')} /></Col>
                  </Row>
                  <Descriptions column={2} size="small" bordered style={{ marginTop: 12 }}>
                    <Descriptions.Item label={t('patientDevice.manufacturer')}>{selectedDevice.manufacturer || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.model')}>{selectedDevice.model || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.room')}>{selectedDevice.room || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.building')}>{selectedDevice.building || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.nextMaintenance')}>{selectedDevice.nextMaintenanceAt || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('patientDevice.responsible')}>{selectedDevice.responsibleEngineer || '-'}</Descriptions.Item>
                  </Descriptions>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('patientDevice.maintenanceHistory')} ({deviceHistory.length})</div>
                  <Timeline items={deviceHistory.slice(0, 5).map((h: any) => ({
                    children: <div>{h.lastMaintenance} - {h.name} - {h.remainingHours}h</div>,
                  }))} />
                </Card>
              ) : <Card><Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('patientDevice.selectDevice')} /></Card>}
            </Col>
          </Row>
        </Tabs.TabPane>
      </Tabs>

      {/* 患者 Modal */}
      <Modal
        title={patientModal.type === 'create' ? t('patientDevice.addPatient') : t('patientDevice.editPatient')}
        open={!!patientModal.type}
        onCancel={() => setPatientModal({ type: null, data: {} })}
        onOk={handlePatientSave}
        width={600}
      >
        <Form layout="vertical" size="small">
          <Row gutter={8}>
            <Col span={12}><Form.Item label={t('patientDevice.name')}><Input value={patientModal.data.name} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, name: e.target.value } })} /></Form.Item></Col>
            <Col span={6}><Form.Item label={t('patientDevice.gender')}><Select value={patientModal.data.gender} onChange={v => setPatientModal({ ...patientModal, data: { ...patientModal.data, gender: v } })} options={[{value:'M',label:t('patientDevice.male')},{value:'F',label:t('patientDevice.female')}]} /></Form.Item></Col>
            <Col span={6}><Form.Item label={t('patientDevice.age')}><InputNumber value={patientModal.data.age} onChange={v => setPatientModal({ ...patientModal, data: { ...patientModal.data, age: v } })} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label={t('patientDevice.phone')}><Input value={patientModal.data.phone} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, phone: e.target.value } })} /></Form.Item></Col>
            <Col span={12}><Form.Item label={t('patientDevice.bloodType')}><Select value={patientModal.data.bloodType} onChange={v => setPatientModal({ ...patientModal, data: { ...patientModal.data, bloodType: v } })} options={['A','B','AB','O'].map(b=>({value:b,label:b}))} /></Form.Item></Col>
            <Col span={24}><Form.Item label={t('patientDevice.address')}><Input value={patientModal.data.address} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, address: e.target.value } })} /></Form.Item></Col>
            <Col span={24}><Form.Item label={t('patientDevice.diagnosis')}><TextArea rows={2} value={patientModal.data.diagnosis} onChange={e => setPatientModal({ ...patientModal, data: { ...patientModal.data, diagnosis: e.target.value } })} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 设备维护 Modal */}
      <Modal
        title={t('patientDevice.triggerMaintenance')}
        open={deviceModal.type === 'maintain'}
        onCancel={() => setDeviceModal({ type: null, data: {} })}
        onOk={() => handleDeviceMaintain(deviceModal.data.id, '定期维护')}
        width={400}
      >
        <Alert title={t('patientDevice.maintenanceAlert')} type="info" showIcon style={{ marginBottom: 8 }} />
        <p>{t('patientDevice.device')}: {deviceModal.data.name} ({deviceModal.data.id})</p>
      </Modal>
    </div>
  );
};

export default PatientDeviceManagementPage;

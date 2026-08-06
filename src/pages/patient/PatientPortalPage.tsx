// [v3.0.6.11-35] 患者统一门户 - API接入版
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Row, Col, Statistic, Tabs, Timeline, Table, Spin, message } from 'antd';
import { User, Calendar, Clock } from 'lucide-react';
import { patientPortalApi, type PortalPatientDto, type PortalClinicalDataDto } from '../../services/api/patientPortalApi';
import { appointmentApi, type AppointmentDto } from '../../services/api/appointmentApi';

interface TimelineEvent {
  date: string;
  event: string;
  type: string;
  color: string;
}

interface NextAppointment {
  id?: string;
  date: string;
  dept: string;
  doctor: string;
  type: string;
}

export const PatientPortalPage: React.FC = () => {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PortalPatientDto | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [nextAppts, setNextAppts] = useState<NextAppointment[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [patientRes, clinicalRes, apptRes] = await Promise.allSettled([
          patientPortalApi.getPatient('P000001'),
          patientPortalApi.listClinicalData(),
          appointmentApi.list({ state: 'SCHEDULED' }),
        ]);

        if (patientRes.status === 'fulfilled' && patientRes.value.success) {
          const patients = patientRes.value.data;
          if (Array.isArray(patients) && patients.length > 0) {
            setPatient(patients[0]);
          }
        }

        if (clinicalRes.status === 'fulfilled' && clinicalRes.value.success) {
          const data = clinicalRes.value.data as PortalClinicalDataDto[];
          if (Array.isArray(data)) {
            setTimeline(data.map((d) => ({
              date: d.examDate || '',
              event: `${d.examType || ''} - ${d.bodyPart || ''} (${d.reportStatus || ''})`,
              type: (d.examType || '').includes('CT') || (d.examType || '').includes('MR') ? 'radiology' : 'dental',
              color: d.reportStatus === '已完成' ? 'green' : 'orange',
            })));
          }
        }

        if (apptRes.status === 'fulfilled' && apptRes.value.success) {
          const data = apptRes.value.data as AppointmentDto[];
          if (Array.isArray(data)) {
            setNextAppts(data.slice(0, 5).map((a) => ({
              id: a.id,
              date: a.startAt || '',
              dept: a.deviceName || '-',
              doctor: a.referringDoctor || '-',
              type: a.modality || '',
            })));
          }
        }
      } catch {
        message.error('加载患者数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const patientInfo = patient
    ? {
        name: patient.name || '-',
        age: patient.age ?? '-',
        gender: patient.gender || '-',
        phone: patient.phone || '-',
        bloodType: (patient as any).bloodType || '-',
        allergies: (patient as any).allergyHistory || '-',
      }
    : { name: '-', age: '-', gender: '-', phone: '-', bloodType: '-', allergies: '-' };

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <User size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>患者门户</span>
        <Tag color="cyan">v3.0.6.11-35</Tag>
      </Space>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}><Statistic title="姓名" value={patientInfo.name} prefix={<User size={14} />} /></Col>
          <Col span={3}><Statistic title="年龄" value={patientInfo.age} suffix="岁" /></Col>
          <Col span={3}><Statistic title="性别" value={patientInfo.gender} /></Col>
          <Col span={4}><Statistic title="血型" value={patientInfo.bloodType} /></Col>
          <Col span={4}><Statistic title="过敏" value={patientInfo.allergies} /></Col>
          <Col span={6}><Statistic title="电话" value={patientInfo.phone} /></Col>
        </Row>
      </Card>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key:'overview', label:'概览', children:
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title={<Space><Calendar size={14}/>近期预约</Space>}>
                <Table dataSource={nextAppts} rowKey={(r) => r.id || `${r.date}-${r.type}`} pagination={false}
                  columns={[{title:'时间',dataIndex:'date'},{title:'科室',dataIndex:'dept'},{title:'医生',dataIndex:'doctor'},{title:'类型',dataIndex:'type'}]} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={<Space><Clock size={14}/>最近动态</Space>}>
                <Timeline items={timeline.slice(0,4).map(t=>({color:t.color,children:<div>{t.date}<br/>{t.event}</div>}))} />
              </Card>
            </Col>
          </Row>
        },
        { key:'timeline', label:'完整时间线', children:
          <Timeline mode="left" items={timeline.map(t=>({
            color:t.color,
            label: t.date,
            children: <div><Tag color={t.type==='radiology'?'blue':'green'}>{t.type==='radiology'?'放射科':'口腔科'}</Tag>{t.event}</div>,
          }))} />
        },
      ]} />
    </div>
  );
};
export default PatientPortalPage;

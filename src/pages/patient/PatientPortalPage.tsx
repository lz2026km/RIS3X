// [v3.0.6.11-35] 患者统一门户 - API接入版 · [W8] i18n + 刷新/搜索/分页整改
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Row, Col, Tabs, Timeline, Table, Spin, message, Empty, Input } from 'antd';
import { User, Calendar, Clock, RefreshCw } from 'lucide-react';
import { t } from '../../i18n/appI18n';
import { ActionButton } from '../../components/common/ActionButton';
import { ExportButton } from '../../components/common';
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
  const [keyword, setKeyword] = useState('');

  const fetchData = useCallback(async () => {
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
          setNextAppts(data.slice(0, 10).map((a) => ({
            id: a.id,
            date: a.startAt || '',
            dept: a.deviceName || '-',
            doctor: a.referringDoctor || '-',
            type: a.modality || '',
          })));
        }
      }
    } catch {
      message.error(t('w8.patientPortal.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const filteredAppts = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return nextAppts;
    return nextAppts.filter((a) =>
      [a.date, a.dept, a.doctor, a.type].some((v) => (v || '').toLowerCase().includes(kw))
    );
  }, [nextAppts, keyword]);

  if (loading) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip={t('w8.patientPortal.loading')} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <User size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('w8.patientPortal.title')}</span>
        <Tag color="cyan">v3.0.6.11-35</Tag>
        <ActionButton action="refresh" loading={loading} onClick={fetchData} icon={<RefreshCw size={14} />}>
          {t('w8.patientPortal.refresh')}
        </ActionButton>
        <ExportButton
          data={() => [...filteredAppts, ...timeline]}
          filename="patient-portal"
          label={t('w45.actions.export')}
          size="small"
          formats={["csv", "json"]}
        />
      </Space>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w8.patientPortal.colName')}</span><div style={{ fontSize: 18, fontWeight: 700 }}>{patientInfo.name}</div></Col>
          <Col span={3}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w8.patientPortal.colAge')}</span><div style={{ fontSize: 18, fontWeight: 700 }}>{patientInfo.age}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>{t('w8.patientPortal.yearSuffix')}</span></div></Col>
          <Col span={3}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w8.patientPortal.colGender')}</span><div style={{ fontSize: 18, fontWeight: 700 }}>{patientInfo.gender}</div></Col>
          <Col span={4}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w8.patientPortal.colBloodType')}</span><div style={{ fontSize: 18, fontWeight: 700 }}>{patientInfo.bloodType}</div></Col>
          <Col span={4}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w8.patientPortal.colAllergy')}</span><div style={{ fontSize: 18, fontWeight: 700 }}>{patientInfo.allergies}</div></Col>
          <Col span={6}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w8.patientPortal.colPhone')}</span><div style={{ fontSize: 18, fontWeight: 700 }}>{patientInfo.phone}</div></Col>
        </Row>
      </Card>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key:'overview', label:t('w8.patientPortal.tabOverview'), children:
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title={<Space><Calendar size={14}/>{t('w8.patientPortal.recentAppointments')}</Space>} extra={
                <Input.Search allowClear size="small" placeholder={t('w8.patientPortal.searchAppointment')} style={{ width: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              }>
                <Table dataSource={filteredAppts} rowKey={(r) => r.id || `${r.date}-${r.type}`} pagination={{ pageSize: 5, showSizeChanger: false }} scroll={{ x: 'max-content' }}
                  locale={{ emptyText: <Empty description={t('w8.patientPortal.emptyAppointments')} /> }}
                  columns={[{title:t('w8.patientPortal.colTime'),dataIndex:'date'},{title:t('w8.patientPortal.colDept'),dataIndex:'dept'},{title:t('w8.patientPortal.colDoctor'),dataIndex:'doctor'},{title:t('w8.patientPortal.colType'),dataIndex:'type'}]} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={<Space><Clock size={14}/>{t('w8.patientPortal.recentTimeline')}</Space>}>
                <Timeline items={timeline.slice(0,4).map(ev=>({color:ev.color,children:<div>{ev.date}<br/>{ev.event}</div>}))} />
              </Card>
            </Col>
          </Row>
        },
        { key:'timeline', label:t('w8.patientPortal.tabTimeline'), children:
          <Timeline mode="left" items={timeline.map(ev=>({
            color:ev.color,
            label: ev.date,
            children: <div><Tag color={ev.type==='radiology'?'blue':'green'}>{ev.type==='radiology'?t('w8.patientPortal.radiology'):t('w8.patientPortal.dental')}</Tag>{ev.event}</div>,
          }))} />
        },
      ]} />
    </div>
  );
};
export default PatientPortalPage;

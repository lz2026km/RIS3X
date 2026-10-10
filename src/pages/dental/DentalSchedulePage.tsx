// [v3.0.6.8-103] Phase 4: 牙椅预约排班 + PSR 牙周记录 (修复: 新建预约实际提交)
// 对标: 领健·牙医管家
import dayjs from 'dayjs';
import { dentalApi } from '@/services/api/dentalApi';
import { ErrorBanner } from '@/components/feedback';
import { t } from '@/i18n/appI18n';
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  message,
  Tabs,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Badge,
  Empty,
  Segmented,
  Descriptions,
  Spin,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { Calendar, User, Armchair, Plus, CheckCircle2, Eye } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from 'react';
import { usePagination } from '@/hooks/usePagination';

const TIME_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];
const APPT_TYPES = [
  { value: '初诊', labelKey: 'w9d.apptType.initial' },
  { value: '复诊', labelKey: 'w9d.apptType.followup' },
  { value: '治疗', labelKey: 'w9d.apptType.treatment' },
  { value: '复查', labelKey: 'w9d.apptType.review' },
  { value: '洁牙', labelKey: 'w9d.apptType.scaling' },
  { value: '种植', labelKey: 'w9d.apptType.implant' },
  { value: '正畸', labelKey: 'w9d.apptType.ortho' },
];

const apptStatusLabel = (s: string): string =>
  s === 'scheduled' ? t('dentalSchedule.statusScheduled')
    : s === 'in-progress' ? t('dentalSchedule.statusInProgress')
      : s === 'completed' ? t('dentalSchedule.statusCompleted')
        : s === 'cancelled' ? t('dentalSchedule.statusCancelled')
          : s === 'no-show' ? t('dentalSchedule.statusNoShow')
            : s;

export const DentalSchedulePage: React.FC = () => {
  const [tab, setTab] = useState('schedule');
  const [chairs, setChairs] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [dentists, setDentists] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedChair, setSelectedChair] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [psrSaving, setPsrSaving] = useState(false);
  // [G005 2B] 默认患者: 用已加载 patients 列表首条 (加载完成后回填, 不再写死 P100001)
  const [psrRec, setPsrRec] = useState({ patientId: '', quadrant: 1, probingDepths: [2,2,2,2,2,2], bleeding: [false,false,false,false,false,false], mobility: 0, psrCode: 1, note: '' });
  // [G005 Wave1B] 历史 PSR 记录: dentalApi.listPsrRecords (GET /dental/chart/:patientId/psr)
  const [psrHistory, setPsrHistory] = useState<any[]>([]);
  const [psrLoading, setPsrLoading] = useState(false);
  // [G005 W3-B] 排班单条预约详情: GET /dental/schedule/appointments/:id (getScheduleAppointment)
  const [apptDetail, setApptDetail] = useState<any>(null);
  const [apptDetailLoading, setApptDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const handleShowApptDetail = async (id: string) => {
    setApptDetailLoading(true);
    try {
      const res = await dentalApi.getScheduleAppointment(id);
      if (res.success && res.data) {
        setApptDetail(res.data);
      } else {
        message.warning(res.error?.message ?? t('dentalSchedule.detailLoadFailed'));
        setApptDetail(appts.find((a) => a.id === id) ?? null);
      }
    } catch {
      setApptDetail(appts.find((a) => a.id === id) ?? null);
    } finally {
      setApptDetailLoading(false);
    }
  };

  const fetchData = async () => {
    setLoadError(null);
    try {
      const [c, a, s, p, d] = await Promise.all([
        dentalApi.getScheduleChairs().catch((err) => { console.error('[F04]', err); return { success: false, data: [] }; }),
        dentalApi.getScheduleAppointments(selectedDate).catch((err) => { console.error('[F04]', err); return { success: false, data: [] }; }),
        dentalApi.getScheduleStats().catch((err) => { console.error('[F04]', err); return { success: false, data: null }; }),
        dentalApi.listPatients().catch((err) => { console.error('[F04]', err); return { success: false, data: [] }; }),
        dentalApi.listDentists().catch((err) => { console.error('[F04]', err); return { success: false, data: [] }; }),
      ]);
      setChairs(c.data || []);
      setAppts(a.data || []);
      setStats(s.data);
      if (p.success && Array.isArray(p.data)) {
        const opts = p.data.map((pt: any) => ({ value: pt.id || pt.patientId, label: `${pt.name} (${pt.id || pt.patientId})` }));
        setPatients(opts);
        // [G005 2B] 未手动选择时用首条患者作默认 (真实数据, 不再回退硬编码 3 人)
        setPsrRec(prev => (prev.patientId || opts.length === 0) ? prev : { ...prev, patientId: opts[0]?.value ?? '' });
      }
      if (d.success && Array.isArray(d.data)) {
        setDentists(d.data.map((dt: any) => ({ value: dt.name || dt.id, label: dt.name || dt.id })));
      }
      if (!c.success && !a.success && !s.success) setLoadError(t('w9.states.error'));
    } catch (e) { console.error('[F04]', e); setLoadError(t('w9.states.error')); }
  };

  useEffect(() => { fetchData(); }, [selectedDate, reloadTick]);

  // [G005 Wave1B] 加载历史 PSR 记录 (切换患者时刷新; 患者未加载完成时跳过, 避免 /chart//psr 空路由)
  useEffect(() => {
    if (!psrRec.patientId) {
      setPsrHistory([]);
      setPsrLoading(false);
      return;
    }
    let cancelled = false;
    setPsrLoading(true);
    void dentalApi.listPsrRecords(psrRec.patientId).then((res: any) => {
      if (cancelled) return;
      if (res.success && Array.isArray(res.data)) setPsrHistory(res.data);
    }).catch(() => { if (!cancelled) setPsrHistory([]); }).finally(() => { if (!cancelled) setPsrLoading(false); });
    return () => { cancelled = true; };
  }, [psrRec.patientId]);

  const filtered = selectedChair === 'all' ? appts : appts.filter(a => a.chairId === selectedChair);
  // [G005 2B] 受控分页: 排班看板预约表 (数据可增长)
  const { pageData: pagedFiltered, pagination: filteredPagination } = usePagination(filtered, 10);

  const chairColors: Record<string, string> = { 'online': '#52c41a', 'offline': '#ff4d4f', 'maintenance': '#faad14' };

  const handleCreateAppt = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // [v3.0.6.11-88 Round10] raw fetch → dentalApi.createScheduleAppointment (后端 POST /dental/schedule/appointments 真实存在)
      const res = await dentalApi.createScheduleAppointment({
        ...values,
        date: values.date?.format?.('YYYY-MM-DD') || selectedDate,
        status: 'scheduled',
      });
      if (res.success) {
        message.success(t('dentalSchedule.apptCreated'));
        form.resetFields();
        setCreateModal(false);
        await fetchData();
      } else {
        message.error(`${t('dentalSchedule.createFailed')}: ${res.error?.message || t('dentalSchedule.unknownError')}`);
      }
    } catch (e) { console.error('[F04]', e); }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      // [G005 Wave1B] 排班状态流转: dentalApi.updateScheduleAppointmentStatus (POST /dental/schedule/appointments/:id/status)
      const res = await dentalApi.updateScheduleAppointmentStatus(id, status);
      if (res.success) {
        message.success(status === 'in-progress' ? t('dentalSchedule.started') : t('dentalSchedule.cancelled'));
        await fetchData();
      } else {
        message.warning(res.error?.message ?? t('dentalSchedule.statusUpdateFailed'));
      }
    } catch { /* ignore */ }
  };

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Calendar size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalSchedule.pageTitle')}</span>
        <Tag color="cyan">v3.0.6.8-103</Tag>
        <Tag color="blue">{t('dentalSchedule.benchmarkTag')}</Tag>
      </Space>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      <StatCardGrid minWidth={180} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('dentalSchedule.statToday')} value={stats?.todayAppointments || 0} icon={<Calendar size={16} />} />
        <StatCard title={t('dentalSchedule.statCompleted')} value={stats?.completed || 0} color="success" />
        <StatCard title={t('dentalSchedule.statInProgress')} value={stats?.inProgress || 0} color="warning" />
        <StatCard title={t('dentalSchedule.statNoShow')} value={stats?.noShow || 0} color="error" />
        <StatCard title={t('dentalSchedule.statChairUsage')} value={Math.round((stats?.chairUtilization||0)*100)} suffix="%" />
        <StatCard title={t('dentalSchedule.statAvgWait')} value={stats?.avgWaitTime || 0} suffix="min" />
      </StatCardGrid>
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <DatePicker value={dayjs(selectedDate)} placeholder={t('dentalSchedule.selectDate')} onChange={d => d && setSelectedDate(d.format('YYYY-MM-DD'))} style={{width: 200}} />
      </div>
      <Row gutter={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
        {chairs.map((c: any) => (
          <Col span={4} key={c.id}>
            <Card size="small" hoverable onClick={() => setSelectedChair(c.id)}
              style={{ cursor:'pointer', borderColor: selectedChair === c.id ? 'var(--color-primary-600)' : '#d9d9d9', borderLeft: `4px solid ${chairColors[c.status] || '#999'}` }}>
              <Space><Armchair size={14}/><span style={{fontSize:12}}>{c.name}</span></Space>
              <Tag style={{fontSize:10,margin:0}} color={chairColors[c.status]}>{({online:t('dentalSchedule.chairOnline'), offline:t('dentalSchedule.chairOffline'), maintenance:t('dentalSchedule.chairMaintenance')} as any)[c.status] || c.status}</Tag>
            </Card>
          </Col>
        ))}
        <Col span={4}><Card size="small" hoverable onClick={() => setSelectedChair('all')} style={{cursor:'pointer',borderColor:selectedChair==='all'?'var(--color-primary-600)':'#d9d9d9'}}><Space><User size={14}/><span>{t('dentalSchedule.all')}</span></Space><div style={{fontSize:11,color:'var(--text-secondary)',marginTop:'var(--space-1, 4px)'}}>{t('dentalSchedule.totalPrefix')} {appts.length} {t('dentalSchedule.apptUnit')}</div></Card></Col>
      </Row>
      <Tabs activeKey={tab} onChange={setTab} items={[
        {key:'schedule', label:t('dentalSchedule.tabSchedule'), children:<>
          <Button type="primary" icon={<Plus size={14}/>} style={{marginBottom:'var(--space-2, 8px)'}} onClick={()=>setCreateModal(true)}>{t('dentalSchedule.newAppt')}</Button>
          {filtered.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dentalSchedule.noApptToday')} /> : (
            <DataTable dataSource={pagedFiltered} rowKey="id" pagination={filteredPagination}
              columns={[
                {title:t('dentalSchedule.colTime'),dataIndex:'time',width:70,render:(tv:string)=><Tag color="geekblue">{tv}</Tag>,fixed:'left'},
                {title:t('dentalSchedule.colPatient'),dataIndex:'patientName',width:100},
                {title:t('dentalSchedule.colChair'),dataIndex:'chairName',width:150,render:(n:string)=><Tag color="purple">{n}</Tag>},
                {title:t('dentalSchedule.colDentist'),dataIndex:'dentist',width:80},
                {title:t('dentalSchedule.colType'),dataIndex:'type',width:60,render:(tv:string)=><Tag>{tv}</Tag>},
                {title:t('dentalSchedule.colStatus'),dataIndex:'status',render:(s:string)=><Badge status={s==='completed'?'success':s==='in-progress'?'processing':s==='scheduled'?'default':s==='no-show'?'error':'default'} text={apptStatusLabel(s)} />,width:90},
                {title:t('dentalSchedule.colActions'),render:(_,r:any)=><Space>
                  <Button size="small" icon={<CheckCircle2 size={10}/>} disabled={r.status!=='scheduled'} onClick={()=>handleUpdateStatus(r.id,'in-progress')}>{t('dentalSchedule.arrived')}</Button>
                  <Button size="small" icon={null} disabled={r.status!=='scheduled'} onClick={()=>handleUpdateStatus(r.id,'cancelled')}>{t('dentalSchedule.cancelBtn')}</Button>
                  <Button size="small" icon={<Eye size={10}/>} onClick={()=>void handleShowApptDetail(r.id)}>{t("w3b.detail")}</Button>
                </Space>},
              ]} 
            scroll={{ x: 'max-content' }}/>
          )}
        </>},
        {key:'psr', label:t('dentalSchedule.tabPsr'), children:<>
          <Row gutter={12}>
            <Col span={10}>
              <Card size="small" title={t('dentalSchedule.psrCardTitle')}>


                <Form layout="vertical" size="small">
                  <Form.Item label={t('dentalSchedule.colPatient')}><Select value={psrRec.patientId} onChange={v=>setPsrRec({...psrRec,patientId:v})} options={patients} placeholder={t('dentalSchedule.selectPatient')} /></Form.Item>
                  <Form.Item label={t('dentalSchedule.quadrant')}><Segmented value={psrRec.quadrant} onChange={v=>setPsrRec({...psrRec,quadrant:v as number})} options={[{value:1,label:t('dentalSchedule.quadrantRU')},{value:2,label:t('dentalSchedule.quadrantLU')},{value:3,label:t('dentalSchedule.quadrantLL')},{value:4,label:t('dentalSchedule.quadrantRL')}]} /></Form.Item>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:'var(--space-1, 4px)'}}>{t('dentalSchedule.probingDepth')}</div>
                  <Row gutter={4}>
                    {[0,1,2,3,4,5].map(i => (
                      <Col span={4} key={i}>
                        <InputNumber
                          size="small"
                          min={0}
                          max={15}
                          value={psrRec.probingDepths[i]}
                          onChange={v => { const d = [...psrRec.probingDepths]; d[i] = v || 0; setPsrRec({...psrRec, probingDepths: d }); }}
                          style={{ width: '100%' }}
                        />
                      </Col>
                    ))}
                  </Row>
                  <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:'var(--space-1, 4px)'}}>{t('dentalSchedule.probingNote')}</div>
                  <Form.Item label={t('dentalSchedule.mobility')} style={{marginTop:'var(--space-2, 8px)'}}><Select value={psrRec.mobility} onChange={v=>setPsrRec({...psrRec,mobility:v})} options={[{value:0,label:t('dentalSchedule.mobility0')},{value:1,label:t('dentalSchedule.mobility1')},{value:2,label:t('dentalSchedule.mobility2')},{value:3,label:t('dentalSchedule.mobility3')}]} /></Form.Item>
                  <Form.Item label={t('dentalSchedule.psrCode')}><Select value={psrRec.psrCode} onChange={v=>setPsrRec({...psrRec,psrCode:v})} options={[{value:0,label:t('dentalSchedule.psr0')},{value:1,label:t('dentalSchedule.psr1')},{value:2,label:t('dentalSchedule.psr2')},{value:3,label:t('dentalSchedule.psr3')},{value:4,label:t('dentalSchedule.psr4')}]} /></Form.Item>
                  <Form.Item label={t('dentalSchedule.note')}><Input.TextArea value={psrRec.note} onChange={e=>setPsrRec({...psrRec,note:e.target.value})} rows={2} /></Form.Item>
                  <Button type="primary" block loading={psrSaving} onClick={async()=>{
                    setPsrSaving(true);
                    try {
                      // [G005 Wave1B] 保存 PSR: dentalApi.savePsrRecord (POST /dental/chart/:patientId/psr)
                      const res = await dentalApi.savePsrRecord(psrRec.patientId, psrRec);
                      if (res.success) {
                        message.success(t('dentalSchedule.psrSaved'));
                        const list = await dentalApi.listPsrRecords(psrRec.patientId);
                        if (list.success && Array.isArray(list.data)) setPsrHistory(list.data);
                      } else {
                        message.error(`${t('dentalSchedule.saveFailed')}: ${res.error?.message || t('dentalSchedule.unknownError')}`);
                      }
                    } catch (e) {
                      console.error('[F04]', e);
                      message.error(t('dentalSchedule.saveRetry'));
                    } finally {
                      setPsrSaving(false);
                    }
                  }}>{t('dentalSchedule.savePsr')}</Button>
                </Form>
              </Card>
            </Col>
            <Col span={14}>
              <Card size="small" title={<Space>{t('dentalSchedule.psrHistory')}</Space>}>
                {psrLoading ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalSchedule.loading')} />
                ) : psrHistory.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dentalSchedule.noPsr')} />
                ) : (
                  psrHistory.map((rec: any, i: number) => (
                    <Card key={rec.id || i} size="small" style={{ marginBottom: 'var(--space-1, 4px)' }} title={`${t('dentalSchedule.quadrant')} ${rec.quadrant ?? '-'} · ${rec.patientId ?? ''}`}>
                      <Space wrap>
                        <Tag color="blue">{t('dentalSchedule.psrScore')}: {rec.psrCode ?? '-'}</Tag>
                        <Tag color="orange">{t('dentalSchedule.probingLabel')}: {Array.isArray(rec.probingDepths) ? `${Math.min(...rec.probingDepths)}-${Math.max(...rec.probingDepths)}mm` : '-'}</Tag>
                        <Tag>{t('dentalSchedule.mobilityLabel')} {(rec.mobility ?? 0) + '°'}</Tag>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{String(rec.createdAt ?? rec.recordedAt ?? '').replace('T', ' ').slice(0, 16) || '—'}</span>
                      </Space>
                      {Array.isArray(rec.probingDepths) && (
                        <div style={{ marginTop: 'var(--space-1, 4px)', fontSize: 11, color: 'var(--text-secondary)' }}>{t('dentalSchedule.sixPoints')}: {rec.probingDepths.join('-')}mm {rec.note ? `| ${rec.note}` : ''}</div>
                      )}
                    </Card>
                  ))
                )}
              </Card>
            </Col>
          </Row>
        </>},
      ]} />
      <Modal title={t('dentalSchedule.newAppt')} open={createModal} onCancel={()=>{setCreateModal(false);form.resetFields();}} onOk={handleCreateAppt} confirmLoading={submitting} width={560}>
        <Form form={form} layout="vertical" size="small" initialValues={{ date: null, time: '09:00', type: '初诊', dentist: '王医生', chairId: undefined, patientId: undefined }}>
          <Form.Item label={t('dentalSchedule.colPatient')} name="patientId" rules={[{ required: true, message: t('dentalSchedule.selectPatientRequired') }]}>
            <Select options={patients} placeholder={t('dentalSchedule.selectPatient')} />
          </Form.Item>
          <Form.Item label={t('dentalSchedule.date')} name="date" rules={[{ required: true, message: t('dentalSchedule.selectDateRequired') }]}>
            <DatePicker style={{ width: '100%' }} placeholder={t('dentalSchedule.selectApptDate')} />
          </Form.Item>
          <Form.Item label={t('dentalSchedule.colTime')} name="time" rules={[{ required: true }]}>
            <Select options={TIME_SLOTS.map(tv => ({ value: tv, label: tv }))} />
          </Form.Item>
          <Form.Item label={t('dentalSchedule.colChair')} name="chairId" rules={[{ required: true, message: t('dentalSchedule.selectChairRequired') }]}>
            <Select options={chairs.map((c:any) => ({ value: c.id, label: c.name }))} placeholder={t('dentalSchedule.selectChair')} />
          </Form.Item>
          <Form.Item label={t('dentalSchedule.colDentist')} name="dentist" rules={[{ required: true }]}>
            <Select options={dentists} />
          </Form.Item>
          <Form.Item label={t('dentalSchedule.colType')} name="type" rules={[{ required: true }]}>
            <Select options={APPT_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
          </Form.Item>
        </Form>
      </Modal>
      {/* [G005 W3-B] 排班单条预约详情 Modal: getScheduleAppointment (GET /dental/schedule/appointments/:id) */}
      <Modal
        title={`${t("w3b.scheduleDetail")} - ${apptDetail?.patientName ?? ''}`}
        open={!!apptDetail}
        onCancel={() => setApptDetail(null)}
        footer={<Button onClick={() => setApptDetail(null)}>{t("w3b.close")}</Button>}
        width={560}
      >
        <Spin spinning={apptDetailLoading}>
          {apptDetail && (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label={t('dentalSchedule.colPatient')} span={2}>{apptDetail.patientName} ({apptDetail.patientId || apptDetail.patient?.id || '-'})</Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.date')}>{apptDetail.date || apptDetail.appointmentDate || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.colTime')}>{apptDetail.time || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.colChair')}>{apptDetail.chairName || apptDetail.chair?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.colDentist')}>{apptDetail.dentist || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.colType')}>{apptDetail.type || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.colStatus')}><Badge status={apptDetail.status === 'completed' ? 'success' : apptDetail.status === 'in-progress' ? 'processing' : apptDetail.status === 'no-show' ? 'error' : 'default'} text={apptStatusLabel(apptDetail.status ?? '') || '-'} /></Descriptions.Item>
              <Descriptions.Item label={t('dentalSchedule.note')} span={2}>{apptDetail.note || apptDetail.notes || '-'}</Descriptions.Item>
            </Descriptions>
          )}
        </Spin>
      </Modal>
    </PageContainer>
  );
};
export default DentalSchedulePage;

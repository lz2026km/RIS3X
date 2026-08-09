// [v3.0.6.8-103] Phase 4: 牙椅预约排班 + PSR 牙周记录 (修复: 新建预约实际提交)
// 对标: 领健·牙医管家
import dayjs from 'dayjs';
import { dentalApi } from '@/services/api/dentalApi';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, Tabs, Table, Modal, Form, Input, InputNumber, DatePicker, Badge, Empty, Segmented } from 'antd';
import { Calendar, User, Armchair, Plus, CheckCircle2 } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from 'react';
import { usePagination } from '@/hooks/usePagination';

const TIME_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];
const APPT_TYPES = [
  { value: '初诊', label: '初诊' },
  { value: '复诊', label: '复诊' },
  { value: '治疗', label: '治疗' },
  { value: '复查', label: '复查' },
  { value: '洁牙', label: '洁牙' },
  { value: '种植', label: '种植' },
  { value: '正畸', label: '正畸' },
];

export const DENTAL_APPT_STATUS_LABELS_DICT: Record<string, string> = { scheduled: '已预约', 'in-progress': '进行中', completed: '已完成', cancelled: '已取消', 'no-show': '未到诊' };

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
  const [psrRec, setPsrRec] = useState({ patientId: 'P100001', quadrant: 1, probingDepths: [2,2,2,2,2,2], bleeding: [false,false,false,false,false,false], mobility: 0, psrCode: 1, note: '' });
  // [G005 Wave1B] 历史 PSR 记录: dentalApi.listPsrRecords (GET /dental/chart/:patientId/psr)
  const [psrHistory, setPsrHistory] = useState<any[]>([]);
  const [psrLoading, setPsrLoading] = useState(false);

  const fetchData = async () => {
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
        setPatients(p.data.map((pt: any) => ({ value: pt.id || pt.patientId, label: `${pt.name} (${pt.id || pt.patientId})` })));
      }
      if (d.success && Array.isArray(d.data)) {
        setDentists(d.data.map((dt: any) => ({ value: dt.name || dt.id, label: dt.name || dt.id })));
      }
    } catch (e) { console.error('[F04]', e); }
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  // [G005 Wave1B] 加载历史 PSR 记录 (切换患者时刷新)
  useEffect(() => {
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
      const res = await fetch('/api/v1/dental/schedule/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          date: values.date?.format?.('YYYY-MM-DD') || selectedDate,
          status: 'scheduled',
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('预约已创建');
        form.resetFields();
        setCreateModal(false);
        await fetchData();
      } else {
        message.error('创建失败: ' + (data.error?.message || '未知错误'));
      }
    } catch (e) { console.error('[F04]', e); }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      // [G005 Wave1B] 排班状态流转: dentalApi.updateScheduleAppointmentStatus (POST /dental/schedule/appointments/:id/status)
      const res = await dentalApi.updateScheduleAppointmentStatus(id, status);
      if (res.success) {
        message.success(status === 'in-progress' ? '已开始' : '已取消');
        await fetchData();
      } else {
        message.warning(res.error?.message ?? '状态更新失败');
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Calendar size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>牙椅排班 · 牙周 PSR 记录</span>
        <Tag color="cyan">v3.0.6.8-103</Tag>
        <Tag color="blue">牙医管家 对标</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={3}><Card size="small"><Statistic title="今日预约" value={stats?.todayAppointments || 0} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="已完成" value={stats?.completed || 0} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="进行中" value={stats?.inProgress || 0} styles={{ content: { color:'#faad14' } }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="爽约" value={stats?.noShow || 0} styles={{ content: { color:'#ff4d4f' } }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="椅位利用率" value={Math.round((stats?.chairUtilization||0)*100)} suffix="%" /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="平均等待" value={stats?.avgWaitTime || 0} suffix="min" /></Card></Col>
        <Col span={6}><DatePicker value={dayjs(selectedDate)} placeholder="选择日期" onChange={d => d && setSelectedDate(d.format('YYYY-MM-DD'))} style={{width:'100%'}} /></Col>
      </Row>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {chairs.map((c: any) => (
          <Col span={4} key={c.id}>
            <Card size="small" hoverable onClick={() => setSelectedChair(c.id)}
              style={{ cursor:'pointer', borderColor: selectedChair === c.id ? '#2563eb' : '#d9d9d9', borderLeft: `4px solid ${chairColors[c.status] || '#999'}` }}>
              <Space><Armchair size={14}/><span style={{fontSize:13}}>{c.name}</span></Space>
              <Tag style={{fontSize:10,margin:0}} color={chairColors[c.status]}>{({online:'在线', offline:'离线', maintenance:'维护中'} as any)[c.status] || c.status}</Tag>
            </Card>
          </Col>
        ))}
        <Col span={4}><Card size="small" hoverable onClick={() => setSelectedChair('all')} style={{cursor:'pointer',borderColor:selectedChair==='all'?'#2563eb':'#d9d9d9'}}><Space><User size={14}/><span>全部</span></Space><div style={{fontSize:11,color:'var(--text-secondary)',marginTop:4}}>共 {appts.length} 预约</div></Card></Col>
      </Row>
      <Tabs activeKey={tab} onChange={setTab} items={[
        {key:'schedule', label:'排班看板', children:<>
          <Button type="primary" icon={<Plus size={14}/>} style={{marginBottom:8}} onClick={()=>setCreateModal(true)}>新建预约</Button>
          {filtered.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="当日暂无预约" /> : (
            <Table dataSource={pagedFiltered} rowKey="id" size="small" pagination={filteredPagination}
              columns={[
                {title:'时间',dataIndex:'time',width:70,render:(t:string)=><Tag color="geekblue">{t}</Tag>,fixed:'left'},
                {title:'患者',dataIndex:'patientName',width:100},
                {title:'牙椅',dataIndex:'chairName',width:150,render:(n:string)=><Tag color="purple">{n}</Tag>},
                {title:'医生',dataIndex:'dentist',width:80},
                {title:'类型',dataIndex:'type',width:60,render:(t:string)=><Tag>{t}</Tag>},
                {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='completed'?'success':s==='in-progress'?'processing':s==='scheduled'?'default':s==='no-show'?'error':'default'} text={DENTAL_APPT_STATUS_LABELS_DICT[s] || s} />,width:90},
                {title:'操作',render:(_,r:any)=><Space>
                  <Button size="small" icon={<CheckCircle2 size={10}/>} disabled={r.status!=='scheduled'} onClick={()=>handleUpdateStatus(r.id,'in-progress')}>到诊</Button>
                  <Button size="small" icon={null} disabled={r.status!=='scheduled'} onClick={()=>handleUpdateStatus(r.id,'cancelled')}>取消</Button>
                </Space>},
              ]} 
            scroll={{ x: 'max-content' }}/>
          )}
        </>},
        {key:'psr', label:'PSR 牙周记录', children:<>
          <Row gutter={12}>
            <Col span={10}>
              <Card size="small" title="PSR 6分位探诊记录">


                <Form layout="vertical" size="small">
                  <Form.Item label="患者"><Select value={psrRec.patientId} onChange={v=>setPsrRec({...psrRec,patientId:v})} options={[{value:'P100001',label:'张伟'},{value:'P100002',label:'李娜'},{value:'P100003',label:'王芳'}]} /></Form.Item>
                  <Form.Item label="象限"><Segmented value={psrRec.quadrant} onChange={v=>setPsrRec({...psrRec,quadrant:v as number})} options={[{value:1,label:'右上'},{value:2,label:'左上'},{value:3,label:'左下'},{value:4,label:'右下'}]} /></Form.Item>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>6点探诊深度 (mm)</div>
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
                  <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:4}}>六点探诊：DB（远中颊）、B（颊）、MB（近中颊）、ML（近中舌）、L（舌）、DL（远中舌）</div>
                  <Form.Item label="松动度" style={{marginTop:8}}><Select value={psrRec.mobility} onChange={v=>setPsrRec({...psrRec,mobility:v})} options={[{value:0,label:'0度正常'},{value:1,label:'I度小于1mm'},{value:2,label:'II度1-2mm'},{value:3,label:'III度大于2mm'}]} /></Form.Item>
                  <Form.Item label="PSR 编码"><Select value={psrRec.psrCode} onChange={v=>setPsrRec({...psrRec,psrCode:v})} options={[{value:0,label:'0:健康'},{value:1,label:'1:出血'},{value:2,label:'2:牙结石'},{value:3,label:'3:4-5mm'},{value:4,label:'4:大于6mm'}]} /></Form.Item>
                  <Form.Item label="备注"><Input.TextArea value={psrRec.note} onChange={e=>setPsrRec({...psrRec,note:e.target.value})} rows={2} /></Form.Item>
                  <Button type="primary" block loading={psrSaving} onClick={async()=>{
                    setPsrSaving(true);
                    try {
                      // [G005 Wave1B] 保存 PSR: dentalApi.savePsrRecord (POST /dental/chart/:patientId/psr)
                      const res = await dentalApi.savePsrRecord(psrRec.patientId, psrRec);
                      if (res.success) {
                        message.success('牙周记录已保存');
                        const list = await dentalApi.listPsrRecords(psrRec.patientId);
                        if (list.success && Array.isArray(list.data)) setPsrHistory(list.data);
                      } else {
                        message.error('保存失败: ' + (res.error?.message || '未知错误'));
                      }
                    } catch (e) {
                      console.error('[F04]', e);
                      message.error('保存失败，请重试');
                    } finally {
                      setPsrSaving(false);
                    }
                  }}>保存 PSR 记录</Button>
                </Form>
              </Card>
            </Col>
            <Col span={14}>
              <Card size="small" title={<Space>历史 PSR 记录 <Tag color="blue">listPsrRecords</Tag></Space>}>
                {psrLoading ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="加载中..." />
                ) : psrHistory.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无 PSR 记录" />
                ) : (
                  psrHistory.map((rec: any, i: number) => (
                    <Card key={rec.id || i} size="small" style={{ marginBottom: 4 }} title={`象限 ${rec.quadrant ?? '-'} · ${rec.patientId ?? ''}`}>
                      <Space wrap>
                        <Tag color="blue">PSR 评分: {rec.psrCode ?? '-'}</Tag>
                        <Tag color="orange">探诊: {Array.isArray(rec.probingDepths) ? `${Math.min(...rec.probingDepths)}-${Math.max(...rec.probingDepths)}mm` : '-'}</Tag>
                        <Tag>松动 {(rec.mobility ?? 0) + '°'}</Tag>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{String(rec.createdAt ?? rec.recordedAt ?? '').replace('T', ' ').slice(0, 16) || '—'}</span>
                      </Space>
                      {Array.isArray(rec.probingDepths) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>6点: {rec.probingDepths.join('-')}mm {rec.note ? `| ${rec.note}` : ''}</div>
                      )}
                    </Card>
                  ))
                )}
              </Card>
            </Col>
          </Row>
        </>},
      ]} />
      <Modal title="新建预约" open={createModal} onCancel={()=>{setCreateModal(false);form.resetFields();}} onOk={handleCreateAppt} confirmLoading={submitting} width={520}>
        <Form form={form} layout="vertical" size="small" initialValues={{ date: null, time: '09:00', type: '初诊', dentist: '王医生', chairId: undefined, patientId: undefined }}>
          <Form.Item label="患者" name="patientId" rules={[{ required: true, message: '请选择患者' }]}>
            <Select options={patients} placeholder="选择患者" />
          </Form.Item>
          <Form.Item label="日期" name="date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} placeholder="选择预约日期" />
          </Form.Item>
          <Form.Item label="时间" name="time" rules={[{ required: true }]}>
            <Select options={TIME_SLOTS.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item label="牙椅" name="chairId" rules={[{ required: true, message: '请选择牙椅' }]}>
            <Select options={chairs.map((c:any) => ({ value: c.id, label: c.name }))} placeholder="选择牙椅" />
          </Form.Item>
          <Form.Item label="医生" name="dentist" rules={[{ required: true }]}>
            <Select options={dentists} />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true }]}>
            <Select options={APPT_TYPES} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default DentalSchedulePage;

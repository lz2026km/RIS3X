// [v3.0.6.8-94] Phase 4: 口腔 360° 患者视图
// 对标: 领健·牙医管家 患者档案
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Select, Row, Col, Statistic, Tabs, Table, List, Timeline, Badge, Descriptions, Avatar, Spin, Button, Modal, Form, Input, message } from 'antd';
import { Activity, Phone, Calendar, Clock, DollarSign, FileText, Pill, AlertTriangle, History, Eye, Plus } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';
import { t } from '../../i18n/appI18n';
import { usePagination } from '../../hooks/usePagination';

export const DentalEmrPage: React.FC = () => {
  const [patients, setPatients] = useState([
    { id: 'P100001', name: '张伟' }, { id: 'P100002', name: '李娜' }, { id: 'P100003', name: '王芳' },
  ]);
  const [selectedId, setSelectedId] = useState('P100001');
  const [overview, setOverview] = useState<any>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [recalls, setRecalls] = useState<any[]>([]);
  const [tab, setTab] = useState('overview');
  const [_busy, setBusy] = useState(false);
  // [v3.0.6.11-96 Wave2A P0] 数据源标注: 后端 overview 7 端点成功 → api, 失败回退演示数据 → mock
  const [emrSource, setEmrSource] = useState<'api' | 'mock'>('mock');
  // [G005 Wave1B] 影像 Tab: dentalApi.listPanoramic / listPeriapical (全景 + 根尖片)
  const [panoImages, setPanoImages] = useState<any[]>([]);
  const [periaImages, setPeriaImages] = useState<any[]>([]);
  const [imgLoading, setImgLoading] = useState(false);
  // [G005 Wave1A P1] 影像详情: getStudy / getPanoramic / getPeriapical / listBitewing
  const [bitewingImages, setBitewingImages] = useState<any[]>([]);
  const [imgDetail, setImgDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // [G005 W3-B] 预约登记/改期: POST /dental/appointments (createAppointment) + PUT /dental/appointments/:id (updateAppointment)
  const [apptCreateOpen, setApptCreateOpen] = useState(false);
  const [apptEditItem, setApptEditItem] = useState<any>(null);
  const [apptSaving, setApptSaving] = useState(false);
  const [apptForm] = Form.useForm();

  const DENTIST_OPTIONS = ['王医生', '李医生', '张医生', '赵医生'];

  const openApptCreate = () => {
    apptForm.setFieldsValue({ patientId: selectedId, dateTime: new Date().toISOString().slice(0, 16).replace('T', ' '), dentistId: DENTIST_OPTIONS[0], reason: '复诊', notes: '' });
    setApptCreateOpen(true);
  };

  const openApptEdit = (a: any) => {
    setApptEditItem(a);
    apptForm.setFieldsValue({
      dateTime: `${a.date ?? ''} ${a.time ?? ''}`.trim(),
      dentistId: a.dentist ?? DENTIST_OPTIONS[0],
      reason: a.type ?? a.description ?? '复诊',
      notes: a.description ?? '',
    });
  };

  const handleSaveAppt = async () => {
    try {
      const values = await apptForm.validateFields();
      setApptSaving(true);
      if (apptEditItem) {
        const res = await dentalApi.updateAppointment(apptEditItem.id, {
          dateTime: values.dateTime,
          dentistId: values.dentistId,
          reason: values.reason,
          notes: values.notes,
        });
        if (res.success) {
          message.success('预约已更新');
          setApptEditItem(null);
          void loadPatient(selectedId);
        } else {
          message.error(res.error?.message ?? '更新失败');
        }
      } else {
        const res = await dentalApi.createAppointment({
          patientId: values.patientId,
          dateTime: values.dateTime,
          dentistId: values.dentistId,
          reason: values.reason,
          notes: values.notes,
        });
        if (res.success) {
          message.success('预约已登记');
          setApptCreateOpen(false);
          apptForm.resetFields();
          void loadPatient(selectedId);
        } else {
          message.error(res.error?.message ?? '登记失败');
        }
      }
    } catch {
      // 表单校验失败
    } finally {
      setApptSaving(false);
    }
  };

  const loadImages = async () => {
    setImgLoading(true);
    try {
      const [pa, pe, bw] = await Promise.allSettled([
        dentalApi.listPanoramic(),
        dentalApi.listPeriapical(),
        dentalApi.listBitewing(),
      ]);
      if (pa.status === 'fulfilled' && Array.isArray(pa.value)) setPanoImages(pa.value);
      if (pe.status === 'fulfilled' && Array.isArray(pe.value)) setPeriaImages(pe.value);
      if (bw.status === 'fulfilled' && Array.isArray(bw.value)) setBitewingImages(bw.value);
    } catch { /* 演示回退: 保留空列表 */ }
    setImgLoading(false);
  };

  const openImageDetail = async (img: any) => {
    setImgDetail(img);
    setDetailLoading(true);
    try {
      const fetchers: Record<string, (id: string) => any> = {
        Panoramic: dentalApi.getPanoramic,
        Periapical: dentalApi.getPeriapical,
      };
      const fetcher = fetchers[img.modality] ?? dentalApi.getStudy;
      const res = await fetcher(img.id);
      if (res?.success && res.data) setImgDetail(res.data);
    } catch { /* 保留列表行数据 */ }
    setDetailLoading(false);
  };
  // [G005 2B] 受控分页: 治疗记录 / 预约 / 费用 / 影像 表
  const { pageData: pagedTreatments, pagination: treatmentsPagination } = usePagination(treatments, 10);
  const { pageData: pagedAppts, pagination: apptsPagination } = usePagination(appts, 10);
  const { pageData: pagedBills, pagination: billsPagination } = usePagination(bills, 10);
  const { pageData: pagedImages, pagination: imagesPagination } = usePagination([...panoImages, ...periaImages, ...bitewingImages], 10);

  useEffect(() => {
    if (tab === 'images' && panoImages.length === 0 && periaImages.length === 0) void loadImages();
  }, [tab]);

  // [W2-C] 接 dentalApi.listPatients 真实患者列表（失败时保留演示患者）
  useEffect(() => {
    let cancelled = false;
    void dentalApi.listPatients().then((res: any) => {
      if (cancelled) return;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setPatients(res.data.map((p: any) => ({ id: p.id ?? p.patientId, name: p.name ?? p.patientName })));
      }
    }).catch(() => { /* keep demo patients */ });
    return () => { cancelled = true; };
  }, []);

  const loadPatient = async (pid: string) => {
    setBusy(true);
    setSelectedId(pid);
    // [v3.0.6.11-96 Wave2A P0] 7 裸 fetch → dentalApi 封装 (双信封兼容); 任一失败保留旧数据并标注演示回退
    const [ov, tr, ap, bl, rx, co, re] = await Promise.allSettled([
      dentalApi.getPatientOverview(pid),
      dentalApi.getPatientTreatments(pid),
      dentalApi.getPatientAppointments(pid),
      dentalApi.getPatientBilling(pid),
      dentalApi.getPatientPrescriptions(pid),
      dentalApi.getPatientConsents(pid),
      dentalApi.getPatientRecalls(pid),
    ]);
    const dataOf = (r: PromiseSettledResult<any>): any => (r.status === 'fulfilled' && r.value?.success ? r.value.data : undefined);
    if (dataOf(ov)) {
      setOverview(dataOf(ov));
      setEmrSource('api');
    } else {
      setEmrSource('mock');
    }
    if (Array.isArray(dataOf(tr))) setTreatments(dataOf(tr));
    if (Array.isArray(dataOf(ap))) setAppts(dataOf(ap));
    if (Array.isArray(dataOf(bl))) setBills(dataOf(bl));
    if (Array.isArray(dataOf(rx))) setScripts(dataOf(rx));
    if (Array.isArray(dataOf(co))) setConsents(dataOf(co));
    if (Array.isArray(dataOf(re))) setRecalls(dataOf(re));
    setBusy(false);
  };

  useEffect(() => { loadPatient(selectedId); }, []);

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔 360° 患者视图</span>
        <Tag color="cyan">v3.0.6.8-94</Tag>
        <Tag color="blue">牙医管家 对标</Tag>
        <Tag color={emrSource === 'api' ? 'green' : 'orange'} title="后端 /dental/patients/:id/overview* 7 端点真实实现 (失败回退演示数据)">
          {emrSource === 'api' ? '真实数据' : '演示回退'}
        </Tag>
        <Select value={selectedId} onChange={loadPatient} style={{ width: 180 }} options={patients.map(p => ({ value: p.id, label: `${p.name} (${p.id})` }))} />
      </Space>
      {overview && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Space>
                  <Avatar size={40} style={{ backgroundColor: '#2563eb' }}>{overview.name[0]}</Avatar>
                  <div>
                    <div style={{ fontWeight: 600 }}>{overview.name} <Tag>{overview.gender === 'M' ? '男' : '女'}</Tag><Tag>{overview.age}岁</Tag></div>
                    <Space size={2}>
                      <Phone size={10} color="var(--text-secondary)" /><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{overview.phone}</span>
                    </Space>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col span={3}><Card size="small"><Statistic title="就诊次数" value={overview.totalVisits} prefix={<Calendar size={12}/>} /></Card></Col>
            <Col span={3}><Card size="small"><Statistic title="累计消费" prefix="¥" value={overview.totalSpent} /></Card></Col>
            <Col span={3}><Card size="small"><Statistic title="待缴费" prefix="¥" value={overview.summary?.unpaid || 0} styles={{ content: {  color: (overview.summary?.unpaid || 0) > 0 ? '#ff4d4f' : '#52c41a'  } }} /></Card></Col>
            <Col span={3}><Card size="small"><Statistic title="待复诊" value={overview.summary?.appointments || 0} styles={{ content: {  color: (overview.summary?.appointments || 0) > 0 ? '#faad14' : '#52c41a'  } }} /></Card></Col>
            <Col span={6}>
              <Card size="small">
                <Space wrap>
                  <Tag color={overview.allergies?.length > 0 ? 'red' : 'green'}>{overview.allergies?.length > 0 ? `过敏: ${overview.allergies.join(',')}` : '无过敏'}</Tag>
                  {overview.systemicDisease?.map((d: string) => <Tag key={d} color="orange">{d}</Tag>)}
                  {overview.tags?.map((t: string) => <Tag key={t} color="purple">{t}</Tag>)}
                </Space>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>首诊: {overview.firstVisit} | 主治: {overview.dentist}</div>
              </Card>
            </Col>
          </Row>
          <Card size="small" title={<Space><History size={14}/>完整档案</Space>}>
            <Tabs activeKey={tab} onChange={setTab} items={[
              {key:'overview', label:<span><Eye size={12}/>概览</span>, children:<>
                <Descriptions size="small" column={3}>
                  <Descriptions.Item label="姓名">{overview.name}</Descriptions.Item>
                  <Descriptions.Item label="性别">{overview.gender === 'M' ? '男' : '女'}</Descriptions.Item>
                  <Descriptions.Item label="年龄">{overview.age}岁</Descriptions.Item>
                  <Descriptions.Item label="手机">{overview.phone}</Descriptions.Item>
                  <Descriptions.Item label="医保">{overview.insuranceType}</Descriptions.Item>
                  <Descriptions.Item label="职业">{overview.occupation}</Descriptions.Item>
                  <Descriptions.Item label="地址" span={2}>{overview.address}</Descriptions.Item>
                  <Descriptions.Item label="过敏史">{overview.allergies?.join(',') || '无'}</Descriptions.Item>
                </Descriptions>
                <Timeline style={{marginTop:16}} items={treatments.slice(0,5).map((t:any)=>({color:t.type==='Implant'?'red':t.type==='Endodontic'?'orange':'blue',children:<><b>{t.date}</b> {t.description} <Tag>{t.type}</Tag> <Tag>¥{t.cost}</Tag></>}))} />
              </>},
              {key:'treatments', label:<span><FileText size={12}/>治疗记录 ({treatments.length})</span>, children:<Table dataSource={pagedTreatments} rowKey="id" size="small" pagination={treatmentsPagination}
                columns={[{title:'日期',dataIndex:'date',width:100},{title:'类型',dataIndex:'type',render:(t:string)=><Tag>{t}</Tag>,width:100},{title:'牙位',dataIndex:'toothNo',width:60,render:(t:number)=>t?<Tag color="blue">#{t}</Tag>:'全口'},{title:'描述',dataIndex:'description'},{title:'医生',dataIndex:'dentist'},{title:'费用',dataIndex:'cost',render:(v:number)=>`¥${v}`},{title:'自付',dataIndex:'patientPaid',render:(v:number)=>`¥${v}`,width:80}]} 
              scroll={{ x: 'max-content' }}/>},
              {key:'appointments', label:<span><Clock size={12}/>预约 ({appts.length})</span>, children:<>
                <div style={{ marginBottom: 8 }}>
                  <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openApptCreate}>{t("w3b.apptCreate")}</Button>
                </div>
                <Table dataSource={pagedAppts} rowKey="id" size="small" pagination={apptsPagination}
                columns={[{title:'日期',dataIndex:'date'},{title:'时间',dataIndex:'time'},{title:'类型',dataIndex:'type',render:(t:string)=><Tag>{t}</Tag>},{title:'内容',dataIndex:'description'},{title:'医生',dataIndex:'dentist'},{title:'牙椅',dataIndex:'chair'},{title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='completed'?'success':s==='scheduled'?'processing':'default'} text={({completed:'已完成',scheduled:'已预约',cancelled:'已取消'})[s] ?? s} />},{title:'操作',width:80,render:(_,r:any)=><Button size="small" type="link" onClick={()=>openApptEdit(r)}>{t("w3b.apptEdit")}</Button>}]} 
                scroll={{ x: 'max-content' }}/>
              </>},
              {key:'billing', label:<span><DollarSign size={12}/>费用 ({bills.length})</span>, children:<Table dataSource={pagedBills} rowKey="id" size="small" pagination={billsPagination}
                columns={[{title:'日期',dataIndex:'date'},{title:'项目',dataIndex:'items',render:(i:any[])=><>{i.map((x:any)=><Tag key={x.name}>{x.name}</Tag>)}</>},{title:'总金额',dataIndex:'total',render:(v:number)=>`¥${v}`},{title:'医保',dataIndex:'insurance',render:(v:number)=>`¥${v}`},{title:'自付',dataIndex:'selfPay',render:(v:number)=>`¥${v}`},{title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='paid'?'success':s==='partial'?'warning':'error'} text={({paid:'已支付',partial:'部分支付'})[s] ?? '欠费'} />}]} 
              scroll={{ x: 'max-content' }}/>},
              {key:'rx', label:<span><Pill size={12}/>处方 ({scripts.length})</span>, children:<List size="small" dataSource={scripts} renderItem={(rx:any)=><List.Item><List.Item.Meta title={<Space><Tag color="green">{rx.drug}</Tag><span>{rx.dosage}</span></Space>} description={<div style={{fontSize:12,color:'var(--text-secondary)'}}>{rx.date} | {rx.dentist} | {rx.note}</div>} /></List.Item>} />},
              {key:'consents', label:<span><FileText size={12}/>知情同意 ({consents.length})</span>, children:<List size="small" dataSource={consents} renderItem={(c:any)=><List.Item><List.Item.Meta title={<Space><Tag color={c.signed?'green':'orange'}>{c.type}</Tag><Badge status={c.signed?'success':'default'} text={c.signed?'已签署':'待签署'} /></Space>} description={<div style={{fontSize:12,color:'var(--text-secondary)'}}>{c.date} | {c.signedBy || '-'} | {c.witness || '-'}</div>} /></List.Item>} />},
              {key:'recalls', label:<span><AlertTriangle size={12}/>回访 ({recalls.length})</span>, children:<List size="small" dataSource={recalls} renderItem={(r:any)=><List.Item><List.Item.Meta title={<Space><Tag>{r.type}</Tag><span>{r.description}</span></Space>} description={<div style={{fontSize:12,color:'var(--text-secondary)'}}>{r.date} | 方式: {r.method} | <Badge status={r.sent?'success':'default'} text={r.sent?'已发送':'待发送'} /></div>} /></List.Item>} />},
              {key:'images', label:<span><Eye size={12}/>影像 ({panoImages.length + periaImages.length + bitewingImages.length})</span>, children:<Spin spinning={imgLoading}>
                <Table dataSource={pagedImages} rowKey="id" size="small" pagination={imagesPagination}
                  columns={[{title:'类型',dataIndex:'modality',width:100,render:(m:string)=><Tag color={m==='Panoramic'?'purple':m==='Bitewing'?'cyan':'blue'}>{({Panoramic:'全景片',Periapical:'根尖片',Bitewing:'咬合翼片'})[m] || m}</Tag>},{title:'患者',dataIndex:'patientName'},{title:'部位',dataIndex:'region',width:80},{title:'拍摄日期',dataIndex:'acquisitionDate',width:110,render:(v:string)=>v?.slice(0,10)},({title:'状态',dataIndex:'status',width:90,render:(s:string)=><Badge status={s==='reported'?'success':s==='reviewed'?'processing':'default'} text={({reported:'已报告',reviewed:'已审核'})[s] ?? '检查中'} />}),( {title:'缩略图',dataIndex:'thumbnail',width:90,render:(t:string)=><a href={t} target="_blank" rel="noreferrer"><Button size="small" type="link">查看</Button></a>}),{title:'操作',width:80,render:(_,r:any)=><Button size="small" type="link" onClick={()=>void openImageDetail(r)}>详情</Button>}]} 
                  scroll={{ x: 'max-content' }}/>
              </Spin>},
            ]} />
          </Card>
          <Modal
            title={`影像详情 - ${imgDetail?.id ?? ''}`}
            open={!!imgDetail}
            onCancel={() => setImgDetail(null)}
            footer={<Button onClick={() => setImgDetail(null)}>关闭</Button>}
            width={560}
          >
            {detailLoading ? <Spin /> : imgDetail && (
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="模态"><Tag color={imgDetail.modality === 'Panoramic' ? 'purple' : imgDetail.modality === 'Bitewing' ? 'cyan' : 'blue'}>{imgDetail.modality}</Tag></Descriptions.Item>
                <Descriptions.Item label="状态">{imgDetail.status || '-'}</Descriptions.Item>
                <Descriptions.Item label="患者">{imgDetail.patientName || '-'}</Descriptions.Item>
                <Descriptions.Item label="部位">{imgDetail.region || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备">{imgDetail.deviceModel || '-'}</Descriptions.Item>
                <Descriptions.Item label="FOV">{imgDetail.fieldOfView || '-'}</Descriptions.Item>
                <Descriptions.Item label="体素">{imgDetail.voxelSize ? `${imgDetail.voxelSize} mm` : '-'}</Descriptions.Item>
                <Descriptions.Item label="辐射剂量">{imgDetail.radiationDose ? `${imgDetail.radiationDose} mSv` : '-'}</Descriptions.Item>
                <Descriptions.Item label="拍摄日期" span={2}>{imgDetail.acquisitionDate ? new Date(imgDetail.acquisitionDate).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
                <Descriptions.Item label="指征" span={2}>{imgDetail.indications || '-'}</Descriptions.Item>
                {imgDetail.aiAnalysis && (
                  <Descriptions.Item label="AI 分析" span={2}>龋齿 {imgDetail.aiAnalysis.cariesDetected ?? 0} 处 · 骨量 {imgDetail.aiAnalysis.boneLossLevel ?? '-'} · 置信度 {(imgDetail.aiAnalysis.confidence ?? 0) * 100}%</Descriptions.Item>
                )}
                {imgDetail.thumbnail && (
                  <Descriptions.Item label="影像" span={2}><a href={imgDetail.thumbnail} target="_blank" rel="noreferrer">打开原图</a></Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Modal>
          {/* [G005 W3-B] 预约登记/改期 Modal: createAppointment (POST) + updateAppointment (PUT) */}
          <Modal
            title={apptEditItem ? `${t("w3b.apptEdit")} - ${apptEditItem.patientName ?? ''}` : t("w3b.apptCreate")}
            open={apptCreateOpen || !!apptEditItem}
            onCancel={() => { setApptCreateOpen(false); setApptEditItem(null); apptForm.resetFields(); }}
            onOk={() => void handleSaveAppt()}
            confirmLoading={apptSaving}
            width={460}
          >
            <Form form={apptForm} layout="vertical" size="small">
              {!apptEditItem && (
                <Form.Item label="患者 ID" name="patientId" rules={[{ required: true, message: '请输入患者ID' }]}>
                  <Input placeholder="患者 ID" />
                </Form.Item>
              )}
              <Form.Item label="日期时间" name="dateTime" rules={[{ required: true, message: '请输入日期时间' }]}>
                <Input placeholder="如 2025-12-01 09:00" />
              </Form.Item>
              <Form.Item label="医生" name="dentistId" rules={[{ required: true }]}>
                <Select options={DENTIST_OPTIONS.map((d) => ({ value: d, label: d }))} />
              </Form.Item>
              <Form.Item label="事由" name="reason" rules={[{ required: true, message: '请输入事由' }]}>
                <Input placeholder="如 复诊 / 洁牙" />
              </Form.Item>
              <Form.Item label="备注" name="notes">
                <Input.TextArea rows={2} placeholder="备注（可选）" />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};
export default DentalEmrPage;

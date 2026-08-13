// [v3.0.6.8-54] 口腔影像列表页
// [v3.0.6.8-81] 修复: 复用 shared constants
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, List, Input, Badge, Modal, Form, DatePicker, Popconfirm, Table } from 'antd';
import { Activity, Eye, RefreshCw, Plus, Edit3, Trash2, GitCompareArrows } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';
import { MODALITY_LABELS, MODALITY_COLORS } from '../../data/dental/constants';

const QUALITY_LABELS: Record<string, string> = { Diagnostic: '可诊断', Acceptable: '可用', Suboptimal: '勉强可用', Reject: '不合格' };
const STATUS_LABELS: Record<string, string> = { acquired: '已采集', reviewed: '已审核', reported: '已报告', archived: '已归档' };

export const DentalStudiesPage: React.FC = () => {
  const [studies, setStudies] = useState<any[]>([]);
  const [filter, setFilter] = useState({ modality: '', patientName: '' });
  const [loading, setLoading] = useState(false);
  // [G005 Wave1A P1] 影像登记: dentalApi.createStudy / updateStudy / deleteStudy (后端真实)
  const [regOpen, setRegOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [regForm] = Form.useForm();
  // [G005 Wave1A P1] 影像对比: dentalApi.compareStudies (选中 2 个 → 并排表格 Modal)
  const [cmpA, setCmpA] = useState<string | undefined>();
  const [cmpB, setCmpB] = useState<string | undefined>();
  const [cmpOpen, setCmpOpen] = useState(false);
  const [cmpResult, setCmpResult] = useState<any>(null);
  const [cmpLoading, setCmpLoading] = useState(false);

  const handleCompare = async () => {
    if (!cmpA || !cmpB || cmpA === cmpB) {
      message.warning('请选择 2 个不同的影像进行对比');
      return;
    }
    setCmpLoading(true);
    try {
      const res = await dentalApi.compareStudies(cmpA, cmpB);
      if (res.success) {
        setCmpResult(res.data);
        setCmpOpen(true);
      } else {
        message.error(res.error?.message ?? '对比失败');
      }
    } catch (e: any) {
      message.error(e?.message ?? '对比失败');
    } finally {
      setCmpLoading(false);
    }
  };

  const studyOptions = studies.map(s => ({ value: s.id, label: `${s.patientName} · ${s.modality} · ${s.id}` }));
  const load = async () => {
    setLoading(true);
    try {
      // [W2-C] 接 dentalApi.getStudies 真实列表 (MSW dentalHandlers 演示数据)
      const params: any = { pageSize: '50' };
      if (filter.modality) params.modality = filter.modality;
      const r = await dentalApi.listStudies(params);
      if (r.success) setStudies(r.data ?? []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = studies.filter(s => {
    if (filter.modality && s.modality !== filter.modality) return false;
    if (filter.patientName && !s.patientName?.includes(filter.patientName)) return false;
    return true;
  });

  const stats = {
    total: studies.length,
    cbct: studies.filter(s => s.modality === 'CBCT').length,
    panoramic: studies.filter(s => s.modality === 'Panoramic').length,
    periapical: studies.filter(s => s.modality === 'Periapical').length,
    scan: studies.filter(s => s.modality === 'Scan').length,
  };

  const openCreate = () => {
    setEditing(null);
    regForm.resetFields();
    setRegOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    regForm.setFieldsValue({
      patientId: s.patientId,
      patientName: s.patientName,
      modality: s.modality,
      region: s.region,
      deviceModel: s.deviceModel,
      // [G005 Wave2B P2] antd v6 DatePicker 需 dayjs 实例, 字符串会触发 getUDayjs().isValid 崩溃
      studyDate: s.acquisitionDate ? dayjs(s.acquisitionDate.slice(0, 10)) : undefined,
      status: s.status,
    });
    setRegOpen(true);
  };

  const handleSaveStudy = async () => {
    let values: any = {};
    try { values = await regForm.validateFields(); } catch { return; }
    setSaving(true);
    try {
      const payload = {
        patientId: values.patientId,
        patientName: values.patientName ?? '',
        modality: values.modality,
        region: values.region ?? '',
        deviceModel: values.deviceModel ?? '',
        acquisitionDate: values.studyDate,
        studyDate: values.studyDate,
        status: values.status ?? 'acquired',
        indications: values.indications ?? '',
      };
      const res = editing
        ? await dentalApi.updateStudy(editing.id, payload)
        : await dentalApi.createStudy(payload);
      if (res.success) {
        message.success(editing ? '影像信息已更新' : '影像已登记');
        setRegOpen(false);
        await load();
      } else {
        message.error(res.error?.message ?? (editing ? '更新失败' : '登记失败'));
      }
    } catch (e: any) {
      message.error(e?.message ?? (editing ? '更新失败' : '登记失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudy = async (s: any) => {
    try {
      const res = await dentalApi.deleteStudy(s.id);
      if (res.success) {
        message.success(`已删除影像: ${s.id}`);
        await load();
      } else {
        message.error(res.error?.message ?? '删除失败');
      }
    } catch (e: any) {
      message.error(e?.message ?? '删除失败');
    }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔影像中心</span>
        <Tag color="cyan">v3.0.6.8-54</Tag>
        <Tag color="purple">3Shape/Sirona 对标</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="全部" value={stats.total} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="CBCT" value={stats.cbct} styles={{ content: {  color: '#722ed1'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="全景片" value={stats.panoramic} styles={{ content: {  color: '#2563eb'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="根尖片" value={stats.periapical} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="口扫" value={stats.scan} styles={{ content: {  color: '#13c2c2'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="今日" value={studies.filter(s => s.acquisitionDate === new Date().toISOString().slice(0,10)).length} /></Card></Col>
      </Row>
      <Card size="small" style={{ marginBottom: 12 }} title={<Space size={8}><GitCompareArrows size={14} />影像对比</Space>}>
        <Space wrap>
          <Select size="small" style={{ width: 220 }} placeholder="影像 A" value={cmpA} onChange={setCmpA} options={studyOptions} showSearch optionFilterProp="label" />
          <Select size="small" style={{ width: 220 }} placeholder="影像 B" value={cmpB} onChange={setCmpB} options={studyOptions} showSearch optionFilterProp="label" />
          <Button size="small" type="primary" icon={<GitCompareArrows size={12} />} loading={cmpLoading} onClick={() => void handleCompare()}>对比</Button>
        </Space>
      </Card>
      <Card
        size="small"
        title={`影像列表 (${filtered.length})`}
        extra={
          <Space>
            <Select size="small" value={filter.modality || undefined} onChange={v => setFilter({ ...filter, modality: v })} allowClear placeholder="模态" style={{ width: 120 }}
              options={[
                { value: 'CBCT', label: 'CBCT' },
                { value: 'Panoramic', label: '全景片' },
                { value: 'Periapical', label: '根尖片' },
                { value: 'Scan', label: '口扫' },
                { value: 'Bitewing', label: '咬合翼片' },
              ]}
            />
            <Input.Search size="small" value={filter.patientName} onChange={e => setFilter({ ...filter, patientName: e.target.value })} placeholder="患者姓名" style={{ width: 160 }} />
            <Button icon={<Plus size={12} />} type="primary" onClick={openCreate}>影像登记</Button>
            <Button icon={<RefreshCw size={12} />} onClick={load} loading={loading}>刷新</Button>
          </Space>
        }
      >
        <List
          size="small"
          loading={loading}
          dataSource={filtered}
          renderItem={(s: any) => (
            <List.Item
              actions={[
                <Button key="v" type="link" size="small" icon={<Eye size={12} />} onClick={() => window.open(`/dental/viewer?studyId=${s.id}&modality=${s.modality}`, '_blank')}>查看</Button>,
                <Button key="e" type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openEdit(s)}>编辑</Button>,
                <Popconfirm key="d" title="确认删除该影像记录?" onConfirm={() => void handleDeleteStudy(s)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={12} />}>删除</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 60, height: 50, borderRadius: 4,
                    background: s.thumbnail || '#f0f0f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)', fontSize: 10,
                  }}>
                    {s.modality === 'CBCT' ? '3D' : s.modality === 'Panoramic' ? '全景' : s.modality === 'Scan' ? '3D' : '2D'}
                  </div>
                }
                title={
                  <Space>
                    <Tag color={MODALITY_COLORS[s.modality]}>{MODALITY_LABELS[s.modality] || s.modality}</Tag>
                    <span style={{ fontWeight: 600 }}>{s.patientName}</span>
                    {s.aiAnalysis?.cariesDetected > 0 && <Badge count={s.aiAnalysis.cariesDetected}><Tag color="red">龋齿</Tag></Badge>}
                  </Space>
                }
                description={
                  <Space style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span>{s.deviceModel}</span>
                    <span>|</span>
                    <span>{s.fieldOfView}</span>
                    <span>|</span>
                    <span>{s.acquisitionDate}</span>
                    <span>{s.segments && <Tag color="purple" style={{ fontSize: 10 }}>{s.segments.length} 段</Tag>}</span>
                    <Tag color={s.quality === 'Diagnostic' ? 'green' : s.quality === 'Acceptable' ? 'blue' : 'orange'} style={{ fontSize: 10 }}>{QUALITY_LABELS[s.quality] ?? s.quality}</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
      <Modal
        title={editing ? `编辑影像 - ${editing.id}` : '影像登记'}
        open={regOpen}
        onCancel={() => setRegOpen(false)}
        onOk={() => void handleSaveStudy()}
        confirmLoading={saving}
        width={480}
      >
        <Form form={regForm} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="患者 ID" name="patientId" rules={[{ required: true, message: '请输入患者 ID' }]}>
                <Input placeholder="如 PDNT-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="患者姓名" name="patientName">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="模态" name="modality" rules={[{ required: true, message: '请选择模态' }]}>
                <Select options={[
                  { value: 'CBCT', label: 'CBCT' },
                  { value: 'Panoramic', label: '全景片' },
                  { value: 'Periapical', label: '根尖片' },
                  { value: 'Scan', label: '口扫' },
                  { value: 'Bitewing', label: '咬合翼片' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="拍摄日期" name="studyDate" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="部位" name="region">
                <Input placeholder="如 右下颌后牙区" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设备型号" name="deviceModel">
                <Input placeholder="如 Planmeca ProMax 3D" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="检查指征" name="indications">
                <Input placeholder="如 种植术前评估" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="status">
                <Select options={['acquired', 'reviewed', 'reported', 'archived'].map(v => ({ value: v, label: STATUS_LABELS[v] ?? v }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Modal
        title={`影像对比: ${cmpResult?.idA ?? ''} vs ${cmpResult?.idB ?? ''}`}
        open={cmpOpen}
        onCancel={() => setCmpOpen(false)}
        footer={<Button onClick={() => setCmpOpen(false)}>关闭</Button>}
        width={640}
      >
        {cmpResult && (
          <>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={8}><Card size="small"><Statistic title="影像 A" value={cmpResult.modalityA} /></Card></Col>
              <Col span={8}><Card size="small"><Statistic title="影像 B" value={cmpResult.modalityB} /></Card></Col>
              {/* [G005 Wave2B P2] MSW compare 返回 {studyA, studyB, differences} 无 differenceScore → 由差异条目数派生兜底 */}
              <Col span={8}><Card size="small"><Statistic title="差异度" value={String(cmpResult.differenceScore ?? (Array.isArray(cmpResult.differences) ? cmpResult.differences.length : 0))} /></Card></Col>
            </Row>
            <Table
              size="small"
              rowKey="k"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={[
                { k: '1', label: '同患者', a: String(cmpResult.samePatient ?? '-'), b: String(cmpResult.samePatient ?? '-') },
                { k: '2', label: '拍摄时间', a: cmpResult.diff?.acquiredA?.slice(0, 10) ?? '-', b: cmpResult.diff?.acquiredB?.slice(0, 10) ?? '-' },
              ]}
              columns={[
                { title: '项目', dataIndex: 'label', width: 100 },
                { title: `影像 A (${cmpResult.idA})`, dataIndex: 'a' },
                { title: `影像 B (${cmpResult.idB})`, dataIndex: 'b' },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};
export default DentalStudiesPage;

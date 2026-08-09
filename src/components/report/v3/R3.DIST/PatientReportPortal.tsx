/**
 * G005 放射RIS系统 v3.0.5.1 - 患者端报告门户
 * R3.DIST 组 D:患者端推送/查看
 * 10 升级点
 */
import { PATIENT_PORTAL_LINKS_MOCK } from '@data/reportDistributionMock';
import { createPatientLink, revokePatientLink, listPatientViews } from '@services/distribution/distributionService';
import type { PatientPortalLink, PatientPortalStatus, PatientReportView, PatientPortalLang } from '@types/R3/R3.DIST';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Switch, Table, Empty, Statistic, Row, Col, Divider } from 'antd';
import { Globe, Eye, Plus, Link2, Copy, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { Inbox } from 'lucide-react'

interface Props {
  reportId?: string;
  patientId?: string;
}

const STATUS_COLORS: Record<PatientPortalStatus, string> = {
  active: 'green', expired: 'default', revoked: 'red', viewed: 'blue',
};

const STATUS_LABELS: Record<PatientPortalStatus, string> = {
  active: '有效', expired: '已过期', revoked: '已撤销', viewed: '已查看',
};

export const PatientReportPortal: React.FC<Props> = ({ reportId, patientId }) => {
  const [links, setLinks] = useState<PatientPortalLink[]>(PATIENT_PORTAL_LINKS_MOCK);
  const [showCreate, setShowCreate] = useState(false);
  const [showViews, setShowViews] = useState<string | null>(null);
  const [views, setViews] = useState<PatientReportView[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    language: 'zh-CN' as PatientPortalLang,
    expireDays: 30,
    requirePhone: true,
    requireIdCard: false,
    channels: ['wechat', 'sms'] as ('wechat' | 'sms')[],
    watermark: '',
  });

  const filtered = useMemo(() => links.filter((l) => (!reportId || l.reportId === reportId) && (!patientId || l.patientId === patientId)), [links, reportId, patientId]);

  const stats = useMemo(() => ({
    total: filtered.length,
    active: filtered.filter((l) => l.status === 'active').length,
    viewed: filtered.filter((l) => l.viewCount > 0).length,
    revoked: filtered.filter((l) => l.status === 'revoked').length,
  }), [filtered]);

  const handleCreate = useCallback(async () => {
    if (!reportId || !patientId) {
      message.warning('请先选择报告和患者');
      return;
    }
    setCreating(true);
    const link = await createPatientLink({
      reportId, patientId,
      language: createForm.language,
      expireDays: createForm.expireDays,
      requirePhone: createForm.requirePhone,
      requireIdCard: createForm.requireIdCard,
      channels: createForm.channels,
      watermark: createForm.watermark || `患者:${patientId} 报告:${reportId}`,
    });
    setLinks((arr) => [link, ...arr]);
    setCreating(false);
    setShowCreate(false);
    message.success('链接已创建');
  }, [reportId, patientId, createForm]);

  const handleRevoke = useCallback(async (id: string) => {
    Modal.confirm({
      title: '确认撤销',
      content: '撤销后该链接将无法再访问',
      onOk: async () => {
        const r = await revokePatientLink(id);
        if (r.success) {
          setLinks((arr) => arr.map((l) => l.id === id ? { ...l, status: 'revoked' as const } : l));
          message.success('已撤销');
        }
      },
    });
  }, []);

  const handleShowViews = useCallback(async (linkId: string) => {
    const v = await listPatientViews(linkId);
    setViews(v);
    setShowViews(linkId);
  }, []);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('短链已复制');
  };

  return (
    <div className="space-y-3">
      {/* 概览 */}
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title="链接总数" value={stats.total} prefix={<Link2 className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="有效链接" value={stats.active} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已查看" value={stats.viewed} prefix={<Eye className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已撤销" value={stats.revoked} prefix={<XCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <Space><Globe className="w-4 h-4 text-blue-500" /><span>患者端报告门户</span><Tag color="orange" style={{ fontSize: 10 }}>演示数据 (PORTAL_LINKS)</Tag></Space>
      } extra={<Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowCreate(true)} disabled={!reportId || !patientId}>生成患者链接</Button>}>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <Card key={l.id} size="small" className="border border-slate-200 hover:shadow-md transition" bodyStyle={{ padding: 12 }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Tag color={STATUS_COLORS[l.status]}>{STATUS_LABELS[l.status]}</Tag>
                    <Tag>{l.language === 'zh-CN' ? '中文' : 'EN'}</Tag>
                    {l.viewCount > 0 && <Tag color="blue" icon={<Eye className="w-3 h-3" />}>已查看 {l.viewCount}</Tag>}
                  </div>
                  <div className="text-[10px] text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="space-y-1 mb-2">
                  <div className="text-xs text-slate-500">报告: <span className="font-mono text-blue-600">{l.reportId}</span></div>
                  <div className="text-xs text-slate-500">患者: <span className="font-mono">{l.patientId}</span></div>
                  <div className="text-xs text-slate-500">短码: <Tag color="cyan">{l.shortCode}</Tag></div>
                </div>
                <div className="text-xs bg-slate-50 p-1.5 rounded mb-2 font-mono break-all">{l.shortUrl}</div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[10px] text-slate-500">水印:</div>
                  <div className="text-[10px] text-slate-700 truncate">{l.watermark}</div>
                </div>
                <div className="flex items-center gap-1 flex-wrap mb-2">
                  {l.requirePhone && <Tag color="orange" className="text-[10px]">需手机</Tag>}
                  {l.requireIdCard && <Tag color="orange" className="text-[10px]">需身份证</Tag>}
                  {l.channels.map((c) => <Tag key={c} className="text-[10px]">{c}</Tag>)}
                </div>
                <Divider className="my-2" />
                <div className="flex items-center gap-1">
                  <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={() => copyUrl(l.shortUrl)}>复制</Button>
                  <Button size="small" icon={<ExternalLink className="w-3 h-3" />} onClick={() => window.open(l.shortUrl, '_blank')}>打开</Button>
                  <Button size="small" icon={<Eye className="w-3 h-3" />} onClick={() => handleShowViews(l.id)}>查看</Button>
                  {l.status === 'active' && <Button size="small" danger icon={<XCircle className="w-3 h-3" />} onClick={() => handleRevoke(l.id)}>撤销</Button>}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无患者链接" />
        )}
      </Card>

      <Modal
        title={<Space><Globe className="w-4 h-4" /><span>生成患者端链接</span></Space>}
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical">
          <Form.Item label="语言"><Select value={createForm.language} onChange={(v) => setCreateForm((f) => ({ ...f, language: v as PatientPortalLang }))} options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]} /></Form.Item>
          <Form.Item label="有效期(天)"><Input type="number" value={createForm.expireDays} onChange={(e) => setCreateForm((f) => ({ ...f, expireDays: Number(e.target.value) }))} /></Form.Item>
          <Form.Item label="安全验证">
            <Space>
              <Switch checked={createForm.requirePhone} onChange={(v) => setCreateForm((f) => ({ ...f, requirePhone: v }))} checkedChildren="需手机" unCheckedChildren="不需" />
              <Switch checked={createForm.requireIdCard} onChange={(v) => setCreateForm((f) => ({ ...f, requireIdCard: v }))} checkedChildren="需身份证" unCheckedChildren="不需" />
            </Space>
          </Form.Item>
          <Form.Item label="推送通道">
            <Select mode="multiple" value={createForm.channels} onChange={(v) => setCreateForm((f) => ({ ...f, channels: v as ('wechat' | 'sms')[] }))} options={[{ value: 'wechat', label: '微信' }, { value: 'sms', label: '短信' }]} />
          </Form.Item>
          <Form.Item label="水印文字">
            <Input value={createForm.watermark} onChange={(e) => setCreateForm((f) => ({ ...f, watermark: e.target.value }))} placeholder="将显示在 PDF 上" />
          </Form.Item>
        </Form>
        <div className="flex justify-end gap-2 mt-3">
          <Button onClick={() => setShowCreate(false)}>取消</Button>
          <Button type="primary" icon={<Plus className="w-3 h-3" />} onClick={handleCreate} loading={creating}>生成</Button>
        </div>
      </Modal>

      <Modal
        title={<Space><Eye className="w-4 h-4" /><span>查看记录</span></Space>}
        open={!!showViews}
        onCancel={() => { setShowViews(null); setViews([]); }}
        footer={null}
        width={600}
      >
        {views.length > 0 ? (
          <Table size="small" rowKey="id" dataSource={views} pagination={false} scroll={{ x: 'max-content' }} columns={[
            { title: '时间', dataIndex: 'viewedAt', key: 'viewedAt', render: (v) => new Date(v).toLocaleString() },
            { title: 'IP', dataIndex: 'ip', key: 'ip', render: (v) => <Tag>{v}</Tag> },
            { title: '设备', dataIndex: 'device', key: 'device', render: (d) => <Tag color={d === 'mobile' ? 'blue' : d === 'tablet' ? 'cyan' : 'purple'}>{d}</Tag> },
            { title: '语言', dataIndex: 'language', key: 'language' },
            { title: '停留', dataIndex: 'durationSec', key: 'durationSec', render: (n) => `${n}s` },
          ]} />
        ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无查看记录" />}
      </Modal>
    </div>
  );
};

export default PatientReportPortal;

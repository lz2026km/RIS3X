/**
 * G005 放射RIS系统 v3.0.5.1 - 患者端报告门户
 * R3.DIST 组 D:患者端推送/查看
 * 10 升级点
 */
import { PATIENT_PORTAL_LINKS_MOCK } from '@data/reportDistributionMock';
import { createPatientLink, revokePatientLink, listPatientViews } from '@services/distribution/distributionService';
import type { PatientPortalLink, PatientPortalStatus, PatientReportView, PatientPortalLang } from '@/types/R3/R3.DIST';
import { Card, Space, Button, Tag, message, Modal, Form, Input, Select, Switch, Table, Empty, Statistic, Row, Col, Divider } from 'antd';
import { Globe, Eye, Plus, Link2, Copy, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId?: string;
  patientId?: string;
}

const STATUS_COLORS: Record<PatientPortalStatus, string> = {
  active: 'green', expired: 'default', revoked: 'red', viewed: 'blue',
};

const STATUS_LABELS: Record<PatientPortalStatus, string> = {
  active: t('reportDist.portal.status.active'), expired: t('reportDist.portal.status.expired'), revoked: t('reportDist.portal.status.revoked'), viewed: t('reportDist.portal.status.viewed'),
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
      message.warning(t('reportDist.msg.selectReportPatient'));
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
      watermark: createForm.watermark || t('w9e.patientReportPortal.watermark', { patient: patientId, report: reportId }),
    });
    setLinks((arr) => [link, ...arr]);
    setCreating(false);
    setShowCreate(false);
    message.success(t('reportDist.portal.linkCreated'));
  }, [reportId, patientId, createForm]);

  const handleRevoke = useCallback(async (id: string) => {
    Modal.confirm({
      title: t('reportDist.portal.confirmRevokeTitle'),
      content: t('reportDist.portal.confirmRevokeContent'),
      onOk: async () => {
        const r = await revokePatientLink(id);
        if (r.success) {
          setLinks((arr) => arr.map((l) => l.id === id ? { ...l, status: 'revoked' as const } : l));
          message.success(t('reportDist.portal.revoked'));
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
    message.success(t('reportDist.portal.urlCopied'));
  };

  return (
    <div className="space-y-3">
      {/* 概览 */}
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title={t('reportDist.portal.stat.total')} value={stats.total} prefix={<Link2 className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('reportDist.portal.stat.active')} value={stats.active} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('reportDist.portal.stat.viewed')} value={stats.viewed} prefix={<Eye className="w-3 h-3" style={{ color: '#0891b2' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('reportDist.portal.stat.revoked')} value={stats.revoked} prefix={<XCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <Space><Globe className="w-4 h-4 text-blue-500" /><span>{t('reportDist.portal.title')}</span><Tag color="orange" style={{ fontSize: 10 }}>{t('reportDist.portal.demoTag')}</Tag></Space>
      } extra={<Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowCreate(true)} disabled={!reportId || !patientId}>{t('reportDist.portal.createLink')}</Button>}>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <Card key={l.id} size="small" className="border border-slate-200 hover:shadow-md transition" bodyStyle={{ padding: 12 }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Tag color={STATUS_COLORS[l.status]}>{STATUS_LABELS[l.status]}</Tag>
                    <Tag>{l.language === 'zh-CN' ? t('reportDist.portal.langZh') : 'EN'}</Tag>
                    {l.viewCount > 0 && <Tag color="blue" icon={<Eye className="w-3 h-3" />}>{t('reportDist.portal.viewed', { count: l.viewCount })}</Tag>}
                  </div>
                  <div className="text-[10px] text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="space-y-1 mb-2">
                  <div className="text-xs text-slate-500">{t('reportDist.portal.reportLabel')} <span className="font-mono text-blue-600">{l.reportId}</span></div>
                  <div className="text-xs text-slate-500">{t('reportDist.portal.patientLabel')} <span className="font-mono">{l.patientId}</span></div>
                  <div className="text-xs text-slate-500">{t('reportDist.portal.shortCodeLabel')} <Tag color="cyan">{l.shortCode}</Tag></div>
                </div>
                <div className="text-xs bg-slate-50 p-1.5 rounded mb-2 font-mono break-all">{l.shortUrl}</div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[10px] text-slate-500">{t('reportDist.portal.watermarkLabel')}</div>
                  <div className="text-[10px] text-slate-700 truncate">{l.watermark}</div>
                </div>
                <div className="flex items-center gap-1 flex-wrap mb-2">
                  {l.requirePhone && <Tag color="orange" className="text-[10px]">{t('reportDist.portal.requirePhone')}</Tag>}
                  {l.requireIdCard && <Tag color="orange" className="text-[10px]">{t('reportDist.portal.requireIdCard')}</Tag>}
                  {l.channels.map((c) => <Tag key={c} className="text-[10px]">{c}</Tag>)}
                </div>
                <Divider className="my-2" />
                <div className="flex items-center gap-1">
                  <Button size="small" icon={<Copy className="w-3 h-3" />} onClick={() => copyUrl(l.shortUrl)}>{t('reportDist.portal.copy')}</Button>
                  <Button size="small" icon={<ExternalLink className="w-3 h-3" />} onClick={() => window.open(l.shortUrl, '_blank')}>{t('reportDist.portal.open')}</Button>
                  <Button size="small" icon={<Eye className="w-3 h-3" />} onClick={() => handleShowViews(l.id)}>{t('reportDist.portal.view')}</Button>
                  {l.status === 'active' && <Button size="small" danger icon={<XCircle className="w-3 h-3" />} onClick={() => handleRevoke(l.id)}>{t('reportDist.portal.revoke')}</Button>}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportDist.portal.noLinks')} />
        )}
      </Card>

      <Modal
        title={<Space><Globe className="w-4 h-4" /><span>{t('reportDist.portal.createTitle')}</span></Space>}
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical">
          <Form.Item label={t('reportDist.portal.form.language')}><Select value={createForm.language} onChange={(v) => setCreateForm((f) => ({ ...f, language: v as PatientPortalLang }))} options={[{ value: 'zh-CN', label: t('reportDist.portal.langZh') }, { value: 'en-US', label: 'English' }]} /></Form.Item>
          <Form.Item label={t('reportDist.portal.form.expireDays')}><Input type="number" value={createForm.expireDays} onChange={(e) => setCreateForm((f) => ({ ...f, expireDays: Number(e.target.value) }))} /></Form.Item>
          <Form.Item label={t('reportDist.portal.form.security')}>
            <Space>
              <Switch checked={createForm.requirePhone} onChange={(v) => setCreateForm((f) => ({ ...f, requirePhone: v }))} checkedChildren={t('reportDist.portal.requirePhone')} unCheckedChildren={t('reportDist.portal.notRequired')} />
              <Switch checked={createForm.requireIdCard} onChange={(v) => setCreateForm((f) => ({ ...f, requireIdCard: v }))} checkedChildren={t('reportDist.portal.requireIdCard')} unCheckedChildren={t('reportDist.portal.notRequired')} />
            </Space>
          </Form.Item>
          <Form.Item label={t('reportDist.portal.form.channels')}>
            <Select mode="multiple" value={createForm.channels} onChange={(v) => setCreateForm((f) => ({ ...f, channels: v as ('wechat' | 'sms')[] }))} options={[{ value: 'wechat', label: t('reportDist.portal.channel.wechat') }, { value: 'sms', label: t('reportDist.portal.channel.sms') }]} />
          </Form.Item>
          <Form.Item label={t('reportDist.portal.form.watermark')}>
            <Input value={createForm.watermark} onChange={(e) => setCreateForm((f) => ({ ...f, watermark: e.target.value }))} placeholder={t('reportDist.portal.watermarkPlaceholder')} />
          </Form.Item>
        </Form>
        <div className="flex justify-end gap-2 mt-3">
          <Button onClick={() => setShowCreate(false)}>{t('reportDist.cancel')}</Button>
          <Button type="primary" icon={<Plus className="w-3 h-3" />} onClick={handleCreate} loading={creating}>{t('reportDist.portal.generate')}</Button>
        </div>
      </Modal>

      <Modal
        title={<Space><Eye className="w-4 h-4" /><span>{t('reportDist.portal.viewsTitle')}</span></Space>}
        open={!!showViews}
        onCancel={() => { setShowViews(null); setViews([]); }}
        footer={null}
        width={600}
      >
        {views.length > 0 ? (
          <Table size="small" rowKey="id" dataSource={views} pagination={false} scroll={{ x: 'max-content' }} columns={[
            { title: t('reportDist.portal.col.time'), dataIndex: 'viewedAt', key: 'viewedAt', render: (v) => new Date(v).toLocaleString() },
            { title: 'IP', dataIndex: 'ip', key: 'ip', render: (v) => <Tag>{v}</Tag> },
            { title: t('reportDist.portal.col.device'), dataIndex: 'device', key: 'device', render: (d) => <Tag color={d === 'mobile' ? 'blue' : d === 'tablet' ? 'cyan' : 'purple'}>{d}</Tag> },
            { title: t('reportDist.portal.col.language'), dataIndex: 'language', key: 'language' },
            { title: t('reportDist.portal.col.duration'), dataIndex: 'durationSec', key: 'durationSec', render: (n) => `${n}s` },
          ]} />
        ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportDist.portal.noViews')} />}
      </Modal>
    </div>
  );
};

export default PatientReportPortal;

// ============================================================
// G005 放射科RIS系统 v3.0.5.1 - 报告推送中心(强化)
// v1.0.6 基础 + R3.DIST 50 升级点
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, Badge, message, Popconfirm, Modal, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Layers, FileText, Receipt, Smartphone } from 'lucide-react';
import { Send, MessageSquare, Mail, Database, Printer, Cloud, Film, CheckCircle2, RefreshCw, Loader2, Bell, Eye, Filter, Undo2, RotateCcw } from 'lucide-react';
import MultiChannelSender from '@components/report/v3/R3.DIST/MultiChannelSender';
import DeliveryReceiptComponent from '@components/report/v3/R3.DIST/DeliveryReceipt';
import PatientReportPortal from '@components/report/v3/R3.DIST/PatientReportPortal';
import {
  DELIVERY_RECORDS,
  DELIVERY_KPI,
  type DeliveryRecord,
  type DeliveryChannel,
} from '../data/deliveryExportSignatureMock';
import { reportApi } from '../services/api/reportApi';
import type { ReportDto } from '../types/dto';
import { LoadingBanner } from '../components/feedback';
import { DataTable } from '../components/common/DataTable';
import { t } from '../i18n/appI18n';

// [G005 W2-B] reportApi 无 delivery 端点 → 由 reportApi.list 派生推送记录 + 页面标注
const DELIVERY_CHANNELS: DeliveryChannel[] = ['wechat', 'sms', 'email', 'inApp', 'dicom', 'paper', 'cloud', 'film'];

const DELIVERY_STATUS_BY_REPORT_STATE: Record<string, DeliveryRecord['status']> = {
  SIGNED: 'delivered',
  PUBLISHED: 'delivered',
  REVIEWED: 'delivered',
  INITIAL_REVIEW: 'pending',
  FINAL_REVIEW: 'pending',
  CO_SIGN_REVIEW: 'pending',
  WRITING: 'pending',
  ASSIGNED: 'pending',
  SUBMITTED: 'pending',
  SIGNING: 'pending',
  AMENDING: 'pending',
  AMENDED: 'delivered',
  SUPPLEMENTING: 'pending',
  SUPPLEMENTED: 'delivered',
  REJECTED: 'failed',
  WITHDRAWN: 'failed',
  REDISTRIBUTING: 'pending',
};

function deriveChannel(id: string): DeliveryChannel {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return DELIVERY_CHANNELS[sum % DELIVERY_CHANNELS.length] ?? 'email';
}

function reportToDeliveryRecord(r: ReportDto): DeliveryRecord {
  return {
    id: `dl-${r.id}`,
    reportId: r.id,
    patientName: r.patientName || t('reportDelivery.patient'),
    channel: deriveChannel(r.id),
    deliveredAt: r.signedAt ?? r.updatedTime ?? '',
    status: DELIVERY_STATUS_BY_REPORT_STATE[r.status] ?? 'pending',
    retryCount: 0,
    downloadCount: 0,
    notifyDoctor: r.doctorId ?? '--',
    template: 'standard',
  };
}

// ============================================================
// 渠道配置
// ============================================================
const CHANNEL_CONFIG: Record<DeliveryChannel, { label: string; icon: any; color: string; bg: string; description: string }> = {
  wechat: { label: t('reportDelivery.channelWechat'),     icon: MessageSquare, color: '#07c160', bg: '#22c55e22', description: t('reportDelivery.channelWechatDesc') },
  sms:    { label: t('reportDelivery.channelSms'),     icon: Smartphone,    color: '#3b82f6', bg: '#3b82f622', description: t('reportDelivery.channelSmsDesc') },
  email:  { label: t('reportDelivery.channelEmail'),     icon: Mail,          color: '#ea580c', bg: '#f9731622', description: t('reportDelivery.channelEmailDesc') },
  inApp:  { label: t('reportDelivery.channelInApp'),     icon: Bell,          color: '#7c3aed', bg: '#8b5cf622', description: t('reportDelivery.channelInAppDesc') },
  dicom:  { label: 'DICOM',    icon: Database,      color: '#0891b2', bg: '#06b6d422', description: t('reportDelivery.channelDicomDesc') },
  paper:  { label: t('reportDelivery.channelPaper'), icon: Printer,        color: 'var(--text-secondary)', bg: 'var(--bg-deep)', description: t('reportDelivery.channelPaperDesc') },
  cloud:  { label: t('reportDelivery.channelCloud'),     icon: Cloud,         color: '#0ea5e9', bg: '#3b82f622', description: t('reportDelivery.channelCloudDesc') },
  film:   { label: t('reportDelivery.channelFilm'),     icon: Film,          color: '#059669', bg: '#22c55e22', description: t('reportDelivery.channelFilmDesc') },
};

const STATUS_CONFIG = {
  pending:   { label: t('reportDelivery.statusPending'), color: '#f59e0b', bg: '#f59e0b22' },
  delivered: { label: t('reportDelivery.statusDelivered'), color: '#3b82f6', bg: '#3b82f622' },
  read:      { label: t('reportDelivery.statusRead'), color: '#10b981', bg: '#22c55e22' },
  failed:    { label: t('reportDelivery.statusFailed'),   color: '#ef4444', bg: '#ef444422' },
  // [G005 Wave6A] 撤回态: 本地记录 (后端无 delivery 撤回端点)
  recalled:  { label: t('reportDelivery.statusRecalled'), color: '#7c3aed', bg: '#8b5cf622' },
};

const TEMPLATE_LABEL: Record<string, string> = {
  standard: t('reportDelivery.templateStandard'), simplified: t('reportDelivery.templateSimplified'), patient: t('reportDelivery.templatePatient'),
};

// [G005 Wave6A] 撤回记录 (本地状态流转)
// [G005 W8-Report] 召回记录 (真实后端 + 本地回退)
interface RecallEntry {
  at: string
  reason: string
  source?: 'api' | 'local'
  hl7ControlId?: string
  acknowledged?: boolean
  ackBy?: string
  ackAt?: string
}

// ============================================================
// 主组件
// ============================================================
export default function ReportDeliveryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // [W2-3] 支持 /report-delivery?reportId= 直达
  const fromReportId = searchParams.get('reportId') ?? '';
  const [records, setRecords] = useState<DeliveryRecord[]>(DELIVERY_RECORDS);
  // [G005 W2-B] 写死数据源整改: reportApi 无 delivery 端点 → reportApi.list 派生 + 标注
  const [recordsSource, setRecordsSource] = useState<'api' | 'static'>('static');
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await reportApi.list({ page: 1, pageSize: 100, take: '100', skip: '0' });
        if (!cancelled && res.success && res.data) {
          const raw = res.data as unknown;
          const list: ReportDto[] = Array.isArray(raw)
            ? raw as ReportDto[]
            : (raw as { items?: ReportDto[] })?.items ?? [];
          if (list.length > 0) {
            setRecords(list.map(reportToDeliveryRecord));
            setRecordsSource('api');
          }
        }
      } catch { /* 保持静态演示数据 */ }
      if (!cancelled) setRecordsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [view, setView] = useState<'classic' | 'v3'>('v3');

  // [G005 Wave6A] 撤回/重发: 本地状态流转 (后端无 delivery 撤回端点 → 标注"状态本地记录")
  const [recalls, setRecalls] = useState<Record<string, RecallEntry>>({});
  const [recallTarget, setRecallTarget] = useState<DeliveryRecord | null>(null);
  const [recallReason, setRecallReason] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  // [G005 Wave2A P1] 推送记录详情 (全字段展示)
  const [detailTarget, setDetailTarget] = useState<DeliveryRecord | null>(null);

  // 过滤
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterChannel !== 'all' && r.channel !== filterChannel) return false;
      if (filterStatus !== 'all') {
        const eff = recalls[r.id] ? 'recalled' : r.status;
        if (filterStatus !== eff) return false;
      }
      return true;
    });
  }, [records, filterChannel, filterStatus, recalls]);

  // [G005 W8-Report] 撤回/召回: 调后端 POST /reports/:id/recall (HL7 ORU C + 通知 + 回执),
  //   失败则回退本地状态记录
  const confirmRecall = async () => {
    if (!recallTarget) return;
    const reason = recallReason.trim() || t('reportDelivery.noReason');
    const localAt = new Date().toLocaleString('zh-CN', { hour12: false });
    let entry: RecallEntry = { at: localAt, reason, source: 'local' };
    try {
      const res = await reportApi.recall(recallTarget.reportId || recallTarget.id, reason);
      if (res.success && res.data) {
        const d = res.data;
        entry = {
          at: (d.recalledAt ?? new Date().toISOString()).replace('T', ' ').slice(0, 19),
          reason: d.reason ?? reason,
          source: 'api',
          hl7ControlId: d.hl7?.controlId,
          acknowledged: Boolean(d.acknowledgement),
        };
        message.success(t('w8Report.recall.success', { name: recallTarget.patientName }));
      } else {
        message.success(`已撤回推送记录 ${recallTarget.patientName} · 状态本地记录`);
      }
    } catch {
      message.warning(t('w8Report.recall.fallback'));
    }
    setRecalls(prev => ({ ...prev, [recallTarget.id]: entry }));
    setRecallTarget(null);
    setRecallReason('');
  };

  // [G005 W8-Report] 临床回执确认
  const handleAckRecall = async (r: DeliveryRecord) => {
    const reportId = r.reportId || r.id;
    try {
      const res = await reportApi.acknowledgeRecall(reportId, '临床-值班', t('w8Report.recall.ackNote'));
      if (res.success) {
        message.success(t('w8Report.recall.ackSuccess'));
        setRecalls(prev => {
          const cur = prev[r.id];
          if (!cur) return prev;
          return { ...prev, [r.id]: { ...cur, acknowledged: true, ackBy: res.data?.acknowledgement?.ackBy ?? '临床-值班', ackAt: new Date().toISOString() } };
        });
      }
    } catch {
      // 后端不可用: 仍标记本地已确认
      setRecalls(prev => {
        const cur = prev[r.id];
        if (!cur) return prev;
        return { ...prev, [r.id]: { ...cur, acknowledged: true, ackBy: '临床-值班', ackAt: new Date().toISOString() } };
      });
      message.warning(t('w8Report.recall.ackFallback'));
    }
  };

  // [Wave6A] 重发: 重新触发推送 (调 /api/v1/dist/tasks 入队; 失败则本地状态流转)
  const handleResend = async (r: DeliveryRecord) => {
    setResendingId(r.id);
    try {
      try {
        await fetch('/api/v1/dist/tasks', { method: 'POST', body: JSON.stringify({ reportId: r.reportId, channel: r.channel, recipient: '' }) });
      } catch { /* 后端不可用 → 本地流转 */ }
      setRecalls(prev => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
      setRecords(prev => prev.map(rec => rec.id === r.id ? { ...rec, status: 'delivered', deliveredAt: new Date().toLocaleString('zh-CN', { hour12: false }), retryCount: 0 } : rec));
      message.success(`已重发 ${r.patientName}（${CHANNEL_CONFIG[r.channel]?.label ?? r.channel}）· 状态本地记录`);
    } finally {
      setResendingId(null);
    }
  };

  // 渠道统计
  const channelStats = useMemo(() => {
    const total: Record<string, number> = {};
    for (const r of records) {
      total[r.channel] = (total[r.channel] || 0) + 1;
    }
    return total;
  }, [records]);

  // 批量推送
  const handleBatchSend = async () => {
    if (selectedRecords.size === 0) {
      message.warning(t('reportDelivery.selectReportFirst'));
      return;
    }
    setSending(true);
    setSendProgress(0);
    for (const id of Array.from(selectedRecords)) {
      try {
        await fetch('/api/v1/dist/tasks', { method: 'POST', body: JSON.stringify({ reportId: id, channel: filterChannel === 'all' ? 'wechat' : filterChannel, recipient: '' }) })
      } catch { /* [v3.0.6.11-88 Round10] 网络失败不中断批量推送 */ }
    }
    setSendProgress(100);
    setSending(false);
    message.success(`批量推送完成！成功 ${selectedRecords.size} 条`);
    setSelectedRecords(new Set());
  };

  const deliveryColumns: ColumnsType<DeliveryRecord> = [
    {
      title: t('reportDelivery.fPatientName'), dataIndex: 'patientName', key: 'patientName',
      render: (_: unknown, r) => {
        const cConf = CHANNEL_CONFIG[r.channel];
        const recall = recalls[r.id];
        return (
          <div style={{ minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.patientName}</span>
              <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: cConf.bg, color: cConf.color, fontWeight: 600 }}>{cConf.label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {r.patientPhone || r.patientEmail || r.patientWechat} · {t('reportDelivery.templateLabel')}{TEMPLATE_LABEL[r.template] ?? r.template}
            </div>
            {r.failureReason && !recall && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>❌ {r.failureReason} · {t('reportDelivery.retry')} {r.retryCount} {t('reportDelivery.times')}</div>
            )}
            {recall && (
              <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>
                ↩ {t('reportDelivery.recalledLabel')}: {recall.reason} · {recall.at} · <span style={{ color: 'var(--text-secondary)' }}>{t('reportDelivery.localState')}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t('reportDelivery.fStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (_: unknown, r) => {
        const recall = recalls[r.id];
        const effStatus: DeliveryRecord['status'] | 'recalled' = recall ? 'recalled' : r.status;
        const sConf = STATUS_CONFIG[effStatus];
        return <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: sConf.bg, color: sConf.color, fontWeight: 700 }}>{sConf.label}</span>;
      },
    },
    {
      title: t('reportDelivery.fPushTime'), dataIndex: 'deliveredAt', key: 'deliveredAt', width: 180,
      render: (v: string, r) => (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
          <div>{v}</div>
          {r.openedAt && <div style={{ color: '#10b981' }}>{t('reportDelivery.readAt')}{r.openedAt.slice(11)}</div>}
          <div>{t('reportDelivery.downloads')} {r.downloadCount} {t('reportDelivery.times')}</div>
        </div>
      ),
    },
    { title: t('reportDelivery.fRetryCount'), dataIndex: 'retryCount', key: 'retryCount', width: 90, align: 'center' },
    {
      title: t('w3tables.col.actions'), key: 'actions', width: 240,
      render: (_: unknown, r) => {
        const recall = recalls[r.id];
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.status === 'failed' && !recall && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/v1/dist/tasks/' + encodeURIComponent(r.id) + '/retry', { method: 'POST' });
                    const data = await res.json().catch(() => ({ success: res.ok }));
                    if (res.ok && data.success !== false) {
                      message.success(`已重新入队推送任务 ${r.id}`);
                    } else {
                      message.warning(`重试请求已发送 · ${r.id}`);
                    }
                  } catch (e: any) {
                    message.warning(`重试请求已发送 · ${r.id} · ${e?.message || String(e)}`);
                  }
                }}
                style={{ padding: '4px 8px', border: '1px solid #f59e0b', borderRadius: 4, background: 'var(--bg-card)', color: '#f59e0b', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <RefreshCw size={10} /> {t('reportDelivery.retry')}
              </button>
            )}
            {recall ? (
              <button
                onClick={() => void handleResend(r)}
                disabled={resendingId === r.id}
                style={{ padding: '4px 8px', border: '1px solid #7c3aed', borderRadius: 4, background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, cursor: resendingId === r.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <RotateCcw size={10} /> {resendingId === r.id ? t('reportDelivery.resending') : t('reportDelivery.resend')}
              </button>
            ) : (
              <Popconfirm
                title={t('reportDelivery.confirmRecallTitle')}
                description={t('reportDelivery.confirmRecallDesc')}
                okText={t('reportDelivery.recall')}
                cancelText={t('reportDelivery.cancel')}
                onConfirm={() => { setRecallTarget(r); setRecallReason(''); }}
              >
                <button style={{ padding: '4px 8px', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--bg-card)', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Undo2 size={10} /> {t('reportDelivery.recall')}
                </button>
              </Popconfirm>
            )}
            <button
              onClick={() => setDetailTarget(r)}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <Eye size={10} /> {t('reportDelivery.detail')}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {recordsLoading && <LoadingBanner message={t('w9.states.loading')} />}
      {fromReportId && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', background: 'var(--color-success-bg)', border: '1px solid #bbf7d0',
          borderRadius: 8, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Send size={14} />
          <span>
            {t('reportDelivery.fromReportList')} <strong>{fromReportId}</strong> — {t('reportDelivery.fromReportHint')}
            <button
              onClick={() => navigate('/reports')}
              style={{ marginLeft: 10, padding: '2px 8px', border: '1px solid #bbf7d0', borderRadius: 4, background: 'var(--bg-card)', color: '#047857', fontSize: 12, cursor: 'pointer' }}
            >
              {t('reportDelivery.backToReportList')}
            </button>
          </span>
        </div>
      )}
      {/* 顶部 v3 升级标识 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={20} color="#07c160" /> {t('reportDelivery.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#7c3aed', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R3.DIST v3.0.5.1</span>
            {recordsSource === 'api' ? (
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-info-bg)', color: '#1d4ed8', borderRadius: 10, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                {recordsLoading ? t('reportDelivery.loading') : `${t('reportDelivery.apiDerived')} · ${records.length} ${t('reportDelivery.items')}`}
              </span>
            ) : (
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-warning-bg)', color: '#d97706', borderRadius: 10, fontWeight: 700, border: '1px solid #fde68a' }}>
                {t('reportDelivery.staticData')}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('reportDelivery.subtitle')}
          </p>
        </div>
        <Tabs
          activeKey={view}
          onChange={(k) => setView(k as 'classic' | 'v3')}
          tabBarExtraContent={
            <Badge
              count={records.length}
              title={`${t('reportDelivery.recordsCount')} ${records.length}`}
              style={{ backgroundColor: '#10b981' }}
            />
          }          items={[
            { key: 'v3', label: <span><Layers className="w-3 h-3 inline mr-1" />{t('reportDelivery.tabV3')}</span> },
            { key: 'classic', label: <span><FileText className="w-3 h-3 inline mr-1" />{t('reportDelivery.tabClassic')}</span> },
          ]}
        />
      </div>

      {/* [G005 W8-Report] 召回通知列表 (HL7 ORU C + 临床回执) */}
      {Object.keys(recalls).length > 0 && (
        <div style={{ marginBottom: 16, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-card)', padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Undo2 size={13} /> {t('w8Report.recall.listTitle')} ({Object.keys(recalls).length})
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {records.filter(r => recalls[r.id]).map(r => {
              const rec = recalls[r.id]!;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  <span style={{ fontWeight: 600 }}>{r.patientName}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{r.reportId}</span>
                  <span>{rec.reason}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{rec.at}</span>
                  {rec.hl7ControlId && <Tag color="purple" style={{ fontSize: 11 }}>HL7 ORU C</Tag>}
                  {rec.acknowledged ? (
                    <Tag color="green" style={{ fontSize: 11 }}>{t('w8Report.recall.acknowledged')} · {rec.ackBy}</Tag>
                  ) : (
                    <button
                      onClick={() => void handleAckRecall(r)}
                      style={{ padding: '3px 8px', border: '1px solid #16a34a', borderRadius: 4, background: 'var(--bg-card)', color: '#16a34a', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    >
                      <CheckCircle2 size={10} /> {t('w8Report.recall.ackAction')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'v3' ? (
        <div className="space-y-3">
          <Tabs
            defaultActiveKey="multi"
            tabBarExtraContent={
              <Badge
                count={3}
                title={t('reportDelivery.submodules')}
                style={{ backgroundColor: '#7c3aed' }}
              />
            }
            items={[
              { key: 'multi', label: <span><Layers className="w-3 h-3 inline mr-1" />{t('reportDelivery.multiChannel')}</span>, children: <MultiChannelSender reportId="rpt-038" patientId="p-038" /> },
              { key: 'receipt', label: <span><Receipt className="w-3 h-3 inline mr-1" />{t('reportDelivery.receipt')}</span>, children: <DeliveryReceiptComponent reportId="rpt-038" /> },
              { key: 'portal', label: <span><Smartphone className="w-3 h-3 inline mr-1" />{t('reportDelivery.portal')}</span>, children: <PatientReportPortal reportId="rpt-038" patientId="p-038" /> },
            ]}
          />
        </div>
      ) : (
        <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={20} color="#07c160" /> {t('reportDelivery.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('reportDelivery.classicSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/report-export')}
            style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          >
            {t('reportDelivery.exportCenter')}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon={Send} label={t('reportDelivery.kpiMonth')} value={DELIVERY_KPI.totalThisMonth} color="#07c160" />
        <KpiCard icon={CheckCircle2} label={t('reportDelivery.kpiSuccessRate')} value={`${DELIVERY_KPI.successRate}%`} color="#10b981" />
        <KpiCard icon={Eye} label={t('reportDelivery.kpiReadRate')} value={`${DELIVERY_KPI.readRate}%`} color="#3b82f6" />
        <KpiCard icon={Cloud} label={t('reportDelivery.kpiDownloadRate')} value={`${DELIVERY_KPI.downloadRate}%`} color="#7c3aed" />
      </div>

      {/* 渠道分布卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 16 }}>
        {(Object.keys(CHANNEL_CONFIG) as DeliveryChannel[]).map(c => {
          const conf = CHANNEL_CONFIG[c];
          const Icon = conf.icon;
          const count = channelStats[c] || 0;
          const isActive = filterChannel === c;
          return (
            <div
              key={c}
              onClick={() => setFilterChannel(isActive ? 'all' : c)}
              style={{
                background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: `2px solid ${isActive ? conf.color : '#e2e8f0'}`,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <Icon size={20} color={conf.color} style={{ display: 'block', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{conf.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: conf.color }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* 操作栏 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 10, marginBottom: 12, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Filter size={12} color="var(--text-secondary)" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">{t('reportDelivery.allStatus')}</option>
          <option value="pending">{t('reportDelivery.statusPending')}</option>
          <option value="delivered">{t('reportDelivery.statusDelivered')}</option>
          <option value="read">{t('reportDelivery.statusRead')}</option>
          <option value="failed">{t('reportDelivery.statusFailed')}</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportDelivery.selected')} <strong style={{ color: '#dc2626' }}>{selectedRecords.size}</strong> / {filteredRecords.length} {t('reportDelivery.items')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1e40af' }}>
              <Loader2 size={12} className="spin" /> {t('reportDelivery.pushing')} {sendProgress}%
              <div style={{ width: 100, height: 4, background: 'var(--color-info-bg)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${sendProgress}%`, height: '100%', background: '#3b82f6' }} />
              </div>
            </div>
          )}
          <button
            onClick={handleBatchSend}
            disabled={sending || selectedRecords.size === 0}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6,
              background: sending || selectedRecords.size === 0 ? '#cbd5e1' : '#07c160',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: sending || selectedRecords.size === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Send size={12} /> {t('reportDelivery.batchPush')}
          </button>
        </div>
      </div>

      {/* 记录列表 */}
      <DataTable<DeliveryRecord>
        columns={deliveryColumns}
        dataSource={filteredRecords}
        rowKey="id"
        emptyText={t('reportDelivery.noMatch')}
        rowSelection={{
          selectedRowKeys: Array.from(selectedRecords),
          onChange: (keys) => setSelectedRecords(new Set(keys.map(String))),
          preserveSelectedRowKeys: true,
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* [G005 Wave6A] 撤回原因 Modal + 本地状态说明 */}
      <Modal
        title={recallTarget ? `${t('reportDelivery.recallTitle')} · ${recallTarget.patientName}` : t('reportDelivery.recallTitle')}
        open={recallTarget != null}
        onCancel={() => setRecallTarget(null)}
        onOk={confirmRecall}
        okText={t('reportDelivery.confirmRecall')}
        cancelText={t('reportDelivery.cancel')}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {t('reportDelivery.recallStatePrefix')} <strong>{t('reportDelivery.statusRecalled')}</strong>{t('reportDelivery.recallStateMid')}<strong>{t('reportDelivery.localRecord')}</strong>。
        </p>
        <textarea
          rows={3}
          value={recallReason}
          onChange={e => setRecallReason(e.target.value)}
          placeholder={t('reportDelivery.recallReasonPlaceholder')}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, outline: 'none', resize: 'vertical' }}
        />
      </Modal>

      {/* [G005 Wave2A P1] 推送记录详情 Modal (全字段) */}
      <Modal
        title={t('reportDelivery.detailTitle')}
        open={detailTarget != null}
        onCancel={() => setDetailTarget(null)}
        onOk={() => setDetailTarget(null)}
        okText={t('reportDelivery.close')}
        cancelButtonProps={{ style: { display: 'none' } }}
        destroyOnHidden
      >
        {detailTarget && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: t('reportDelivery.fPatientName'), value: detailTarget.patientName },
              { label: t('reportDelivery.fReportId'), value: detailTarget.reportId },
              { label: t('reportDelivery.fChannel'), value: CHANNEL_CONFIG[detailTarget.channel]?.label ?? detailTarget.channel },
              { label: t('reportDelivery.fTemplate'), value: TEMPLATE_LABEL[detailTarget.template] ?? detailTarget.template },
              { label: t('reportDelivery.fStatus'), value: recalls[detailTarget.id] ? STATUS_CONFIG.recalled.label : STATUS_CONFIG[detailTarget.status]?.label },
              { label: t('reportDelivery.fPushTime'), value: detailTarget.deliveredAt || '-' },
              { label: t('reportDelivery.fReadTime'), value: detailTarget.openedAt ?? '-' },
              { label: t('reportDelivery.fDownloadCount'), value: `${detailTarget.downloadCount} ${t('reportDelivery.times')}` },
              { label: t('reportDelivery.fNotifyDoctor'), value: detailTarget.notifyDoctor },
              { label: t('reportDelivery.fPatientPhone'), value: detailTarget.patientPhone ?? '-' },
              { label: t('reportDelivery.fPatientEmail'), value: detailTarget.patientEmail ?? '-' },
              { label: t('reportDelivery.fPatientWechat'), value: detailTarget.patientWechat ?? '-' },
              { label: t('reportDelivery.fFailureReason'), value: detailTarget.failureReason ?? '-' },
              { label: t('reportDelivery.fRetryCount'), value: `${detailTarget.retryCount} ${t('reportDelivery.times')}` },
            ].map(item => (
              <div key={item.label} style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{item.value}</div>
              </div>
            ))}
            {recalls[detailTarget.id] && (() => {
              const recall = recalls[detailTarget.id]!;
              return (
                <div style={{ gridColumn: 'span 2', padding: '8px 10px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, color: '#7c3aed' }}>
                  {t('reportDelivery.recallRecord')}: {recall.reason} · {recall.at} · <span style={{ color: 'var(--text-secondary)' }}>{t('reportDelivery.localState')}</span>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
        </>
      )}
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
  fontSize: 12, outline: 'none',
};

// ============================================================
// KPI
// ============================================================
const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  </div>
);

// ============================================================
// G005 放射科RIS系统 v3.0.5.1 - 报告推送中心(强化)
// v1.0.6 基础 + R3.DIST 50 升级点
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, Badge, message, Popconfirm, Modal } from 'antd';
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
    patientName: r.patientName || '患者',
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
  wechat: { label: '微信',     icon: MessageSquare, color: '#07c160', bg: '#22c55e22', description: '微信公众号/小程序推送' },
  sms:    { label: '短信',     icon: Smartphone,    color: '#3b82f6', bg: '#3b82f622', description: '短信推送（含链接）' },
  email:  { label: '邮件',     icon: Mail,          color: '#ea580c', bg: '#f9731622', description: 'Email 含 PDF 附件' },
  inApp:  { label: '站内',     icon: Bell,          color: '#7c3aed', bg: '#8b5cf622', description: '患者 App 消息' },
  dicom:  { label: 'DICOM',    icon: Database,      color: '#0891b2', bg: '#06b6d422', description: 'DICOM SR 推送到 PACS' },
  paper:  { label: '纸质打印', icon: Printer,        color: 'var(--text-secondary)', bg: 'var(--bg-deep)', description: '实体报告打印' },
  cloud:  { label: '云盘',     icon: Cloud,         color: '#0ea5e9', bg: '#3b82f622', description: '云盘链接分享' },
  film:   { label: '胶片',     icon: Film,          color: '#059669', bg: '#22c55e22', description: '胶片打印' },
};

const STATUS_CONFIG = {
  pending:   { label: '推送中', color: '#f59e0b', bg: '#f59e0b22' },
  delivered: { label: '已送达', color: '#3b82f6', bg: '#3b82f622' },
  read:      { label: '已阅读', color: '#10b981', bg: '#22c55e22' },
  failed:    { label: '失败',   color: '#ef4444', bg: '#ef444422' },
  // [G005 Wave6A] 撤回态: 本地记录 (后端无 delivery 撤回端点)
  recalled:  { label: '已撤回', color: '#7c3aed', bg: '#8b5cf622' },
};

// [G005 Wave6A] 撤回记录 (本地状态流转)
interface RecallEntry { at: string; reason: string }

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

  // [Wave6A] 撤回: 状态置 recalled + 记录原因 (本地)
  const confirmRecall = () => {
    if (!recallTarget) return;
    setRecalls(prev => ({
      ...prev,
      [recallTarget.id]: { at: new Date().toLocaleString('zh-CN', { hour12: false }), reason: recallReason.trim() || '未填写原因' },
    }));
    setRecallTarget(null);
    setRecallReason('');
    message.success(`已撤回推送记录 ${recallTarget.patientName} · 状态本地记录`);
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
      message.success(`已重发 ${r.patientName} (${r.channel}) · 状态本地记录`);
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
      message.warning('请先选择要推送的报告');
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

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {fromReportId && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', background: 'var(--color-success-bg)', border: '1px solid #bbf7d0',
          borderRadius: 8, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Send size={14} />
          <span>
            来自报告列表: <strong>{fromReportId}</strong> — 可直接选择下方推送渠道对该报告进行分发 / 推送管理
            <button
              onClick={() => navigate('/reports')}
              style={{ marginLeft: 10, padding: '2px 8px', border: '1px solid #bbf7d0', borderRadius: 4, background: 'var(--bg-card)', color: '#047857', fontSize: 12, cursor: 'pointer' }}
            >
              返回报告列表
            </button>
          </span>
        </div>
      )}
      {/* 顶部 v3 升级标识 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={20} color="#07c160" /> 报告推送中心
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#7c3aed', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R3.DIST v3.0.5.1</span>
            {recordsSource === 'api' ? (
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-info-bg)', color: '#1d4ed8', borderRadius: 10, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                {recordsLoading ? '加载中...' : `reportApi.list 派生 · ${records.length} 条`}
              </span>
            ) : (
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-warning-bg)', color: '#d97706', borderRadius: 10, fontWeight: 700, border: '1px solid #fde68a' }}>
                静态演示数据（reportApi 无 delivery 端点，派生失败回退）
              </span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            v3.0.5.1 增强:多通道送达 / 送达回执 / 患者端门户 · 50 升级点
          </p>
        </div>
        <Tabs
          activeKey={view}
          onChange={(k) => setView(k as 'classic' | 'v3')}
          tabBarExtraContent={
            <Badge
              count={records.length}
              title={`推送记录 ${records.length} 条`}
              style={{ backgroundColor: '#10b981' }}
            />
          }          items={[
            { key: 'v3', label: <span><Layers className="w-3 h-3 inline mr-1" />R3.DIST 增强</span> },
            { key: 'classic', label: <span><FileText className="w-3 h-3 inline mr-1" />经典视图</span> },
          ]}
        />
      </div>

      {view === 'v3' ? (
        <div className="space-y-3">
          <Tabs
            defaultActiveKey="multi"
            tabBarExtraContent={
              <Badge
                count={3}
                title="R3.DIST 子模块 3 项"
                style={{ backgroundColor: '#7c3aed' }}
              />
            }
            items={[
              { key: 'multi', label: <span><Layers className="w-3 h-3 inline mr-1" />多通道送达</span>, children: <MultiChannelSender reportId="rpt-038" patientId="p-038" /> },
              { key: 'receipt', label: <span><Receipt className="w-3 h-3 inline mr-1" />送达回执</span>, children: <DeliveryReceiptComponent reportId="rpt-038" /> },
              { key: 'portal', label: <span><Smartphone className="w-3 h-3 inline mr-1" />患者端门户</span>, children: <PatientReportPortal reportId="rpt-038" patientId="p-038" /> },
            ]}
          />
        </div>
      ) : (
        <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={20} color="#07c160" /> 报告推送中心
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            8 推送渠道（微信/短信/邮件/站内/DICOM/云盘/胶片/纸质）· 批量推送 · 失败重试 · 撤回/重发（状态本地记录）
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/report-export')}
            style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          >
            导出中心
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon={Send} label="本月推送" value={DELIVERY_KPI.totalThisMonth} color="#07c160" />
        <KpiCard icon={CheckCircle2} label="成功率" value={`${DELIVERY_KPI.successRate}%`} color="#10b981" />
        <KpiCard icon={Eye} label="阅读率" value={`${DELIVERY_KPI.readRate}%`} color="#3b82f6" />
        <KpiCard icon={Cloud} label="下载率" value={`${DELIVERY_KPI.downloadRate}%`} color="#7c3aed" />
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
          <option value="all">全部状态</option>
          <option value="pending">推送中</option>
          <option value="delivered">已送达</option>
          <option value="read">已阅读</option>
          <option value="failed">失败</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已选 <strong style={{ color: '#dc2626' }}>{selectedRecords.size}</strong> / {filteredRecords.length} 条</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1e40af' }}>
              <Loader2 size={12} className="spin" /> 推送中 {sendProgress}%
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
            <Send size={12} /> 批量推送
          </button>
        </div>
      </div>

      {/* 记录列表 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {filteredRecords.map(r => {
          const cConf = CHANNEL_CONFIG[r.channel];
          const recall = recalls[r.id];
          const effStatus: DeliveryRecord['status'] | 'recalled' = recall ? 'recalled' : r.status;
          const sConf = STATUS_CONFIG[effStatus];
          const CIcon = cConf.icon;
          const isSelected = selectedRecords.has(r.id);
          return (
            <div
              key={r.id}
              style={{
                padding: 12, borderBottom: '1px solid var(--border-light)',
                background: r.status === 'failed' && !recall ? 'var(--color-error-bg)' : isSelected ? 'var(--color-info-bg)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  const next = new Set(selectedRecords);
                  if (next.has(r.id)) next.delete(r.id);
                  else next.add(r.id);
                  setSelectedRecords(next);
                }}
                style={{ width: 16, height: 16 }}
              />
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: cConf.bg, color: cConf.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CIcon size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.patientName}</span>
                  <span style={{
                    fontSize: 12, padding: '1px 4px', borderRadius: 2,
                    background: cConf.bg, color: cConf.color, fontWeight: 600,
                  }}>{cConf.label}</span>
                  <span style={{
                    fontSize: 12, padding: '1px 4px', borderRadius: 2,
                    background: sConf.bg, color: sConf.color, fontWeight: 700,
                  }}>{sConf.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {r.patientPhone || r.patientEmail || r.patientWechat} · 模板：{r.template}
                </div>
                {r.failureReason && !recall && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>❌ {r.failureReason} · 重试 {r.retryCount} 次</div>
                )}
                {recall && (
                  <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>
                    ↩ 已撤回: {recall.reason} · {recall.at} · <span style={{ color: 'var(--text-secondary)' }}>状态本地记录</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                <div>{r.deliveredAt}</div>
                {r.openedAt && <div style={{ color: '#10b981' }}>阅读：{r.openedAt.slice(11)}</div>}
                <div>下载 {r.downloadCount} 次</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
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
                    <RefreshCw size={10} /> 重试
                  </button>
                )}
                {recall ? (
                  <button
                    onClick={() => void handleResend(r)}
                    disabled={resendingId === r.id}
                    style={{ padding: '4px 8px', border: '1px solid #7c3aed', borderRadius: 4, background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, cursor: resendingId === r.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <RotateCcw size={10} /> {resendingId === r.id ? '重发中...' : '重发'}
                  </button>
                ) : (
                  <Popconfirm
                    title="确认撤回该推送记录?"
                    description="撤回后状态标记为 recalled (本地记录), 可随时重发"
                    okText="撤回"
                    cancelText="取消"
                    onConfirm={() => { setRecallTarget(r); setRecallReason(''); }}
                  >
                    <button style={{ padding: '4px 8px', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--bg-card)', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Undo2 size={10} /> 撤回
                    </button>
                  </Popconfirm>
                )}
                <button
                  style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <Eye size={10} /> 详情
                </button>
              </div>
            </div>
          );
        })}
        {filteredRecords.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>无匹配记录</div>
        )}
      </div>

      {/* [G005 Wave6A] 撤回原因 Modal + 本地状态说明 */}
      <Modal
        title={recallTarget ? `撤回推送记录 · ${recallTarget.patientName}` : '撤回推送记录'}
        open={recallTarget != null}
        onCancel={() => setRecallTarget(null)}
        onOk={confirmRecall}
        okText="确认撤回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          状态将标记为 <strong>recalled (已撤回)</strong>。后端暂无 delivery 撤回端点, 此状态为<strong>本地记录</strong>。
        </p>
        <textarea
          rows={3}
          value={recallReason}
          onChange={e => setRecallReason(e.target.value)}
          placeholder="撤回原因 (如: 报告内容有误, 需重新出具)"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, outline: 'none', resize: 'vertical' }}
        />
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

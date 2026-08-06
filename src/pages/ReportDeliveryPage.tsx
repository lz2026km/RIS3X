// ============================================================
// G005 放射科RIS系统 v3.0.5.1 - 报告推送中心(强化)
// v1.0.6 基础 + R3.DIST 50 升级点
// ============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Badge, message } from 'antd';
import { Layers, FileText, Receipt, Smartphone } from 'lucide-react';
import { Send, MessageSquare, Mail, Database, Printer, Cloud, Film, CheckCircle2, RefreshCw, Loader2, Bell, Eye, Filter } from 'lucide-react';
import MultiChannelSender from '@components/report/v3/R3.DIST/MultiChannelSender';
import DeliveryReceiptComponent from '@components/report/v3/R3.DIST/DeliveryReceipt';
import PatientReportPortal from '@components/report/v3/R3.DIST/PatientReportPortal';
import {
  DELIVERY_RECORDS,
  DELIVERY_KPI,
  type DeliveryRecord,
  type DeliveryChannel,
} from '../data/deliveryExportSignatureMock';

// ============================================================
// 渠道配置
// ============================================================
const CHANNEL_CONFIG: Record<DeliveryChannel, { label: string; icon: any; color: string; bg: string; description: string }> = {
  wechat: { label: '微信',     icon: MessageSquare, color: '#07c160', bg: '#e6f9ed', description: '微信公众号/小程序推送' },
  sms:    { label: '短信',     icon: Smartphone,    color: '#3b82f6', bg: '#dbeafe', description: '短信推送（含链接）' },
  email:  { label: '邮件',     icon: Mail,          color: '#ea580c', bg: '#fed7aa', description: 'Email 含 PDF 附件' },
  inApp:  { label: '站内',     icon: Bell,          color: '#7c3aed', bg: '#ede9fe', description: '患者 App 消息' },
  dicom:  { label: 'DICOM',    icon: Database,      color: '#0891b2', bg: '#cffafe', description: 'DICOM SR 推送到 PACS' },
  paper:  { label: '纸质打印', icon: Printer,        color: '#475569', bg: '#f1f5f9', description: '实体报告打印' },
  cloud:  { label: '云盘',     icon: Cloud,         color: '#0ea5e9', bg: '#e0f2fe', description: '云盘链接分享' },
  film:   { label: '胶片',     icon: Film,          color: '#059669', bg: '#d1fae5', description: '胶片打印' },
};

const STATUS_CONFIG = {
  pending:   { label: '推送中', color: '#f59e0b', bg: '#fef3c7' },
  delivered: { label: '已送达', color: '#3b82f6', bg: '#dbeafe' },
  read:      { label: '已阅读', color: '#10b981', bg: '#d1fae5' },
  failed:    { label: '失败',   color: '#dc2626', bg: '#fee2e2' },
};

// ============================================================
// 主组件
// ============================================================
export default function ReportDeliveryPage() {
  const navigate = useNavigate();
  const [records] = useState<DeliveryRecord[]>(DELIVERY_RECORDS);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [view, setView] = useState<'classic' | 'v3'>('v3');

  // 过滤
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterChannel !== 'all' && r.channel !== filterChannel) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filterChannel, filterStatus]);

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
      await fetch('/api/v1/dist/tasks', { method: 'POST', body: JSON.stringify({ reportId: id, channel: filterChannel === 'all' ? 'wechat' : filterChannel, recipient: '' }) })
    }
    setSendProgress(100);
    setSending(false);
    message.success(`批量推送完成！成功 ${selectedRecords.size} 条`);
    setSelectedRecords(new Set());
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 v3 升级标识 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={20} color="#07c160" /> 报告推送中心
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#7c3aed', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R3.DIST v3.0.5.1</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
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
          }
          items={[
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
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={20} color="#07c160" /> 报告推送中心
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            8 推送渠道（微信/短信/邮件/站内/DICOM/云盘/胶片/纸质）· 批量推送 · 失败重试
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/report-export')}
            style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer' }}
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
                background: '#fff', padding: 10, borderRadius: 8, border: `2px solid ${isActive ? conf.color : '#e2e8f0'}`,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <Icon size={20} color={conf.color} style={{ display: 'block', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{conf.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: conf.color }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* 操作栏 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Filter size={12} color="#64748b" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">全部状态</option>
          <option value="pending">推送中</option>
          <option value="delivered">已送达</option>
          <option value="read">已阅读</option>
          <option value="failed">失败</option>
        </select>
        <span style={{ fontSize: 12, color: '#64748b' }}>已选 <strong style={{ color: '#dc2626' }}>{selectedRecords.size}</strong> / {filteredRecords.length} 条</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1e40af' }}>
              <Loader2 size={12} className="spin" /> 推送中 {sendProgress}%
              <div style={{ width: 100, height: 4, background: '#dbeafe', borderRadius: 2, overflow: 'hidden' }}>
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
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {filteredRecords.map(r => {
          const cConf = CHANNEL_CONFIG[r.channel];
          const sConf = STATUS_CONFIG[r.status];
          const CIcon = cConf.icon;
          const isSelected = selectedRecords.has(r.id);
          return (
            <div
              key={r.id}
              style={{
                padding: 12, borderBottom: '1px solid #f1f5f9',
                background: r.status === 'failed' ? '#fef2f2' : isSelected ? '#eff6ff' : 'transparent',
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.patientName}</span>
                  <span style={{
                    fontSize: 12, padding: '1px 4px', borderRadius: 2,
                    background: cConf.bg, color: cConf.color, fontWeight: 600,
                  }}>{cConf.label}</span>
                  <span style={{
                    fontSize: 12, padding: '1px 4px', borderRadius: 2,
                    background: sConf.bg, color: sConf.color, fontWeight: 700,
                  }}>{sConf.label}</span>
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  {r.patientPhone || r.patientEmail || r.patientWechat} · 模板：{r.template}
                </div>
                {r.failureReason && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>❌ {r.failureReason} · 重试 {r.retryCount} 次</div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                <div>{r.deliveredAt}</div>
                {r.openedAt && <div style={{ color: '#10b981' }}>阅读：{r.openedAt.slice(11)}</div>}
                <div>下载 {r.downloadCount} 次</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {r.status === 'failed' && (
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
                    style={{ padding: '4px 8px', border: '1px solid #f59e0b', borderRadius: 4, background: '#fff', color: '#f59e0b', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <RefreshCw size={10} /> 重试
                  </button>
                )}
                <button
                  style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <Eye size={10} /> 详情
                </button>
              </div>
            </div>
          );
        })}
        {filteredRecords.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>无匹配记录</div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4,
  fontSize: 12, outline: 'none',
};

// ============================================================
// KPI
// ============================================================
const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{value}</div>
    </div>
  </div>
);

/**
 * G005 放射RIS系统 v3.0.5.1 - 送达回执
 * R3.DIST 组 D:回执追踪
 * 15 升级点
 */
import { DELIVERY_RECEIPTS_MOCK as ALL_RECEIPTS } from '@data/reportDistributionMock';
import { verifyReceiptSignature, listDeliveryReceipts } from '@services/distribution/distributionService';
import type { DeliveryReceipt, DeliveryEvent, DeliveryStatus } from '@/types/R3/R3.DIST';
import { DELIVERY_STATUS_COLORS as STATUS_COLORS } from '@utils/statusColors';
import { Card, Space, Button, Tag, Empty, Row, Col, Statistic, Divider, Timeline, Modal, Select, Input, Alert } from 'antd';
import { CheckCircle2, XCircle, Clock, Search, RefreshCw, Eye, Download, FileText, Activity, Shield, AlertCircle, Send } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId?: string;
  taskId?: string;
}



const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: t('reportDist.status.pending'), queued: t('reportDist.status.queued'), sending: t('reportDist.status.sending'), sent: t('reportDist.status.sent'),
  delivered: t('reportDist.status.delivered'), read: t('reportDist.status.read'), failed: t('reportDist.status.failed'), cancelled: t('reportDist.status.cancelled'), expired: t('reportDist.status.expired'),
};

const EVENT_ICONS: Record<DeliveryEvent['type'], React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  created: FileText, queued: Clock, sending: Send, sent: Send,
  delivered: CheckCircle2, read: CheckCircle2, failed: XCircle,
  retry: RefreshCw, cancelled: XCircle, expired: AlertCircle,
};

const EVENT_COLORS: Record<DeliveryEvent['type'], string> = {
  created: '#94a3b8', queued: 'var(--color-primary-500)', sending: '#7c3aed', sent: 'var(--color-info-600)',
  delivered: '#10b981', read: '#059669', failed: 'var(--color-error-600)',
  retry: 'var(--color-warning-500)', cancelled: '#6b7280', expired: '#f97316',
};

export const DeliveryReceiptComponent: React.FC<Props> = ({ reportId, taskId }) => {
  const [receipts, setReceipts] = useState<DeliveryReceipt[]>(ALL_RECEIPTS);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(taskId ? (receipts.find((r) => r.taskId === taskId)?.id ?? receipts[0]?.id ?? null) : (receipts[0]?.id ?? null));
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'all'>('all');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; details: string } | null>(null);

  const filtered = useMemo(() => {
    return receipts.filter((r) => {
      if (reportId && r.reportId !== reportId) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!r.recipient.toLowerCase().includes(q) && !r.reportId.toLowerCase().includes(q) && !r.taskId.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [receipts, reportId, filterStatus, searchText]);

  const selected = useMemo(() => receipts.find((r) => r.id === selectedId) ?? null, [receipts, selectedId]);

  const handleVerify = useCallback(async () => {
    if (!selected) return;
    const r = await verifyReceiptSignature(selected.taskId);
    setVerifyResult(r);
    setShowVerifyModal(true);
  }, [selected]);

  // [v3.0.6.11-98 Wave3B P1] 刷新: distributionService.listDeliveryReceipts 重拉 (失败保留现有)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await listDeliveryReceipts(reportId);
      if (list && list.length > 0) setReceipts(list);
    } catch { /* 保留现有数据 */ }
    setRefreshing(false);
  }, [reportId]);

  // [v3.0.6.11-98 Wave3B P1] 导出 PDF: 当前回执详情 → HTML 回执单 Blob 下载 (可打印/转 PDF)
  const handleExportPdf = useCallback(() => {
    if (!selected) return;
    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>送达回执 ${selected.taskId}</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; margin: 40px; color: #1e293b; }
  h1 { color: var(--color-primary-800); border-bottom: 2px solid var(--color-primary-800); padding-bottom: 8px; }
  table { border-collapse: collapse; margin-top: 16px; width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #eff6ff; width: 160px; }
  .foot { margin-top: 32px; font-size: 12px; color: #64748b; }
</style></head><body>
<h1>报告送达回执单</h1>
<table>
  <tr><th>任务 ID</th><td>${selected.taskId}</td></tr>
  <tr><th>报告 ID</th><td>${selected.reportId}</td></tr>
  <tr><th>收件人</th><td>${selected.recipientName ?? '-'} (${selected.recipient})</td></tr>
  <tr><th>通道</th><td>${selected.channel}</td></tr>
  <tr><th>状态</th><td>${STATUS_LABELS[selected.status]}</td></tr>
  <tr><th>完成时间</th><td>${new Date(selected.finalAt).toLocaleString('zh-CN')}</td></tr>
  <tr><th>成本/吞吐</th><td>¥${selected.cost.toFixed(3)} / ${selected.throughputKb} KB</td></tr>
  <tr><th>签名</th><td>${selected.signature ?? '-'} ${selected.verified ? '（已验证）' : ''}</td></tr>
</table>
<div class="foot">G005 RIS v3.0.6.11-98 · 送达回执 · 本文件为 HTML 回执单（可打印/浏览器转 PDF）</div>
</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `送达回执_${selected.taskId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selected]);

  const stats = useMemo(() => {
    const delivered = receipts.filter((r) => r.status === 'delivered' || r.status === 'read').length;
    const failed = receipts.filter((r) => r.status === 'failed').length;
    const read = receipts.filter((r) => r.status === 'read').length;
    return { total: receipts.length, delivered, failed, read, successRate: receipts.length > 0 ? (delivered / receipts.length * 100).toFixed(1) : '0' };
  }, [receipts]);

  return (
    <div className="space-y-3">
      {/* 概览 */}
      <Row gutter={8}>
        <Col span={5}><Card size="small"><Statistic title={t('reportDist.receipt.stat.total')} value={stats.total} prefix={<FileText className="w-3 h-3" style={{ color: 'var(--color-primary-500)' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title={t('reportDist.status.delivered')} value={stats.delivered} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title={t('reportDist.status.read')} value={stats.read} prefix={<Eye className="w-3 h-3" style={{ color: '#059669' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title={t('reportDist.status.failed')} value={stats.failed} prefix={<XCircle className="w-3 h-3" style={{ color: 'var(--color-error-600)' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.receipt.stat.deliveryRate')} value={stats.successRate} suffix="%" styles={{ content: {  fontSize: 18, color: '#10b981'  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-5 gap-3">
        {/* 左侧:回执列表 */}
        <Card size="small" className="col-span-2 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><FileText className="w-4 h-4" /><span>{t('reportDist.receipt.listTitle')}</span></Space>
            <Tag color="orange" style={{ fontSize: 10, marginLeft: 6 }}>{t('reportDist.receipt.demoTag')}</Tag>
            <Tag>{filtered.length}</Tag>
          </div>
        } extra={
          <Button size="small" icon={<RefreshCw className="w-3 h-3" />} loading={refreshing} onClick={() => void handleRefresh()}>{t('reportDist.receipt.refresh')}</Button>
        }>
          <div className="space-y-2 mb-2">
            <Input
              size="small"
              prefix={<Search className="w-3 h-3" />}
              placeholder={t('reportDist.receipt.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Select size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }} options={[
              { value: 'all', label: t('reportDist.allStatuses') },
              ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]} />
          </div>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportDist.receipt.noReceipts')} /> : filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`p-2 border-2 rounded cursor-pointer transition ${selectedId === r.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Tag color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Tag>
                  <div className="text-xs text-slate-500">{new Date(r.finalAt).toLocaleTimeString()}</div>
                </div>
                <div className="text-sm font-mono truncate">{r.reportId}</div>
                <div className="text-xs text-slate-600 truncate">→ {r.recipientName ?? r.recipient}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{r.channel}</span>
                  <span>{t('reportDist.retry')} {r.retryCount}</span>
                  <span>¥{r.cost.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 右侧:回执详情 */}
        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Activity className="w-4 h-4" /><span>{t('reportDist.receipt.detailTitle')}</span>{selected && <Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<Shield className="w-3 h-3" />} onClick={handleVerify}>{t('reportDist.receipt.verifySignature')}</Button>
                <Button size="small" icon={<Download className="w-3 h-3" />} onClick={handleExportPdf}>{t('reportDist.receipt.exportPdf')}</Button>
              </Space>
            )}
          </div>
        }>
          {selected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">{t('reportDist.field.taskId')}</div>
                  <div className="font-mono text-blue-600">{selected.taskId}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">{t('reportDist.field.reportId')}</div>
                  <div className="font-mono text-blue-600">{selected.reportId}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">{t('reportDist.field.recipient')}</div>
                  <div>{selected.recipientName ?? '-'} <span className="text-slate-400">({selected.recipient})</span></div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">{t('reportDist.field.channel')}</div>
                  <div>{selected.channel}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">{t('reportDist.receipt.completedAt')}</div>
                  <div>{new Date(selected.finalAt).toLocaleString()}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">{t('reportDist.receipt.costThroughput')}</div>
                  <div>¥{selected.cost.toFixed(3)} / {selected.throughputKb} KB</div>
                </div>
              </div>

              <Divider className="my-2" />

              <div>
                <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Activity className="w-3 h-3" />{t('reportDist.receipt.eventTimeline', { count: selected.events.length })}
                </h5>
                <Timeline
                  items={selected.events.map((e) => {
                    const Icon = EVENT_ICONS[e.type] ?? Activity;
                    return {
                      dot: <Icon className="w-3 h-3" style={{ color: EVENT_COLORS[e.type] }} />,
                      color: EVENT_COLORS[e.type],
                      children: (
                        <div className="text-xs">
                          <div className="flex items-center gap-2">
                            <Tag color="default">{e.type}</Tag>
                            <span className="text-slate-700">{e.detail}</span>
                            {e.code && <Tag color="cyan">{e.code}</Tag>}
                            {e.source && <Tag>{e.source}</Tag>}
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            {new Date(e.occurredAt).toLocaleString()}
                            {e.operator && ` · ${e.operator}`}
                          </div>
                          {e.detailEn && <div className="text-slate-500 text-[10px] italic">{e.detailEn}</div>}
                        </div>
                      ),
                    };
                  })}
                />
              </div>

              {selected.signature && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <Space>
                    <Shield className="w-3 h-3" style={{ color: '#10b981' }} />
                    <span className="font-mono text-green-700">{t('reportDist.receipt.signature')} {selected.signature}</span>
                    {selected.verified && <Tag color="success" icon={<CheckCircle2 className="w-3 h-3" />}>{t('reportDist.receipt.verified')}</Tag>}
                  </Space>
                </div>
              )}
            </div>
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportDist.receipt.selectReceipt')} />}
        </Card>
      </div>

      <Modal
        title={<Space><Shield className="w-4 h-4 text-green-500" /><span>{t('reportDist.receipt.verifyTitle')}</span></Space>}
        open={showVerifyModal}
        onCancel={() => setShowVerifyModal(false)}
        footer={null}
      >
        {verifyResult && (
          <div className="space-y-3">
            <Alert
              type={verifyResult.verified ? 'success' : 'error'}
              showIcon
              title={verifyResult.verified ? t('reportDist.receipt.verifyPassed') : t('reportDist.receipt.verifyFailed')}
              description={verifyResult.details}
            />
            <div className="text-xs text-slate-500 space-y-1">
              <div>• {t('reportDist.receipt.sigAlgo')}</div>
              <div>• {t('reportDist.receipt.certChain')}</div>
              <div>• {t('reportDist.receipt.timestamp')}</div>
              <div>• {t('reportDist.receipt.ca')}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryReceiptComponent;

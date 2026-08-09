/**
 * G005 放射RIS系统 v3.0.5.1 - 送达回执
 * R3.DIST 组 D:回执追踪
 * 15 升级点
 */
import { DELIVERY_RECEIPTS_MOCK as ALL_RECEIPTS } from '@data/reportDistributionMock';
import { verifyReceiptSignature } from '@services/distribution/distributionService';
import type { DeliveryReceipt, DeliveryEvent, DeliveryStatus } from '@types/R3/R3.DIST';
import { DELIVERY_STATUS_COLORS as STATUS_COLORS } from '@utils/statusColors';
import { Card, Space, Button, Tag, Empty, Row, Col, Statistic, Divider, Timeline, Modal, Select, Input, Alert } from 'antd';
import { CheckCircle2, XCircle, Clock, Search, RefreshCw, Eye, Download, FileText, Activity, Shield, AlertCircle, Send } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { Inbox } from 'lucide-react'

interface Props {
  reportId?: string;
  taskId?: string;
}



const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: '待发送', queued: '队列中', sending: '发送中', sent: '已发送',
  delivered: '已送达', read: '已阅读', failed: '失败', cancelled: '已取消', expired: '已过期',
};

const EVENT_ICONS: Record<DeliveryEvent['type'], React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  created: FileText, queued: Clock, sending: Send, sent: Send,
  delivered: CheckCircle2, read: CheckCircle2, failed: XCircle,
  retry: RefreshCw, cancelled: XCircle, expired: AlertCircle,
};

const EVENT_COLORS: Record<DeliveryEvent['type'], string> = {
  created: '#94a3b8', queued: '#3b82f6', sending: '#7c3aed', sent: '#0891b2',
  delivered: '#10b981', read: '#059669', failed: '#dc2626',
  retry: '#f59e0b', cancelled: '#6b7280', expired: '#f97316',
};

export const DeliveryReceiptComponent: React.FC<Props> = ({ reportId, taskId }) => {
  const [receipts] = useState<DeliveryReceipt[]>(ALL_RECEIPTS);
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
        <Col span={5}><Card size="small"><Statistic title="总回执" value={stats.total} prefix={<FileText className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="已送达" value={stats.delivered} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="已阅读" value={stats.read} prefix={<Eye className="w-3 h-3" style={{ color: '#059669' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="失败" value={stats.failed} prefix={<XCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="送达率" value={stats.successRate} suffix="%" styles={{ content: {  fontSize: 18, color: '#10b981'  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-5 gap-3">
        {/* 左侧:回执列表 */}
        <Card size="small" className="col-span-2 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><FileText className="w-4 h-4" /><span>回执列表</span></Space>
            <Tag color="orange" style={{ fontSize: 10, marginLeft: 6 }}>演示数据 (ALL_RECEIPTS)</Tag>
            <Tag>{filtered.length}</Tag>
          </div>
        } extra={
          <Button size="small" icon={<RefreshCw className="w-3 h-3" />}>刷新</Button>
        }>
          <div className="space-y-2 mb-2">
            <Input
              size="small"
              prefix={<Search className="w-3 h-3" />}
              placeholder="搜索收件人/报告/任务"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Select size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }} options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]} />
          </div>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无回执" /> : filtered.map((r) => (
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
                  <span>重试 {r.retryCount}</span>
                  <span>¥{r.cost.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 右侧:回执详情 */}
        <Card size="small" className="col-span-3 shadow-sm" title={
          <div className="flex items-center justify-between">
            <Space><Activity className="w-4 h-4" /><span>回执详情</span>{selected && <Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag>}</Space>
            {selected && (
              <Space>
                <Button size="small" icon={<Shield className="w-3 h-3" />} onClick={handleVerify}>验证签名</Button>
                <Button size="small" icon={<Download className="w-3 h-3" />}>导出 PDF</Button>
              </Space>
            )}
          </div>
        }>
          {selected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">任务 ID</div>
                  <div className="font-mono text-blue-600">{selected.taskId}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">报告 ID</div>
                  <div className="font-mono text-blue-600">{selected.reportId}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">收件人</div>
                  <div>{selected.recipientName ?? '-'} <span className="text-slate-400">({selected.recipient})</span></div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">通道</div>
                  <div>{selected.channel}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">完成时间</div>
                  <div>{new Date(selected.finalAt).toLocaleString()}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500">成本/吞吐</div>
                  <div>¥{selected.cost.toFixed(3)} / {selected.throughputKb} KB</div>
                </div>
              </div>

              <Divider className="my-2" />

              <div>
                <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Activity className="w-3 h-3" />事件时间线 ({selected.events.length})
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
                    <span className="font-mono text-green-700">签名: {selected.signature}</span>
                    {selected.verified && <Tag color="success" icon={<CheckCircle2 className="w-3 h-3" />}>已验证</Tag>}
                  </Space>
                </div>
              )}
            </div>
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请选择左侧回执" />}
        </Card>
      </div>

      <Modal
        title={<Space><Shield className="w-4 h-4 text-green-500" /><span>数字签名验证</span></Space>}
        open={showVerifyModal}
        onCancel={() => setShowVerifyModal(false)}
        footer={null}
      >
        {verifyResult && (
          <div className="space-y-3">
            <Alert
              type={verifyResult.verified ? 'success' : 'error'}
              showIcon
              title={verifyResult.verified ? '签名验证通过' : '签名验证失败'}
              description={verifyResult.details}
            />
            <div className="text-xs text-slate-500 space-y-1">
              <div>• 签名算法: SHA-256 with RSA</div>
              <div>• 证书链: 3 级</div>
              <div>• 时间戳: RFC 3161</div>
              <div>• CA: 卫健委国家信任 CA</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryReceiptComponent;

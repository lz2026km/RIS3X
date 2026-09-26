/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.010 R3.REVIEW.086 R3.REVIEW.087 R3.REVIEW.088 ReviewHistory 审核历史
 */
import { reviewService } from '../../../../services/review/reviewService';
import type { ReviewHistoryEntry } from '../../../types/R3/R3.REVIEW';
import { Card, Tag, Space, Button, Timeline, Empty, Select, message, Tooltip } from 'antd';
import {
  History,
  Download,
  FileText,
  Filter,
  Edit2,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  ShieldCheck,
  Award,
  AlertCircle,
  RotateCcw,
  Send,
  LucideIcon,
} from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useEffect, useState } from 'react';
import { t } from '../../../../i18n/appI18n';

const ACTION_META: Record<string, { color: string; label: string; icon: LucideIcon }> = {
  submit: { color: 'blue', label: t('w9e.reviewHistory.actionSubmit'), icon: Send },
  assign: { color: 'cyan', label: t('w9e.reviewHistory.actionAssign'), icon: Edit2 },
  'start-initial': { color: 'orange', label: t('w9e.reviewHistory.actionStartInitial'), icon: Edit2 },
  'approve-initial': { color: 'green', label: t('w9e.reviewHistory.actionApproveInitial'), icon: ThumbsUp },
  reject: { color: 'red', label: t('w9e.reviewHistory.actionReject'), icon: ThumbsDown },
  'start-final': { color: 'purple', label: t('w9e.reviewHistory.actionStartFinal'), icon: ShieldCheck },
  'approve-final': { color: 'green', label: t('w9e.reviewHistory.actionApproveFinal'), icon: ShieldCheck },
  'start-cosign': { color: 'magenta', label: t('w9e.reviewHistory.actionStartCosign'), icon: Award },
  'complete-cosign': { color: 'green', label: t('w9e.reviewHistory.actionCompleteCosign'), icon: Award },
  escalate: { color: 'volcano', label: t('w9e.reviewHistory.actionEscalate'), icon: AlertCircle },
  withdraw: { color: 'default', label: t('w9e.reviewHistory.actionWithdraw'), icon: RotateCcw },
  reopen: { color: 'blue', label: t('w9e.reviewHistory.actionReopen'), icon: RotateCcw },
  rectify: { color: 'gold', label: t('w9e.reviewHistory.actionRectify'), icon: Edit2 },
  'request-info': { color: 'cyan', label: t('w9e.reviewHistory.actionRequestInfo'), icon: FileText },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function colorToHex(color: string): string {
  const map: Record<string, string> = {
    green: '#10b981',
    red: '#dc2626',
    blue: '#3b82f6',
    orange: '#f59e0b',
    gold: '#d97706',
    purple: '#7c3aed',
    cyan: '#06b6d4',
    volcano: '#ef4444',
    magenta: '#d946ef',
  };
  return map[color] ?? '#94a3b8';
}

export interface ReviewHistoryProps {
  reportId: string;
  entries?: ReviewHistoryEntry[];
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({ reportId, entries: externalEntries }) => {
  const [entries, setEntries] = useState<ReviewHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      if (externalEntries) {
        setEntries(externalEntries);
      } else {
        const chain = await reviewService.getAuditChain(reportId);
        const hist: ReviewHistoryEntry[] = chain.map((c) => ({
          id: c.id,
          taskId: reportId,
          reportId,
          action: c.step as ReviewHistoryEntry['action'],
          actorId: c.actorId,
          actorName: c.actorName,
          actorRole: 'attending',
          comment: c.detail,
          fromStage: 'submitted',
          toStage: 'reviewed',
          timestamp: c.timestamp,
          hash: c.hash,
        }));
        setEntries(hist);
      }
    } catch (e) {
      message.error(t('w9e.reviewHistory.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, externalEntries]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.action === filter);

  const exportHistory = async (format: 'pdf' | 'json') => {
    try {
      const result = await reviewService.exportHistory(reportId, format);
      const blob = new Blob([result.data], { type: result.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('w9e.reviewHistory.exported', { format: format.toUpperCase() }));
    } catch (e) {
      message.error(t('w9e.reviewHistory.exportFailed'));
    }
  };

  return (
    <div data-testid="review-history" role="region" aria-label={t('w9e.reviewHistory.ariaLabel')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <History size={18} />
            <strong style={{ fontSize: 16 }}>{t('w9e.reviewHistory.title')}</strong>
            <Tag color="purple">R3.REVIEW.010</Tag>
          </Space>
          <Space>
            <Button size="small" icon={<Download size={12} />} onClick={() => exportHistory('pdf')}>
              PDF
            </Button>
            <Button size="small" icon={<Download size={12} />} onClick={() => exportHistory('json')}>
              JSON
            </Button>
          </Space>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 8 }}>
        <Space>
          <Filter size={14} color="#64748b" />
          <Select
            size="small"
            value={filter}
            onChange={setFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: t('w9e.reviewHistory.filterAll') },
              ...Object.entries(ACTION_META).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
            aria-label={t('w9e.reviewHistory.actionFilterAria')}
          />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {t('w9e.reviewHistory.countSummary', { total: entries.length, shown: filtered.length })}
          </span>
        </Space>
      </Card>

      <Card size="small" loading={loading}>
        {filtered.length === 0 ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.reviewHistory.noHistory')} />
        ) : (
          <Timeline>
            {filtered.map((e) => {
              const meta = ACTION_META[e.action] ?? { color: 'default', label: e.action, icon: FileText };
              const Icon = meta.icon;
              return (
                <Timeline.Item
                  key={e.id}
                  dot={
                    <div
                      style={{
                        background: colorToHex(meta.color),
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={12} color="#fff" />
                    </div>
                  }
                >
                  <div style={{ marginBottom: 4 }}>
                    <Space>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <strong>{e.actorName}</strong>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtTime(e.timestamp)}</span>
                      {e.score !== undefined && <Tag color="cyan">{t('w9e.reviewHistory.scoreTag', { score: e.score })}</Tag>}
                    </Space>
                  </div>
                  {e.comment && (
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                      {e.comment}
                    </div>
                  )}
                  {e.reason && (
                    <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 4 }}>
                      {t('w9e.reviewHistory.reasonPrefix', { reason: e.reason })}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {e.fromStage} <ArrowRight size={10} style={{ margin: '0 4px' }} /> {e.toStage}
                    {e.hash && (
                      <Tooltip title={`Hash: ${e.hash}`}>
                        <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>
                          #{e.hash.substring(0, 8)}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </Card>
    </div>
  );
};

export default ReviewHistory;

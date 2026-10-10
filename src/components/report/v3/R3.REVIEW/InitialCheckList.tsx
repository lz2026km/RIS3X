/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.001 InitialCheckList 初核清单
 */
import { reviewService } from '../../../../services/review/reviewService';
import type { ReviewTask, ReviewStage, ReviewFilter } from '../../../types/R3/R3.REVIEW';
import { List, Tag, Space, Button, Empty, Input, Select, Statistic, Row, Col, Tooltip, message, Modal } from 'antd';
import { Eye, AlertTriangle, Search, FileText, Filter, Clock, User, AlertCircle, ListChecks, Sparkles, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

const STAGE_META: Record<ReviewStage, { color: string; label: string; bg: string }> = {
  initial: { color: 'var(--color-warning-500)', label: 'reportReview.stage.initial', bg: 'var(--color-warning-bg)' },
  final: { color: '#7c2d12', label: 'reportReview.stage.final', bg: 'var(--color-warning-bg)' },
  cosign: { color: '#7c3aed', label: 'reportReview.stage.cosign', bg: 'var(--color-info-bg)' },
  sign: { color: '#be185d', label: 'reportReview.stage.sign', bg: 'var(--color-pending-bg)' },
};

const STATUS_META: Record<ReviewTask['status'], { color: string; label: string; bg: string }> = {
  pending: { color: 'var(--color-warning-500)', label: 'reportReview.status.pending', bg: 'var(--color-warning-bg)' },
  'in-progress': { color: 'var(--color-info-600)', label: 'reportReview.status.inProgress', bg: 'var(--color-info-bg)' },
  completed: { color: '#10b981', label: 'reportReview.status.completed', bg: 'var(--color-success-bg)' },
  rejected: { color: 'var(--color-error-600)', label: 'reportReview.status.rejected', bg: 'var(--color-error-bg)' },
  overdue: { color: '#7f1d1d', label: 'reportReview.status.overdueMarked', bg: 'var(--color-error-bg)' },
  escalated: { color: '#7c3aed', label: 'reportReview.status.escalated', bg: 'var(--color-info-bg)' },
  'cosign-required': { color: '#7c3aed', label: 'reportReview.status.cosignRequired', bg: 'var(--color-info-bg)' },
};

const PRIORITY_META: Record<ReviewTask['priority'], { color: string; label: string; rank: number }> = {
  stat: { color: 'red', label: 'reportReview.priority.stat', rank: 0 },
  critical: { color: 'volcano', label: 'reportReview.priority.critical', rank: 0 },
  urgent: { color: 'orange', label: 'reportReview.priority.urgent', rank: 1 },
  routine: { color: 'default', label: 'reportReview.priority.routine', rank: 2 },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('reportReview.justNow');
  if (m < 60) return t('w9e.initialCheckList.timeMinutesAgo', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('w9e.initialCheckList.timeHoursAgo', { count: h });
  return t('w9e.initialCheckList.timeDaysAgo', { count: Math.floor(h / 24) });
}

function deadlineInfo(
  _deadline: string,
  isOverdue: boolean,
  hoursToDeadline: number,
): { label: string; color: string } {
  if (isOverdue) return { label: t('w9e.initialCheckList.overdue', { hours: Math.abs(hoursToDeadline) }), color: 'var(--color-error-600)' };
  if (hoursToDeadline < 2) return { label: t('w9e.initialCheckList.withinHours', { hours: hoursToDeadline }), color: 'var(--color-warning-500)' };
  return { label: t('w9e.initialCheckList.afterHours', { hours: hoursToDeadline }), color: '#64748b' };
}

export interface InitialCheckListProps {
  onSelect?: (t: ReviewTask) => void;
  selectedId?: string | null;
  limit?: number;
}

export const InitialCheckList: React.FC<InitialCheckListProps> = ({
  onSelect,
  selectedId,
  limit = 200,
}) => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>({ stage: 'initial' });
  const [search, setSearch] = useState('');
  const [detailTask, setDetailTask] = useState<ReviewTask | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await reviewService.listTasks({ ...filter, search });
      const sorted = data.sort(
        (a, b) =>
          PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
          a.hoursToDeadline - b.hoursToDeadline,
      );
      setTasks(sorted.slice(0, limit));
    } catch (e) {
      message.error(t('reportReview.initial.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.stage, filter.status, filter.priority]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in-progress').length,
      overdue: tasks.filter((t) => t.isOverdue).length,
      critical: tasks.filter((t) => t.criticalFinding).length,
    };
  }, [tasks]);

  return (
    <div data-testid="initial-check-list" role="region" aria-label={t('reportReview.initial.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-800) 0%, #7c3aed 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 'var(--space-3, 12px)',
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <ListChecks size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.initial.title')}</strong>
            <Tag color="purple" style={{ marginLeft: 'var(--space-2, 8px)' }}>
              R3.REVIEW.001
            </Tag>
          </Space>
          <Space>
            <Input
              size="small"
              prefix={<Search size={12} />}
              placeholder={t('reportReview.initial.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={load}
              style={{ width: 200 }}
              aria-label={t('reportReview.initial.searchAria')}
            />
            <Button size="small" onClick={load}>
              {t('reportReview.common.refresh')}
            </Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.initial.total')}</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<FileText size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.status.pending')}</span>}
              value={stats.pending}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.status.inProgress')}</span>}
              value={stats.inProgress}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Eye size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.status.overdue')}</span>}
              value={stats.overdue}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
              prefix={<AlertCircle size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.priority.critical')}</span>}
              value={stats.critical}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
        </Row>
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          padding: '8px 12px',
          borderRadius: 6,
          marginBottom: 'var(--space-2, 8px)',
          border: '1px solid var(--border-color)',
        }}
      >
        <Space wrap>
          <Filter size={14} color="#64748b" />
          <Select
            size="small"
            value={filter.status || 'all'}
            onChange={(v) => setFilter({ ...filter, status: v })}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: t('reportReview.initial.allStatus') },
              { value: 'pending', label: t('reportReview.status.pending') },
              { value: 'in-progress', label: t('reportReview.status.inProgress') },
              { value: 'overdue', label: t('reportReview.status.overdue') },
              { value: 'rejected', label: t('reportReview.initial.rejected') },
            ]}
            aria-label={t('reportReview.initial.statusFilterAria')}
          />
          <Select
            size="small"
            value={filter.priority || 'all'}
            onChange={(v) => setFilter({ ...filter, priority: v })}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: t('reportReview.initial.allPriority') },
              { value: 'stat', label: t('reportReview.priority.stat') },
              { value: 'critical', label: t('reportReview.priority.critical') },
              { value: 'urgent', label: t('reportReview.priority.urgent') },
              { value: 'routine', label: t('reportReview.priority.routine') },
            ]}
            aria-label={t('reportReview.initial.priorityFilterAria')}
          />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('reportReview.initial.showing')} {tasks.length} {t('reportReview.initial.items')}</span>
        </Space>
      </div>

      <List
        loading={loading}
        dataSource={tasks}
        locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.initial.empty')} /> }}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: 'var(--space-1, 4px)',
          maxHeight: 600,
          overflowY: 'auto',
        }}
        renderItem={(task) => {
          const stageConf = STAGE_META[task.stage];
          const statusConf = STATUS_META[task.status] ?? STATUS_META.pending;
          const priConf = PRIORITY_META[task.priority] ?? PRIORITY_META.routine;
          const dl = deadlineInfo(task.deadline, task.isOverdue, task.hoursToDeadline);
          return (
            <List.Item
              key={task.id}
              onClick={() => onSelect?.(task)}
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 6,
                background:
                  task.id === selectedId ? 'var(--color-info-bg)' : task.isOverdue ? 'var(--color-error-bg)' : 'transparent',
                borderLeft:
                  task.id === selectedId
                    ? '3px solid var(--color-primary-500)'
                    : task.isOverdue
                      ? '3px solid var(--color-error-600)'
                      : '3px solid transparent',
                marginBottom: 'var(--space-1, 4px)',
                transition: 'all 0.15s',
              }}
              data-testid={`initial-check-item-${task.id}`}
              role="button"
              aria-label={t('reportReview.initial.taskAria', { patient: task.patientName, modality: task.modality, bodyPart: task.bodyPart })}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelect?.(task);
              }}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: task.criticalFinding ? 'var(--color-error-bg)' : stageConf.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {task.criticalFinding ? (
                      <AlertTriangle size={18} color="var(--color-error-600)" />
                    ) : (
                      <FileText size={18} color={stageConf.color} />
                    )}
                  </div>
                }
                title={
                  <Space wrap>
                    <span style={{ fontWeight: 600 }}>{task.patientName}</span>
                    <Tag color="blue">{task.modality}</Tag>
                    <Tag>{task.bodyPart}</Tag>
                    <Tag color={priConf.color}>{t(priConf.label)}</Tag>
                    <Tag color={statusConf.color}>{t(statusConf.label)}</Tag>
                    {task.criticalFinding && (
                      <Tag color="red" icon={<AlertTriangle size={10} />}>
                        {t('reportReview.priority.critical')}
                      </Tag>
                    )}
                    {task.needsCosign && (
                      <Tag color="purple" icon={<Sparkles size={10} />}>
                        {t('reportReview.status.cosignRequired')}
                      </Tag>
                    )}
                    {task.rectifyCount > 0 && <Tag color="orange">{t('reportReview.initial.rectify')} {task.rectifyCount}/3</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      <User size={10} /> {t('reportReview.initial.reportDoctor')}{task.authorTitle} {task.authorName} · {t('reportReview.initial.qualityScore')}{' '}
                      <strong
                        style={{
                          color:
                            task.qualityScore >= 90 ? '#10b981' : task.qualityScore >= 75 ? 'var(--color-warning-500)' : 'var(--color-error-600)',
                        }}
                      >
                        {task.qualityScore}
                      </strong>{' '}
                      · {t('reportReview.initial.submitted')} {timeAgo(task.submittedAt)}
                    </div>
                    <div
                      style={{ fontSize: 12, color: dl.color, marginTop: 2, fontWeight: 600 }}
                    >
                      <Clock size={10} /> {dl.label} · {t('reportReview.initial.reportId')}{task.reportId}
                    </div>
                  </div>
                }
              />
              <Tooltip title={t('reportReview.initial.viewDetail')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ChevronRight size={14} />}
                  aria-label={t('reportReview.initial.viewDetail')}
                  onClick={(e) => { e.stopPropagation(); setDetailTask(task); }}
                />
              </Tooltip>
            </List.Item>
          );
        }}
      />

      <Modal
        title={t('w1Buttons.checklist.detailTitle')}
        open={detailTask !== null}
        onCancel={() => setDetailTask(null)}
        footer={
          <Space>
            <Button onClick={() => setDetailTask(null)}>{t('w1Buttons.checklist.close')}</Button>
            <Button type="primary" onClick={() => { if (detailTask) onSelect?.(detailTask); setDetailTask(null); }}>
              {t('w1Buttons.checklist.openReport')}
            </Button>
          </Space>
        }
        width={640}
      >
        {detailTask && (
          <Space orientation="vertical" style={{ width: '100%' }} size={6}>
            {([
              [t('w1Buttons.checklist.patient'), detailTask.patientName],
              [t('w1Buttons.checklist.reportId'), detailTask.reportId],
              [t('w1Buttons.checklist.modality'), detailTask.modality],
              [t('w1Buttons.checklist.bodyPart'), detailTask.bodyPart],
              [t('w1Buttons.checklist.priority'), t(PRIORITY_META[detailTask.priority]?.label ?? 'reportReview.priority.routine')],
              [t('w1Buttons.checklist.status'), t((STATUS_META[detailTask.status] ?? STATUS_META.pending).label)],
              [t('w1Buttons.checklist.qualityScore'), String(detailTask.qualityScore)],
              [t('w1Buttons.checklist.author'), `${detailTask.authorTitle} ${detailTask.authorName}`],
              [t('w1Buttons.checklist.submittedAt'), new Date(detailTask.submittedAt).toLocaleString()],
              [t('w1Buttons.checklist.deadline'), deadlineInfo(detailTask.deadline, detailTask.isOverdue, detailTask.hoursToDeadline).label],
              [t('w1Buttons.checklist.rectify'), `${detailTask.rectifyCount}/3`],
              [t('w1Buttons.checklist.critical'), detailTask.criticalFinding ? t('w1Buttons.checklist.yes') : t('w1Buttons.checklist.no')],
              [t('w1Buttons.checklist.cosign'), detailTask.needsCosign ? t('w1Buttons.checklist.yes') : t('w1Buttons.checklist.no')],
            ] as Array<[string, string]>).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 'var(--space-3, 12px)', fontSize: 12, padding: '6px 8px', background: 'var(--bg-deep, #f8fafc)', borderRadius: 6 }}>
                <span style={{ width: 110, color: 'var(--text-secondary, #64748b)', flexShrink: 0 }}>{k}</span>
                <span style={{ color: 'var(--text-primary, #1e293b)' }}>{v}</span>
              </div>
            ))}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default InitialCheckList;

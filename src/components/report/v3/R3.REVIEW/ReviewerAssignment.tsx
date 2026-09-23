/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.020 R3.REVIEW.021 R3.REVIEW.022 ReviewerAssignment 审核员指派
 */
import React, { useEffect, useState } from 'react';
import { Card, Tag, Space, Button, Row, Col, Statistic, Avatar, Progress, message, List } from 'antd';
import {
  UserCheck,
  Users,
  Shuffle,
  Target,
  Briefcase,
  Zap,
  Clock,
} from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { Reviewer, ReviewerAssignment as ReviewerAssignmentType, ReviewerStatus, ReviewTask, ReviewStage } from '../../../types/R3/R3.REVIEW';
import { t } from '../../../../i18n/appI18n';

const STAGE_META: Record<ReviewStage, { label: string; color: string }> = {
  initial: { label: 'reportReview.stage.initial', color: 'orange' },
  final: { label: 'reportReview.stage.final', color: 'purple' },
  cosign: { label: 'reportReview.stage.cosign', color: 'magenta' },
  sign: { label: 'reportReview.stage.sign', color: 'pink' },
};

const STATUS_META: Record<ReviewerStatus, { color: string; label: string }> = {
  online: { color: 'green', label: 'reportReview.assign.status.online' },
  away: { color: 'gold', label: 'reportReview.assign.status.away' },
  busy: { color: 'red', label: 'reportReview.assign.status.busy' },
  offline: { color: 'default', label: 'reportReview.assign.status.offline' },
};

type Strategy = 'manual' | 'auto-workload' | 'auto-shift' | 'round-robin';

export interface ReviewerAssignmentProps {
  task: ReviewTask | null;
  onAssigned?: (a: ReviewerAssignmentType) => void;
}

export const ReviewerAssignment: React.FC<ReviewerAssignmentProps> = ({ task, onAssigned }) => {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('auto-workload');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUserId = 'D001';

  const load = async () => {
    setLoading(true);
    try {
      const data = await reviewService.listReviewers();
      setReviewers(data);
    } catch (e) {
      message.error(t('reportReview.assign.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssign = async () => {
    if (!task || !selected) {
      message.warning(t('reportReview.assign.selectReviewer'));
      return;
    }
    const reviewer = reviewers.find((r) => r.id === selected);
    if (!reviewer) return;
    setSubmitting(true);
    try {
      const result = await reviewService.assignReviewer(
        task.id,
        reviewer.id,
        reviewer.name,
        currentUserId,
        strategy,
      );
      message.success(t('reportReview.assign.assignedTo', { name: reviewer.name }));
      onAssigned?.(result);
    } catch (e) {
      message.error(t('reportReview.assign.assignFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const autoAssign = (mode: 'workload' | 'shift' | 'round-robin') => {
    const available = reviewers.filter((r) => r.status === 'online' && r.currentLoad < r.maxLoad);
    if (available.length === 0) {
      message.warning(t('reportReview.assign.noAvailable'));
      return;
    }
    let chosen: Reviewer | undefined;
    if (mode === 'workload') {
      chosen = available.sort(
        (a, b) => a.currentLoad / a.maxLoad - b.currentLoad / b.maxLoad,
      )[0];
    } else if (mode === 'round-robin') {
      chosen = available[Math.floor(Math.random() * available.length)];
    } else {
      chosen = available[0];
    }
    if (chosen) {
      setSelected(chosen.id);
      setStrategy(
        mode === 'workload'
          ? 'auto-workload'
          : mode === 'round-robin'
            ? 'round-robin'
            : 'auto-shift',
      );
      message.success(t('reportReview.assign.autoSelected', { name: chosen.name }));
    }
  };

  const renderLoadBar = (r: Reviewer) => {
    const pct = Math.round((r.currentLoad / r.maxLoad) * 100);
    return (
      <Progress
        percent={pct}
        size="small"
        strokeColor={pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : '#10b981'}
      />
    );
  };

  return (
    <div data-testid="reviewer-assignment" role="region" aria-label={t('reportReview.assign.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <UserCheck size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.assign.title')}</strong>
            <Tag color="purple">R3.REVIEW.020</Tag>
          </Space>
        </Space>
        {task && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <strong>{t('reportReview.assign.currentTask')}</strong>
            {task.patientName} · {task.modality} {task.bodyPart} · {t(STAGE_META[task.stage].label)}
          </div>
        )}
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.assign.available')}</span>}
              value={reviewers.filter((r) => r.status === 'online').length}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Users size={14} />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.assign.totalPending')}</span>}
              value={reviewers.reduce((a, r) => a + r.pendingCount, 0)}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.assign.completedToday')}</span>}
              value={reviewers.reduce((a, r) => a + r.completedToday, 0)}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Zap size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Card title={t('reportReview.assign.autoStrategy')} size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Button icon={<Briefcase size={12} />} onClick={() => autoAssign('workload')}>
            {t('reportReview.assign.byWorkload')}
          </Button>
          <Button icon={<Shuffle size={12} />} onClick={() => autoAssign('round-robin')}>
            {t('reportReview.assign.roundRobin')}
          </Button>
          <Button icon={<Target size={12} />} onClick={() => autoAssign('shift')}>
            {t('reportReview.assign.byShift')}
          </Button>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {t('reportReview.assign.currentStrategy')}<Tag color="cyan">{strategy}</Tag>
          </span>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <Users size={14} />
            {t('reportReview.assign.reviewerList')}
          </Space>
        }
        size="small"
        loading={loading}
      >
        <List
          dataSource={reviewers}
          renderItem={(r) => (
            <List.Item
              key={r.id}
              onClick={() => setSelected(r.id)}
              style={{
                cursor: 'pointer',
                padding: 10,
                marginBottom: 4,
                borderRadius: 4,
                background: selected === r.id ? '#ecfdf5' : 'transparent',
                border: selected === r.id ? '1px solid #10b981' : '1px solid transparent',
              }}
              data-testid={`reviewer-${r.id}`}
              role="button"
              aria-label={t('reportReview.assign.reviewerAria', { name: r.name })}
              tabIndex={0}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ position: 'relative' }}>
                    <Avatar size={36} style={{ background: '#3b82f6' }}>
                      {r.name[0]}
                    </Avatar>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background:
                          STATUS_META[r.status].color === 'green'
                            ? '#10b981'
                            : STATUS_META[r.status].color === 'gold'
                              ? '#f59e0b'
                              : STATUS_META[r.status].color === 'red'
                                ? '#dc2626'
                                : '#94a3b8',
                        border: '2px solid #fff',
                      }}
                    />
                  </div>
                }
                title={
                  <Space>
                    <strong>{r.name}</strong>
                    <Tag color="purple">{r.titleLabel}</Tag>
                    <Tag color={STATUS_META[r.status].color}>{t(STATUS_META[r.status].label)}</Tag>
                    {selected === r.id && <Tag color="green">{t('reportReview.assign.selected')}</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {t('reportReview.assign.specialty')}{r.specialty.join('/')}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        display: 'flex',
                        gap: 12,
                        fontSize: 12,
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        {t('reportReview.assign.load')}{r.currentLoad}/{r.maxLoad}
                      </span>
                      {renderLoadBar(r)}
                      <span>{t('reportReview.assign.pending')} {r.pendingCount}</span>
                      <span>{t('reportReview.assign.today')} {r.completedToday}</span>
                      <span style={{ color: r.onTimeRate >= 90 ? '#10b981' : '#f59e0b' }}>
                        {t('reportReview.assign.onTime')} {r.onTimeRate}%
                      </span>
                    </div>
                  </div>
                }
              />
              <Button
                type="primary"
                size="small"
                icon={<UserCheck size={12} />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(r.id);
                }}
              >
                {t('reportReview.assign.select')}
              </Button>
            </List.Item>
          )}
        />
      </Card>

      {selected && task && (
        <Card style={{ marginTop: 12 }}>
          <Space>
            <Button
              type="primary"
              icon={<UserCheck size={12} />}
              loading={submitting}
              onClick={handleAssign}
            >
              {t('reportReview.assign.confirmAssign')} {reviewers.find((r) => r.id === selected)?.name}
            </Button>
            <Button onClick={() => setSelected(null)}>{t('reportReview.assign.cancel')}</Button>
          </Space>
        </Card>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
        {t('reportReview.assign.assignStrategy')}{strategy === 'auto-workload' ? t('reportReview.assign.balancedWorkload') : strategy}
      </div>
    </div>
  );
};

export default ReviewerAssignment;

/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.246 R3.REVIEW.247 R3.REVIEW.248 R3.REVIEW.249 R3.REVIEW.250 ReviewWorkloadStats 工作量统计
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space, Select, Progress, message } from 'antd';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Activity,
  Award,
  Target,
} from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { WorkloadStat, Reviewer, ReviewStage } from '../../../types/R3/R3.REVIEW';
import {
  Bar,
  Line,
  Pie,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  PieChart,
  Cell,
} from 'recharts';
import ChartContainer from '../../../charts/ChartContainer';
import { t } from '../../../../i18n/appI18n';

const STAGE_COLORS: Record<ReviewStage, string> = {
  initial: '#f59e0b',
  final: '#7c2d12',
  cosign: '#7c3aed',
  sign: '#be185d',
};

const STAGE_LABELS: Record<ReviewStage, string> = {
  initial: 'reportReview.stage.initial',
  final: 'reportReview.stage.final',
  cosign: 'reportReview.stage.cosign',
  sign: 'reportReview.stage.sign',
};

const TITLE_LABEL: Record<string, string> = {
  chief: 'reportReview.title.chief',
  associateChief: 'reportReview.title.associateChief',
  attending: 'reportReview.title.attending',
  resident: 'reportReview.title.resident',
  director: 'reportReview.title.director',
};

export const ReviewWorkloadStats: React.FC = () => {
  const [stats, setStats] = useState<WorkloadStat[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        reviewService.getWorkloadStats(),
        reviewService.listReviewers(),
      ]);
      setStats(s);
      setReviewers(r);
    } catch (e) {
      message.error(t('reportReview.workload.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [period]);

  const overallStats = useMemo(() => {
    const total = stats.reduce((a, s) => a + s.totalCompleted, 0);
    const rejected = stats.reduce((a, s) => a + s.totalRejected, 0);
    const avgTime =
      stats.length > 0
        ? Math.round(stats.reduce((a, s) => a + s.averageMinutes, 0) / stats.length)
        : 0;
    const onTime =
      stats.length > 0
        ? (stats.reduce((a, s) => a + s.onTimeRate, 0) / stats.length).toFixed(1)
        : '0';
    return { total, rejected, avgTime, onTime };
  }, [stats]);

  const byStageData = useMemo(() => {
    const map: Record<string, number> = { initial: 0, final: 0, cosign: 0, sign: 0 };
    stats.forEach((s) =>
      s.byStage.forEach((b: WorkloadStat['byStage'][number]) => {
        map[b.stage] = (map[b.stage] ?? 0) + b.count;
      }),
    );
    return Object.entries(map).map(([stage, count]) => ({ stage, count }));
  }, [stats]);

  const byModalityData = useMemo(() => {
    const map: Record<string, number> = {};
    stats.forEach((s) =>
      s.byModality.forEach((b: WorkloadStat['byModality'][number]) => {
        map[b.modality] = (map[b.modality] ?? 0) + b.count;
      }),
    );
    return Object.entries(map).map(([modality, count]) => ({ modality, count }));
  }, [stats]);

  const trendData = useMemo(() => {
    if (stats.length === 0) return [];
    const dates = stats[0]?.trend.map((t: WorkloadStat['trend'][number]) => t.date) ?? [];
    return dates.map((date: string, idx: number) => {
      const row: { date: string; [key: string]: string | number } = { date: date.slice(5) };
      stats.forEach((s) => {
        const t = s.trend[idx];
        if (t) row[s.reviewerName] = t.completed;
      });
      return row;
    });
  }, [stats]);

  const columns = [
    {
      title: t('reportReview.workload.colReviewer'),
      dataIndex: 'reviewerName',
      key: 'reviewerName',
      render: (v: string, r: WorkloadStat) => (
        <Space>
          <Award size={12} color="#7c3aed" />
          <strong>{v}</strong>
          <Tag color="purple">{t(TITLE_LABEL[r.reviewerTitle] ?? r.reviewerTitle)}</Tag>
        </Space>
      ),
    },
    {
      title: t('reportReview.workload.colCompleted'),
      dataIndex: 'totalCompleted',
      key: 'totalCompleted',
      sorter: (a: WorkloadStat, b: WorkloadStat) => a.totalCompleted - b.totalCompleted,
    },
    {
      title: t('reportReview.workload.colRejected'),
      dataIndex: 'totalRejected',
      key: 'totalRejected',
      render: (v: number) => <Tag color={v > 5 ? 'red' : 'orange'}>{v}</Tag>,
    },
    {
      title: t('reportReview.workload.colAvgTime'),
      dataIndex: 'averageMinutes',
      key: 'averageMinutes',
      render: (v: number) => (
        <span style={{ color: v > 90 ? '#dc2626' : v > 75 ? '#f59e0b' : '#10b981' }}>
          {v}{t('reportReview.workload.minutes')}
        </span>
      ),
    },
    {
      title: t('reportReview.workload.colOnTime'),
      dataIndex: 'onTimeRate',
      key: 'onTimeRate',
      sorter: (a: WorkloadStat, b: WorkloadStat) => a.onTimeRate - b.onTimeRate,
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={v >= 90 ? '#10b981' : v >= 80 ? '#f59e0b' : '#dc2626'}
        />
      ),
    },
    {
      title: t('reportReview.workload.colRejectRate'),
      dataIndex: 'rejectionRate',
      key: 'rejectionRate',
      render: (v: number) => (
        <Tag color={v > 15 ? 'red' : v > 10 ? 'orange' : 'green'}>{v}%</Tag>
      ),
    },
  ];

  return (
    <div data-testid="review-workload-stats" role="region" aria-label={t('reportReview.workload.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #3b82f6 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <BarChart3 size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.workload.title')}</strong>
            <Tag color="purple">R3.REVIEW.246</Tag>
          </Space>
          <Select
            size="small"
            value={period}
            onChange={(v) => setPeriod(v as 'day' | 'week' | 'month')}
            style={{ width: 100 }}
            options={[
              { value: 'day', label: t('reportReview.workload.today') },
              { value: 'week', label: t('reportReview.workload.thisWeek') },
              { value: 'month', label: t('reportReview.workload.thisMonth') },
            ]}
          />
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.workload.totalCompleted')}</span>}
              value={overallStats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.workload.totalRejected')}</span>}
              value={overallStats.rejected}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<XCircle size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.workload.avgTime')}</span>}
              value={overallStats.avgTime}
              suffix={t('reportReview.workload.minutes')}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.workload.avgOnTime')}</span>}
              value={overallStats.onTime}
              suffix="%"
              styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }}
              prefix={<Target size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card title={t('reportReview.workload.byStage')} size="small">
            <ChartContainer height={200} state={byStageData.length > 0 ? 'ready' : 'empty'} emptyDescription={t('reportReview.common.noData')}>
              <BarChart data={byStageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} tickFormatter={(v) => t(STAGE_LABELS[v as ReviewStage] ?? v)} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name={t('reportReview.workload.count')}>
                  {byStageData.map((d) => (
                    <Cell
                      key={d.stage}
                      fill={STAGE_COLORS[d.stage as ReviewStage] ?? '#94a3b8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title={t('reportReview.workload.byModality')} size="small">
            <ChartContainer height={200} state={byModalityData.length > 0 ? 'ready' : 'empty'} emptyDescription={t('reportReview.common.noData')}>
              <PieChart>
                <Pie
                  data={byModalityData}
                  dataKey="count"
                  nameKey="modality"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label
                >
                  {byModalityData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={['#3b82f6', '#10b981', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2'][i % 6]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title={t('reportReview.workload.reviewerLoad')} size="small">
            <ChartContainer height={200} state={reviewers.length > 0 ? 'ready' : 'empty'} emptyDescription={t('reportReview.common.noData')}>
              <BarChart
                data={reviewers
                  .slice(0, 6)
                  .map((r) => ({ name: r.name.substring(0, 2), load: r.currentLoad, max: r.maxLoad }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="load" fill="#3b82f6" name={t('reportReview.workload.current')} />
                <Bar dataKey="max" fill="#e2e8f0" name={t('reportReview.workload.max')} />
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <Activity size={14} />
            {t('reportReview.workload.trend')}
          </Space>
        }
        size="small"
        style={{ marginBottom: 12 }}
      >
        <ChartContainer height={220} state={trendData.length > 0 ? 'ready' : 'empty'} emptyDescription={t('reportReview.common.noData')}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {stats.slice(0, 5).map((s, i) => (
              <Line
                key={s.reviewerId}
                type="monotone"
                dataKey={s.reviewerName}
                stroke={['#3b82f6', '#10b981', '#f59e0b', '#7c3aed', '#dc2626'][i]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </Card>

      <Card
        title={
          <Space>
            <Users size={14} />
            {t('reportReview.workload.reviewerDetail')}
          </Space>
        }
        size="small"
        loading={loading}
      >
        <Table
          dataSource={stats}
          columns={columns}
          rowKey="reviewerId"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default ReviewWorkloadStats;

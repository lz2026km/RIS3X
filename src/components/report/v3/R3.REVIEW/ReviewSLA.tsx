/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.027 R3.REVIEW.028 R3.REVIEW.071 ReviewSLA SLA 监控
 */
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Space, Progress, Alert, message } from 'antd';
import {
  Clock,
  AlertTriangle,
  Target,
  TrendingUp,
  Settings,
  CheckCircle2,
  Zap,
  BarChart3,
} from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { SLAMetrics, ReviewStage } from '../../../types/R3/R3.REVIEW';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import ChartContainer from '../../../charts/ChartContainer';
import { t } from '../../../../i18n/appI18n';

const STAGE_META: Record<ReviewStage, { label: string; color: string }> = {
  initial: { label: 'reportReview.stage.initial', color: '#f59e0b' },
  final: { label: 'reportReview.stage.final', color: '#7c2d12' },
  cosign: { label: 'reportReview.stage.cosign', color: '#7c3aed' },
  sign: { label: 'reportReview.stage.sign', color: '#be185d' },
};

export const ReviewSLA: React.FC = () => {
  const [sla, setSla] = useState<SLAMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await reviewService.getSLA();
      setSla(data);
    } catch (e) {
      message.error(t('reportReview.sla.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !sla) {
    return (
      <div
        role="status"
        aria-label={t('reportReview.sla.loading')}
        data-testid="sla-loading"
        style={{ padding: 40, textAlign: 'center' }}
      >
        {t('reportReview.sla.loading')}
      </div>
    );
  }

  const breachData = Object.entries(sla.breachByStage).map(([stage, count]) => ({
    stage: t(STAGE_META[stage as ReviewStage].label),
    color: STAGE_META[stage as ReviewStage].color,
    count,
  }));

  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    initial: 60 + Math.sin(h / 3) * 30 + Math.random() * 20,
    final: 40 + Math.sin(h / 3) * 20 + Math.random() * 15,
    cosign: 15 + Math.sin(h / 4) * 10 + Math.random() * 8,
  }));

  return (
    <div data-testid="review-sla" role="region" aria-label={t('reportReview.sla.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Clock size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.sla.title')}</strong>
            <Tag color="purple">R3.REVIEW.027</Tag>
          </Space>
          <Tag icon={<Settings size={12} />} color="orange">
            {t('reportReview.sla.threshold', { initial: sla.initialReviewSLA, final: sla.finalReviewSLA, sign: sla.signSLA, cosign: sla.cosignSLA })}
          </Tag>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.sla.onTimeRate')}</span>}
              value={sla.onTimeRate}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.sla.overdueTasks')}</span>}
              value={sla.overdueCount}
              styles={{ content: {  color: '#fca5a5', fontSize: 20  } }}
              prefix={<AlertTriangle size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.sla.avgInitial')}</span>}
              value={sla.averageInitialMinutes}
              suffix={t('reportReview.sla.minutes')}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Clock size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.sla.avgFinal')}</span>}
              value={sla.averageFinalMinutes}
              suffix={t('reportReview.sla.minutes')}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Clock size={16} />}
            />
          </Col>
        </Row>
      </div>

      <Alert
        type={sla.onTimeRate >= 90 ? 'success' : sla.onTimeRate >= 80 ? 'warning' : 'error'}
        message={
          <Space>
            <Zap size={14} />
            <span>
              {sla.onTimeRate >= 90
                ? t('reportReview.sla.good')
                : sla.onTimeRate >= 80
                  ? t('reportReview.sla.nearThreshold')
                  : t('reportReview.sla.critical')}
            </span>
          </Space>
        }
        description={
          <div>
            <div>
              {t('reportReview.sla.p95Initial')} <strong>{sla.p95InitialMinutes}{t('reportReview.sla.minutes')}</strong>,{t('reportReview.sla.p95Final')}{' '}
              <strong>{sla.p95FinalMinutes}{t('reportReview.sla.minutes')}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              {t('reportReview.sla.overdueCount')}<strong>{sla.overdueCount}</strong>,{t('reportReview.sla.overdueRate')}{' '}
              <strong>{(100 - sla.onTimeRate).toFixed(1)}%</strong>
            </div>
          </div>
        }
        showIcon
        style={{ marginBottom: 12 }}
      />

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Card title={t('reportReview.sla.byStage')} size="small">
            <ChartContainer height={200} state={breachData.length > 0 ? 'ready' : 'empty'} emptyDescription={t('reportReview.common.noData')}>
              <BarChart data={breachData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name={t('reportReview.sla.overdueCountLabel')}>
                  {breachData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={t('reportReview.sla.hourly')} size="small">
            <ChartContainer height={200} state={hourlyData.length > 0 ? 'ready' : 'empty'} emptyDescription={t('reportReview.common.noData')}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="initial"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name={t('reportReview.stage.initial')}
                />
                <Line
                  type="monotone"
                  dataKey="final"
                  stroke="#7c2d12"
                  strokeWidth={2}
                  name={t('reportReview.stage.final')}
                />
                <Line
                  type="monotone"
                  dataKey="cosign"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  name={t('reportReview.stage.cosign')}
                />
              </LineChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={8}>
          <Card
            title={
              <Space>
                <CheckCircle2 size={14} color="#10b981" />
                {t('reportReview.sla.achieved')}
              </Space>
            }
            size="small"
          >
            <Progress percent={sla.onTimeRate} strokeColor="#10b981" />
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              {t('reportReview.sla.achievedDesc')}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <TrendingUp size={14} color="#3b82f6" />
                {t('reportReview.sla.avgDuration')}
              </Space>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <Tag color="orange">{t('reportReview.stage.initial')}</Tag> <strong>{sla.averageInitialMinutes}</strong> {t('reportReview.sla.minutes')}
              </div>
              <div>
                <Tag color="purple">{t('reportReview.stage.final')}</Tag> <strong>{sla.averageFinalMinutes}</strong> {t('reportReview.sla.minutes')}
              </div>
              <div>
                <Tag color="cyan">{t('reportReview.stage.cosign')}</Tag> <strong>{sla.averageCosignMinutes}</strong> {t('reportReview.sla.minutes')}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <BarChart3 size={14} color="#7c3aed" />
                {t('reportReview.sla.p95Duration')}
              </Space>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <Tag color="orange">{t('reportReview.sla.p95InitialTag')}</Tag> <strong>{sla.p95InitialMinutes}</strong> {t('reportReview.sla.minutes')}
              </div>
              <div>
                <Tag color="purple">{t('reportReview.sla.p95FinalTag')}</Tag> <strong>{sla.p95FinalMinutes}</strong> {t('reportReview.sla.minutes')}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                {t('reportReview.sla.p95Desc')}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReviewSLA;

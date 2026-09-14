/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.045 R3.REVIEW.046 R3.REVIEW.066 ReviewAIHint AI 预读
 */
import React, { useEffect, useState } from 'react';
import { Card, Tag, Space, Button, Row, Col, Progress, Statistic, Spin, Alert, message } from 'antd';
import { Sparkles, AlertTriangle, RefreshCw, Brain, Zap, FileText, Target, TrendingUp } from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { AIPreReviewResult } from '../../../types/R3/R3.REVIEW';
import { t } from '../../../../i18n/appI18n';

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  minor: { color: 'gold', label: 'reportReview.aiHint.severity.minor' },
  major: { color: 'orange', label: 'reportReview.aiHint.severity.major' },
  critical: { color: 'red', label: 'reportReview.aiHint.severity.critical' },
};

const RISK_META: Record<string, { color: string; label: string }> = {
  low: { color: 'green', label: 'reportReview.aiHint.risk.low' },
  medium: { color: 'gold', label: 'reportReview.aiHint.risk.medium' },
  high: { color: 'orange', label: 'reportReview.aiHint.risk.high' },
  critical: { color: 'red', label: 'reportReview.aiHint.risk.critical' },
};

export interface ReviewAIHintProps {
  reportId: string;
  onAccept?: (r: AIPreReviewResult) => void;
}

export const ReviewAIHint: React.FC<ReviewAIHintProps> = ({ reportId, onAccept }) => {
  const [result, setResult] = useState<AIPreReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await reviewService.getAIPreReview(reportId);
      setResult(data);
    } catch (e) {
      message.error(t('reportReview.aiHint.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const trigger = async () => {
    setTriggering(true);
    try {
      const data = await reviewService.triggerAIPreReview(reportId);
      setResult(data);
      message.success(t('reportReview.aiHint.completed'));
    } catch (e) {
      message.error(t('reportReview.aiHint.triggerFailed'));
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <Card data-testid="review-ai-hint" role="region" aria-label={t('reportReview.aiHint.title')}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip={t('reportReview.aiHint.analyzing')} />
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card data-testid="review-ai-hint" role="region" aria-label={t('reportReview.aiHint.title')}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Brain size={48} color="#94a3b8" style={{ marginBottom: 8 }} />
          <div style={{ marginBottom: 8, color: '#64748b' }}>{t('reportReview.aiHint.empty')}</div>
          <Button type="primary" icon={<Sparkles size={14} />} loading={triggering} onClick={trigger}>
            {t('reportReview.aiHint.trigger')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div data-testid="review-ai-hint" role="region" aria-label={t('reportReview.aiHint.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Brain size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.aiHint.title')}</strong>
            <Tag color="purple">R3.REVIEW.045</Tag>
            <Tag color="cyan">{result.modelVersion}</Tag>
          </Space>
          <Button size="small" icon={<RefreshCw size={12} />} loading={triggering} onClick={trigger}>
            {t('reportReview.aiHint.reanalyze')}
          </Button>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.aiHint.suggestedScore')}</span>}
              value={result.suggestedScore}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.aiHint.confidence')}</span>}
              value={(result.confidence * 100).toFixed(0)}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<TrendingUp size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.aiHint.riskLevel')}</span>}
              value={t(RISK_META[result.riskLevel].label)}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportReview.aiHint.defectCount')}</span>}
              value={result.defects.length}
              styles={{ content: {  color: result.criticalFindingDetected ? '#fca5a5' : '#fff', fontSize: 20  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
        </Row>
      </div>

      {result.criticalFindingDetected && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={14} />}
          message={t('reportReview.aiHint.criticalDetected')}
          description={t('reportReview.aiHint.criticalAdvice')}
          style={{ marginBottom: 12 }}
        />
      )}

      <Card
        title={
          <Space>
            <Target size={14} />{t('reportReview.aiHint.dimensionScores')}
          </Space>
        }
        size="small"
        style={{ marginBottom: 12 }}
      >
        <Row gutter={[12, 8]}>
          <Col span={8}>
            <div>{t('reportReview.aiHint.consistency')}</div>
            <Progress percent={Math.round(result.consistencyScore * 100)} size="small" />
          </Col>
          <Col span={8}>
            <div>{t('reportReview.aiHint.completeness')}</div>
            <Progress percent={Math.round(result.completenessScore * 100)} size="small" />
          </Col>
          <Col span={8}>
            <div>{t('reportReview.aiHint.terminology')}</div>
            <Progress percent={Math.round(result.terminologyScore * 100)} size="small" />
          </Col>
        </Row>
      </Card>

      {result.defects.length > 0 && (
        <Card
          title={
            <Space>
              <AlertTriangle size={14} color="#dc2626" />
              {t('reportReview.aiHint.defectsDetected', { n: result.defects.length })}
            </Space>
          }
          size="small"
          style={{ marginBottom: 12 }}
        >
          {result.defects.map((d: AIPreReviewResult['defects'][number]) => (
            <div
              key={d.code}
              style={{
                padding: 8,
                marginBottom: 4,
                background:
                  d.severity === 'critical'
                    ? '#fee2e2'
                    : d.severity === 'major'
                      ? '#fef3c7'
                      : '#f0f9ff',
                borderRadius: 4,
                border:
                  '1px solid ' +
                  (d.severity === 'critical'
                    ? '#fca5a5'
                    : d.severity === 'major'
                      ? '#fcd34d'
                      : '#bae6fd'),
              }}
            >
              <Space>
                <Tag color={SEVERITY_META[d.severity].color}>{t(SEVERITY_META[d.severity].label)}</Tag>
                <strong style={{ fontSize: 12 }}>{d.name}</strong>
                <Tag>{d.code}</Tag>
              </Space>
              {d.position && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('reportReview.aiHint.position')}{d.position}</div>
              )}
              {d.suggestion && (
                <div style={{ fontSize: 12, color: '#0891b2', marginTop: 2 }}>{t('reportReview.aiHint.suggestion')}{d.suggestion}</div>
              )}
            </div>
          ))}
        </Card>
      )}

      {result.suggestions.length > 0 && (
        <Card
          title={
            <Space>
              <Zap size={14} color="#7c3aed" />
              {t('reportReview.aiHint.suggestions')}
            </Space>
          }
          size="small"
          style={{ marginBottom: 12 }}
        >
          {result.suggestions.map((s: string, i: number) => (
            <div key={i} style={{ padding: 6, fontSize: 12, color: '#334155' }}>
              - {s}
            </div>
          ))}
        </Card>
      )}

      {onAccept && (
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <Button type="primary" icon={<Sparkles size={12} />} onClick={() => onAccept(result)}>
            {t('reportReview.aiHint.apply')}
          </Button>
        </div>
      )}

      <div style={{ background: 'var(--bg-primary)', padding: 8, borderRadius: 4, fontSize: 12, color: '#64748b' }}>
        <FileText size={11} style={{ marginRight: 4 }} />
        {t('reportReview.aiHint.generatedAt')}{new Date(result.generatedAt).toLocaleString()} · {t('reportReview.aiHint.modelVersion')}{result.modelVersion}
      </div>
    </div>
  );
};

export default ReviewAIHint;

/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.045 R3.REVIEW.046 R3.REVIEW.066 ReviewAIHint AI 预读
 */
import React, { useEffect, useState } from 'react';
import { Card, Tag, Space, Button, Row, Col, Progress, Statistic, Spin, Alert, message } from 'antd';
import { Sparkles, AlertTriangle, RefreshCw, Brain, Zap, FileText, Target, TrendingUp } from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { AIPreReviewResult } from '../../../types/R3/R3.REVIEW';

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  minor: { color: 'gold', label: '轻微' },
  major: { color: 'orange', label: '重要' },
  critical: { color: 'red', label: '严重' },
};

const RISK_META: Record<string, { color: string; label: string }> = {
  low: { color: 'green', label: '低风险' },
  medium: { color: 'gold', label: '中风险' },
  high: { color: 'orange', label: '高风险' },
  critical: { color: 'red', label: '极高风险' },
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
      message.error('加载 AI 预读结果失败');
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
      message.success('AI 预读完成');
    } catch (e) {
      message.error('AI 预读触发失败');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <Card data-testid="review-ai-hint" role="region" aria-label="AI 预读">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="AI 预读分析中..." />
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card data-testid="review-ai-hint" role="region" aria-label="AI 预读">
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Brain size={48} color="#94a3b8" style={{ marginBottom: 8 }} />
          <div style={{ marginBottom: 8, color: '#64748b' }}>暂无 AI 预读结果</div>
          <Button type="primary" icon={<Sparkles size={14} />} loading={triggering} onClick={trigger}>
            触发 AI 预读
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div data-testid="review-ai-hint" role="region" aria-label="AI 预读">
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
            <strong style={{ fontSize: 16 }}>AI 预读</strong>
            <Tag color="purple">R3.REVIEW.045</Tag>
            <Tag color="cyan">{result.modelVersion}</Tag>
          </Space>
          <Button size="small" icon={<RefreshCw size={12} />} loading={triggering} onClick={trigger}>
            重新分析
          </Button>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>AI 建议评分</span>}
              value={result.suggestedScore}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>置信度</span>}
              value={(result.confidence * 100).toFixed(0)}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<TrendingUp size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>风险等级</span>}
              value={RISK_META[result.riskLevel].label}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<AlertTriangle size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>缺陷数</span>}
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
          message="AI 检测到危急值"
          description="建议立即核实并通报临床"
          style={{ marginBottom: 12 }}
        />
      )}

      <Card
        title={
          <Space>
            <Target size={14} />分维度评分
          </Space>
        }
        size="small"
        style={{ marginBottom: 12 }}
      >
        <Row gutter={[12, 8]}>
          <Col span={8}>
            <div>一致性</div>
            <Progress percent={Math.round(result.consistencyScore * 100)} size="small" />
          </Col>
          <Col span={8}>
            <div>完整性</div>
            <Progress percent={Math.round(result.completenessScore * 100)} size="small" />
          </Col>
          <Col span={8}>
            <div>术语规范</div>
            <Progress percent={Math.round(result.terminologyScore * 100)} size="small" />
          </Col>
        </Row>
      </Card>

      {result.defects.length > 0 && (
        <Card
          title={
            <Space>
              <AlertTriangle size={14} color="#dc2626" />
              检测到缺陷 ({result.defects.length})
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
                <Tag color={SEVERITY_META[d.severity].color}>{SEVERITY_META[d.severity].label}</Tag>
                <strong style={{ fontSize: 12 }}>{d.name}</strong>
                <Tag>{d.code}</Tag>
              </Space>
              {d.position && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>位置：{d.position}</div>
              )}
              {d.suggestion && (
                <div style={{ fontSize: 12, color: '#0891b2', marginTop: 2 }}>建议：{d.suggestion}</div>
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
              AI 建议
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
            应用 AI 预读建议
          </Button>
        </div>
      )}

      <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, fontSize: 12, color: '#64748b' }}>
        <FileText size={11} style={{ marginRight: 4 }} />
        生成时间：{new Date(result.generatedAt).toLocaleString()} · 模型版本：{result.modelVersion}
      </div>
    </div>
  );
};

export default ReviewAIHint;

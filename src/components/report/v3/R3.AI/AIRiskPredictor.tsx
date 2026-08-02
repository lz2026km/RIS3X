/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI AI 风险预测 (mock)
 * A5-REPORT / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, Tag, Progress, Alert, Row, Col, List, Statistic, Button, Empty, Spin, Divider } from 'antd';
import { Activity, AlertTriangle, Info, CheckCircle2, TrendingUp, Target } from 'lucide-react';
import { aiService } from '../../../../services/ai/aiService';
import type { AIRiskPrediction, AIRiskFactor } from '../../../../types/R3/R3.AI';

const { Title, Text, Paragraph } = Typography;

export interface AIRiskPredictorProps {
  reportId: string;
  autoLoad?: boolean;
}

const RISK_META: Record<AIRiskPrediction['overallRisk'], { label: string; color: string; icon: React.ReactNode }> = {
  low: { label: '低风险', color: 'green', icon: <CheckCircle2 size={12} /> },
  medium: { label: '中风险', color: 'blue', icon: <Info size={12} /> },
  high: { label: '高风险', color: 'orange', icon: <AlertTriangle size={12} /> },
  critical: { label: '危急', color: 'red', icon: <AlertTriangle size={12} /> },
};

const SEVERITY_META: Record<'info' | 'warning' | 'critical', { label: string; color: string; icon: React.ReactNode }> = {
  info: { label: '提示', color: 'blue', icon: <Info size={12} /> },
  warning: { label: '警告', color: 'orange', icon: <AlertTriangle size={12} /> },
  critical: { label: '危急', color: 'red', icon: <AlertTriangle size={12} /> },
};

const CATEGORY_META: Record<AIRiskFactor['category'], { label: string; color: string }> = {
  patient: { label: '患者因素', color: 'blue' },
  finding: { label: '影像所见', color: 'purple' },
  history: { label: '病史', color: 'orange' },
  comparison: { label: '对照', color: 'cyan' },
};

export const AIRiskPredictor: React.FC<AIRiskPredictorProps> = ({ reportId, autoLoad = true }) => {
  const [prediction, setPrediction] = useState<AIRiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLoad) return;
    setLoading(true);
    setError(null);
    aiService
      .predictRisk(reportId)
      .then(setPrediction)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [reportId, autoLoad]);

  if (loading) {
    return (
      <Card>
        <Space orientation="vertical" align="center" style={{ width: '100%', padding: 24 }}>
          <Spin indicator={<Activity size={32} className="spin" />} />
          <Text>AI 正在分析风险...</Text>
        </Space>
      </Card>
    );
  }

  if (error) {
    return <Alert type="error" showIcon title={error} />;
  }

  if (!prediction) {
    return (
      <Card>
        <Empty description="暂无风险预测">
          <Button type="primary" onClick={() => void aiService.predictRisk(reportId).then(setPrediction)}>
            立即预测
          </Button>
        </Empty>
      </Card>
    );
  }

  const riskMeta = RISK_META[prediction.overallRisk];

  return (
    <Card
      title={
        <Space>
          <Activity size={18} color="#dc2626" />
          <span>AI 风险预测</span>
          <Tag color={riskMeta.color} icon={riskMeta.icon}>{riskMeta.label}</Tag>
          <Tag color="purple">v2.3 mock</Tag>
        </Space>
      }
      extra={
        <Space>
          <Text>综合评分</Text>
          <Progress
            type="circle"
            percent={prediction.riskScore * 100}
            size={50}
            strokeColor={riskMeta.color === 'red' ? '#dc2626' : riskMeta.color === 'orange' ? '#f59e0b' : riskMeta.color === 'blue' ? '#2563eb' : '#10b981'}
          />
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="风险评分"
            value={prediction.riskScore * 100}
            suffix="%"
            precision={0}
            styles={{ content: {  color: riskMeta.color === 'red' ? '#dc2626' : riskMeta.color === 'orange' ? '#f59e0b' : '#10b981'  } }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="风险因素"
            value={prediction.riskFactors.length}
            prefix={<TrendingUp size={14} />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="预测结局"
            value={prediction.predictedOutcomes.length}
            prefix={<Target size={14} />}
          />
        </Col>
      </Row>

      <Divider orientation="left" plain>
        <Text strong>风险因素</Text>
      </Divider>
      <List
        size="small"
        dataSource={prediction.riskFactors}
        renderItem={(factor) => {
          const catMeta = CATEGORY_META[factor.category];
          return (
            <List.Item>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Tag color={catMeta.color}>{catMeta.label}</Tag>
                  <Text strong>{factor.name}</Text>
                  <Tag>权重 {(factor.weight * 100).toFixed(0)}%</Tag>
                </Space>
                <Text style={{ fontSize: 12 }}>{factor.description}</Text>
                {factor.evidence && <Text type="secondary" style={{ fontSize: 12 }}>证据: {factor.evidence}</Text>}
              </Space>
            </List.Item>
          );
        }}
      />

      <Divider orientation="left" plain>
        <Text strong>预测结局</Text>
      </Divider>
      <List
        size="small"
        dataSource={prediction.predictedOutcomes}
        renderItem={(outcome) => (
          <List.Item>
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <Tag color="blue">{outcome.probability >= 0.5 ? '高概率' : outcome.probability >= 0.2 ? '中概率' : '低概率'}</Tag>
                <Text strong>{outcome.outcome}</Text>
                <Tag>{Math.round(outcome.probability * 100)}%</Tag>
                <Tag color="purple">{outcome.timeframeDays} 天</Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{outcome.rationale}</Text>
            </Space>
          </List.Item>
        )}
      />

      <Divider orientation="left" plain>
        <Text strong>早期预警</Text>
      </Divider>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {prediction.earlyWarnings.map((w) => {
          const sevMeta = SEVERITY_META[w.severity];
          return (
            <Alert
              key={w.id}
              type={w.severity === 'critical' ? 'error' : w.severity === 'warning' ? 'warning' : 'info'}
              showIcon
              icon={sevMeta.icon}
              title={
                <Space>
                  <Tag color={sevMeta.color}>{sevMeta.label}</Tag>
                  <Text>{w.message}</Text>
                </Space>
              }
              description={w.suggestedAction && <Text type="secondary" style={{ fontSize: 12 }}>{w.suggestedAction}</Text>}
            />
          );
        })}
      </Space>

      <Divider orientation="left" plain>
        <Text strong>建议措施</Text>
      </Divider>
      <List
        size="small"
        dataSource={prediction.recommendedActions}
        renderItem={(action) => (
          <List.Item>
            <Space>
              <CheckCircle2 size={12} color="#10b981" />
              <Text style={{ fontSize: 12 }}>{action}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
};

export default AIRiskPredictor;
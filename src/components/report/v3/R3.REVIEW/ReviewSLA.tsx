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
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const STAGE_META: Record<ReviewStage, { label: string; color: string }> = {
  initial: { label: '初审', color: '#f59e0b' },
  final: { label: '终审', color: '#7c2d12' },
  cosign: { label: '双签', color: '#7c3aed' },
  sign: { label: '签发', color: '#be185d' },
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
      message.error('加载 SLA 数据失败');
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
        aria-label="加载"
        data-testid="sla-loading"
        style={{ padding: 40, textAlign: 'center' }}
      >
        加载中...
      </div>
    );
  }

  const breachData = Object.entries(sla.breachByStage).map(([stage, count]) => ({
    stage: STAGE_META[stage as ReviewStage].label,
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
    <div data-testid="review-sla" role="region" aria-label="审核 SLA 监控">
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
            <strong style={{ fontSize: 16 }}>SLA 监控</strong>
            <Tag color="purple">R3.REVIEW.027</Tag>
          </Space>
          <Tag icon={<Settings size={12} />} color="orange">
            SLA 阈值：初审 {sla.initialReviewSLA}h / 终审 {sla.finalReviewSLA}h / 签发 {sla.signSLA}h /
            双签 {sla.cosignSLA}h
          </Tag>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>按时率</span>}
              value={sla.onTimeRate}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>超时任务</span>}
              value={sla.overdueCount}
              styles={{ content: {  color: '#fca5a5', fontSize: 20  } }}
              prefix={<AlertTriangle size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>平均初审</span>}
              value={sla.averageInitialMinutes}
              suffix="分钟"
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Clock size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>平均终审</span>}
              value={sla.averageFinalMinutes}
              suffix="分钟"
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
                ? 'SLA 达成良好'
                : sla.onTimeRate >= 80
                  ? 'SLA 接近阈值，请关注'
                  : 'SLA 严重超标，请立即处理'}
            </span>
          </Space>
        }
        description={
          <div>
            <div>
              当前 P95 初审时长 <strong>{sla.p95InitialMinutes}分钟</strong>,P95 终审{' '}
              <strong>{sla.p95FinalMinutes}分钟</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              超时任务数：<strong>{sla.overdueCount}</strong>,超时率{' '}
              <strong>{(100 - sla.onTimeRate).toFixed(1)}%</strong>
            </div>
          </div>
        }
        showIcon
        style={{ marginBottom: 12 }}
      />

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Card title="按阶段超时统计" size="small">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={breachData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="超时数">
                  {breachData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="24h 审核时长分布" size="small">
            <ResponsiveContainer width="100%" height={200}>
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
                  name="初审"
                />
                <Line
                  type="monotone"
                  dataKey="final"
                  stroke="#7c2d12"
                  strokeWidth={2}
                  name="终审"
                />
                <Line
                  type="monotone"
                  dataKey="cosign"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  name="双签"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={8}>
          <Card
            title={
              <Space>
                <CheckCircle2 size={14} color="#10b981" />
                SLA 达成
              </Space>
            }
            size="small"
          >
            <Progress percent={sla.onTimeRate} strokeColor="#10b981" />
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              本周期按时完成的审核任务比例
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <TrendingUp size={14} color="#3b82f6" />
                平均时长
              </Space>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <Tag color="orange">初审</Tag> <strong>{sla.averageInitialMinutes}</strong> 分钟
              </div>
              <div>
                <Tag color="purple">终审</Tag> <strong>{sla.averageFinalMinutes}</strong> 分钟
              </div>
              <div>
                <Tag color="cyan">双签</Tag> <strong>{sla.averageCosignMinutes}</strong> 分钟
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <BarChart3 size={14} color="#7c3aed" />
                P95 时长
              </Space>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <Tag color="orange">P95 初审</Tag> <strong>{sla.p95InitialMinutes}</strong> 分钟
              </div>
              <div>
                <Tag color="purple">P95 终审</Tag> <strong>{sla.p95FinalMinutes}</strong> 分钟
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                95% 的任务在该时长内完成
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReviewSLA;

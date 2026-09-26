/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.157 质控实时仪表盘
 * A5-REPORT / 10 点
 * 实时质控仪表盘:9 指标 / 待评估 / 完成数 / 告警 / 趋势 / 医生排行
 */
import { qualityService } from '../../../../services/quality/qualityService';
import type { QualityDashboard as QualityDashboardData, QualityGrade } from '../../../../types/R3/R3.QUALITY';
import { ChartContainer } from '../../../charts';
import { Card, Tag, Space, Row, Col, Statistic, List, Alert, message, Empty, Button } from 'antd';
import {
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Bell,
  Sparkles,
  Layers,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Cell, LineChart, Line, Legend, RadialBarChart, RadialBar } from 'recharts';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

const GRADE_COLOR: Record<QualityGrade, string> = {
  '甲': '#10b981',
  '乙': '#3b82f6',
  '丙': '#f59e0b',
  '丁': '#dc2626',
};

export const QualityDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<QualityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await qualityService.getDashboard();
      setDashboard(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      message.error(t('qualityDashboard.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 30000); // 30s 刷新
    return () => clearInterval(timer);
  }, []);

  if (loading || !dashboard) {
    return (
      <div
        data-testid="quality-dashboard"
        role="status"
        aria-label={t('qualityDashboard.loadingLabel')}
        style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}
      >
        {t('qualityDashboard.loading')}
      </div>
    );
  }

  const radialData = [
    { name: t('qualityDashboard.pendingEvaluation'), value: dashboard.realtime.pendingEvaluation, fill: '#f59e0b' },
    { name: t('qualityDashboard.completed'), value: dashboard.realtime.completedToday, fill: '#10b981' },
    { name: t('qualityDashboard.inProgress'), value: dashboard.realtime.inProgressEvaluation, fill: '#3b82f6' },
  ];

  return (
    <div data-testid="quality-dashboard" role="region" aria-label={t('qualityDashboard.ariaLabel')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #3b82f6 100%)',
          color: '#fff',
          padding: '14px 18px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Activity size={18} />
            <strong style={{ fontSize: 16 }}>{t('qualityDashboard.title')}</strong>
            <Tag color="purple">R3.QUALITY.157</Tag>
            <Tag color="cyan">{t('qualityDashboard.realtime')}</Tag>
            {lastUpdate && (
              <span style={{ fontSize: 12, opacity: 0.8 }}>{t('qualityDashboard.updatedAt')} {lastUpdate}</span>
            )}
          </Space>
          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            onClick={() => void load()}
            loading={loading}
          >
            {t('qualityDashboard.refresh')}
          </Button>
        </Space>
        <Row gutter={12} style={{ marginTop: 14 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityDashboard.pendingEvaluation')}</span>}
              value={dashboard.realtime.pendingEvaluation}
              styles={{ content: {  color: '#fff', fontSize: 22  } }}
              prefix={<Layers size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityDashboard.completedToday')}</span>}
              value={dashboard.realtime.completedToday}
              styles={{ content: {  color: '#bbf7d0', fontSize: 22  } }}
              prefix={<CheckCircle2 size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityDashboard.inProgress')}</span>}
              value={dashboard.realtime.inProgressEvaluation}
              styles={{ content: {  color: '#fff', fontSize: 22  } }}
              prefix={<Zap size={16} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityDashboard.criticalMissed')}</span>}
              value={dashboard.realtime.criticalMissedToday}
              styles={{ content: { 
                color: dashboard.realtime.criticalMissedToday > 0 ? '#fca5a5' : '#bbf7d0',
                fontSize: 22,
               } }}
              prefix={<AlertTriangle size={16} />}
            />
          </Col>
        </Row>
      </div>

      {dashboard.alerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {dashboard.alerts.map((alert) => (
            <Alert
              key={alert.id}
              type="warning"
              showIcon
              icon={<Bell size={14} />}
              message={alert.message}
              description={new Date(alert.timestamp).toLocaleString()}
              style={{ marginBottom: 4, borderLeft: alert.severity === 'critical' ? '4px solid #dc2626' : undefined }}
              action={
                <Tag color={alert.severity === 'critical' ? 'red' : 'orange'}>
                  {alert.type}
                </Tag>
              }
            />
          ))}
        </div>
      )}

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card size="small" title={<Space><BarChart3 size={14} />{t('qualityDashboard.byModality')}</Space>}>
            <ChartContainer height={220} state={dashboard.byModality.length === 0 ? 'empty' : 'ready'} emptyDescription={t('qualityDashboard.noModalityData')}>
              <BarChart data={dashboard.byModality.map((m) => ({ name: m.modality, score: m.avgScore }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <RTooltip />
                <Bar dataKey="score" fill="#3b82f6" name={t('qualityDashboard.series.avgScore')}>
                  {dashboard.byModality.map((m, i) => (
                    <Cell key={i} fill={m.avgScore >= 90 ? '#10b981' : m.avgScore >= 75 ? '#3b82f6' : m.avgScore >= 60 ? '#f59e0b' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><Activity size={14} />{t('qualityDashboard.hourlyDistribution')}</Space>}>
            <ChartContainer height={220} state={dashboard.byHour.length === 0 ? 'empty' : 'ready'} emptyDescription={t('qualityDashboard.noHourlyData')}>
              <LineChart data={dashboard.byHour.map((h) => ({ hour: `${h.hour}h`, count: h.count, score: h.avgScore }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <RTooltip />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name={t('qualityDashboard.series.count')} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} name={t('qualityDashboard.series.score')} dot={false} />
              </LineChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><TrendingUp size={14} />{t('qualityDashboard.statusOverview')}</Space>}>
            <ChartContainer height={220} state={radialData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('qualityDashboard.noStatusData')}>
              <RadialBarChart innerRadius="20%" outerRadius="100%" data={radialData} startAngle={180} endAngle={-180}>
                <RadialBar dataKey="value" cornerRadius={10} background />
                <Legend iconSize={10} verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 12 }} />
                <RTooltip />
              </RadialBarChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={14}>
          <Card size="small" title={<Space><Sparkles size={14} />{t('qualityDashboard.recentScores')}</Space>}>
            <List
              dataSource={dashboard.recentScores}
              renderItem={(s) => (
                <List.Item key={s.id} style={{ padding: '6px 0' }}>
                  <Space>
                    <Tag color={GRADE_COLOR[s.grade]}>{s.grade}{t('qualityDashboard.gradeSuffix')}</Tag>
                    <strong>{s.patientName}</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{s.reportId}</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>{s.score} {t('qualityDashboard.pointsUnit')}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {s.doctorName} · {new Date(s.evaluatedAt).toLocaleTimeString()}
                    </span>
                  </Space>
                </List.Item>
              )}
              locale={{ emptyText: <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description={t('qualityDashboard.noScores')} /> }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card size="small" title={<Space><Users size={14} />{t('qualityDashboard.doctorRanking')}</Space>}>
            <List
              dataSource={dashboard.byDoctor}
              renderItem={(d) => (
                <List.Item key={d.doctorId} style={{ padding: '6px 0' }}>
                  <Space>
                    <strong>{d.doctorName}</strong>
                    <span>
                      {t('qualityDashboard.avgScoreLabel')}{' '}
                      <strong style={{ color: d.avgScore >= 90 ? '#10b981' : '#f59e0b' }}>{d.avgScore}</strong>
                    </span>
                    <Tag>{d.count} {t('qualityDashboard.copiesUnit')}</Tag>
                    <Tag color={d.passRate >= 0.9 ? 'green' : 'orange'}>
                      {Math.round(d.passRate * 100)}%
                    </Tag>
                  </Space>
                </List.Item>
              )}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('qualityDashboard.noData')} /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default QualityDashboard;

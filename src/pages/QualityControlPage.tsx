/**
 * @deprecated [v3.0.6.11-103 Wave 10] 重复页面精简合并: 本页已嵌入 QCPage "质控管理(评分/危急值/缺陷)" Tab (src/pages/QCPage.tsx), 文件保留, 旧路由 /quality-control 已 redirect → /qc。功能未删除, 请勿单独继续扩展本页。
 * G005 RIS v3.0.5.1 - QualityControlPage 质控管理
 * [v3.0.6.11-81] W2-B: 报告评分数据接 reportApi.list + reportQualityApi (真实端点, 失败回退演示数据)
 */
import React, { useState, useEffect } from 'react';
import { Tabs, Card, Space, Tag, message, Badge, Spin, Alert } from 'antd';
import { ShieldCheck, AlertOctagon, FileText, AlertTriangle, BarChart3, Activity, Layers, TrendingUp } from 'lucide-react';
import { reportQualityApi } from '../services/api';
import { QualityScorePanel } from '../components/report/v3/R3.QUALITY/QualityScorePanel';
import { QualityDimensionCard } from '../components/report/v3/R3.QUALITY/QualityDimensionCard';
import { CriticalValueAlerter } from '../components/report/v3/R3.QUALITY/CriticalValueAlerter';
import { CriticalValueLevelSelector } from '../components/report/v3/R3.QUALITY/CriticalValueLevelSelector';
import { CriticalValueEscalation } from '../components/report/v3/R3.QUALITY/CriticalValueEscalation';
import { DefectLibrary } from '../components/report/v3/R3.QUALITY/DefectLibrary';
import { DefectCategoryTree } from '../components/report/v3/R3.QUALITY/DefectCategoryTree';
import { DefectRemediationTracker } from '../components/report/v3/R3.QUALITY/DefectRemediationTracker';
import { QualityMonthlyReport } from '../components/report/v3/R3.QUALITY/QualityMonthlyReport';
import { QualityDashboard } from '../components/report/v3/R3.QUALITY/QualityDashboard';
import { QUALITY_SCORES } from '../data/reportQualityMock';
import { qualityService } from '../services/quality/qualityService';
import type { QualityScore } from '../types/R3/R3.QUALITY';
import { PageContainer, PageHeader } from '../components/common';

const QualityControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScore, setSelectedScore] = useState<QualityScore | null>(QUALITY_SCORES[0] ?? null);

  // [W2-B] 真实化: qualityService.listScores → reportApi.list (报告主数据) + loading/error
  const [scores, setScores] = useState<QualityScore[]>(QUALITY_SCORES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'fallback'>('api');
  const [, setRescoreBusy] = useState(false);

  // [G005 Wave1B] 历史评分趋势: reportQualityApi.getTrend (失败回退不阻断)
  const [trend, setTrend] = useState<Array<{ date: string; totalScore: number; grade?: string }>>([]);

  useEffect(() => {
    if (!selectedScore?.reportId) return;
    let cancelled = false;
    reportQualityApi
      .getTrend(selectedScore.reportId, 30)
      .then((res) => {
        if (cancelled || !res.success || !Array.isArray(res.data) || res.data.length === 0) return;
        setTrend(
          (res.data as Array<{ evaluatedAt?: string; totalScore: number; grade?: string }>).map((e) => ({
            date: String(e.evaluatedAt ?? '').slice(0, 10),
            totalScore: Number(e.totalScore) || 0,
            grade: e.grade,
          })),
        );
      })
      .catch(() => { /* 趋势不可用不阻断 */ });
    return () => { cancelled = true; };
  }, [selectedScore]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await qualityService.listScores();
        if (cancelled) return;
        if (list.length > 0) {
          setScores(list);
          setSelectedScore(list[0] ?? null);
          setDataSource('api');
        } else {
          setDataSource('fallback');
        }
      } catch {
        if (!cancelled) {
          setDataSource('fallback');
          setError('评分列表加载失败，当前展示演示数据');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRescore = async () => {
    if (!selectedScore) return;
    setRescoreBusy(true);
    try {
      const result = await qualityService.evaluateReport(
        selectedScore.reportId,
        selectedScore.patientName,
        selectedScore.modality,
        selectedScore.doctorId,
        selectedScore.doctorName,
        selectedScore.doctorTitle,
        {
          findings: '双肺纹理清晰，未见明显异常密度影。',
          diagnosis: '胸部 CT 平扫未见明显异常。',
          impression: '建议年度随访。',
          criticalMarked: false,
        }
      );
      setSelectedScore(result);
      setScores(prev => [result, ...prev.filter(s => s.id !== result.id)]);
      message.success('重评完成（reportQualityApi 评分引擎）');
    } catch (e) {
      message.error('重评失败');
    } finally {
      setRescoreBusy(false);
    }
  };

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="quality-control-page">
      <PageHeader
        title="质控管理"
        subtitle="评分/危急值/缺陷/月报/实时仪表盘"
        icon={<ShieldCheck size={20} color="#1e40af" />}
        variant="inline"
        actions={
          <Space size={8}>
            {loading && <Spin size="small" />}
            <Tag color={dataSource === 'api' ? 'green' : 'orange'}>
              {dataSource === 'api' ? '评分数据: reportApi/reportQualityApi' : '评分数据: 演示数据(API失败回退)'}
            </Tag>
            {error && <Alert type="warning" showIcon message={error} style={{ maxWidth: 320 }} />}
          </Space>
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Badge
            count={6}
            title="质控模块 6 项"
            style={{ backgroundColor: '#1e40af' }}
          />
        }
        items={[
          { key: 'dashboard', label: <Space><Activity size={14} />实时仪表盘</Space>, children: <QualityDashboard /> },
          { key: 'score', label: <Space><BarChart3 size={14} />评分</Space>, children: (
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <Card size="small" title="选择报告">
                <Space wrap>
                  {scores.map((s) => (
                    <Card
                      key={s.id}
                      size="small"
                      onClick={() => setSelectedScore(s)}
                      style={{ cursor: 'pointer', borderColor: selectedScore?.id === s.id ? '#3b82f6' : '#e2e8f0', minWidth: 180 }}
                    >
                      <div style={{ fontSize: 12 }}><strong>{s.patientName}</strong></div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.reportId}</div>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={s.grade === '甲' ? 'green' : s.grade === '乙' ? 'blue' : s.grade === '丙' ? 'gold' : 'red'}>{s.grade} {s.totalScore}</Tag>
                      </div>
                    </Card>
                  ))}
                </Space>
              </Card>
              {/* [G005 Wave1B] 历史评分趋势: reportQualityApi.getTrend (失败回退不阻断) */}
              {trend.length > 0 && (
                <Card size="small" title={<Space><TrendingUp size={14} />历史评分趋势</Space>} extra={<Tag color="green">reportQualityApi 实时</Tag>}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 90 }}>
                    {trend.slice(-14).map((p, i) => {
                      const max = Math.max(...trend.map((x) => x.totalScore), 1);
                      return (
                        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.totalScore}</div>
                          <div style={{ height: 60, background: 'var(--bg-card)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                            <div style={{ width: '100%', height: `${Math.max((p.totalScore / max) * 100, 4)}%`, background: p.grade === 'A' ? '#10b981' : p.grade === 'B' ? '#3b82f6' : '#f59e0b', borderRadius: '4px 4px 0 0' }} />
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4 }}>{p.date.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              <QualityScorePanel onRescore={() => { void handleRescore(); }} />
            </Space>
          ) },
          { key: 'dimension', label: <Space><Layers size={14} />维度配置</Space>, children: <QualityDimensionCard /> },
          { key: 'critical', label: <Space><AlertOctagon size={14} />危急值告警</Space>, children: (
            <Tabs
              tabBarExtraContent={
                <Badge
                  count={3}
                  title="危急值子模块 3 项"
                  style={{ backgroundColor: '#dc2626' }}
                />
              }
              items={[
                { key: 'alert', label: '告警列表', children: <CriticalValueAlerter limit={20} /> },
                { key: 'level', label: '分级配置', children: <CriticalValueLevelSelector /> },
                { key: 'escalation', label: '升级规则', children: <CriticalValueEscalation /> },
              ]}
            />
          ) },
          { key: 'defect', label: <Space><AlertTriangle size={14} />缺陷管理</Space>, children: (
            <Tabs
              tabBarExtraContent={
                <Badge
                  count={3}
                  title="缺陷子模块 3 项"
                  style={{ backgroundColor: '#f59e0b' }}
                />
              }
              items={[
                { key: 'lib', label: '缺陷库', children: <DefectLibrary /> },
                { key: 'tree', label: '分类树', children: <DefectCategoryTree /> },
                { key: 'remediation', label: '整改追踪', children: <DefectRemediationTracker /> },
              ]}
            />
          ) },
          { key: 'monthly', label: <Space><FileText size={14} />月报</Space>, children: <QualityMonthlyReport /> },
        ]}
      />
    </PageContainer>
  );
};

export default QualityControlPage;

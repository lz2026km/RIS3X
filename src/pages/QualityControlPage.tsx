/**
 * G005 RIS v3.0.5.1 - QualityControlPage 质控管理
 */
import React, { useState } from 'react';
import { Tabs, Card, Space, Tag, message, Badge } from 'antd';
import { ShieldCheck, AlertOctagon, FileText, AlertTriangle, BarChart3, Activity, Layers } from 'lucide-react';
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

  const handleRescore = async () => {
    if (!selectedScore) return;
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
      message.success('重评完成');
    } catch (e) {
      message.error('重评失败');
    }
  };

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="quality-control-page">
      <PageHeader
        title="质控管理"
        subtitle="评分/危急值/缺陷/月报/实时仪表盘"
        icon={<ShieldCheck size={20} color="#1e40af" />}
        variant="inline"
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
                  {QUALITY_SCORES.map((s) => (
                    <Card
                      key={s.id}
                      size="small"
                      onClick={() => setSelectedScore(s)}
                      style={{ cursor: 'pointer', borderColor: selectedScore?.id === s.id ? '#3b82f6' : '#e2e8f0', minWidth: 180 }}
                    >
                      <div style={{ fontSize: 12 }}><strong>{s.patientName}</strong></div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{s.reportId}</div>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={s.grade === '甲' ? 'green' : s.grade === '乙' ? 'blue' : s.grade === '丙' ? 'gold' : 'red'}>{s.grade} {s.totalScore}</Tag>
                      </div>
                    </Card>
                  ))}
                </Space>
              </Card>
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

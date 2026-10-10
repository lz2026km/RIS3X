// ============================================================
// G005 放射科RIS系统 v1.0.4 - 多维评分规则配置
// Phase R4：5 大维度 + 权重 + 评分规则 + 等级映射
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  Sliders, Award, Plus, Save,
  TrendingUp, CheckCircle2, AlertCircle, Sparkles,
  Calculator, FileText, Layers,
  ListChecks, RotateCcw,
} from 'lucide-react';
import {
  SCORE_DIMENSIONS,
  SCORE_GRADES,
  QUALITY_KPI,
  type ScoreDimension,
  type ScoreGradeConfig,
} from '../data/qualityScoreMock';
import { reportQualityApi } from '../services/api';
import { LoadingBanner, ErrorBanner, AppEmpty } from '../components/feedback';
import { t } from '../i18n/appI18n';
import ReportReEvaluateSection from './ReportReEvaluateSection';
import { StatCard } from '../components/common';
import { message, Typography } from 'antd';

// ============================================================
// 主组件
// ============================================================
export default function ReportScoreRulePage() {
  // 维度配置
  const [dimensions, setDimensions] = useState<ScoreDimension[]>(SCORE_DIMENSIONS);
  const [selectedDim, setSelectedDim] = useState<string>('dim-completeness');
  const [grades] = useState<ScoreGradeConfig[]>(SCORE_GRADES);
  const [_saveMessage, setSaveMessage] = useState<string>('');
  const [kpi, setKpi] = useState(QUALITY_KPI);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 当前选中维度
  const currentDim = dimensions.find(d => d.id === selectedDim);

  // 更新维度
  const updateDim = (id: string, patch: Partial<ScoreDimension>) => {
    setDimensions(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  };

  // 权重合计
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.allSettled([reportQualityApi.getRules(), reportQualityApi.getStats()])
      .then(([rulesRes, statsRes]) => {
        if (cancelled) return;
        const rules = rulesRes.status === 'fulfilled' ? rulesRes.value : null;
        const statsR = statsRes.status === 'fulfilled' ? statsRes.value : null;
        if (rules?.success && rules.data?.dimensions?.length) {
          const mapped: ScoreDimension[] = rules.data.dimensions.map((d, i) => ({
            id: `dim-${d.key}`,
            name: d.label,
            weight: d.weight,
            description: `${d.label} (满分 ${d.max})`,
            evaluationCriteria: [],
            scoringRules: [{ score: d.max, condition: `${d.label} 达标` }],
            color: ['var(--color-primary-500)', '#7c3aed', '#10b981', 'var(--color-warning-500)', 'var(--color-info-600)', 'var(--color-error-600)', '#8b5cf6', 'var(--color-info-500)'][i % 8] ?? 'var(--color-primary-500)',
            icon: '',
          }));
          setDimensions(mapped);
        }
        if (statsR?.success && statsR.data) {
          const stats = statsR.data;
          setKpi(prev => ({ ...prev, totalEvaluated: stats.total, avgScore: stats.avgScore }));
        }
        const rulesFailed = rulesRes.status === 'rejected' || !rules?.success;
        const statsFailed = statsRes.status === 'rejected' || !statsR?.success;
        if (rulesFailed && statsFailed) setLoadError(t('w9.states.error'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [])

  const handleSave = async () => {
    setSaveMessage('正在保存...')
    try {
      await reportQualityApi.createScoreRule({ dimensions, weights: dimensions.map(d => d.weight) })
      setSaveMessage('配置已保存 - 权重合计: ' + (totalWeight * 100).toFixed(0) + '%')
    } catch {
      setSaveMessage('保存失败')
    }
  }

  // [G005 Wave2A P1] 恢复默认: reportQualityApi 无重置端点 → 本地恢复 QUALITY_KPI/SCORE_GRADES 默认常量
  const handleReset = () => {
    setDimensions(SCORE_DIMENSIONS)
    setKpi(QUALITY_KPI)
    setSaveMessage('已恢复默认评分规则')
    message.success('已恢复默认维度权重与 KPI 指标')
  }

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={20} color="#7c3aed" /> 多维评分规则配置
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R4</span>
          </Typography.Title>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            5 大评分维度 · 权重配置 · 评分规则 · 等级映射 · KPI 统计
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <RotateCcw size={12} /> 恢复默认
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6,
              background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Save size={12} /> 保存配置
          </button>
        </div>
      </div>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      {/* KPI 概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon={FileText} label="累计评分" value={kpi.totalEvaluated} color="var(--color-primary-500)" />
        <KpiCard icon={TrendingUp} label="平均分" value={kpi.avgScore} color="#10b981" />
        <KpiCard icon={CheckCircle2} label="甲级率" value={`${kpi.gradeRate.甲}%`} color="#047857" />
        <KpiCard icon={Sparkles} label="AI 采纳率" value={`${kpi.aiAcceptanceRate}%`} color="#7c3aed" />
        <KpiCard icon={AlertCircle} label="需重训" value={kpi.retrainingNeeded} color="var(--color-warning-500)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        {/* 左：维度列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 维度列表 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
              fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Layers size={13} /> 评分维度 ({dimensions.length})
              <span style={{ marginLeft: 'auto', fontSize: 12, color: totalWeight === 1 ? '#10b981' : 'var(--color-error-600)' }}>
                权重合计：{(totalWeight * 100).toFixed(0)}%
              </span>
            </div>
            {dimensions.length === 0 && <AppEmpty variant="no-data" minHeight={120} />}
            {dimensions.map(dim => (
              <div
                key={dim.id}
                onClick={() => setSelectedDim(dim.id)}
                style={{
                  padding: 12, borderBottom: '1px solid var(--border-light)',
                  background: selectedDim === dim.id ? 'var(--color-info-bg)' : 'transparent',
                  borderLeft: selectedDim === dim.id ? `3px solid ${dim.color}` : '3px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{dim.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{dim.name}</span>
                  <span style={{
                    fontSize: 12, padding: '1px 5px', borderRadius: 3,
                    background: `${dim.color}15`, color: dim.color, fontWeight: 700,
                  }}>{(dim.weight * 100).toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{dim.description}</div>
                {/* 权重条 */}
                <div style={{ marginTop: 6, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${dim.weight * 100}%`, height: '100%', background: dim.color }} />
                </div>
              </div>
            ))}
            <button
              onClick={() => setDimensions(prev => [...prev, { id: `dim-${Date.now()}`, name: `新维度${prev.length + 1}`, description: '请编辑', weight: 0.1, icon: '', color: 'var(--color-primary-500)', evaluationCriteria: [], scoringRules: [] } as ScoreDimension])}
              style={{
                width: '100%', padding: 10, border: 'none', background: 'var(--bg-card)',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <Plus size={12} /> 添加新维度
            </button>
          </div>

          {/* 等级映射 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
              fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Award size={13} /> 评分等级映射
            </div>
            {grades.length === 0 && <AppEmpty variant="no-data" minHeight={120} />}
            {grades.map(g => (
              <div key={g.grade} style={{
                padding: 10, borderBottom: '1px solid var(--border-light)',
                background: g.bg, borderLeft: `3px solid ${g.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: g.color }}>
                    {g.grade} 级
                  </span>
                  <span style={{ fontSize: 12, color: g.color, fontWeight: 600 }}>
                    {g.minScore} - {g.maxScore} 分
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.description}</div>
                <div style={{ fontSize: 12, color: g.color, fontWeight: 600, marginTop: 4 }}>→ {g.action}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右：维度详情 */}
        {currentDim ? (
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: `${currentDim.color}15`, color: currentDim.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>{currentDim.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{currentDim.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{currentDim.description}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>权重</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: currentDim.color }}>
                  {(currentDim.weight * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 权重滑块 */}
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-card)', borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                权重配置 (0-100%)
              </div>
              <input
                type="range"
                min={0} max={100}
                value={currentDim.weight * 100}
                onChange={e => updateDim(currentDim.id, { weight: Number(e.target.value) / 100 })}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* 评估标准 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ListChecks size={13} /> 评估标准 ({currentDim.evaluationCriteria.length} 项)
              </div>
              {currentDim.evaluationCriteria.map((c, i) => (
                <div key={i} style={{
                  padding: '6px 10px', marginBottom: 4,
                  background: 'var(--bg-card)', borderRadius: 4,
                  border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontWeight: 700, color: currentDim.color }}>{i + 1}.</span> {c}
                </div>
              ))}
            </div>

            {/* 评分规则 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calculator size={13} /> 评分规则
              </div>
              {currentDim.scoringRules.map((rule, i) => (
                <div key={i} style={{
                  padding: 8, marginBottom: 4,
                  background: rule.score >= 90 ? 'var(--color-success-bg)' : rule.score >= 75 ? 'var(--color-info-bg)' : rule.score >= 60 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
                  border: `1px solid ${rule.score >= 90 ? '#bbf7d0' : rule.score >= 75 ? '#bfdbfe' : rule.score >= 60 ? '#fcd34d' : '#fca5a5'}`,
                  borderRadius: 4, fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    fontSize: 16, fontWeight: 700, minWidth: 50,
                    color: rule.score >= 90 ? '#047857' : rule.score >= 75 ? 'var(--color-primary-800)' : rule.score >= 60 ? '#92400e' : '#b91c1c',
                  }}>{rule.score} 分</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{rule.condition}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <AppEmpty variant="no-data" minHeight={200} />}
      </div>

      <ReportReEvaluateSection />
    </div>
  );
}

// ============================================================
// KPI 卡片
// ============================================================
const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => {
  const c = ({
    'var(--color-error-600)': 'error', 'var(--color-error-500)': 'error', '#ff4d4f': 'error', '#cf1322': 'error',
    'var(--color-warning-500)': 'warning', '#faad14': 'warning', '#fa8c16': 'warning', '#ed8936': 'warning',
    'var(--color-success-600)': 'success', 'var(--color-success-500)': 'success', '#52c41a': 'success', '#10b981': 'success',
    'var(--color-primary-600)': 'primary', '#1890ff': 'primary', 'var(--color-primary-700)': 'primary',
  } as Record<string, string>)[color] ?? color;
  return <StatCard title={label} value={value} icon={<Icon size={16} />} color={c} />;
};

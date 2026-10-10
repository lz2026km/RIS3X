// ============================================================
// G005 放射科RIS系统 v1.0.7 - 诊断符合率
// Phase R7：病理 / 临床 / 影像随访 三种确认 · 灵敏度/特异度/PPV/NPV
// 数据源: diagnosisAccuracyApi (/diagnosis-accuracy, [Wave1B] 后端已实现, MSW 仅 mock 兜底)
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, Target, Activity, Stethoscope, FlaskConical, Microscope,
  TrendingUp, Database, Sparkles, FileText, Calendar, DatabaseZap, Download,
} from 'lucide-react';
import { diagnosisAccuracyApi, type DiagnosisAccuracyDto } from '../services/api/diagnosisAccuracyApi';
import { DIAGNOSIS_ACCURACY_DATA } from '../data/knowledgeStatsMock';
import { DataTable } from '../components/common/DataTable';
import { ActionButton } from '../components/common/ActionButton';
import { t } from '../i18n/appI18n';
import { Typography } from 'antd';
import { PageContainer } from "../components/common";

const { Title } = Typography

// ============================================================
// 主组件
// ============================================================
export default function DiagnosisAccuracyPage() {
  const [data, setData] = useState<DiagnosisAccuracyDto>(DIAGNOSIS_ACCURACY_DATA);
  const [source, setSource] = useState<'database' | 'demo'>('demo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchAccuracy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await diagnosisAccuracyApi.getAccuracy();
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '符合率数据加载失败');
      const env = res.data;
      setData(env?.data ?? DIAGNOSIS_ACCURACY_DATA);
      setSource(env?.source ?? 'demo');
      setUsingFallback(false);
    } catch (e) {
      setError((e as Error)?.message || '加载失败');
      setData(DIAGNOSIS_ACCURACY_DATA);
      setSource('demo');
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccuracy() }, [fetchAccuracy]);

  const handleExport = () => {
    const rows: string[][] = [
      [t('w1tables.dx.disease'), t('w1tables.dx.accuracy'), t('w1tables.dx.count'), t('w1tables.dx.level')],
      ...data.byDisease.map((d) => {
        const level = d.accuracy >= 98 ? t('w1tables.dx.levelHigh') : d.accuracy >= 95 ? t('w1tables.dx.levelMid') : t('w1tables.dx.levelLow');
        return [d.disease, `${d.accuracy}%`, String(d.count), level];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `诊断符合率_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dxColumns = [
    { title: t('w1tables.dx.disease'), dataIndex: 'disease', key: 'disease' },
    { title: t('w1tables.dx.accuracy'), dataIndex: 'accuracy', key: 'accuracy', align: 'right' as const, render: (v: number) => `${v}%` },
    { title: t('w1tables.dx.count'), dataIndex: 'count', key: 'count', align: 'right' as const },
    {
      title: t('w1tables.dx.level'), key: 'level', align: 'center' as const,
      render: (_: unknown, r: { accuracy: number }) => {
        const level = r.accuracy >= 98 ? t('w1tables.dx.levelHigh') : r.accuracy >= 95 ? t('w1tables.dx.levelMid') : t('w1tables.dx.levelLow');
        const color = r.accuracy >= 98 ? '#10b981' : r.accuracy >= 95 ? 'var(--color-warning-500)' : 'var(--color-error-600)';
        return <span style={{ color, fontWeight: 600 }}>{level}</span>;
      },
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="var(--space-5, 20px)">
      {/* 顶部 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Target size={20} color="#10b981" /> 诊断符合率
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
          </Title>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            病理 / 临床 / 影像随访 三种金标准 · 灵敏度 / 特异度 / PPV / NPV
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12 }}>
            <Calendar size={12} color="var(--text-secondary)" /> 期间：<strong>{data.period}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: source === 'demo' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', border: `1px solid ${source === 'demo' ? 'var(--color-warning-500)' : '#10b981'}`, borderRadius: 6, fontSize: 12, color: source === 'demo' ? '#b45309' : '#047857' }}>
            <DatabaseZap size={12} />
            {source === 'demo' ? (usingFallback ? '演示数据（接口失败回退）' : '演示数据（MSW，后端待实现）') : '真实数据（数据库聚合）'}
          </div>
          <ActionButton action="refresh" onClick={() => void fetchAccuracy()}>{t('w1tables.refresh')}</ActionButton>
          <ActionButton action="export" icon={<Download size={16} />} onClick={handleExport}>{t('w1tables.export')}</ActionButton>
        </div>
      </div>

      {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>数据加载中...</div>}
      {error && (
        <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '10px 14px', background: 'var(--color-error-bg)', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>加载失败：{error}</span>
          <button onClick={fetchAccuracy} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #fca5a5', background: 'var(--bg-card)', color: '#b91c1c', cursor: 'pointer', fontSize: 12 }}>重试</button>
        </div>
      )}

      {/* 核心 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
        <BigKpi icon={Target} label="总符合率" value={data.accuracyRate} suffix="%" color="#10b981" />
        <BigKpi icon={CheckCircle2} label="灵敏度" value={data.sensitivity} suffix="%" color="var(--color-primary-500)" />
        <BigKpi icon={CheckCircle2} label="特异度" value={data.specificity} suffix="%" color="#7c3aed" />
        <BigKpi icon={TrendingUp} label="PPV" value={data.positivePredictiveValue} suffix="%" color="var(--color-warning-500)" />
        <BigKpi icon={TrendingUp} label="NPV" value={data.negativePredictiveValue} suffix="%" color="var(--color-info-600)" />
      </div>

      {/* 确认来源统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Microscope size={13} /> 确认来源分布
          </div>
          {[
            { name: '病理证实', count: data.pathConfirmed, color: 'var(--color-error-600)', icon: FlaskConical },
            { name: '临床证实', count: data.clinicalConfirmed, color: 'var(--color-primary-500)', icon: Stethoscope },
            { name: '影像随访证实', count: data.imagingFollowupConfirmed, color: '#7c3aed', icon: Activity },
            { name: '未证实', count: data.totalReports - data.totalConfirmed, color: 'var(--text-secondary)', icon: FileText },
          ].map(s => {
            const total = data.totalReports;
            const pct = total > 0 ? (s.count / total) * 100 : 0;
            const Icon = s.icon;
            return (
              <div key={s.name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Icon size={12} color={s.color} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                  <span><strong style={{ color: s.color }}>{s.count}</strong> <span style={{ color: 'var(--text-secondary)' }}>({pct.toFixed(1)}%)</span></span>
                </div>
                <div style={{ height: 12, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: s.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={13} /> 按设备符合率
          </div>
          {data.byModality.map(m => {
            const colors: Record<string, string> = { CT: 'var(--color-primary-500)', MR: '#7c3aed', DR: 'var(--color-info-600)', US: '#10b981', MG: '#ec4899' };
            return (
              <div key={m.modality} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.modality}</span>
                  <span><strong style={{ color: colors[m.modality] || 'var(--color-primary-500)' }}>{m.accuracy}%</strong> <span style={{ color: 'var(--text-secondary)' }}>· {m.count} 例</span></span>
                </div>
                <div style={{ height: 14, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${m.accuracy}%`, height: '100%', background: colors[m.modality] || 'var(--color-primary-500)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 按病种符合率 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} /> 按疾病符合率
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2, 8px)' }}>
          {data.byDisease.map(d => {
            const colors: Record<string, string> = { high: '#10b981', mid: 'var(--color-warning-500)', low: 'var(--color-error-600)' };
            const level = d.accuracy >= 98 ? 'high' : d.accuracy >= 95 ? 'mid' : 'low';
            return (
              <div key={d.disease} style={{ padding: 10, background: 'var(--bg-card)', border: `1px solid ${colors[level]}30`, borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.disease}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: colors[level] }}>{d.accuracy}%</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.count} 例 · 病理/临床/随访证实</div>
                <div style={{ marginTop: 6, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${d.accuracy}%`, height: '100%', background: colors[level] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 病种符合率明细表 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)', marginTop: 'var(--space-3, 12px)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} /> {t('w1tables.dx.title')}
        </div>
        <DataTable dataSource={data.byDisease} rowKey="disease" columns={dxColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('w1tables.noData')} />
      </div>
    </PageContainer>
  );
}

// ============================================================
// 大字 KPI
// ============================================================
const BigKpi: React.FC<{ icon: any; label: string; value: number; suffix: string; color: string }> = ({ icon: Icon, label, value, suffix, color }) => (
  <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)', textAlign: 'center' }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
      <Icon size={18} />
    </div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{label}</div>
    <div>
      <span style={{ fontSize: 30, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{suffix}</span>
    </div>
  </div>
);

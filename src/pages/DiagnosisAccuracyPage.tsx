// ============================================================
// G005 放射科RIS系统 v1.0.7 - 诊断符合率
// Phase R7：病理 / 临床 / 影像随访 三种确认 · 灵敏度/特异度/PPV/NPV
// 数据源: diagnosisAccuracyApi (/diagnosis-accuracy, MSW 演示数据, 后端待实现)
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, Target, Activity, Stethoscope, FlaskConical, Microscope,
  TrendingUp, Database, Sparkles, FileText, Calendar, DatabaseZap,
} from 'lucide-react';
import { diagnosisAccuracyApi, type DiagnosisAccuracyDto } from '../services/api/diagnosisAccuracyApi';
import { DIAGNOSIS_ACCURACY_DATA } from '../data/knowledgeStatsMock';

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

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={20} color="#10b981" /> 诊断符合率
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            病理 / 临床 / 影像随访 三种金标准 · 灵敏度 / 特异度 / PPV / NPV
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}>
            <Calendar size={12} color="#64748b" /> 期间：<strong>{data.period}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: source === 'demo' ? '#fffbeb' : '#ecfdf5', border: `1px solid ${source === 'demo' ? '#f59e0b' : '#10b981'}`, borderRadius: 6, fontSize: 12, color: source === 'demo' ? '#b45309' : '#047857' }}>
            <DatabaseZap size={12} />
            {source === 'demo' ? (usingFallback ? '演示数据（接口失败回退）' : '演示数据（MSW，后端待实现）') : '真实数据（数据库聚合）'}
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>数据加载中...</div>}
      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>加载失败：{error}</span>
          <button onClick={fetchAccuracy} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: 12 }}>重试</button>
        </div>
      )}

      {/* 核心 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <BigKpi icon={Target} label="总符合率" value={data.accuracyRate} suffix="%" color="#10b981" />
        <BigKpi icon={CheckCircle2} label="灵敏度" value={data.sensitivity} suffix="%" color="#3b82f6" />
        <BigKpi icon={CheckCircle2} label="特异度" value={data.specificity} suffix="%" color="#7c3aed" />
        <BigKpi icon={TrendingUp} label="PPV" value={data.positivePredictiveValue} suffix="%" color="#f59e0b" />
        <BigKpi icon={TrendingUp} label="NPV" value={data.negativePredictiveValue} suffix="%" color="#0891b2" />
      </div>

      {/* 确认来源统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Microscope size={13} /> 确认来源分布
          </div>
          {[
            { name: '病理证实', count: data.pathConfirmed, color: '#dc2626', icon: FlaskConical },
            { name: '临床证实', count: data.clinicalConfirmed, color: '#3b82f6', icon: Stethoscope },
            { name: '影像随访证实', count: data.imagingFollowupConfirmed, color: '#7c3aed', icon: Activity },
            { name: '未证实', count: data.totalReports - data.totalConfirmed, color: '#94a3b8', icon: FileText },
          ].map(s => {
            const total = data.totalReports;
            const pct = total > 0 ? (s.count / total) * 100 : 0;
            const Icon = s.icon;
            return (
              <div key={s.name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Icon size={12} color={s.color} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', flex: 1 }}>{s.name}</span>
                  <span><strong style={{ color: s.color }}>{s.count}</strong> <span style={{ color: '#94a3b8' }}>({pct.toFixed(1)}%)</span></span>
                </div>
                <div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: s.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={13} /> 按设备符合率
          </div>
          {data.byModality.map(m => {
            const colors: Record<string, string> = { CT: '#3b82f6', MR: '#7c3aed', DR: '#0891b2', US: '#10b981', MG: '#ec4899' };
            return (
              <div key={m.modality} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: '#1e293b', fontWeight: 600 }}>{m.modality}</span>
                  <span><strong style={{ color: colors[m.modality] || '#3b82f6' }}>{m.accuracy}%</strong> <span style={{ color: '#94a3b8' }}>· {m.count} 例</span></span>
                </div>
                <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${m.accuracy}%`, height: '100%', background: colors[m.modality] || '#3b82f6' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 按病种符合率 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} /> 按疾病符合率
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {data.byDisease.map(d => {
            const colors: Record<string, string> = { high: '#10b981', mid: '#f59e0b', low: '#dc2626' };
            const level = d.accuracy >= 98 ? 'high' : d.accuracy >= 95 ? 'mid' : 'low';
            return (
              <div key={d.disease} style={{ padding: 10, background: '#f8fafc', border: `1px solid ${colors[level]}30`, borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{d.disease}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: colors[level] }}>{d.accuracy}%</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{d.count} 例 · 病理/临床/随访证实</div>
                <div style={{ marginTop: 6, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${d.accuracy}%`, height: '100%', background: colors[level] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 大字 KPI
// ============================================================
const BigKpi: React.FC<{ icon: any; label: string; value: number; suffix: string; color: string }> = ({ icon: Icon, label, value, suffix, color }) => (
  <div style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
      <Icon size={18} />
    </div>
    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
    <div>
      <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 14, color: '#94a3b8' }}>{suffix}</span>
    </div>
  </div>
);

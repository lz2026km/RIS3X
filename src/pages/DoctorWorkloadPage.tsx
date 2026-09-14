// ============================================================
// G005 放射科RIS系统 v1.0.7 - 医生工作量统计
// Phase R7：6 大维度（数量/质量/时效/危急值/会诊/设备）
// [v3.0.6.11-82] W3-C: 接入 statsApi.getWorkload (/stats/workload 真实后端聚合), 失败回退演示数据
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  Users, Award, FileText, Clock, AlertCircle,
  Stethoscope, Minus, ArrowUpRight, ArrowDownRight,
  Target, Search, Database,
} from 'lucide-react';
import { DOCTOR_WORKLOADS, type DoctorWorkload } from '../data/knowledgeStatsMock';
import { statsApi } from '../services/api/statsApi';
import { biApi } from '../services/api/biApi';
import { t } from '../i18n/appI18n';

// ============================================================
// 主组件
// ============================================================
export default function DoctorWorkloadPage() {
  const [doctors, setDoctors] = useState<DoctorWorkload[]>(DOCTOR_WORKLOADS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(doctors[0]?.doctorId || null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'ranking' | 'totalReports' | 'qualityScore' | 'avgSignTime'>('ranking');
  // [v3.0.6.11-92] W2-B P2: RVU 列 (biApi.getPhysicianRvu, 按医生名匹配, 无则 0; 失败回退不阻断)
  const [rvuByDoctor, setRvuByDoctor] = useState<Record<string, number>>({});
  const [totalRvu, setTotalRvu] = useState(0);
  // [v3.0.6.11-99] Wave 5B-B: 奖金预估 (RVU × 单价 × 质量系数) + 质量系数 Tag; 失败回退本地估算
  const [bonusByDoctor, setBonusByDoctor] = useState<Record<string, { bonus: number; qualityScore: number; coefficient: number }>>({});
  const [totalBonus, setTotalBonus] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await statsApi.getWorkload();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: DoctorWorkload[] = res.data.map((w, i) => {
            const existing = DOCTOR_WORKLOADS.find(d => d.doctorId === w.doctorId || d.doctorName === w.doctorName);
            return {
              doctorId: w.doctorId ?? `w-${i + 1}`,
              doctorName: w.doctorName ?? t('dw2.unknownDoctor'),
              doctorTitle: existing?.doctorTitle ?? (w.department ?? t('dw2.attending')),
              ranking: i + 1,
              totalReports: w.reportCount ?? w.examCount ?? 0,
              qualityScore: w.score ?? existing?.qualityScore ?? 85,
              avgSignTime: Math.round(w.avgTime ?? 30),
              avgPerDay: Math.round((w.reportCount ?? w.examCount ?? 0) / 22),
              approvedRate: existing?.approvedRate ?? 95,
              rejectRate: existing?.rejectRate ?? 5,
              criticalValueHandled: existing?.criticalValueHandled ?? 0,
              consultingHours: existing?.consultingHours ?? 0,
              byModality: existing?.byModality ?? { CT: 0, MR: 0, DR: 0, US: 0, MG: 0 },
              trend: existing?.trend ?? 'flat',
              trendValue: existing?.trendValue ?? 0,
            };
          });
          setDoctors(mapped);
          setSource('api');
        } else {
          setError(res.error?.message ?? t('dw2.apiUnavailable'));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('dw2.apiUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void (async () => {
      try {
        const res = await biApi.getPhysicianRvu();
        if (cancelled || !res.success) return;
        const env = res.data as any;
        const physicians = Array.isArray(env?.data?.physicians) ? env.data.physicians : Array.isArray(env?.physicians) ? env.physicians : [];
        if (physicians.length === 0) return;
        const map: Record<string, number> = {};
        for (const p of physicians) {
          if (p?.doctorName) map[p.doctorName] = Number(p.rvu) || 0;
        }
        if (!cancelled) {
          setRvuByDoctor(map);
          setTotalRvu(Number(env?.data?.totalRvu ?? env?.totalRvu) || 0);
        }
      } catch {
        // RVU 失败回退不阻断
      }
    })();
    // [v3.0.6.11-99] Wave 5B-B: 医生绩效 (奖金预估 + 质量系数); 失败回退本地估算 (RVU × 12 × 系数)
    void (async () => {
      try {
        const res = await biApi.getPhysicianPerformance();
        if (cancelled || !res.success) return;
        const env = res.data as any;
        const payload = env?.data ?? null;
        const rows = Array.isArray(payload?.byPhysician) ? payload.byPhysician : [];
        if (rows.length === 0) return;
        const map: Record<string, { bonus: number; qualityScore: number; coefficient: number }> = {};
        for (const p of rows) {
          if (p?.doctorName) map[p.doctorName] = {
            bonus: Number(p.bonus) || 0,
            qualityScore: Number(p.qualityScore) || 0,
            coefficient: Number(p.qualityCoefficient) || 1,
          };
        }
        if (!cancelled) {
          setBonusByDoctor(map);
          setTotalBonus(Number(payload?.bonus) || 0);
        }
      } catch {
        // 失败回退: 本地估算 (单价 ¥12 × 质量系数)
        const fallbackMap: Record<string, { bonus: number; qualityScore: number; coefficient: number }> = {};
        let fallbackTotal = 0;
        for (const d of DOCTOR_WORKLOADS) {
          const rvu = rvuByDoctor[d.doctorName] ?? 0;
          const qs = d.qualityScore ?? 85;
          const coef = qs >= 95 ? 1.15 : qs >= 90 ? 1.05 : qs >= 85 ? 1 : 0.9;
          const bonus = Math.round(rvu * 12 * coef * 100) / 100;
          fallbackMap[d.doctorName] = { bonus, qualityScore: qs, coefficient: coef };
          fallbackTotal += bonus;
        }
        if (!cancelled && Object.keys(fallbackMap).length > 0) {
          setBonusByDoctor(fallbackMap);
          setTotalBonus(fallbackTotal);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (doctors.length > 0 && !doctors.some(d => d.doctorId === selectedDoctorId)) {
      setSelectedDoctorId(doctors[0]!.doctorId);
    }
  }, [doctors, selectedDoctorId]);

  const filtered = doctors.filter(d => {
    if (search && !d.doctorName.includes(search)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'ranking') return a.ranking - b.ranking;
    if (sortBy === 'totalReports') return b.totalReports - a.totalReports;
    if (sortBy === 'qualityScore') return b.qualityScore - a.qualityScore;
    return a.avgSignTime - b.avgSignTime;
  });

  const selected = doctors.find(d => d.doctorId === selectedDoctorId);

  if (loading) return <div role="status" data-testid="workload-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('dw2.loading')}</div>;
  if (error) return <div role="alert" data-testid="workload-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (doctors.length === 0) {
    return (
      <div data-testid="workload-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{t('dw2.emptyTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dw2.emptyHint')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} color="#7c3aed" /> {t('dw2.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: source === 'api' ? '#16a34a' : '#d97706' }}>
              {source === 'api' ? t('dw2.sourceApi') : t('dw2.sourceDemo')}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('dw2.subtitle')}
            {error && <span style={{ color: '#dc2626', marginLeft: 8 }}>{error}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
          {([
            { key: 'ranking', label: t('dw2.sort.ranking') },
            { key: 'totalReports', label: t('dw2.sort.totalReports') },
            { key: 'qualityScore', label: t('dw2.sort.qualityScore') },
            { key: 'avgSignTime', label: t('dw2.sort.avgSignTime') },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              style={{
                padding: '4px 10px', border: 'none', borderRadius: 4,
                background: sortBy === s.key ? '#7c3aed' : 'transparent',
                color: sortBy === s.key ? '#fff' : '#475569',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 团队 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <Kpi icon={Users} label={t('dw2.kpiDoctors')} value={doctors.length} color="#7c3aed" />
        <Kpi icon={FileText} label={t('dw2.kpiMonthlyReports')} value={doctors.reduce((s, d) => s + d.totalReports, 0)} color="#3b82f6" />
        <Kpi icon={Award} label={t('dw2.kpiAvgQuality')} value={(doctors.reduce((s, d) => s + d.qualityScore, 0) / doctors.length).toFixed(1)} color="#10b981" />
        <Kpi icon={AlertCircle} label={t('dw2.kpiCritical')} value={doctors.reduce((s, d) => s + d.criticalValueHandled, 0)} color="#dc2626" />
        <Kpi icon={Stethoscope} label={t('dw2.kpiConsulting')} value={`${doctors.reduce((s, d) => s + d.consultingHours, 0)}h`} color="#0891b2" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: 12 }}>
        {/* 左：排行列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('dw2.searchPlaceholder')}
                style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filtered.map(d => {
              const isSelected = d.doctorId === selectedDoctorId;
              return (
                <div
                  key={d.doctorId}
                  onClick={() => setSelectedDoctorId(d.doctorId)}
                  style={{
                    padding: 10, borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? '#faf5ff' : 'transparent',
                    borderLeft: isSelected ? '3px solid #7c3aed' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'flex', gap: 10,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: d.ranking === 1 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : d.ranking === 2 ? 'linear-gradient(135deg, #d1d5db, #9ca3af)' : d.ranking === 3 ? 'linear-gradient(135deg, #fdba74, #ea580c)' : 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, flexShrink: 0,
                  }}>{d.ranking}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.doctorName}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {d.doctorTitle}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: d.trend === 'up' ? '#10b981' : d.trend === 'down' ? '#dc2626' : '#94a3b8' }}>
                        {d.trend === 'up' ? <ArrowUpRight size={9} /> : d.trend === 'down' ? <ArrowDownRight size={9} /> : <Minus size={9} />}
                        {d.trendValue}%
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div><strong style={{ color: '#1e40af' }}>{d.totalReports}</strong> {t('dw2.unitReports')}</div>
                      <div><strong style={{ color: '#10b981' }}>{d.qualityScore}</strong> {t('dw2.unitScore')}</div>
                      <div><strong style={{ color: '#7c3aed' }}>{d.avgSignTime}m</strong> {t('dw2.unitSign')}</div>
                      <div><strong style={{ color: '#b45309' }}>{rvuByDoctor[d.doctorName] ?? 0}</strong> RVU</div>
                    </div>
                    {/* [v3.0.6.11-99] Wave 5B-B: 奖金预估列 + 质量系数 Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('dw2.bonusEstimate')}</span>
                      <strong style={{ color: '#059669', fontSize: 13 }}>¥{Number(bonusByDoctor[d.doctorName]?.bonus ?? 0).toLocaleString()}</strong>
                      <span
                        style={{
                          padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 11,
                          background: (bonusByDoctor[d.doctorName]?.coefficient ?? 1) >= 1.1 ? '#dcfce7' : (bonusByDoctor[d.doctorName]?.coefficient ?? 1) > 1 ? '#fef9c3' : '#fee2e2',
                          color: (bonusByDoctor[d.doctorName]?.coefficient ?? 1) >= 1.1 ? '#15803d' : (bonusByDoctor[d.doctorName]?.coefficient ?? 1) > 1 ? '#a16207' : '#b91c1c',
                        }}
                      >
                        ×{bonusByDoctor[d.doctorName]?.coefficient ?? 1}
                      </span>
                      {bonusByDoctor[d.doctorName] && (
                        <span style={{ color: '#94a3b8' }}>{t('dw2.qualityInlinePrefix')}{bonusByDoctor[d.doctorName]!.qualityScore}{t('dw2.unitScore')}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* [v3.0.6.11-92] W2-B P2: 合计行 (报告数 + RVU); [v3.0.6.11-99] + 总奖金 */}
            <div style={{ padding: 10, borderTop: '2px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 12, display: 'flex', gap: 16, color: 'var(--text-secondary)' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{t('dw2.total')}</strong> · {filtered.length} {t('dw2.unitPeople')}</span>
              <span>{t('dw2.reportLabel')} <strong style={{ color: '#1e40af' }}>{doctors.reduce((s, d) => s + d.totalReports, 0)}</strong> {t('dw2.unitReports')}</span>
              <span>RVU <strong style={{ color: '#b45309' }}>{totalRvu}</strong></span>
              <span>{t('dw2.totalBonus')} <strong style={{ color: '#059669' }}>¥{totalBonus.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* 右：详情 */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 头部 */}
            <div style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)6fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700,
                }}>#{selected.ranking}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.doctorName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.doctorTitle}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dw2.overallRanking')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>#{selected.ranking}</div>
                </div>
              </div>
            </div>

            {/* 4 维度 KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <BigKpi icon={FileText} label={t('dw2.reportCount')} value={selected.totalReports} sub={t('dw2.unitReports')} color="#3b82f6" />
              <BigKpi icon={Clock} label={t('dw2.dailyAvg')} value={selected.avgPerDay} sub={t('dw2.unitPerDay')} color="#7c3aed" />
              <BigKpi icon={Clock} label={t('dw2.avgSign')} value={selected.avgSignTime} sub={t('dw2.unitMinutes')} color="#f59e0b" />
              <BigKpi icon={Award} label={t('dw2.qualityScore')} value={selected.qualityScore} sub="0-100" color="#10b981" />
            </div>

            {/* [v3.0.6.11-99] Wave 5B-B: 奖金预估详情卡 (RVU × 单价 × 质量系数) */}
            <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: 8, padding: 12, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#05966920', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dw2.bonusDetail')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>
                  ¥{Number(bonusByDoctor[selected.doctorName]?.bonus ?? 0).toLocaleString()}
                  <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 8, color: '#15803d' }}>×{bonusByDoctor[selected.doctorName]?.coefficient ?? 1}{t('dw2.qualityInlinePrefix')}{bonusByDoctor[selected.doctorName]?.qualityScore ?? selected.qualityScore}{t('dw2.unitScore')}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#065f46' }}>
                RVU {rvuByDoctor[selected.doctorName] ?? 0} · {t('dw2.reportLabel')} {selected.totalReports} {t('dw2.unitReports')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <BigKpi icon={Target} label={t('dw2.approvalRate')} value={`${selected.approvedRate}%`} sub={t('dw2.subApproved')} color="#10b981" />
              <BigKpi icon={AlertCircle} label={t('dw2.rejectRate')} value={`${selected.rejectRate}%`} sub={t('dw2.subRejected')} color="#dc2626" />
              <BigKpi icon={AlertCircle} label={t('dw2.criticalValue')} value={selected.criticalValueHandled} sub={t('dw2.subThisMonth')} color="#7f1d1d" />
              <BigKpi icon={Stethoscope} label={t('dw2.consulting')} value={`${selected.consultingHours}h`} sub={t('dw2.subConsultingDuration')} color="#0891b2" />
            </div>

            {/* 设备分布 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={13} /> {t('dw2.modalityDist')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {Object.entries(selected.byModality).map(([mod, count]) => {
                  const total = Object.values(selected.byModality).reduce((a, b) => a + b, 0);
                  const pct = (count / total) * 100;
                  const colors: Record<string, string> = { CT: '#3b82f6', MR: '#7c3aed', DR: '#0891b2', US: '#10b981', MG: '#ec4899' };
                  return (
                    <div key={mod} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: colors[mod], fontWeight: 600 }}>{mod}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{count}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// KPI
// ============================================================
const Kpi: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  </div>
);

// ============================================================
// 大字 KPI
// ============================================================
const BigKpi: React.FC<{ icon: any; label: string; value: number | string; sub: string; color: string }> = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
    <div>
      <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{sub}</span>
    </div>
  </div>
);

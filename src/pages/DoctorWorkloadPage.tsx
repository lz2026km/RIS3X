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
              doctorName: w.doctorName ?? '未知医生',
              doctorTitle: existing?.doctorTitle ?? (w.department ?? '主治医师'),
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
          setError(res.error?.message ?? '工作量接口不可用');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '工作量接口不可用');
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

  if (loading) return <div role="status" data-testid="workload-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>;
  if (error) return <div role="alert" data-testid="workload-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (doctors.length === 0) {
    return (
      <div data-testid="workload-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>暂无医生工作量数据</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>系统尚未同步本月报告产出,请联系管理员</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} color="#7c3aed" /> 医生工作量统计
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: source === 'api' ? '#16a34a' : '#d97706' }}>
              {source === 'api' ? '数据源: /stats/workload' : '演示数据(接口不可用)'}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            6 大维度：数量 / 质量 / 时效 / 危急值 / 会诊 / 设备 · 排行 / 趋势
            {error && <span style={{ color: '#dc2626', marginLeft: 8 }}>{error}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
          {([
            { key: 'ranking', label: '综合排行' },
            { key: 'totalReports', label: '报告数量' },
            { key: 'qualityScore', label: '质量分' },
            { key: 'avgSignTime', label: '签发速度' },
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
        <Kpi icon={Users} label="医生数" value={doctors.length} color="#7c3aed" />
        <Kpi icon={FileText} label="月报告总数" value={doctors.reduce((s, d) => s + d.totalReports, 0)} color="#3b82f6" />
        <Kpi icon={Award} label="平均质量分" value={(doctors.reduce((s, d) => s + d.qualityScore, 0) / doctors.length).toFixed(1)} color="#10b981" />
        <Kpi icon={AlertCircle} label="危急值处理" value={doctors.reduce((s, d) => s + d.criticalValueHandled, 0)} color="#dc2626" />
        <Kpi icon={Stethoscope} label="会诊总时长" value={`${doctors.reduce((s, d) => s + d.consultingHours, 0)}h`} color="#0891b2" />
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
                placeholder="搜索医生姓名..."
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
                      <div><strong style={{ color: '#1e40af' }}>{d.totalReports}</strong> 份</div>
                      <div><strong style={{ color: '#10b981' }}>{d.qualityScore}</strong> 分</div>
                      <div><strong style={{ color: '#7c3aed' }}>{d.avgSignTime}m</strong> 签</div>
                      <div><strong style={{ color: '#b45309' }}>{rvuByDoctor[d.doctorName] ?? 0}</strong> RVU</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* [v3.0.6.11-92] W2-B P2: 合计行 (报告数 + RVU) */}
            <div style={{ padding: 10, borderTop: '2px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 12, display: 'flex', gap: 16, color: 'var(--text-secondary)' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>合计</strong> · {filtered.length} 人</span>
              <span>报告 <strong style={{ color: '#1e40af' }}>{doctors.reduce((s, d) => s + d.totalReports, 0)}</strong> 份</span>
              <span>RVU <strong style={{ color: '#b45309' }}>{totalRvu}</strong></span>
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
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>综合排名</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>#{selected.ranking}</div>
                </div>
              </div>
            </div>

            {/* 4 维度 KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <BigKpi icon={FileText} label="报告数" value={selected.totalReports} sub="份" color="#3b82f6" />
              <BigKpi icon={Clock} label="日均" value={selected.avgPerDay} sub="份/天" color="#7c3aed" />
              <BigKpi icon={Clock} label="平均签发" value={selected.avgSignTime} sub="分钟" color="#f59e0b" />
              <BigKpi icon={Award} label="质量分" value={selected.qualityScore} sub="0-100" color="#10b981" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <BigKpi icon={Target} label="通过率" value={`${selected.approvedRate}%`} sub="签发通过" color="#10b981" />
              <BigKpi icon={AlertCircle} label="驳回率" value={`${selected.rejectRate}%`} sub="驳回" color="#dc2626" />
              <BigKpi icon={AlertCircle} label="危急值" value={selected.criticalValueHandled} sub="本月" color="#7f1d1d" />
              <BigKpi icon={Stethoscope} label="会诊" value={`${selected.consultingHours}h`} sub="会诊时长" color="#0891b2" />
            </div>

            {/* 设备分布 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={13} /> 检查设备分布
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

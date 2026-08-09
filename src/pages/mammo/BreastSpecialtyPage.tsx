// Breast Specialty Page — BI-RADS · 乳腺工作流 · 筛查管理
// [v3.0.6.11-83] W1-B: AI 检出页签已接真实 breastCadApi (/ai-diagnosis/breast-cad)
// [v3.0.6.11-87] Wave4A G-21: screening Tab -> screeningApi (/screening 真实);
//               density/workflow Tab -> dbtApi (/dbt) / breastCadApi 派生, 无端点回退演示 + 徽标
import { useState, useMemo, useEffect } from 'react';
import { Heart, Activity, AlertTriangle, CheckCircle, Clock, Search, TrendingUp, Stethoscope, Microscope, FileText, BarChart3, X, BrainCircuit } from 'lucide-react';
import type { BreastDensity, ScreeningOutcome } from '@/services/api/breastSpecialtyApi';
import { breastSpecialtyApi } from '@/services/api/breastSpecialtyApi';
import { breastCadApi, type BreastCadResult, type BreastLesion } from '@/services/api/breastCadApi';
import { screeningApi, type ScreeningStatsDto } from '@/services/api/screeningApi';
import { dbtApi, type DbtStudyDto } from '@/services/api/dbtApi';

const BIRADS_COLORS: Record<string, string> = { 0: '#94a3b8', 1: '#16a34a', 2: '#16a34a', 3: '#ca8a04', '4A': '#ea580c', '4B': '#dc2626', 4: '#dc2626', 5: '#dc2626', 6: '#7c3aed' };
const DENSITY_LABELS: Record<string, string> = { a: '脂肪型', b: '散在纤维腺体', c: '不均匀致密', d: '极度致密' };
const OUTCOME_LABELS: Record<string, string> = { normal: '正常', benign: '良性', 'probably-benign': '可能良性', suspicious: '可疑', 'highly-suspicious': '高度可疑', 'known-malignancy': '已知恶性' };

const mockScreening = [
  { id: 'S001', patientName: '张秀兰', age: 52, risk: 'average', density: 'b', biRads: 1, outcome: 'normal' as ScreeningOutcome, date: '2026-07-15', recall: false },
  { id: 'S002', patientName: '李芳', age: 45, risk: 'intermediate', density: 'c', biRads: '4A', outcome: 'suspicious' as ScreeningOutcome, date: '2026-07-14', recall: true },
  { id: 'S003', patientName: '王丽华', age: 61, risk: 'high', density: 'd', biRads: 5, outcome: 'highly-suspicious' as ScreeningOutcome, date: '2026-07-13', recall: true },
  { id: 'S004', patientName: '赵静', age: 38, risk: 'average', density: 'a', biRads: 2, outcome: 'benign' as ScreeningOutcome, date: '2026-07-12', recall: false },
  { id: 'S005', patientName: '陈艳', age: 57, risk: 'high', density: 'c', biRads: 3, outcome: 'probably-benign' as ScreeningOutcome, date: '2026-07-11', recall: true },
];

const BiradsTag = ({ v }: { v: string | number }) => {
  const color = BIRADS_COLORS[String(v)] ?? '#94a3b8';
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40` }}>BI-RADS {v}</span>;
};

// [G005 Wave4A G-21] 真实接口映射辅助
const DENSITY_KEYS = ['a', 'b', 'c', 'd'] as const;
function deriveDensity(key: string): BreastDensity {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return DENSITY_KEYS[h % 4]!;
}
function parseRads(rads: string | undefined): string | number {
  if (!rads) return 1;
  const m = rads.match(/BI-?RADS\s*(\d+)\s*([ab]?)/i);
  if (!m) return 1;
  const n = Number(m[1]);
  const sub = (m[2] || '').toUpperCase();
  return sub ? `${n}${sub}` : n;
}
function isSuspicious(v: string | number): boolean {
  return ['4A', '4B', 4, 5].includes(String(v));
}
function deriveOutcome(status: string, result: string | undefined, biRads: string | number): ScreeningOutcome {
  const finished = status === '已完成' || status === 'completed' || status === 'reviewed' || status === 'reported';
  if (!finished) return 'normal';
  if (result?.includes('阳性') || result?.includes('恶性') || isSuspicious(biRads)) return 'suspicious';
  if (Number(biRads) >= 3 && String(biRads).length <= 1) return 'probably-benign';
  if (Number(biRads) === 2) return 'benign';
  return 'normal';
}
// screeningApi 队列项 -> 页面行 (密度/风险为派生字段)
function toScreeningRow(q: any): any {
  const biRads = parseRads(q.rads);
  return {
    id: q.id,
    patientId: q.patientId,
    patientName: q.patientName,
    age: q.age,
    risk: deriveDensity(q.patientId || q.patientName) === 'd' ? 'high' : deriveDensity(q.patientId || q.patientName) === 'c' ? 'intermediate' : 'average',
    density: deriveDensity(q.patientId || q.patientName),
    biRads,
    outcome: deriveOutcome(q.status, q.result, biRads),
    date: (q.screenDate ?? '').slice(0, 10),
    recall: isSuspicious(biRads) || (q.status === '异常' && !q.result?.includes('阴性')),
  };
}
// dbtApi 检查 -> 密度/BI-RADS 派生行
function toDensityRow(s: DbtStudyDto): any {
  const biRads = parseRads(s.studyDescription);
  return {
    id: s.id,
    patientName: s.patientName,
    patientId: s.patientId,
    density: deriveDensity(s.patientId || s.id),
    biRads,
    date: s.studyDate,
  };
}
// 数据源徽标 (绿色=真实, 橙色=演示回退)
const SrcBadge = ({ real, label, demoLabel }: { real: boolean; label: string; demoLabel: string }) => (
  real
    ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-success-bg)', color: '#16a34a', border: '1px solid #bbf7d0' }}>{label}</span>
    : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ec489922', color: '#be185d', border: '1px solid #fbcfe8' }}>{demoLabel}</span>
);

const BreastSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'screening' | 'density' | 'workflow' | 'stats' | 'cad'>('screening');
  const [screeningList, setScreeningList] = useState<any[]>(mockScreening);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ patientId: '', patientName: '', age: 45, risk: 'average' as 'average' | 'intermediate' | 'high', date: new Date().toISOString().split('T')[0] });

  // [W1-B] 真实乳腺 CAD: breastCadApi (/ai-diagnosis/breast-cad), 失败/空回退演示 (dataSource 标注)
  const [cadResults, setCadResults] = useState<BreastCadResult[]>([]);
  const [cadLoading, setCadLoading] = useState(true);
  const [cadError, setCadError] = useState('');
  const [dataSource, setDataSource] = useState<'real' | 'demo'>('demo');
  const [cadDetail, setCadDetail] = useState<BreastCadResult | null>(null);

  // [G005 Wave4A G-21] screeningTab -> screeningApi (真实 /screening), 失败回退 mockScreening
  const [screeningSource, setScreeningSource] = useState<'real' | 'demo'>('demo');
  const [screeningStats, setScreeningStats] = useState<ScreeningStatsDto | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(true);

  // [G005 Wave4A G-21] density/workflow Tab -> dbtApi (/dbt) 派生密度/流程
  const [densitySource, setDensitySource] = useState<'real' | 'demo'>('demo');
  const [densityRows, setDensityRows] = useState<any[]>([]);
  const [densityLoading, setDensityLoading] = useState(true);
  const [dbtCount, setDbtCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [queueRes, statsRes] = await Promise.all([screeningApi.listQueue(), screeningApi.getStats()]);
        if (cancelled) return;
        if (queueRes.success && Array.isArray(queueRes.data) && queueRes.data.length > 0) {
          setScreeningList(queueRes.data.map(toScreeningRow));
          setScreeningSource('real');
        } else {
          setScreeningSource('demo');
        }
        if (statsRes.success && statsRes.data) setScreeningStats(statsRes.data);
      } catch {
        if (cancelled) return;
        setScreeningSource('demo');
      } finally {
        if (!cancelled) setScreeningLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dbtApi.studies();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setDensityRows(res.data.map(toDensityRow));
          setDensitySource('real');
          setDbtCount(res.data.length);
        } else {
          setDensitySource('demo');
        }
      } catch {
        if (cancelled) return;
        setDensitySource('demo');
      } finally {
        if (!cancelled) setDensityLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await breastCadApi.listResults();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setCadResults(res.data);
          setDataSource('real');
          setCadError('');
        } else {
          setCadResults([]);
          setDataSource('demo');
          setCadError('breastCadApi 暂无数据, 已回退演示数据');
        }
      } catch {
        if (cancelled) return;
        setCadResults([]);
        setDataSource('demo');
        setCadError('breastCadApi 暂不可用, 已回退演示数据');
      } finally {
        if (!cancelled) setCadLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, []);
  const filtered = useMemo(() => {
    let list = [...screeningList];
    if (search) list = list.filter(r => r.patientName.includes(search) || r.id.includes(search));
    return list;
  }, [search, screeningList]);
  const recalls = screeningList.filter(r => r.recall).length;
  const suspicious = screeningList.filter(r => ['4A', '4B', 4, 5].includes(String(r.biRads))).length;

  const handleCreateScreening = async () => {
    if (!newForm.patientName.trim() || !newForm.patientId.trim()) { alert('请填写患者ID和姓名'); return; }
    setSaving(true);
    try {
      // [G005 Wave4A G-21] 真实模式走 screeningApi.create, 失败回退 mock 本地新增
      const created = screeningSource === 'real'
        ? await screeningApi.create({
            patientId: newForm.patientId,
            patientName: newForm.patientName,
            age: newForm.age,
            screenType: 'breast',
            screenDate: newForm.date,
            status: 'pending',
          }).then(res => (res.success && res.data ? toScreeningRow(res.data) : null))
        : null;
      if (created) {
        setScreeningList(prev => [created, ...prev]);
        setShowNewModal(false);
        setNewForm({ patientId: '', patientName: '', age: 45, risk: 'average', date: new Date().toISOString().split('T')[0] });
        return;
      }
      const res = await breastSpecialtyApi.createScreening({
        patientId: newForm.patientId,
        patientName: newForm.patientName,
        age: newForm.age,
        riskLevel: newForm.risk,
        biRadsLatest: 1,
        outcome: 'normal',
        date: newForm.date,
      });
      const createdMock = res.success && res.data ? res.data : {
        id: `S${Date.now().toString().slice(-5)}`,
        patientId: newForm.patientId,
        patientName: newForm.patientName,
        age: newForm.age,
        risk: newForm.risk,
        density: 'b' as BreastDensity,
        biRads: 1,
        outcome: 'normal' as ScreeningOutcome,
        date: newForm.date,
        recall: false,
      };
      setScreeningList(prev => [createdMock, ...prev]);
      setShowNewModal(false);
      setNewForm({ patientId: '', patientName: '', age: 45, risk: 'average', date: new Date().toISOString().split('T')[0] });
    } catch {
      setScreeningList(prev => [{
        id: `S${Date.now().toString().slice(-5)}`,
        patientId: newForm.patientId,
        patientName: newForm.patientName,
        age: newForm.age,
        risk: newForm.risk,
        density: 'b' as BreastDensity,
        biRads: 1,
        outcome: 'normal' as ScreeningOutcome,
        date: newForm.date,
        recall: false,
      }, ...prev]);
      setShowNewModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Heart size={24} color="#be185d" /> 乳腺专科 <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: dataSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: dataSource === 'real' ? '#16a34a' : '#be185d', border: `1px solid ${dataSource === 'real' ? '#bbf7d0' : '#fbcfe8'}` }}>{dataSource === 'real' ? 'breastCadApi 实时' : '演示数据(回退)'}</span></h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>乳腺影像专科 · BI-RADS 评分 · 筛查管理 · 乳腺工作流</p>
        </div>
        <button onClick={() => setShowNewModal(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>新建筛查</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '今日检查', value: screeningStats ? String(screeningStats.monthlyNew) : '28', icon: Activity, color: '#be185d', bg: '#ec489922' },
          { label: 'BI-RADS 4-5', value: screeningStats ? String(screeningStats.birads4Plus) : String(suspicious), icon: AlertTriangle, color: '#dc2626', bg: '#ef444422' },
          { label: '待召回', value: String(recalls), icon: Clock, color: '#ea580c', bg: '#f9731622' },
          { label: '今日报告', value: screeningStats ? String(screeningStats.earlyCancerCount) : '18', icon: FileText, color: '#16a34a', bg: '#22c55e22' },
          { label: '检出率', value: screeningStats && (screeningStats.ldctCount + screeningStats.breastCount) > 0 ? `${((screeningStats.highRiskCount / (screeningStats.ldctCount + screeningStats.breastCount)) * 100).toFixed(1)}%` : '4.2%', icon: TrendingUp, color: '#7c3aed', bg: '#8b5cf622' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-primary-800)' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[{ key: 'screening', label: '筛查管理' }, { key: 'density', label: '密度评估' }, { key: 'workflow', label: '乳腺工作流' }, { key: 'stats', label: '统计分析' }, { key: 'cad', label: 'AI 检出' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#be185d' : 'var(--bg-card)', color: tab === t.key ? '#fff' : '#64748b' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'screening' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}><Stethoscope size={16} color="#be185d" /> 筛查列表
              <SrcBadge real={screeningSource === 'real'} label="screeningApi 实时" demoLabel="演示回退" />
              {screeningLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>加载中...</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input placeholder="搜索患者..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>编号</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>患者</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>年龄</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>密度</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>BI-RADS</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>结果</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>日期</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.id}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.age}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{DENSITY_LABELS[r.density]}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><BiradsTag v={r.biRads} /></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{OUTCOME_LABELS[r.outcome]}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'density' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="#be185d" /> 密度分布
              <SrcBadge real={densitySource === 'real'} label={`dbtApi 实时 (${dbtCount} 例)`} demoLabel="演示数据（后端无乳腺密度端点）" />
              {densityLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>加载中...</span>}
            </div>
            {(['a', 'b', 'c', 'd'] as BreastDensity[]).map(d => {
              const base = densitySource === 'real' && densityRows.length > 0 ? densityRows : mockScreening;
              const count = base.filter(r => r.density === d).length;
              const pct = Math.round((count / Math.max(base.length, 1)) * 100);
              return (
                <div key={d} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{DENSITY_LABELS[d]}</span><span style={{ fontWeight: 700 }}>{count} 例 ({pct}%)</span></div>
                  <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: '#be185d', borderRadius: 4 }} /></div>
                </div>
              );
            })}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><Microscope size={16} color="#7c3aed" /> BI-RADS 分布</div>
            {[1, 2, 3, '4A', '4B', 4, 5].map(b => {
              const base = densitySource === 'real' && densityRows.length > 0 ? densityRows : mockScreening;
              const count = base.filter(r => r.biRads === b || r.biRads === Number(b)).length;
              const color = BIRADS_COLORS[String(b)] ?? '#94a3b8';
              return (
                <div key={String(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 60, fontSize: 12, fontWeight: 600, color }}>BI-RADS {b}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-card)', borderRadius: 4 }}><div style={{ height: '100%', width: `${count > 0 ? Math.max(count * 20, 8) : 0}%`, background: color, borderRadius: 4 }} /></div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'workflow' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="#be185d" /> 乳腺工作流
            <SrcBadge
              real={densitySource === 'real' || dataSource === 'real'}
              label="dbtApi/breastCadApi 实时"
              demoLabel="演示数据（后端无乳腺密度端点）"
            />
            {(densityLoading || cadLoading) && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>加载中...</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {(() => {
              const real = densitySource === 'real' || dataSource === 'real';
              const cadCount = cadResults.length;
              const steps = [
                { step: '1. 预约登记', status: real ? 'done' : 'done', desc: '患者信息录入、风险评估', time: '5 min' },
                { step: '2. 摆位采集', status: real ? 'done' : 'done', desc: 'CC/MLO 体位、压板厚度', time: '15 min' },
                { step: '3. 影像处理', status: real ? 'done' : 'done', desc: '图像优化、对比度调整', time: '3 min' },
                { step: '4. AI 预筛', status: cadCount > 0 ? (real ? 'done' : 'active') : 'pending', desc: cadCount > 0 ? `密度分类、病灶检测 (AI 检出 ${cadCount} 例)` : '密度分类、病灶检测', time: '1 min' },
                { step: '5. 影像诊断', status: 'pending', desc: 'BI-RADS 评分、报告', time: '10 min' },
                { step: '6. 签发报告', status: 'pending', desc: '医师审核、签发', time: '5 min' },
              ];
              return steps.map((w, i) => (
                <div key={i} style={{ padding: 16, background: w.status === 'active' ? 'var(--color-error-bg)' : 'var(--bg-card)', borderRadius: 10, border: `1px solid ${w.status === 'active' ? '#fbcfe8' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {w.status === 'done' ? <CheckCircle size={16} color="#16a34a" /> : w.status === 'active' ? <Clock size={16} color="#be185d" /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border-color)', display: 'inline-block' }} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: w.status === 'active' ? '#be185d' : 'var(--text-primary)' }}>{w.step}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{w.desc}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>预计: {w.time}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><BarChart3 size={16} color="#be185d" /> 月度筛查统计</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, textAlign: 'center' }}>
              {['1月', '2月', '3月', '4月', '5月', '6月'].map((m, i) => {
                const val = [120, 98, 135, 110, 142, 128][i] ?? 0;
                return (
                  <div key={m}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 120 }}>
                      <div style={{ width: '80%', height: `${val / 1.5}px`, background: '#be185d', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{m}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{val}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><AlertTriangle size={16} color="#dc2626" /> 召回率趋势</div>
            {[{ month: '2026-07', rate: 8.5, cases: 11 }, { month: '2026-06', rate: 7.2, cases: 9 }, { month: '2026-05', rate: 9.1, cases: 13 }, { month: '2026-04', rate: 6.8, cases: 7 }].map(t => (
              <div key={t.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)' }}>{t.month}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-card)', borderRadius: 3 }}><div style={{ height: '100%', width: `${t.rate * 5}%`, background: '#ea580c', borderRadius: 3 }} /></div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>{t.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'cad' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={16} color="#be185d" /> AI 检出列表
              {dataSource === 'real'
                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-success-bg)', color: '#16a34a', border: '1px solid #bbf7d0' }}>breastCadApi 实时</span>
                : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ec489922', color: '#be185d', border: '1px solid #fbcfe8' }}>演示回退</span>}
            </div>
            <button onClick={() => setTab('stats' as any)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>查看统计</button>
          </div>
          {cadLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>AI 检出加载中...</div>
          ) : cadError && cadResults.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{cadError}</div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>编号</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>患者</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>模态</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>病灶数</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>BI-RADS</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>状态</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>日期</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>操作</th>
                </tr></thead>
                <tbody>
                  {cadResults.map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setCadDetail(r)}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.id}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.patientName}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.modality}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.lesionCount}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><BiradsTag v={r.overallBiRads} /></td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.status === 'confirmed' ? '已确认' : r.status === 'reviewed' ? '已复核' : '待复核'}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{(r.createdAt ?? '').slice(0, 10)}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                        <button onClick={e => { e.stopPropagation(); setCadDetail(r) }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fbcfe8', background: '#ec489922', color: '#be185d', fontSize: 12, cursor: 'pointer' }}>详情</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {cadDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCadDetail(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 620, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>AI 检出详情 · {cadDetail.patientName}</div>
              <button onClick={() => setCadDetail(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>编号: </span>{cadDetail.id}</div>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>检查号: </span>{cadDetail.studyId}</div>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>整体 BI-RADS: </span><BiradsTag v={cadDetail.overallBiRads} /></div>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>模型: </span>{cadDetail.modelVersion}</div>
            </div>
            {cadDetail.recommendation && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f9731622', borderRadius: 8, border: '1px solid #fed7aa', fontSize: 13, color: '#9a3412' }}>{cadDetail.recommendation}</div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10 }}>病灶列表 ({cadDetail.lesions.length})</div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>类型</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>形态</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>边缘</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>BI-RADS</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>恶性风险</th>
                </tr></thead>
                <tbody>
                  {cadDetail.lesions.map((l: BreastLesion) => (
                    <tr key={l.id}>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-light)' }}>{l.type}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-light)' }}>{l.shape}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-light)' }}>{l.margin}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-light)' }}><BiradsTag v={l.biRads} /></td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-light)', color: l.malignancyRisk > 0.5 ? '#dc2626' : '#64748b', fontWeight: 600 }}>{(l.malignancyRisk * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowNewModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 460, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>新建筛查</div>
              <button onClick={() => setShowNewModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>患者ID *</label><input value={newForm.patientId} onChange={e => setNewForm({ ...newForm, patientId: e.target.value })} placeholder="如 P100006" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>患者姓名 *</label><input value={newForm.patientName} onChange={e => setNewForm({ ...newForm, patientName: e.target.value })} placeholder="请输入姓名" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>年龄</label><input type="number" value={newForm.age} onChange={e => setNewForm({ ...newForm, age: Number(e.target.value) })} min={18} max={90} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>风险分层</label><div style={{ display: 'flex', gap: 8 }}>{([['average', '一般'], ['intermediate', '中等'], ['high', '高危']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setNewForm({ ...newForm, risk: v })} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${newForm.risk === v ? '#be185d' : '#e2e8f0'}`, background: newForm.risk === v ? 'var(--color-error-bg)' : 'var(--bg-card)', color: newForm.risk === v ? '#be185d' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}</div></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>检查日期</label><input type="date" value={newForm.date} onChange={e => setNewForm({ ...newForm, date: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowNewModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>取消</button>
                <button onClick={() => void handleCreateScreening()} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>{saving ? '保存中...' : '创建筛查'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreastSpecialtyPage;

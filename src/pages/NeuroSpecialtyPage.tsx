// Neuro Specialty Page — 神经影像分析 · 脑卒中 · 脑肿瘤 · 癫痫
// [v3.0.6.11-99] Wave1A 17: 接真实后端 /neuro/* (Exam 派生 + seed 回退, MSW 仅 dev 兜底)
import { useState, useMemo, useEffect } from 'react';
import { Brain, Activity, AlertTriangle, Search, ChevronRight, TrendingUp, Zap, BarChart3, FileText, Eye, Loader2, Download, X, Database } from 'lucide-react';
import { neuroSpecialtyApi, type NeuroStudy, type NeuroStats } from '../services/api/neuroSpecialtyApi';
import { DataTable } from '../components/common';
import { Card, Tag, Typography } from 'antd';
import { t } from '../i18n/appI18n';

// ─── Constants ───
const STROKE_COLORS: Record<string, string> = {
  ischemic: 'var(--color-primary-800)', hemorrhagic: 'var(--color-error-600)', tia: '#ca8a04', subarachnoid: '#7c3aed',
};

const TUMOR_COLORS: Record<string, string> = {
  glioma: '#7c3aed', meningioma: 'var(--color-info-600)', metastasis: 'var(--color-error-600)', schwannoma: 'var(--color-success-600)',
  pituitary: '#ea580c', craniopharyngioma: '#ca8a04', other: '#94a3b8',
};

const TUMOR_LABELS: Record<string, string> = {
  glioma: '胶质瘤', meningioma: '脑膜瘤', metastasis: '转移瘤', schwannoma: '听神经瘤',
  pituitary: '垂体瘤', craniopharyngioma: '颅咽管瘤', other: '其他',
};

const TUMOR_GRADE_COLORS = ['var(--color-success-600)', '#ca8a04', '#ea580c', 'var(--color-error-600)'];

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  subtitle: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 },
  statCard: { background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: 700, color: 'var(--color-primary-800)', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  section: { background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--color-error-600)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  scrollBox: { maxHeight: 320, overflowY: 'auto' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
};

const badge = (bg: string, text: string): React.CSSProperties => ({
  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color: text, display: 'inline-block',
});

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8 }}>
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
  </div>
);

const NeuroSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, _setTypeFilter] = useState('');
  const [tab, setTab] = useState<'stroke' | 'tumor' | 'epilepsy' | 'stats'>('stroke');

  // [W2-B] 真实化: /neuro/* API (后端真实, MSW 仅 dev 兜底) + loading/error/回退标注
  const [studies, setStudies] = useState<NeuroStudy[]>([]);
  const [stats, setStats] = useState<NeuroStats | null>(null);
  const [tumorGrades, setTumorGrades] = useState<{ grade: string; count: number }[]>([]);
  const [tumorTypes, setTumorTypes] = useState<{ label: string; count: number; pct: number }[]>([]);
  const [strokeWindows, setStrokeWindows] = useState<{ window: string; count: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // [v3.0.6.11-100 Wave 5B] 数据源徽标: real=真实接口 / fallback=演示回退
  const [usingFallback, setUsingFallback] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detailStudy, setDetailStudy] = useState<NeuroStudy | null>(null);

  const handleExportCSV = () => {
    const header = '编号,患者,类型,血管,ASPECTS,核心梗死(ml),缺血半暗带(ml),LVO,检查日期,模态';
    const rows = filtered.map(r => [
      r.id, r.patientName, r.type, r.vessel ?? '', r.aspectScore ?? '', r.coreMl ?? '', r.penumbraMl ?? '',
      r.lvo ? '阳性' : '阴性', r.acquiredAt ?? '', r.modality ?? '',
    ].join(','));
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `神经专科病例-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const load = (q?: string) => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setUsingFallback(false);
      try {
        const [studiesRes, statsRes, gradesRes, windowsRes] = await Promise.all([
          neuroSpecialtyApi.listStudies(q ? { search: q } : undefined),
          neuroSpecialtyApi.getStats(),
          neuroSpecialtyApi.getTumorGrades(),
          neuroSpecialtyApi.getStrokeWindows(),
        ]);
        if (cancelled) return;
        if (studiesRes.success && Array.isArray(studiesRes.data)) setStudies(studiesRes.data);
        else { setError(t('neuro.errLoadStudies')); setUsingFallback(true); }
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
        if (gradesRes.success && gradesRes.data) {
          setTumorGrades(gradesRes.data.grades ?? []);
          setTumorTypes(gradesRes.data.types ?? []);
        }
        if (windowsRes.success && Array.isArray(windowsRes.data)) setStrokeWindows(windowsRes.data);
      } catch {
        if (!cancelled) { setError(t('neuro.errLoadData')); setUsingFallback(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  };

  useEffect(() => { return load(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(search || undefined); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    let list = [...studies];
    if (search) list = list.filter(r => r.patientName.includes(search) || r.id.includes(search));
    if (typeFilter) list = list.filter(r => r.type === typeFilter);
    return list;
  }, [studies, search, typeFilter]);

  const strokeCount = stats?.strokeCount ?? studies.filter(r => r.type === 'stroke').length;
  const tumorCount = stats?.tumorCount ?? studies.filter(r => r.type === 'tumor').length;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const target = studies.find(r => r.type === 'stroke')?.id;
      const res = await neuroSpecialtyApi.analyze(target);
      if (!res.success) setError(res.error?.message ?? t('neuro.errAnalyze'));
    } catch {
      setError(t('neuro.errAnalyzeRetry'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Brain size={24} color="var(--color-error-600)" /> {t('neuro.title')}</Typography.Title>
          <p style={s.subtitle}>{t('neuro.subtitle')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'var(--color-info-bg)', color: 'var(--color-primary-800)' }}>
              {t('neuro.dataSource')}
            </span>
            {/* [v3.0.6.11-100 Wave 5B] 数据源徽标 (真实接口/演示回退) */}
            {usingFallback
              ? <Tag color="orange" icon={<Database size={12} />}>{t('neuro.fallback')}</Tag>
              : <Tag color="green" icon={<Database size={12} />}>{t('neuro.realApi')}</Tag>}
            {error && <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>{error}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn} onClick={handleExportCSV}><Download size={14} /> {t('neuro.export')}</button>
          <button style={s.btnPrimary} onClick={() => void handleAnalyze()} disabled={analyzing}>
            {analyzing ? <Loader2 size={14} className="v4-spin" /> : <Zap size={14} />} {analyzing ? t('neuro.analyzing') : t('neuro.emergencyAnalyze')}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={s.statsRow}>
        {[
          { label: t('neuro.kpiTodayScans'), value: stats?.todayScans ?? '15', unit: '例', icon: Activity, color: 'var(--color-error-600)', bg: '#ef444422' },
          { label: t('neuro.kpiStrokeDetected'), value: String(strokeCount), unit: '例', icon: Zap, color: 'var(--color-primary-800)', bg: '#3b82f622' },
          { label: t('neuro.kpiTumorCases'), value: String(tumorCount), unit: '例', icon: AlertTriangle, color: '#7c3aed', bg: '#8b5cf622' },
          { label: t('neuro.kpiLvoPositive'), value: String(stats?.lvoPositive ?? 0), unit: '例', icon: Eye, color: '#ea580c', bg: '#f9731622' },
          { label: t('neuro.kpiPendingReports'), value: String(stats?.pendingReports ?? 0), unit: '份', icon: FileText, color: 'var(--color-success-600)', bg: '#22c55e22' },
        ].map((k, i) => (
          <Card key={i} bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
            <div style={{ ...s.statIcon, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={s.statValue}>{k.value}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>{k.unit}</span></div>
            <div style={s.statLabel}>{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'stroke', label: t('neuro.tabStroke') },
          { key: 'tumor', label: t('neuro.tabTumor') },
          { key: 'epilepsy', label: t('neuro.tabEpilepsy') },
          { key: 'stats', label: t('neuro.tabStats') },
        ].map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key as any)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === tabItem.key ? 'var(--color-error-600)' : 'var(--bg-card)', color: tab === tabItem.key ? '#fff' : '#64748b' }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {loading && (
        <Card bordered={false} style={{ ...s.section, textAlign: 'center', padding: 48, color: 'var(--text-secondary)', fontSize: 12 }} styles={{ body: { padding: 0 } }}>
          <Loader2 size={22} className="v4-spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {t('neuro.loading')}
        </Card>
      )}

      {!loading && tab === 'stroke' && (
        <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={s.sectionTitle}><Zap size={16} color="var(--color-error-600)" /> {t('neuro.strokeAssessment')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input placeholder={t('neuro.searchPatient')} value={search} onChange={e => setSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', marginLeft: 8, fontSize: 12, width: 160 }} />
              </div>
            </div>
          </div>
          <div style={s.scrollBox}>
            <DataTable
              rowKey="id"
              dataSource={filtered.filter(r => r.type === 'stroke')}
              showPagination={false}
              showExport={false}
              showDensity={false}
              columns={[
                { title: t('neuro.colId'), dataIndex: 'id', key: 'id' },
                {
                  title: t('neuro.colPatient'), key: 'patient',
                  render: (_: unknown, r: NeuroStudy) => (
                    <span style={{ fontWeight: 600 }}>
                      {r.patientName}<br />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.age}y {r.gender}</span>
                    </span>
                  ),
                },
                {
                  title: t('neuro.colType'), dataIndex: 'subtype', key: 'subtype',
                  render: (v: string | undefined) => (
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: STROKE_COLORS[v ?? 'ischemic'], color: '#fff' }}>
                      {v === 'ischemic' ? t('neuro.subtypeIschemic') : v === 'hemorrhagic' ? t('neuro.subtypeHemorrhagic') : v === 'subarachnoid' ? t('neuro.subtypeSubarachnoid') : 'TIA'}
                    </span>
                  ),
                },
                { title: t('neuro.colVessel'), dataIndex: 'vessel', key: 'vessel' },
                {
                  title: 'ASPECTS', dataIndex: 'aspectScore', key: 'aspectScore',
                  render: (v: number | undefined) => (
                    <span style={{ fontWeight: 700, color: (v ?? 10) < 6 ? 'var(--color-error-600)' : (v ?? 10) < 8 ? '#ea580c' : 'var(--color-success-600)' }}>{v}</span>
                  ),
                },
                { title: t('neuro.colCoreInfarct'), dataIndex: 'coreMl', key: 'coreMl', render: (v: number) => <>{v} ml</> },
                { title: t('neuro.colPenumbra'), dataIndex: 'penumbraMl', key: 'penumbraMl', render: (v: number) => <>{v} ml</> },
                {
                  title: 'LVO', dataIndex: 'lvo', key: 'lvo',
                  render: (v: boolean) => <span style={badge(v ? 'var(--color-error-bg)' : 'var(--color-success-bg)', v ? t('neuro.positive') : t('neuro.negative'))}></span>,
                },
                {
                  title: t('neuro.colAction'), key: 'actions',
                  render: (_: unknown, r: NeuroStudy) => (
                    <button onClick={() => setDetailStudy(r)} style={{ padding: '4px 10px', background: 'var(--color-error-bg)', color: 'var(--color-error-600)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                      {t('neuro.detail')} <ChevronRight size={12} />
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      )}

      {!loading && tab === 'tumor' && (
        <div style={s.grid2}>
          <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
            <div style={s.sectionTitle}><Brain size={16} color="#7c3aed" /> {t('neuro.tumorList')}</div>
            {filtered.filter(r => r.type === 'tumor').map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#8b5cf622', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{r.patientName[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.patientName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.id} · {r.modality}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: TUMOR_COLORS[r.tumorType ?? 'other'], color: '#fff' }}>
                    {TUMOR_LABELS[r.tumorType ?? 'other'] ?? r.tumorType}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>分级 {r.grade} · {r.sizeMm}mm</div>
                </div>
              </div>
            ))}
          </Card>
          <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
            <div style={s.sectionTitle}><BarChart3 size={16} color="#7c3aed" /> {t('neuro.tumorGradeDist')}</div>
            {['I', 'II', 'III', 'IV'].map(g => {
              const count = tumorGrades.find(t => t.grade === g)?.count ?? 0;
              const max = Math.max(1, ...tumorGrades.map(t => t.count));
              return (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 50, fontSize: 12, fontWeight: 600 }}>分级 {g}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-card)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: TUMOR_GRADE_COLORS[['I', 'II', 'III', 'IV'].indexOf(g)], borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('neuro.tumorTypeDist')}</div>
              {tumorTypes.map(tt => (
                <div key={tt.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: TUMOR_COLORS[tt.label] ?? '#94a3b8' }} />
                  <span style={{ fontSize: 12, flex: 1 }}>{TUMOR_LABELS[tt.label] ?? tt.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{tt.count} ({tt.pct}%)</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {!loading && tab === 'epilepsy' && (
        <div style={s.grid2}>
          <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
            <div style={s.sectionTitle}><Eye size={16} color="#ca8a04" /> {t('neuro.epilepsyAssessment')}</div>
            {filtered.filter(r => r.type === 'epilepsy').map(r => (
              <div key={r.id} style={{ padding: 14, background: 'var(--color-warning-bg)', borderRadius: 10, marginBottom: 12, border: '1px solid #fef08a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.patientName} ({r.id})</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#ca8a04', color: '#fff' }}>{r.modality}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.focusLabel')}</span><span style={{ fontWeight: 600 }}>{r.focus === 'mesial-temporal' ? t('neuro.focusMesialTemporal') : t('neuro.focusFrontal')}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.mtsLabel')}</span><span style={{ fontWeight: 600, color: r.mts ? 'var(--color-error-600)' : 'var(--color-success-600)' }}>{r.mts ? t('neuro.positive') : t('neuro.negative')}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.asymmetryLabel')}</span><span style={{ fontWeight: 600 }}>{r.hippocampalAsymmetry}%</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.eegLabel')}</span><span style={{ fontWeight: 600 }}>{t('neuro.eegFinding')}</span></div>
                </div>
              </div>
            ))}
          </Card>
          <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
            <div style={s.sectionTitle}><AlertTriangle size={16} color="var(--color-error-600)" /> {t('neuro.aneurysmAssessment')}</div>
            {filtered.filter(r => r.type === 'aneurysm').map(r => (
              <div key={r.id} style={{ padding: 14, background: 'var(--color-error-bg)', borderRadius: 10, marginBottom: 12, border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.patientName} ({r.id})</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--color-error-600)', color: '#fff' }}>{r.modality}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.locationLabel')}</span><span style={{ fontWeight: 600 }}>{r.location}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.sizeLabel')}</span><span style={{ fontWeight: 600 }}>{r.sizeMm}mm</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.neckLabel')}</span><span style={{ fontWeight: 600 }}>{r.neckMm}mm</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>{t('neuro.riskLabel')}</span><span style={{ fontWeight: 600, color: r.ruptureRisk === 'moderate' ? '#ea580c' : r.ruptureRisk === 'low' ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{r.ruptureRisk === 'moderate' ? t('neuro.riskModerate') : r.ruptureRisk === 'low' ? t('neuro.riskLow') : t('neuro.riskHigh')}</span></div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {!loading && tab === 'stats' && (
        <div style={s.grid2}>
          <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
            <div style={s.sectionTitle}><BarChart3 size={16} color="var(--color-error-600)" /> {t('neuro.diseaseDist')}</div>
            {(stats?.diseaseDistribution ?? []).map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: { 脑卒中: 'var(--color-error-600)', 脑肿瘤: '#7c3aed', 癫痫: '#ca8a04', 动脉瘤: 'var(--color-info-600)' }[d.label] ?? '#94a3b8' }} />
                <span style={{ width: 80, fontSize: 12, fontWeight: 500 }}>{d.label}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-card)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${d.pct}%`, background: { 脑卒中: 'var(--color-error-600)', 脑肿瘤: '#7c3aed', 癫痫: '#ca8a04', 动脉瘤: 'var(--color-info-600)' }[d.label] ?? '#94a3b8', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 50, textAlign: 'right' }}>{d.count} ({d.pct}%)</span>
              </div>
            ))}
          </Card>
          <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
            <div style={s.sectionTitle}><TrendingUp size={16} color="var(--color-success-600)" /> {t('neuro.strokeWindow')}</div>
            {strokeWindows.map(sw => (
              <div key={sw.window} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ width: 120, fontSize: 12, color: 'var(--text-secondary)' }}>{sw.window}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-card)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (sw.count / Math.max(1, strokeWindows[0]?.count ?? 5)) * 100)}%`, background: sw.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 30, textAlign: 'right' }}>{sw.count}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <style>{`.v4-icon { display: inline-block; vertical-align: middle; }
        @keyframes v4spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .v4-spin { animation: v4spin 1s linear infinite; }`}</style>

      {detailStudy && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetailStudy(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 520, maxHeight: '82vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={18} color="var(--color-error-600)" />{t('neuro.caseDetail')}
              </div>
              <button onClick={() => setDetailStudy(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{detailStudy.patientName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{detailStudy.id} · {detailStudy.age}y {detailStudy.gender} · {detailStudy.modality ?? '-'}</div>
                </div>
                <span style={{ alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: detailStudy.type === 'stroke' ? '#fef2f2' : detailStudy.type === 'tumor' ? '#f5f3ff' : '#fefce8', color: detailStudy.type === 'stroke' ? 'var(--color-error-600)' : detailStudy.type === 'tumor' ? '#7c3aed' : '#ca8a04' }}>
                  {{ stroke: t('neuro.tabStroke'), tumor: t('neuro.tabTumor'), epilepsy: t('neuro.typeEpilepsy'), aneurysm: t('neuro.typeAneurysm') }[detailStudy.type] ?? detailStudy.type}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <InfoRow label={t('neuro.infoExamDate')} value={detailStudy.acquiredAt ?? '-'} />
                <InfoRow label={t('neuro.infoTechnician')} value={detailStudy.technician ?? detailStudy.radiologist ?? '-'} />
                <InfoRow label={t('neuro.infoDevice')} value={detailStudy.deviceId ?? detailStudy.modality ?? '-'} />
                <InfoRow label={t('neuro.infoAccession')} value={detailStudy.accessionNumber ?? '-'} />
                {detailStudy.type === 'stroke' && (
                  <>
                    <InfoRow label={t('neuro.colVessel')} value={detailStudy.vessel ?? '-'} />
                    <InfoRow label="ASPECTS" value={String(detailStudy.aspectScore ?? '-')} />
                    <InfoRow label={t('neuro.colCoreInfarct')} value={`${detailStudy.coreMl ?? '-'} ml`} />
                    <InfoRow label={t('neuro.colPenumbra')} value={`${detailStudy.penumbraMl ?? '-'} ml`} />
                  </>
                )}
                {detailStudy.type === 'tumor' && (
                  <>
                    <InfoRow label={t('neuro.infoTumorType')} value={TUMOR_LABELS[detailStudy.tumorType ?? 'other'] ?? '-'} />
                    <InfoRow label={t('neuro.infoGrade')} value={`${detailStudy.grade ?? '-'} 级`} />
                    <InfoRow label={t('neuro.sizeLabel')} value={`${detailStudy.sizeMm ?? '-'} mm`} />
                  </>
                )}
                {detailStudy.type === 'epilepsy' && (
                  <>
                    <InfoRow label={t('neuro.infoFocus')} value={detailStudy.focus === 'mesial-temporal' ? t('neuro.focusMesialTemporal') : t('neuro.focusFrontal')} />
                    <InfoRow label="MTS" value={detailStudy.mts ? t('neuro.positive') : t('neuro.negative')} />
                    <InfoRow label={t('neuro.infoHippocampalAsymmetry')} value={`${detailStudy.hippocampalAsymmetry ?? '-'}%`} />
                  </>
                )}
                {detailStudy.type === 'aneurysm' && (
                  <>
                    <InfoRow label={t('neuro.locationLabel')} value={detailStudy.location ?? '-'} />
                    <InfoRow label={t('neuro.sizeLabel')} value={`${detailStudy.sizeMm ?? '-'} mm`} />
                    <InfoRow label={t('neuro.neckLabel')} value={`${detailStudy.neckMm ?? '-'} mm`} />
                  </>
                )}
              </div>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-card)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                {detailStudy.findings ?? t('neuro.noFindings')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeuroSpecialtyPage;

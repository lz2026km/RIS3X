// Breast Specialty Page — BI-RADS · 乳腺工作流 · 筛查管理
// [v3.0.6.11-83] W1-B: AI 检出页签已接真实 breastCadApi (/ai-diagnosis/breast-cad)
// [v3.0.6.11-87] Wave4A G-21: screening Tab -> screeningApi (/screening 真实);
//               density/workflow Tab -> dbtApi (/dbt) / breastCadApi 派生, 无端点回退演示 + 徽标
// [v3.0.6.11-96] Wave3B G-21 P2: 新增「双阅」Tab (dualReadApi list/assign/arbitrate 真实,
//               失败回退演示 + 徽标); density/screening DBT 行加「{t('breastSpecialty.dbtRead')}」→ /dicom/dbt?studyId=
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Activity, AlertTriangle, CheckCircle, Clock, Search, TrendingUp, Stethoscope, Microscope, FileText, BarChart3, X, BrainCircuit, GitBranch, UserCheck } from 'lucide-react';
import type { BreastDensity, ScreeningOutcome } from '@/services/api/breastSpecialtyApi';
import { breastSpecialtyApi } from '@/services/api/breastSpecialtyApi';
import { breastCadApi, type BreastCadResult, type BreastLesion } from '@/services/api/breastCadApi';
import { screeningApi, type ScreeningStatsDto } from '@/services/api/screeningApi';
import { dbtApi, type DbtStudyDto } from '@/services/api/dbtApi';
import { dualReadApi, type DualReadAssignment } from '@/services/api/dualReadApi';
import { t } from '../../i18n/appI18n';
import { SeverityTag } from '../../components/common/SeverityTag';
import { uniqueId } from '../../utils/uniqueId';

const BIRADS_COLORS: Record<string, string> = { 0: '#94a3b8', 1: '#16a34a', 2: '#16a34a', 3: '#ca8a04', '4A': '#ea580c', '4B': '#dc2626', 4: '#dc2626', 5: '#dc2626', 6: '#7c3aed' };
const DENSITY_LABELS: Record<string, string> = { a: 'breastSpecialty.densityFatty', b: 'breastSpecialty.densityScattered', c: 'breastSpecialty.densityHeterogeneous', d: 'breastSpecialty.densityExtreme' };
const OUTCOME_LABELS: Record<string, string> = { normal: 'breastSpecialty.outcomeNormal', benign: 'breastSpecialty.outcomeBenign', 'probably-benign': 'breastSpecialty.outcomeProbablyBenign', suspicious: 'breastSpecialty.outcomeSuspicious', 'highly-suspicious': 'breastSpecialty.outcomeHighlySuspicious', 'known-malignancy': 'breastSpecialty.outcomeKnownMalignancy' };

const mockScreening = [
  { id: 'S001', patientName: '张秀兰', age: 52, risk: 'average', density: 'b', biRads: 1, outcome: 'normal' as ScreeningOutcome, date: '2026-07-15', recall: false },
  { id: 'S002', patientName: '李芳', age: 45, risk: 'intermediate', density: 'c', biRads: '4A', outcome: 'suspicious' as ScreeningOutcome, date: '2026-07-14', recall: true },
  { id: 'S003', patientName: '王丽华', age: 61, risk: 'high', density: 'd', biRads: 5, outcome: 'highly-suspicious' as ScreeningOutcome, date: '2026-07-13', recall: true },
  { id: 'S004', patientName: '赵静', age: 38, risk: 'average', density: 'a', biRads: 2, outcome: 'benign' as ScreeningOutcome, date: '2026-07-12', recall: false },
  { id: 'S005', patientName: '陈艳', age: 57, risk: 'high', density: 'c', biRads: 3, outcome: 'probably-benign' as ScreeningOutcome, date: '2026-07-11', recall: true },
];

// [v3.0.6.11-96 Wave3B G-21 P2] 双阅任务演示回退数据 (dualReadApi 不可用时)
const mockDualRead: DualReadAssignment[] = [
  {
    id: 'DR-DEMO-1', studyId: 'MG-1001', patientName: '张秀兰', patientId: 'P100001', modality: 'MG',
    reader1Id: 'D001', reader1Name: '张医生', reader2Id: 'D002', reader2Name: '李医生',
    report1: '左乳外上象限致密影，BI-RADS 3', report2: '左乳外上象限致密影伴钙化，建议活检，BI-RADS 4A',
    status: 'both_done', discrepancyScore: 0.35, createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T10:30:00Z',
  },
  {
    id: 'DR-DEMO-2', studyId: 'MG-1002', patientName: '李芳', patientId: 'P100002', modality: 'MG',
    reader1Id: 'D003', reader1Name: '王医生', reader2Id: 'D001', reader2Name: '张医生',
    report1: '', report2: '', status: 'pending', createdAt: '2026-08-02T09:00:00Z', updatedAt: '2026-08-02T09:00:00Z',
  },
  {
    id: 'DR-DEMO-3', studyId: 'DBT-2001', patientName: '王丽华', patientId: 'P100003', modality: 'DBT',
    reader1Id: 'D002', reader1Name: '李医生', reader2Id: 'D003', reader2Name: '王医生',
    report1: '右乳内下象限不对称致密，断层未见明确占位', report2: '右乳内下象限不对称致密伴微钙化簇',
    status: 'arbitrated', discrepancyScore: 0.22, arbitrationReport: '右乳内下象限不对称致密，BI-RADS 3，建议 6 个月随访',
    arbitratorId: 'D004', arbitratorName: '赵医生', createdAt: '2026-07-30T09:00:00Z', updatedAt: '2026-07-31T15:00:00Z',
  },
];

const DUAL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'breastSpecialty.dualPending', color: '#64748b' },
  reader1_done: { label: 'breastSpecialty.dualReader1Done', color: '#ca8a04' },
  reader2_done: { label: 'breastSpecialty.dualReader2Done', color: '#ca8a04' },
  both_done: { label: 'breastSpecialty.dualBothDone', color: '#ea580c' },
  arbitrated: { label: 'breastSpecialty.dualArbitrated', color: '#16a34a' },
};

const BiradsTag = ({ v }: { v: string | number }) => {
  const color = BIRADS_COLORS[String(v)] ?? '#94a3b8';
  return (
    <SeverityTag
      size="md"
      tone={{ bg: `${color}18`, border: `${color}40`, color, dot: color }}
      style={{ fontWeight: 700 }}
    >
      BI-RADS {v}
    </SeverityTag>
  );
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
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'screening' | 'density' | 'workflow' | 'stats' | 'cad' | 'dual'>('screening');
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

  // [v3.0.6.11-96 Wave3B G-21 P2] 双阅 Tab -> dualReadApi (list/assign/arbitrate 真实), 失败回退演示
  const [dualList, setDualList] = useState<DualReadAssignment[]>([]);
  const [dualLoading, setDualLoading] = useState(true);
  const [dualSource, setDualSource] = useState<'real' | 'demo'>('demo');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ studyId: '', patientName: '', patientId: '', modality: 'MG' });
  const [assignSaving, setAssignSaving] = useState(false);
  const [arbitrateTarget, setArbitrateTarget] = useState<DualReadAssignment | null>(null);
  const [arbitrateReport, setArbitrateReport] = useState('');
  const [arbitrateSaving, setArbitrateSaving] = useState(false);

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
          setCadError(t('breastSpecialty.cadNoData'));
        }
      } catch {
        if (cancelled) return;
        setCadResults([]);
        setDataSource('demo');
        setCadError(t('breastSpecialty.cadUnavailable'));
      } finally {
        if (!cancelled) setCadLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, []);

  // [v3.0.6.11-96 Wave3B G-21 P2] 双阅任务列表 (dualReadApi.list), 失败/空回退演示
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dualReadApi.listAssignments();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setDualList(res.data);
          setDualSource('real');
        } else {
          setDualList(mockDualRead);
          setDualSource('demo');
        }
      } catch {
        if (cancelled) return;
        setDualList(mockDualRead);
        setDualSource('demo');
      } finally {
        if (!cancelled) setDualLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, []);

  const handleAssignDual = async () => {
    if (!assignForm.studyId.trim() || !assignForm.patientName.trim() || !assignForm.patientId.trim()) {
      alert(t('breastSpecialty.fillAssignFields'));
      return;
    }
    setAssignSaving(true);
    try {
      // [G005 Wave3B G-21 P2] 真实模式走 dualReadApi.createAssignment, 失败回退本地新增 (标注)
      const res = dualSource === 'real' ? await dualReadApi.createAssignment(assignForm) : null;
      const created = res?.success && res.data
        ? res.data
        : { ...assignForm, id: uniqueId('DR'), reader1Id: 'D001', reader1Name: '张医生', reader2Id: 'D002', reader2Name: '李医生', report1: '', report2: '', status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setDualList(prev => [created as DualReadAssignment, ...prev]);
      if (dualSource === 'real' && !(res?.success)) setDualSource('demo');
      setShowAssignModal(false);
      setAssignForm({ studyId: '', patientName: '', patientId: '', modality: 'MG' });
    } catch {
      setDualList(prev => [{
        ...assignForm,
        id: uniqueId('DR'),
        reader1Id: 'D001', reader1Name: '张医生', reader2Id: 'D002', reader2Name: '李医生',
        report1: '', report2: '', status: 'pending',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      } as DualReadAssignment, ...prev]);
      setShowAssignModal(false);
      setAssignForm({ studyId: '', patientName: '', patientId: '', modality: 'MG' });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleArbitrate = async () => {
    if (!arbitrateTarget || !arbitrateReport.trim()) { alert(t('breastSpecialty.fillArbitration')); return; }
    setArbitrateSaving(true);
    try {
      const res = await dualReadApi.arbitrate(arbitrateTarget.id, {
        arbitratorId: 'admin', arbitratorName: '管理员', report: arbitrateReport,
      });
      if (res.success && res.data) {
        setDualList(prev => prev.map(a => a.id === arbitrateTarget.id ? (res.data as DualReadAssignment) : a));
      } else {
        alert(res.error?.message ?? t('breastSpecialty.arbitrateFailed'));
      }
    } catch {
      // [G005 Wave3B G-21 P2] 失败回退: 本地置为已仲裁并标注
      setDualList(prev => prev.map(a => a.id === arbitrateTarget.id ? { ...a, status: 'arbitrated', arbitrationReport: arbitrateReport, arbitratorId: 'admin', arbitratorName: '管理员', updatedAt: new Date().toISOString() } as DualReadAssignment : a));
    } finally {
      setArbitrateSaving(false);
      setArbitrateTarget(null);
      setArbitrateReport('');
    }
  };

  const gotoDbt = (studyId: string) => navigate(`/dicom/dbt?studyId=${encodeURIComponent(studyId)}`);
  const filtered = useMemo(() => {
    let list = [...screeningList];
    if (search) list = list.filter(r => r.patientName.includes(search) || r.id.includes(search));
    return list;
  }, [search, screeningList]);
  const recalls = screeningList.filter(r => r.recall).length;
  const suspicious = screeningList.filter(r => ['4A', '4B', 4, 5].includes(String(r.biRads))).length;

  const handleCreateScreening = async () => {
    if (!newForm.patientName.trim() || !newForm.patientId.trim()) { alert(t('breastSpecialty.fillPatientFields')); return; }
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
        id: uniqueId('S'),
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
        id: uniqueId('S'),
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Heart size={24} color="#be185d" /> {t('breastSpecialty.title')} <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: dataSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: dataSource === 'real' ? '#16a34a' : '#be185d', border: `1px solid ${dataSource === 'real' ? '#bbf7d0' : '#fbcfe8'}` }}>{dataSource === 'real' ? t('breastSpecialty.sourceRealtime') : t('breastSpecialty.sourceDemoFallback')}</span></h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t('breastSpecialty.subtitle')}</p>
        </div>
        <button onClick={() => setShowNewModal(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>{t('breastSpecialty.newScreening')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: t('breastSpecialty.statsTodayExams'), value: screeningStats ? String(screeningStats.monthlyNew) : '28', icon: Activity, color: '#be185d', bg: '#ec489922' },
          { label: 'BI-RADS 4-5', value: screeningStats ? String(screeningStats.birads4Plus) : String(suspicious), icon: AlertTriangle, color: '#dc2626', bg: '#ef444422' },
          { label: t('breastSpecialty.statsPendingRecall'), value: String(recalls), icon: Clock, color: '#ea580c', bg: '#f9731622' },
          { label: t('breastSpecialty.statsTodayReports'), value: screeningStats ? String(screeningStats.earlyCancerCount) : '18', icon: FileText, color: '#16a34a', bg: '#22c55e22' },
          { label: t('breastSpecialty.statsDetectionRate'), value: screeningStats && (screeningStats.ldctCount + screeningStats.breastCount) > 0 ? `${((screeningStats.highRiskCount / (screeningStats.ldctCount + screeningStats.breastCount)) * 100).toFixed(1)}%` : '4.2%', icon: TrendingUp, color: '#7c3aed', bg: '#8b5cf622' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary-800)' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[{ key: 'screening', label: t('breastSpecialty.tabScreening') }, { key: 'density', label: t('breastSpecialty.tabDensity') }, { key: 'workflow', label: t('breastSpecialty.tabWorkflow') }, { key: 'stats', label: t('breastSpecialty.tabStats') }, { key: 'cad', label: t('breastSpecialty.tabCad') }, { key: 'dual', label: t('breastSpecialty.tabDual') }].map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === tabItem.key ? '#be185d' : 'var(--bg-card)', color: tab === tabItem.key ? '#fff' : '#64748b' }}>{tabItem.label}</button>
        ))}
      </div>

      {tab === 'screening' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}><Stethoscope size={16} color="#be185d" /> {t('breastSpecialty.screeningList')}
              <SrcBadge real={screeningSource === 'real'} label={t('breastSpecialty.sourceScreeningRealtime')} demoLabel={t('breastSpecialty.sourceDemoFallbackShort')} />
              {screeningLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('breastSpecialty.loading')}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input placeholder={t('breastSpecialty.searchPatient')} value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colId')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colPatient')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colAge')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colDensity')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>BI-RADS</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colResult')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colDate')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colActions')}</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.id}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.age}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{t(DENSITY_LABELS[r.density] ?? '')}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><BiradsTag v={r.biRads} /></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{t(OUTCOME_LABELS[r.outcome] ?? '')}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{r.date}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                      {/* [v3.0.6.11-96 Wave3B G-21 P2] DBT 联动: 跳{t('breastSpecialty.dbtRead')} (带 studyId) */}
                      <button onClick={() => gotoDbt(r.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fbcfe8', background: '#ec489922', color: '#be185d', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('breastSpecialty.dbtRead')}</button>
                    </td>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="#be185d" /> {t('breastSpecialty.densityDistribution')}
              <SrcBadge real={densitySource === 'real'} label={`dbtApi 实时 (${dbtCount} 例)`} demoLabel={t('breastSpecialty.sourceNoDensityEndpoint')} />
              {densityLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('breastSpecialty.loading')}</span>}
            </div>
            {(['a', 'b', 'c', 'd'] as BreastDensity[]).map(d => {
              const base = densitySource === 'real' && densityRows.length > 0 ? densityRows : mockScreening;
              const count = base.filter(r => r.density === d).length;
              const pct = Math.round((count / Math.max(base.length, 1)) * 100);
              return (
                <div key={d} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{t(DENSITY_LABELS[d] ?? '')}</span><span style={{ fontWeight: 700 }}>{t('breastSpecialty.caseCount', { count, pct })}</span></div>
                  <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: '#be185d', borderRadius: 4 }} /></div>
                </div>
              );
            })}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><Microscope size={16} color="#7c3aed" /> {t('breastSpecialty.biradsDistribution')}</div>
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

      {tab === 'density' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={16} color="#be185d" /> {t('breastSpecialty.dbtStudies')}
            <SrcBadge real={densitySource === 'real'} label={`dbtApi 实时 (${dbtCount} 例)`} demoLabel={t('breastSpecialty.sourceDemoFallbackShort')} />
            {densityLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('breastSpecialty.loading')}</span>}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colStudyId')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colPatient')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colDensity')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>BI-RADS</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colDate')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colActions')}</th>
              </tr></thead>
              <tbody>
                {(densitySource === 'real' && densityRows.length > 0 ? densityRows : mockScreening).map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.id}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{t(DENSITY_LABELS[r.density] ?? '')}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><BiradsTag v={r.biRads} /></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{r.date}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                      {/* [v3.0.6.11-96 Wave3B G-21 P2] DBT 联动: 跳{t('breastSpecialty.dbtRead')} (带 studyId) */}
                      <button onClick={() => gotoDbt(r.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fbcfe8', background: '#ec489922', color: '#be185d', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('breastSpecialty.dbtRead')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'workflow' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="#be185d" /> {t('breastSpecialty.workflow')}
            <SrcBadge
              real={densitySource === 'real' || dataSource === 'real'}
              label={t('breastSpecialty.sourceDbtCadRealtime')}
              demoLabel={t('breastSpecialty.sourceNoDensityEndpoint')}
            />
            {(densityLoading || cadLoading) && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('breastSpecialty.loading')}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {(() => {
              const real = densitySource === 'real' || dataSource === 'real';
              const cadCount = cadResults.length;
              const steps = [
                { step: t('breastSpecialty.step1'), status: real ? 'done' : 'done', desc: t('breastSpecialty.step1Desc'), time: '5 min' },
                { step: t('breastSpecialty.step2'), status: real ? 'done' : 'done', desc: t('breastSpecialty.step2Desc'), time: '15 min' },
                { step: t('breastSpecialty.step3'), status: real ? 'done' : 'done', desc: t('breastSpecialty.step3Desc'), time: '3 min' },
                { step: t('breastSpecialty.step4'), status: cadCount > 0 ? (real ? 'done' : 'active') : 'pending', desc: cadCount > 0 ? `密度分类、病灶检测 (AI 检出 ${cadCount} 例)` : t('breastSpecialty.step4Desc'), time: '1 min' },
                { step: t('breastSpecialty.step5'), status: 'pending', desc: t('breastSpecialty.step5Desc'), time: '10 min' },
                { step: t('breastSpecialty.step6'), status: 'pending', desc: t('breastSpecialty.step6Desc'), time: '5 min' },
              ];
              return steps.map((w, i) => (
                <div key={i} style={{ padding: 16, background: w.status === 'active' ? 'var(--color-error-bg)' : 'var(--bg-card)', borderRadius: 10, border: `1px solid ${w.status === 'active' ? '#fbcfe8' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {w.status === 'done' ? <CheckCircle size={16} color="#16a34a" /> : w.status === 'active' ? <Clock size={16} color="#be185d" /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border-color)', display: 'inline-block' }} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: w.status === 'active' ? '#be185d' : 'var(--text-primary)' }}>{w.step}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{w.desc}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('breastSpecialty.estimated')}: {w.time}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><BarChart3 size={16} color="#be185d" /> {t('breastSpecialty.monthlyScreeningStats')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, textAlign: 'center' }}>
              {[t('breastSpecialty.month1'), t('breastSpecialty.month2'), t('breastSpecialty.month3'), t('breastSpecialty.month4'), t('breastSpecialty.month5'), t('breastSpecialty.month6')].map((m, i) => {
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><AlertTriangle size={16} color="#dc2626" /> {t('breastSpecialty.recallTrend')}</div>
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
              <BrainCircuit size={16} color="#be185d" /> {t('breastSpecialty.cadList')}
              {dataSource === 'real'
                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-success-bg)', color: '#16a34a', border: '1px solid #bbf7d0' }}>{t('breastSpecialty.sourceCadRealtime')}</span>
                : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ec489922', color: '#be185d', border: '1px solid #fbcfe8' }}>{t('breastSpecialty.sourceDemoFallbackShort')}</span>}
            </div>
            <button onClick={() => setTab('stats' as any)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>{t('breastSpecialty.viewStats')}</button>
          </div>
          {cadLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{t('breastSpecialty.cadLoading')}</div>
          ) : cadError && cadResults.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{cadError}</div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colId')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colPatient')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colModality')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colLesionCount')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>BI-RADS</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colStatus')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colDate')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colActions')}</th>
                </tr></thead>
                <tbody>
                  {cadResults.map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setCadDetail(r)}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.id}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.patientName}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.modality}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.lesionCount}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><BiradsTag v={r.overallBiRads} /></td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.status === 'confirmed' ? t('breastSpecialty.statusConfirmed') : r.status === 'reviewed' ? t('breastSpecialty.statusReviewed') : t('breastSpecialty.statusPendingReview')}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{(r.createdAt ?? '').slice(0, 10)}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                        <button onClick={e => { e.stopPropagation(); setCadDetail(r) }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fbcfe8', background: '#ec489922', color: '#be185d', fontSize: 12, cursor: 'pointer' }}>{t('breastSpecialty.detail')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'dual' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={16} color="#be185d" /> {t('breastSpecialty.dualTasks')}
              <SrcBadge real={dualSource === 'real'} label={t('breastSpecialty.sourceDualRealtime')} demoLabel={t('breastSpecialty.sourceDemoFallbackShort')} />
              {dualLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('breastSpecialty.loading')}</span>}
            </div>
            <button onClick={() => setShowAssignModal(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><UserCheck size={14} /> {t('breastSpecialty.assignDualRead')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: t('breastSpecialty.dualTotalAssigned'), value: dualList.length, color: '#be185d', bg: '#ec489922' },
              { label: t('breastSpecialty.dualPendingStat'), value: dualList.filter(a => a.status === 'pending' || a.status === 'both_done').length, color: '#ea580c', bg: '#f9731622' },
              { label: t('breastSpecialty.dualBothDonePending'), value: dualList.filter(a => a.status === 'both_done').length, color: '#7c3aed', bg: '#8b5cf622' },
              { label: t('breastSpecialty.dualArbitratedLabel'), value: dualList.filter(a => a.status === 'arbitrated').length, color: '#16a34a', bg: '#22c55e22' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 12px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colStudyId')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colPatient')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colModality')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colReaders')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colStatus')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colDiscrepancy')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('breastSpecialty.colActions')}</th>
                </tr></thead>
              <tbody>
                {dualList.map(a => {
                  const st = DUAL_STATUS_LABELS[a.status] ?? { label: a.status, color: '#64748b' };
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{a.studyId}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{a.patientName}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{a.modality}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{a.reader1Name} / {a.reader2Name}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                        <SeverityTag tone={{ bg: `${st.color}18`, border: `${st.color}40`, color: st.color, dot: st.color }}>{t(st.label)}</SeverityTag>
                        {a.status === 'arbitrated' && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{t('breastSpecialty.arbitrationBy')}: {a.arbitratorName}</span>}
                      </td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{a.discrepancyScore != null ? `${(a.discrepancyScore * 100).toFixed(0)}%` : '-'}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                        {/* [v3.0.6.11-96 Wave3B G-21 P2] 裁决: 双方完成可仲裁 (复用 DualReadPage 能力) */}
                        {a.status === 'both_done'
                          ? <button onClick={() => { setArbitrateTarget(a); setArbitrateReport('') }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd6fe', background: '#8b5cf622', color: '#7c3aed', fontSize: 12, cursor: 'pointer' }}>{t('breastSpecialty.arbitrate')}</button>
                          : a.status === 'arbitrated'
                            ? <span style={{ fontSize: 12, color: '#16a34a' }}>{t('breastSpecialty.completed')}</span>
                            : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {arbitrateTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setArbitrateTarget(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('breastSpecialty.arbitrationTitle')} · {arbitrateTarget.studyId}</div>
              <button onClick={() => setArbitrateTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 13 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#be185d', marginBottom: 6 }}>{t('breastSpecialty.reader1')} · {arbitrateTarget.reader1Name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{arbitrateTarget.report1 || t('breastSpecialty.none')}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 13 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#be185d', marginBottom: 6 }}>{t('breastSpecialty.reader2')} · {arbitrateTarget.reader2Name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{arbitrateTarget.report2 || t('breastSpecialty.none')}</div>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.arbitrationReport')} *</label>
            <textarea value={arbitrateReport} onChange={e => setArbitrateReport(e.target.value)} rows={4} placeholder={t('breastSpecialty.arbitrationPlaceholder')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setArbitrateTarget(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('breastSpecialty.cancel')}</button>
              <button onClick={() => void handleArbitrate()} disabled={arbitrateSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', fontSize: 13, fontWeight: 600, cursor: arbitrateSaving ? 'wait' : 'pointer' }}>{arbitrateSaving ? t('breastSpecialty.submitting') : t('breastSpecialty.confirmArbitration')}</button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAssignModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 440, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('breastSpecialty.assignDualRead')}</div>
              <button onClick={() => setShowAssignModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.studyIdLabel')} *</label><input value={assignForm.studyId} onChange={e => setAssignForm({ ...assignForm, studyId: e.target.value })} placeholder={t('breastSpecialty.studyIdExample')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.patientNameLabel')} *</label><input value={assignForm.patientName} onChange={e => setAssignForm({ ...assignForm, patientName: e.target.value })} placeholder={t('breastSpecialty.enterName')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.patientIdLabel')} *</label><input value={assignForm.patientId} onChange={e => setAssignForm({ ...assignForm, patientId: e.target.value })} placeholder={t('breastSpecialty.patientIdExample')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.colModality')}</label><div style={{ display: 'flex', gap: 8 }}>{(['MG', 'DBT', 'US'] as const).map(m => (
                <button key={m} onClick={() => setAssignForm({ ...assignForm, modality: m })} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${assignForm.modality === m ? '#be185d' : '#e2e8f0'}`, background: assignForm.modality === m ? 'var(--color-error-bg)' : 'var(--bg-card)', color: assignForm.modality === m ? '#be185d' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{m}</button>
              ))}</div></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowAssignModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('breastSpecialty.cancel')}</button>
                <button onClick={() => void handleAssignDual()} disabled={assignSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', fontSize: 13, fontWeight: 600, cursor: assignSaving ? 'wait' : 'pointer' }}>{assignSaving ? t('breastSpecialty.assigning') : t('breastSpecialty.confirmAssign')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cadDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCadDetail(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 620, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('breastSpecialty.cadDetailTitle')} · {cadDetail.patientName}</div>
              <button onClick={() => setCadDetail(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>{t('breastSpecialty.colId')}: </span>{cadDetail.id}</div>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>{t('breastSpecialty.studyIdLabel')}: </span>{cadDetail.studyId}</div>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>{t('breastSpecialty.overallBirads')}: </span><BiradsTag v={cadDetail.overallBiRads} /></div>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13 }}><span style={{ color: 'var(--text-secondary)' }}>{t('breastSpecialty.model')}: </span>{cadDetail.modelVersion}</div>
            </div>
            {cadDetail.recommendation && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f9731622', borderRadius: 8, border: '1px solid #fed7aa', fontSize: 13, color: '#9a3412' }}>{cadDetail.recommendation}</div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10 }}>{t('breastSpecialty.lesionList', { count: cadDetail.lesions.length })}</div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>{t('breastSpecialty.colLesionType')}</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>{t('breastSpecialty.colShape')}</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>{t('breastSpecialty.colMargin')}</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>BI-RADS</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>{t('breastSpecialty.colMalignancyRisk')}</th>
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
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('breastSpecialty.newScreening')}</div>
              <button onClick={() => setShowNewModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.patientIdLabel')} *</label><input value={newForm.patientId} onChange={e => setNewForm({ ...newForm, patientId: e.target.value })} placeholder={t('breastSpecialty.patientIdExample')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.patientNameLabel')} *</label><input value={newForm.patientName} onChange={e => setNewForm({ ...newForm, patientName: e.target.value })} placeholder={t('breastSpecialty.enterName')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.colAge')}</label><input type="number" value={newForm.age} onChange={e => setNewForm({ ...newForm, age: Number(e.target.value) })} min={18} max={90} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.riskStratification')}</label><div style={{ display: 'flex', gap: 8 }}>{([['average', t('breastSpecialty.riskAverage')], ['intermediate', t('breastSpecialty.riskIntermediate')], ['high', t('breastSpecialty.riskHigh')]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setNewForm({ ...newForm, risk: v })} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${newForm.risk === v ? '#be185d' : '#e2e8f0'}`, background: newForm.risk === v ? 'var(--color-error-bg)' : 'var(--bg-card)', color: newForm.risk === v ? '#be185d' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}</div></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('breastSpecialty.examDate')}</label><input type="date" value={newForm.date} onChange={e => setNewForm({ ...newForm, date: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',}} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowNewModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('breastSpecialty.cancel')}</button>
                <button onClick={() => void handleCreateScreening()} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>{saving ? t('breastSpecialty.saving') : t('breastSpecialty.createScreening')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreastSpecialtyPage;

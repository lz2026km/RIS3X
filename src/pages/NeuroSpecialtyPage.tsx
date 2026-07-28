// Neuro Specialty Page — 神经影像分析 · 脑卒中 · 脑肿瘤 · 癫痫
import { useState, useMemo } from 'react';
import {
  Brain, Activity, AlertTriangle, CheckCircle, Clock,
  Search, ChevronRight, TrendingUp, Stethoscope,
  Zap, BarChart3, FileText, Eye,
} from 'lucide-react';

// ─── Constants ───
const STROKE_COLORS: Record<string, string> = {
  ischemic: '#1e40af', hemorrhagic: '#dc2626', tia: '#ca8a04', subarachnoid: '#7c3aed',
};

const TUMOR_COLORS: Record<string, string> = {
  glioma: '#7c3aed', meningioma: '#0891b2', metastasis: '#dc2626', schwannoma: '#16a34a',
  pituitary: '#ea580c', craniopharyngioma: '#ca8a04', other: '#94a3b8',
};

const mockStudies = [
  { id: 'NX001', name: '张伟', age: 68, gender: 'M', modality: 'MRI', indication: '急性左侧偏瘫', type: 'stroke', subtype: 'ischemic', vessel: 'MCA-L', aspectScore: 8, coreMl: 15, penumbraMl: 45, lvo: true, date: '2026-07-15', status: 'reported' },
  { id: 'NX002', name: '李芳', age: 52, gender: 'F', modality: 'MRI', indication: '头痛、视力下降', type: 'tumor', tumorType: 'meningioma', grade: 'I', sizeMm: 28, volumeCm3: 5.2, location: 'frontal', date: '2026-07-14', status: 'reviewed' },
  { id: 'NX003', name: '王明', age: 45, gender: 'M', modality: 'CT', indication: '突发剧烈头痛', type: 'stroke', subtype: 'subarachnoid', vessel: 'ACoA', aspectScore: 10, coreMl: 0, penumbraMl: 0, lvo: false, date: '2026-07-13', status: 'reported' },
  { id: 'NX004', name: '赵丽', age: 34, gender: 'F', modality: 'MRI', indication: '难治性癫痫', type: 'epilepsy', focus: 'mesial-temporal', mts: true, hippocampalAsymmetry: 18, date: '2026-07-12', status: 'reported' },
  { id: 'NX005', name: '陈浩', age: 62, gender: 'M', modality: 'MRI', indication: '头痛、恶心', type: 'tumor', tumorType: 'glioma', grade: 'IV', sizeMm: 42, volumeCm3: 28.5, location: 'frontal', date: '2026-07-11', status: 'reviewed' },
  { id: 'NX006', name: '刘洁', age: 71, gender: 'F', modality: 'CTA', indication: '疑似动脉瘤', type: 'aneurysm', location: 'PCom', sizeMm: 5.2, neckMm: 3.1, ruptureRisk: 'moderate', date: '2026-07-10', status: 'reported' },
];

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: 800, color: '#1a3a5c', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  section: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 },
  td: { padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: '#334155' },
  badge: (bg: string, text: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color: text, display: 'inline-block',
  }),
  scrollBox: { maxHeight: 320, overflowY: 'auto' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
};

const NeuroSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tab, setTab] = useState<'stroke' | 'tumor' | 'epilepsy' | 'stats'>('stroke');

  const filtered = useMemo(() => {
    let list = [...mockStudies];
    if (search) list = list.filter(r => r.name.includes(search) || r.id.includes(search));
    if (typeFilter) list = list.filter(r => r.type === typeFilter);
    return list;
  }, [search, typeFilter]);

  const strokeCount = mockStudies.filter(r => r.type === 'stroke').length;
  const tumorCount = mockStudies.filter(r => r.type === 'tumor').length;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}><Brain size={24} color="#dc2626" /> 神经专科</h1>
          <p style={s.subtitle}>Neuro Imaging Specialty · 脑卒中 · 脑肿瘤 · 癫痫 · 动脉瘤</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn}><FileText size={14} /> 导出</button>
          <button style={s.btnPrimary}><Zap size={14} /> 急诊分析</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={s.statsRow}>
        {[
          { label: '今日扫描', value: '15', unit: '例', icon: Activity, color: '#dc2626', bg: '#fef2f2' },
          { label: '卒中检出', value: String(strokeCount), unit: '例', icon: Zap, color: '#1e40af', bg: '#eff6ff' },
          { label: '肿瘤病例', value: String(tumorCount), unit: '例', icon: AlertTriangle, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'LVO 阳性', value: '1', unit: '例', icon: Eye, color: '#ea580c', bg: '#fff7ed' },
          { label: '待报告', value: '3', unit: '份', icon: FileText, color: '#16a34a', bg: '#f0fdf4' },
        ].map((k, i) => (
          <div key={i} style={s.statCard}>
            <div style={{ ...s.statIcon, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={s.statValue}>{k.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>{k.unit}</span></div>
            <div style={s.statLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'stroke', label: '脑卒中' },
          { key: 'tumor', label: '脑肿瘤' },
          { key: 'epilepsy', label: '癫痫/动脉瘤' },
          { key: 'stats', label: '统计分析' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#dc2626' : '#f1f5f9', color: tab === t.key ? '#fff' : '#64748b' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stroke' && (
        <div style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={s.sectionTitle}><Zap size={16} color="#dc2626" /> 脑卒中评估</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="#64748b" />
                <input placeholder="搜索患者..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
            </div>
          </div>
          <div style={s.scrollBox}>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>编号</th><th style={s.th}>患者</th><th style={s.th}>类型</th>
                <th style={s.th}>血管</th><th style={s.th}>ASPECTS</th><th style={s.th}>核心梗死</th>
                <th style={s.th}>缺血半暗带</th><th style={s.th}>LVO</th><th style={s.th}>操作</th>
              </tr></thead>
              <tbody>
                {filtered.filter(r => r.type === 'stroke').map(r => (
                  <tr key={r.id}>
                    <td style={s.td}>{r.id}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{r.name}<br /><span style={{ fontSize: 11, color: '#94a3b8' }}>{r.age}y {r.gender}</span></td>
                    <td style={s.td}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: STROKE_COLORS[r.subtype ?? 'ischemic'], color: '#fff' }}>
                        {r.subtype === 'ischemic' ? '缺血性' : r.subtype === 'hemorrhagic' ? '出血性' : 'TIA'}
                      </span>
                    </td>
                    <td style={s.td}>{r.vessel}</td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 700, color: (r.aspectScore ?? 10) < 6 ? '#dc2626' : (r.aspectScore ?? 10) < 8 ? '#ea580c' : '#16a34a' }}>
                        {r.aspectScore}
                      </span>
                    </td>
                    <td style={s.td}>{r.coreMl} ml</td>
                    <td style={s.td}>{r.penumbraMl} ml</td>
                    <td style={s.td}>
                      <span style={s.badge(r.lvo ? '#fef2f2' : '#f0fdf4', r.lvo ? '阳性' : '阴性')}></span>
                    </td>
                    <td style={s.td}>
                      <button style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        详情 <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tumor' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><Brain size={16} color="#7c3aed" /> 脑肿瘤列表</div>
            {filtered.filter(r => r.type === 'tumor').map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#7c3aed' }}>{r.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.id} · {r.modality}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: TUMOR_COLORS[r.tumorType ?? 'other'], color: '#fff' }}>
                    {r.tumorType === 'glioma' ? '胶质瘤' : '脑膜瘤'}
                  </span>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Grade {r.grade} · {r.sizeMm}mm</div>
                </div>
              </div>
            ))}
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><BarChart3 size={16} color="#7c3aed" /> 肿瘤分级分布</div>
            {['I', 'II', 'III', 'IV'].map(g => {
              const count = [2, 3, 2, 1][(['I', 'II', 'III', 'IV'].indexOf(g))];
              const colors = ['#16a34a', '#ca8a04', '#ea580c', '#dc2626'];
              return (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 50, fontSize: 12, fontWeight: 600 }}>Grade {g}</span>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${count * 10}%`, background: colors[(['I', 'II', 'III', 'IV'].indexOf(g))], borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>肿瘤类型分布</div>
              {[
                { label: '胶质瘤', count: 4, pct: 50, color: '#7c3aed' },
                { label: '脑膜瘤', count: 2, pct: 25, color: '#0891b2' },
                { label: '转移瘤', count: 1, pct: 12.5, color: '#dc2626' },
                { label: '其他', count: 1, pct: 12.5, color: '#94a3b8' },
              ].map(t => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
                  <span style={{ fontSize: 12, flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{t.count} ({t.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'epilepsy' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><Eye size={16} color="#ca8a04" /> 癫痫评估</div>
            {filtered.filter(r => r.type === 'epilepsy').map(r => (
              <div key={r.id} style={{ padding: 14, background: '#fefce8', borderRadius: 10, marginBottom: 12, border: '1px solid #fef08a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name} ({r.id})</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#ca8a04', color: '#fff' }}>{r.modality}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#64748b' }}>病灶: </span><span style={{ fontWeight: 600 }}>颞叶内侧</span></div>
                  <div><span style={{ color: '#64748b' }}>MTS: </span><span style={{ fontWeight: 600, color: '#dc2626' }}>阳性</span></div>
                  <div><span style={{ color: '#64748b' }}>不对称: </span><span style={{ fontWeight: 600 }}>{r.hippocampalAsymmetry}%</span></div>
                  <div><span style={{ color: '#64748b' }}>EEG: </span><span style={{ fontWeight: 600 }}>左侧颞区放电</span></div>
                </div>
              </div>
            ))}
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><AlertTriangle size={16} color="#dc2626" /> 动脉瘤评估</div>
            {filtered.filter(r => r.type === 'aneurysm').map(r => (
              <div key={r.id} style={{ padding: 14, background: '#fef2f2', borderRadius: 10, marginBottom: 12, border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name} ({r.id})</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#dc2626', color: '#fff' }}>{r.modality}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#64748b' }}>位置: </span><span style={{ fontWeight: 600 }}>{r.location}</span></div>
                  <div><span style={{ color: '#64748b' }}>大小: </span><span style={{ fontWeight: 600 }}>{r.sizeMm}mm</span></div>
                  <div><span style={{ color: '#64748b' }}>瘤颈: </span><span style={{ fontWeight: 600 }}>{r.neckMm}mm</span></div>
                  <div><span style={{ color: '#64748b' }}>风险: </span><span style={{ fontWeight: 600, color: '#ea580c' }}>{r.ruptureRisk === 'moderate' ? '中危' : r.ruptureRisk}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><BarChart3 size={16} color="#dc2626" /> 疾病分布</div>
            {[
              { label: '脑卒中', count: 2, pct: 33, color: '#dc2626' },
              { label: '脑肿瘤', count: 2, pct: 33, color: '#7c3aed' },
              { label: '癫痫', count: 1, pct: 17, color: '#ca8a04' },
              { label: '动脉瘤', count: 1, pct: 17, color: '#0891b2' },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                <span style={{ width: 80, fontSize: 13, fontWeight: 500 }}>{d.label}</span>
                <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${d.pct}%`, background: d.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 50, textAlign: 'right' }}>{d.count} ({d.pct}%)</span>
              </div>
            ))}
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><TrendingUp size={16} color="#16a34a" /> 卒中治疗时间窗</div>
            {[
              { window: '0-3h (IV tPA)', count: 5, color: '#16a34a' },
              { window: '3-6h (MT)', count: 3, color: '#ca8a04' },
              { window: '6-24h (MT)', count: 2, color: '#ea580c' },
              { window: '>24h (保守)', count: 1, color: '#dc2626' },
            ].map(t => (
              <div key={t.window} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ width: 120, fontSize: 12, color: '#64748b' }}>{t.window}</span>
                <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${count => (t.count / 5) * 100}%`, background: t.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 30, textAlign: 'right' }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`.v4-icon { display: inline-block; vertical-align: middle; }`}</style>
    </div>
  );
};

export default NeuroSpecialtyPage;

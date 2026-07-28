// Ortho Specialty Page — 骨科影像分析 · 关节 · 脊柱 · 骨密度
import { useState, useMemo } from 'react';
import {
  Bone, Activity, AlertTriangle, CheckCircle, Clock,
  Search, ChevronRight, TrendingUp, Stethoscope,
  BarChart3, FileText, Scale,
} from 'lucide-react';
import type { JointType, KellgrenLawrenceGrade } from '@/services/api/orthoSpecialtyApi';

// ─── Constants ───
const JOINT_LABELS: Record<string, string> = {
  shoulder: '肩关节', elbow: '肘关节', wrist: '腕关节', hip: '髋关节',
  knee: '膝关节', ankle: '踝关节', cervical: '颈椎', lumbar: '腰椎',
};

const KL_COLORS: Record<string, string> = {
  '0': '#16a34a', 'I': '#16a34a', 'II': '#ca8a04', 'III': '#ea580c', 'IV': '#dc2626',
};

const mockStudies = [
  { id: 'OX001', name: '张伟', age: 65, gender: 'M', joint: 'knee', modality: 'XR', klGrade: 'III', oaScore: 7.5, fracture: false, date: '2026-07-15', status: 'reported' },
  { id: 'OX002', name: '李芳', age: 52, gender: 'F', joint: 'hip', modality: 'XR', klGrade: 'II', oaScore: 4.2, fracture: false, date: '2026-07-14', status: 'reviewed' },
  { id: 'OX003', name: '王明', age: 70, gender: 'M', joint: 'lumbar', modality: 'MRI', klGrade: 'IV', oaScore: 9.1, fracture: true, date: '2026-07-13', status: 'reported' },
  { id: 'OX004', name: '赵丽', age: 34, gender: 'F', joint: 'knee', modality: 'MRI', klGrade: '0', oaScore: 0, fracture: false, date: '2026-07-12', status: 'reported' },
  { id: 'OX005', name: '陈浩', age: 58, gender: 'M', joint: 'shoulder', modality: 'CT', klGrade: 'I', oaScore: 2.0, fracture: true, date: '2026-07-11', status: 'reviewed' },
  { id: 'OX006', name: '刘洁', age: 61, gender: 'F', joint: 'cervical', modality: 'MRI', klGrade: 'II', oaScore: 5.5, fracture: false, date: '2026-07-10', status: 'reported' },
  { id: 'OX007', name: '孙明', age: 45, gender: 'M', joint: 'ankle', modality: 'CT', klGrade: '0', oaScore: 0, fracture: true, date: '2026-07-09', status: 'reported' },
  { id: 'OX008', name: '周慧', age: 72, gender: 'F', joint: 'hip', modality: 'DEXA', klGrade: 'N/A', oaScore: 0, fracture: false, tScore: -3.2, date: '2026-07-08', status: 'reported' },
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
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#9333ea', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
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

const OrthoSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [jointFilter, setJointFilter] = useState('');
  const [tab, setTab] = useState<'joints' | 'spine' | 'bmd' | 'stats'>('joints');

  const filtered = useMemo(() => {
    let list = [...mockStudies];
    if (search) list = list.filter(r => r.name.includes(search) || r.id.includes(search));
    if (jointFilter) list = list.filter(r => r.joint === jointFilter);
    return list;
  }, [search, jointFilter]);

  const fractureCount = mockStudies.filter(r => r.fracture).length;
  const severeOA = mockStudies.filter(r => ['III', 'IV'].includes(r.klGrade)).length;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}><Bone size={24} color="#9333ea" /> 骨科专科</h1>
          <p style={s.subtitle}>Orthopedic Imaging Specialty · 关节分析 · 脊柱评估 · 骨密度 · 创伤</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn}><FileText size={14} /> 导出</button>
          <button style={s.btnPrimary}><Bone size={14} /> 新建分析</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={s.statsRow}>
        {[
          { label: '今日检查', value: '22', unit: '例', icon: Activity, color: '#9333ea', bg: '#f5f3ff' },
          { label: '骨折检出', value: String(fractureCount), unit: '例', icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
          { label: '重度 OA', value: String(severeOA), unit: '例', icon: Stethoscope, color: '#ea580c', bg: '#fff7ed' },
          { label: '骨质疏松', value: '3', unit: '例', icon: Scale, color: '#ca8a04', bg: '#fefce8' },
          { label: '待报告', value: '4', unit: '份', icon: FileText, color: '#16a34a', bg: '#f0fdf4' },
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
          { key: 'joints', label: '关节分析' },
          { key: 'spine', label: '脊柱评估' },
          { key: 'bmd', label: '骨密度' },
          { key: 'stats', label: '统计分析' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#9333ea' : '#f1f5f9', color: tab === t.key ? '#fff' : '#64748b' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'joints' && (
        <div style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={s.sectionTitle}><Bone size={16} color="#9333ea" /> 关节影像列表</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="#64748b" />
                <input placeholder="搜索患者..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
              <select value={jointFilter} onChange={e => setJointFilter(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}>
                <option value="">全部关节</option>
                {Object.entries(JOINT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={s.scrollBox}>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>编号</th><th style={s.th}>患者</th><th style={s.th}>关节</th>
                <th style={s.th}>模态</th><th style={s.th}>KL 分级</th><th style={s.th}>OA 评分</th>
                <th style={s.th}>骨折</th><th style={s.th}>日期</th><th style={s.th}>操作</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={s.td}>{r.id}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{r.name}<br /><span style={{ fontSize: 11, color: '#94a3b8' }}>{r.age}y {r.gender}</span></td>
                    <td style={s.td}>{JOINT_LABELS[r.joint] ?? r.joint}</td>
                    <td style={s.td}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#9333ea', color: '#fff' }}>{r.modality}</span>
                    </td>
                    <td style={s.td}>
                      {r.klGrade !== 'N/A' ? (
                        <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: `${KL_COLORS[r.klGrade] ?? '#94a3b8'}18`, color: KL_COLORS[r.klGrade] ?? '#94a3b8' }}>
                          KL {r.klGrade}
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 700, color: r.oaScore > 7 ? '#dc2626' : r.oaScore > 4 ? '#ea580c' : '#16a34a' }}>{r.oaScore}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(r.fracture ? '#fef2f2' : '#f0fdf4', r.fracture ? '有骨折' : '无骨折')}>
                      </span>
                    </td>
                    <td style={{ ...s.td, color: '#64748b' }}>{r.date}</td>
                    <td style={s.td}>
                      <button style={{ padding: '4px 10px', background: '#f5f3ff', color: '#9333ea', border: '1px solid #ddd6fe', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
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

      {tab === 'spine' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><Activity size={16} color="#9333ea" /> 脊柱评估</div>
            {['C3-C4', 'C4-C5', 'C5-C6', 'C6-C7', 'L3-L4', 'L4-L5', 'L5-S1'].map((level, i) => {
              const pathologies = ['正常', '正常', '椎间盘突出', '正常', '椎间盘膨出', '椎间盘突出', '正常'];
              const stenosis = ['无', '无', '轻度', '无', '无', '中度', '无'];
              const isNormal = pathologies[i] === '正常';
              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ width: 60, fontSize: 13, fontWeight: 700, color: '#334155' }}>{level}</span>
                  <span style={{ flex: 1, fontSize: 13, color: isNormal ? '#16a34a' : '#ea580c' }}>{pathologies[i]}</span>
                  <span style={{ fontSize: 12, color: stenosis[i] === '无' ? '#94a3b8' : '#dc2626', fontWeight: 600 }}>管腔: {stenosis[i]}</span>
                </div>
              );
            })}
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><Scale size={16} color="#ca8a04" /> 脊柱排列</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Cobb 角', value: '12°', status: '异常', color: '#ea580c' },
                { label: '颈椎前凸', value: '32°', status: '正常', color: '#16a34a' },
                { label: '腰椎前凸', value: '48°', status: '正常', color: '#16a34a' },
                { label: '滑脱程度', value: '5%', status: 'I 度', color: '#ca8a04' },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1a3a5c' }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: item.color, fontWeight: 600 }}>{item.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'bmd' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><Scale size={16} color="#ca8a04" /> 骨密度检测</div>
            {[
              { site: 'L1-L4 腰椎', tScore: -3.2, zScore: -2.1, density: 0.72, cat: '骨质疏松' },
              { site: '股骨颈', tScore: -2.8, zScore: -1.8, density: 0.68, cat: '骨质疏松' },
              { site: '全髋', tScore: -2.1, zScore: -1.2, density: 0.82, cat: '骨量减少' },
            ].map(b => (
              <div key={b.site} style={{ padding: 14, background: '#f8fafc', borderRadius: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.site}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: b.tScore < -2.5 ? '#fef2f2' : '#fefce8', color: b.tScore < -2.5 ? '#dc2626' : '#ca8a04' }}>{b.cat}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><div style={{ color: '#64748b' }}>T-Score</div><div style={{ fontWeight: 700, color: b.tScore < -2.5 ? '#dc2626' : '#ea580c' }}>{b.tScore}</div></div>
                  <div><div style={{ color: '#64748b' }}>Z-Score</div><div style={{ fontWeight: 700 }}>{b.zScore}</div></div>
                  <div><div style={{ color: '#64748b' }}>密度</div><div style={{ fontWeight: 700 }}>{b.density} g/cm²</div></div>
                </div>
              </div>
            ))}
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><BarChart3 size={16} color="#9333ea" /> FRAX 风险评估</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '髋部骨折', value: '8.5%', color: '#dc2626' },
                { label: '主要骨折', value: '15.2%', color: '#ea580c' },
                { label: '椎体骨折', value: '12.8%', color: '#ca8a04' },
                { label: '桡骨远端', value: '6.3%', color: '#16a34a' },
              ].map(f => (
                <div key={f.label} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: f.color }}>{f.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{f.label} 10年风险</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><BarChart3 size={16} color="#9333ea" /> 关节分布</div>
            {Object.entries(JOINT_LABELS).map(([k, v]) => {
              const count = mockStudies.filter(r => r.joint === k).length;
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 60, fontSize: 12, fontWeight: 600 }}>{v}</span>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${count > 0 ? count * 12 : 0}%`, background: '#9333ea', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><TrendingUp size={16} color="#16a34a" /> 骨折检出趋势</div>
            {['2026-07', '2026-06', '2026-05', '2026-04'].map((m, i) => {
              const vals = [8, 12, 6, 10];
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ width: 80, fontSize: 12, color: '#64748b' }}>{m}</span>
                  <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${vals[i] * 5}%`, background: '#dc2626', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>{vals[i]}例</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`.v4-icon { display: inline-block; vertical-align: middle; }`}</style>
    </div>
  );
};

export default OrthoSpecialtyPage;

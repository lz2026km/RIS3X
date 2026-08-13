// Ortho Specialty Page — 骨科影像分析 · 关节 · 脊柱 · 骨密度
// [v3.0.6.11-82] W3-C: 后端无骨科端点, 全页标注「演示数据」
import { useState, useMemo } from 'react';
import { Bone, Activity, AlertTriangle, Search, TrendingUp, Stethoscope, BarChart3, FileText, Scale, Plus } from 'lucide-react';

const JOINT_LABELS: Record<string, string> = { shoulder: '肩关节', elbow: '肘关节', wrist: '腕关节', hip: '髋关节', knee: '膝关节', ankle: '踝关节', cervical: '颈椎', lumbar: '腰椎' };
const KL_COLORS: Record<string, string> = { '0': '#16a34a', 'I': '#16a34a', 'II': '#ca8a04', 'III': '#ea580c', 'IV': '#dc2626' };

const mockStudies = [
  { id: 'OX001', name: '张伟', age: 65, gender: 'M', joint: 'knee', modality: 'XR', klGrade: 'III', oaScore: 7.5, fracture: false, date: '2026-07-15' },
  { id: 'OX002', name: '李芳', age: 52, gender: 'F', joint: 'hip', modality: 'XR', klGrade: 'II', oaScore: 4.2, fracture: false, date: '2026-07-14' },
  { id: 'OX003', name: '王明', age: 70, gender: 'M', joint: 'lumbar', modality: 'MRI', klGrade: 'IV', oaScore: 9.1, fracture: true, date: '2026-07-13' },
  { id: 'OX004', name: '赵丽', age: 34, gender: 'F', joint: 'knee', modality: 'MRI', klGrade: '0', oaScore: 0, fracture: false, date: '2026-07-12' },
  { id: 'OX005', name: '陈浩', age: 58, gender: 'M', joint: 'shoulder', modality: 'CT', klGrade: 'I', oaScore: 2.0, fracture: true, date: '2026-07-11' },
];

const OrthoSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [jointFilter, setJointFilter] = useState('');
  const [tab, setTab] = useState<'joints' | 'spine' | 'bmd' | 'stats'>('joints');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudy, setNewStudy] = useState({ name: '', joint: 'knee' as keyof typeof JOINT_LABELS, modality: 'XR', klGrade: 'II' });
  const [studies, setStudies] = useState(mockStudies);
  const filtered = useMemo(() => {
    let list = [...studies];
    if (search) list = list.filter(r => r.name.includes(search) || r.id.includes(search));
    if (jointFilter) list = list.filter(r => r.joint === jointFilter);
    return list;
  }, [search, jointFilter, studies]);
  const fractureCount = studies.filter(r => r.fracture).length;
  const severeOA = studies.filter(r => ['III', 'IV'].includes(r.klGrade)).length;

  const handleCreate = () => {
    if (!newStudy.name.trim()) return
    const kl = newStudy.klGrade as '0' | 'I' | 'II' | 'III' | 'IV'
    setStudies(prev => [...prev, {
      id: `OX${String(prev.length + 1).padStart(3, '0')}`,
      name: newStudy.name.trim(),
      age: 50, gender: 'M', joint: newStudy.joint, modality: newStudy.modality,
      klGrade: kl, oaScore: { '0': 0, 'I': 2, 'II': 4.2, 'III': 7.5, 'IV': 9.1 }[kl],
      fracture: false, date: new Date().toISOString().slice(0, 10),
    }])
    setShowCreateModal(false)
    setNewStudy({ name: '', joint: 'knee', modality: 'XR', klGrade: 'II' })
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Bone size={24} color="#9333ea" /> 骨科专科 <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#8b5cf622', color: '#9333ea', border: '1px solid #e9d5ff' }}>演示数据</span></h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>骨科影像专科 · 关节分析 · 脊柱评估 · 骨密度 · 创伤 <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600 }}>演示数据（后端无骨科接口）</span></p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#9333ea', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}><Bone size={14} /> 新建分析</button>
      </div>

      {showCreateModal && (
        <div onClick={() => setShowCreateModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>新建骨科分析</span>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>患者姓名</label>
                <input value={newStudy.name} onChange={e => setNewStudy({ ...newStudy, name: e.target.value })} placeholder="请输入患者姓名" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>关节</label>
                <select value={newStudy.joint} onChange={e => setNewStudy({ ...newStudy, joint: e.target.value as any })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13 }}>
                  {Object.entries(JOINT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>模态</label>
                  <select value={newStudy.modality} onChange={e => setNewStudy({ ...newStudy, modality: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13 }}>
                    {['XR', 'MRI', 'CT'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>KL 分级</label>
                  <select value={newStudy.klGrade} onChange={e => setNewStudy({ ...newStudy, klGrade: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13 }}>
                    {['0', 'I', 'II', 'III', 'IV'].map(k => <option key={k} value={k}>KL {k}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>取消</button>
                <button onClick={handleCreate} style={{ padding: '8px 20px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} />创建分析</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '今日检查', value: '22', icon: Activity, color: '#9333ea', bg: '#8b5cf622' },
          { label: '骨折检出', value: String(fractureCount), icon: AlertTriangle, color: '#dc2626', bg: '#ef444422' },
          { label: '重度 OA', value: String(severeOA), icon: Stethoscope, color: '#ea580c', bg: '#f9731622' },
          { label: '骨质疏松', value: '3', icon: Scale, color: '#ca8a04', bg: '#f59e0b22' },
          { label: '待报告', value: '4', icon: FileText, color: '#16a34a', bg: '#22c55e22' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary-800)' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[{ key: 'joints', label: '关节分析' }, { key: 'spine', label: '脊柱评估' }, { key: 'bmd', label: '骨密度' }, { key: 'stats', label: '统计分析' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#9333ea' : 'var(--bg-card)', color: tab === t.key ? '#fff' : '#64748b' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'joints' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}><Bone size={16} color="#9333ea" /> 关节影像列表</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input placeholder="搜索患者..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
              <select value={jointFilter} onChange={e => setJointFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }}>
                <option value="">全部关节</option>
                {Object.entries(JOINT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>编号</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>患者</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>关节</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>模态</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>KL 分级</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>OA 评分</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>骨折</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 }}>日期</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.id}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.name}<br /><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.age}y {r.gender}</span></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{JOINT_LABELS[r.joint]}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#9333ea', color: '#fff' }}>{r.modality}</span></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: `${KL_COLORS[r.klGrade] ?? '#94a3b8'}18`, color: KL_COLORS[r.klGrade] ?? '#94a3b8' }}>KL {r.klGrade}</span>
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, color: r.oaScore > 7 ? '#dc2626' : r.oaScore > 4 ? '#ea580c' : '#16a34a' }}>{r.oaScore}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.fracture ? 'var(--color-error-bg)' : 'var(--color-success-bg)', color: r.fracture ? '#dc2626' : '#16a34a' }}>{r.fracture ? '有骨折' : '无骨折'}</span>
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'spine' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><Activity size={16} color="#9333ea" /> 脊柱评估</div>
            {['C3-C4', 'C4-C5', 'C5-C6', 'C6-C7', 'L3-L4', 'L4-L5', 'L5-S1'].map((level, i) => {
              const pathologies = ['正常', '正常', '椎间盘突出', '正常', '椎间盘膨出', '椎间盘突出', '正常'];
              const stenosis = ['无', '无', '轻度', '无', '无', '中度', '无'];
              const isNormal = pathologies[i] === '正常';
              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ width: 60, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{level}</span>
                  <span style={{ flex: 1, fontSize: 13, color: isNormal ? '#16a34a' : '#ea580c' }}>{pathologies[i]}</span>
                  <span style={{ fontSize: 12, color: stenosis[i] === '无' ? '#94a3b8' : '#dc2626', fontWeight: 600 }}>管腔: {stenosis[i]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><Scale size={16} color="#ca8a04" /> 脊柱排列</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Cobb 角', value: '12°', status: '异常', color: '#ea580c' },
                { label: '颈椎前凸', value: '32°', status: '正常', color: '#16a34a' },
                { label: '腰椎前凸', value: '48°', status: '正常', color: '#16a34a' },
                { label: '滑脱程度', value: '5%', status: 'I 度', color: '#ca8a04' },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary-800)' }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: item.color, fontWeight: 600 }}>{item.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'bmd' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><Scale size={16} color="#ca8a04" /> 骨密度检测</div>
            {[
              { site: 'L1-L4 腰椎', tScore: -3.2, density: 0.72, cat: '骨质疏松' },
              { site: '股骨颈', tScore: -2.8, density: 0.68, cat: '骨质疏松' },
              { site: '全髋', tScore: -2.1, density: 0.82, cat: '骨量减少' },
            ].map(b => (
              <div key={b.site} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.site}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: b.tScore < -2.5 ? '#fef2f2' : '#fefce8', color: b.tScore < -2.5 ? '#dc2626' : '#ca8a04' }}>{b.cat}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><div style={{ color: 'var(--text-secondary)' }}>T-Score</div><div style={{ fontWeight: 700, color: b.tScore < -2.5 ? '#dc2626' : '#ea580c' }}>{b.tScore}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)' }}>密度</div><div style={{ fontWeight: 700 }}>{b.density} g/cm²</div></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><BarChart3 size={16} color="#9333ea" /> FRAX 风险评估</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '髋部骨折', value: '8.5%', color: '#dc2626' },
                { label: '主要骨折', value: '15.2%', color: '#ea580c' },
                { label: '椎体骨折', value: '12.8%', color: '#ca8a04' },
                { label: '桡骨远端', value: '6.3%', color: '#16a34a' },
              ].map(f => (
                <div key={f.label} style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: f.color }}>{f.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{f.label} 10年风险</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><BarChart3 size={16} color="#9333ea" /> 关节分布</div>
            {Object.entries(JOINT_LABELS).map(([k, v]) => {
              const count = mockStudies.filter(r => r.joint === k).length;
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 60, fontSize: 12, fontWeight: 600 }}>{v}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-card)', borderRadius: 4 }}><div style={{ height: '100%', width: `${count > 0 ? count * 12 : 0}%`, background: '#9333ea', borderRadius: 4 }} /></div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16 }}><TrendingUp size={16} color="#16a34a" /> 骨折检出趋势</div>
            {['2026-07', '2026-06', '2026-05', '2026-04'].map((m, i) => {
              const vals = [8, 12, 6, 10];
              return (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)' }}>{m}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-card)', borderRadius: 3 }}><div style={{ height: '100%', width: `${(vals[i] ?? 0) * 5}%`, background: '#dc2626', borderRadius: 3 }} /></div>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>{vals[i] ?? 0}例</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrthoSpecialtyPage;

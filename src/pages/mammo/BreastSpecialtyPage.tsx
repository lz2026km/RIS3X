// Breast Specialty Page — BI-RADS · 乳腺工作流 · 筛查管理
import { useState, useMemo } from 'react';
import { Heart, Activity, AlertTriangle, CheckCircle, Clock, Search, TrendingUp, Stethoscope, Microscope, FileText, BarChart3, X } from 'lucide-react';
import type { BreastDensity, ScreeningOutcome } from '@/services/api/breastSpecialtyApi';
import { breastSpecialtyApi } from '@/services/api/breastSpecialtyApi';

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

const BreastSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'screening' | 'density' | 'workflow' | 'stats'>('screening');
  const [screeningList, setScreeningList] = useState<any[]>(mockScreening);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ patientId: '', patientName: '', age: 45, risk: 'average' as 'average' | 'intermediate' | 'high', date: new Date().toISOString().split('T')[0] });
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
      const res = await breastSpecialtyApi.createScreening({
        patientId: newForm.patientId,
        patientName: newForm.patientName,
        age: newForm.age,
        riskLevel: newForm.risk,
        biRadsLatest: 1,
        outcome: 'normal',
        date: newForm.date,
      });
      const created = res.success && res.data ? res.data : {
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
      setScreeningList(prev => [created, ...prev]);
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Heart size={24} color="#be185d" /> 乳腺专科 <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>演示数据</span></h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>乳腺影像专科 · BI-RADS 评分 · 筛查管理 · 乳腺工作流</p>
        </div>
        <button onClick={() => setShowNewModal(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#be185d', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>新建筛查</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '今日检查', value: '28', icon: Activity, color: '#be185d', bg: '#fdf2f8' },
          { label: 'BI-RADS 4-5', value: String(suspicious), icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
          { label: '待召回', value: String(recalls), icon: Clock, color: '#ea580c', bg: '#fff7ed' },
          { label: '今日报告', value: '18', icon: FileText, color: '#16a34a', bg: '#f0fdf4' },
          { label: '检出率', value: '4.2%', icon: TrendingUp, color: '#7c3aed', bg: '#f5f3ff' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1a3a5c' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[{ key: 'screening', label: '筛查管理' }, { key: 'density', label: '密度评估' }, { key: 'workflow', label: '乳腺工作流' }, { key: 'stats', label: '统计分析' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#be185d' : '#f1f5f9', color: tab === t.key ? '#fff' : '#64748b' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'screening' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', display: 'flex', alignItems: 'center', gap: 8 }}><Stethoscope size={16} color="#be185d" /> 筛查列表</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="#64748b" />
                <input placeholder="搜索患者..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>编号</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>患者</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>年龄</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>密度</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>BI-RADS</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>结果</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>日期</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}>{r.id}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc', fontWeight: 600 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}>{r.age}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}>{DENSITY_LABELS[r.density]}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}><BiradsTag v={r.biRads} /></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}>{OUTCOME_LABELS[r.outcome]}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: '#64748b' }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'density' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Activity size={16} color="#be185d" /> 密度分布</div>
            {(['a', 'b', 'c', 'd'] as BreastDensity[]).map(d => {
              const count = mockScreening.filter(r => r.density === d).length;
              const pct = Math.round((count / mockScreening.length) * 100);
              return (
                <div key={d} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{DENSITY_LABELS[d]}</span><span style={{ fontWeight: 700 }}>{count} 例 ({pct}%)</span></div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: '#be185d', borderRadius: 4 }} /></div>
                </div>
              );
            })}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Microscope size={16} color="#7c3aed" /> BI-RADS 分布</div>
            {[1, 2, 3, '4A', '4B', 4, 5].map(b => {
              const count = mockScreening.filter(r => r.biRads === b || r.biRads === Number(b)).length;
              const color = BIRADS_COLORS[String(b)] ?? '#94a3b8';
              return (
                <div key={String(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 60, fontSize: 12, fontWeight: 600, color }}>BI-RADS {b}</span>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}><div style={{ height: '100%', width: `${count > 0 ? Math.max(count * 20, 8) : 0}%`, background: color, borderRadius: 4 }} /></div>
                  <span style={{ fontSize: 12, color: '#64748b', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'workflow' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Activity size={16} color="#be185d" /> 乳腺工作流</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { step: '1. 预约登记', status: 'done', desc: '患者信息录入、风险评估', time: '5 min' },
              { step: '2. 摆位采集', status: 'done', desc: 'CC/MLO 体位、压板厚度', time: '15 min' },
              { step: '3. 影像处理', status: 'done', desc: '图像优化、对比度调整', time: '3 min' },
              { step: '4. AI 预筛', status: 'active', desc: '密度分类、病灶检测', time: '1 min' },
              { step: '5. 影像诊断', status: 'pending', desc: 'BI-RADS 评分、报告', time: '10 min' },
              { step: '6. 签发报告', status: 'pending', desc: '医师审核、签发', time: '5 min' },
            ].map((w, i) => (
              <div key={i} style={{ padding: 16, background: w.status === 'active' ? '#fdf2f8' : '#f8fafc', borderRadius: 10, border: `1px solid ${w.status === 'active' ? '#fbcfe8' : '#e2e8f0'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {w.status === 'done' ? <CheckCircle size={16} color="#16a34a" /> : w.status === 'active' ? <Clock size={16} color="#be185d" /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #d1d5db', display: 'inline-block' }} />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: w.status === 'active' ? '#be185d' : '#334155' }}>{w.step}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{w.desc}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>预计: {w.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><BarChart3 size={16} color="#be185d" /> 月度筛查统计</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, textAlign: 'center' }}>
              {['1月', '2月', '3月', '4月', '5月', '6月'].map((m, i) => {
                const val = [120, 98, 135, 110, 142, 128][i] ?? 0;
                return (
                  <div key={m}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 120 }}>
                      <div style={{ width: '80%', height: `${val / 1.5}px`, background: '#be185d', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{m}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{val}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><AlertTriangle size={16} color="#dc2626" /> 召回率趋势</div>
            {[{ month: '2026-07', rate: 8.5, cases: 11 }, { month: '2026-06', rate: 7.2, cases: 9 }, { month: '2026-05', rate: 9.1, cases: 13 }, { month: '2026-04', rate: 6.8, cases: 7 }].map(t => (
              <div key={t.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ width: 80, fontSize: 12, color: '#64748b' }}>{t.month}</span>
                <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ height: '100%', width: `${t.rate * 5}%`, background: '#ea580c', borderRadius: 3 }} /></div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>{t.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowNewModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 460, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a3a5c' }}>新建筛查</div>
              <button onClick={() => setShowNewModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>患者ID *</label><input value={newForm.patientId} onChange={e => setNewForm({ ...newForm, patientId: e.target.value })} placeholder="如 P100006" style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>患者姓名 *</label><input value={newForm.patientName} onChange={e => setNewForm({ ...newForm, patientName: e.target.value })} placeholder="请输入姓名" style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>年龄</label><input type="number" value={newForm.age} onChange={e => setNewForm({ ...newForm, age: Number(e.target.value) })} min={18} max={90} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>风险分层</label><div style={{ display: 'flex', gap: 8 }}>{([['average', '一般'], ['intermediate', '中等'], ['high', '高危']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setNewForm({ ...newForm, risk: v })} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${newForm.risk === v ? '#be185d' : '#e2e8f0'}`, background: newForm.risk === v ? '#fdf2f8' : '#fff', color: newForm.risk === v ? '#be185d' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}</div></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>检查日期</label><input type="date" value={newForm.date} onChange={e => setNewForm({ ...newForm, date: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowNewModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>取消</button>
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

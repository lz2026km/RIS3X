// Cardiac Specialty Page — 心脏分析 · 冠脉评估 · 心功能
import { useState, useMemo } from 'react';
import { Heart, Activity, AlertTriangle, CheckCircle, Clock, Search, ChevronRight, TrendingUp, Stethoscope, Zap, BarChart3, FileText, Gauge } from 'lucide-react';
import type { CadRadsScore } from '@/services/api/cardiacSpecialtyApi';

const CADRADS_COLORS: Record<string, string> = { 0: '#16a34a', 1: '#16a34a', 2: '#ca8a04', 3: '#ea580c', '4A': '#dc2626', '4B': '#dc2626', 5: '#7f1d1d', N: '#94a3b8' };
const CORONARY_SEGMENTS = [
  { key: 'LM', name: '左主干 (LM)' }, { key: 'LAD-p', name: 'LAD 近段' }, { key: 'LAD-m', name: 'LAD 中段' },
  { key: 'LAD-d', name: 'LAD 远段' }, { key: 'LCX-p', name: 'LCX 近段' }, { key: 'LCX-m', name: 'LCX 中段' },
  { key: 'LCX-d', name: 'LCX 远段' }, { key: 'RCA-p', name: 'RCA 近段' }, { key: 'RCA-m', name: 'RCA 中段' }, { key: 'RCA-d', name: 'RCA 远段' },
];

const mockPatients = [
  { id: 'CV001', name: '张伟', age: 58, gender: 'M', modality: 'CCTA', cadRads: 3, lvEf: 60, calciumScore: 245, stenosis: 55, date: '2026-07-15' },
  { id: 'CV002', name: '李娜', age: 45, gender: 'F', modality: 'CMR', cadRads: 'N', lvEf: 35, calciumScore: 0, stenosis: 0, date: '2026-07-14' },
  { id: 'CV003', name: '王明', age: 62, gender: 'M', modality: 'Echo', cadRads: 'N', lvEf: 55, calciumScore: 0, stenosis: 0, date: '2026-07-13' },
  { id: 'CV004', name: '刘燕', age: 53, gender: 'F', modality: 'Cath', cadRads: 5, lvEf: 50, calciumScore: 890, stenosis: 90, date: '2026-07-12' },
  { id: 'CV005', name: '陈浩', age: 68, gender: 'M', modality: 'CCTA', cadRads: '4A', lvEf: 55, calciumScore: 567, stenosis: 72, date: '2026-07-11' },
];

const CadRadsTag = ({ v }: { v: string | number }) => {
  const color = CADRADS_COLORS[String(v)] ?? '#94a3b8';
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40` }}>CAD-RADS {v}</span>;
};

const CardiacSpecialtyPage = () => {
  const [search, setSearch] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [tab, setTab] = useState<'coronary' | 'function' | 'analysis' | 'stats'>('coronary');
  const tabs = [
    { key: 'coronary' as const, label: '冠脉评估' },
    { key: 'function' as const, label: '心功能分析' },
    { key: 'analysis' as const, label: '心脏分析' },
    { key: 'stats' as const, label: '统计分析' },
  ];
  const filtered = useMemo(() => {
    let list = [...mockPatients];
    if (search) list = list.filter(r => r.name.includes(search) || r.id.includes(search));
    if (modalityFilter) list = list.filter(r => r.modality === modalityFilter);
    return list;
  }, [search, modalityFilter]);
  const highStenosis = mockPatients.filter(r => r.stenosis >= 70).length;
  const avgEf = Math.round(mockPatients.reduce((a, b) => a + b.lvEf, 0) / mockPatients.length);

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Heart size={24} color="#1e40af" /> 心脏专科</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Cardiac Imaging Specialty · 冠脉评估 · 心功能分析 · 血流动力学</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}><FileText size={14} /> 导出</button>
          <button style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}><Zap size={14} /> 新建分析</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '今日分析', value: '18', icon: Activity, color: '#1e40af', bg: '#eff6ff' },
          { label: '重度狭窄', value: String(highStenosis), icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
          { label: '平均 EF', value: `${avgEf}%`, icon: Gauge, color: '#16a34a', bg: '#f0fdf4' },
          { label: '钙化积分', value: '342', icon: BarChart3, color: '#ea580c', bg: '#fff7ed' },
          { label: '待报告', value: '5', icon: FileText, color: '#7c3aed', bg: '#f5f3ff' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1a3a5c' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#1e40af' : '#f1f5f9', color: tab === t.key ? '#fff' : '#64748b' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'coronary' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="#1e40af" /> 冠脉评估列表</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '4px 12px' }}>
                <Search size={16} color="#64748b" />
                <input placeholder="搜索患者..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, fontSize: 13, width: 160 }} />
              </div>
              <select value={modalityFilter} onChange={e => setModalityFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}>
                <option value="">全部模态</option>
                <option value="CCTA">CCTA</option>
                <option value="CMR">CMR</option>
                <option value="Echo">Echo</option>
                <option value="Cath">Cath</option>
              </select>
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>编号</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>患者</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>模态</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>CAD-RADS</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>EF%</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>钙化积分</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>最大狭窄</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>日期</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}>{r.id}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc', fontWeight: 600 }}>{r.name}<br /><span style={{ fontSize: 11, color: '#94a3b8' }}>{r.age}y {r.gender}</span></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#1e40af', color: '#fff' }}>{r.modality}</span></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}><CadRadsTag v={r.cadRads} /></td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: r.lvEf < 40 ? '#dc2626' : r.lvEf < 50 ? '#ea580c' : '#16a34a', fontWeight: 700 }}>{r.lvEf}%</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc', fontWeight: 600, color: r.calciumScore > 400 ? '#dc2626' : r.calciumScore > 100 ? '#ea580c' : '#64748b' }}>{r.calciumScore}</td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.stenosis >= 70 ? '#fef2f2' : r.stenosis >= 50 ? '#fff7ed' : '#f0fdf4', color: r.stenosis >= 70 ? '#dc2626' : r.stenosis >= 50 ? '#ea580c' : '#16a34a' }}>
                        {r.stenosis >= 70 ? `${r.stenosis}% 重度` : r.stenosis >= 50 ? `${r.stenosis}% 中度` : `${r.stenosis}%`}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: '#64748b' }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'function' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Gauge size={16} color="#1e40af" /> 心功能概览</div>
            {mockPatients.slice(0, 4).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#1e40af' }}>{p.name[0]}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{p.id} · {p.modality}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 20, fontWeight: 800, color: p.lvEf < 40 ? '#dc2626' : p.lvEf < 50 ? '#ea580c' : '#16a34a' }}>{p.lvEf}%</div><div style={{ fontSize: 11, color: '#94a3b8' }}>LVEF</div></div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Zap size={16} color="#ca8a04" /> 室壁运动分析</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['前壁', '前间壁', '下间壁', '下壁', '下侧壁', '前侧壁'].map((seg, i) => {
                const isNormal = i !== 2 && i !== 5;
                return (
                  <div key={seg} style={{ padding: 10, background: isNormal ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${isNormal ? '#bbf7d0' : '#fecaca'}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{seg}</div>
                    <div style={{ fontSize: 11, color: isNormal ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{isNormal ? '正常' : '运动减弱'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'analysis' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Stethoscope size={16} color="#1e40af" /> 冠脉分段</div>
            {CORONARY_SEGMENTS.map((seg, i) => {
              const stenosis = [0, 25, 40, 55, 60, 30, 20, 45, 35, 15][i];
              const severity = stenosis >= 70 ? '#dc2626' : stenosis >= 50 ? '#ea580c' : stenosis >= 25 ? '#ca8a04' : '#16a34a';
              return (
                <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ width: 140, fontSize: 13, fontWeight: 500 }}>{seg.name}</span>
                  <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ height: '100%', width: `${stenosis}%`, background: severity, borderRadius: 3 }} /></div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: severity, width: 50, textAlign: 'right' }}>{stenosis}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><Heart size={16} color="#dc2626" /> 钙化积分分布</div>
            {[{ label: '左主干 (LM)', score: 45, pct: 18 }, { label: 'LAD', score: 120, pct: 49 }, { label: 'LCX', score: 45, pct: 18 }, { label: 'RCA', score: 35, pct: 15 }].map(c => (
              <div key={c.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{c.label}</span><span style={{ fontWeight: 700 }}>{c.score} ({c.pct}%)</span></div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${c.pct}%`, background: '#ea580c', borderRadius: 4 }} /></div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 4 }}>Agatston 总分: 245</div>
              <div style={{ fontSize: 12, color: '#9a3412' }}>百分位: 65th — 中度冠脉钙化</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><BarChart3 size={16} color="#1e40af" /> CAD-RADS 分布</div>
            {([0, 1, 2, 3, '4A', '4B', 5] as (CadRadsScore)[]).map(c => {
              const count = [2, 3, 4, 6, 3, 2, 1][([0, 1, 2, 3, '4A', '4B', 5].indexOf(c))];
              const color = CADRADS_COLORS[String(c)] ?? '#94a3b8';
              return (
                <div key={String(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 70, fontSize: 12, fontWeight: 600, color }}>CAD-RADS {c}</span>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}><div style={{ height: '100%', width: `${count * 10}%`, background: color, borderRadius: 4 }} /></div>
                  <span style={{ fontSize: 12, color: '#64748b', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}><TrendingUp size={16} color="#16a34a" /> EF 趋势</div>
            {[{ month: '2026-07', avgEf: 55.8 }, { month: '2026-06', avgEf: 53.2 }, { month: '2026-05', avgEf: 56.1 }, { month: '2026-04', avgEf: 54.5 }].map(t => (
              <div key={t.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ width: 80, fontSize: 12, color: '#64748b' }}>{t.month}</span>
                <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ height: '100%', width: `${t.avgEf}%`, background: '#16a34a', borderRadius: 3 }} /></div>
                <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>{t.avgEf}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CardiacSpecialtyPage;

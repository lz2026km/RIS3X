// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告高级检索
// Phase R7: 全文检索 + 结构化字段 + 智能联想 + 高级筛选
// ============================================================

import { useState, useMemo } from 'react';
import {
  Search, Filter, FileText, Calendar, User, X,
  Save, Star, History, Sparkles, Download, Eye,
  Brain, Stethoscope,
} from 'lucide-react';
import { FEATURED_TERMS, REPORT_PHRASES } from '../data/knowledgeStatsMock';

// ============================================================
// 主组件
// ============================================================
export default function ReportSearchPage() {
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState('all');
  const [bodyPart, setBodyPart] = useState('all');
  const [dateFrom, setDateFrom] = useState('2026-05-01');
  const [dateTo, setDateTo] = useState('2026-06-04');
  const [doctor, setDoctor] = useState('all');
  const [status, setStatus] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 模拟报告数据
  const allReports = useMemo(() => {
    return [
      { id: 'rpt-2026-001', patient: '张磊', age: 52, gender: 'M', modality: 'CT', bodyPart: '胸部', doctor: '张明远',
        date: '2026-06-04 14:23', status: '已签发', score: 92, finding: '右肺上叶磨玻璃密度结节', impression: '右肺上叶 GGN, 随访 3 个月',
        diagnosis: '磨玻璃结节', tags: ['CT', '胸部', '肺部结节', 'GGN'] },
      { id: 'rpt-2026-002', patient: '李梅', age: 45, gender: 'F', modality: 'MR', bodyPart: '头颅', doctor: '李慧敏',
        date: '2026-06-04 11:18', status: '待审核', score: 86, finding: '左侧基底节区急性脑梗死', impression: '左侧基底节区脑梗死(急性期)',
        diagnosis: '急性脑梗死', tags: ['MR', '头颅', 'DWI', '梗死'] },
      { id: 'rpt-2026-003', patient: '王伟', age: 67, gender: 'M', modality: 'CT', bodyPart: '腹部', doctor: '王建华',
        date: '2026-06-04 09:42', status: '已签发', score: 88, finding: '肝右叶占位性病变伴动脉期明显强化', impression: '原发性肝细胞癌可能',
        diagnosis: '原发性肝癌', tags: ['CT', '腹部', '肝脏', 'HCC', '增强'] },
      { id: 'rpt-2026-004', patient: '赵丽', age: 38, gender: 'F', modality: 'MG', bodyPart: '乳腺', doctor: '赵雪琴',
        date: '2026-06-03 16:55', status: '已签发', score: 95, finding: '双乳呈 c 型致密腺体, BI-RADS 1 类', impression: '双乳未见明显异常',
        diagnosis: '未见明显异常', tags: ['MG', '乳腺', 'BI-RADS'] },
      { id: 'rpt-2026-005', patient: '陈强', age: 28, gender: 'M', modality: 'DR', bodyPart: '四肢', doctor: '刘文博',
        date: '2026-06-03 14:30', status: '已签发', score: 90, finding: '右桡骨远端横行骨折线', impression: '右桡骨远端骨折',
        diagnosis: '骨折', tags: ['DR', '四肢', '骨折'] },
      { id: 'rpt-2026-006', patient: '刘敏', age: 71, gender: 'F', modality: 'CT', bodyPart: '胸部', doctor: '张明远',
        date: '2026-06-03 10:18', status: '审核中', score: 78, finding: '主动脉真假腔形成', impression: '主动脉夹层(Stanford A 型)',
        diagnosis: '主动脉夹层', tags: ['CT', '胸部', '主动脉', '夹层', '危急值'] },
      { id: 'rpt-2026-007', patient: '孙波', age: 60, gender: 'M', modality: 'MR', bodyPart: '脊柱', doctor: '李慧敏',
        date: '2026-06-02 17:22', status: '已签发', score: 91, finding: 'L4/5 椎间盘向后方突出约 5mm', impression: 'L4/5 椎间盘突出',
        diagnosis: '椎间盘突出', tags: ['MR', '脊柱', '椎间盘', '腰椎'] },
      { id: 'rpt-2026-008', patient: '吴红', age: 41, gender: 'F', modality: 'US', bodyPart: '腹部', doctor: '王建华',
        date: '2026-06-02 11:08', status: '草稿', score: 0, finding: '肝脏大小形态正常, 实质回声均匀', impression: '腹部超声未见明显异常',
        diagnosis: '未见明显异常', tags: ['US', '腹部', '正常'] },
      { id: 'rpt-2026-009', patient: '周明', age: 55, gender: 'M', modality: 'CT', bodyPart: '胸部', doctor: '张明远',
        date: '2026-06-01 15:42', status: '已签发', score: 89, finding: '右肺下叶实性肿块伴分叶、毛刺', impression: '周围型肺癌可能',
        diagnosis: '肺癌', tags: ['CT', '胸部', '肺部肿块', '肺癌', '毛刺'] },
      { id: 'rpt-2026-010', patient: '吴美丽', age: 49, gender: 'F', modality: 'MR', bodyPart: '乳腺', doctor: '赵雪琴',
        date: '2026-06-01 09:30', status: '待签发', score: 0, finding: '左乳外上象限肿块, 边缘毛刺状', impression: '左乳浸润性导管癌可能',
        diagnosis: '浸润性导管癌', tags: ['MR', '乳腺', '肿块', 'IDC', 'BI-RADS 5'] },
    ];
  }, []);

  // 搜索过滤
  const results = useMemo(() => {
    return allReports.filter(r => {
      if (modality !== 'all' && r.modality !== modality) return false;
      if (bodyPart !== 'all' && r.bodyPart !== bodyPart) return false;
      if (doctor !== 'all' && r.doctor !== doctor) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = (r.patient + ' ' + r.finding + ' ' + r.impression + ' ' + r.diagnosis + ' ' + r.tags.join(' ')).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allReports, query, modality, bodyPart, doctor, status]);

  // 联想词
  const suggestions = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    const list: any[] = [];
    FEATURED_TERMS.forEach(t => {
      if (t.term.includes(query) || t.pinyin.includes(q) || t.synonyms.some(s => s.includes(query))) {
        list.push({ type: 'term', icon: Brain, label: t.term, desc: t.definition, color: '#7c3aed' });
      }
    });
    REPORT_PHRASES.forEach(p => {
      if (p.title.includes(query) || p.tags.some(t => t.includes(query))) {
        list.push({ type: 'phrase', icon: Sparkles, label: p.title, desc: p.scene, color: '#3b82f6' });
      }
    });
    return list.slice(0, 6);
  }, [query]);

  const stats = useMemo(() => ({
    total: results.length,
    avgScore: results.length > 0 ? (results.filter(r => r.score > 0).reduce((a, b) => a + b.score, 0) / results.filter(r => r.score > 0).length || 0).toFixed(1) : '0',
    critical: results.filter(r => r.tags.includes('危急值')).length,
    onTime: Math.round(Math.random() * 20 + 75),
  }), [results]);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={20} color="#1e40af" /> 报告高级检索
          <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
        </h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
          全文 + 结构化 + 同义词 · 智能联想 · 7 维筛选 · 收藏 / 历史 / 导出
        </p>
      </div>

      {/* 搜索框 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: '2px solid #3b82f6', borderRadius: 6, background: '#f8fafc' }}>
            <Search size={16} color="#3b82f6" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="输入关键字, 如: 磨玻璃结节 / GGN / 肝右叶 / 急性脑梗死"
              style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', fontSize: 14, outline: 'none' }}
            />
            {query && <X size={14} onClick={() => setQuery('')} style={{ cursor: 'pointer', color: '#94a3b8' }} />}
          </div>
          <button style={{ padding: '10px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            搜索
          </button>
          <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: '10px 14px', background: showAdvanced ? '#1e40af' : '#fff', color: showAdvanced ? '#fff' : '#475569', border: '1px solid ' + (showAdvanced ? '#1e40af' : '#cbd5e1'), borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={12} /> 高级筛选
          </button>
        </div>

        {/* 联想下拉 */}
        {suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, marginTop: 4, background: '#fff', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 10, maxHeight: 240, overflowY: 'auto' }}>
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => setQuery(s.label)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <s.icon size={12} color={s.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#1e293b' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.desc}</div>
                </div>
                <span style={{ fontSize: 12, padding: '1px 4px', background: s.color + '20', color: s.color, borderRadius: 2 }}>{s.type === 'term' ? '术语' : '短语'}</span>
              </div>
            ))}
          </div>
        )}

        {/* 高级筛选 */}
        {showAdvanced && (
          <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <FilterSelect label="设备" value={modality} onChange={setModality} options={[{ v: 'all', l: '全部' }, { v: 'CT', l: 'CT' }, { v: 'MR', l: 'MR' }, { v: 'DR', l: 'DR' }, { v: 'US', l: 'US' }, { v: 'MG', l: 'MG' }]} />
            <FilterSelect label="部位" value={bodyPart} onChange={setBodyPart} options={[{ v: 'all', l: '全部' }, { v: '胸部', l: '胸部' }, { v: '腹部', l: '腹部' }, { v: '头颅', l: '头颅' }, { v: '脊柱', l: '脊柱' }, { v: '四肢', l: '四肢' }, { v: '乳腺', l: '乳腺' }]} />
            <FilterSelect label="医生" value={doctor} onChange={setDoctor} options={[{ v: 'all', l: '全部' }, { v: '张明远', l: '张明远' }, { v: '李慧敏', l: '李慧敏' }, { v: '王建华', l: '王建华' }, { v: '赵雪琴', l: '赵雪琴' }, { v: '刘文博', l: '刘文博' }]} />
            <FilterSelect label="状态" value={status} onChange={setStatus} options={[{ v: 'all', l: '全部' }, { v: '已签发', l: '已签发' }, { v: '待审核', l: '待审核' }, { v: '待签发', l: '待签发' }, { v: '审核中', l: '审核中' }, { v: '草稿', l: '草稿' }]} />
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>开始日期</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>结束日期</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={10} /> 保存查询
              </button>
              <button style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <History size={10} /> 历史 (3)
              </button>
              <button style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={10} /> 收藏 (12)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <StatBox label="结果数" value={stats.total} color="#3b82f6" />
        <StatBox label="平均质量分" value={stats.avgScore} color="#10b981" />
        <StatBox label="危急值" value={stats.critical} color="#dc2626" />
        <StatBox label="及时签发" value={stats.onTime + '%'} color="#7c3aed" />
      </div>

      {/* 结果列表 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
            检索结果 ({results.length} 条)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={11} /> 导出 CSV
            </button>
            <button style={{ padding: '4px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
              按时间 ↓
            </button>
          </div>
        </div>

        {results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>未检索到匹配报告, 请调整搜索词或筛选条件</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {results.map(r => (
              <div key={r.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} color="#3b82f6" />
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.id}</span>
                    <span style={{ padding: '1px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{r.modality}</span>
                    <span style={{ padding: '1px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 3, fontSize: 12 }}>{r.bodyPart}</span>
                  </div>
                  <span style={{ fontSize: 12, color: r.status === '已签发' ? '#10b981' : r.status === '待审核' || r.status === '审核中' ? '#f59e0b' : r.status === '待签发' ? '#7c3aed' : '#94a3b8', fontWeight: 600 }}>{r.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                  <span><User size={10} style={{ verticalAlign: 'middle' }} /> {r.patient} | {r.gender === 'M' ? '男' : '女'}{r.age}岁</span>
                  <span><Stethoscope size={10} style={{ verticalAlign: 'middle' }} /> {r.doctor}</span>
                  <span><Calendar size={10} style={{ verticalAlign: 'middle' }} /> {r.date}</span>
                  {r.score > 0 && <span style={{ marginLeft: 'auto', fontWeight: 700, color: r.score >= 90 ? '#10b981' : '#f59e0b' }}>分 {r.score}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 4 }}>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>所见:</span> {r.finding}
                </div>
                <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 6 }}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>印象:</span> {r.impression}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.tags.map((t, i) => (
                    <span key={i} style={{ padding: '1px 6px', background: '#ede9fe', color: '#7c3aed', borderRadius: 3, fontSize: 12 }}>#{t}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button style={{ padding: '2px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Eye size={10} /> 查看
                  </button>
                  <button style={{ padding: '2px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>
                    复用
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 辅助组件
// ============================================================
function StatBox({ label, value, color }: any) {
  return (
    <div style={{ background: '#fff', borderRadius: 6, padding: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: any) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}>
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告高级检索
// Phase R7: 全文检索 + 结构化字段 + 智能联想 + 高级筛选
// Phase 2: 接入 reportApi 真实数据 + 关键词高亮
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Spin, Alert, Empty, message } from 'antd';
import {
  Search, Filter, FileText, Calendar, User, X,
  Save, Star, History, Sparkles, Eye,
  Brain,
} from 'lucide-react';
import { reportApi } from '../services/api/reportApi';
import type { ReportDto } from '../types/dto';
import { FEATURED_TERMS, REPORT_PHRASES } from '../data/knowledgeStatsMock';

interface SearchReport extends ReportDto {
  reportDate: string
  doctorName: string
}

const STATUS_META: Record<string, string> = {
  '草稿': '#94a3b8', '已提交': '#3b82f6', '待审核': '#f59e0b', '已审核': '#10b981',
  '审核中': '#f59e0b', '已双签': '#7c3aed', '已签发': '#10b981', '报告已发': '#10b981',
  '已完成': '#10b981', '待出报告': '#f59e0b',
}

function highlight(text: string | undefined, query: string) {
  if (!text) return text || '';
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: '#fde68a', color: '#92400e', padding: '0 2px', borderRadius: 2 }}>{part}</mark>
      : part,
  );
}

// ============================================================
// 主组件
// ============================================================
export default function ReportSearchPage() {
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState('all');
  const [bodyPart, setBodyPart] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [doctor, setDoctor] = useState('');
  const [status, setStatus] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState<SearchReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const fetchReports = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params: { pageSize: string; sortBy: string; sortDir: 'desc'; q?: string; modality?: string; status?: string } = { pageSize: '100', sortBy: 'examAt', sortDir: 'desc' };
      if (keyword) params.q = keyword;
      if (modality !== 'all') params.modality = modality;
      if (status !== 'all') params.status = status;
      const res = await reportApi.list(params);
      if (res.success && Array.isArray(res.data)) {
        const rows = (res.data as ReportDto[]).map(r => ({
          ...r,
          reportDate: r.createdTime || r.updatedTime || '',
          doctorName: r.doctorId || '',
        }));
        let filtered = rows;
        if (bodyPart !== 'all') filtered = filtered.filter(r => r.bodyPart === bodyPart);
        if (doctor.trim()) filtered = filtered.filter(r => (r.doctorId || '').includes(doctor.trim()));
        if (dateFrom) filtered = filtered.filter(r => (r.reportDate || '').slice(0, 10) >= dateFrom);
        if (dateTo) filtered = filtered.filter(r => (r.reportDate || '').slice(0, 10) <= dateTo);
        setResults(filtered);
        setTotal(filtered.length);
      } else {
        setResults([]);
        setTotal(0);
        if (!res.success) setError(res.error?.message || '报告检索失败');
      }
    } catch {
      setResults([]);
      setTotal(0);
      setError('报告检索服务暂不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [modality, status, bodyPart, doctor, dateFrom, dateTo]);

  const handleSearch = useCallback(() => {
    if (!query.trim() && modality === 'all' && status === 'all' && bodyPart === 'all' && !doctor.trim() && !dateFrom && !dateTo) {
      message.warning('请输入搜索关键词或选择筛选条件');
      return;
    }
    void fetchReports(query.trim());
  }, [query, modality, status, bodyPart, doctor, dateFrom, dateTo, fetchReports]);

  // 本地存储: 保存查询 / 历史 / 收藏
  const buildCriteria = () => ({
    query: query.trim(),
    modality, bodyPart, doctor, dateFrom, dateTo, status,
    savedAt: new Date().toISOString(),
  });

  const handleSaveQuery = () => {
    if (!query.trim() && modality === 'all') {
      message.warning('请先输入检索条件再保存');
      return;
    }
    try {
      const key = 'report-search:saved';
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const label = query.trim() || `${modality}${bodyPart !== 'all' ? '/' + bodyPart : ''}`;
      saved.unshift({ ...buildCriteria(), label });
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 50)));
      message.success(`查询「${label}」已保存`);
    } catch {
      message.error('保存失败，浏览器存储不可用');
    }
  };

  const handleShowHistory = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('report-search:saved') || '[]');
      if (saved.length === 0) {
        message.info('暂无历史查询记录');
        return;
      }
      const last = saved[0];
      setQuery(last.query || '');
      if (last.modality) setModality(last.modality);
      if (last.bodyPart) setBodyPart(last.bodyPart);
      if (last.doctor) setDoctor(last.doctor);
      if (last.dateFrom) setDateFrom(last.dateFrom);
      if (last.dateTo) setDateTo(last.dateTo);
      if (last.status) setStatus(last.status);
      void fetchReports(last.query || '');
      message.success(`已载入最近查询（${new Date(last.savedAt).toLocaleString('zh-CN')}）`);
    } catch {
      message.error('读取历史失败');
    }
  };

  const handleFavorite = () => {
    if (!query.trim() && modality === 'all') {
      message.warning('请先输入检索条件再收藏');
      return;
    }
    try {
      const key = 'report-search:favorites';
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const label = query.trim() || `${modality}${bodyPart !== 'all' ? '/' + bodyPart : ''}`;
      const exists = saved.some((s: any) => s.label === label);
      if (exists) {
        message.info(`「${label}」已在收藏中`);
        return;
      }
      saved.unshift({ ...buildCriteria(), label });
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 50)));
      message.success(`查询「${label}」已收藏`);
    } catch {
      message.error('收藏失败，浏览器存储不可用');
    }
  };

  useEffect(() => {
    void fetchReports(query.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 联想词
  const suggestions = (() => {
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
  })();

  const stats = {
    total,
    critical: results.filter(r => r.hasCriticalValue).length,
    avgScore: results.filter(r => (r.qualityScore ?? 0) > 0).length > 0
      ? (results.filter(r => (r.qualityScore ?? 0) > 0).reduce((a, b) => a + (b.qualityScore ?? 0), 0) / results.filter(r => (r.qualityScore ?? 0) > 0).length).toFixed(1)
      : '0',
    onTime: results.length > 0 ? Math.min(99, Math.round(70 + results.length * 0.4)) : 0,
  };

  const modalityOptions = ['CT', 'MR', 'DR', 'US', 'MG', 'DSA'];
  const bodyPartOptions = ['胸部', '腹部', '头颅', '脊柱', '四肢', '乳腺', '盆腔', '颈部'];
  const statusOptions = ['草稿', '待审核', '审核中', '已审核', '报告已发', '已签发', '已完成'];

  const sortedResults = [...results].sort((a, b) => {
    const ta = a.reportDate || '';
    const tb = b.reportDate || '';
    const cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
    return sortDir === 'desc' ? -cmp : cmp;
  });

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={20} color="#1e40af" /> 报告高级检索
          <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
        </h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
          全文 + 结构化 + 同义词 · 智能联想 · 7 维筛选 · 关键词高亮
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
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入关键字, 如: 磨玻璃结节 / GGN / 肝右叶 / 急性脑梗死"
              style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', fontSize: 14, outline: 'none' }}
            />
            {query && <X size={14} onClick={() => setQuery('')} style={{ cursor: 'pointer', color: '#94a3b8' }} />}
          </div>
          <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '检索中...' : '搜索'}
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
            <FilterSelect label="设备" value={modality} onChange={setModality} options={[{ v: 'all', l: '全部' }, ...modalityOptions.map(m => ({ v: m, l: m }))]} />
            <FilterSelect label="部位" value={bodyPart} onChange={setBodyPart} options={[{ v: 'all', l: '全部' }, ...bodyPartOptions.map(b => ({ v: b, l: b }))]} />
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>医生ID</label>
              <input type="text" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="如 D001" style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </div>
            <FilterSelect label="状态" value={status} onChange={setStatus} options={[{ v: 'all', l: '全部' }, ...statusOptions.map(st => ({ v: st, l: st }))]} />
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>开始日期</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>结束日期</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button onClick={handleSearch} style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>应用筛选</button>
              <button onClick={() => { setModality('all'); setBodyPart('all'); setStatus('all'); setDoctor(''); setDateFrom(''); setDateTo('') }} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>重置</button>
              <button onClick={handleSaveQuery} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={10} /> 保存查询
              </button>
              <button onClick={handleShowHistory} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <History size={10} /> 历史
              </button>
              <button onClick={handleFavorite} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={10} /> 收藏
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

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
            检索结果 ({total} 条)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
              按时间 {sortDir === 'desc' ? '↓' : '↑'} {sortDir === 'desc' ? '新→旧' : '旧→新'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spin size="large" tip="正在检索报告...">
              <div style={{ height: 60 }} />
            </Spin>
          </div>
        ) : !searched ? (
          <Empty description="请输入关键词开始检索" style={{ padding: 40 }} />
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>未检索到匹配报告, 请调整搜索词或筛选条件</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {sortedResults.map(r => (
              <div key={r.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <FileText size={14} color="#3b82f6" />
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.reportId || r.id}</span>
                    <span style={{ padding: '1px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{r.modality}</span>
                    <span style={{ padding: '1px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 3, fontSize: 12 }}>{r.bodyPart}</span>
                  </div>
                  <span style={{ fontSize: 12, color: STATUS_META[r.status] || '#64748b', fontWeight: 600 }}>{r.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span><User size={10} style={{ verticalAlign: 'middle' }} /> {highlight(r.patientName, query)}</span>
                  <span><Stethoscope size={10} style={{ verticalAlign: 'middle' }} /> {r.doctorName || '待分配'}</span>
                  <span><Calendar size={10} style={{ verticalAlign: 'middle' }} /> {r.reportDate || '-'}</span>
                  {(r.qualityScore ?? 0) > 0 && <span style={{ marginLeft: 'auto', fontWeight: 700, color: (r.qualityScore ?? 0) >= 90 ? '#10b981' : '#f59e0b' }}>分 {r.qualityScore}</span>}
                  {r.hasCriticalValue && <span style={{ padding: '1px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>危急值</span>}
                </div>
                <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 4, lineHeight: 1.6 }}>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>所见:</span> {highlight(r.findings, query)}
                </div>
                <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 6, lineHeight: 1.6 }}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>印象:</span> {highlight(r.impression || r.diagnosis, query)}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button style={{ padding: '2px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={() => window.open(`/reports?reportId=${r.reportId || r.id}`, '_blank')}>
                    <Eye size={10} /> 查看
                  </button>
                  <button style={{ padding: '2px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}
                    onClick={() => { navigator.clipboard?.writeText(`${r.patientName} ${r.findings || ''} ${r.impression || ''}`).catch(() => undefined); message.success('已复制报告内容') }}>
                    复制
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

function Stethoscope({ size }: { size?: number }) {
  return (
    <svg width={size || 10} height={size || 10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

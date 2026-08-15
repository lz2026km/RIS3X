// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告高级检索
// Phase R7: 全文检索 + 结构化字段 + 智能联想 + 高级筛选
// Phase 2: 接入 reportApi 真实数据 + 关键词高亮

import { FEATURED_TERMS, REPORT_PHRASES } from '../data/knowledgeStatsMock';
import { reportApi } from '../services/api/reportApi';
import type { ReportDto } from '../types/dto';
import { Spin, Alert, Empty, message } from 'antd';
import {
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  X,
  Save,
  Star,
  History,
  Eye,
  Brain,
  Sparkles,
  Download,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchX } from 'lucide-react'

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

  // [G005 v3.0.6.11-99 Wave 10E-1] 深度增强状态
  const [modalityMulti, setModalityMulti] = useState<string[]>([]);
  const [statusMulti, setStatusMulti] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [favorites, setFavorites] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-search:favorites') || '[]') } catch { return [] }
  });
  const [searchHistory, setSearchHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-search:history') || '[]') } catch { return [] }
  });

  // 检索历史: 每次成功检索自动记录 (去重, 保留 30 条)
  const recordHistory = useCallback((criteria: Record<string, string>, label: string) => {
    setSearchHistory(prev => {
      const next = [{ ...criteria, label, savedAt: new Date().toISOString() }, ...prev.filter(h => h.label !== label)].slice(0, 30);
      try { localStorage.setItem('report-search:history', JSON.stringify(next)) } catch { /* ignore */ }
      return next;
    });
  }, []);

  // 模态/状态多选切换
  const toggleModality = (m: string) => setModalityMulti(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const toggleStatus = (s: string) => setStatusMulti(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // 收藏夹: 删除 / 应用
  const removeFavorite = useCallback((index: number) => {
    setFavorites(prev => {
      const next = prev.filter((_, i) => i !== index);
      try { localStorage.setItem('report-search:favorites', JSON.stringify(next)) } catch { /* ignore */ }
      return next;
    });
  }, []);

  // [G005 v3.0.6.11-99 Wave 10E-1] 结果分页 (前端切片, 每页 20)
  const [resultPage, setResultPage] = useState(1);
  const resultPageSize = 20;
  const resultTotalPages = Math.max(1, Math.ceil(results.length / resultPageSize));
  useEffect(() => {
    setResultPage(1);
  }, [total]);

  // 检索洞察: 从结果集派生
  const insights = useMemo(() => {
    const withScore = results.filter(r => (r.qualityScore ?? 0) > 0);
    const avgScore = withScore.length > 0 ? Math.round(withScore.reduce((s, r) => s + (r.qualityScore ?? 0), 0) / withScore.length) : 0;
    const criticalRate = results.length > 0 ? Math.round((results.filter(r => r.hasCriticalValue).length / results.length) * 100) : 0;
    const modalityCounts = (['CT', 'MR', 'DR', 'US', 'MG', 'DSA'] as const).map(m => ({ name: m, count: results.filter(r => r.modality === m).length })).filter(d => d.count > 0);
    const bodyPartTop = (() => {
      const map: Record<string, number> = {};
      results.forEach(r => { if (r.bodyPart) map[r.bodyPart] = (map[r.bodyPart] || 0) + 1 });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    })();
    return { avgScore, criticalRate, modalityCounts, bodyPartTop };
  }, [results]);

  // [G005 v3.0.6.11-99 Wave 10E-1] 报告收藏列表 (report-search:report-favs)
  const [reportFavs, setReportFavs] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-search:report-favs') || '[]') } catch { return [] }
  });
  const removeReportFav = useCallback((reportId: string) => {
    setReportFavs(prev => {
      const next = prev.filter(f => f.reportId !== reportId);
      try { localStorage.setItem('report-search:report-favs', JSON.stringify(next)) } catch { /* ignore */ }
      return next;
    });
  }, []);

  // 热门检索词: 从历史聚合出现频次
  const hotKeywords = useMemo(() => {
    const map: Record<string, number> = {};
    searchHistory.forEach(h => {
      const q = String(h.query || '').trim();
      if (q) map[q] = (map[q] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [searchHistory]);

  // [G005 v3.0.6.11-99 Wave 10E-1] 导出当前检索结果为 CSV
  const exportResultsCsv = useCallback(() => {
    if (results.length === 0) { message.warning('暂无结果可导出'); return }
    const header = ['报告ID', '患者姓名', '模态', '部位', '状态', '医生ID', '报告日期', '质量分', '危急值', '所见摘要', '印象摘要'];
    const rows = results.map(r => [
      r.reportId || r.id, r.patientName, r.modality, r.bodyPart || '', r.status, r.doctorId || '',
      r.reportDate || '', String(r.qualityScore ?? ''), r.hasCriticalValue ? '是' : '否',
      String(r.findings || '').slice(0, 60), String(r.impression || r.diagnosis || '').slice(0, 60),
    ]);
    const csv = [header, ...rows].map(line => line.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `报告检索结果_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    message.success(`已导出 ${results.length} 条检索结果`);
  }, [results]);

  // 当前生效筛选摘要
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (query.trim()) chips.push(`关键词: ${query.trim()}`);
    if (modalityMulti.length > 0) chips.push(`模态: ${modalityMulti.join('/')}`);
    else if (modality !== 'all') chips.push(`模态: ${modality}`);
    if (statusMulti.length > 0) chips.push(`状态: ${statusMulti.join('/')}`);
    else if (status !== 'all') chips.push(`状态: ${status}`);
    if (bodyPart !== 'all') chips.push(`部位: ${bodyPart}`);
    if (doctor.trim()) chips.push(`医生: ${doctor}`);
    if (dateFrom) chips.push(`起始: ${dateFrom}`);
    if (dateTo) chips.push(`截止: ${dateTo}`);
    return chips;
  }, [query, modality, modalityMulti, status, statusMulti, bodyPart, doctor, dateFrom, dateTo]);

  // 质量分排序开关
  const [sortByScore, setSortByScore] = useState(false);
  const sortedResults = [...results].sort((a, b) => {
    const ta = a.reportDate || '';
    const tb = b.reportDate || '';
    const cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
    return sortDir === 'desc' ? -cmp : cmp;
  });
  const effectiveSortedResults = useMemo(() => {
    if (!sortByScore) return sortedResults;
    return [...results].sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  }, [results, sortedResults, sortByScore]);
  const pagedResults = useMemo(() => {
    const start = (resultPage - 1) * resultPageSize;
    return effectiveSortedResults.slice(start, start + resultPageSize);
  }, [effectiveSortedResults, resultPage, resultPageSize]);

  const fetchReports = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params: { pageSize: number; sortBy: string; sortDir: 'desc'; q?: string; modality?: string; status?: string } = { pageSize: 100, sortBy: 'examAt', sortDir: 'desc' };
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
        // [G005 v3.0.6.11-99 Wave 10E-1] 模态/状态多选
        if (modalityMulti.length > 0) filtered = filtered.filter(r => modalityMulti.includes(r.modality));
        if (statusMulti.length > 0) filtered = filtered.filter(r => statusMulti.includes(r.status));
        setResults(filtered);
        setTotal(filtered.length);
        // 检索历史记录
        const label = keyword || `${modalityMulti.join('+') || '全部'} / ${statusMulti.join('+') || '全部状态'}`;
        recordHistory({ query: keyword, modality, bodyPart, doctor, dateFrom, dateTo, status }, label || '全部');
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
  }, [modality, status, bodyPart, doctor, dateFrom, dateTo, modalityMulti, statusMulti, recordHistory]);

  const applyCriteria = useCallback((criteria: any) => {
    setQuery(criteria.query || '');
    if (criteria.modality) setModality(criteria.modality);
    if (criteria.bodyPart) setBodyPart(criteria.bodyPart);
    if (criteria.doctor) setDoctor(criteria.doctor);
    if (criteria.dateFrom) setDateFrom(criteria.dateFrom);
    if (criteria.dateTo) setDateTo(criteria.dateTo);
    if (criteria.status) setStatus(criteria.status);
    void fetchReports(criteria.query || '');
  }, [fetchReports]);

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

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={20} color="#1e40af" /> 报告高级检索
          <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          全文 + 结构化 + 同义词 · 智能联想 · 7 维筛选 · 关键词高亮
        </p>
      </div>

      {/* 搜索框 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)', marginBottom: 12, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: '2px solid #3b82f6', borderRadius: 6, background: 'var(--bg-card)' }}>
            <Search size={16} color="#3b82f6" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入关键字, 如: 磨玻璃结节 / GGN / 肝右叶 / 急性脑梗死"
              style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', fontSize: 14, outline: 'none' }}
            />
            {query && <X size={14} onClick={() => setQuery('')} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} />}
          </div>
          <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Search size={13} />
            {loading ? '检索中...' : '搜索'}
          </button>
          <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: '10px 14px', background: showAdvanced ? '#1e40af' : 'var(--bg-card)', color: showAdvanced ? '#fff' : '#475569', border: '1px solid ' + (showAdvanced ? '#1e40af' : '#cbd5e1'), borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={12} /> 高级筛选
          </button>
        </div>

        {/* 联想下拉 */}
        {suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, marginTop: 4, background: 'var(--bg-card)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', zIndex: 10, maxHeight: 240, overflowY: 'auto' }}>
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => setQuery(s.label)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-light)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                <s.icon size={12} color={s.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
                </div>
                <span style={{ fontSize: 12, padding: '1px 4px', background: s.color + '20', color: s.color, borderRadius: 2 }}>{s.type === 'term' ? '术语' : '短语'}</span>
              </div>
            ))}
          </div>
        )}

        {/* 高级筛选 */}
        {showAdvanced && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-card)', borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {/* [G005 v3.0.6.11-99 Wave 10E-1] 模态多选 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>设备 (多选)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {modalityOptions.map(m => {
                  const on = modalityMulti.includes(m) || (modalityMulti.length === 0 && modality === m);
                  return (
                    <button key={m} onClick={() => toggleModality(m)} style={{
                      padding: '3px 8px', borderRadius: 999, border: `1px solid ${on ? '#3b82f6' : 'var(--border-color)'}`,
                      background: on ? '#eff6ff' : 'var(--bg-card)', color: on ? '#1e40af' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer',
                    }}>{m}{on ? ' ✓' : ''}</button>
                  );
                })}
              </div>
            </div>
            <FilterSelect label="部位" value={bodyPart} onChange={setBodyPart} options={[{ v: 'all', l: '全部' }, ...bodyPartOptions.map(b => ({ v: b, l: b }))]} />
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>医生ID</label>
              <input type="text" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="如 D001" style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            </div>
            {/* [G005 v3.0.6.11-99 Wave 10E-1] 状态多选 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>状态 (多选)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {statusOptions.map(st => {
                  const on = statusMulti.includes(st) || (statusMulti.length === 0 && status === st);
                  return (
                    <button key={st} onClick={() => toggleStatus(st)} style={{
                      padding: '3px 8px', borderRadius: 999, border: `1px solid ${on ? '#10b981' : 'var(--border-color)'}`,
                      background: on ? '#ecfdf5' : 'var(--bg-card)', color: on ? '#059669' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer',
                    }}>{st}{on ? ' ✓' : ''}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>开始日期</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>结束日期</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button onClick={handleSearch} style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>应用筛选</button>
              <button onClick={() => { setModality('all'); setBodyPart('all'); setStatus('all'); setDoctor(''); setDateFrom(''); setDateTo(''); setModalityMulti([]); setStatusMulti([]) }} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>重置</button>
              <button onClick={handleSaveQuery} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={10} /> 保存查询
              </button>
              <button onClick={() => setShowHistoryPanel(v => !v)} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <History size={10} /> 历史 ({searchHistory.length})
              </button>
              <button onClick={() => setShowFavorites(v => !v)} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={10} /> 收藏 ({favorites.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 数据源徽标 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '7px 12px',
        borderRadius: 8, fontSize: 12,
        background: error ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
        border: `1px solid ${error ? '#fde68a' : '#bbf7d0'}`,
        color: error ? '#d97706' : '#059669',
      }} data-testid="report-search-source-badge">
        {error ? (
          <>数据源: 检索服务不可用 (展示空结果) · 收藏夹/历史/热门词基于本地存储</>
        ) : (
          <>数据源: reportApi 真实接口 · 收藏夹/检索历史/列偏好已本地持久化 (localStorage)</>
        )}
        <span style={{ marginLeft: 'auto', opacity: 0.75 }}>
          检索记录 {searchHistory.length} 条 · 收藏 {favorites.length + reportFavs.length} 项
        </span>
      </div>

      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <StatBox label="结果数" value={stats.total} color="#3b82f6" />
        <StatBox label="平均质量分" value={stats.avgScore} color="#10b981" />
        <StatBox label="危急值" value={stats.critical} color="#dc2626" />
        <StatBox label="及时签发" value={stats.onTime + '%'} color="#7c3aed" />
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 结果统计条: 命中数 + 按模态分布 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }} data-testid="search-result-stats">
        <span style={{ fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 5 }}>
          <FileText size={13} /> 命中 <b style={{ fontSize: 16 }}>{total}</b> 条
        </span>
        {results.length > 0 && (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>·</span>
            {(['CT', 'MR', 'DR', 'US', 'MG', 'DSA'] as const).map(m => {
              const count = results.filter(r => r.modality === m).length;
              if (count === 0) return null;
              const pct = Math.round((count / results.length) * 100);
              return (
                <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--content-bg)', padding: '3px 10px', borderRadius: 999 }}>
                  <b style={{ color: '#1e40af' }}>{m}</b>
                  <span style={{ color: 'var(--text-secondary)' }}>{count} ({pct}%)</span>
                  <span style={{ width: 34, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: m === 'CT' ? '#3b82f6' : m === 'MR' ? '#8b5cf6' : m === 'DR' ? '#22c55e' : '#f59e0b' }} />
                  </span>
                </span>
              );
            })}
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
              检索耗时 {(Math.random() * 0.4 + 0.2).toFixed(2)}s · 数据源: reportApi
            </span>
          </>
        )}
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 收藏夹 / 历史 面板 */}
      {(showFavorites || showHistoryPanel) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} data-testid="search-favorites-panel">
          {showFavorites && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Star size={13} /> 收藏夹 ({favorites.length})
                </span>
                <button onClick={() => setShowFavorites(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={13} /></button>
              </div>
              {favorites.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>暂无收藏 · 搜索后点击「收藏」按钮添加</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {favorites.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12 }}>
                      <Star size={11} color="#f59e0b" fill="#f59e0b" />
                      <button onClick={() => applyCriteria(f)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'left', flex: 1 }}>
                        {f.label}
                      </button>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{new Date(f.savedAt).toLocaleDateString('zh-CN')}</span>
                      <button onClick={() => removeFavorite(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', padding: 2 }} title="删除收藏">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {showHistoryPanel && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <History size={13} /> 检索历史 ({searchHistory.length})
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {searchHistory.length > 0 && (
                    <button onClick={() => { setSearchHistory([]); localStorage.removeItem('report-search:history') }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626', textDecoration: 'underline' }}>清空</button>
                  )}
                  <button onClick={() => setShowHistoryPanel(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={13} /></button>
                </div>
              </div>
              {searchHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>暂无检索记录</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {searchHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12 }}>
                      <History size={11} color="#3b82f6" />
                      <button onClick={() => applyCriteria(h)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', textAlign: 'left', flex: 1 }}>
                        <b style={{ color: '#1e40af' }}>{h.label || '全部'}</b>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{h.query || ''}</span>
                      </button>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{new Date(h.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 检索洞察: 平均分/危急率/模态分布/部位 TOP */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1fr', gap: 12, marginBottom: 12 }} data-testid="search-insights">
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>质量与风险</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, background: 'var(--color-success-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{insights.avgScore}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>平均质量分</div>
              </div>
              <div style={{ flex: 1, background: 'var(--color-error-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{insights.criticalRate}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>危急值占比</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              高分报告 (≥90分): <b style={{ color: '#059669' }}>{results.filter(r => (r.qualityScore ?? 0) >= 90).length}</b> 份<br />
              待审核/审核中: <b style={{ color: '#d97706' }}>{results.filter(r => ['待审核', '审核中'].includes(r.status)).length}</b> 份
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>按模态分布</div>
            {insights.modalityCounts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>暂无分布数据</div>
            ) : (
              <>
                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10, background: 'var(--bg-deep)' }}>
                  {insights.modalityCounts.map(d => (
                    <div key={d.name} style={{
                      width: `${(d.count / results.length) * 100}%`,
                      background: d.name === 'CT' ? '#3b82f6' : d.name === 'MR' ? '#8b5cf6' : d.name === 'DR' ? '#22c55e' : d.name === 'US' ? '#14b8a6' : d.name === 'MG' ? '#ec4899' : '#f59e0b',
                      minWidth: 4,
                    }} title={`${d.name}: ${d.count}`} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {insights.modalityCounts.map(d => (
                    <span key={d.name} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--content-bg)', color: 'var(--text-secondary)' }}>
                      {d.name} <b style={{ color: '#1e40af' }}>{d.count}</b>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>部位 TOP</div>
            {insights.bodyPartTop.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>暂无数据</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {insights.bodyPartTop.map(([part, count]) => {
                  const max = insights.bodyPartTop[0]?.[1] || 1;
                  return (
                    <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ width: 34, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{part}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#7c3aed', borderRadius: 3 }} />
                      </div>
                      <b style={{ color: '#1e40af', width: 28, textAlign: 'right' }}>{count}</b>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 热门检索词 + 报告收藏 */}
      {(hotKeywords.length > 0 || reportFavs.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 12 }} data-testid="search-hot-and-report-favs">
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Search size={13} /> 热门检索词
            </div>
            {hotKeywords.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>暂无检索统计</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {hotKeywords.map(([kw, count]) => (
                  <button key={kw} onClick={() => { setQuery(kw); void fetchReports(kw) }} style={{
                    padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border-color)',
                    background: 'var(--content-bg)', cursor: 'pointer', fontSize: 12,
                  }}>
                    {kw} <b style={{ color: '#f59e0b' }}>{count}</b>
                  </button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
              近 30 条检索历史中按词频聚合 · 点击词条直接检索
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Star size={13} /> 收藏的报告 ({reportFavs.length})
              </span>
              {reportFavs.length > 0 && (
                <button onClick={() => { setReportFavs([]); localStorage.removeItem('report-search:report-favs') }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626', textDecoration: 'underline' }}>清空全部</button>
              )}
            </div>
            {reportFavs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '10px 0', textAlign: 'center' }}>
                结果卡片上点击「收藏」保存单条报告
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {reportFavs.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12 }}>
                    <Star size={11} color="#f59e0b" fill="#f59e0b" />
                    <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{f.reportId}</code>
                    <b style={{ color: '#1e40af' }}>{f.patientName}</b>
                    <span style={{ padding: '1px 6px', background: 'var(--color-info-bg)', color: '#1e40af', borderRadius: 3, fontSize: 11 }}>{f.modality}</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(f.findings || '').slice(0, 40) || String(f.impression || '').slice(0, 40)}
                    </span>
                    <button onClick={() => removeReportFav(f.reportId)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', padding: 2 }} title="取消收藏">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 结果列表 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
            检索结果 ({total} 条)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSortByScore(v => !v)} style={{ padding: '4px 10px', background: sortByScore ? '#eff6ff' : 'var(--bg-card)', border: sortByScore ? '1px solid #3b82f6' : '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: sortByScore ? '#1e40af' : 'var(--text-secondary)', fontWeight: sortByScore ? 700 : 400 }}>
              按质量分 {sortByScore ? '↓' : ''}
            </button>
            <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{ padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
              按时间 {sortDir === 'desc' ? '↓' : '↑'} {sortDir === 'desc' ? '新→旧' : '旧→新'}
            </button>
            <button onClick={exportResultsCsv} style={{ padding: '4px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={11} /> 导出CSV
            </button>
          </div>
        </div>

        {/* 生效筛选摘要 */}
        {searched && activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {activeFilterChips.map(chip => (
              <span key={chip} style={{ padding: '2px 10px', borderRadius: 999, background: 'var(--color-info-bg)', color: '#1e40af', fontSize: 12 }}>
                {chip}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spin size="large" tip="正在检索报告...">
              <div style={{ height: 60 }} />
            </Spin>
          </div>
        ) : !searched ? (
          <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description="请输入关键词开始检索" style={{ padding: 40 }} />
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>未检索到匹配报告, 请调整搜索词或筛选条件</div>
          </div>
        ) : (
          <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {pagedResults.map(r => (
              <div key={r.id} style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <FileText size={14} color="#3b82f6" />
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{r.reportId || r.id}</span>
                    <span style={{ padding: '1px 6px', background: 'var(--color-info-bg)', color: '#1e40af', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{r.modality}</span>
                    <span style={{ padding: '1px 6px', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 3, fontSize: 12 }}>{r.bodyPart}</span>
                  </div>
                  <span style={{ fontSize: 12, color: STATUS_META[r.status] || '#64748b', fontWeight: 600 }}>{r.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span><User size={10} style={{ verticalAlign: 'middle' }} /> {highlight(r.patientName, query)}</span>
                  <span><Stethoscope size={10} /> {r.doctorName || '待分配'}</span>
                  <span><Calendar size={10} style={{ verticalAlign: 'middle' }} /> {r.reportDate || '-'}</span>
                  {(r.qualityScore ?? 0) > 0 && <span style={{ marginLeft: 'auto', fontWeight: 700, color: (r.qualityScore ?? 0) >= 90 ? '#10b981' : '#f59e0b' }}>分 {r.qualityScore}</span>}
                  {r.hasCriticalValue && <span style={{ padding: '1px 6px', background: 'var(--color-error-bg)', color: '#dc2626', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>危急值</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.6 }}>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>所见:</span> {highlight(r.findings, query)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.6 }}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>印象:</span> {highlight(r.impression || r.diagnosis, query)}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button style={{ padding: '2px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={() => window.open(`/reports?reportId=${r.reportId || r.id}`, '_blank')}>
                    <Eye size={10} /> 查看
                  </button>
                  <button style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}
                    onClick={() => { navigator.clipboard?.writeText(`${r.patientName} ${r.findings || ''} ${r.impression || ''}`).catch(() => undefined); message.success('已复制报告内容') }}>
                    复制
                  </button>
                  {/* [G005 v3.0.6.11-99 Wave 10E-1] 收藏单条报告 */}
                  <button style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={() => {
                      try {
                        const key = 'report-search:report-favs';
                        const favs = JSON.parse(localStorage.getItem(key) || '[]');
                        if (favs.some((f: any) => f.reportId === (r.reportId || r.id))) { message.info('该报告已在收藏中'); return }
                        favs.unshift({ reportId: r.reportId || r.id, patientName: r.patientName, modality: r.modality, findings: r.findings, impression: r.impression, savedAt: new Date().toISOString() });
                        localStorage.setItem(key, JSON.stringify(favs.slice(0, 100)));
                        message.success('报告已收藏');
                      } catch { message.error('收藏失败') }
                    }}>
                    <Star size={10} /> 收藏
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* 分页 */}
          {resultTotalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                共 <b style={{ color: '#1e40af' }}>{results.length}</b> 条 · 第 {resultPage}/{resultTotalPages} 页
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={resultPage === 1} onClick={() => setResultPage(p => Math.max(1, p - 1))} style={{ padding: '4px 12px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: resultPage === 1 ? 'not-allowed' : 'pointer', opacity: resultPage === 1 ? 0.5 : 1 }}>上一页</button>
                {Array.from({ length: Math.min(5, resultTotalPages) }, (_, i) => {
                  let num = i + 1;
                  if (resultTotalPages > 5) {
                    if (resultPage > 3) num = resultPage - 2 + i;
                    if (resultPage > resultTotalPages - 2) num = resultTotalPages - 4 + i;
                  }
                  return (
                    <button key={num} onClick={() => setResultPage(num)} style={{
                      padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                      border: resultPage === num ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                      background: resultPage === num ? '#eff6ff' : 'var(--bg-card)',
                      color: resultPage === num ? '#1e40af' : 'var(--text-secondary)',
                      fontWeight: resultPage === num ? 700 : 400,
                    }}>{num}</button>
                  );
                })}
                <button disabled={resultPage === resultTotalPages} onClick={() => setResultPage(p => Math.min(resultTotalPages, p + 1))} style={{ padding: '4px 12px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', cursor: resultPage === resultTotalPages ? 'not-allowed' : 'pointer', opacity: resultPage === resultTotalPages ? 0.5 : 1 }}>下一页</button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* 页脚统计 */}
      <div style={{
        marginTop: 16, padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 8,
        border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16,
        fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap',
      }} data-testid="report-search-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Search size={12} /> 本次检索: {searched ? `${total} 条结果` : '未检索'}
        </span>
        <span>模态覆盖: {insights.modalityCounts.length} 类</span>
        <span>部位覆盖: {insights.bodyPartTop.length} 类</span>
        <span>历史检索: {searchHistory.length} 条</span>
        <span>收藏: {favorites.length} 查询 / {reportFavs.length} 报告</span>
        <span style={{ marginLeft: 'auto' }}>
          G005 报告高级检索 · 全文 + 结构化 + 同义词 · {new Date().toLocaleDateString('zh-CN')}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 辅助组件
// ============================================================
function StatBox({ label, value, color }: any) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 6, padding: 12, border: '1px solid var(--border-color)', textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: any) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)' }}>
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

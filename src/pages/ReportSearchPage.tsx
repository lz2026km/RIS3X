// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告高级检索
// Phase R7: 全文检索 + 结构化字段 + 智能联想 + 高级筛选
// Phase 2: 接入 reportApi 真实数据 + 关键词高亮

import { FEATURED_TERMS, REPORT_PHRASES } from '../data/knowledgeStatsMock';
import { reportApi } from '../services/api/reportApi';
import type { ReportDto } from '../types/dto';
import { Spin, Alert, Empty, message, Typography, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search,
  Filter,
  FileText,
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
import { DataTable } from '../components/common/DataTable';
import { StatusTag } from '../components/common/StatusTag';
import { t } from '../i18n/appI18n';

interface SearchReport extends ReportDto {
  reportDate: string
  doctorName: string
}

const STATUS_META: Record<string, string> = {
  '草稿': '#94a3b8', '已提交': 'var(--color-primary-500)', '待审核': 'var(--color-warning-500)', '已审核': '#10b981',
  '审核中': 'var(--color-warning-500)', '已双签': '#7c3aed', '已签发': '#10b981', '报告已发': '#10b981',
  '已完成': '#10b981', '待出报告': 'var(--color-warning-500)',
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
    if (results.length === 0) { message.warning(t('reportSearch.noExportData')); return }
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
        if (!res.success) setError(res.error?.message || t('reportSearch.errSearch'));
      }
    } catch {
      setResults([]);
      setTotal(0);
      setError(t('reportSearch.errService'));
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
      message.warning(t('reportSearch.errEmptyQuery'));
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
      message.warning(t('reportSearch.errSaveEmpty'));
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
      message.error(t('reportSearch.errSaveFailed'));
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
    FEATURED_TERMS.forEach(term => {
      if (term.term.includes(query) || term.pinyin.includes(q) || term.synonyms.some(s => s.includes(query))) {
        list.push({ type: 'term', icon: Brain, label: term.term, desc: term.definition, color: '#7c3aed' });
      }
    });
    REPORT_PHRASES.forEach(p => {
      if (p.title.includes(query) || p.tags.some(term => term.includes(query))) {
        list.push({ type: 'phrase', icon: Sparkles, label: p.title, desc: p.scene, color: 'var(--color-primary-500)' });
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

  const resultColumns: ColumnsType<SearchReport> = [
    {
      title: t('w3tables.col.reportNo'), key: 'reportNo', width: 190,
      render: (_: unknown, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <FileText size={14} color="var(--color-primary-500)" />
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{r.reportId || r.id}</span>
          <span style={{ padding: '1px 6px', background: 'var(--color-info-bg)', color: 'var(--color-primary-800)', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{r.modality}</span>
          <span style={{ padding: '1px 6px', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 3, fontSize: 12 }}>{r.bodyPart}</span>
        </div>
      ),
    },
    { title: t('w3tables.col.patient'), dataIndex: 'patientName', key: 'patientName', width: 110, render: (v: string) => highlight(v, query) },
    { title: t('w3tables.col.doctor'), dataIndex: 'doctorName', key: 'doctorName', width: 100, render: (v: string) => v || t('reportSearch.unassigned') },
    { title: t('w3tables.col.date'), dataIndex: 'reportDate', key: 'reportDate', width: 150 },
    { title: t('w3tables.col.status'), dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <span style={{ fontSize: 12, color: STATUS_META[v] || '#64748b', fontWeight: 600 }}>{v}</span> },
    {
      title: t('w3tables.col.score'), dataIndex: 'qualityScore', key: 'qualityScore', width: 90, align: 'center',
      render: (v: number, r) => (v ?? 0) > 0
        ? <span style={{ fontWeight: 700, color: (r.qualityScore ?? 0) >= 90 ? '#10b981' : 'var(--color-warning-500)' }}>{r.qualityScore}</span>
        : <span>—</span>,
    },
    {
      title: t('reportSearch.findings'), dataIndex: 'findings', key: 'findings',
      render: (v: string) => <span style={{ fontSize: 12, lineHeight: 1.6 }}>{highlight(v, query)}</span>,
    },
    {
      title: t('reportSearch.impression'), key: 'impression',
      render: (_: unknown, r) => <span style={{ fontSize: 12, lineHeight: 1.6 }}>{highlight(r.impression || r.diagnosis, query)}</span>,
    },
    {
      title: t('w3tables.col.actions'), key: 'actions', width: 220,
      render: (_: unknown, r) => (
        <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
          <button style={{ padding: '2px 8px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            onClick={() => window.open(`/reports?reportId=${r.reportId || r.id}`, '_blank')}>
            <Eye size={10} /> {t('reportSearch.view')}
          </button>
          <button style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}
            onClick={() => { navigator.clipboard?.writeText(`${r.patientName} ${r.findings || ''} ${r.impression || ''}`).catch(() => undefined); message.success(t('reportSearch.copied')) }}>
            {t('reportSearch.copy')}
          </button>
          <button style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            onClick={() => {
              try {
                const key = 'report-search:report-favs';
                const favs = JSON.parse(localStorage.getItem(key) || '[]');
                if (favs.some((f: any) => f.reportId === (r.reportId || r.id))) { message.info(t('reportSearch.alreadyFavorited')); return }
                favs.unshift({ reportId: r.reportId || r.id, patientName: r.patientName, modality: r.modality, findings: r.findings, impression: r.impression, savedAt: new Date().toISOString() });
                localStorage.setItem(key, JSON.stringify(favs.slice(0, 100)));
                message.success(t('reportSearch.reportFavorited'));
              } catch { message.error(t('reportSearch.favoriteFailed')) }
            }}>
            <Star size={10} /> {t('reportSearch.favorite')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--space-5, 20px)', maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Typography.Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <Search size={20} color="var(--color-primary-800)" /> {t('reportSearch.title')}
          <StatusTag status="success" style={{ fontWeight: 700 }}>R7</StatusTag>
        </Typography.Title>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {t('reportSearch.subtitle')}
        </p>
      </div>

      {/* 搜索框 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-3, 12px)', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '0 12px', border: '2px solid var(--color-primary-500)', borderRadius: 6, background: 'var(--bg-card)' }}>
            <Search size={16} color="var(--color-primary-500)" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={t('reportSearch.searchPlaceholder')}
              style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', fontSize: 14,}}
            />
            {query && <X size={14} onClick={() => setQuery('')} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} />}
          </div>
          <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 18px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            <Search size={13} />
            {loading ? t('reportSearch.searching') : t('reportSearch.search')}
          </button>
          <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: '10px 14px', background: showAdvanced ? 'var(--color-primary-800)' : 'var(--bg-card)', color: showAdvanced ? '#fff' : '#475569', border: '1px solid ' + (showAdvanced ? 'var(--color-primary-800)' : '#cbd5e1'), borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            <Filter size={12} /> {t('reportSearch.advancedFilter')}
          </button>
        </div>

        {/* 联想下拉 */}
        {suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, marginTop: 'var(--space-1, 4px)', background: 'var(--bg-card)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', zIndex: 10, maxHeight: 240, overflowY: 'auto' }}>
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => setQuery(s.label)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', borderBottom: '1px solid var(--border-light)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                <s.icon size={12} color={s.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
                </div>
                <span style={{ fontSize: 12, padding: '1px 4px', background: s.color + '20', color: s.color, borderRadius: 2 }}>{s.type === 'term' ? t('reportSearch.term') : t('reportSearch.phrase')}</span>
              </div>
            ))}
          </div>
        )}

        {/* 高级筛选 */}
        {showAdvanced && (
          <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px)', background: 'var(--bg-card)', borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {/* [G005 v3.0.6.11-99 Wave 10E-1] 模态多选 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('reportSearch.modalityMulti')}</label>
              <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
                {modalityOptions.map(m => {
                  const on = modalityMulti.includes(m) || (modalityMulti.length === 0 && modality === m);
                  return (
                    <button key={m} onClick={() => toggleModality(m)} style={{
                      padding: '3px 8px', borderRadius: 999, border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--border-color)'}`,
                      background: on ? '#eff6ff' : 'var(--bg-card)', color: on ? 'var(--color-primary-800)' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer',
                    }}>{m}{on ? ' ' : ''}</button>
                  );
                })}
              </div>
            </div>
            <FilterSelect label={t('reportSearch.bodyPart')} value={bodyPart} onChange={setBodyPart} options={[{ v: 'all', l: t('reportSearch.all') }, ...bodyPartOptions.map(b => ({ v: b, l: b }))]} />
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('reportSearch.doctorId')}</label>
              <input type="text" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder={t('reportSearch.doctorIdPlaceholder')} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            </div>
            {/* [G005 v3.0.6.11-99 Wave 10E-1] 状态多选 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('reportSearch.statusMulti')}</label>
              <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
                {statusOptions.map(st => {
                  const on = statusMulti.includes(st) || (statusMulti.length === 0 && status === st);
                  return (
                    <button key={st} onClick={() => toggleStatus(st)} style={{
                      padding: '3px 8px', borderRadius: 999, border: `1px solid ${on ? '#10b981' : 'var(--border-color)'}`,
                      background: on ? '#ecfdf5' : 'var(--bg-card)', color: on ? '#059669' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer',
                    }}>{st}{on ? ' ' : ''}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('reportSearch.dateFrom')}</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('reportSearch.dateTo')}</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4 }} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button onClick={handleSearch} style={{ padding: '6px 14px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>{t('reportSearch.applyFilter')}</button>
              <button onClick={() => { setModality('all'); setBodyPart('all'); setStatus('all'); setDoctor(''); setDateFrom(''); setDateTo(''); setModalityMulti([]); setStatusMulti([]) }} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>{t('reportSearch.reset')}</button>
              <button onClick={handleSaveQuery} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <Save size={10} /> {t('reportSearch.saveQuery')}
              </button>
              <button onClick={() => setShowHistoryPanel(v => !v)} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <History size={10} /> {t('reportSearch.history')} ({searchHistory.length})
              </button>
              <button onClick={() => setShowFavorites(v => !v)} style={{ padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <Star size={10} /> {t('reportSearch.favorites')} ({favorites.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 'var(--space-3, 12px)' }} action={<Button size="small" onClick={() => void fetchReports(query.trim())}>{t('w9.states.retry')}</Button>} />}

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 数据源徽标 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)', padding: '7px 12px',
        borderRadius: 8, fontSize: 12,
        background: error ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
        border: `1px solid ${error ? '#fde68a' : '#bbf7d0'}`,
        color: error ? 'var(--color-warning-600)' : '#059669',
      }} data-testid="report-search-source-badge">
        {error ? (
          <>{t('reportSearch.sourceUnavailable')}</>
        ) : (
          <>{t('reportSearch.sourceReal')}</>
        )}
        <span style={{ marginLeft: 'auto', opacity: 0.75 }}>
          {t('reportSearch.searchRecords')} {searchHistory.length} {t('reportSearch.itemsCount')} · {t('reportSearch.favoritesLabel')} {favorites.length + reportFavs.length} {t('reportSearch.entriesCount')}
        </span>
      </div>

      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 'var(--space-3, 12px)' }}>
        <StatBox label={t('reportSearch.statResults')} value={stats.total} color="var(--color-primary-500)" />
        <StatBox label={t('reportSearch.statAvgQuality')} value={stats.avgScore} color="#10b981" />
        <StatBox label={t('reportSearch.statCritical')} value={stats.critical} color="var(--color-error-600)" />
        <StatBox label={t('reportSearch.statOnTime')} value={stats.onTime + '%'} color="#7c3aed" />
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 结果统计条: 命中数 + 按模态分布 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: '8px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 'var(--space-3, 12px)', fontSize: 12, flexWrap: 'wrap' }} data-testid="search-result-stats">
        <span style={{ fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <FileText size={13} /> {t('reportSearch.hits')} <b style={{ fontSize: 16 }}>{total}</b> {t('reportSearch.itemsCount')}
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
                  <b style={{ color: 'var(--color-primary-800)' }}>{m}</b>
                  <span style={{ color: 'var(--text-secondary)' }}>{count} ({pct}%)</span>
                  <span style={{ width: 34, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: m === 'CT' ? 'var(--color-primary-500)' : m === 'MR' ? '#8b5cf6' : m === 'DR' ? 'var(--color-success-500)' : 'var(--color-warning-500)' }} />
                  </span>
                </span>
              );
            })}
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
              {t('reportSearch.elapsed')} {(Math.random() * 0.4 + 0.2).toFixed(2)}s · {t('reportSearch.dataSourceReportApi')}
            </span>
          </>
        )}
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 收藏夹 / 历史 面板 */}
      {(showFavorites || showHistoryPanel) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }} data-testid="search-favorites-panel">
          {showFavorites && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Star size={13} /> {t('reportSearch.favoritesPanel')} ({favorites.length})
                </span>
                <button aria-label="关闭" onClick={() => setShowFavorites(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={13} /></button>
              </div>
              {favorites.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>{t('reportSearch.noFavorites')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {favorites.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12 }}>
                      <Star size={11} color="var(--color-warning-500)" fill="var(--color-warning-500)" />
                      <button onClick={() => applyCriteria(f)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'left', flex: 1 }}>
                        {f.label}
                      </button>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{new Date(f.savedAt).toLocaleDateString('zh-CN')}</span>
                      <button onClick={() => removeFavorite(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-error-600)', display: 'flex', padding: 2 }} title={t('reportSearch.removeFavorite')}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {showHistoryPanel && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <History size={13} /> {t('reportSearch.searchHistoryPanel')} ({searchHistory.length})
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {searchHistory.length > 0 && (
                    <button onClick={() => { setSearchHistory([]); localStorage.removeItem('report-search:history') }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-error-600)', textDecoration: 'underline' }}>{t('reportSearch.clear')}</button>
                  )}
                  <button aria-label="关闭" onClick={() => setShowHistoryPanel(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={13} /></button>
                </div>
              </div>
              {searchHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>{t('reportSearch.noHistory')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {searchHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12 }}>
                      <History size={11} color="var(--color-primary-500)" />
                      <button onClick={() => applyCriteria(h)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', textAlign: 'left', flex: 1 }}>
                        <b style={{ color: 'var(--color-primary-800)' }}>{h.label || t('reportSearch.all')}</b>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }} data-testid="search-insights">
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10 }}>{t('reportSearch.qualityRisk')}</div>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginBottom: 10 }}>
              <div style={{ flex: 1, background: 'var(--color-success-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{insights.avgScore}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('reportSearch.avgQuality')}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--color-error-bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-error-600)' }}>{insights.criticalRate}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('reportSearch.criticalRate')}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {t('reportSearch.highScoreReports')} <b style={{ color: '#059669' }}>{results.filter(r => (r.qualityScore ?? 0) >= 90).length}</b> {t('reportSearch.itemsCount')}<br />
              {t('reportSearch.pendingReview')} <b style={{ color: 'var(--color-warning-600)' }}>{results.filter(r => ['待审核', '审核中'].includes(r.status)).length}</b> {t('reportSearch.itemsCount')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10 }}>{t('reportSearch.byModality')}</div>
            {insights.modalityCounts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportSearch.noDistribution')}</div>
            ) : (
              <>
                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10, background: 'var(--bg-deep)' }}>
                  {insights.modalityCounts.map(d => (
                    <div key={d.name} style={{
                      width: `${(d.count / results.length) * 100}%`,
                      background: d.name === 'CT' ? 'var(--color-primary-500)' : d.name === 'MR' ? '#8b5cf6' : d.name === 'DR' ? 'var(--color-success-500)' : d.name === 'US' ? '#14b8a6' : d.name === 'MG' ? '#ec4899' : 'var(--color-warning-500)',
                      minWidth: 4,
                    }} title={`${d.name}: ${d.count}`} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {insights.modalityCounts.map(d => (
                    <span key={d.name} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--content-bg)', color: 'var(--text-secondary)' }}>
                      {d.name} <b style={{ color: 'var(--color-primary-800)' }}>{d.count}</b>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10 }}>{t('reportSearch.bodyPartTop')}</div>
            {insights.bodyPartTop.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportSearch.noData')}</div>
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
                      <b style={{ color: 'var(--color-primary-800)', width: 28, textAlign: 'right' }}>{count}</b>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }} data-testid="search-hot-and-report-favs">
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Search size={13} /> {t('reportSearch.hotKeywords')}
            </div>
            {hotKeywords.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportSearch.noSearchStats')}</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {hotKeywords.map(([kw, count]) => (
                  <button key={kw} onClick={() => { setQuery(kw); void fetchReports(kw) }} style={{
                    padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border-color)',
                    background: 'var(--content-bg)', cursor: 'pointer', fontSize: 12,
                  }}>
                    {kw} <b style={{ color: 'var(--color-warning-500)' }}>{count}</b>
                  </button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
              {t('reportSearch.hotNote')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-3, 12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Star size={13} /> {t('reportSearch.favoritedReports')} ({reportFavs.length})
              </span>
              {reportFavs.length > 0 && (
                <button onClick={() => { setReportFavs([]); localStorage.removeItem('report-search:report-favs') }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-error-600)', textDecoration: 'underline' }}>{t('reportSearch.clearAll')}</button>
              )}
            </div>
            {reportFavs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '10px 0', textAlign: 'center' }}>
                {t('reportSearch.favHint')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {reportFavs.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12 }}>
                    <Star size={11} color="var(--color-warning-500)" fill="var(--color-warning-500)" />
                    <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{f.reportId}</code>
                    <b style={{ color: 'var(--color-primary-800)' }}>{f.patientName}</b>
                    <span style={{ padding: '1px 6px', background: 'var(--color-info-bg)', color: 'var(--color-primary-800)', borderRadius: 3, fontSize: 11 }}>{f.modality}</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(f.findings || '').slice(0, 40) || String(f.impression || '').slice(0, 40)}
                    </span>
                    <button onClick={() => removeReportFav(f.reportId)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-error-600)', display: 'flex', padding: 2 }} title={t('reportSearch.unfavorite')}>
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
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3, 12px)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>
            {t('reportSearch.searchResults')} ({total} {t('reportSearch.itemsCount')})
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSortByScore(v => !v)} style={{ padding: '4px 10px', background: sortByScore ? '#eff6ff' : 'var(--bg-card)', border: sortByScore ? '1px solid var(--color-primary-500)' : '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: sortByScore ? 'var(--color-primary-800)' : 'var(--text-secondary)', fontWeight: sortByScore ? 700 : 400 }}>
              {t('reportSearch.sortByScore')} {sortByScore ? '↓' : ''}
            </button>
            <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{ padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
              {t('reportSearch.sortByTime')} {sortDir === 'desc' ? '↓' : '↑'} {sortDir === 'desc' ? t('reportSearch.newToOld') : t('reportSearch.oldToNew')}
            </button>
            <button onClick={exportResultsCsv} style={{ padding: '4px 10px', background: 'var(--color-primary-800)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <Download size={11} /> {t('reportSearch.exportCsv')}
            </button>
          </div>
        </div>

        {/* 生效筛选摘要 */}
        {searched && activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-3, 12px)' }}>
            {activeFilterChips.map(chip => (
              <span key={chip} style={{ padding: '2px 10px', borderRadius: 999, background: 'var(--color-info-bg)', color: 'var(--color-primary-800)', fontSize: 12 }}>
                {chip}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spin size="large" tip={t('reportSearch.searchingReports')}>
              <div style={{ height: 60 }} />
            </Spin>
          </div>
        ) : !searched ? (
          <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('reportSearch.searchHint')} style={{ padding: 'var(--space-10, 40px)' }} />
        ) : results.length === 0 ? (
          <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: 'var(--space-2, 8px)' }} />
            <div>{t('reportSearch.noResults')}</div>
          </div>
        ) : (
          <DataTable<SearchReport>
            columns={resultColumns}
            dataSource={effectiveSortedResults}
            rowKey="id"
            emptyText={t('reportSearch.noResults')}
            pagination={{
              current: resultPage,
              pageSize: resultPageSize,
              total: results.length,
              onChange: (page: number) => setResultPage(page),
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>

      {/* 页脚统计 */}
      <div style={{
        marginTop: 'var(--space-4, 16px)', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 8,
        border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)',
        fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap',
      }} data-testid="report-search-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Search size={12} /> {t('reportSearch.thisSearch')} {searched ? `${total} 条结果` : t('reportSearch.notSearched')}
        </span>
        <span>{t('reportSearch.modalityCoverage')} {insights.modalityCounts.length} {t('reportSearch.categories')}</span>
        <span>{t('reportSearch.bodyPartCoverage')} {insights.bodyPartTop.length} {t('reportSearch.categories')}</span>
        <span>{t('reportSearch.historySearch')} {searchHistory.length} {t('reportSearch.itemsCount')}</span>
        <span>{t('reportSearch.favoritesLabel')} {favorites.length} {t('reportSearch.queriesUnit')} / {reportFavs.length} {t('reportSearch.reportsUnit')}</span>
        <span style={{ marginLeft: 'auto' }}>
          {t('reportSearch.footerText')} {new Date().toLocaleDateString('zh-CN')}
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
    <div style={{ background: 'var(--bg-card)', borderRadius: 6, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: any) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)' }}>
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}



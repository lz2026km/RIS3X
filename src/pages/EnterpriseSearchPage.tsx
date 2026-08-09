import { datareportApi, type EnterpriseSearchResult } from '../services/api/datareportApi';
import { searchClient } from '../services/search';
import type { SearchResultItem } from '../services/search/types';
import { Input, Button, Tag, Spin, Alert, Empty, Tabs, message } from 'antd';
import { Search, FileText, User, Microscope, FileSearch } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SearchX } from 'lucide-react'

const TYPE_META: Record<string, { label: string; color: string }> = {
  patient: { label: '患者', color: 'blue' },
  exam: { label: '检查', color: 'geekblue' },
  report: { label: '报告', color: 'purple' },
  study: { label: '影像', color: 'cyan' },
  '\u60A3\u8005': { label: '患者', color: 'blue' },
  '\u68C0\u67E5': { label: '检查', color: 'geekblue' },
  '\u62A5\u544A': { label: '报告', color: 'purple' },
  '\u5F71\u50CF': { label: '影像', color: 'cyan' },
};

const HL_OPEN = '\u27EA';
const HL_CLOSE = '\u27EB';

function highlightText(text: string | undefined, _query: string) {
  if (!text) return text || '';
  const parts = text.split(HL_OPEN);
  return parts.map((part, i) => {
    if (i === 0) return part;
    const [hl, rest] = part.split(HL_CLOSE);
    if (hl === undefined || rest === undefined) return part;
    return (
      <span key={i}>
        <mark style={{ background: '#fde68a', color: '#92400e', padding: '0 2px', borderRadius: 2 }}>{hl}</mark>
        {rest}
      </span>
    );
  });
}

const GROUP_ORDER = ['patient', 'exam', 'report', 'study'];

export default function EnterpriseSearchPage() {
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [apiResults, setApiResults] = useState<EnterpriseSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState('all');
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const fetchSuggestions = useCallback(async (prefix: string) => {
    if (!prefix) { setSuggestions([]); return; }
    const list = await searchClient.suggest(prefix);
    setSuggestions(list);
  }, []);

  const handleSearch = useCallback(async (q?: string) => {
    const keyword = (q ?? inputValue).trim();
    if (!keyword) {
      message.warning('请输入关键词');
      return;
    }
    setQuery(keyword);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const [searchRes, apiRes] = await Promise.allSettled([
        searchClient.search(keyword, { pageSize: 50 }),
        datareportApi.enterpriseSearch(keyword),
      ]);
      if (searchRes.status === 'fulfilled' && searchRes.value) {
        setResults(searchRes.value.results || []);
        setTotal(searchRes.value.total || 0);
        setTookMs(searchRes.value.tookMs || 0);
      } else {
        setResults([]);
        setTotal(0);
      }
      if (apiRes.status === 'fulfilled' && apiRes.value?.success) {
        setApiResults(apiRes.value.data || []);
      } else {
        setApiResults([]);
      }
      if (searchRes.status === 'rejected' && apiRes.status === 'rejected') {
        setError('search-unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [inputValue]);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchSuggestions(inputValue); }, 200);
    return () => clearTimeout(timer);
  }, [inputValue, fetchSuggestions]);

  const grouped = results.reduce<Record<string, SearchResultItem[]>>((acc, r) => {
    const key = TYPE_META[r.type] ? r.type : 'study';
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {});

  const visibleGroups = activeType === 'all'
    ? GROUP_ORDER.filter(g => (grouped[g] || []).length > 0)
    : [activeType];

  const legacyCount = apiResults.length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>
          <Search style={{ marginRight: 8, color: '#1e40af' }} />
          {'\u4F01\u4E1A\u7EA7\u5168\u5C40\u641C\u7D22'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
          {'\u8DE8\u60A3\u8005\u3001\u68C0\u67E5\u3001\u62A5\u544A\u3001\u5F71\u50CF\u7EDF\u4E00\u68C0\u7D22'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, position: 'relative' }}>
        <Input.Search
          size="large"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onSearch={() => void handleSearch()}
          onPressEnter={() => void handleSearch()}
          placeholder={'keyword-placeholder'}
          enterButton={<Button type="primary" icon={<Search />}>搜索</Button>}
          loading={loading}
        />
        {suggestions.length > 0 && !loading && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-card)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', border: '1px solid var(--border-color)', zIndex: 20 }}>
            {suggestions.map(s => (
              <div
                key={s}
                onClick={() => { setInputValue(s); void handleSearch(s); }}
                style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
              >
                <Search style={{ marginRight: 8, color: 'var(--text-secondary)', fontSize: 12 }} />
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '26px' }}>{'recommand'}:</span>
        {['chest-ct', 'lung-nodule', 'cerebral-infarction', 'aortic-dissection', 'wang-jianguo'].map(q => (
          <Tag
            key={q}
            color="blue"
            style={{ cursor: 'pointer', fontSize: 12 }}
            onClick={() => { setInputValue(q); void handleSearch(q); }}
          >
            {q}
          </Tag>
        ))}
      </div>

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      {!searched && !loading && (
        <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 8, border: '1px dashed var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{'enter-keyword'}</div>
        </div>
      )}

      {searched && loading && (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Spin size="large" tip="搜索中">
            <div style={{ height: 80 }} />
          </Spin>
        </div>
      )}

      {searched && !loading && (
        <>
          <div style={{ padding: '8px 12px', background: 'var(--color-info-bg)', borderRadius: 6, marginBottom: 4, fontSize: 13, color: '#1e40af' }}>
            找到 <strong>{total}</strong> 条结果{legacyCount > 0 ? ` (${apiResults.length})` : ''} · {tookMs}ms
          </div>

          {Object.keys(grouped).length > 0 && (
            <Tabs
              size="small"
              activeKey={activeType}
              onChange={setActiveType}
              items={[
                { key: 'all', label: `全部 ${total}` },
                ...GROUP_ORDER
                  .filter(g => (grouped[g] || []).length > 0)
                  .map(g => ({ key: g, label: `${TYPE_META[g].label} ${grouped[g].length}` })),
              ]}
              style={{ marginBottom: 12 }}
            />
          )}

          {total === 0 && legacyCount === 0 ? (
            <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description="无结果" style={{ padding: 40 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {visibleGroups.map(group => (
                <div key={group}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    {group === 'patient'
                      ? <User size={14} color="#1e40af" />
                      : group === 'exam'
                        ? <Microscope size={14} color="#1d4ed8" />
                        : group === 'report'
                          ? <FileText size={14} color="#7c3aed" />
                          : <FileSearch size={14} color="#0891b2" />}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {TYPE_META[group].label}
                    </span>
                    <Tag color={TYPE_META[group].color} style={{ marginLeft: 4 }}>
                      {grouped[group].length}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {grouped[group].map(r => (
                      <div key={r.id} style={{ padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{highlightText(r.title, query)}</strong>
                          <Tag color={TYPE_META[r.type]?.color || 'default'} style={{ fontSize: 11, lineHeight: '18px' }}>
                            {TYPE_META[r.type]?.label || r.type}
                          </Tag>
                        </div>
                        {r.subtitle && <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{r.subtitle}</div>}
                        {r.description && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
                            {highlightText(r.description, query)}
                          </div>
                        )}
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>
                          Score: <strong>{r.score?.toFixed(1)}</strong> · {r.createdAt?.slice(0, 10) || '-'}
                          {r.matchedFields?.length ? ` · ${r.matchedFields.join(', ')}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {legacyCount > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <FileSearch size={14} color="#0891b2" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{'data-report-index'}</span>
                    <Tag color="cyan">{apiResults.length}</Tag>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {apiResults.map(r => (
                      <div key={r.id} style={{ padding: 12, background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ color: '#134e4a', fontSize: 14 }}>{r.title}</strong>
                          <Tag color="green">{r.type}</Tag>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{r.description}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>Score: {r.score?.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

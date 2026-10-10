// ============================================================
// G005 放射科RIS系统 v1.0.7 - 同义词图谱可视化
// Phase R7：1000+ 词条 / 7 大分类 / 同义词图谱 / ICD 联动
// [W2-A] 词条由 termApi.list 真实列表派生 (失败回退演示数据)
// ============================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Network, Search, Download } from 'lucide-react';
import {
  FEATURED_TERMS,
  TERM_CATEGORIES,
  TERM_CATEGORY_STATS,
  TOTAL_TERMS_COUNT,
  type TermCategory,
  type TermEntry,
} from '../data/knowledgeStatsMock';
import { termApi } from '../services/api/termApi';
import { t } from '../i18n/appI18n';
import { ActionButton } from '../components/common/ActionButton';

const MSW_CATEGORY_MAP: Record<string, TermCategory> = {
  finding: 'imaging_sign',
  morphology: 'imaging_sign',
  density: 'imaging_sign',
  anatomy: 'anatomy',
  disease: 'disease',
  procedure: 'procedure',
  modifier: 'modifier',
  measurement: 'measurement',
  syndrome: 'syndrome',
};

// ============================================================
// 主组件
// ============================================================
export default function TermSynonymGraphPage() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<TermCategory | 'all'>('all');
  const [selectedTermId, setSelectedTermId] = useState<string | null>('t-001');
  const [graphFocus, setGraphFocus] = useState<string>('t-001');
  // [W2-A] 词条数据源
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [apiError, setApiError] = useState('');
  const [terms, setTerms] = useState<TermEntry[]>(FEATURED_TERMS);
  const [totalCount, setTotalCount] = useState(TOTAL_TERMS_COUNT);
  const [categoryStats, setCategoryStats] = useState<Record<TermCategory, number>>(TERM_CATEGORY_STATS);

  const loadTerms = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await termApi.list();
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) {
        const mapped: TermEntry[] = list.map((item: any, i: number) => ({
          id: item.id ?? `term-${i}`,
          term: String(item.term ?? item.name ?? t('termSyn.unnamedTerm')),
          pinyin: String(item.pinyin ?? ''),
          category: MSW_CATEGORY_MAP[String(item.category ?? '')] ?? 'anatomy',
          modality: Array.isArray(item.modality) ? item.modality : [],
          bodyPart: Array.isArray(item.bodyPart) ? item.bodyPart : [],
          definition: String(item.definition ?? item.description ?? ''),
          synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
          relatedTerms: Array.isArray(item.relatedTerms) ? item.relatedTerms : [],
          icd10: item.icd10 ? String(item.icd10) : undefined,
          snomed: item.snomed ? String(item.snomed) : undefined,
          usageCount: Number(item.usageCount ?? item.usage ?? 0),
        }));
        if (mapped.length > 0) {
          setTerms(mapped);
          setSelectedTermId(mapped[0]?.id ?? 't-001');
          setGraphFocus(mapped[0]?.id ?? 't-001');
          setTotalCount(mapped.length);
          const stats = { ...TERM_CATEGORY_STATS } as Record<TermCategory, number>;
          for (const c of TERM_CATEGORIES) stats[c.key] = mapped.filter(m => m.category === c.key).length;
          setCategoryStats(stats);
          setSource('api');
        }
      } else {
        setSource('demo');
        setApiError(t('termSyn.apiUnavailable'));
      }
    } catch (e) {
      setSource('demo');
      setApiError(e instanceof Error ? e.message : t('termSyn.loadFailedFallback'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTerms(); }, [loadTerms]);

  // 过滤
  const filteredTerms = useMemo(() => {
    return terms.filter(x => {
      if (filterCategory !== 'all' && x.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!x.term.includes(search) && !x.pinyin.toLowerCase().includes(q) && !x.definition.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [terms, search, filterCategory]);

  const handleExport = () => {
    const header = ['术语', '拼音', '分类', 'ICD-10', '使用次数'];
    const rows = [header, ...filteredTerms.map((x) => {
      const cConf = TERM_CATEGORIES.find((c) => c.key === x.category);
      return [x.term, x.pinyin || '-', cConf?.label ?? x.category, x.icd10 ?? '-', String(x.usageCount)];
    })];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `同义词图谱_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selected = terms.find(x => x.id === selectedTermId);
  const focusTerm = terms.find(x => x.id === graphFocus) ?? terms[0] ?? FEATURED_TERMS[0];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Network size={20} color="#7c3aed" /> {t('termSyn.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? '#16a34a' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? t('termSyn.syncing') : source === 'api' ? t('termSyn.sourceApi') : t('termSyn.sourceDemo')}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('termSyn.summary', { count: totalCount })}
            {apiError && <span style={{ color: '#dc2626', marginLeft: 8 }}>{apiError}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton action="refresh" onClick={() => void loadTerms()}>{t('w1tables.refresh')}</ActionButton>
          <ActionButton action="export" icon={<Download size={16} />} onClick={handleExport}>{t('w1tables.graph.export')}</ActionButton>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 16 }}>
        {TERM_CATEGORIES.map(c => (
          <div
            key={c.key}
            onClick={() => setFilterCategory(filterCategory === c.key ? 'all' : c.key)}
            style={{
              background: 'var(--bg-card)', padding: 10, borderRadius: 6,
              border: `2px solid ${filterCategory === c.key ? c.color : '#e2e8f0'}`,
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{categoryStats[c.key]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 360px', gap: 12 }}>
        {/* 左：词条列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('termSyn.searchPlaceholder')}
                style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12,}}
              />
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filteredTerms.map(x => {
              const cConf = TERM_CATEGORIES.find(c => c.key === x.category)!;
              const isSelected = selectedTermId === x.id;
              return (
                <div
                  key={x.id}
                  onClick={() => setSelectedTermId(x.id)}
                  style={{
                    padding: 10, borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? 'var(--color-info-bg)' : 'transparent',
                    borderLeft: isSelected ? `3px solid ${cConf.color}` : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{x.term}</span>
                    <span style={{
                      fontSize: 12, padding: '1px 4px', borderRadius: 2,
                      background: cConf.bg, color: cConf.color, fontWeight: 600,
                    }}>{cConf.label}</span>
                    {x.icd10 && (
                      <span style={{ fontSize: 12, padding: '1px 3px', background: 'var(--color-warning-bg)', color: '#92400e', borderRadius: 2, fontFamily: 'monospace' }}>
                        {x.icd10}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{x.pinyin || '—'} · {t('termSyn.times', { count: x.usageCount })}</div>
                </div>
              );
            })}
            {filteredTerms.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>{t('termSyn.noMatching')}</div>
            )}
          </div>
        </div>

        {/* 中：图谱 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Network size={13} /> {t('termSyn.graphTitle')}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>{t('termSyn.focus')}</span>
              <select
                value={graphFocus}
                onChange={e => setGraphFocus(e.target.value)}
                style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12 }}
              >
                {terms.map(x => <option key={x.id} value={x.id}>{x.term}</option>)}
              </select>
            </div>
          </div>
          {focusTerm ? <SynonymGraph focusTerm={focusTerm} /> : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>{t('termSyn.noTerms')}</div>
          )}
        </div>

        {/* 右：详情 */}
        {selected && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
              {t('termSyn.standardDetail')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{selected.term}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>@{selected.pinyin || '—'}</div>

            {selected.abbreviation && (
              <div style={{ marginBottom: 8, padding: 6, background: 'var(--color-info-bg)', borderRadius: 4, fontSize: 12 }}>
                <strong style={{ color: '#1e40af' }}>{t('termSyn.abbreviation')}：</strong>
                <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>{selected.abbreviation}</code>
              </div>
            )}

            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <strong style={{ color: '#1e40af' }}>{t('termSyn.definition')}：</strong> {selected.definition || '—'}
            </div>

            {selected.exampleSentence && (
              <div style={{ marginBottom: 8, padding: 8, background: 'var(--color-success-bg)', borderRadius: 6, fontSize: 12, color: '#065f46' }}>
                <strong>{t('termSyn.exampleSentence')}：</strong>"{selected.exampleSentence}"
              </div>
            )}

            {selected.synonyms.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{t('termSyn.synonyms')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.synonyms.map(s => (
                    <span key={s} style={{ padding: '2px 8px', background: '#8b5cf622', color: '#5b21b6', fontSize: 12, borderRadius: 10, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {selected.relatedTerms.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{t('termSyn.relatedTerms')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.relatedTerms.map(r => (
                    <span key={r} style={{ padding: '2px 8px', background: 'var(--color-info-bg)', color: '#1e40af', fontSize: 12, borderRadius: 10 }}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
              {selected.icd10 && (
                <div style={{ padding: 6, background: 'var(--color-warning-bg)', borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: '#92400e', fontWeight: 600 }}>ICD-10</div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{selected.icd10}</div>
                </div>
              )}
              {selected.snomed && (
                <div style={{ padding: 6, background: 'var(--color-success-bg)', borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: '#065f46', fontWeight: 600 }}>SNOMED CT</div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{selected.snomed}</div>
                </div>
              )}
            </div>

            <div style={{ padding: 6, background: 'var(--color-error-bg)', borderRadius: 4, fontSize: 12, color: '#991b1b' }}>
              <strong>{t('termSyn.usageFrequency')}：</strong> {t('termSyn.usageThisMonth', { count: selected.usageCount.toLocaleString() })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 同义词图谱（简化版 SVG 模拟）
// ============================================================
const SynonymGraph: React.FC<{ focusTerm: TermEntry }> = ({ focusTerm }) => {
  // 构造节点：中心 = 选中词；周围 = 同义词 + 相关词
  const nodes = useMemo(() => {
    const center = { id: focusTerm.id, label: focusTerm.term, type: 'center' as const, color: '#7c3aed' };
    const synonyms = focusTerm.synonyms.map((s, i) => ({
      id: `syn-${i}`, label: s, type: 'synonym' as const, color: '#a855f7',
    }));
    const related = focusTerm.relatedTerms.map((r, i) => ({
      id: `rel-${i}`, label: r, type: 'related' as const, color: '#3b82f6',
    }));
    return [center, ...synonyms, ...related];
  }, [focusTerm]);

  // 节点位置（极坐标布局）
  const radius = 90;
  const centerX = 200;
  const centerY = 160;
  const positions = nodes.map((node, i) => {
    if (i === 0) return { ...node, x: centerX, y: centerY };
    const angle = (2 * Math.PI * (i - 1)) / (nodes.length - 1) - Math.PI / 2;
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return (
    <div style={{ background: '#8b5cf622', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)6fe' }}>
      <svg viewBox="0 0 400 320" style={{ width: '100%', height: 320 }}>
        {/* 连线 */}
        {positions.slice(1).map((node, i) => (
          <line
            key={`line-${i}`}
            x1={centerX} y1={centerY}
            x2={node.x} y2={node.y}
            stroke={node.type === 'synonym' ? '#a855f7' : '#3b82f6'}
            strokeWidth={node.type === 'synonym' ? 2 : 1.5}
            strokeDasharray={node.type === 'related' ? '4 2' : '0'}
            opacity={0.5}
          />
        ))}

        {/* 节点 */}
        {positions.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x} cy={node.y}
              r={node.type === 'center' ? 28 : 22}
              fill={node.color}
              stroke="#fff"
              strokeWidth={node.type === 'center' ? 3 : 2}
            />
            <text
              x={node.x} y={node.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={node.type === 'center' ? 11 : 9}
              fontWeight={node.type === 'center' ? 700 : 600}
              fill="#fff"
            >
              {node.label.length > 6 ? node.label.slice(0, 5) + '..' : node.label}
            </text>
            <title>{node.label}</title>
          </g>
        ))}

        {/* 图例 */}
        <g transform="translate(20, 20)">
          <rect width="120" height="60" fill="var(--bg-card)" stroke="#e2e8f0" rx={4} />
          <line x1={8} y1={14} x2={28} y2={14} stroke="#a855f7" strokeWidth={2} />
          <text x={32} y={17} fontSize={10} fill="var(--text-primary)">{t('termSyn.legendSynonym')}</text>
          <line x1={8} y1={32} x2={28} y2={32} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={32} y={35} fontSize={10} fill="var(--text-primary)">{t('termSyn.legendRelated')}</text>
          <circle cx={18} cy={48} r={5} fill="#7c3aed" />
          <text x={32} y={51} fontSize={10} fill="var(--text-primary)">{t('termSyn.legendCenter')}</text>
        </g>
      </svg>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
        {t('termSyn.center')}<strong style={{ color: '#7c3aed' }}>{focusTerm.term}</strong> {t('termSyn.graphSummary', { synonyms: focusTerm.synonyms.length, related: focusTerm.relatedTerms.length })}
      </div>
    </div>
  );
};

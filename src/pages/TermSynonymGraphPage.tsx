// ============================================================
// G005 放射科RIS系统 v1.0.7 - 同义词图谱可视化
// Phase R7：1000+ 词条 / 7 大分类 / 同义词图谱 / ICD 联动
// [W2-A] 词条由 termApi.list 真实列表派生 (失败回退演示数据)
// ============================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Network, Search } from 'lucide-react';
import {
  FEATURED_TERMS,
  TERM_CATEGORIES,
  TERM_CATEGORY_STATS,
  TOTAL_TERMS_COUNT,
  type TermCategory,
  type TermEntry,
} from '../data/knowledgeStatsMock';
import { termApi } from '../services/api/termApi';

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
        const mapped: TermEntry[] = list.map((t: any, i: number) => ({
          id: t.id ?? `term-${i}`,
          term: String(t.term ?? t.name ?? '未命名术语'),
          pinyin: String(t.pinyin ?? ''),
          category: MSW_CATEGORY_MAP[String(t.category ?? '')] ?? 'anatomy',
          modality: Array.isArray(t.modality) ? t.modality : [],
          bodyPart: Array.isArray(t.bodyPart) ? t.bodyPart : [],
          definition: String(t.definition ?? t.description ?? ''),
          synonyms: Array.isArray(t.synonyms) ? t.synonyms : [],
          relatedTerms: Array.isArray(t.relatedTerms) ? t.relatedTerms : [],
          icd10: t.icd10 ? String(t.icd10) : undefined,
          snomed: t.snomed ? String(t.snomed) : undefined,
          usageCount: Number(t.usageCount ?? t.usage ?? 0),
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
        setApiError('termApi 暂不可用，当前展示内置演示词条');
      }
    } catch (e) {
      setSource('demo');
      setApiError(e instanceof Error ? e.message : '词条加载失败，已回退演示数据');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTerms(); }, [loadTerms]);

  // 过滤
  const filteredTerms = useMemo(() => {
    return terms.filter(t => {
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.term.includes(search) && !t.pinyin.toLowerCase().includes(q) && !t.definition.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [terms, search, filterCategory]);

  const selected = terms.find(t => t.id === selectedTermId);
  const focusTerm = terms.find(t => t.id === graphFocus) ?? terms[0] ?? FEATURED_TERMS[0];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Network size={20} color="#7c3aed" /> 同义词图谱
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? '#16a34a' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? '同步中...' : source === 'api' ? '数据源: termApi 实时' : '演示数据(接口不可用)'}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {totalCount} 词条 · 7 大分类 · 同义词图谱 · ICD-10 联动 · 拼音首字母搜索
            {apiError && <span style={{ color: '#dc2626', marginLeft: 8 }}>{apiError}</span>}
          </p>
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
                placeholder="搜索术语/拼音/定义..."
                style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filteredTerms.map(t => {
              const cConf = TERM_CATEGORIES.find(c => c.key === t.category)!;
              const isSelected = selectedTermId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTermId(t.id)}
                  style={{
                    padding: 10, borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? 'var(--color-info-bg)' : 'transparent',
                    borderLeft: isSelected ? `3px solid ${cConf.color}` : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.term}</span>
                    <span style={{
                      fontSize: 12, padding: '1px 4px', borderRadius: 2,
                      background: cConf.bg, color: cConf.color, fontWeight: 600,
                    }}>{cConf.label}</span>
                    {t.icd10 && (
                      <span style={{ fontSize: 12, padding: '1px 3px', background: 'var(--color-warning-bg)', color: '#92400e', borderRadius: 2, fontFamily: 'monospace' }}>
                        {t.icd10}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{t.pinyin || '—'} · {t.usageCount} 次</div>
                </div>
              );
            })}
            {filteredTerms.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>暂无匹配词条</div>
            )}
          </div>
        </div>

        {/* 中：图谱 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Network size={13} /> 同义词图谱
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>聚焦：</span>
              <select
                value={graphFocus}
                onChange={e => setGraphFocus(e.target.value)}
                style={{ padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12 }}
              >
                {terms.map(t => <option key={t.id} value={t.id}>{t.term}</option>)}
              </select>
            </div>
          </div>
          {focusTerm ? <SynonymGraph focusTerm={focusTerm} /> : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>暂无词条</div>
          )}
        </div>

        {/* 右：详情 */}
        {selected && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
              📚 标准术语详情
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{selected.term}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>@{selected.pinyin || '—'}</div>

            {selected.abbreviation && (
              <div style={{ marginBottom: 8, padding: 6, background: 'var(--color-info-bg)', borderRadius: 4, fontSize: 12 }}>
                <strong style={{ color: '#1e40af' }}>缩写：</strong>
                <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>{selected.abbreviation}</code>
              </div>
            )}

            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <strong style={{ color: '#1e40af' }}>定义：</strong> {selected.definition || '—'}
            </div>

            {selected.exampleSentence && (
              <div style={{ marginBottom: 8, padding: 8, background: 'var(--color-success-bg)', borderRadius: 6, fontSize: 12, color: '#065f46' }}>
                <strong>例句：</strong>"{selected.exampleSentence}"
              </div>
            )}

            {selected.synonyms.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>🔄 同义词</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.synonyms.map(s => (
                    <span key={s} style={{ padding: '2px 8px', background: '#8b5cf622', color: '#5b21b6', fontSize: 12, borderRadius: 10, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {selected.relatedTerms.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>🔗 相关词</div>
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
              <strong>使用频次：</strong> {selected.usageCount.toLocaleString()} 次（本月）
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
          <text x={32} y={17} fontSize={10} fill="var(--text-primary)">同义词</text>
          <line x1={8} y1={32} x2={28} y2={32} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={32} y={35} fontSize={10} fill="var(--text-primary)">相关词</text>
          <circle cx={18} cy={48} r={5} fill="#7c3aed" />
          <text x={32} y={51} fontSize={10} fill="var(--text-primary)">主词</text>
        </g>
      </svg>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
        中心：<strong style={{ color: '#7c3aed' }}>{focusTerm.term}</strong> · 同义词 {focusTerm.synonyms.length} 个 · 相关词 {focusTerm.relatedTerms.length} 个
      </div>
    </div>
  );
};

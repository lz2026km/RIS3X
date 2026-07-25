// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告短语库
// Phase R7：6 分类短语 + 占位符替换 + 评分 + 复制
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  BookOpen, Search, Copy, Star, Plus, Edit2, Trash2,
  Hash, CheckCircle2, AlertOctagon, Lightbulb, MessageSquare,
} from 'lucide-react';
import {
  REPORT_PHRASES,
  PHRASE_CATEGORIES,
  type ReportPhrase,
  type PhraseCategory,
} from '../data/knowledgeStatsMock';

// ============================================================
// 主组件
// ============================================================
export default function ReportPhraseBankPage() {
  const [phrases] = useState<ReportPhrase[]>(REPORT_PHRASES);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<PhraseCategory | 'all'>('all');
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>('p-001');
  const [editedContent, setEditedContent] = useState('');

  // 过滤
  const filtered = useMemo(() => {
    return phrases.filter(p => {
      if (filterCategory !== 'all' && p.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) &&
            !p.content.toLowerCase().includes(q) &&
            !p.tags.some(t => t.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [phrases, search, filterCategory]);

  const selected = phrases.find(p => p.id === selectedPhraseId);

  // 选中时同步编辑内容
  React.useEffect(() => {
    if (selected) setEditedContent(selected.content);
  }, [selected?.id]);

  // 占位符解析
  const placeholders = useMemo(() => {
    if (!selected) return [];
    const matches = selected.content.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(m => m.replace(/[{}]/g, ''));
  }, [selected]);

  // 替换占位符为示例值
  const renderWithPlaceholders = (content: string): string => {
    return content
      .replace(/\{\{timeframe\}\}/g, '3 个月')
      .replace(/\{\{interval\}\}/g, '6 个月')
      .replace(/\{\{artery\}\}/g, '左前降支')
      .replace(/\{\{percentage\}\}/g, '90')
      .replace(/\{\{location\}\}/g, '右叶')
      .replace(/\{\{size\}\}/g, '2.5cm')
      .replace(/\{\{density\}\}/g, '稍低密度')
      .replace(/\{\{boundary\}\}/g, '欠清')
      .replace(/\{\{apEnhance\}\}/g, '明显强化')
      .replace(/\{\{vpEnhance\}\}/g, '廓清')
      .replace(/\{\{dpEnhance\}\}/g, '低密度')
      .replace(/\{\{level\}\}/g, 'L4/5')
      .replace(/\{\{direction\}\}/g, '后方')
      .replace(/\{\{compressNerve\}\}/g, '压迫硬膜囊及左侧神经根')
      .replace(/\{\{canal\}\}/g, '狭窄')
      .replace(/\{\{density\}\}/g, '混合型致密')
      .replace(/\{\{bone\}\}/g, '右桡骨')
      .replace(/\{\{type\}\}/g, '横行')
      .replace(/\{\{displacement\}\}/g, '骨折远端向背侧移位')
      .replace(/\{\{angulation\}\}/g, '向背侧成角')
      .replace(/\{\{softTissue\}\}/g, '肿胀');
  };

  const filledContent = selected ? renderWithPlaceholders(editedContent) : '';

  // 复制到剪贴板
  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    message.success('已复制到剪贴板！');
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={20} color="#3b82f6" /> 报告短语库
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            {phrases.length} 短语 · 6 分类 · 占位符替换 · 一键复制 · 评分系统
          </p>
        </div>
        <button
          style={{
            padding: '6px 12px', border: 'none', borderRadius: 6,
            background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Plus size={12} /> 新建短语
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
        {PHRASE_CATEGORIES.map(c => {
          const Icon = c.key === 'critical' ? AlertOctagon : c.key === 'normal' ? CheckCircle2 : c.key === 'abnormal' ? AlertOctagon : c.key === 'recommendation' ? Lightbulb : c.key === 'followup' ? Hash : BookOpen;
          return (
            <div
              key={c.key}
              onClick={() => setFilterCategory(filterCategory === c.key ? 'all' : c.key)}
              style={{
                background: '#fff', padding: 10, borderRadius: 8,
                border: `2px solid ${filterCategory === c.key ? c.color : '#e2e8f0'}`,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                <Icon size={12} color={c.color} />
                <span style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{phrases.filter(p => p.category === c.key).length}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 12 }}>
        {/* 左：短语列表 */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索标题/内容/标签..."
                style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filtered.map(p => {
              const cConf = PHRASE_CATEGORIES.find(c => c.key === p.category)!;
              const isSelected = selectedPhraseId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPhraseId(p.id)}
                  style={{
                    padding: 10, borderBottom: '1px solid #f1f5f9',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    borderLeft: isSelected ? `3px solid ${cConf.color}` : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', flex: 1 }}>{p.title}</span>
                    <span style={{
                      fontSize: 12, padding: '1px 4px', borderRadius: 2,
                      background: cConf.bg, color: cConf.color, fontWeight: 600,
                    }}>{cConf.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, lineHeight: 1.4, maxHeight: 32, overflow: 'hidden' }}>
                    {p.content.slice(0, 60)}...
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                    <span>{'⭐'.repeat(p.rating)}</span>
                    <span>· ×{p.usageCount}</span>
                    {p.placeholders.length > 0 && <span style={{ padding: '0 4px', background: '#fef3c7', color: '#92400e', borderRadius: 2 }}>{p.placeholders.length} 占位符</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：短语详情 + 编辑 */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 头部 */}
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{selected.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{selected.scene}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: PHRASE_CATEGORIES.find(c => c.key === selected.category)!.bg, color: PHRASE_CATEGORIES.find(c => c.key === selected.category)!.color, fontWeight: 600 }}>
                    {PHRASE_CATEGORIES.find(c => c.key === selected.category)!.label}
                  </span>
                  <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: '#fef3c7', color: '#92400e' }}>
                    {'⭐'.repeat(selected.rating)}
                  </span>
                </div>
              </div>

              {/* 占位符提示 */}
              {placeholders.length > 0 && (
                <div style={{ marginBottom: 12, padding: 10, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>
                    💡 本短语包含 {placeholders.length} 个占位符：
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {placeholders.map(p => (
                      <span key={p} style={{ fontSize: 12, padding: '2px 8px', background: '#fff', color: '#92400e', borderRadius: 10, fontFamily: 'monospace', fontWeight: 600 }}>
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 编辑区 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>📝 原始（含占位符）</span>
                </div>
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✨ 渲染预览（占位符已替换）</span>
                  <button
                    onClick={() => handleCopy(filledContent)}
                    style={{ padding: '2px 8px', border: '1px solid #10b981', borderRadius: 3, background: '#fff', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <Copy size={10} /> 复制
                  </button>
                </div>
                <div style={{ padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
                  {filledContent}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                <button style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Edit2 size={11} /> 编辑
                </button>
                <button style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={11} /> 评分
                </button>
                <button style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                  <Copy size={11} /> 一键复制
                </button>
                <button style={{ padding: '5px 10px', border: '1px solid #dc2626', borderRadius: 4, background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Trash2 size={11} /> 删除
                </button>
              </div>
            </div>

            {/* 元信息 */}
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>📊 短语元信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <InfoCell label="作者" value={selected.author} />
                <InfoCell label="创建" value={selected.createdAt} />
                <InfoCell label="使用频次" value={selected.usageCount.toLocaleString()} color="#10b981" />
                <InfoCell label="标签数" value={String(selected.tags.length)} color="#7c3aed" />
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>🏷️ 标签</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.tags.map(t => (
                    <span key={t} style={{ fontSize: 12, padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 10 }}>#{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 元信息
// ============================================================
const InfoCell: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
    <div style={{ fontSize: 12, color: color || '#1e293b', fontWeight: 600, marginTop: 1 }}>{value}</div>
  </div>
);

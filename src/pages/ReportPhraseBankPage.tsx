// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告短语库
// Phase R7：6 分类短语 + 占位符替换 + 评分 + 复制
// [W2-A] 短语接入 templatesApi.snippets 实时 (失败回退本地演示数据 + 本地 CRUD)
// ============================================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { message, Modal, Form, Input, Select } from 'antd';
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
import { templatesApi } from '../services/api/templatesApi';

const CATEGORY_LABEL_TO_KEY: Record<string, PhraseCategory> = {
  '正常': 'normal',
  '异常': 'abnormal',
  '建议': 'recommendation',
  '随访': 'followup',
  '危急': 'critical',
  '免责': 'disclaimer',
};

const CATEGORY_KEY_TO_LABEL: Record<PhraseCategory, string> = {
  normal: '正常',
  abnormal: '异常',
  recommendation: '建议',
  followup: '随访',
  critical: '危急',
  disclaimer: '免责',
};

// ============================================================
// 主组件
// ============================================================
export default function ReportPhraseBankPage() {
  const [phrases, setPhrases] = useState<ReportPhrase[]>(REPORT_PHRASES);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<PhraseCategory | 'all'>('all');
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>('p-001');
  const [editedContent, setEditedContent] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newPhrase, setNewPhrase] = useState<{ title: string; category: PhraseCategory; content: string }>({ title: '', category: 'normal', content: '' });
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  // [W2-A] 数据源状态
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [apiError, setApiError] = useState('');

  const loadPhrases = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await templatesApi.listSnippets();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: ReportPhrase[] = res.data.map((snip: any, i: number) => {
          const content = String(snip.content || '');
          const placeholders = Array.from(content.matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1] ?? '');
          return {
            id: snip.id || `snp-${i}`,
            title: snip.name || '未命名短语',
            content,
            category: CATEGORY_LABEL_TO_KEY[String(snip.category || '')] ?? 'normal',
            bodyPart: [],
            modality: [],
            scene: '智能片段（templatesApi）',
            placeholders,
            usageCount: Number(snip.usage ?? 0),
            rating: 5,
            tags: [],
            author: '系统',
            createdAt: String(snip.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
          };
        });
        setPhrases(mapped);
        setSelectedPhraseId(mapped[0]?.id ?? null);
        setSource('api');
      } else {
        setSource('demo');
        setApiError('templatesApi 暂不可用，当前展示内置演示短语');
      }
    } catch (e) {
      setSource('demo');
      setApiError(e instanceof Error ? e.message : '短语加载失败，已回退演示数据');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPhrases(); }, [loadPhrases]);

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

  // 新建短语: API 源 → templatesApi.createSnippet; 演示源 → 本地内存
  const handleCreate = async () => {
    if (!newPhrase.title.trim()) { message.warning('请输入短语标题'); return; }
    if (!newPhrase.content.trim()) { message.warning('请输入短语内容'); return; }
    const placeholders = Array.from(newPhrase.content.matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1] ?? '');
    if (source === 'api') {
      try {
        const res = await templatesApi.createSnippet({
          name: newPhrase.title.trim(),
          content: newPhrase.content.trim(),
          category: CATEGORY_KEY_TO_LABEL[newPhrase.category] ?? '正常',
        });
        const created: ReportPhrase = {
          id: res.data?.id || `p-${Date.now()}`,
          title: newPhrase.title.trim(),
          content: newPhrase.content.trim(),
          category: newPhrase.category,
          bodyPart: [],
          modality: [],
          scene: '智能片段（templatesApi）',
          placeholders,
          usageCount: 0,
          rating: 5,
          tags: [],
          author: '当前用户',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setPhrases(prev => [created, ...prev]);
        setSelectedPhraseId(created.id);
        message.success('短语已创建（templatesApi）');
      } catch (e) {
        message.error('创建失败: ' + (e instanceof Error ? e.message : '未知错误'));
        return;
      }
    } else {
      const phrase: ReportPhrase = {
        id: `p-${Date.now()}`,
        title: newPhrase.title.trim(),
        content: newPhrase.content.trim(),
        category: newPhrase.category,
        bodyPart: [],
        modality: [],
        scene: '自定义短语',
        placeholders,
        usageCount: 0,
        rating: 5,
        tags: [],
        author: '当前用户',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setPhrases(prev => [phrase, ...prev]);
      setSelectedPhraseId(phrase.id);
      message.success('短语已创建');
    }
    setCreateOpen(false);
    setNewPhrase({ title: '', category: 'normal', content: '' });
  };

  // 编辑：聚焦内容编辑区
  const handleEditFocus = () => {
    if (!selected) return;
    setEditedContent(selected.content);
    setTimeout(() => editorRef.current?.focus(), 0);
    message.info('已进入编辑模式，修改后内容实时预览');
  };

  // 评分：本地 +1（最高 5 星）
  const handleRateUp = () => {
    if (!selected) return;
    const next = Math.min(5, selected.rating + 1);
    setPhrases(prev => prev.map(p => p.id === selected.id ? { ...p, rating: next } : p));
    message.success(`已评分 ${next} 星`);
  };

  // 删除：API 源 → templatesApi.deleteSnippet; 演示源 → 本地删除
  const handleDelete = async () => {
    if (!selected) return;
    if (source === 'api') {
      try {
        await templatesApi.deleteSnippet(selected.id);
        message.success('短语已删除（templatesApi）');
      } catch (e) {
        message.error('删除失败: ' + (e instanceof Error ? e.message : '未知错误'));
        return;
      }
    }
    setPhrases(prev => prev.filter(p => p.id !== selected.id));
    setSelectedPhraseId(phrases.filter(p => p.id !== selected.id)[0]?.id ?? null);
    setEditedContent('');
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={20} color="#3b82f6" /> 报告短语库
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? '#16a34a' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? '同步中...' : source === 'api' ? '数据源: templatesApi.snippets 实时' : '演示数据(接口不可用)'}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {phrases.length} 短语 · 6 分类 · 占位符替换 · 一键复制 · 评分系统
            {apiError && <span style={{ color: '#dc2626', marginLeft: 8 }}>{apiError}</span>}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
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
                background: 'var(--bg-card)', padding: 10, borderRadius: 8,
                border: `2px solid ${filterCategory === c.key ? c.color : '#e2e8f0'}`,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                <Icon size={12} color={c.color} />
                <span style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{phrases.filter(p => p.category === c.key).length}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 12 }}>
        {/* 左：短语列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索标题/内容/标签..."
                style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none' }}
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
                    padding: 10, borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? 'var(--color-info-bg)' : 'transparent',
                    borderLeft: isSelected ? `3px solid ${cConf.color}` : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.title}</span>
                    <span style={{
                      fontSize: 12, padding: '1px 4px', borderRadius: 2,
                      background: cConf.bg, color: cConf.color, fontWeight: 600,
                    }}>{cConf.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4, maxHeight: 32, overflow: 'hidden' }}>
                    {p.content.slice(0, 60)}...
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>{'⭐'.repeat(p.rating)}</span>
                    <span>· ×{p.usageCount}</span>
                    {p.placeholders.length > 0 && <span style={{ padding: '0 4px', background: 'var(--color-warning-bg)', color: '#92400e', borderRadius: 2 }}>{p.placeholders.length} 占位符</span>}
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
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{selected.scene}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: PHRASE_CATEGORIES.find(c => c.key === selected.category)!.bg, color: PHRASE_CATEGORIES.find(c => c.key === selected.category)!.color, fontWeight: 600 }}>
                    {PHRASE_CATEGORIES.find(c => c.key === selected.category)!.label}
                  </span>
                  <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: 'var(--color-warning-bg)', color: '#92400e' }}>
                    {'⭐'.repeat(selected.rating)}
                  </span>
                </div>
              </div>

              {/* 占位符提示 */}
              {placeholders.length > 0 && (
                <div style={{ marginBottom: 12, padding: 10, background: 'var(--color-warning-bg)', border: '1px solid #fcd34d', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>
                    💡 本短语包含 {placeholders.length} 个占位符：
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {placeholders.map(p => (
                      <span key={p} style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg-card)', color: '#92400e', borderRadius: 10, fontFamily: 'monospace', fontWeight: 600 }}>
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 编辑区 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>📝 原始（含占位符）</span>
                </div>
                <textarea
                  ref={editorRef}
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✨ 渲染预览（占位符已替换）</span>
                  <button
                    onClick={() => handleCopy(filledContent)}
                    style={{ padding: '2px 8px', border: '1px solid #10b981', borderRadius: 3, background: 'var(--bg-card)', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <Copy size={10} /> 复制
                  </button>
                </div>
                <div style={{ padding: 10, background: 'var(--color-success-bg)', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
                  {filledContent}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                <button onClick={handleEditFocus} style={{ padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Edit2 size={11} /> 编辑
                </button>
                <button onClick={handleRateUp} style={{ padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={11} /> 评分
                </button>
                <button onClick={() => handleCopy(filledContent)} style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                  <Copy size={11} /> 一键复制
                </button>
                <button onClick={() => void handleDelete()} style={{ padding: '5px 10px', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--bg-card)', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Trash2 size={11} /> 删除
                </button>
              </div>
            </div>

            {/* 元信息 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>📊 短语元信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <InfoCell label="作者" value={selected.author} />
                <InfoCell label="创建" value={selected.createdAt} />
                <InfoCell label="使用频次" value={selected.usageCount.toLocaleString()} color="#10b981" />
                <InfoCell label="标签数" value={String(selected.tags.length)} color="#7c3aed" />
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>🏷️ 标签</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.tags.map(t => (
                    <span key={t} style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-info-bg)', color: '#1e40af', borderRadius: 10 }}>#{t}</span>
                  ))}
                  {selected.tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>（无标签）</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 新建短语 Modal */}
      <Modal
        title="新建短语"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item label="短语标题" required>
            <Input
              value={newPhrase.title}
              onChange={e => setNewPhrase(p => ({ ...p, title: e.target.value }))}
              placeholder="如：胸部 CT 增强随访建议"
            />
          </Form.Item>
          <Form.Item label="分类">
            <Select
              value={newPhrase.category}
              onChange={v => setNewPhrase(p => ({ ...p, category: v }))}
              options={PHRASE_CATEGORIES.map(c => ({ value: c.key, label: `${c.label}（${c.description}）` }))}
            />
          </Form.Item>
          <Form.Item label="短语内容（支持 {{占位符}}）" required>
            <Input.TextArea
              rows={5}
              value={newPhrase.content}
              onChange={e => setNewPhrase(p => ({ ...p, content: e.target.value }))}
              placeholder="如：建议 {{timeframe}} 后复查，必要时穿刺活检明确病理。"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============================================================
// 元信息
// ============================================================
const InfoCell: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
    <div style={{ fontSize: 12, color: color || 'var(--text-primary)', fontWeight: 600, marginTop: 1 }}>{value}</div>
  </div>
);

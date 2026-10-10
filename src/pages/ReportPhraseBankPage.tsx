// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告短语库
// Phase R7：6 分类短语 + 占位符替换 + 评分 + 复制
// [W2-A] 短语接入 templatesApi.snippets 实时 (失败回退本地演示数据 + 本地 CRUD)
// ============================================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { message, Modal, Form, Input, Select, Typography } from 'antd';
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
import { reportApi } from '../services/api/reportApi';
import { useSearchParams } from 'react-router-dom';
// [v3.0.6.11-98 Wave1B P0-2] 模板变量自动填充: 预览优先用真实报告上下文, 无上下文时显示原占位符 + 说明
import { resolveTemplateVariables, describeTemplateVariables } from '../utils/templateVariables';
import { LoadingBanner, AppEmpty } from '../components/feedback';
import { t } from '../i18n/appI18n';
import { StatusTag } from '../components/common/StatusTag';
import { PageContainer } from "../components/common";

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
  // [v3.0.6.11-98 Wave1B P0-2] 报告上下文: /report-phrase-bank?reportId=xxx 时拉取真实报告上下文填充变量
  const [searchParams] = useSearchParams();
  const [varContext, setVarContext] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const reportId = searchParams.get('reportId');
    if (!reportId) return;
    let cancelled = false;
    void reportApi.getById(reportId).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const d = res.data as any;
      setVarContext({
        reportId: d.reportId ?? d.id,
        patientId: d.patientId,
        patientName: d.patientName,
        gender: d.gender,
        age: d.age,
        modality: d.modality,
        bodyPart: d.bodyPart,
        clinicalDiagnosis: d.clinicalDiagnosis ?? d.clinicalDx,
        doctorName: d.reportDoctorName ?? d.radiologistName ?? d.doctorName,
        examDate: d.examDate ?? d.studyDate,
      });
    }).catch(() => { /* 无上下文: 预览保留原占位符 */ });
    return () => { cancelled = true; };
  }, [searchParams]);

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
            title: snip.name || t('rpb.unnamedPhrase'),
            content,
            category: CATEGORY_LABEL_TO_KEY[String(snip.category || '')] ?? 'normal',
            bodyPart: [],
            modality: [],
            scene: t('rpb.sceneApi'),
            placeholders,
            usageCount: Number(snip.usage ?? 0),
            rating: 5,
            tags: [],
            author: t('rpb.system'),
            createdAt: String(snip.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
          };
        });
        setPhrases(mapped);
        setSelectedPhraseId(mapped[0]?.id ?? null);
        setSource('api');
      } else {
        setSource('demo');
        setApiError(t('rpb.apiUnavailable'));
      }
    } catch (e) {
      setSource('demo');
      setApiError(e instanceof Error ? e.message : t('rpb.loadFailed'));
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
      .replace(/\{\{softTissue\}\}/g, '肿胀')
      // [v3.0.6.11-98 Wave1B P0-2] 复制用示例值 (预览无上下文时保留原占位符)
      .replace(/\{\{patientName\}\}/g, '张三')
      .replace(/\{\{patientId\}\}/g, 'P001')
      .replace(/\{\{gender\}\}/g, '男')
      .replace(/\{\{age\}\}/g, '58')
      .replace(/\{\{modality\}\}/g, 'CT')
      .replace(/\{\{bodyPart\}\}/g, '胸部')
      .replace(/\{\{clinicalDx\}\}/g, '右肺占位')
      .replace(/\{\{priorDate\}\}/g, '2026-06-15')
      .replace(/\{\{change\}\}/g, '缩小')
      .replace(/\{\{studyDate\}\}/g, '2026-09-15')
      .replace(/\{\{hospital\}\}/g, 'G005 医院')
      .replace(/\{\{doctorName\}\}/g, '陈医师');
  };

  const filledContent = varContext
    ? resolveTemplateVariables(editedContent, varContext)
    : editedContent;

  // 复制内容: 有真实上下文用解析结果; 无上下文用示例值填充 (避免复制出裸占位符)
  const copyContent = varContext ? filledContent : renderWithPlaceholders(editedContent);

  const variableNote = (() => {
    if (!selected) return '';
    if (varContext) {
      const { resolved, unresolved } = describeTemplateVariables(editedContent, varContext);
      return `真实上下文预览: ${resolved.length > 0 ? `已自动填充 ${resolved.map((k) => `{{${k}}}`).join(',')}` : '无可自动填充变量'}${unresolved.length > 0 ? `; ${unresolved.map((k) => `{{${k}}}`).join(',')} 无上下文值,保留原样` : ''}`;
    }
    return t('rpb.noContextNote');
  })();

  // 复制到剪贴板 (权限被拒时降级 execCommand / 提示)
  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        message.success(t('rpb.copied'));
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { message.success(t('rpb.copied')); return; }
      } catch { /* fallthrough */ }
      message.warning(t('rpb.copyFailed'));
    }
  };

  // 新建短语: API 源 → templatesApi.createSnippet; 演示源 → 本地内存
  const handleCreate = async () => {
    if (!newPhrase.title.trim()) { message.warning(t('rpb.titleRequired')); return; }
    if (!newPhrase.content.trim()) { message.warning(t('rpb.contentRequired')); return; }
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
          scene: t('rpb.sceneApi'),
          placeholders,
          usageCount: 0,
          rating: 5,
          tags: [],
          author: t('rpb.currentUser'),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setPhrases(prev => [created, ...prev]);
        setSelectedPhraseId(created.id);
        message.success(t('rpb.createdApi'));
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
        scene: t('rpb.customPhrase'),
        placeholders,
        usageCount: 0,
        rating: 5,
        tags: [],
        author: t('rpb.currentUser'),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setPhrases(prev => [phrase, ...prev]);
      setSelectedPhraseId(phrase.id);
      message.success(t('rpb.createdPhrase'));
    }
    setCreateOpen(false);
    setNewPhrase({ title: '', category: 'normal', content: '' });
  };

  // 编辑：聚焦内容编辑区
  const handleEditFocus = () => {
    if (!selected) return;
    setEditedContent(selected.content);
    setTimeout(() => editorRef.current?.focus(), 0);
    message.info(t('rpb.editMode'));
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
        message.success(t('rpb.deletedApi'));
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
    <PageContainer maxWidth="full" padding="var(--space-5, 20px)">
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {/* 顶部 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <MessageSquare size={20} color="var(--color-primary-500)" /> {t('rpb.title')}
            <StatusTag status="success" style={{ fontWeight: 700 }}>R7</StatusTag>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? 'var(--color-success-600)' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? t('rpb.syncing') : source === 'api' ? t('rpb.sourceApi') : t('rpb.sourceDemo')}
            </span>
          </Typography.Title>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('rpb.subtitle', { count: phrases.length })}
            {apiError && <span style={{ color: 'var(--color-error-600)', marginLeft: 'var(--space-2, 8px)' }}>{apiError}</span>}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            padding: '6px 12px', border: 'none', borderRadius: 6,
            background: 'var(--color-primary-500)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
          }}
        >
          <Plus size={12} /> {t('rpb.newPhrase')}
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
        {PHRASE_CATEGORIES.map(c => {
          const Icon = c.key === 'critical' ? AlertOctagon : c.key === 'normal' ? CheckCircle2 : c.key === 'abnormal' ? AlertOctagon : c.key === 'recommendation' ? Lightbulb : c.key === 'followup' ? Hash : BookOpen;
          return (
            <div
              key={c.key}
              onClick={() => setFilterCategory(filterCategory === c.key ? 'all' : c.key)}
              style={{
                background: 'var(--bg-card)', padding: 10, borderRadius: 8,
                border: `2px solid ${filterCategory === c.key ? c.color : 'var(--border-color, #e2e8f0)'}`,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-1, 4px)' }}>
                <Icon size={12} color={c.color} />
                <span style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{phrases.filter(p => p.category === c.key).length}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 'var(--space-3, 12px)' }}>
        {/* 左：短语列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('rpb.searchPlaceholder')}
                style={{ width: '100%', padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12,}}
              />
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filtered.length === 0 && <AppEmpty variant="no-results" minHeight={160} />}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-1, 4px)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.title}</span>
                    <span style={{
                      fontSize: 12, padding: '1px 4px', borderRadius: 2,
                      background: cConf.bg, color: cConf.color, fontWeight: 600,
                    }}>{cConf.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)', lineHeight: 1.4, maxHeight: 32, overflow: 'hidden' }}>
                    {p.content.slice(0, 60)}...
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>{''.repeat(p.rating)}</span>
                    <span>· ×{p.usageCount}</span>
                    {p.placeholders.length > 0 && <span style={{ padding: '0 4px', background: 'var(--color-warning-bg)', color: '#92400e', borderRadius: 2 }}>{t('rpb.placeholderCount', { count: p.placeholders.length })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：短语详情 + 编辑 */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {/* 头部 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>{selected.scene}</div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
                  <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: PHRASE_CATEGORIES.find(c => c.key === selected.category)!.bg, color: PHRASE_CATEGORIES.find(c => c.key === selected.category)!.color, fontWeight: 600 }}>
                    {PHRASE_CATEGORIES.find(c => c.key === selected.category)!.label}
                  </span>
                  <span style={{ fontSize: 12, padding: '1px 4px', borderRadius: 2, background: 'var(--color-warning-bg)', color: '#92400e' }}>
                    {''.repeat(selected.rating)}
                  </span>
                </div>
              </div>

              {/* 占位符提示 */}
              {placeholders.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3, 12px)', padding: 10, background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-300, #fcd34d)', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>
                    {t('rpb.placeholdersHint', { count: placeholders.length })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1, 4px)' }}>
                    {placeholders.map(p => (
                      <span key={p} style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg-card)', color: '#92400e', borderRadius: 10, fontFamily: 'monospace', fontWeight: 600 }}>
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 编辑区 */}
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1, 4px)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('rpb.rawWithPlaceholders')}</span>
                </div>
                <textarea
                  ref={editorRef}
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1, 4px)' }}>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{t('rpb.renderPreview')}{varContext ? t('rpb.realContext') : t('rpb.sample')}</span>
                  <button
                    onClick={() => handleCopy(copyContent)}
                    style={{ padding: '2px 8px', border: '1px solid #10b981', borderRadius: 3, background: 'var(--bg-card)', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <Copy size={10} /> {t('rpb.copy')}
                  </button>
                </div>
                <div style={{ padding: 10, background: 'var(--color-success-bg)', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
                  {filledContent}
                </div>
                {variableNote && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#92400e', padding: '4px 8px', background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid #fde68a', borderRadius: 4 }}>
                    {variableNote}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', paddingTop: 'var(--space-2, 8px)', borderTop: '1px solid var(--border-color)' }}>
                <button onClick={handleEditFocus} style={{ padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Edit2 size={11} /> {t('rpb.edit')}
                </button>
                <button onClick={handleRateUp} style={{ padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={11} /> {t('rpb.rate')}
                </button>
                <button onClick={() => handleCopy(copyContent)} style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: 'var(--color-primary-500)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                  <Copy size={11} /> {t('rpb.copyAll')}
                </button>
                <button onClick={() => void handleDelete()} style={{ padding: '5px 10px', border: '1px solid var(--color-error-600)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--color-error-600)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Trash2 size={11} /> {t('rpb.delete')}
                </button>
              </div>
            </div>

            {/* 元信息 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)' }}>{t('rpb.metaTitle')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2, 8px)' }}>
                <InfoCell label={t('rpb.author')} value={selected.author} />
                <InfoCell label={t('rpb.created')} value={selected.createdAt} />
                <InfoCell label={t('rpb.usageCount')} value={selected.usageCount.toLocaleString()} color="#10b981" />
                <InfoCell label={t('rpb.tagCount')} value={String(selected.tags.length)} color="#7c3aed" />
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('rpb.tags')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1, 4px)' }}>
                  {selected.tags.map(t => (
                    <span key={t} style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-info-bg)', color: 'var(--color-primary-800)', borderRadius: 10 }}>#{t}</span>
                  ))}
                  {selected.tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('rpb.noTags')}</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 新建短语 Modal */}
      <Modal
        title={t('rpb.newPhrase')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText={t('rpb.create')}
        cancelText={t('rpb.cancel')}
        width={560}
      >
        <Form layout="vertical" size="small" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item label={t('rpb.phraseTitle')} required>
            <Input
              value={newPhrase.title}
              onChange={e => setNewPhrase(p => ({ ...p, title: e.target.value }))}
              placeholder={t('rpb.titlePlaceholder')}
            />
          </Form.Item>
          <Form.Item label={t('rpb.category')}>
            <Select
              value={newPhrase.category}
              onChange={v => setNewPhrase(p => ({ ...p, category: v }))}
              options={PHRASE_CATEGORIES.map(c => ({ value: c.key, label: `${c.label}（${c.description}）` }))}
            />
          </Form.Item>
          <Form.Item label={t('rpb.contentLabel')} required>
            <Input.TextArea
              rows={5}
              value={newPhrase.content}
              onChange={e => setNewPhrase(p => ({ ...p, content: e.target.value }))}
              placeholder={t('rpb.contentPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
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

/**
 * G005 RIS v3.0.6.11-99 (Wave 2A 报告批注) - ReportAnnotationPanel
 * 报告协作批注面板 (报告详情 Tab / 书写页侧栏复用):
 *   - 批注列表: 作者 / 引用段落高亮 / 状态 Tag / 回复 (嵌套 1 层) / 解决 / 重开 / 编辑 / 删除
 *   - 新建批注: 内容 + 引用段落 (editorSelector 提供时支持「引用选中文本」, 点击引用定位到编辑器)
 *   - 统计: 总数 / 未解决 / 按作者
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Popconfirm, Space, Tag, Tooltip, message } from 'antd';
import {
  MessageSquareText,
  Send,
  CheckCircle2,
  RotateCcw,
  Reply,
  Trash2,
  Pencil,
  Quote,
  Pin,
} from 'lucide-react';
import { reportAnnotationApi } from '../../services/api/reportAnnotationApi';
import type {
  ReportAnnotation,
  ReportAnnotationStats,
} from '../../services/api/reportAnnotationApi';
import { t } from '../../i18n/appI18n';

export interface ReportAnnotationPanelProps {
  reportId: string;
  currentUser: { id: string; name: string };
  compact?: boolean;
  maxHeight?: number;
  testIdPrefix?: string;
  /** 书写页编辑器 contentEditable 选择器 (提供时启用 引用选中/定位编辑器) */
  editorSelector?: string;
}

const timeAgo = (iso: string): string => {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('reportAnnotation.justNow');
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
};

export const ReportAnnotationPanel: React.FC<ReportAnnotationPanelProps> = ({
  reportId,
  currentUser,
  compact = false,
  maxHeight = 480,
  testIdPrefix = 'report-annotations',
  editorSelector,
}) => {
  const [items, setItems] = useState<ReportAnnotation[]>([]);
  const [stats, setStats] = useState<ReportAnnotationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const [newContent, setNewContent] = useState('');
  const [newQuote, setNewQuote] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveText, setResolveText] = useState('');

  const reload = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        reportAnnotationApi.list(reportId),
        reportAnnotationApi.stats(reportId).catch(() => null),
      ]);
      setItems(list);
      setStats(st);
    } catch {
      setItems([]);
      setStats(null);
      message.error(t('reportAnnotation.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    setReplyTo(null);
    setReplyContent('');
    setEditId(null);
    setResolveId(null);
    setNewContent('');
    setNewQuote('');
    setSelectedText('');
    void reload();
  }, [reload]);

  // 编辑器选区跟踪 (selectionchange): 引用按钮可读取选中文本
  useEffect(() => {
    if (!editorSelector) return;
    const recordSelection = () => {
      try {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const anchor = sel.anchorNode;
        if (!anchor) return;
        const editorEl = document.querySelector(editorSelector);
        if (!editorEl || !editorEl.contains(anchor)) return;
        const txt = sel.toString().trim();
        if (txt) setSelectedText(txt.slice(0, 500));
      } catch { /* noop */ }
    };
    document.addEventListener('selectionchange', recordSelection);
    return () => document.removeEventListener('selectionchange', recordSelection);
  }, [editorSelector]);

  const useSelectedText = () => {
    const txt = selectedText.trim();
    if (!txt) {
      const live = window.getSelection()?.toString().trim() ?? '';
      if (live) { setNewQuote(live.slice(0, 500)); return; }
      message.info(t('reportAnnotation.noSelection'));
      return;
    }
    setNewQuote(txt);
  };

  // 定位编辑器引用文本 (TreeWalker 查找 + Range 选中 + 滚动)
  const locateQuote = (quote: string) => {
    if (!editorSelector || !quote) return;
    try {
      const editorEl = document.querySelector(editorSelector);
      if (!editorEl) return;
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const idx = node.textContent?.indexOf(quote) ?? -1;
        if (idx >= 0) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + quote.length);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          const container = document.querySelector(editorSelector) as HTMLElement | null;
          container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      message.info(t('reportAnnotation.quoteNotFound'));
    } catch { /* noop */ }
  };

  const submitCreate = async () => {
    const content = newContent.trim();
    if (content.length < 2) {
      message.warning(t('reportAnnotation.contentMin'));
      return;
    }
    try {
      await reportAnnotationApi.create({
        reportId,
        content,
        quote: newQuote.trim() || undefined,
        authorName: currentUser.name,
      });
      setNewContent('');
      setNewQuote('');
      message.success(t('reportAnnotation.created'));
      void reload();
    } catch {
      message.error(t('reportAnnotation.createFailed'));
    }
  };

  const submitReply = async (annotationId: string) => {
    const content = replyContent.trim();
    if (content.length < 2) {
      message.warning(t('reportAnnotation.replyMin'));
      return;
    }
    try {
      await reportAnnotationApi.reply(annotationId, content, currentUser.name);
      setReplyContent('');
      setReplyTo(null);
      void reload();
    } catch {
      message.error(t('reportAnnotation.replyFailed'));
    }
  };

  const submitEdit = async (annotationId: string) => {
    const content = editContent.trim();
    if (content.length < 2) {
      message.warning(t('reportAnnotation.editMin'));
      return;
    }
    try {
      await reportAnnotationApi.update(annotationId, content);
      setEditId(null);
      void reload();
    } catch {
      message.error(t('reportAnnotation.editFailed'));
    }
  };

  const submitResolve = async (annotationId: string) => {
    try {
      await reportAnnotationApi.resolve(annotationId, resolveText.trim() || undefined);
      setResolveId(null);
      setResolveText('');
      message.success(t('reportAnnotation.resolved'));
      void reload();
    } catch {
      message.error(t('reportAnnotation.resolveFailed'));
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((a) => a.status === filter);
  }, [items, filter]);

  const isMine = (a: ReportAnnotation) =>
    !!currentUser.id && a.authorId === currentUser.id;

  return (
    <div
      data-testid={testIdPrefix}
      role="region"
      aria-label={t('reportAnnotation.panelLabel')}
      style={{
        background: 'var(--bg-primary)',
        borderRadius: 8,
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: 'var(--bg-card)' }}>
        <Space>
          <MessageSquareText size={14} color="#3b82f6" />
          <strong style={{ fontSize: 13 }}>{t('reportAnnotation.title')}</strong>
          {stats ? (
            <Space size={2}>
              <Tag color="blue" style={{ fontSize: 12, marginInline: 0 }}>{stats.total} {t('reportAnnotation.total')}</Tag>
              <Tag color={stats.open > 0 ? 'volcano' : 'green'} style={{ fontSize: 12, marginInline: 0 }}>{stats.open} {t('reportAnnotation.open')}</Tag>
            </Space>
          ) : (
            <Tag color="default" style={{ fontSize: 12, marginInline: 0 }}>{t('reportAnnotation.noData')}</Tag>
          )}
        </Space>
        <div style={{ marginTop: 6 }}>
          <Space size={4}>
            {(['all', 'open', 'resolved'] as const).map((s) => (
              <Button
                key={s}
                size="small"
                type={filter === s ? 'primary' : 'default'}
                onClick={() => setFilter(s)}
                data-testid={`${testIdPrefix}-filter-${s}`}
              >
                {s === 'all' ? t('reportAnnotation.filterAll') : s === 'open' ? t('reportAnnotation.open') : t('reportAnnotation.resolvedTag')}
              </Button>
            ))}
            {stats && stats.byAuthor.length > 0 && (
              <Tooltip
                title={
                  <div>
                    {stats.byAuthor.map((b) => (
                      <div key={b.authorId || b.authorName} style={{ fontSize: 12 }}>
                        {b.authorName}: {b.count} {t('reportAnnotation.items')} ({b.open} {t('reportAnnotation.open')})
                      </div>
                    ))}
                  </div>
                }
              >
                <Tag color="purple" style={{ fontSize: 12, cursor: 'pointer' }}>{t('reportAnnotation.byAuthor')}</Tag>
              </Tooltip>
            )}
          </Space>
        </div>
      </div>

      <div style={{ padding: 8, background: 'var(--bg-card)', borderBottom: '1px solid #e2e8f0' }}>
        <Input.TextArea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={t('reportAnnotation.newPlaceholder')}
          rows={compact ? 1 : 2}
          data-testid={`${testIdPrefix}-new-input`}
        />
        {newQuote && (
          <div style={{ marginTop: 6 }}>
            <Tooltip title={t('reportAnnotation.quoteTooltip')} trigger="click">
              <Tag color="gold" style={{ whiteSpace: 'pre-wrap', maxHeight: 64, overflow: 'auto' }} icon={<Quote size={11} />}>
                {newQuote}
              </Tag>
            </Tooltip>
            <Button size="small" type="text" aria-label={t('reportAnnotation.clearQuote')} onClick={() => setNewQuote('')}>
              {t('reportAnnotation.clearQuote')}
            </Button>
          </div>
        )}
        <Space style={{ marginTop: 6 }} wrap>
          {editorSelector ? (
            <Button size="small" icon={<Pin size={11} />} onClick={useSelectedText} data-testid={`${testIdPrefix}-use-selection`}>
              {t('reportAnnotation.quoteSelection')}
            </Button>
          ) : (
            <Input
              size="small"
              placeholder={t('reportAnnotation.quotePlaceholder')}
              value={newQuote}
              onChange={(e) => setNewQuote(e.target.value.slice(0, 500))}
              style={{ width: 200 }}
              data-testid={`${testIdPrefix}-quote-input`}
            />
          )}
          <Button
            size="small"
            type="primary"
            icon={<Send size={11} />}
            onClick={() => void submitCreate()}
            disabled={!newContent.trim()}
            data-testid={`${testIdPrefix}-submit`}
          >
            {t('reportAnnotation.publish')}
          </Button>
        </Space>
      </div>

      <div style={{ maxHeight, overflowY: 'auto' }} data-testid={`${testIdPrefix}-list`}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{t('reportAnnotation.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            <MessageSquareText size={20} style={{ opacity: 0.4 }} />
            <div style={{ marginTop: 6 }}>{t('reportAnnotation.empty')}</div>
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              data-testid={`${testIdPrefix}-item-${a.id}`}
              style={{
                padding: compact ? '6px 8px' : '10px 12px',
                background: a.status === 'resolved' ? '#f0fdf4' : 'var(--bg-card)',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isMine(a) ? '#3b82f6' : '#64748b',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {(a.authorName || '?').charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space size={4} wrap>
                    <strong style={{ fontSize: 12, color: '#0f172a' }}>{a.authorName}</strong>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(a.createdAt)}</span>
                    {isMine(a) && <Tag color="cyan" style={{ fontSize: 12, marginInline: 0 }}>{t('reportAnnotation.me')}</Tag>}
                    {a.editedAt && <Tag style={{ fontSize: 12, marginInline: 0 }}>{t('reportAnnotation.edited')}</Tag>}
                    <Tag
                      color={a.status === 'open' ? 'volcano' : 'green'}
                      style={{ fontSize: 12, marginInline: 0 }}
                      data-testid={`${testIdPrefix}-status-${a.id}`}
                    >
                      {a.status === 'open' ? t('reportAnnotation.open') : t('reportAnnotation.resolvedTag')}
                    </Tag>
                  </Space>
                  {a.quote ? (
                    <div
                      style={{
                        marginTop: 4,
                        padding: '4px 8px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#92400e',
                        cursor: editorSelector ? 'pointer' : 'default',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      onClick={() => locateQuote(a.quote ?? '')}
                      title={editorSelector ? t('reportAnnotation.locateTitle') : undefined}
                      data-testid={`${testIdPrefix}-quote-${a.id}`}
                    >
                      <Quote size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
                      {a.quote}
                    </div>
                  ) : null}
                  {editId === a.id ? (
                    <div style={{ marginTop: 4 }}>
                      <Input.TextArea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        data-testid={`${testIdPrefix}-edit-input-${a.id}`}
                      />
                      <Space style={{ marginTop: 4 }}>
                        <Button size="small" type="primary" onClick={() => void submitEdit(a.id)}>{t('reportAnnotation.save')}</Button>
                        <Button size="small" onClick={() => setEditId(null)}>{t('reportAnnotation.cancel')}</Button>
                      </Space>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#334155', marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {a.content}
                    </div>
                  )}
                  {resolveId === a.id && (
                    <div style={{ marginTop: 4 }}>
                      <Input
                        size="small"
                        value={resolveText}
                        onChange={(e) => setResolveText(e.target.value)}
                        placeholder={t('reportAnnotation.resolvePlaceholder')}
                        data-testid={`${testIdPrefix}-resolve-input-${a.id}`}
                      />
                      <Space style={{ marginTop: 4 }}>
                        <Button size="small" type="primary" onClick={() => void submitResolve(a.id)}>{t('reportAnnotation.confirmResolve')}</Button>
                        <Button size="small" onClick={() => { setResolveId(null); setResolveText(''); }}>{t('reportAnnotation.cancel')}</Button>
                      </Space>
                    </div>
                  )}
                  {a.replies.map((r) => (
                    <div key={r.id} style={{ marginTop: 6, marginLeft: 8, paddingLeft: 10, borderLeft: '2px solid #e2e8f0' }}>
                      <Space size={4} wrap>
                        <strong style={{ fontSize: 11, color: '#0f172a' }}>{r.authorName}</strong>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(r.createdAt)}</span>
                      </Space>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {r.content}
                      </div>
                    </div>
                  ))}
                  {a.status === 'resolved' && a.resolution && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4, padding: '4px 8px' }}>
                      {t('reportAnnotation.resolution')}: {a.resolution} ({a.resolvedBy ?? ''} · {timeAgo(a.resolvedAt ?? '')})
                    </div>
                  )}
                  <Space size={4} style={{ marginTop: 4 }} wrap>
                    <Button
                      size="small"
                      type="text"
                      icon={<Reply size={11} />}
                      onClick={() => setReplyTo(replyTo === a.id ? null : a.id)}
                      aria-label={t('reportAnnotation.reply')}
                    >
                      {t('reportAnnotation.reply')}
                    </Button>
                    {a.status !== 'resolved' && (
                      <Button
                        size="small"
                        type="text"
                        icon={<CheckCircle2 size={11} />}
                        onClick={() => { setResolveId(a.id); setResolveText(''); }}
                        aria-label={t('reportAnnotation.resolve')}
                      >
                        {t('reportAnnotation.resolve')}
                      </Button>
                    )}
                    {a.status === 'resolved' && (
                      <Button
                        size="small"
                        type="text"
                        icon={<RotateCcw size={11} />}
                        onClick={() => { void reportAnnotationApi.reopen(a.id).then(() => reload()); }}
                        aria-label={t('reportAnnotation.reopen')}
                      >
                        {t('reportAnnotation.reopen')}
                      </Button>
                    )}
                    {isMine(a) && a.status !== 'resolved' && (
                      <Button
                        size="small"
                        type="text"
                        icon={<Pencil size={11} />}
                        onClick={() => { setEditId(a.id); setEditContent(a.content); }}
                        aria-label={t('reportAnnotation.edit')}
                      >
                        {t('reportAnnotation.edit')}
                      </Button>
                    )}
                    {isMine(a) && (
                      <Popconfirm
                        title={t('reportAnnotation.confirmDelete')}
                        onConfirm={() => { void reportAnnotationApi.remove(a.id).then(() => reload()); }}
                      >
                        <Button size="small" type="text" danger icon={<Trash2 size={11} />} aria-label={t('reportAnnotation.delete')} />
                      </Popconfirm>
                    )}
                  </Space>
                  {replyTo === a.id && (
                    <div style={{ marginTop: 6 }}>
                      <Input.TextArea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        rows={2}
                        placeholder={t('reportAnnotation.replyPlaceholder', { name: a.authorName })}
                        data-testid={`${testIdPrefix}-reply-input-${a.id}`}
                      />
                      <Space style={{ marginTop: 4 }}>
                        <Button size="small" type="primary" icon={<Send size={11} />} onClick={() => void submitReply(a.id)}>
                          {t('reportAnnotation.send')}
                        </Button>
                        <Button size="small" onClick={() => { setReplyTo(null); setReplyContent(''); }}>
                          {t('reportAnnotation.cancel')}
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReportAnnotationPanel;

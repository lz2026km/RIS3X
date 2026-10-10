/**
 * G005 RIS v3.0.7 - 线程化评论 UI (CommentThread)
 *
 *  - 列出所有 thread (按状态 / 时间排序)
 *  - 单条 thread 展示根 + 回复
 *  - 支持新增 thread / 回复 / 解决 / 重开 / 反应 emoji
 *  - 通过 CommentService 订阅数据
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, Tag, Tooltip, message } from 'antd';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  RotateCcw,
  Reply,
  AtSign,
  Smile,
  Trash2,
  ThumbsUp,
  HelpCircle,
  Sparkles,
  Heart,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { commentService } from '../../services/collab/CommentService';
import type {
  CollabCommentThread,
  CollabComment,
  CollabCommentStatus,
} from '../../types/collab';

export interface CommentThreadProps {
  reportId: string;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  /** 默认过滤状态 */
  defaultStatus?: CollabCommentStatus | 'all';
  /** 紧凑模式(用于侧栏) */
  compact?: boolean;
  /** 滚动容器最大高度 */
  maxHeight?: number;
  testIdPrefix?: string;
}

type ReactionIcon = LucideIcon;

const REACTION_OPTIONS: { key: string; Icon: ReactionIcon; label: string }[] = [
  { key: 'like', Icon: ThumbsUp, label: '赞同' },
  { key: 'approve', Icon: CheckCircle2, label: '认可' },
  { key: 'ok', Icon: Sparkles, label: '支持' },
  { key: 'think', Icon: HelpCircle, label: '待议' },
  { key: 'note', Icon: StickyNote, label: '备注' },
  { key: 'thanks', Icon: Heart, label: '感谢' },
];

const REACTION_ICON_MAP: Record<string, ReactionIcon> = REACTION_OPTIONS.reduce(
  (acc, r) => ({ ...acc, [r.key]: r.Icon }),
  {},
);

const timeAgo = (iso: string): string => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
};

export const CommentThread: React.FC<CommentThreadProps> = ({
  reportId,
  currentUser,
  defaultStatus = 'all',
  compact = false,
  maxHeight = 480,
  testIdPrefix = 'collab-comments',
}) => {
  const [threads, setThreads] = useState<CollabCommentThread[]>([]);
  const [filter, setFilter] = useState<CollabCommentStatus | 'all'>(defaultStatus);
  const [newContent, setNewContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [activeEmojiFor, setActiveEmojiFor] = useState<string | null>(null);

  const reload = () => {
    const list = commentService.list({ reportId });
    setThreads(list);
  };

  useEffect(() => {
    reload();
    const unsub = commentService.subscribe(() => reload());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return threads;
    return threads.filter((t) => t.status === filter);
  }, [threads, filter]);

  const submit = () => {
    const text = newContent.trim();
    if (text.length < 2) {
      message.warning('评论内容不能少于 2 字符');
      return;
    }
    commentService.add({
      reportId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      content: text,
      mentions,
    });
    setNewContent('');
    setMentions([]);
  };

  const submitReply = (parentId: string) => {
    const text = replyContent.trim();
    if (text.length < 2) {
      message.warning('回复内容不能少于 2 字符');
      return;
    }
    commentService.reply({
      parentId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      content: text,
      mentions,
    });
    setReplyContent('');
    setReplyTo(null);
    setMentions([]);
  };

  const resolve = (t: CollabCommentThread) => {
    commentService.resolve(t.id, currentUser.id, currentUser.name);
    message.success(`已解决: ${t.root.content.slice(0, 24)}…`);
  };

  const reopen = (t: CollabCommentThread) => {
    commentService.reopen(t.id);
  };

  const removeThread = (t: CollabCommentThread) => {
    commentService.delete(t.id);
  };

  const addMention = () => {
    setMentions((prev) => Array.from(new Set([...prev, 'D001', 'D006'])));
    setNewContent((p) => `${p} @张明远 @赵雪琴 `);
  };

  const renderComment = (c: CollabComment, isRoot: boolean) => {
    const isAuthor = c.authorId === currentUser.id;
    return (
      <div
        key={c.id}
        data-testid={`${testIdPrefix}-item-${c.id}`}
        style={{
          padding: compact ? '6px 8px' : '10px 12px',
          background: c.status === 'resolved' ? '#f0fdf4' : 'var(--bg-card)',
          borderBottom: '1px solid #f1f5f9',
          opacity: c.status === 'archived' ? 0.55 : 1,
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: c.authorColor,
              color: 'white',
              fontWeight: 600,
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {c.authorName.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space size={4} wrap>
              <strong style={{ fontSize: 12, color: '#0f172a' }}>{c.authorName}</strong>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(c.createdAt)}</span>
              {isAuthor && <Tag color="cyan" style={{ fontSize: 12, marginInline: 0 }}>我</Tag>}
              {c.editedAt && <Tag style={{ fontSize: 12, marginInline: 0 }}>已编辑</Tag>}
              {c.recalled && <Tag color="default" style={{ fontSize: 12, marginInline: 0 }}>已撤回</Tag>}
            </Space>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 'var(--space-1, 4px)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {c.content}
            </div>
            {c.mentions.length > 0 && (
              <div style={{ marginTop: 'var(--space-1, 4px)' }}>
                {c.mentions.map((m) => (
                  <Tag key={m} color="blue" style={{ fontSize: 12 }}>
                    @{m}
                  </Tag>
                ))}
              </div>
            )}
            {c.reactions.length > 0 && (
              <div style={{ marginTop: 'var(--space-1, 4px)', display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
                {c.reactions.map((r) => {
                  const ReactionIco = REACTION_ICON_MAP[r.emoji];
                  return (
                    <span
                      key={r.emoji}
                      data-testid={`${testIdPrefix}-reaction-${c.id}-${r.emoji}`}
                      onClick={() => commentService.removeReaction(c.id, r.emoji, currentUser.id)}
                      style={{
                        padding: '2px 8px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      {ReactionIco ? <ReactionIco size={12} /> : r.emoji} {r.userIds.length}
                    </span>
                  );
                })}
              </div>
            )}
            <Space size={4} style={{ marginTop: 'var(--space-1, 4px)' }}>
              <Button
                size="small"
                type="text"
                icon={<Reply size={11} />}
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                aria-label="回复"
              >
                回复
              </Button>
              <Button
                size="small"
                type="text"
                icon={<Smile size={11} />}
                onClick={() => setActiveEmojiFor(activeEmojiFor === c.id ? null : c.id)}
                aria-label="添加反应"
              >
                反应
              </Button>
              {isRoot && c.status !== 'resolved' && (
                <Button
                  size="small"
                  type="text"
                  icon={<CheckCircle2 size={11} />}
                  onClick={() => {
                    const t = threads.find((x) => x.id === c.threadId);
                    if (t) resolve(t);
                  }}
                  aria-label="解决"
                >
                  解决
                </Button>
              )}
              {isRoot && c.status === 'resolved' && (
                <Button
                  size="small"
                  type="text"
                  icon={<RotateCcw size={11} />}
                  onClick={() => {
                    const t = threads.find((x) => x.id === c.threadId);
                    if (t) reopen(t);
                  }}
                >
                  重开
                </Button>
              )}
              {isRoot && c.authorId === currentUser.id && c.status !== 'resolved' && (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<Trash2 size={11} />}
                  onClick={() => {
                    const t = threads.find((x) => x.id === c.threadId);
                    if (t) removeThread(t);
                  }}
                  aria-label="删除"
                />
              )}
            </Space>
            {activeEmojiFor === c.id && (
              <div style={{ marginTop: 'var(--space-1, 4px)', display: 'flex', gap: 'var(--space-1, 4px)' }}>
                {REACTION_OPTIONS.map(({ key, Icon: ReactionIco, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    onClick={() => {
                      commentService.addReaction(c.id, key, currentUser.id);
                      setActiveEmojiFor(null);
                    }}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <ReactionIco size={13} />
                  </button>
                ))}
              </div>
            )}
            {replyTo === c.id && (
              <div style={{ marginTop: 6 }}>
                <Input.TextArea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={2}
                  placeholder={`回复 ${c.authorName}…`}
                  data-testid={`${testIdPrefix}-reply-input-${c.id}`}
                />
                <Space style={{ marginTop: 'var(--space-1, 4px)' }}>
                  <Button size="small" type="primary" icon={<Send size={11} />} onClick={() => submitReply(c.id)}>
                    发送
                  </Button>
                  <Button size="small" onClick={() => { setReplyTo(null); setReplyContent(''); }}>
                    取消
                  </Button>
                </Space>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid={testIdPrefix}
      role="region"
      aria-label="协同评论"
      style={{ background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: 'var(--bg-card)' }}>
        <Space>
          <MessageSquare size={14} color="var(--color-primary-500)" />
          <strong style={{ fontSize: 12 }}>评论协作</strong>
          <Tag color="blue">{filtered.length}</Tag>
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
                {s === 'all' ? '全部' : s === 'open' ? '未解决' : '已解决'}
              </Button>
            ))}
          </Space>
        </div>
      </div>
      <div style={{ padding: 'var(--space-2, 8px)', background: 'var(--bg-card)', borderBottom: '1px solid #e2e8f0' }}>
        <Input.TextArea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="开启新评论 / 讨论..."
          rows={compact ? 1 : 2}
          data-testid={`${testIdPrefix}-new-input`}
        />
        <Space style={{ marginTop: 6 }}>
          <Button size="small" icon={<AtSign size={11} />} onClick={addMention}>
            提及
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<Send size={11} />}
            onClick={submit}
            disabled={!newContent.trim()}
            data-testid={`${testIdPrefix}-submit`}
          >
            发布
          </Button>
          {mentions.length > 0 && <span style={{ fontSize: 12, color: 'var(--color-primary-500)' }}>@ {mentions.join(', ')}</span>}
        </Space>
      </div>
      <div style={{ maxHeight, overflowY: 'auto' }} data-testid={`${testIdPrefix}-list`}>
        {filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-6, 24px)', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            <Tooltip title="没有匹配的评论">
              <MessageSquare size={20} style={{ opacity: 0.4 }} />
            </Tooltip>
            <div style={{ marginTop: 6 }}>暂无评论</div>
          </div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} data-testid={`${testIdPrefix}-thread-${t.id}`}>
              {renderComment(t.root, true)}
              {t.replies.map((r) => renderComment(r, false))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentThread;

/**
 * G005 RIS v3.0.5.1 - R3.REVIEW.063 R3.REVIEW.064 ReviewCommentThread 批注
 */
import React, { useEffect, useState } from 'react';
import { Input, Button, List, Space, Tag, Avatar, message } from 'antd';
import { Send, AtSign, CheckCircle2, Reply, MessageCircle } from 'lucide-react';
import { reviewService } from '../../../../services/review/reviewService';
import type { ReviewComment } from '../../../types/R3/R3.REVIEW';

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

const COLORS = ['#dc2626', '#7c3aed', '#0891b2', '#10b981', '#f59e0b', '#a855f7'];

export interface ReviewCommentThreadProps {
  taskId: string;
  currentUserId: string;
  currentUserName: string;
}

export const ReviewCommentThread: React.FC<ReviewCommentThreadProps> = ({
  taskId,
  currentUserId,
  currentUserName,
}) => {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await reviewService.listComments(taskId);
      setComments(data);
    } catch (e) {
      message.error('加载批注失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const submit = async () => {
    if (!content.trim() || content.trim().length < 2) {
      message.warning('批注内容不能少于 2 字符');
      return;
    }
    try {
      const created = await reviewService.addComment(
        taskId,
        currentUserId,
        currentUserName,
        content,
        mentions,
      );
      setComments((prev) => [...prev, created]);
      setContent('');
      setMentions([]);
      message.success('批注已添加');
    } catch (e) {
      message.error('添加批注失败');
    }
  };

  const resolve = async (commentId: string) => {
    try {
      const updated = await reviewService.resolveComment(commentId, currentUserId, currentUserName);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      message.success('批注已解决');
    } catch (e) {
      message.error('操作失败');
    }
  };

  const reply = (parentId: string) => {
    setContent((prev) => prev + ` @${parentId} `);
  };

  const insertMention = () => {
    setMentions(['D001', 'D006']);
    setContent((prev) => prev + ' @张三 @李四 ');
  };

  return (
    <div data-testid="review-comment-thread" role="region" aria-label="审核批注">
      <div
        style={{
          background: 'var(--bg-primary)',
          padding: '8px 12px',
          borderRadius: 6,
          marginBottom: 8,
          border: '1px solid var(--border-color)',
        }}
      >
        <Space style={{ width: '100%' }}>
          <MessageCircle size={14} color="#3b82f6" />
          <strong style={{ fontSize: 13 }}>审核批注</strong>
          <Tag color="purple">R3.REVIEW.063</Tag>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{comments.length} 条</span>
        </Space>
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 6,
          border: '1px solid var(--border-color)',
          padding: 8,
          marginBottom: 8,
        }}
      >
        <Input.TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="添加批注... 使用 @ 提及医生"
          rows={2}
          maxLength={500}
          showCount
          aria-label="批注输入"
          data-testid="comment-input"
        />
        <Space style={{ marginTop: 6 }}>
          <Button size="small" icon={<AtSign size={12} />} onClick={insertMention}>
            提及
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<Send size={12} />}
            onClick={submit}
            disabled={!content.trim()}
          >
            发布
          </Button>
          {mentions.length > 0 && (
            <span style={{ fontSize: 12, color: '#3b82f6' }}>@ {mentions.join(', ')}</span>
          )}
        </Space>
      </div>

      <List
        loading={loading}
        dataSource={comments}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 6,
          border: '1px solid var(--border-color)',
          maxHeight: 400,
          overflowY: 'auto',
        }}
        locale={{ emptyText: '暂无批注' }}
        renderItem={(c) => {
          const colorIdx = c.authorId.charCodeAt(0) % COLORS.length;
          return (
            <List.Item
              key={c.id}
              data-testid={`comment-${c.id}`}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f1f5f9',
                background: c.resolved ? '#f0fdf4' : 'transparent',
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar size={32} style={{ background: c.authorColor || COLORS[colorIdx] }}>
                    {c.authorName[0]}
                  </Avatar>
                }
                title={
                  <Space>
                    <strong style={{ fontSize: 13 }}>{c.authorName}</strong>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(c.createdAt)}</span>
                    {c.resolved && (
                      <Tag color="green" icon={<CheckCircle2 size={10} />}>
                        已解决
                      </Tag>
                    )}
                    {c.mentions.length > 0 &&
                      c.mentions.map((m: string) => (
                        <Tag key={m} color="blue">
                          @{m}
                        </Tag>
                      ))}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#334155' }}>{c.content}</div>
                    <Space size="small" style={{ marginTop: 4 }}>
                      <Button
                        size="small"
                        type="text"
                        icon={<Reply size={10} />}
                        onClick={() => reply(c.id)}
                        aria-label="回复"
                      >
                        回复
                      </Button>
                      {!c.resolved && (
                        <Button
                          size="small"
                          type="text"
                          icon={<CheckCircle2 size={10} />}
                          onClick={() => resolve(c.id)}
                          aria-label="标记解决"
                        >
                          解决
                        </Button>
                      )}
                    </Space>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default ReviewCommentThread;

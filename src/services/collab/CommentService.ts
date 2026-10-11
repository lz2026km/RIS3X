/**
 * G005 RIS v3.0.7 - 线程化评论服务 (Comment Service)
 *
 *  - add(thread)   新建根评论 (即开启一条 thread)
 *  - reply(id, msg) 对任意评论 (根 / 回复) 进行回复
 *  - resolve(id)   标记 thread 已解决
 *  - reopen(id)    重新打开
 *  - delete(id)    软删除 (archived)
 *  - get(threadId) 获取完整线程 (根 + 回复)
 *  - list(reportId, opts) 按报告 / 状态过滤
 */

import type {
  CollabComment,
  CollabCommentThread,
  CollabCommentStatus,
} from '../../types/collab';
import { COLLAB_COMMENTS } from '../../data/collabMock';
import { webSocketCollabService } from './WebSocketCollabService';

const comments = new Map<string, CollabComment>();
const threads = new Map<string, CollabCommentThread>();
let seedLoaded = false;

const generateId = (): string => `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const generateThreadId = (): string => `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const recomputeThread = (threadId: string): CollabCommentThread | null => {
  const root = comments.get(threadId);
  if (!root) return null;
  const all = Array.from(comments.values()).filter((c) => c.threadId === threadId);
  const replies = all.filter((c) => c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const participants = Array.from(new Set(all.map((c) => c.authorId)));
  const last = all.reduce((acc, c) => (c.updatedAt > acc ? c.updatedAt : acc), root.createdAt);
  const thread: CollabCommentThread = {
    id: threadId,
    reportId: root.reportId,
    root,
    replies,
    participants,
    status: root.status,
    createdAt: root.createdAt,
    lastActivityAt: last,
    unreadFor: threadId && root.status === 'open' ? [] : [],
  };
  threads.set(threadId, thread);
  return thread;
};

const seedFromMock = (): void => {
  if (seedLoaded) return;
  seedLoaded = true;
  try {
    // [B-11] ESM 下 require() 恒抛 ReferenceError (被 catch 吞掉导致协同评论 demo 永远空),
    //        改为模块顶层静态 import 的 COLLAB_COMMENTS
    COLLAB_COMMENTS?.forEach((c) => {
      comments.set(c.id, { ...c });
      recomputeThread(c.threadId);
    });
  } catch {
    /* missing mock — empty state is OK */
  }
};

export interface AddThreadInput {
  reportId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  mentions?: string[];
  fieldRef?: string;
  selectionRef?: string;
  position?: { x: number; y: number };
}

export interface ReplyInput {
  parentId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  mentions?: string[];
}

export interface CommentService {
  add(input: AddThreadInput): CollabCommentThread;
  reply(input: ReplyInput): CollabComment | null;
  resolve(threadId: string, resolverId: string, resolverName: string): CollabCommentThread | null;
  reopen(threadId: string): CollabCommentThread | null;
  delete(threadId: string): boolean;
  get(threadId: string): CollabCommentThread | null;
  list(filter?: { reportId?: string; status?: CollabCommentStatus | CollabCommentStatus[]; authorId?: string }): CollabCommentThread[];
  addReaction(commentId: string, emoji: string, userId: string): CollabComment | null;
  removeReaction(commentId: string, emoji: string, userId: string): CollabComment | null;
  countUnresolved(reportId?: string): number;
  /** 订阅变化 */
  subscribe(handler: (threads: CollabCommentThread[]) => void): () => void;
}

const listeners = new Set<(threads: CollabCommentThread[]) => void>();

const notify = (): void => {
  const snapshot = Array.from(threads.values());
  listeners.forEach((l) => { try { l(snapshot); } catch { /* swallow */ } });
};

export const commentService: CommentService = {
  add(input) {
    seedFromMock();
    const now = new Date().toISOString();
    const threadId = generateThreadId();
    const root: CollabComment = {
      id: threadId,
      threadId,
      reportId: input.reportId,
      authorId: input.authorId,
      authorName: input.authorName,
      authorColor: input.authorColor,
      content: input.content,
      mentions: input.mentions ?? [],
      fieldRef: input.fieldRef,
      selectionRef: input.selectionRef,
      position: input.position,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replyCount: 0,
      reactions: [],
    };
    comments.set(threadId, root);
    const thread = recomputeThread(threadId)!;
    webSocketCollabService.broadcast({
      type: 'comment-add',
      userId: input.authorId,
      userName: input.authorName,
      payload: { thread },
    });
    notify();
    return thread;
  },

  reply(input) {
    seedFromMock();
    const parent = comments.get(input.parentId);
    if (!parent) return null;
    const threadId = parent.threadId;
    const now = new Date().toISOString();
    const replyComment: CollabComment = {
      id: generateId(),
      threadId,
      parentId: parent.id,
      reportId: parent.reportId,
      authorId: input.authorId,
      authorName: input.authorName,
      authorColor: input.authorColor,
      content: input.content,
      mentions: input.mentions ?? [],
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replyCount: 0,
      reactions: [],
    };
    comments.set(replyComment.id, replyComment);
    const root = comments.get(threadId);
    if (root) {
      root.replyCount += 1;
      root.updatedAt = now;
      comments.set(threadId, root);
    }
    const thread = recomputeThread(threadId);
    webSocketCollabService.broadcast({
      type: 'comment-reply',
      userId: input.authorId,
      userName: input.authorName,
      payload: { thread, reply: replyComment },
    });
    notify();
    return replyComment;
  },

  resolve(threadId, resolverId, resolverName) {
    const root = comments.get(threadId);
    if (!root) return null;
    const now = new Date().toISOString();
    root.status = 'resolved';
    root.resolvedAt = now;
    root.resolvedBy = resolverId;
    root.resolvedByName = resolverName;
    root.updatedAt = now;
    comments.set(threadId, root);
    const thread = recomputeThread(threadId);
    webSocketCollabService.broadcast({
      type: 'comment-resolve',
      userId: resolverId,
      userName: resolverName,
      payload: { threadId },
    });
    notify();
    return thread;
  },

  reopen(threadId) {
    const root = comments.get(threadId);
    if (!root) return null;
    root.status = 'open';
    root.resolvedAt = undefined;
    root.resolvedBy = undefined;
    root.resolvedByName = undefined;
    root.updatedAt = new Date().toISOString();
    comments.set(threadId, root);
    return recomputeThread(threadId);
  },

  delete(threadId) {
    const root = comments.get(threadId);
    if (!root) return false;
    root.status = 'archived';
    comments.set(threadId, root);
    Array.from(comments.values())
      .filter((c) => c.threadId === threadId)
      .forEach((c) => { c.status = 'archived'; comments.set(c.id, c); });
    recomputeThread(threadId);
    notify();
    return true;
  },

  get(threadId) {
    seedFromMock();
    return threads.get(threadId) ?? null;
  },

  list(filter) {
    seedFromMock();
    let list = Array.from(threads.values());
    if (filter?.reportId) list = list.filter((t) => t.reportId === filter.reportId);
    if (filter?.status) {
      const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
      list = list.filter((t) => allowed.includes(t.status));
    }
    if (filter?.authorId) {
      list = list.filter((t) =>
        t.root.authorId === filter.authorId || t.replies.some((r) => r.authorId === filter.authorId),
      );
    }
    return list.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  },

  addReaction(commentId, emoji, userId) {
    const c = comments.get(commentId);
    if (!c) return null;
    const r = c.reactions.find((x) => x.emoji === emoji);
    if (r) {
      if (!r.userIds.includes(userId)) r.userIds.push(userId);
    } else {
      c.reactions.push({ emoji, userIds: [userId] });
    }
    comments.set(commentId, c);
    recomputeThread(c.threadId);
    notify();
    return c;
  },

  removeReaction(commentId, emoji, userId) {
    const c = comments.get(commentId);
    if (!c) return null;
    const r = c.reactions.find((x) => x.emoji === emoji);
    if (!r) return c;
    r.userIds = r.userIds.filter((u) => u !== userId);
    if (r.userIds.length === 0) {
      c.reactions = c.reactions.filter((x) => x.emoji !== emoji);
    }
    comments.set(commentId, c);
    recomputeThread(c.threadId);
    notify();
    return c;
  },

  countUnresolved(reportId) {
    seedFromMock();
    let list = Array.from(threads.values()).filter((t) => t.status === 'open');
    if (reportId) list = list.filter((t) => t.reportId === reportId);
    return list.length;
  },

  subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },
};

export default commentService;

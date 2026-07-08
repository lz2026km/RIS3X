/**
 * G005 RIS v3.0.7 - 协同 (Collaboration/Realtime) 类型定义
 *
 * Phase T6-W7: 协同 / 实时 全面扩展 (Target ~400 upgrade pts)
 *  - WebSocket 实时服务
 *  - 用户在线状态 (Presence)
 *  - 线程化评论 (Comments / Replies)
 *  - 便签 (Sticky Notes)
 *  - 屏幕共享信令 (Mock WebRTC)
 *  - 版本对比 / 三方合并
 *  - 活动流
 *  - 即时聊天
 */

export type CollabRoomId = string;

// ============================================================
// 1. 角色 / 用户 (Presence)
// ============================================================

export type CollabRole =
  | 'doctor'
  | 'resident'
  | 'attending'
  | 'chief'
  | 'tech'
  | 'reviewer'
  | 'admin';

export type CollabUserStatus =
  | 'viewing'
  | 'editing'
  | 'idle'
  | 'speaking'
  | 'away'
  | 'offline';

export interface CollabUser {
  id: string;
  name: string;
  role: CollabRole;
  title?: string;
  department?: string;
  licenseNumber?: string;
  color: string;
  avatar?: string;
  status: CollabUserStatus;
  lastSeenAt: string;
  /** 当前查看/编辑的报告 ID */
  currentReportId?: string;
  /** 当前光标位置(字符索引) */
  cursorIndex?: number;
  /** 当前选区 [start, end] */
  selection?: { start: number; end: number };
  /** 是否正在共享屏幕 */
  screenSharing?: boolean;
  /** 当前房间 */
  roomId?: CollabRoomId;
}

// ============================================================
// 2. WebSocket 实时事件
// ============================================================

export type CollabWsEventType =
  | 'join'
  | 'leave'
  | 'cursor'
  | 'selection'
  | 'edit'
  | 'comment-add'
  | 'comment-resolve'
  | 'comment-reply'
  | 'note-add'
  | 'note-update'
  | 'note-remove'
  | 'screen-share-start'
  | 'screen-share-stop'
  | 'chat-message'
  | 'activity'
  | 'snapshot'
  | 'sync'
  | 'heartbeat';

export interface CollabWsEvent<TPayload = unknown> {
  id: string;
  type: CollabWsEventType;
  roomId: CollabRoomId;
  userId: string;
  userName?: string;
  /** ISO 时间戳 */
  timestamp: string;
  payload?: TPayload;
  /** 客户端 ID, 用于去重 */
  clientId?: string;
}

export interface CollabConnectionState {
  status: 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error';
  reconnectAttempts: number;
  lastError?: string;
  connectedAt?: string;
  latencyMs?: number;
}

// ============================================================
// 3. 评论 (Threaded Comments)
// ============================================================

export type CollabCommentStatus = 'open' | 'resolved' | 'archived';

export interface CollabComment {
  id: string;
  threadId: string;
  /** 根评论 ID (自身 = 根评论时为空) */
  parentId?: string;
  reportId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  /** @ 提及的用户 ID 列表 */
  mentions: string[];
  /** 关联字段(可选) */
  fieldRef?: string;
  /** 选区引用(可选) */
  selectionRef?: string;
  /** 锚定位置 (用于编辑器内浮层) */
  position?: { x: number; y: number };
  status: CollabCommentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  /** 回复数 (派生) */
  replyCount: number;
  /** 点赞/确认计数 */
  reactions: { emoji: string; userIds: string[] }[];
  editedAt?: string;
  recalled?: boolean;
}

export interface CollabCommentThread {
  id: string;
  reportId: string;
  /** 根评论 */
  root: CollabComment;
  /** 所有回复 (扁平) */
  replies: CollabComment[];
  /** 参与者(去重) */
  participants: string[];
  status: CollabCommentStatus;
  createdAt: string;
  lastActivityAt: string;
  unreadFor: string[];
}

// ============================================================
// 4. 便签 (Sticky Notes)
// ============================================================

export type CollabNoteColor = 'yellow' | 'pink' | 'green' | 'blue' | 'purple' | 'orange';

export interface CollabStickyNote {
  id: string;
  reportId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  title?: string;
  content: string;
  color: CollabNoteColor;
  /** 锚定到检查实例 (studyInstanceUID) */
  studyInstanceUID?: string;
  /** 锚定到图像帧索引 */
  frameIndex?: number;
  /** 屏幕坐标 (相对于 viewer) */
  position: { x: number; y: number };
  width: number;
  height: number;
  zIndex: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 5. 屏幕共享 (Mock WebRTC Signal)
// ============================================================

export type ScreenShareState =
  | 'idle'
  | 'requesting'
  | 'sharing'
  | 'paused'
  | 'stopped'
  | 'denied'
  | 'error';

export interface ScreenShareSession {
  id: string;
  roomId: CollabRoomId;
  presenterId: string;
  presenterName: string;
  state: ScreenShareState;
  /** 信令数据 (offer/answer/ice) — 模拟 */
  signaling?: {
    sdpType: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidates: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null }[];
  };
  /** 视频轨道占位 */
  streamMockUrl?: string;
  hasAudio: boolean;
  hasVideo: boolean;
  startedAt: string;
  endedAt?: string;
  /** 订阅者 */
  viewers: { userId: string; userName: string; joinedAt: string }[];
  /** 录制状态 */
  recording: boolean;
  recordingUrl?: string;
}

// ============================================================
// 6. 版本对比 / 三方合并
// ============================================================

export type VersionDiffOp = 'equal' | 'insert' | 'delete' | 'replace';

export interface VersionDiffHunk {
  op: VersionDiffOp;
  /** 旧版本起始行号 */
  oldStart: number;
  oldLines: number;
  /** 新版本起始行号 */
  newStart: number;
  newLines: number;
  /** 文本行(已分割) */
  lines: string[];
  /** 冲突标记 (用于三路合并) */
  conflict?: boolean;
}

export interface VersionDiffResult {
  fromVersionId: string;
  toVersionId: string;
  /** 总变更行数 */
  changedLines: number;
  /** 添加行数 */
  addedLines: number;
  /** 删除行数 */
  removedLines: number;
  hunks: VersionDiffHunk[];
  /** 相似度 0-100 */
  similarity: number;
  generatedAt: string;
}

export type MergeConflictResolution = 'mine' | 'theirs' | 'base' | 'manual';

export interface MergeConflictBlock {
  baseText: string;
  mineText: string;
  theirsText: string;
  resolution?: MergeConflictResolution;
  /** 手动合并结果 */
  mergedText?: string;
  resolved: boolean;
}

export interface MergeResult {
  baseVersionId: string;
  mineVersionId: string;
  theirsVersionId: string;
  mergedText: string;
  conflicts: MergeConflictBlock[];
  hasConflicts: boolean;
  /** 自动合并成功率 (0-1) */
  autoMergeRate: number;
  generatedAt: string;
}

// ============================================================
// 7. 活动流
// ============================================================

export type CollabActivityType =
  | 'join'
  | 'leave'
  | 'edit'
  | 'comment'
  | 'comment-resolve'
  | 'mention'
  | 'select'
  | 'save'
  | 'snapshot'
  | 'share'
  | 'mention-handled'
  | 'note-add'
  | 'merge'
  | 'sign';

export interface CollabActivity {
  id: string;
  reportId: string;
  userId: string;
  userName: string;
  userColor: string;
  type: CollabActivityType;
  detail: string;
  /** 关联对象 ID */
  refId?: string;
  timestamp: string;
  /** 元数据 */
  meta?: Record<string, unknown>;
}

// ============================================================
// 8. 即时聊天
// ============================================================

export type ChatMessageType = 'text' | 'system' | 'image' | 'file' | 'mention' | 'reaction';

export interface ChatReaction {
  emoji: string;
  userIds: string[];
}

export interface ChatMessage {
  id: string;
  roomId: CollabRoomId;
  authorId: string;
  authorName: string;
  authorColor: string;
  type: ChatMessageType;
  content: string;
  mentions: string[];
  /** 接收者(可选, 私聊) */
  recipientId?: string;
  replyToId?: string;
  reactions: ChatReaction[];
  createdAt: string;
  editedAt?: string;
  /** 是否已撤回 */
  recalled: boolean;
}

export interface ChatRoom {
  id: CollabRoomId;
  name: string;
  /** 关联报告 */
  reportId?: string;
  participants: string[];
  lastMessageAt: string;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
}

// ============================================================
// 9. 协同会话 (顶层聚合)
// ============================================================

export interface CollabSession {
  id: string;
  reportId: string;
  patientName?: string;
  startedAt: string;
  endedAt?: string;
  participants: string[];
  /** 当前在线用户 */
  onlineUsers: CollabUser[];
  comments: CollabComment[];
  notes: CollabStickyNote[];
  activities: CollabActivity[];
  screenShare?: ScreenShareSession;
  chatMessages: ChatMessage[];
  versions: CollabVersion[];
  /** 当前合并状态 */
  pendingMerge?: MergeResult;
}

// ============================================================
// 10. 版本
// ============================================================

export interface CollabVersion {
  id: string;
  reportId: string;
  versionNumber: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  description?: string;
  content: string;
  /** 与上一版相比的 diff 摘要 */
  diffSummary?: {
    added: number;
    removed: number;
    modified: number;
  };
  parentVersionId?: string;
  /** 标签 (e.g. 'draft', 'final', 'signed') */
  label?: string;
  checksum: string;
}

/**
 * G005 RIS v3.0.7 - 协同 (Realtime) Mock 数据
 *
 *  - 30+ 协同用户 (覆盖放射/急诊/护理/技术/主任/管理员)
 *  - 10+ 线程化评论
 *  - 多版本对比
 *  - 活动流样本
 *  - 聊天消息样本
 *  - 便签 / 屏幕共享
 */

import type {
  CollabUser,
  CollabComment,
  CollabCommentThread,
  CollabStickyNote,
  ScreenShareSession,
  ChatMessage,
  ChatRoom,
  CollabActivity,
  CollabVersion,
} from '../types/collab';

const isoMinutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const isoHoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

const COLORS = [
  'var(--color-error-600)', '#7c3aed', 'var(--color-info-600)', '#10b981', 'var(--color-warning-500)', '#a855f7',
  'var(--color-primary-500)', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
] as const;

// ============================================================
// 30+ 协同用户
// ============================================================

export const COLLAB_USERS: CollabUser[] = [
  { id: 'D001', name: '张明远', role: 'chief', title: '主任医师', department: '放射科', licenseNumber: 'L-RAD-001', color: COLORS[0], status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013', cursorIndex: 320 },
  { id: 'D002', name: '李慧敏', role: 'attending', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-002', color: COLORS[1], status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013', cursorIndex: 480 },
  { id: 'D003', name: '王建华', role: 'doctor', title: '主治医师', department: '放射科', licenseNumber: 'L-RAD-003', color: COLORS[2], status: 'viewing', lastSeenAt: isoMinutesAgo(1), currentReportId: 'RP20260619013' },
  { id: 'D004', name: '陈晓燕', role: 'resident', title: '住院医师', department: '放射科', licenseNumber: 'L-RAD-004', color: COLORS[3], status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619009', cursorIndex: 145 },
  { id: 'D005', name: '刘文博', role: 'attending', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-005', color: COLORS[4], status: 'speaking', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619018' },
  { id: 'D006', name: '赵雪琴', role: 'chief', title: '主任医师', department: '放射科', licenseNumber: 'L-RAD-006', color: COLORS[5], status: 'idle', lastSeenAt: isoMinutesAgo(3), currentReportId: 'RP20260619018' },
  { id: 'D007', name: '钱永康', role: 'attending', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-007', color: COLORS[6], status: 'viewing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013' },
  { id: 'D008', name: '孙立人', role: 'doctor', title: '主治医师', department: '放射科', licenseNumber: 'L-RAD-008', color: COLORS[7], status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619018', cursorIndex: 95 },
  { id: 'D009', name: '吴芳', role: 'chief', title: '主任医师', department: '放射科', licenseNumber: 'L-RAD-009', color: COLORS[8], status: 'away', lastSeenAt: isoMinutesAgo(8), currentReportId: 'RP20260619013' },
  { id: 'D010', name: '郑文', role: 'attending', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-010', color: COLORS[9], status: 'offline', lastSeenAt: isoHoursAgo(4) },
  { id: 'D011', name: '周婷', role: 'resident', title: '住院医师', department: '放射科', licenseNumber: 'L-RAD-011', color: COLORS[10], status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619018', cursorIndex: 60 },
  { id: 'D012', name: '吴俊杰', role: 'doctor', title: '主治医师', department: '放射科', licenseNumber: 'L-RAD-012', color: COLORS[11], status: 'viewing', lastSeenAt: isoMinutesAgo(1), currentReportId: 'RP20260619009' },
  { id: 'D013', name: '徐丽华', role: 'tech', title: '技师', department: 'CT室', licenseNumber: 'L-TEC-001', color: '#0ea5e9', status: 'viewing', lastSeenAt: isoMinutesAgo(2), currentReportId: 'RP20260619013' },
  { id: 'D014', name: '马俊辉', role: 'tech', title: '技师', department: 'MR室', licenseNumber: 'L-TEC-002', color: 'var(--color-success-500)', status: 'offline', lastSeenAt: isoHoursAgo(2) },
  { id: 'D015', name: '黄海涛', role: 'tech', title: '高级技师', department: 'CT室', licenseNumber: 'L-TEC-003', color: '#eab308', status: 'idle', lastSeenAt: isoMinutesAgo(15), currentReportId: 'RP20260619013' },
  { id: 'D016', name: '韩雪梅', role: 'doctor', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-016', color: 'var(--color-error-500)', status: 'viewing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619018' },
  { id: 'D017', name: '宋建军', role: 'doctor', title: '主治医师', department: '放射科', licenseNumber: 'L-RAD-017', color: '#f43f5e', status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013', cursorIndex: 720 },
  { id: 'D018', name: '高志远', role: 'chief', title: '主任医师', department: '放射科', licenseNumber: 'L-RAD-018', color: '#8b5cf6', status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619009', cursorIndex: 220 },
  { id: 'D019', name: '谢军', role: 'doctor', title: '主治医师', department: '放射科', licenseNumber: 'L-RAD-019', color: 'var(--color-info-500)', status: 'viewing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013' },
  { id: 'D020', name: '邓丽娟', role: 'attending', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-020', color: '#84cc16', status: 'speaking', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013' },
  { id: 'D021', name: '彭大伟', role: 'resident', title: '住院医师', department: '放射科', licenseNumber: 'L-RAD-021', color: '#f97316', status: 'idle', lastSeenAt: isoMinutesAgo(20), currentReportId: 'RP20260619018' },
  { id: 'D022', name: '苏小英', role: 'doctor', title: '主治医师', department: '放射科', licenseNumber: 'L-RAD-022', color: '#a855f7', status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619018', cursorIndex: 410 },
  { id: 'D023', name: '潘立新', role: 'attending', title: '副主任医师', department: '放射科', licenseNumber: 'L-RAD-023', color: '#14b8a6', status: 'viewing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619009' },
  { id: 'D024', name: '袁建华', role: 'resident', title: '住院医师', department: '放射科', licenseNumber: 'L-RAD-024', color: 'var(--color-primary-500)', status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013', cursorIndex: 156 },
  { id: 'D025', name: '魏娜', role: 'reviewer', title: '审核专家', department: '医务处', licenseNumber: 'L-REV-001', color: '#ec4899', status: 'viewing', lastSeenAt: isoMinutesAgo(2), currentReportId: 'RP20260619013' },
  { id: 'D026', name: '蒋大为', role: 'admin', title: '系统管理员', department: '信息科', licenseNumber: 'L-ADM-001', color: '#64748b', status: 'idle', lastSeenAt: isoMinutesAgo(30), currentReportId: 'RP20260619013' },
  { id: 'D027', name: '蔡明', role: 'doctor', title: '主治医师', department: '急诊科', licenseNumber: 'L-EMR-001', color: 'var(--color-error-600)', status: 'viewing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619018' },
  { id: 'D028', name: '丁瑶', role: 'resident', title: '住院医师', department: '急诊科', licenseNumber: 'L-EMR-002', color: '#7c3aed', status: 'editing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619009', cursorIndex: 78 },
  { id: 'D029', name: '冯刚', role: 'doctor', title: '副主任医师', department: '肿瘤科', licenseNumber: 'L-ONC-001', color: 'var(--color-info-600)', status: 'away', lastSeenAt: isoMinutesAgo(12), currentReportId: 'RP20260619013' },
  { id: 'D030', name: '顾芳', role: 'doctor', title: '主治医师', department: '肿瘤科', licenseNumber: 'L-ONC-002', color: '#10b981', status: 'viewing', lastSeenAt: isoMinutesAgo(0), currentReportId: 'RP20260619013' },
  { id: 'D031', name: '邵伟', role: 'tech', title: '技师', department: 'CT室', licenseNumber: 'L-TEC-004', color: 'var(--color-warning-500)', status: 'idle', lastSeenAt: isoMinutesAgo(45) },
  { id: 'D032', name: '夏明', role: 'resident', title: '住院医师', department: '放射科', licenseNumber: 'L-RAD-032', color: '#a855f7', status: 'offline', lastSeenAt: isoHoursAgo(6) },
];

// ============================================================
// 10+ 线程化评论 (3 threads with replies)
// ============================================================

export const COLLAB_COMMENTS: CollabComment[] = [
  // Thread 1: 肺部肿块讨论
  {
    id: 'cmt-101', threadId: 'th-101', reportId: 'RP20260619013',
    authorId: 'D001', authorName: '张明远', authorColor: COLORS[0],
    content: '右肺下叶肿块的强化特征建议补充"不均匀强化"的具体描述,包括强化峰值与延迟期对比。',
    mentions: ['D002'], fieldRef: 'findings', selectionRef: '增强扫描示不均匀强化',
    position: { x: 120, y: 280 }, status: 'open',
    createdAt: isoMinutesAgo(15), updatedAt: isoMinutesAgo(15),
    replyCount: 2, reactions: [{ emoji: 'like', userIds: ['D006', 'D018'] }],
  },
  {
    id: 'cmt-102', threadId: 'th-101', reportId: 'RP20260619013',
    parentId: 'cmt-101',
    authorId: 'D002', authorName: '李慧敏', authorColor: COLORS[1],
    content: '@张明远 已补充:动脉期 CT 值 78HU,静脉期 95HU,延迟期 82HU,呈"快进快出"强化模式。',
    mentions: ['D001'], fieldRef: 'findings',
    position: { x: 120, y: 320 }, status: 'open',
    createdAt: isoMinutesAgo(12), updatedAt: isoMinutesAgo(12),
    replyCount: 0, reactions: [{ emoji: 'approve', userIds: ['D001'] }],
  },
  {
    id: 'cmt-103', threadId: 'th-101', reportId: 'RP20260619013',
    parentId: 'cmt-101',
    authorId: 'D018', authorName: '高志远', authorColor: COLORS[3],
    content: '同意李医生的补充,这个强化模式符合恶性病灶特点。建议在诊断中点明。',
    mentions: [], fieldRef: 'findings',
    status: 'open',
    createdAt: isoMinutesAgo(8), updatedAt: isoMinutesAgo(8),
    replyCount: 0, reactions: [],
  },
  // Thread 2: 纵隔淋巴结评估
  {
    id: 'cmt-201', threadId: 'th-201', reportId: 'RP20260619013',
    authorId: 'D006', authorName: '赵雪琴', authorColor: COLORS[5],
    content: '纵隔淋巴结短径 12mm 是否需要补充具体位置(2R/4R/7 区)?这对分期很关键。',
    mentions: ['D002', 'D020'], fieldRef: 'findings', selectionRef: '纵隔内见肿大淋巴结,短径约 12mm',
    position: { x: 220, y: 380 }, status: 'open',
    createdAt: isoMinutesAgo(25), updatedAt: isoMinutesAgo(25),
    replyCount: 1, reactions: [{ emoji: 'think', userIds: ['D020'] }],
  },
  {
    id: 'cmt-202', threadId: 'th-201', reportId: 'RP20260619013',
    parentId: 'cmt-201',
    authorId: 'D020', authorName: '邓丽娟', authorColor: COLORS[5],
    content: '从图像看位于 4R/4L 区,建议改为"主动脉旁及隆突下多发肿大淋巴结,短径 10-14mm"。',
    mentions: ['D002'], fieldRef: 'findings',
    status: 'open',
    createdAt: isoMinutesAgo(18), updatedAt: isoMinutesAgo(18),
    replyCount: 0, reactions: [],
  },
  // Thread 3: 已解决的评论
  {
    id: 'cmt-301', threadId: 'th-301', reportId: 'RP20260619013',
    authorId: 'D007', authorName: '钱永康', authorColor: COLORS[6],
    content: '临床诊断中"肺癌"过于肯定,建议改为"占位,肺癌可能"或"高度怀疑恶性"。',
    mentions: ['D002'], fieldRef: 'diagnosis', selectionRef: '右肺下叶周围型肺癌',
    position: { x: 380, y: 450 }, status: 'resolved',
    createdAt: isoHoursAgo(2), updatedAt: isoHoursAgo(1),
    resolvedAt: isoHoursAgo(1), resolvedBy: 'D001', resolvedByName: '张明远',
    replyCount: 1, reactions: [{ emoji: 'ok', userIds: ['D001', 'D002'] }],
  },
  {
    id: 'cmt-302', threadId: 'th-301', reportId: 'RP20260619013',
    parentId: 'cmt-301',
    authorId: 'D002', authorName: '李慧敏', authorColor: COLORS[1],
    content: '已改为"右肺下叶占位,肺癌可能,建议穿刺活检"。',
    mentions: ['D007', 'D001'],
    status: 'resolved',
    createdAt: isoHoursAgo(1.5), updatedAt: isoHoursAgo(1),
    resolvedAt: isoHoursAgo(1), resolvedBy: 'D001', resolvedByName: '张明远',
    replyCount: 0, reactions: [],
  },
  // Thread 4: 乳腺 BI-RADS 评估
  {
    id: 'cmt-401', threadId: 'th-401', reportId: 'RP20260619018',
    authorId: 'D005', authorName: '刘文博', authorColor: COLORS[4],
    content: 'BI-RADS 5 类建议明确具体可疑征象的个数,如钙化点数量、肿块边界特征。',
    mentions: ['D016'], fieldRef: 'impression', selectionRef: 'BI-RADS 5类',
    position: { x: 350, y: 420 }, status: 'open',
    createdAt: isoMinutesAgo(35), updatedAt: isoMinutesAgo(35),
    replyCount: 1, reactions: [],
  },
  {
    id: 'cmt-402', threadId: 'th-401', reportId: 'RP20260619018',
    parentId: 'cmt-401',
    authorId: 'D016', authorName: '韩雪梅', authorColor: COLORS[0],
    content: '已补充:右乳外上象限多形性钙化 18 处,伴肿块影(约 1.8cm),边缘呈毛刺状。',
    mentions: ['D005'],
    status: 'open',
    createdAt: isoMinutesAgo(28), updatedAt: isoMinutesAgo(28),
    replyCount: 0, reactions: [{ emoji: 'like', userIds: ['D005'] }],
  },
  // Thread 5: 报告用语规范性
  {
    id: 'cmt-501', threadId: 'th-501', reportId: 'RP20260619013',
    authorId: 'D025',
    authorName: '魏娜', authorColor: COLORS[8],
    content: '报告用语整体规范,但"考虑..."句式过多,建议结论性语句更明确。',
    mentions: ['D002'], fieldRef: 'impression',
    position: { x: 240, y: 500 }, status: 'open',
    createdAt: isoMinutesAgo(45), updatedAt: isoMinutesAgo(45),
    replyCount: 0, reactions: [{ emoji: 'note', userIds: ['D001'] }],
  },
];

export const COLLAB_COMMENT_THREADS: CollabCommentThread[] = (() => {
  const map = new Map<string, CollabComment>();
  COLLAB_COMMENTS.forEach((c) => map.set(c.id, c));
  const threads: CollabCommentThread[] = [];
  const seen = new Set<string>();
  COLLAB_COMMENTS.forEach((c) => {
    if (seen.has(c.threadId)) return;
    seen.add(c.threadId);
    const root = map.get(c.threadId === c.id ? c.id : c.threadId);
    if (!root) return;
    const all = COLLAB_COMMENTS.filter((x) => x.threadId === c.threadId);
    const rootC = all.find((x) => !x.parentId) ?? all[0]!;
    const replies = all.filter((x) => x.parentId);
    const participants = Array.from(new Set(all.map((x) => x.authorId)));
    const lastActivity = all.reduce((acc, x) => (x.updatedAt > acc ? x.updatedAt : acc), rootC.createdAt);
    threads.push({
      id: c.threadId, reportId: rootC.reportId, root: rootC, replies,
      participants, status: rootC.status, createdAt: rootC.createdAt, lastActivityAt: lastActivity,
      unreadFor: rootC.status === 'open' && rootC.authorId !== 'D002' ? ['D002'] : [],
    });
  });
  return threads;
})();

// ============================================================
// 便签 (Sticky Notes)
// ============================================================

export const COLLAB_STICKY_NOTES: CollabStickyNote[] = [
  {
    id: 'sn-001', reportId: 'RP20260619013',
    authorId: 'D002', authorName: '李慧敏', authorColor: COLORS[1],
    title: '强化模式', content: '动脉期 +35HU,延迟期回落 -13HU\n提示恶性可能大',
    color: 'yellow', studyInstanceUID: '1.2.840.113619.2.55.3.604688119.971.1734567890.001',
    frameIndex: 42,
    position: { x: 280, y: 60 }, width: 200, height: 100, zIndex: 10, pinned: false,
    createdAt: isoMinutesAgo(20), updatedAt: isoMinutesAgo(18),
  },
  {
    id: 'sn-002', reportId: 'RP20260619013',
    authorId: 'D001', authorName: '张明远', authorColor: COLORS[0],
    title: '需补充', content: '建议在结论中明确分期(T2aN2M0?)',
    color: 'pink', frameIndex: 38,
    position: { x: 80, y: 220 }, width: 220, height: 80, zIndex: 12, pinned: true,
    createdAt: isoMinutesAgo(12), updatedAt: isoMinutesAgo(12),
  },
  {
    id: 'sn-003', reportId: 'RP20260619013',
    authorId: 'D018', authorName: '高志远', authorColor: COLORS[3],
    content: '同意 D001 的分期意见,建议结合 PET-CT 综合评估。',
    color: 'green', frameIndex: 42,
    position: { x: 520, y: 80 }, width: 180, height: 80, zIndex: 8, pinned: false,
    createdAt: isoMinutesAgo(8), updatedAt: isoMinutesAgo(8),
  },
  {
    id: 'sn-004', reportId: 'RP20260619018',
    authorId: 'D005', authorName: '刘文博', authorColor: COLORS[4],
    title: 'BI-RADS 5', content: '多形性钙化 + 肿块,符合 BI-RADS 5 类\n建议活检',
    color: 'blue', frameIndex: 25,
    position: { x: 380, y: 240 }, width: 200, height: 100, zIndex: 11, pinned: false,
    createdAt: isoMinutesAgo(28), updatedAt: isoMinutesAgo(25),
  },
];

// ============================================================
// 屏幕共享
// ============================================================

export const COLLAB_SCREEN_SHARES: ScreenShareSession[] = [
  {
    id: 'ss-001', roomId: 'room-rp-013',
    presenterId: 'D001', presenterName: '张明远',
    state: 'sharing', hasAudio: true, hasVideo: true,
    streamMockUrl: '/mock/screen-share-001.webm',
    startedAt: isoMinutesAgo(5),
    viewers: [
      { userId: 'D002', userName: '李慧敏', joinedAt: isoMinutesAgo(5) },
      { userId: 'D006', userName: '赵雪琴', joinedAt: isoMinutesAgo(4) },
      { userId: 'D007', userName: '钱永康', joinedAt: isoMinutesAgo(3) },
      { userId: 'D017', userName: '宋建军', joinedAt: isoMinutesAgo(2) },
    ],
    recording: false,
  },
];

// ============================================================
// 聊天消息
// ============================================================

export const COLLAB_CHAT_ROOMS: ChatRoom[] = [
  { id: 'cr-013', name: 'RP20260619013 协同群', reportId: 'RP20260619013',
    participants: ['D001', 'D002', 'D003', 'D006', 'D007', 'D017', 'D018', 'D020', 'D025'],
    lastMessageAt: isoMinutesAgo(0), unreadCount: 3, pinned: true, muted: false },
  { id: 'cr-018', name: 'RP20260619018 协同群', reportId: 'RP20260619018',
    participants: ['D005', 'D008', 'D011', 'D016', 'D021', 'D022'],
    lastMessageAt: isoMinutesAgo(8), unreadCount: 1, pinned: false, muted: false },
  { id: 'cr-009', name: 'RP20260619009 协同群', reportId: 'RP20260619009',
    participants: ['D004', 'D012', 'D018', 'D023', 'D028'],
    lastMessageAt: isoMinutesAgo(15), unreadCount: 0, pinned: false, muted: true },
];

export const COLLAB_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'msg-001', roomId: 'cr-013', authorId: 'D001', authorName: '张明远', authorColor: COLORS[0],
    type: 'mention', content: '@李慧敏 右肺下叶肿块的强化特征麻烦补充一下', mentions: ['D002'],
    reactions: [], createdAt: isoMinutesAgo(15), recalled: false },
  { id: 'msg-002', roomId: 'cr-013', authorId: 'D002', authorName: '李慧敏', authorColor: COLORS[1],
    type: 'text', content: '好的,我马上补充 CT 值测量。', mentions: [], replyToId: 'msg-001',
    reactions: [{ emoji: 'like', userIds: ['D001'] }], createdAt: isoMinutesAgo(14), recalled: false },
  { id: 'msg-003', roomId: 'cr-013', authorId: 'D018', authorName: '高志远', authorColor: COLORS[3],
    type: 'text', content: '我看了图像,同意 D001 的意见,需要明确分期。', mentions: [],
    reactions: [], createdAt: isoMinutesAgo(10), recalled: false },
  { id: 'msg-004', roomId: 'cr-013', authorId: 'D006', authorName: '赵雪琴', authorColor: COLORS[5],
    type: 'mention', content: '@全体 建议加快进度,这例是 green channel', mentions: ['D001', 'D002', 'D017', 'D018'],
    reactions: [{ emoji: 'reminder', userIds: ['D001', 'D017'] }], createdAt: isoMinutesAgo(7), recalled: false },
  { id: 'msg-005', roomId: 'cr-013', authorId: 'D002', authorName: '李慧敏', authorColor: COLORS[1],
    type: 'text', content: '强化数据已补充:动脉期 78HU,静脉期 95HU,延迟期 82HU。', mentions: [],
    reactions: [{ emoji: 'approve', userIds: ['D001'] }], createdAt: isoMinutesAgo(5), recalled: false },
  { id: 'msg-006', roomId: 'cr-013', authorId: 'D017', authorName: '宋建军', authorColor: COLORS[1],
    type: 'text', content: '我把分期建议写在便签里了,请 D002 看一下。', mentions: ['D002'],
    reactions: [], createdAt: isoMinutesAgo(3), recalled: false },
  { id: 'msg-007', roomId: 'cr-013', authorId: 'D002', authorName: '李慧敏', authorColor: COLORS[1],
    type: 'text', content: '看到了,马上整合到报告里。', mentions: [],
    reactions: [], createdAt: isoMinutesAgo(2), recalled: false },
  { id: 'msg-008', roomId: 'cr-013', authorId: 'D001', authorName: '张明远', authorColor: COLORS[0],
    type: 'system', content: '已开始屏幕共享', mentions: [],
    reactions: [], createdAt: isoMinutesAgo(5), recalled: false },
  { id: 'msg-009', roomId: 'cr-013', authorId: 'D025', authorName: '魏娜', authorColor: COLORS[8],
    type: 'text', content: '报告用语整体规范,稍后我会出一份质控评分。', mentions: [],
    reactions: [], createdAt: isoMinutesAgo(0), recalled: false },
  { id: 'msg-010', roomId: 'cr-018', authorId: 'D005', authorName: '刘文博', authorColor: COLORS[4],
    type: 'mention', content: '@韩雪梅 BI-RADS 5 类请补充具体征象', mentions: ['D016'],
    reactions: [], createdAt: isoMinutesAgo(30), recalled: false },
  { id: 'msg-011', roomId: 'cr-018', authorId: 'D016', authorName: '韩雪梅', authorColor: COLORS[0],
    type: 'text', content: '好的,马上补充钙化点数量。', mentions: [], replyToId: 'msg-010',
    reactions: [], createdAt: isoMinutesAgo(28), recalled: false },
  { id: 'msg-012', roomId: 'cr-018', authorId: 'D011', authorName: '周婷', authorColor: COLORS[10],
    type: 'text', content: '这例的钙化形态呈多形性,符合恶性钙化特征。', mentions: [],
    reactions: [], createdAt: isoMinutesAgo(8), recalled: false },
];

// ============================================================
// 活动流
// ============================================================

export const COLLAB_ACTIVITIES: CollabActivity[] = [
  { id: 'act-001', reportId: 'RP20260619013', userId: 'D001', userName: '张明远', userColor: COLORS[0],
    type: 'join', detail: '加入协同编辑', timestamp: isoMinutesAgo(30) },
  { id: 'act-002', reportId: 'RP20260619013', userId: 'D002', userName: '李慧敏', userColor: COLORS[1],
    type: 'edit', detail: '编辑"检查所见"段', timestamp: isoMinutesAgo(28) },
  { id: 'act-003', reportId: 'RP20260619013', userId: 'D001', userName: '张明远', userColor: COLORS[0],
    type: 'comment', detail: '添加评论:强化特征需补充', refId: 'cmt-101', timestamp: isoMinutesAgo(15) },
  { id: 'act-004', reportId: 'RP20260619013', userId: 'D002', userName: '李慧敏', userColor: COLORS[1],
    type: 'edit', detail: '补充 CT 值测量数据', timestamp: isoMinutesAgo(12) },
  { id: 'act-005', reportId: 'RP20260619013', userId: 'D006', userName: '赵雪琴',
    type: 'comment', detail: '建议补充淋巴结分区', refId: 'cmt-201', timestamp: isoMinutesAgo(25),
    userColor: COLORS[5] },
  { id: 'act-006', reportId: 'RP20260619013', userId: 'D018', userName: '高志远', userColor: COLORS[3],
    type: 'comment', detail: '同意分期建议', refId: 'cmt-103', timestamp: isoMinutesAgo(8) },
  { id: 'act-007', reportId: 'RP20260619013', userId: 'D001', userName: '张明远', userColor: COLORS[0],
    type: 'share', detail: '开始屏幕共享', timestamp: isoMinutesAgo(5) },
  { id: 'act-008', reportId: 'RP20260619013', userId: 'D002', userName: '李慧敏', userColor: COLORS[1],
    type: 'mention', detail: '@张明远 已补充强化数据', timestamp: isoMinutesAgo(5) },
  { id: 'act-009', reportId: 'RP20260619013', userId: 'D002', userName: '李慧敏', userColor: COLORS[1],
    type: 'save', detail: '保存草稿', timestamp: isoMinutesAgo(2) },
  { id: 'act-010', reportId: 'RP20260619013', userId: 'D017', userName: '宋建军', userColor: COLORS[1],
    type: 'note-add', detail: '添加便签:分期建议', refId: 'sn-002', timestamp: isoMinutesAgo(3) },
  { id: 'act-011', reportId: 'RP20260619013', userId: 'D001', userName: '张明远', userColor: COLORS[0],
    type: 'snapshot', detail: '创建快照 v3', refId: 'ver-003', timestamp: isoMinutesAgo(20) },
  { id: 'act-012', reportId: 'RP20260619018', userId: 'D005', userName: '刘文博', userColor: COLORS[4],
    type: 'join', detail: '加入协同编辑', timestamp: isoMinutesAgo(40) },
  { id: 'act-013', reportId: 'RP20260619018', userId: 'D016', userName: '韩雪梅', userColor: COLORS[0],
    type: 'edit', detail: '补充钙化点数量', timestamp: isoMinutesAgo(28) },
  { id: 'act-014', reportId: 'RP20260619009', userId: 'D004', userName: '陈晓燕', userColor: COLORS[3],
    type: 'edit', detail: '编辑"诊断意见"段', timestamp: isoMinutesAgo(45) },
  { id: 'act-015', reportId: 'RP20260619009', userId: 'D018', userName: '高志远', userColor: COLORS[3],
    type: 'comment-resolve', detail: '解决了 1 条评论', refId: 'cmt-301', timestamp: isoHoursAgo(1) },
];

// ============================================================
// 版本 (用于对比 / 合并)
// ============================================================

export const COLLAB_VERSIONS: CollabVersion[] = [
  {
    id: 'ver-001', reportId: 'RP20260619013', versionNumber: 1,
    authorId: 'D004', authorName: '陈晓燕', createdAt: isoHoursAgo(3),
    description: '初稿',
    content: '右肺下叶见占位影,大小约 4.5cm×3.8cm,边缘呈分叶状。纵隔内见肿大淋巴结。',
    parentVersionId: undefined, label: 'draft', checksum: 'sha256:abc001',
    diffSummary: { added: 60, removed: 0, modified: 0 },
  },
  {
    id: 'ver-002', reportId: 'RP20260619013', versionNumber: 2,
    authorId: 'D002', authorName: '李慧敏', createdAt: isoHoursAgo(2),
    description: '补充强化特征',
    content: '右肺下叶见一不规则软组织肿块影,大小约 4.5cm×3.8cm,边缘呈分叶状,伴毛刺,增强扫描示不均匀强化。肿块与周围血管关系密切,纵隔内见肿大淋巴结,短径约 12mm。',
    parentVersionId: 'ver-001', label: 'draft', checksum: 'sha256:abc002',
    diffSummary: { added: 38, removed: 2, modified: 5 },
  },
  {
    id: 'ver-003', reportId: 'RP20260619013', versionNumber: 3,
    authorId: 'D002', authorName: '李慧敏', createdAt: isoMinutesAgo(20),
    description: '补充 CT 值测量',
    content: '右肺下叶见一不规则软组织肿块影,大小约 4.5cm×3.8cm,边缘呈分叶状,伴毛刺,增强扫描示不均匀强化(动脉期 78HU,静脉期 95HU,延迟期 82HU,呈"快进快出"模式)。肿块与周围血管关系密切,主动脉旁及隆突下多发肿大淋巴结,短径 10-14mm。\n\n诊断意见:右肺下叶占位,肺癌可能,伴纵隔淋巴结转移(T2aN2M0),建议穿刺活检明确病理。',
    parentVersionId: 'ver-002', label: 'reviewed', checksum: 'sha256:abc003',
    diffSummary: { added: 45, removed: 1, modified: 8 },
  },
];

export default {
  COLLAB_USERS,
  COLLAB_COMMENTS,
  COLLAB_COMMENT_THREADS,
  COLLAB_STICKY_NOTES,
  COLLAB_SCREEN_SHARES,
  COLLAB_CHAT_ROOMS,
  COLLAB_CHAT_MESSAGES,
  COLLAB_ACTIVITIES,
  COLLAB_VERSIONS,
};

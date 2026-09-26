/**
 * G005 RIS v3.0.7 - 在线状态服务 (Presence Service)
 *
 *  - 谁正在查看 / 编辑当前报告
 *  - 谁正在共享屏幕
 *  - 心跳检测 (超时自动转为 away / offline)
 *  - 与 WebSocketCollabService 集成: 通过 'presence' 事件广播
 */

import type { CollabUser, CollabUserStatus } from '../../types/collab';
import { webSocketCollabService } from './WebSocketCollabService';

const HEARTBEAT_TIMEOUT_MS = 60_000;
const AWAY_TIMEOUT_MS = 5 * 60_000;

interface PresenceRecord {
  user: CollabUser;
  lastHeartbeat: number;
}

const presenceMap = new Map<string, PresenceRecord>();
let gcTimer: number | null = null;

const statusFromHeartbeat = (last: number): CollabUserStatus => {
  const now = Date.now();
  const elapsed = now - last;
  if (elapsed > HEARTBEAT_TIMEOUT_MS * 2) return 'offline';
  if (elapsed > AWAY_TIMEOUT_MS) return 'away';
  if (elapsed > HEARTBEAT_TIMEOUT_MS) return 'idle';
  return 'viewing';
};

const ensureGC = (): void => {
  if (gcTimer !== null) return;
  if (typeof window === 'undefined') return;
  gcTimer = window.setInterval(() => {
    const now = Date.now();
    presenceMap.forEach((rec, id) => {
      if (now - rec.lastHeartbeat > HEARTBEAT_TIMEOUT_MS * 3) {
        presenceMap.delete(id);
      }
    });
  }, HEARTBEAT_TIMEOUT_MS);
};

export interface PresenceService {
  update(user: Partial<CollabUser> & { id: string }): CollabUser;
  remove(userId: string): void;
  getActive(filter?: { roomId?: string; status?: CollabUserStatus | CollabUserStatus[] }): CollabUser[];
  getById(userId: string): CollabUser | null;
  heartbeat(userId: string): void;
  /** 订阅 presence 变化 */
  subscribe(handler: (users: CollabUser[]) => void): () => void;
  setRoom(userId: string, roomId: string): void;
}

const listeners = new Set<(users: CollabUser[]) => void>();

const notify = (): void => {
  const snapshot = Array.from(presenceMap.values()).map((r) => r.user);
  listeners.forEach((l) => {
    try { l(snapshot); } catch { /* swallow */ }
  });
};

const defaultColors = ['#dc2626', '#7c3aed', '#0891b2', '#10b981', '#f59e0b'];

const ensureDefaults = (u: Partial<CollabUser> & { id: string }): CollabUser => {
  const idx = Array.from(presenceMap.keys()).length % defaultColors.length;
  return {
    id: u.id,
    name: u.name ?? `用户 ${u.id}`,
    role: u.role ?? 'doctor',
    title: u.title,
    department: u.department,
    licenseNumber: u.licenseNumber,
    color: u.color ?? defaultColors[idx] ?? '#64748b',
    avatar: u.avatar,
    status: u.status ?? 'viewing',
    lastSeenAt: new Date().toISOString(),
    currentReportId: u.currentReportId,
    cursorIndex: u.cursorIndex,
    selection: u.selection,
    screenSharing: u.screenSharing,
    roomId: u.roomId,
  };
};

export const presenceService: PresenceService = {
  update(user) {
    ensureGC();
    const existing = presenceMap.get(user.id);
    const merged = ensureDefaults({ ...existing?.user, ...user });
    presenceMap.set(user.id, { user: merged, lastHeartbeat: Date.now() });
    webSocketCollabService.broadcast({
      type: 'join',
      userId: merged.id,
      userName: merged.name,
      payload: { user: merged },
    });
    notify();
    return merged;
  },

  remove(userId) {
    const existing = presenceMap.get(userId);
    presenceMap.delete(userId);
    if (existing) {
      webSocketCollabService.broadcast({
        type: 'leave',
        userId,
        userName: existing.user.name,
        payload: { userId },
      });
      notify();
    }
  },

  getActive(filter) {
    const now = Date.now();
    let list = Array.from(presenceMap.values()).map((r) => {
      const elapsed = now - r.lastHeartbeat;
      let derivedStatus = r.user.status;
      if (elapsed > AWAY_TIMEOUT_MS && derivedStatus !== 'offline') derivedStatus = 'away';
      if (elapsed > HEARTBEAT_TIMEOUT_MS * 2) derivedStatus = 'offline';
      return { ...r.user, status: derivedStatus };
    });
    if (filter?.roomId) {
      list = list.filter((u) => u.roomId === filter.roomId || u.currentReportId === filter.roomId);
    }
    if (filter?.status) {
      const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
      list = list.filter((u) => allowed.includes(u.status));
    }
    return list;
  },

  getById(userId) {
    const rec = presenceMap.get(userId);
    if (!rec) return null;
    const elapsed = Date.now() - rec.lastHeartbeat;
    let status = rec.user.status;
    if (elapsed > AWAY_TIMEOUT_MS && status !== 'offline') status = 'away';
    if (elapsed > HEARTBEAT_TIMEOUT_MS * 2) status = 'offline';
    return { ...rec.user, status };
  },

  heartbeat(userId) {
    const rec = presenceMap.get(userId);
    if (!rec) return;
    rec.lastHeartbeat = Date.now();
    rec.user.lastSeenAt = new Date().toISOString();
  },

  subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },

  setRoom(userId, roomId) {
    const rec = presenceMap.get(userId);
    if (!rec) return;
    rec.user.roomId = roomId;
    rec.user.currentReportId = roomId;
    notify();
  },
};

export const _internal = { statusFromHeartbeat };

export default presenceService;

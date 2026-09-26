// ============================================================
// G005 放射RIS系统 v2.1.0 - 协同核心
// Phase R9 W4: Y.js CRDT + y-webrtc P2P 协同
// ============================================================

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

// [W5] 信令服务器: 优先 VITE_SIGNALING_URLS (逗号分隔), 无则回退公共信令 (演示用, 生产应自托管)
const DEFAULT_SIGNALING: string[] = (() => {
  const raw = (import.meta.env as Record<string, unknown>)['VITE_SIGNALING_URLS'];
  const fromEnv = typeof raw === 'string'
    ? raw.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  return fromEnv.length > 0
    ? fromEnv
    : ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com'];
})();

const ROOM_PREFIX = 'g005-radiology-ris:';

export interface CollaborationUser {
  id: string;
  name: string;
  role: 'doctor' | 'resident' | 'attending' | 'tech' | 'reviewer' | 'admin';
  color: string;
  avatar?: string;
  licenseNumber?: string;
  department?: string;
}

export interface CollaborationRoom {
  id: string;
  ydoc: Y.Doc;
  provider: WebrtcProvider;
  awareness: WebrtcProvider['awareness'];
  destroy: () => void;
  userCount: number;
  isConnected: boolean;
}

// 单例房间缓存
const rooms = new Map<string, CollaborationRoom>();

export function getRoom(roomId: string, signaling: string[] = DEFAULT_SIGNALING): CollaborationRoom {
  const fullId = ROOM_PREFIX + roomId;
  const existing = rooms.get(fullId);
  if (existing) return existing;

  const ydoc = new Y.Doc();
  const provider = new WebrtcProvider(fullId, ydoc, {
    signaling,
    password: undefined,         // 演示：开放房间（生产应使用密码/邀请）
    maxConns: 20,
    filterBcConns: true,
  });

  const room: CollaborationRoom = {
    id: fullId,
    ydoc,
    provider,
    awareness: provider.awareness,
    destroy: () => {
      provider.destroy();
      ydoc.destroy();
      rooms.delete(fullId);
    },
    userCount: 0,
    isConnected: false,
  };

  provider.on('peers', () => { room.userCount = provider.awareness.getStates().size; });
  provider.on('status', (e: { connected: boolean }) => { room.isConnected = e.connected; });

  rooms.set(fullId, room);
  return room;
}

export function leaveRoom(roomId: string): void {
  const r = rooms.get(ROOM_PREFIX + roomId);
  if (r) r.destroy();
}

export function listActiveRooms(): string[] {
  return Array.from(rooms.keys()).map(k => k.replace(ROOM_PREFIX, ''));
}

// Y 共享类型构造助手
export function getReportText(ydoc: Y.Doc): Y.Text {
  return ydoc.getText('content');
}

export function getReportMeta(ydoc: Y.Doc): Y.Map<unknown> {
  return ydoc.getMap('meta');
}

export function getReportAnnotations(ydoc: Y.Doc): Y.Array<unknown> {
  return ydoc.getArray('annotations');
}

export function getReportComments(ydoc: Y.Doc): Y.Array<unknown> {
  return ydoc.getArray('comments');
}

export function getReportHistory(ydoc: Y.Doc): Y.Array<unknown> {
  return ydoc.getArray('history');
}

// 创建 Y 文档快照（保存/恢复）
export interface DocSnapshot {
  roomId: string;
  state: Uint8Array;
  timestamp: number;
  userId: string;
  description?: string;
}

export function createSnapshot(ydoc: Y.Doc, roomId: string, userId: string, description?: string): DocSnapshot {
  return {
    roomId,
    state: Y.encodeStateAsUpdate(ydoc),
    timestamp: Date.now(),
    userId,
    description,
  };
}

export function applySnapshot(ydoc: Y.Doc, snapshot: DocSnapshot): void {
  Y.applyUpdate(ydoc, snapshot.state);
}

export function diffStates(prev: Uint8Array, curr: Uint8Array): number {
  // 简单统计：返回新增字节数
  return Math.max(0, curr.length - prev.length);
}

// 编码/解码 base64 (URL safe) 便于持久化
export function encodeStateB64(state: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < state.length; i++) bin += String.fromCharCode(state[i] ?? 0);
  return btoa(bin);
}

export function decodeStateB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

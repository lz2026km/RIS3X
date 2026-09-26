// ============================================================
// G005 放射RIS系统 v2.1.0 - useCollaborativeReport Hook
// Phase R9 W4: 协同报告 React 绑定
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getRoom, getReportText, getReportMeta, getReportAnnotations, getReportComments, type CollaborationRoom, type CollaborationUser, createSnapshot, encodeStateB64 } from '../services/collaboration';

export interface UseCollaborativeReportOptions {
  reportId: string;
  user: CollaborationUser;
  enabled?: boolean;
  onSnapshot?: (snapshot: { state: Uint8Array; timestamp: number; description?: string }) => void;
}

export interface UseCollaborativeReportResult {
  // 文档状态
  ydoc: Y.Doc | null;
  ytext: Y.Text | null;
  ymeta: Y.Map<unknown> | null;
  yannotations: Y.Array<unknown> | null;
  ycomments: Y.Array<unknown> | null;
  // 文本
  text: string;
  setText: (text: string) => void;
  insertText: (index: number, text: string) => void;
  deleteText: (index: number, length: number) => void;
  // 注释
  annotations: unknown[];
  addAnnotation: (annotation: unknown) => void;
  removeAnnotation: (index: number) => void;
  // 评论
  comments: unknown[];
  addComment: (comment: unknown) => void;
  // 元数据
  meta: Record<string, unknown>;
  setMeta: (key: string, value: unknown) => void;
  // 快照
  snapshot: (description?: string) => string;
  // 状态
  isConnected: boolean;
  userCount: number;
  // Awareness
  setLocalAwareness: (state: Record<string, unknown>) => void;
  getRemoteAwareness: () => Map<number, Record<string, unknown>>;
}

const ROOM_KEY = 'g005.collaborativeReports.v1';

function persistReport(reportId: string, b64State: string) {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    const map = raw ? JSON.parse(raw) as Record<string, string> : {};
    map[reportId] = b64State;
    localStorage.setItem(ROOM_KEY, JSON.stringify(map));
  } catch {/* ignore */}
}

function loadReport(reportId: string): string | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[reportId] ?? null;
  } catch { return null; }
}

function decodeB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

export function useCollaborativeReport(opts: UseCollaborativeReportOptions): UseCollaborativeReportResult {
  const { reportId, user, enabled = true, onSnapshot } = opts;
  const roomRef = useRef<CollaborationRoom | null>(null);
  const [text, setTextState] = useState('');
  const [annotations, setAnnotations] = useState<unknown[]>([]);
  const [comments, setComments] = useState<unknown[]>([]);
  const [meta, setMetaState] = useState<Record<string, unknown>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);

  // 获取或创建房间
  useEffect(() => {
    if (!enabled) return;
    const room = getRoom(reportId);
    roomRef.current = room;
    const ydoc = room.ydoc;

    // 初始化 local awareness
    room.awareness.setLocalState({
      user: { id: user.id, name: user.name, color: user.color, role: user.role },
      cursor: null,
      selection: null,
      active: true,
    });

    // 从 localStorage 恢复
    const stored = loadReport(reportId);
    if (stored) {
      Y.applyUpdate(ydoc, decodeB64(stored));
    }

    // 绑定观察者
    const ytext = getReportText(ydoc);
    const ymeta = getReportMeta(ydoc);
    const yann = getReportAnnotations(ydoc);
    const ycomments = getReportComments(ydoc);

    const onTextChange = () => setTextState(ytext.toString());
    const onMetaChange = () => setMetaState({ ...ymeta.toJSON() });
    const onAnnChange = () => setAnnotations(yann.toArray());
    const onComChange = () => setComments(ycomments.toArray());

    ytext.observe(onTextChange);
    ymeta.observe(onMetaChange);
    yann.observe(onAnnChange);
    ycomments.observe(onComChange);

    onTextChange();
    onMetaChange();
    onAnnChange();
    onComChange();

    // 房间状态
    const onStatus = (e: { connected: boolean }) => setIsConnected(e.connected);
    const onPeers = () => setUserCount(room.awareness.getStates().size);
    room.provider.on('status', onStatus);
    room.awareness.on('change', onPeers);
    onStatus({ connected: (room.provider as unknown as { connected: boolean }).connected ?? false });
    onPeers();

    // 周期持久化
    const persistHandle = setInterval(() => {
      persistReport(reportId, encodeB64(Y.encodeStateAsUpdate(ydoc)));
    }, 10000);

    return () => {
      ytext.unobserve(onTextChange);
      ymeta.unobserve(onMetaChange);
      yann.unobserve(onAnnChange);
      ycomments.unobserve(onComChange);
      room.provider.off('status', onStatus);
      room.awareness.off('change', onPeers);
      clearInterval(persistHandle);
    };
  }, [reportId, enabled, user.id, user.name, user.color, user.role]);

  const ydoc = roomRef.current?.ydoc ?? null;
  const ytext = ydoc ? getReportText(ydoc) : null;
  const ymeta = ydoc ? getReportMeta(ydoc) : null;
  const yannotations = ydoc ? getReportAnnotations(ydoc) : null;
  const ycomments = ydoc ? getReportComments(ydoc) : null;

  const setText = useCallback((newText: string) => {
    if (!ytext) return;
    ydoc?.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newText);
    });
  }, [ytext, ydoc]);

  const insertText = useCallback((index: number, t: string) => {
    ytext?.insert(index, t);
  }, [ytext]);

  const deleteText = useCallback((index: number, length: number) => {
    ytext?.delete(index, length);
  }, [ytext]);

  const addAnnotation = useCallback((a: unknown) => {
    yannotations?.push([a]);
  }, [yannotations]);

  const removeAnnotation = useCallback((index: number) => {
    yannotations?.delete(index, 1);
  }, [yannotations]);

  const addComment = useCallback((c: unknown) => {
    ycomments?.push([c]);
  }, [ycomments]);

  const setMeta = useCallback((key: string, value: unknown) => {
    ymeta?.set(key, value);
  }, [ymeta]);

  const snapshot = useCallback((description?: string) => {
    if (!ydoc) return '';
    const snap = createSnapshot(ydoc, reportId, user.id, description);
    onSnapshot?.(snap);
    return encodeStateB64(snap.state);
  }, [ydoc, reportId, user.id, onSnapshot]);

  const setLocalAwareness = useCallback((state: Record<string, unknown>) => {
    if (roomRef.current) {
      const current = roomRef.current.awareness.getLocalState() ?? {};
      roomRef.current.awareness.setLocalState({ ...current, ...state });
    }
  }, []);

  const getRemoteAwareness = useCallback(() => {
    return roomRef.current?.awareness.getStates() ?? new Map();
  }, []);

  return useMemo(() => ({
    ydoc, ytext, ymeta, yannotations, ycomments,
    text, setText, insertText, deleteText,
    annotations, addAnnotation, removeAnnotation,
    comments, addComment,
    meta, setMeta,
    snapshot,
    isConnected, userCount,
    setLocalAwareness, getRemoteAwareness,
  }), [
    ydoc, ytext, ymeta, yannotations, ycomments,
    text, setText, insertText, deleteText,
    annotations, addAnnotation, removeAnnotation,
    comments, addComment,
    meta, setMeta, snapshot, isConnected, userCount,
    setLocalAwareness, getRemoteAwareness,
  ]);
}

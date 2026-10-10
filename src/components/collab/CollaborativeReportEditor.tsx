// ============================================================
// G005 放射RIS系统 v2.1.0 - 协同报告编辑器 + Awareness
// Phase R9 W4+W5: CRDT 编辑 + 实时光标 + 用户列表
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCollaborativeReport } from '../../hooks/useCollaborativeReport';
import type { CollaborationUser } from '../../services/collaboration';
import { getRoom } from '../../services/collaboration';
import PresenceIndicator from './PresenceIndicator';
import CommentThread from './CommentThread';

export interface CollaborativeReportEditorProps {
  reportId: string;
  user: CollaborationUser;
  initialText?: string;
  readOnly?: boolean;
  height?: number;
  onTextChange?: (text: string) => void;
  showAwareness?: boolean;
  /** 是否显示侧边栏(评论 + 在线状态) */
  showSidebar?: boolean;
}

interface RemoteCursor {
  clientId: number;
  name: string;
  color: string;
  role: string;
  index: number;
  length: number;
}

const COLLAB_PALETTE = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
];

export function pickUserColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLLAB_PALETTE[h % COLLAB_PALETTE.length] ?? '#3b82f6';
}

export default function CollaborativeReportEditor({
  reportId,
  user,
  initialText = '',
  readOnly = false,
  height = 320,
  onTextChange,
  showAwareness = true,
  showSidebar = false,
}: CollaborativeReportEditorProps) {
  const collab = useCollaborativeReport({ reportId, user });
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [peers, setPeers] = useState<Array<{ clientId: number; user: CollaborationUser }>>([]);
  const initializing = useRef(false);

  // 初始化文本（仅首次）
  useEffect(() => {
    if (initializing.current) return;
    if (initialText && collab.text === '' && collab.ydoc) {
      initializing.current = true;
      collab.ydoc.transact(() => {
        collab.ytext?.insert(0, initialText);
      });
    }
  }, [initialText, collab.text, collab.ydoc, collab.ytext]);

  // 监听 awareness
  useEffect(() => {
    if (!showAwareness) return;
    const room = getRoom(reportId);
    const handleChange = () => {
      const states = room.awareness.getStates();
      const cursors: RemoteCursor[] = [];
      const peerList: Array<{ clientId: number; user: CollaborationUser }> = [];
      states.forEach((state, clientId) => {
        if (clientId === room.ydoc.clientID) return;
        const u = (state as { user?: CollaborationUser }).user;
        if (!u) return;
        peerList.push({ clientId, user: u });
        const cursor = (state as { cursor?: { index?: number } }).cursor;
        const sel = (state as { selection?: { start?: number; end?: number } }).selection;
        if (cursor && typeof cursor.index === 'number') {
          cursors.push({
            clientId,
            name: u.name,
            color: u.color,
            role: u.role,
            index: cursor.index,
            length: sel && typeof sel.start === 'number' && typeof sel.end === 'number' ? Math.abs(sel.end - sel.start) : 0,
          });
        }
      });
      setRemoteCursors(cursors);
      setPeers(peerList);
    };
    room.awareness.on('change', handleChange);
    handleChange();
    return () => room.awareness.off('change', handleChange);
  }, [reportId, showAwareness]);

  // 通知父组件
  useEffect(() => {
    onTextChange?.(collab.text);
  }, [collab.text, onTextChange]);

  // 光标/选区上报
  const reportCursor = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    collab.setLocalAwareness({
      cursor: { index: ta.selectionStart },
      selection: { start: ta.selectionStart, end: ta.selectionEnd },
    });
  }, [collab]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const ta = e.target;
    const newVal = ta.value;
    const oldLen = collab.text.length;
    const newLen = newVal.length;
    // 计算 diff 区间（简化：全量替换）
    collab.ydoc?.transact(() => {
      if (collab.ytext) {
        collab.ytext.delete(0, oldLen);
        collab.ytext.insert(0, newVal);
      }
    });
    void newLen;
    reportCursor();
  }, [collab, readOnly, reportCursor]);

  const handleKeyUp = useCallback(() => reportCursor(), [reportCursor]);
  const handleClick = useCallback(() => reportCursor(), [reportCursor]);

  const connectionBadge = useMemo(() => collab.isConnected
    ? { text: `P2P 协同 · ${collab.userCount} 人在线`, color: '#10b981' }
    : { text: '本地模式', color: '#94a3b8' }, [collab.isConnected, collab.userCount]);

  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);

  return (
    <div data-testid="collab-editor" style={{ border: '1px solid #334155', borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #1e293b', fontSize: 12 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: connectionBadge.color }} />
        <span data-testid="collab-status" style={{ color: connectionBadge.color }}>{connectionBadge.text}</span>
        <div style={{ flex: 1 }} />
        {showAwareness && <PresenceIndicator roomId={reportId} maxVisible={4} compact />}
        {showAwareness && peers.length > 0 && peers.slice(0, 3).map(p => (
          <span
            key={p.clientId}
            data-testid={`peer-${p.clientId}`}
            title={`${p.user.name} (${p.user.role})`}
            style={{
              background: p.user.color, color: 'white', borderRadius: 12,
              padding: '2px 8px', fontSize: 12, fontWeight: 600,
            }}
          >
            {p.user.name.charAt(0)}
          </span>
        ))}
        <span style={{ background: user.color, color: 'white', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
          {user.name.charAt(0)} · You
        </span>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          data-testid="collab-sidebar-toggle"
          style={{
            background: sidebarOpen ? '#1e293b' : 'transparent',
            color: '#cbd5e1',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {sidebarOpen ? '隐藏' : '评论'}
        </button>
      </div>

      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              ref={taRef}
              data-testid="collab-textarea"
              value={collab.text}
              onChange={handleChange}
              onKeyUp={handleKeyUp}
              onClick={handleClick}
              readOnly={readOnly}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: height,
                padding: 12,
                background: 'transparent',
                color: '#e2e8f0',
                border: 'none', fontSize: 14,
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
            {showAwareness && remoteCursors.map(c => (
              <span
                key={c.clientId}
                data-testid={`cursor-${c.clientId}`}
                title={`${c.name} @ ${c.index}`}
                style={{
                  position: 'absolute',
                  top: 12 + Math.floor(c.index / 80) * 22.4,
                  left: 12 + (c.index % 80) * 8.4,
                  width: 2, height: 18,
                  background: c.color,
                  pointerEvents: 'none',
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 12, padding: '4px 10px', borderTop: '1px solid #1e293b', fontSize: 12, color: '#64748b' }}>
            <span data-testid="collab-charcount">字符: {collab.text.length}</span>
            <span>注释: {collab.annotations.length}</span>
            <span>评论: {collab.comments.length}</span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              data-testid="collab-snapshot-btn"
              onClick={() => collab.snapshot(`snapshot ${new Date().toISOString()}`)}
              style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
            >
              快照
            </button>
          </div>
        </div>

        {/* Sidebar: Presence + Comment Thread */}
        {sidebarOpen && (
          <div
            data-testid="collab-sidebar"
            style={{
              width: 320,
              borderLeft: '1px solid #1e293b',
              background: '#1e293b',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              maxHeight: height + 80,
            }}
          >
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #334155', fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>
              评论协作
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <CommentThread
                reportId={reportId}
                currentUser={{ id: user.id, name: user.name, color: user.color }}
                compact
                maxHeight={height + 40}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

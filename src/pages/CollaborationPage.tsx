// ============================================================
// G005 放射科RIS系统 v1.0.3 - 多人协同编辑
// Phase R3：在线用户 / 光标位置 / 选区高亮 / @提醒 / 评论批注
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import {
  Users, MessageSquare, Send, AtSign, CheckCircle2, Reply,
  Edit2, Activity, Wifi, Clock, UserCheck, UserX,
  FileText, Save, MousePointer,
} from 'lucide-react';
import {
  COLLAB_USERS,
  COLLAB_COMMENTS,
  COLLAB_ACTIVITIES,
  type CollabUser,
  type CollabComment,
  type CollabActivity,
} from '../data/reviewRevisionCollabMock';

// ============================================================
// 状态配置
// ============================================================
const STATUS_CONFIG: Record<CollabUser['status'], { label: string; color: string; bg: string }> = {
  online:  { label: '在线', color: '#10b981', bg: '#d1fae5' },
  away:    { label: '离开', color: '#f59e0b', bg: '#fef3c7' },
  offline: { label: '离线', color: '#94a3b8', bg: '#f1f5f9' },
};

// ============================================================
// 活动类型配置
// ============================================================
const ACTIVITY_CONFIG: Record<CollabActivity['action'], { icon: any; color: string; label: string }> = {
  join:    { icon: UserCheck, color: '#10b981', label: '加入' },
  leave:   { icon: UserX,    color: '#dc2626', label: '离开' },
  edit:    { icon: Edit2,    color: '#3b82f6', label: '编辑' },
  comment: { icon: MessageSquare, color: '#7c3aed', label: '评论' },
  select:  { icon: MousePointer,   color: '#0891b2', label: '选中' },
  mention: { icon: AtSign,    color: '#f59e0b', label: '提及' },
  save:    { icon: Save,      color: '#10b981', label: '保存' },
};

// ============================================================
// 报告内容
// ============================================================
const MOCK_REPORT_CONTENT = {
  findings: '右肺下叶见一不规则软组织肿块影，大小约 4.5cm×3.8cm，边缘呈分叶状，伴毛刺，增强扫描示不均匀强化。肿块与周围血管关系密切，纵隔内见肿大淋巴结，短径约 12mm。',
  diagnosis: '右肺下叶周围型肺癌伴纵隔淋巴结转移可能。',
  impression: '右肺下叶占位，考虑肺癌伴纵隔淋巴结转移，建议穿刺活检明确病理。',
};

// ============================================================
// 主组件
// ============================================================
export default function CollaborationPage() {
  // 当前选中的报告
  const [selectedReportId, setSelectedReportId] = useState<string>('rpt-013');
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  // 在线用户
  const [users] = useState<CollabUser[]>(COLLAB_USERS);
  // 评论
  const [comments, setComments] = useState<CollabComment[]>(COLLAB_COMMENTS);
  // 活动
  const [activities] = useState<CollabActivity[]>(COLLAB_ACTIVITIES);
  // 新评论
  const [newComment, setNewComment] = useState('');
  // 当前选中的字段
  const [activeField, setActiveField] = useState<'findings' | 'diagnosis' | 'impression'>('findings');
  // 已解决显示
  const [showResolved, setShowResolved] = useState(false);
  // 自动滚动
  const [autoScroll, setAutoScroll] = useState(true);
  // 当前用户
  const currentUser = users[0]; // 张明远

  // 过滤当前报告的评论
  const reportComments = useMemo(() => {
    return comments
      .filter(c => c.reportId === selectedReportId)
      .filter(c => showResolved || !c.resolved);
  }, [comments, selectedReportId, showResolved]);

  // 过滤当前报告的活动
  const reportActivities = useMemo(() => {
    return activities
      .filter(a => a.reportId === selectedReportId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 20);
  }, [activities, selectedReportId]);

  // 当前报告的在线用户
  const reportOnlineUsers = useMemo(() => {
    return users.filter(u => u.currentPage?.includes(selectedReportId));
  }, [users, selectedReportId]);

  // 光标位置自动更新
  const [cursorPositions, setCursorPositions] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorPositions(prev => {
        const next = { ...prev };
        for (const u of reportOnlineUsers) {
          if (u.cursorPos) {
            // 光标微移
            next[u.id] = {
              x: u.cursorPos.x + Math.sin(Date.now() / 1000 + u.id.charCodeAt(0)) * 8,
              y: u.cursorPos.y + Math.cos(Date.now() / 1200 + u.id.charCodeAt(0)) * 6,
              visible: u.status === 'online',
            };
          }
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [reportOnlineUsers]);

  // 提交评论
  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    const mentions = Array.from(newComment.matchAll(/@(\S+)/g)).map(m => m[1]);
    const newC: CollabComment = {
      id: `cmt-${Date.now()}`,
      reportId: selectedReportId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      content: newComment,
      fieldRef: activeField,
      position: { x: 200, y: 200 },
      resolved: false,
      mentions,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    setComments([...comments, newC]);
    setNewComment('');
  };

  // 解决评论
  const handleResolve = (id: string) => {
    setComments(comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c));
  };

  if (loading) return <div role="status" data-testid="collab-loading" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>;
  if (error) return <div role="alert" data-testid="collab-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (users.length === 0) {
    return (
      <div data-testid="collab-empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>暂无在线用户</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>正在连接 WebSocket...,请稍候或检查网络</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', background: '#f1f5f9' }}>
      {/* 顶部状态栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
        color: '#fff', padding: '12px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={20} />
              多人协同编辑
              <span style={{
                fontSize: 12, padding: '2px 6px',
                background: '#10b981', color: '#fff',
                borderRadius: 3, fontWeight: 700,
              }}>R3</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              实时同步 · 光标位置 · 选区高亮 · @提醒 · 评论批注
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={selectedReportId}
              onChange={e => setSelectedReportId(e.target.value)}
              style={{
                padding: '5px 8px', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4, fontSize: 12, color: '#1e293b', background: 'rgba(255,255,255,0.95)',
              }}
            >
              <option value="rpt-013">RP20260604013 黄海涛（胸部CT）</option>
              <option value="rpt-018">RP20260603018 韩雪梅（乳腺钼靶）</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Wifi size={12} />
              <span>WebSocket 已连接</span>
            </div>
          </div>
        </div>

        {/* 在线用户 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, opacity: 0.85, marginRight: 4 }}>在线 {reportOnlineUsers.filter(u => u.status === 'online').length} 人：</span>
          {reportOnlineUsers.map(u => {
            const conf = STATUS_CONFIG[u.status];
            return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: 12,
                position: 'relative',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: u.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  border: `2px solid ${conf.color}`,
                }}>{u.avatar}</div>
                <span style={{ fontSize: 12 }}>{u.name}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>·</span>
                <span style={{ fontSize: 12, color: conf.color, fontWeight: 600 }}>{conf.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 主体三栏 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左：协同报告内容 */}
        <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          <div style={{
            background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0',
            position: 'relative', minHeight: 600,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> 报告正文（实时协同）
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['findings', 'diagnosis', 'impression'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveField(f)}
                    style={{
                      padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: 3,
                      background: activeField === f ? '#dbeafe' : '#fff',
                      color: activeField === f ? '#1e40af' : '#475569',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {f === 'findings' ? '检查所见' : f === 'diagnosis' ? '诊断' : '意见'}
                  </button>
                ))}
              </div>
            </div>

            {/* 协作编辑区 */}
            <div style={{
              position: 'relative', padding: 16,
              background: '#f8fafc', borderRadius: 6,
              border: '1px solid #e2e8f0', minHeight: 200,
              fontSize: 13, lineHeight: 1.8, color: '#1e293b',
            }}>
              {MOCK_REPORT_CONTENT[activeField]}

              {/* 其他用户光标 */}
              {Object.entries(cursorPositions).map(([uid, pos]) => {
                const user = reportOnlineUsers.find(u => u.id === uid);
                if (!user || !pos.visible) return null;
                return (
                  <div key={uid} style={{
                    position: 'absolute',
                    left: pos.x, top: pos.y,
                    pointerEvents: 'none',
                    transition: 'all 0.1s linear',
                  }}>
                    <MousePointer size={14} color={user.color} fill={user.color} style={{ transform: 'rotate(-15deg)' }} />
                    <div style={{
                      marginLeft: 10, padding: '1px 6px',
                      background: user.color, color: '#fff', borderRadius: 3,
                      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>{user.name}</div>
                  </div>
                );
              })}

              {/* 选区高亮 */}
              <div style={{
                position: 'absolute', left: 50, top: 70,
                padding: '2px 4px', background: 'rgba(124, 58, 237, 0.2)',
                border: '1px solid #7c3aed', borderRadius: 2,
                fontSize: 13, color: '#1e293b',
                pointerEvents: 'none',
              }}>
                增强扫描示不均匀强化
              </div>
            </div>

            {/* 实时状态 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 12, color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={11} /> <span style={{ color: '#10b981' }}>已自动保存</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> 最后同步 2 秒前
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Edit2 size={11} /> 李慧敏 正在编辑
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
                <MousePointer size={11} /> 2 个光标
              </span>
            </div>
          </div>
        </div>

        {/* 中：评论 */}
        <div style={{
          width: 360, background: '#fff', borderRight: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={13} /> 评论批注
              <span style={{
                fontSize: 12, padding: '0 5px', borderRadius: 3,
                background: reportComments.length > 0 ? '#dc2626' : '#94a3b8',
                color: '#fff', fontWeight: 700,
              }}>{reportComments.length}</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
              <input
                type="checkbox"
                checked={showResolved}
                onChange={e => setShowResolved(e.target.checked)}
              />
              显示已解决
            </label>
          </div>

          {/* 评论列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {reportComments.map(comment => {
              const replies = comments.filter(c => c.parentId === comment.id);
              return (
                <div key={comment.id} style={{
                  padding: 10, marginBottom: 6,
                  background: comment.resolved ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${comment.resolved ? '#bbf7d0' : '#e2e8f0'}`,
                  borderRadius: 6, opacity: comment.resolved ? 0.7 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: comment.authorColor, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                    }}>{comment.authorName[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{comment.authorName}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{comment.createdAt}</div>
                    </div>
                    {comment.fieldRef && (
                      <span style={{
                        fontSize: 12, padding: '0 4px', borderRadius: 2,
                        background: '#ede9fe', color: '#7c3aed', fontWeight: 600,
                      }}>{comment.fieldRef === 'findings' ? '所见' : comment.fieldRef === 'impression' ? '意见' : comment.fieldRef}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 6, lineHeight: 1.6 }}>
                    {comment.content.split(/(@\S+)/g).map((part, i) => {
                      if (part.startsWith('@')) {
                        return (
                          <span key={i} style={{
                            background: '#fef3c7', color: '#92400e',
                            padding: '0 4px', borderRadius: 3, fontWeight: 600,
                          }}>{part}</span>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>

                  {comment.selectionRef && (
                    <div style={{
                      padding: 4, marginBottom: 6,
                      background: 'rgba(124, 58, 237, 0.1)',
                      border: '1px solid #c4b5fd', borderRadius: 3,
                      fontSize: 12, color: '#5b21b6', fontStyle: 'italic',
                    }}>
                      📌 选区：{comment.selectionRef}
                    </div>
                  )}

                  {replies.length > 0 && (
                    <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: '2px solid #c4b5fd' }}>
                      {replies.map(reply => (
                        <div key={reply.id} style={{ marginBottom: 4, fontSize: 12, color: '#1e293b' }}>
                          <strong>{reply.authorName}:</strong> {reply.content}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <button
                      onClick={() => handleResolve(comment.id)}
                      style={{
                        padding: '2px 6px', border: 'none', borderRadius: 3,
                        background: comment.resolved ? '#d1fae5' : 'transparent',
                        color: comment.resolved ? '#047857' : '#94a3b8',
                        fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      <CheckCircle2 size={10} /> {comment.resolved ? '已解决' : '解决'}
                    </button>
                    <button
                      style={{
                        padding: '2px 6px', border: 'none', background: 'transparent',
                        color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      <Reply size={10} /> 回复
                    </button>
                    {comment.mentions.length > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#f59e0b' }}>
                        @ {comment.mentions.length} 人
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {reportComments.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                暂无评论
              </div>
            )}
          </div>

          {/* 评论输入 */}
          <div style={{ padding: 8, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="添加评论...（用 @ 提及他人）"
              rows={2}
              style={{
                width: '100%', padding: 6, border: '1px solid #cbd5e1', borderRadius: 4,
                fontSize: 12, outline: 'none', resize: 'none', fontFamily: 'inherit',
                marginBottom: 4,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {users.slice(0, 4).map(u => (
                  <button
                    key={u.id}
                    onClick={() => setNewComment(newComment + `@${u.name} `)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: u.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    }}
                    title={`@${u.name}`}
                  >{u.avatar}</button>
                ))}
              </div>
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
                style={{
                  padding: '4px 10px', border: 'none', borderRadius: 4,
                  background: newComment.trim() ? '#7c3aed' : '#cbd5e1',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Send size={11} /> 发送
              </button>
            </div>
          </div>
        </div>

        {/* 右：活动日志 */}
        <div style={{
          width: 300, background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
            fontSize: 12, fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Activity size={13} /> 实时活动
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {reportActivities.map(act => {
              const conf = ACTIVITY_CONFIG[act.action];
              const Icon = conf.icon;
              const user = users.find(u => u.id === act.userId);
              return (
                <div key={act.id} style={{
                  display: 'flex', gap: 6, padding: 6, marginBottom: 4,
                  background: '#f8fafc', borderRadius: 4,
                  fontSize: 12,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: user?.color || '#94a3b8', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{act.userName[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{act.userName}</span>
                      <span style={{
                        fontSize: 12, padding: '0 4px', borderRadius: 2,
                        background: `${conf.color}15`, color: conf.color, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <Icon size={8} /> {conf.label}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{act.detail}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 1 }}>{act.timestamp}</div>
                  </div>
                </div>
              );
            })}
            {reportActivities.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                暂无活动
              </div>
            )}
          </div>

          <div style={{ padding: 6, borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              自动滚动
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

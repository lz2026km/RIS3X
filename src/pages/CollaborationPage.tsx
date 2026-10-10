// ============================================================
// G005 放射科RIS系统 v1.0.3 - 多人协同编辑
// Phase R3：在线用户 / 光标位置 / 选区高亮 / @提醒 / 评论批注
// ============================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import { uniqueId } from '../utils/uniqueId';
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
import { consultationApi } from '../services/api/consultationApi';
import { message } from 'antd';
import { t } from '../i18n/appI18n';

// 评论者颜色 (按名称稳定派生)
function colorOf(name: string): string {
  const palette = ['#dc2626', '#7c3aed', '#0891b2', '#10b981', '#f59e0b', '#a855f7', '#3b82f6', '#be185d'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length] ?? '#7c3aed';
}

// ============================================================
// 状态配置
// ============================================================
const STATUS_CONFIG: Record<CollabUser['status'], { label: string; color: string; bg: string }> = {
  online:  { label: 'collab.status.online', color: '#10b981', bg: '#22c55e22' },
  away:    { label: 'collab.status.away', color: '#f59e0b', bg: '#f59e0b22' },
  offline: { label: 'collab.status.offline', color: 'var(--text-secondary)', bg: 'var(--bg-deep)' },
};

// ============================================================
// 活动类型配置
// ============================================================
const ACTIVITY_CONFIG: Record<CollabActivity['action'], { icon: any; color: string; label: string }> = {
  join:    { icon: UserCheck, color: '#10b981', label: 'collab.action.join' },
  leave:   { icon: UserX,    color: '#dc2626', label: 'collab.action.leave' },
  edit:    { icon: Edit2,    color: '#3b82f6', label: 'collab.action.edit' },
  comment: { icon: MessageSquare, color: '#7c3aed', label: 'collab.action.comment' },
  select:  { icon: MousePointer,   color: '#0891b2', label: 'collab.action.select' },
  mention: { icon: AtSign,    color: '#f59e0b', label: 'collab.action.mention' },
  save:    { icon: Save,      color: '#10b981', label: 'collab.action.save' },
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
  // [W2-A] 会诊列表/评论接 consultationApi 真实 (失败回退演示数据)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [consultations, setConsultations] = useState<Array<{ id: string; label: string; reportId: string }>>([]);
  // 当前选中的报告 (演示默认 rpt-013 / 真实为会诊 ID)
  const [selectedReportId, setSelectedReportId] = useState<string>('rpt-013');
  // 在线用户 (演示)
  const [users] = useState<CollabUser[]>(COLLAB_USERS);
  // 评论
  const [comments, setComments] = useState<CollabComment[]>(COLLAB_COMMENTS);
  // 活动
  const [activities] = useState<CollabActivity[]>(COLLAB_ACTIVITIES);
  // 新评论
  const [newComment, setNewComment] = useState('');
  // [G005 Wave1B] 评论回复: consultationApi.replyComment (POST /consultations/:id/comments/:commentId/reply)
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const handleReplyComment = async (commentId: string) => {
    if (!replyText.trim()) return;
    if (source === 'api') {
      setReplyingId(commentId);
      try {
        await consultationApi.replyComment(selectedReportId, commentId, currentUser.name, replyText.trim());
        setReplyText('');
        setReplyTo(null);
        await loadComments(selectedReportId);
        return;
      } catch (e) {
        window.alert?.('回复失败: ' + (e instanceof Error ? e.message : '未知错误'));
        return;
      } finally {
        setReplyingId(null);
      }
    }
    const parent = comments.find(c => c.id === commentId);
    const newC: CollabComment = {
      id: uniqueId('c'),
      reportId: selectedReportId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorColor: currentUser.color,
      content: replyText.trim(),
      position: parent?.position ?? { x: 200, y: 200 },
      resolved: false,
      parentId: commentId,
      mentions: [],
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    setComments([...comments, newC]);
    setReplyText('');
    setReplyTo(null);
  };
  // 当前选中的字段
  const [activeField, setActiveField] = useState<'findings' | 'diagnosis' | 'impression'>('findings');
  // 已解决显示
  const [showResolved, setShowResolved] = useState(false);
  // 自动滚动
  const [autoScroll, setAutoScroll] = useState(true);
  // 当前用户
  const currentUser = users[0]!; // 张明远

  const loadComments = useCallback(async (consultationId: string) => {
    try {
      const res = await consultationApi.listComments(consultationId);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setComments(res.data.map((c: any) => ({
          id: c.id,
          reportId: consultationId,
          authorId: c.author,
          authorName: c.author,
          authorColor: colorOf(String(c.author)),
          content: String(c.content || ''),
          fieldRef: undefined,
          position: { x: 200, y: 200 },
          resolved: false,
          parentId: c.parentId,
          mentions: [],
          createdAt: String(c.createdAt || '').replace('T', ' ').slice(0, 19),
        })));
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await consultationApi.list();
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length > 0) {
          const opts = list.map((c: any) => ({
            id: c.id,
            label: `${c.patientName ?? '未知患者'}（${c.modality ?? ''}${c.bodyPart ? '·' + c.bodyPart : ''}）`,
            reportId: c.id,
          }));
          setConsultations(opts);
          setSelectedReportId(opts[0]!.id);
          if (!cancelled) setSource('api');
        } else {
          setSource('demo');
        }
      } catch (e) {
        setSource('demo');
        setError(e instanceof Error ? e.message : t('collab.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (source === 'api' && selectedReportId.startsWith('CMT') === false) {
      void loadComments(selectedReportId);
    }
  }, [selectedReportId, source, loadComments]);

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
    const matched = users.filter(u => u.currentPage?.includes(selectedReportId));
    // 演示数据可能无 currentPage 命中, 回退显示全部用户, 避免"在线 0 人"空态
    return matched.length > 0 ? matched : users;
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

  // 提交评论: API 源 → consultationApi.addComment; 演示源 → 本地追加
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    const mentions = Array.from(newComment.matchAll(/@(\S+)/g)).map(m => m[1] ?? '');
    if (source === 'api') {
      try {
        await consultationApi.addComment(selectedReportId, currentUser.name, newComment.trim());
        setNewComment('');
        await loadComments(selectedReportId);
        return;
      } catch (e) {
        message.error('评论发送失败: ' + (e instanceof Error ? e.message : '未知错误'));
        return;
      }
    }
    const newC: CollabComment = {
      id: uniqueId('cmt'),
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

  if (loading) return <div role="status" data-testid="collab-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('collab.loading')}</div>;
  if (error && source === 'demo') return <div role="alert" data-testid="collab-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (users.length === 0) {
    return (
      <div data-testid="collab-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{t('collab.noOnlineUsers')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('collab.wsConnecting')}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-card)' }}>
      {/* 顶部状态栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
        color: '#fff', padding: '12px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={20} />
              {t('collab.title')}
              <span style={{
                fontSize: 12, padding: '2px 6px',
                background: '#10b981', color: '#fff',
                borderRadius: 3, fontWeight: 700,
              }}>R3</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              {t('collab.subtitle')}
              <span style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 10, marginLeft: 8,
                background: source === 'api' ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.35)',
                color: '#fff', border: `1px solid ${source === 'api' ? '#22c55e' : '#f59e0b'}`,
              }}>
                {source === 'api' ? t('collab.dataSourceApi') : t('collab.dataSourceDemo')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={selectedReportId}
              onChange={e => setSelectedReportId(e.target.value)}
              style={{
                padding: '5px 8px', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4, fontSize: 12, color: 'var(--text-primary)', background: 'rgba(255,255,255,0.95)',
              }}
            >
              {consultations.length > 0 ? consultations.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              )) : (
                <>
                  <option value="rpt-013">RP20260604013 黄海涛（胸部CT）</option>
                  <option value="rpt-018">RP20260603018 韩雪梅（乳腺钼靶）</option>
                </>
              )}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Wifi size={12} />
              <span>{t('collab.wsConnected')}</span>
            </div>
          </div>
        </div>

        {/* 在线用户 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, opacity: 0.85, marginRight: 4 }}>{t('collab.onlineCount', { count: reportOnlineUsers.filter(u => u.status === 'online').length })}</span>
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
                <span style={{ fontSize: 12, color: conf.color, fontWeight: 600 }}>{t(conf.label)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 主体三栏 */}
      <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>
        {/* 左：协同报告内容 */}
        <div style={{ flex: '1 1 480px', minWidth: 380, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12, overflowY: 'auto' }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)',
            position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8, columnGap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> {t('collab.reportBody')} <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>{t('collab.demoTag')}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                {(['findings', 'diagnosis', 'impression'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveField(f)}
                    style={{
                      padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                      background: activeField === f ? 'var(--color-info-bg)' : 'var(--bg-card)',
                      color: activeField === f ? '#1e40af' : '#475569',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {f === 'findings' ? t('collab.field.findings') : f === 'diagnosis' ? t('collab.field.diagnosis') : t('collab.field.impression')}
                  </button>
                ))}
              </div>
            </div>

            {/* 协作编辑区 */}
            <div style={{
              position: 'relative', padding: 16, flex: 1, minHeight: 160, overflow: 'hidden',
              background: 'var(--bg-card)', borderRadius: 6,
              border: '1px solid var(--border-color)',
              fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)',
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
                position: 'absolute', right: 12, bottom: 12, maxWidth: '70%',
                padding: '2px 8px', background: 'rgba(124, 58, 237, 0.12)',
                border: '1px dashed #7c3aed', borderRadius: 4,
                fontSize: 12, color: '#5b21b6',
                pointerEvents: 'none',
              }}>
                {t('collab.highlightText')}
              </div>
            </div>

            {/* 实时状态 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={11} /> <span style={{ color: '#10b981' }}>{t('collab.autoSaved')}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {t('collab.lastSync', { seconds: 2 })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Edit2 size={11} /> {t('collab.userEditing', { name: '李慧敏' })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
                <MousePointer size={11} /> {t('collab.cursorCount', { count: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* 中：评论 */}
        <div style={{
          flex: '0 0 340px', minHeight: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={13} /> {t('collab.comments')}
              <span style={{
                fontSize: 12, padding: '0 5px', borderRadius: 3,
                background: reportComments.length > 0 ? '#dc2626' : '#94a3b8',
                color: '#fff', fontWeight: 700,
              }}>{reportComments.length}</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={showResolved}
                onChange={e => setShowResolved(e.target.checked)}
              />
              {t('collab.showResolved')}
            </label>
          </div>

          {/* 评论列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {reportComments.map(comment => {
              const replies = comments.filter(c => c.parentId === comment.id);
              return (
                <div key={comment.id} style={{
                  padding: 10, marginBottom: 6,
                  background: comment.resolved ? 'var(--color-success-bg)' : 'var(--bg-card)',
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
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{comment.authorName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{comment.createdAt}</div>
                    </div>
                    {comment.fieldRef && (
                      <span style={{
                        fontSize: 12, padding: '0 4px', borderRadius: 2,
                        background: '#8b5cf622', color: '#7c3aed', fontWeight: 600,
                      }}>{comment.fieldRef === 'findings' ? t('collab.fieldRef.findings') : comment.fieldRef === 'impression' ? t('collab.fieldRef.impression') : comment.fieldRef}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.6 }}>
                    {comment.content.split(/(@\S+)/g).map((part, i) => {
                      if (part.startsWith('@')) {
                        return (
                          <span key={i} style={{
                            background: 'var(--color-warning-bg)', color: '#92400e',
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
                      {t('collab.selection')}{comment.selectionRef}
                    </div>
                  )}

                  {replies.length > 0 && (
                    <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: '2px solid #c4b5fd' }}>
                      {replies.map(reply => (
                        <div key={reply.id} style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-primary)' }}>
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
                      <CheckCircle2 size={10} /> {comment.resolved ? t('collab.resolved') : t('collab.resolve')}
                    </button>
                    <button
                      onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyText(''); }}
                      style={{
                        padding: '2px 6px', border: 'none', background: 'transparent',
                        color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      <Reply size={10} /> {t('collab.reply')}
                    </button>
                    {comment.mentions.length > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#f59e0b' }}>
                        {t('collab.mentionCount', { count: comment.mentions.length })}
                      </span>
                    )}
                  </div>

                  {replyTo === comment.id && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <input
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleReplyComment(comment.id); }}
                        placeholder={`回复 @${comment.authorName}...`}
                        style={{
                          flex: 1, padding: '4px 6px', border: '1px solid var(--border-color)',
                          borderRadius: 3, fontSize: 12, }}
                      />
                      <button
                        onClick={() => void handleReplyComment(comment.id)}
                        disabled={replyingId === comment.id || !replyText.trim()}
                        style={{
                          padding: '4px 10px', border: 'none', borderRadius: 3,
                          background: '#7c3aed', color: '#fff', fontSize: 12, cursor: 'pointer',
                          opacity: replyingId === comment.id || !replyText.trim() ? 0.5 : 1,
                        }}
                      >
                        {replyingId === comment.id ? t('collab.sending') : t('collab.send')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {reportComments.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                {t('collab.noComments')}
              </div>
            )}
          </div>

          {/* 评论输入 */}
          <div style={{ padding: 8, borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={t('collab.addCommentPlaceholder')}
              rows={2}
              style={{
                width: '100%', padding: 6, border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, resize: 'none', fontFamily: 'inherit',
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
                <Send size={11} /> {t('collab.send')}
              </button>
            </div>
          </div>
        </div>

        {/* 右：活动日志 */}
        <div style={{
          flex: '0 0 260px', minHeight: 0, background: 'var(--bg-card)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
            fontSize: 12, fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Activity size={13} /> {t('collab.realtimeActivity')}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {reportActivities.map(act => {
              const conf = ACTIVITY_CONFIG[act.action];
              const Icon = conf.icon;
              const user = users.find(u => u.id === act.userId);
              return (
                <div key={act.id} style={{
                  display: 'flex', gap: 6, padding: 6, marginBottom: 4,
                  background: 'var(--bg-card)', borderRadius: 4,
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
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.userName}</span>
                      <span style={{
                        fontSize: 12, padding: '0 4px', borderRadius: 2,
                        background: `${conf.color}15`, color: conf.color, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <Icon size={8} /> {t(conf.label)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{act.detail}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 1 }}>{act.timestamp}</div>
                  </div>
                </div>
              );
            })}
            {reportActivities.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                {t('collab.noActivity')}
              </div>
            )}
          </div>

          <div style={{ padding: 6, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              {t('collab.autoScroll')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

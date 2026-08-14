// ============================================================
// G005 放射科RIS系统 v1.0.3 - 报告审核工作台
// Phase R3：双审流程（初+终）+ 审核时效 KPI + 驳回 + 审核历史
// [v3.0.6.11-70] P0 真实化: 任务列表/通过/驳回 接入后端 reports 模块
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import {
  ClipboardCheck, Clock, XCircle,
  FileText, Search, BarChart3, TrendingUp,
  AlertTriangle, History, Eye, Edit2, Send,
  Award, ShieldCheck,
  ArrowRight, ThumbsUp, ThumbsDown,
  ListChecks,
} from 'lucide-react';
import {
  type ReviewTask,
  type ReviewStage,
  type ReviewStatus,
} from '../data/reviewRevisionCollabMock';
import { reportApi, type ReportDto } from '../services/api/reportApi';
import { useAuth } from '../hooks/useAuth';

// [v3.0.6.11-70] P0 真实化: 后端 ReportDto → 审核任务 (状态过滤/阶段映射)
function reportToReviewTask(r: ReportDto): ReviewTask | null {
  const key = `${r.status ?? ''}`;
  const is = (re: RegExp) => re.test(key);
  if (is(/草稿|DRAFT|draft|PENDING_ASSIGNMENT|ASSIGNED|WRITING|AMENDING|AMENDED|WITHDRAWN|ARCHIVED|RECTIFYING|SUPPLEMENTING|SUPPLEMENTED|REDISTRIBUTING|PUBLISHED|published|已发布/i)) return null;
  let stage: ReviewStage = 'initial';
  let status: ReviewStatus = 'pending';
  if (is(/REJECTED|rejected|驳回/i)) { stage = 'initial'; status = 'rejected'; }
  else if (is(/REVIEWED|reviewed|已审核/i)) status = 'completed';
  else if (is(/CO_SIGN|SIGNING|SIGNED|cosigned|已双签/i)) stage = 'sign';
  else if (is(/FINAL_REVIEW|finalreview/i)) stage = 'final';
  else if (is(/INITIAL_REVIEW|initialreview|SUBMITTED|submitted|已提交/i)) stage = 'initial';
  else return null;
  const submittedAt = r.reviewedAt ?? r.reportAt ?? r.updatedTime ?? r.createdTime ?? new Date().toISOString();
  const deadline = new Date(new Date(submittedAt).getTime() + 12 * 3600 * 1000).toISOString();
  const isOverdue = new Date(deadline).getTime() < Date.now();
  const hoursToDeadline = Math.round((new Date(deadline).getTime() - Date.now()) / 3600000);
  return {
    id: `rv-${r.reportId || r.id}`,
    reportId: r.reportId || r.id,
    patientName: r.patientName || '未知患者',
    modality: r.modality || 'CT',
    bodyPart: r.bodyPart || '胸部',
    reportDoctorId: r.doctorId || '',
    reportDoctorName: r.doctorId || '报告医师',
    reportDoctorTitle: '医师',
    stage,
    status,
    submittedAt,
    deadline,
    qualityScore: r.qualityScore,
    criticalFinding: Boolean(r.hasCriticalValue),
    isOverdue,
    hoursToDeadline,
    findingsText: r.findings || undefined,
    impressionText: r.impression || r.diagnosis || undefined,
    recommendationsText: r.recommendations || undefined,
  } as ReviewTask;
}

// ============================================================
// 阶段配置
// ============================================================
const STAGE_CONFIG: Record<ReviewStage, { label: string; color: string; bg: string; icon: any; description: string }> = {
  initial: { label: '初审', color: '#f59e0b', bg: '#f59e0b22', icon: Eye,         description: '高年资主治/副主任审核' },
  final:   { label: '终审', color: '#7c2d12', bg: '#f9731622', icon: ShieldCheck, description: '副主任以上终审' },
  sign:    { label: '签发', color: '#be185d', bg: '#ec489922', icon: Award,        description: '医生 CA 签发' },
};

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bg: string; border: string }> = {
  'pending':     { label: '待审核', color: '#f59e0b', bg: '#f59e0b22', border: '#fcd34d' },
  'in-progress': { label: '审核中', color: '#0891b2', bg: '#06b6d422', border: '#67e8f9' },
  'completed':   { label: '已完成', color: '#10b981', bg: '#22c55e22', border: '#6ee7b7' },
  'rejected':    { label: '已驳回', color: '#ef4444', bg: '#ef444422', border: '#fca5a5' },
  'overdue':     { label: '已超时', color: '#7f1d1d', bg: '#ef444422', border: '#f87171' },
};

// ============================================================
// 时间格式化
// ============================================================
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function deadlineInfo(_deadline: string, isOverdue: boolean, hoursToDeadline: number): { label: string; color: string } {
  if (isOverdue) {
    return { label: `超时 ${Math.abs(hoursToDeadline)}h`, color: '#dc2626' };
  }
  if (hoursToDeadline < 2) return { label: `${hoursToDeadline}h 内`, color: '#f59e0b' };
  return { label: `${hoursToDeadline}h 后`, color: 'var(--text-secondary)' };
}

// ============================================================
// 主组件
// ============================================================
export default function ReportReviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // [v3.0.6.11-70] P0 真实化: 任务列表来自 reportApi.list (过滤待审核状态)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [stage, setStage] = useState<ReviewStage | 'all'>('all');
  const [status, setStatus] = useState<ReviewStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [auditSuggestion, setAuditSuggestion] = useState('');
  const [auditScore, setAuditScore] = useState(90);
  const [auditDecision, setAuditDecision] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 避免 TypeScript 警告
  void navigate;

  // [v3.0.6.11-70] P0 真实化: 当前用户来自 useAuth (代替硬编码 'D005 刘文博')
  const currentUser = {
    id: user?.id ?? 'D005',
    name: user?.name ?? '刘文博',
    title: user?.title ?? '副主任医师',
  };

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await reportApi.list({ take: '200' });
    if (!res.success || !Array.isArray(res.data)) {
      setError(res.error?.message ?? '审核任务加载失败');
      setTasks([]);
      setLoading(false);
      return;
    }
    const mapped = res.data
      .map(reportToReviewTask)
      .filter((t): t is ReviewTask => t !== null);
    setTasks(mapped);
    setSelectedTaskId((prev) => {
      if (prev && mapped.some((t) => t.id === prev)) return prev;
      return mapped[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  // 过滤
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (stage !== 'all' && t.stage !== stage) return false;
      if (status !== 'all' && t.status !== status) return false;
      if (search && !t.patientName.includes(search) && !t.reportId.includes(search)) return false;
      return true;
    });
  }, [tasks, stage, status, search]);

  // 选中任务
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;

  // [v3.0.6.11-70] KPI 从真实任务列表统计 (代替 REVIEW_KPI 常量)
  const reviewKpi = useMemo(() => {
    const pendingInitial = tasks.filter(t => t.stage === 'initial' && (t.status === 'pending' || t.status === 'in-progress')).length;
    const pendingFinal = tasks.filter(t => t.stage === 'final' && (t.status === 'pending' || t.status === 'in-progress')).length;
    const pendingSign = tasks.filter(t => t.stage === 'sign' && (t.status === 'pending' || t.status === 'in-progress')).length;
    const overdue = tasks.filter(t => t.isOverdue && t.status !== 'completed').length;
    const rejected = tasks.filter(t => t.status === 'rejected').length;
    const totalToday = tasks.length;
    const onTimeRate = totalToday > 0 ? Math.round(((totalToday - overdue) / totalToday) * 100) : 100;
    return { totalToday, pendingInitial, pendingFinal, pendingSign, overdue, rejected, onTimeRate };
  }, [tasks]);

  // [v3.0.6.11-70] P0 真实化: 通过/驳回 → 调后端 transition (REVIEWED / REJECTED + 驳回原因)
  const handleAuditSubmit = useCallback(async (decision: 'approve' | 'reject') => {
    if (!selectedTask) return;
    if (decision === 'reject' && !auditSuggestion.trim()) {
      message.warning('驳回必须填写审核意见');
      return;
    }
    setSubmitting(true);
    const res = decision === 'approve'
      ? await reportApi.review(selectedTask.reportId)
      : await reportApi.reject(selectedTask.reportId, auditSuggestion.trim());
    if (res.success) {
      message.success(decision === 'approve' ? `已通过 (${STAGE_CONFIG[selectedTask.stage].label})` : '已驳回并退回报告医师');
      setAuditDecision(null);
      setAuditSuggestion('');
      await loadTasks();
    } else {
      message.error(res.error?.message ?? '审核操作失败,请重试');
    }
    setSubmitting(false);
  }, [selectedTask, auditSuggestion, loadTasks]);

  if (loading) return <div role="status" data-testid="review-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>;
  if (error) return <div role="alert" data-testid="review-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (tasks.length === 0) {
    return (
      <div data-testid="review-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>暂无审核任务</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>当前没有待审核的报告,可从报告书写页提交报告后查看</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', background: 'var(--content-bg)' }}>
      {/* 顶部 KPI */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
        color: '#fff', padding: '12px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardCheck size={20} />
              报告审核工作台
              <span style={{
                fontSize: 12, padding: '2px 6px',
                background: '#10b981', color: '#fff',
                borderRadius: 3, fontWeight: 700,
              }}>R3</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              双审流程（初+终）+ 审核时效 KPI + 驳回闭环 · 已接入真实报告流转
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            当前审核员：<strong>{currentUser.name}（{currentUser.title}）</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          <KpiMini icon={ListChecks} label="今日审核" value={reviewKpi.totalToday} color="#bfdbfe" />
          <KpiMini icon={Clock} label="待初审" value={reviewKpi.pendingInitial} color="#fde68a" />
          <KpiMini icon={ShieldCheck} label="待终审" value={reviewKpi.pendingFinal} color="#fed7aa" />
          <KpiMini icon={Award} label="待签发" value={reviewKpi.pendingSign} color="#fbcfe8" />
          <KpiMini icon={AlertTriangle} label="已超时" value={reviewKpi.overdue} color="#fca5a5" alert />
          <KpiMini icon={XCircle} label="已驳回" value={reviewKpi.rejected} color="#fca5a5" />
          <KpiMini icon={TrendingUp} label="按时率" value={`${reviewKpi.onTimeRate}%`} color="#bbf7d0" good />
        </div>
      </div>

      {/* 阶段 Tab */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        padding: '0 20px', display: 'flex', alignItems: 'center', flexShrink: 0,
      }}>
        {[
          { key: 'all', label: '全部', icon: BarChart3 },
          { key: 'initial', label: '初审', icon: Eye },
          { key: 'final', label: '终审', icon: ShieldCheck },
          { key: 'sign', label: '签发', icon: Award },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setStage(t.key as any)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                color: stage === t.key ? '#1e40af' : '#64748b',
                fontWeight: stage === t.key ? 700 : 500,
                fontSize: 13, cursor: 'pointer',
                borderBottom: `2px solid ${stage === t.key ? '#3b82f6' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索患者/报告 ID..."
              style={{
                padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, outline: 'none', width: 180,
              }}
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            style={{ padding: '5px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}
          >
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="in-progress">审核中</option>
            <option value="rejected">已驳回</option>
            <option value="overdue">已超时</option>
          </select>
        </div>
      </div>

      {/* 主体 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左：任务列表 */}
        <div style={{
          width: 460, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)',
          overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
            fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span><strong style={{ color: '#1e40af' }}>{filteredTasks.length}</strong> 个任务</span>
            <span>共 {tasks.length} 条记录</span>
          </div>
          {filteredTasks.map(task => {
            const stageConf = STAGE_CONFIG[task.stage];
            const statusConf = STATUS_CONFIG[task.status];
            const StageIcon = stageConf.icon;
            const isSelected = task.id === selectedTaskId;
            const deadline = deadlineInfo(task.deadline, task.isOverdue, task.hoursToDeadline);

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                style={{
                  padding: 12, borderBottom: '1px solid var(--border-light)',
                  background: isSelected ? 'var(--color-info-bg)' : task.isOverdue ? 'var(--color-error-bg)' : 'transparent',
                  borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3,
                      background: stageConf.bg, color: stageConf.color,
                      fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <StageIcon size={9} /> {stageConf.label}
                    </span>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3,
                      background: statusConf.bg, color: statusConf.color, border: `1px solid ${statusConf.border}`,
                      fontSize: 12, fontWeight: 600,
                    }}>{statusConf.label}</span>
                    {task.criticalFinding && (
                      <span style={{
                        fontSize: 12, padding: '1px 4px',
                        background: '#dc2626', color: '#fff', borderRadius: 2,
                        fontWeight: 700,
                      }}>危急值</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: deadline.color, fontWeight: 600 }}>
                    ⏱ {deadline.label}
                  </span>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {task.patientName} · {task.modality} {task.bodyPart}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>报告：<strong>{task.reportDoctorTitle} {task.reportDoctorName}</strong></span>
                  <span>·</span>
                  <span>质量 {task.qualityScore}</span>
                  <span>·</span>
                  <span>{timeAgo(task.submittedAt)}</span>
                </div>

                {/* 阶段进度指示 */}
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {['initial', 'final', 'sign'].map(s => {
                    const isPast = ['initial', 'final', 'sign'].indexOf(s) < ['initial', 'final', 'sign'].indexOf(task.stage);
                    const isCurrent = s === task.stage;
                    return (
                      <div
                        key={s}
                        style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: isPast ? '#10b981' : isCurrent ? '#3b82f6' : '#e2e8f0',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredTasks.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
              无匹配任务
            </div>
          )}
        </div>

        {/* 右：任务详情 + 审核操作 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {selectedTask ? (
            <ReviewTaskDetail
              task={selectedTask}
              currentUser={currentUser}
              auditSuggestion={auditSuggestion}
              setAuditSuggestion={setAuditSuggestion}
              auditScore={auditScore}
              setAuditScore={setAuditScore}
              auditDecision={auditDecision}
              setAuditDecision={setAuditDecision}
              submitting={submitting}
              onAuditSubmit={handleAuditSubmit}
            />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>请从左侧选择审核任务</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// KPI 卡片
// ============================================================
const KpiMini: React.FC<{ icon: any; label: string; value: number | string; color: string; alert?: boolean; good?: boolean }> = ({ icon: Icon, label, value, color, alert, good }) => {
  void color; return (
  <div style={{
    background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
    borderRadius: 6, padding: '6px 10px',
    border: alert ? '1px solid rgba(220,38,38,0.5)' : good ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.2)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon size={12} style={{ color: alert ? '#fca5a5' : good ? '#bbf7d0' : '#bfdbfe' }} />
      <span style={{ fontSize: 12, opacity: 0.85 }}>{label}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
  </div>
  );
};


// ============================================================
// 任务详情 + 审核操作
// ============================================================
const ReviewTaskDetail: React.FC<{
  task: ReviewTask;
  currentUser: any;
  auditSuggestion: string;
  setAuditSuggestion: (v: string) => void;
  auditScore: number;
  setAuditScore: (v: number) => void;
  auditDecision: 'approve' | 'reject' | null;
  setAuditDecision: (v: any) => void;
  submitting: boolean;
  onAuditSubmit: (decision: 'approve' | 'reject') => void;
}> = ({ task, currentUser, auditSuggestion, setAuditSuggestion, auditScore, setAuditScore, auditDecision, setAuditDecision, submitting, onAuditSubmit }) => {
  const stageConf = STAGE_CONFIG[task.stage];
  const statusConf = STATUS_CONFIG[task.status];
  const StageIcon = stageConf.icon;
  const deadline = deadlineInfo(task.deadline, task.isOverdue, task.hoursToDeadline);

  // [v3.0.6.11-70] 报告正文: 优先展示真实所见/诊断
  const findingsText = (task as any).findingsText || `${task.modality}平扫+增强示${task.bodyPart}区正常结构存在。${task.criticalFinding ? ' 病灶内见异常信号/密度影。' : ''}`;
  const impressionText = (task as any).impressionText || (task.criticalFinding ? '考虑恶性可能，建议进一步检查。' : '考虑良性可能，建议随访。');

  // [v3.0.6.11-98 Wave3B P1] 全屏预览: 报告内容全屏 Modal (详情组件内状态)
  const [previewFull, setPreviewFull] = useState(false);

  return (
    <div>
      {/* 头部 */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 12,
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {task.patientName}
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>· {task.modality} {task.bodyPart}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>报告 ID：{task.reportId}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              padding: '3px 10px', borderRadius: 4,
              background: stageConf.bg, color: stageConf.color, fontWeight: 700, fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <StageIcon size={11} /> {stageConf.label}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 4,
              background: statusConf.bg, color: statusConf.color, border: `1px solid ${statusConf.border}`,
              fontSize: 12, fontWeight: 600,
            }}>{statusConf.label}</span>
            <span style={{ fontSize: 12, color: deadline.color, fontWeight: 700, padding: '3px 10px', background: 'var(--content-bg)', borderRadius: 4 }}>
              ⏱ {deadline.label}
            </span>
          </div>
        </div>

        {/* 三栏信息 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 12 }}>
          <InfoCell label="报告医生" value={`${task.reportDoctorTitle} ${task.reportDoctorName}`} />
          <InfoCell label="提交时间" value={task.submittedAt} />
          <InfoCell label="截止时间" value={task.deadline} alert={task.isOverdue} />
          <InfoCell label="质量评分" value={`${task.qualityScore}/100`} />
        </div>

        {/* 阶段进度 */}
        <div style={{ marginTop: 12, padding: 10, background: 'var(--content-bg)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>三阶段审核流程</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {['initial', 'final', 'sign'].map((s, i) => {
              const sConf = STAGE_CONFIG[s as ReviewStage];
              const SIcon = sConf.icon;
              const isPast = ['initial', 'final', 'sign'].indexOf(s) < ['initial', 'final', 'sign'].indexOf(task.stage);
              const isCurrent = s === task.stage;
              return (
                <React.Fragment key={s}>
                  <div style={{
                    flex: 1, padding: 8, background: 'var(--bg-card)', border: `1px solid ${isCurrent ? sConf.color : '#e2e8f0'}`,
                    borderRadius: 4, textAlign: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, color: isPast ? '#10b981' : isCurrent ? sConf.color : 'var(--text-secondary)' }}>
                      <SIcon size={11} />
                      <strong>{sConf.label}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {s === 'initial' && (task.initialAuditCompletedAt ? '✓ 已完成' : task.initialAuditStartAt ? '⏳ 进行中' : '○ 待开始')}
                      {s === 'final' && (task.finalAuditCompletedAt ? '✓ 已完成' : task.finalAuditStartAt ? '⏳ 进行中' : '○ 待开始')}
                      {s === 'sign' && (task.status === 'rejected' ? '✗ 已驳回' : '○ 待开始')}
                    </div>
                  </div>
                  {i < 2 && <ArrowRight size={12} color="#cbd5e1" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* 报告内容（只读） */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 12,
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} /> 报告内容
          </div>
          <button
            onClick={() => setPreviewFull(true)}
            style={{
              padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Eye size={11} /> 全屏预览
          </button>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#1e40af' }}>【检查所见】</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'var(--content-bg)', borderRadius: 4 }}>
              {findingsText}
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#1e40af' }}>【诊断意见】</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'var(--content-bg)', borderRadius: 4 }}>
              {impressionText}
            </div>
          </div>
          <div>
            <strong style={{ color: '#1e40af' }}>【建议】</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'var(--content-bg)', borderRadius: 4 }}>
              {(task as any).recommendationsText || '3 个月后复查。'}
            </div>
          </div>
        </div>
      </div>

      {/* [v3.0.6.11-98 Wave3B P1] 全屏预览 Modal */}
      <Modal
        title={`报告全屏预览 · ${task.patientName} ${task.bodyPart}`}
        open={previewFull}
        onCancel={() => setPreviewFull(false)}
        footer={null}
        width="100%"
        styles={{ body: { maxHeight: '85vh', overflowY: 'auto' } }}
      >
        <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--text-primary)' }}>
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>患者: </span>{task.patientName}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>检查: </span>{task.bodyPart}（{task.modality}）</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>报告医生: </span>{task.reportDoctorTitle} {task.reportDoctorName}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>提交时间: </span>{task.submittedAt}</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#1e40af' }}>【检查所见】</strong>
            <div style={{ marginTop: 4, padding: 12, background: 'var(--content-bg)', borderRadius: 4 }}>{findingsText}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#1e40af' }}>【诊断意见】</strong>
            <div style={{ marginTop: 4, padding: 12, background: 'var(--content-bg)', borderRadius: 4 }}>{impressionText}</div>
          </div>
          <div>
            <strong style={{ color: '#1e40af' }}>【建议】</strong>
            <div style={{ marginTop: 4, padding: 12, background: 'var(--content-bg)', borderRadius: 4 }}>
              {(task as any).recommendationsText || '3 个月后复查。'}
            </div>
          </div>
        </div>
      </Modal>

      {/* 初审/终审历史 */}
      {(task.initialAuditCompletedAt || task.finalAuditCompletedAt) && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 12,
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={14} /> 审核历史
          </div>
          {task.initialAuditCompletedAt && (
            <div style={{ padding: 10, background: 'var(--color-info-bg)', border: '1px solid #bae6fd', borderRadius: 6, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0369a1', fontSize: 12 }}>✓ 初审完成</strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.initialAuditCompletedAt}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {task.initialAuditTitle} {task.initialAuditDoctorName} · 评分 {task.initialAuditScore}/100
              </div>
              {task.initialAuditSuggestion && (
                <div style={{ fontSize: 12, color: '#0c4a6e', padding: 6, background: 'var(--bg-card)', borderRadius: 4 }}>
                  💬 {task.initialAuditSuggestion}
                </div>
              )}
            </div>
          )}
          {task.finalAuditCompletedAt && (
            <div style={{ padding: 10, background: '#8b5cf622', border: '1px solid #f0abfc', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#86198f', fontSize: 12 }}>✓ 终审完成</strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.finalAuditCompletedAt}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {task.finalAuditTitle} {task.finalAuditDoctorName} · 评分 {task.finalAuditScore}/100
              </div>
              {task.finalAuditSuggestion && (
                <div style={{ fontSize: 12, color: '#86198f', padding: 6, background: 'var(--bg-card)', borderRadius: 4 }}>
                  💬 {task.finalAuditSuggestion}
                </div>
              )}
            </div>
          )}
          {task.rejectedReason && (
            <div style={{ padding: 10, background: 'var(--color-error-bg)', border: '1px solid #fca5a5', borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <XCircle size={12} /> 已驳回
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d' }}>{task.rejectedReason}</div>
            </div>
          )}
        </div>
      )}

      {/* 审核操作面板 */}
      {(task.status === 'pending' || task.status === 'in-progress' || task.status === 'overdue') && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: 16,
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Edit2 size={14} /> {stageConf.label}操作
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>审核评分（0-100）</div>
              <input
                type="range" min={0} max={100} value={auditScore}
                onChange={e => setAuditScore(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: auditScore >= 90 ? '#10b981' : auditScore >= 75 ? '#f59e0b' : '#dc2626' }}>
                {auditScore} 分
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>快捷评分</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[60, 75, 85, 90, 95].map(s => (
                  <button
                    key={s}
                    onClick={() => setAuditScore(s)}
                    style={{
                      flex: 1, padding: '6px 4px',
                      background: auditScore === s ? 'var(--color-info-bg)' : 'var(--bg-card)',
                      border: `1px solid ${auditScore === s ? '#3b82f6' : '#cbd5e1'}`,
                      borderRadius: 4, fontSize: 12, fontWeight: 600,
                      color: auditScore === s ? '#1e40af' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>审核意见</div>
            <textarea
              value={auditSuggestion}
              onChange={e => setAuditSuggestion(e.target.value)}
              rows={3}
              placeholder="请输入审核意见（驳回必填，通过建议填写）"
              style={{
                width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 决策按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setAuditDecision('approve')}
              style={{
                flex: 1, padding: 10, border: 'none', borderRadius: 6,
                background: auditDecision === 'approve' ? '#10b981' : '#d1fae5',
                color: auditDecision === 'approve' ? '#fff' : '#047857',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderBottom: auditDecision === 'approve' ? 'none' : '2px solid #10b981',
              }}
            >
              <ThumbsUp size={14} /> 通过（{stageConf.label}）
            </button>
            <button
              onClick={() => setAuditDecision('reject')}
              style={{
                flex: 1, padding: 10, border: 'none', borderRadius: 6,
                background: auditDecision === 'reject' ? '#dc2626' : 'var(--color-error-bg)',
                color: auditDecision === 'reject' ? '#fff' : '#b91c1c',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderBottom: auditDecision === 'reject' ? 'none' : '2px solid #dc2626',
              }}
            >
              <ThumbsDown size={14} /> 驳回
            </button>
          </div>

          <button
            onClick={() => onAuditSubmit(auditDecision ?? 'approve')}
            disabled={!auditDecision || (auditDecision === 'reject' && !auditSuggestion) || submitting}
            style={{
              width: '100%', marginTop: 8, padding: 12, border: 'none', borderRadius: 6,
              background: (!auditDecision || (auditDecision === 'reject' && !auditSuggestion)) ? '#cbd5e1' : '#1e40af',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: (!auditDecision || (auditDecision === 'reject' && !auditSuggestion) || submitting) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Send size={14} /> {submitting ? '提交中...' : `提交${stageConf.label}（${currentUser.name}）`}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// 信息单元
// ============================================================
const InfoCell: React.FC<{ label: string; value: string; alert?: boolean }> = ({ label, value, alert }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
    <div style={{ fontSize: 12, color: alert ? '#dc2626' : 'var(--text-primary)', fontWeight: 600, marginTop: 1 }}>{value}</div>
  </div>
);

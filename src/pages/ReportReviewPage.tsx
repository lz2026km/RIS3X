// ============================================================
// G005 放射科RIS系统 v1.0.3 - 报告审核工作台
// Phase R3：双审流程（初+终）+ 审核时效 KPI + 驳回 + 审核历史
// [v3.0.6.11-70] P0 真实化: 任务列表/通过/驳回 接入后端 reports 模块
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Tag, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
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
// [v3.0.6.11-103 Wave 12] 审核增强: diff 高亮 / 危急值自动检测 / 随访建议
import { computeDiff, type DiffChunk } from '../services/reportDiffEngine';
import { criticalAlertApi } from '../services/api/criticalAlertApi';
import FollowupAutoBookPanel from '../components/report/v3/R3.WRITING/FollowupAutoBookPanel';
import { t } from '../i18n/appI18n';
import { ActionButton } from '../components/common/ActionButton';
import { DataTable } from '../components/common/DataTable';
import { CheckCircle2, Siren, CalendarClock } from 'lucide-react';
import ReportFlowBar from '../components/report/ReportFlowBar';
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
    patientName: r.patientName || t('w9c.reportReview.unknownPatient'),
    modality: r.modality || 'CT',
    bodyPart: r.bodyPart || t('w9c.reportReview.defaultBodyPart'),
    reportDoctorId: r.doctorId || '',
    reportDoctorName: r.doctorId || t('w9c.reportReview.defaultDoctorName'),
    reportDoctorTitle: t('w9c.reportReview.defaultDoctorTitle'),
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
    statusRaw: r.status || r.state || '',
  } as ReviewTask;
}

// ============================================================
// 阶段配置
// ============================================================
const STAGE_CONFIG: Record<ReviewStage, { label: string; color: string; bg: string; icon: any; description: string }> = {
  initial: { label: t('reportReviewPage.stageInitial'), color: '#f59e0b', bg: '#f59e0b22', icon: Eye,         description: t('reportReviewPage.stageInitialDesc') },
  final:   { label: t('reportReviewPage.stageFinal'), color: '#7c2d12', bg: '#f9731622', icon: ShieldCheck, description: t('reportReviewPage.stageFinalDesc') },
  sign:    { label: t('reportReviewPage.stageSign'), color: '#be185d', bg: '#ec489922', icon: Award,        description: t('reportReviewPage.stageSignDesc') },
};

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bg: string; border: string }> = {
  'pending':     { label: t('reportReviewPage.statusPending'), color: '#f59e0b', bg: '#f59e0b22', border: '#fcd34d' },
  'in-progress': { label: t('reportReviewPage.statusInProgress'), color: '#0891b2', bg: '#06b6d422', border: '#67e8f9' },
  'completed':   { label: t('reportReviewPage.statusCompleted'), color: '#10b981', bg: '#22c55e22', border: '#6ee7b7' },
  'rejected':    { label: t('reportReviewPage.statusRejected'), color: '#ef4444', bg: '#ef444422', border: '#fca5a5' },
  'overdue':     { label: t('reportReviewPage.statusOverdue'), color: '#7f1d1d', bg: '#ef444422', border: '#f87171' },
};

// ============================================================
// 时间格式化
// ============================================================
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return t('w9c.reportReview.minutesAgo', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('w9c.reportReview.hoursAgo', { count: h });
  return t('w9c.reportReview.daysAgo', { count: Math.floor(h / 24) });
}

function deadlineInfo(_deadline: string, isOverdue: boolean, hoursToDeadline: number): { label: string; color: string } {
  if (isOverdue) {
    return { label: t('w9c.reportReview.overdueH', { hours: Math.abs(hoursToDeadline) }), color: '#dc2626' };
  }
  if (hoursToDeadline < 2) return { label: t('w9c.reportReview.hoursWithin', { hours: hoursToDeadline }), color: '#f59e0b' };
  return { label: t('w9c.reportReview.hoursAfter', { hours: hoursToDeadline }), color: 'var(--text-secondary)' };
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
      setError(res.error?.message ?? t('reportReviewPage.msgLoadFailed'));
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
      message.warning(t('reportReviewPage.msgRejectReasonRequired'));
      return;
    }
    setSubmitting(true);
    const res = decision === 'approve'
      ? await reportApi.review(selectedTask.reportId)
      : await reportApi.reject(selectedTask.reportId, auditSuggestion.trim());
    if (res.success) {
      message.success(decision === 'approve' ? t('w9c.reportReview.approvedWithStage', { stage: STAGE_CONFIG[selectedTask.stage].label }) : t('reportReviewPage.msgRejectedBack'));
      setAuditDecision(null);
      setAuditSuggestion('');
      await loadTasks();
    } else {
      message.error(res.error?.message ?? t('reportReviewPage.msgAuditFailed'));
    }
    setSubmitting(false);
  }, [selectedTask, auditSuggestion, loadTasks]);

  const taskColumns: ColumnsType<ReviewTask> = [
    {
      title: t('reportReviewPage.stageInitial'), key: 'stage', width: 150,
      render: (_: unknown, task) => {
        const stageConf = STAGE_CONFIG[task.stage];
        const statusConf = STATUS_CONFIG[task.status];
        const StageIcon = stageConf.icon;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ padding: '1px 6px', borderRadius: 3, background: stageConf.bg, color: stageConf.color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
              <StageIcon size={9} /> {stageConf.label}
            </span>
            <span style={{ padding: '1px 6px', borderRadius: 3, background: statusConf.bg, color: statusConf.color, border: `1px solid ${statusConf.border}`, fontSize: 12, fontWeight: 600 }}>{statusConf.label}</span>
            {task.criticalFinding && <span style={{ fontSize: 12, padding: '1px 4px', background: '#dc2626', color: '#fff', borderRadius: 2, fontWeight: 700 }}>{t('reportReviewPage.critical')}</span>}
          </div>
        );
      },
    },
    {
      title: t('reportReviewPage.patientLabel'), dataIndex: 'patientName', key: 'patientName',
      render: (_: unknown, task) => (
        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{task.patientName} · {task.modality} {task.bodyPart}</div>
          <div style={{ display: 'flex', gap: 2 }}>
            {['initial', 'final', 'sign'].map(s => {
              const idx = ['initial', 'final', 'sign'];
              const isPast = idx.indexOf(s) < idx.indexOf(task.stage);
              const isCurrent = s === task.stage;
              return <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: isPast ? '#10b981' : isCurrent ? '#3b82f6' : '#e2e8f0' }} />;
            })}
          </div>
        </div>
      ),
    },
    { title: t('reportReviewPage.reportLabel'), key: 'doctor', width: 130, render: (_: unknown, task) => <span>{task.reportDoctorTitle} {task.reportDoctorName}</span> },
    { title: t('reportReviewPage.quality'), dataIndex: 'qualityScore', key: 'qualityScore', width: 90, align: 'center' },
    { title: t('reportReviewPage.infoSubmitTime'), dataIndex: 'submittedAt', key: 'submittedAt', width: 100, render: (v: string) => timeAgo(v) },
    {
      title: t('reportReviewPage.infoDeadline'), key: 'deadline', width: 100,
      render: (_: unknown, task) => {
        const deadline = deadlineInfo(task.deadline, task.isOverdue, task.hoursToDeadline);
        return <span style={{ fontSize: 12, color: deadline.color, fontWeight: 600 }}>⏱ {deadline.label}</span>;
      },
    },
  ];

  if (loading) return <div role="status" data-testid="review-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('reportReviewPage.loading')}</div>;
  if (error) return <div role="alert" data-testid="review-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (tasks.length === 0) {
    return (
      <div data-testid="review-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{t('reportReviewPage.emptyTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportReviewPage.emptyHint')}</div>
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
              {t('reportReviewPage.title')}
              <span style={{
                fontSize: 12, padding: '2px 6px',
                background: '#10b981', color: '#fff',
                borderRadius: 3, fontWeight: 700,
              }}>R3</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              {t('reportReviewPage.subtitle')}
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            {t('reportReviewPage.currentReviewer')}：<strong>{currentUser.name}（{currentUser.title}）</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          <KpiMini icon={ListChecks} label={t('reportReviewPage.kpiToday')} value={reviewKpi.totalToday} color="#bfdbfe" />
          <KpiMini icon={Clock} label={t('reportReviewPage.kpiPendingInitial')} value={reviewKpi.pendingInitial} color="#fde68a" />
          <KpiMini icon={ShieldCheck} label={t('reportReviewPage.kpiPendingFinal')} value={reviewKpi.pendingFinal} color="#fed7aa" />
          <KpiMini icon={Award} label={t('reportReviewPage.kpiPendingSign')} value={reviewKpi.pendingSign} color="#fbcfe8" />
          <KpiMini icon={AlertTriangle} label={t('reportReviewPage.kpiOverdue')} value={reviewKpi.overdue} color="#fca5a5" alert />
          <KpiMini icon={XCircle} label={t('reportReviewPage.kpiRejected')} value={reviewKpi.rejected} color="#fca5a5" />
          <KpiMini icon={TrendingUp} label={t('reportReviewPage.kpiOnTimeRate')} value={`${reviewKpi.onTimeRate}%`} color="#bbf7d0" good />
        </div>
      </div>

      {/* 阶段 Tab */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        padding: '0 20px', display: 'flex', alignItems: 'center', flexShrink: 0,
      }}>
        {[
          { key: 'all', label: t('reportReviewPage.all'), icon: BarChart3 },
          { key: 'initial', label: t('reportReviewPage.stageInitial'), icon: Eye },
          { key: 'final', label: t('reportReviewPage.stageFinal'), icon: ShieldCheck },
          { key: 'sign', label: t('reportReviewPage.stageSign'), icon: Award },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setStage(tab.key as any)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                color: stage === tab.key ? '#1e40af' : '#64748b',
                fontWeight: stage === tab.key ? 700 : 500,
                fontSize: 13, cursor: 'pointer',
                borderBottom: `2px solid ${stage === tab.key ? '#3b82f6' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon size={13} /> {tab.label}
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
              placeholder={t('reportReviewPage.searchPlaceholder')}
              style={{
                padding: '5px 8px 5px 26px', border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, outline: 'none', width: 180,
              }}
            />
          </div>
          <Select
            value={status}
            onChange={value => setStatus(value as any)}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: t('reportReviewPage.allStatus') },
              { value: 'pending', label: t('reportReviewPage.statusPending') },
              { value: 'in-progress', label: t('reportReviewPage.statusInProgress') },
              { value: 'rejected', label: t('reportReviewPage.statusRejected') },
              { value: 'overdue', label: t('reportReviewPage.statusOverdue') },
            ]}
          />
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
            <span><strong style={{ color: '#1e40af' }}>{filteredTasks.length}</strong> {t('reportReviewPage.taskUnit')}</span>
            <span>{t('reportReviewPage.totalPrefix')} {tasks.length} {t('reportReviewPage.recordUnit')}</span>
          </div>
          <DataTable<ReviewTask>
            columns={taskColumns}
            dataSource={filteredTasks}
            rowKey="id"
            showPagination={false}
            emptyText={t('reportReviewPage.noMatchingTask')}
            onRow={(task) => ({
              onClick: () => setSelectedTaskId(task.id),
              style: {
                cursor: 'pointer',
                background: task.id === selectedTaskId ? 'var(--color-info-bg)' : task.isOverdue ? 'var(--color-error-bg)' : undefined,
              },
            })}
            scroll={{ x: 'max-content' }}
          />
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
              onReloadTasks={() => { void loadTasks(); }}
            />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('reportReviewPage.selectTaskHint')}</div>
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
  onReloadTasks?: () => void;
}> = ({ task, currentUser, auditSuggestion, setAuditSuggestion, auditScore, setAuditScore, auditDecision, setAuditDecision, submitting, onAuditSubmit, onReloadTasks }) => {
  const stageConf = STAGE_CONFIG[task.stage];
  const statusConf = STATUS_CONFIG[task.status];
  const StageIcon = stageConf.icon;
  const deadline = deadlineInfo(task.deadline, task.isOverdue, task.hoursToDeadline);

  // [v3.0.6.11-70] 报告正文: 优先展示真实所见/诊断
  const findingsText = (task as any).findingsText || `${task.modality}平扫+增强示${task.bodyPart}区正常结构存在。${task.criticalFinding ? ' 病灶内见异常信号/密度影。' : ''}`;
  const impressionText = (task as any).impressionText || (task.criticalFinding ? t('reportReviewPage.impressionMalignant') : t('reportReviewPage.impressionBenign'));

  // [v3.0.6.11-98 Wave3B P1] 全屏预览: 报告内容全屏 Modal (详情组件内状态)
  const [previewFull, setPreviewFull] = useState(false);

  // [v3.0.6.11-103 Wave 12] 修改痕迹视图: GET /reports/:id/diff → 原文 vs 当前 diff 高亮
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<{ old: string; cur: string; changes: string[] } | null>(null);

  const loadDiff = useCallback(async () => {
    if (diffOpen) { setDiffOpen(false); return; }
    setDiffOpen(true);
    setDiffLoading(true);
    try {
      const res = await reportApi.diff(task.reportId);
      if (res.success && res.data) {
        const oldV = res.data.oldVersion ?? {};
        const newV = res.data.newVersion ?? {};
        const pick = (v: Record<string, unknown>) => [v.findings, v.impression, v.diagnosis, v.recommendations].filter(Boolean).join('\n\n');
        setDiffData({
          old: pick(oldV as Record<string, unknown>) || findingsText,
          cur: pick(newV as Record<string, unknown>) || findingsText,
          changes: Array.isArray(res.data.changes) ? res.data.changes : [],
        });
      } else {
        setDiffData({ old: findingsText, cur: findingsText, changes: [] });
      }
    } catch {
      setDiffData({ old: findingsText, cur: findingsText, changes: [] });
    } finally {
      setDiffLoading(false);
    }
  }, [task.reportId, findingsText]);

  // [v3.0.6.11-103 Wave 12] 发布后处置: 危急值关键词自动检测 (报告正文命中即提示转危急值处置)
  const criticalKeywords = ['脑疝', '主动脉夹层', '主动脉瘤', '肺栓塞', '气胸', '张力性气胸', '消化道穿孔', '急性肠梗阻', '颅内出血', '蛛网膜下腔出血', '脑出血', '急性心包填塞', '夹层', '大出血'];
  const fullText = `${findingsText}\n${impressionText}\n${(task as any).recommendationsText ?? ''}`;
  const criticalHits = useMemo(() => criticalKeywords.filter((k) => fullText.includes(k)), [fullText]);
  const [cvBusy, setCvBusy] = useState(false);
  const handleTransferCritical = useCallback(async () => {
    setCvBusy(true);
    try {
      const res = await criticalAlertApi.create({
        criticalValueId: task.reportId,
        level: 'critical',
        patientId: (task as any).patientId || task.reportId,
        patientName: task.patientName,
        studyId: task.reportId,
        modality: task.modality,
        title: t('w9c.reportReview.criticalNotifyTitle', { hits: criticalHits.join('/') }),
        description: t('w9c.reportReview.criticalNotifyDesc', { reportId: task.reportId, hits: criticalHits.join('、') }),
        reportId: task.reportId,
      });
      if (res.success) {
        message.success(t('w12.review.criticalCreated'));
        setTimeout(() => { window.location.href = '/critical-alert'; }, 1200);
      } else {
        message.error(t('w12.review.criticalCreateFail'));
      }
    } catch {
      message.error(t('w12.review.criticalCreateFail'));
    } finally {
      setCvBusy(false);
    }
  }, [task, criticalHits]);

  return (
    <div>
      {/* [v3.0.6.11-103 Wave 12] 报告流程状态条: 7 态状态机 + 下一步一键流转 (审核/签发场景) */}
      <div style={{ marginBottom: 12 }}>
        <ReportFlowBar
          status={(task as any).statusRaw || (task.stage === 'initial' ? 'INITIAL_REVIEW' : task.stage === 'final' ? 'FINAL_REVIEW' : task.stage === 'sign' ? 'SIGNING' : undefined)}
          reportId={task.reportId}
          compact
          onTransited={(to) => {
            void to;
            setAuditDecision(null);
            setAuditSuggestion('');
            setTimeout(() => { onReloadTasks?.(); }, 800);
          }}
        />
      </div>
      {/* [v3.0.6.11-103 Wave 12] 修改痕迹视图: 原文 + diff 高亮 */}
      {diffOpen && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 12,
          border: '1px solid var(--border-color)',
        }} data-testid="review-diff-view">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <History size={14} /> {t('w12.review.modificationView')}
              <Tag color="green" style={{ margin: 0 }}>{task.reportId}</Tag>
            </div>
            <button onClick={() => setDiffOpen(false)} style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              {t('w12.review.originalView')}
            </button>
          </div>
          {diffLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>{t('w12.review.diffLoading')}</div>
          ) : diffData && diffData.old !== diffData.cur ? (
            <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 6, color: '#64748b' }}>
                <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '1px 6px', borderRadius: 3, marginRight: 8 }}>{t('reportReviewPage.diffRemoved')}</span>
                <span style={{ background: '#ecfdf5', color: '#047857', padding: '1px 6px', borderRadius: 3 }}>{t('reportReviewPage.diffAdded')}</span>
              </div>
              <DiffHighlight oldText={diffData.old} newText={diffData.cur} />
              {diffData.changes.length > 0 && (
                <div style={{ marginTop: 10, padding: 8, background: 'var(--color-warning-bg)', borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>{t('w12.review.diffField')} ({diffData.changes.length})</div>
                  {diffData.changes.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#78350f' }}>• {c}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-success)', fontSize: 12 }}>
              <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('w12.review.diffNoChange')}
            </div>
          )}
        </div>
      )}

      {/* [v3.0.6.11-103 Wave 12] 发布后处置: 危急值自动检测 + 一键转危急值处置 + 随访自动建议 */}
      {(task.status === 'completed' || task.status === 'rejected') && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 12,
          border: '1px solid var(--border-color)',
        }} data-testid="post-publish-panel">
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} /> {t('w12.review.postPublish')}
          </div>
          <div style={{ marginBottom: 10 }}>
            {criticalHits.length > 0 ? (
              <div style={{
                padding: 10, borderRadius: 6, background: 'var(--color-error-bg)',
                border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Siren size={16} color="#dc2626" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
                      {t('w12.review.criticalDetected')}: {criticalHits.join('、')}
                    </div>
                    <div style={{ fontSize: 12, color: '#7f1d1d' }}>{t('w12.review.criticalDetectedHint')}</div>
                  </div>
                </div>
                <ActionButton
                  action="submit"
                  variant="danger"
                  loading={cvBusy}
                  icon={<AlertTriangle size={13} />}
                  onClick={() => void handleTransferCritical()}
                >
                  {t('w12.review.toCritical')}
                </ActionButton>
              </div>
            ) : (
              <div style={{ padding: 10, borderRadius: 6, background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', fontSize: 12, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={13} /> {t('w12.review.criticalNone')}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarClock size={13} /> {t('w12.review.followupSuggest')}
            </div>
            <FollowupAutoBookPanel
              reportText={`${findingsText}\n${impressionText}\n${(task as any).recommendationsText ?? ''}`}
              patientId={(task as any).patientId || task.reportId}
              patientName={task.patientName}
              reportId={task.reportId}
              examId={(task as any).examId}
            />
          </div>
        </div>
      )}
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
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t('reportReviewPage.reportIdLabel')}：{task.reportId}</div>
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
          <InfoCell label={t('reportReviewPage.infoReportDoctor')} value={`${task.reportDoctorTitle} ${task.reportDoctorName}`} />
          <InfoCell label={t('reportReviewPage.infoSubmitTime')} value={task.submittedAt} />
          <InfoCell label={t('reportReviewPage.infoDeadline')} value={task.deadline} alert={task.isOverdue} />
          <InfoCell label={t('reportReviewPage.infoQualityScore')} value={`${task.qualityScore}/100`} />
        </div>

        {/* 阶段进度 */}
        <div style={{ marginTop: 12, padding: 10, background: 'var(--content-bg)', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{t('reportReviewPage.threeStageProcess')}</div>
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
                      {s === 'initial' && (task.initialAuditCompletedAt ? t('reportReviewPage.done') : task.initialAuditStartAt ? t('reportReviewPage.inProgress') : t('reportReviewPage.notStarted'))}
                      {s === 'final' && (task.finalAuditCompletedAt ? t('reportReviewPage.done') : task.finalAuditStartAt ? t('reportReviewPage.inProgress') : t('reportReviewPage.notStarted'))}
                      {s === 'sign' && (task.status === 'rejected' ? t('reportReviewPage.rejectStatus') : t('reportReviewPage.notStarted'))}
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
              <FileText size={14} /> {t('reportReviewPage.reportContent')}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* [v3.0.6.11-103 Wave 12] 修改痕迹开关: 原文 ↔ diff 高亮 */}
              <button
                onClick={() => void loadDiff()}
                style={{
                  padding: '4px 8px', border: `1px solid ${diffOpen ? '#1e40af' : 'var(--border-color)'}`, borderRadius: 4,
                  background: diffOpen ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: diffOpen ? '#1e40af' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontWeight: diffOpen ? 700 : 400,
                }}
              >
                <History size={11} /> {diffOpen ? t('w12.review.originalView') : t('w12.review.modificationView')}
              </button>
              <ActionButton
                action="refresh"
                size="compact"
                icon={<Eye size={11} />}
                onClick={() => setPreviewFull(true)}
              >
                {t('reportReviewPage.fullscreenPreview')}
              </ActionButton>
            </div>
          </div>
        <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#1e40af' }}>{t('reportReviewPage.sectionFindings')}</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'var(--content-bg)', borderRadius: 4 }}>
              {findingsText}
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#1e40af' }}>{t('reportReviewPage.sectionImpression')}</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'var(--content-bg)', borderRadius: 4 }}>
              {impressionText}
            </div>
          </div>
          <div>
            <strong style={{ color: '#1e40af' }}>{t('reportReviewPage.sectionRecommendation')}</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'var(--content-bg)', borderRadius: 4 }}>
              {(task as any).recommendationsText || t('reportReviewPage.followupAdvice')}
            </div>
          </div>
        </div>
      </div>

      {/* [v3.0.6.11-98 Wave3B P1] 全屏预览 Modal */}
      <Modal
        title={t('w9c.reportReview.fullPreviewTitle', { patient: task.patientName, bodyPart: task.bodyPart })}
        open={previewFull}
        onCancel={() => setPreviewFull(false)}
        footer={null}
        width="100%"
        styles={{ body: { maxHeight: '85vh', overflowY: 'auto' } }}
      >
        <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--text-primary)' }}>
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('reportReviewPage.patientLabel')}</span>{task.patientName}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('reportReviewPage.examLabel')}</span>{task.bodyPart}（{task.modality}）</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('reportReviewPage.reportDoctorLabel')}</span>{task.reportDoctorTitle} {task.reportDoctorName}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('reportReviewPage.submitTimeLabel')}</span>{task.submittedAt}</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#1e40af' }}>{t('reportReviewPage.sectionFindings')}</strong>
            <div style={{ marginTop: 4, padding: 12, background: 'var(--content-bg)', borderRadius: 4 }}>{findingsText}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: '#1e40af' }}>{t('reportReviewPage.sectionImpression')}</strong>
            <div style={{ marginTop: 4, padding: 12, background: 'var(--content-bg)', borderRadius: 4 }}>{impressionText}</div>
          </div>
          <div>
            <strong style={{ color: '#1e40af' }}>{t('reportReviewPage.sectionRecommendation')}</strong>
            <div style={{ marginTop: 4, padding: 12, background: 'var(--content-bg)', borderRadius: 4 }}>
              {(task as any).recommendationsText || t('reportReviewPage.followupAdvice')}
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
            <History size={14} /> {t('reportReviewPage.auditHistory')}
          </div>
          {task.initialAuditCompletedAt && (
            <div style={{ padding: 10, background: 'var(--color-info-bg)', border: '1px solid #bae6fd', borderRadius: 6, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0369a1', fontSize: 12 }}>✓ {t('reportReviewPage.initialAuditDone')}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.initialAuditCompletedAt}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {task.initialAuditTitle} {task.initialAuditDoctorName} · {t('reportReviewPage.score')} {task.initialAuditScore}/100
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
                <strong style={{ color: '#86198f', fontSize: 12 }}>✓ {t('reportReviewPage.finalAuditDone')}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.finalAuditCompletedAt}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {task.finalAuditTitle} {task.finalAuditDoctorName} · {t('reportReviewPage.score')} {task.finalAuditScore}/100
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
                <XCircle size={12} /> {t('reportReviewPage.statusRejected')}
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
            <Edit2 size={14} /> {stageConf.label}{t('reportReviewPage.actions')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{t('reportReviewPage.auditScoreLabel')}</div>
              <input
                type="range" min={0} max={100} value={auditScore}
                onChange={e => setAuditScore(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: auditScore >= 90 ? '#10b981' : auditScore >= 75 ? '#f59e0b' : '#dc2626' }}>
                {auditScore} {t('reportReviewPage.scoreUnit')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{t('reportReviewPage.quickScore')}</div>
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
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{t('reportReviewPage.auditOpinion')}</div>
            <textarea
              value={auditSuggestion}
              onChange={e => setAuditSuggestion(e.target.value)}
              rows={3}
              placeholder={t('reportReviewPage.auditOpinionPlaceholder')}
              style={{
                width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            {/* [v3.0.6.11-103 Wave 12] 快捷退回原因: 一键填充 */}
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('w12.review.quickReasons')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUICK_REJECT_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setAuditSuggestion(r)}
                    style={{
                      padding: '4px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                      background: auditSuggestion === r ? 'var(--color-error-bg)' : 'var(--bg-card)',
                      border: `1px solid ${auditSuggestion === r ? '#fca5a5' : 'var(--border-color)'}`,
                      color: auditSuggestion === r ? '#b91c1c' : 'var(--text-secondary)',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
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
              <ThumbsUp size={14} /> {t('reportReviewPage.pass')}（{stageConf.label}）
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
              <ThumbsDown size={14} /> {t('reportReviewPage.rejectBtn')}
            </button>
          </div>

          <ActionButton
            action="submit"
            icon={<Send size={14} />}
            loading={submitting}
            disabled={!auditDecision || (auditDecision === 'reject' && !auditSuggestion)}
            block
            style={{ marginTop: 8 }}
            onClick={() => onAuditSubmit(auditDecision ?? 'approve')}
          >
            {submitting ? t('reportReviewPage.submitting') : t('w9c.reportReview.submitLabel', { stage: stageConf.label, name: currentUser.name })}
          </ActionButton>
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

// ============================================================
// [v3.0.6.11-103 Wave 12] 修改痕迹 diff 高亮 (computeDiff: 红=删除 绿=新增)
// ============================================================
const DiffHighlight: React.FC<{ oldText: string; newText: string }> = ({ oldText, newText }) => {
  const chunks = useMemo<DiffChunk[]>(() => computeDiff(oldText, newText), [oldText, newText]);
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }} data-testid="review-diff-highlight">
      {chunks.map((c: DiffChunk, i: number) =>
        c.type === 'removed' ? (
          <span key={i} style={{ background: '#fef2f2', color: '#b91c1c', textDecoration: 'line-through', borderRadius: 2, padding: '0 2px' }}>{c.text}</span>
        ) : c.type === 'added' ? (
          <span key={i} style={{ background: '#ecfdf5', color: '#047857', borderRadius: 2, padding: '0 2px' }}>{c.text}</span>
        ) : (
          <span key={i}>{c.text}</span>
        )
      )}
    </div>
  );
};

// [v3.0.6.11-103 Wave 12] 退回快捷原因 (一键填充审核意见)
const QUICK_REJECT_REASONS = [
  t('reportReviewPage.quickReason1'),
  t('reportReviewPage.quickReason2'),
  t('reportReviewPage.quickReason3'),
  t('reportReviewPage.quickReason4'),
  t('reportReviewPage.quickReason5'),
];

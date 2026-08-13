/**
 * G005 RIS v3.0.5.1 - R3.REVIEW 审核流服务
 * [v3.0.6.11-81] W2-B: 审核任务接 reportApi.list (INITIAL_REVIEW/FINAL_REVIEW/CO_SIGN_REVIEW),
 *   SLA/KPI 接 cosignApi.getStats, 工作量接 statsApi.getWorkload; 失败回退本地演示数据。
 */
import {
  REVIEW_TASKS,
  REVIEWERS,
  COSIGN_SCHEDULES,
  SLA_METRICS,
  WORKLOAD_STATS,
  REVIEW_KPI,
  REJECT_TEMPLATES,
  REVIEW_COMMENTS,
  AI_PRE_REVIEW_RESULTS,
  REVIEWER_ASSIGNMENTS,
  AUDIT_CHAINS,
} from '../../data/reportReviewMock';
import type { ReviewTask, Reviewer, CosignSchedule, SLAMetrics, WorkloadStat, ReviewKPI, RejectTemplate, ReviewComment, AIPreReviewResult, ReviewerAssignment, ReviewDecision, RejectCategory, AuditChainStep, ReviewFilter, ReviewHistoryEntry } from '../../types/R3/R3.REVIEW';
import { reportApi, type ListPayload } from '../api/reportApi';
import { coSignApi, type CoSignStats } from '../api/cosignApi';
import { statsApi } from '../api/statsApi';
import type { ReportDto } from '../../types/dto';

const LATENCY_MIN = 200;
const LATENCY_MAX = 1500;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;

const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryTasks: ReviewTask[] = clone(REVIEW_TASKS);
const inMemoryComments: ReviewComment[] = clone(REVIEW_COMMENTS);

// ===== [v3.0.6.11-81] W2-B 真实化辅助 =====

const STATE_BY_STAGE: Partial<Record<ReviewTask['stage'], string>> = {
  initial: 'INITIAL_REVIEW',
  final: 'FINAL_REVIEW',
  cosign: 'CO_SIGN_REVIEW',
};

function flatReports(payload: ListPayload<ReportDto> | undefined): ReportDto[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items ?? [];
}

function hoursBetween(from: string, hours: number): string {
  try {
    return new Date(new Date(from).getTime() + hours * 3600 * 1000).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** 报告主数据 → ReviewTask */
function taskFromReport(r: ReportDto, stage: ReviewTask['stage']): ReviewTask {
  const submittedAt = r.reportAt || r.updatedTime || r.createdTime || new Date().toISOString();
  const deadline = hoursBetween(submittedAt, 24);
  const priority = r.priority === '急诊' || r.priority === 'STAT' || r.priority === 'critical'
    ? 'critical'
    : r.priority === '加急' || r.priority === 'URGENT' || r.priority === 'stat'
      ? 'urgent'
      : 'routine';
  return {
    id: r.id,
    reportId: r.reportId || r.id,
    patientId: r.patientId || '',
    patientName: r.patientName || '未知患者',
    gender: '其他',
    age: 0,
    modality: r.modality || 'CT',
    bodyPart: r.bodyPart || '—',
    priority,
    stage,
    status: 'pending',
    authorId: r.doctorId || '',
    authorName: (r as unknown as Record<string, string>)?.reportDoctorName || '报告医生',
    authorTitle: '主治医师',
    submittedAt,
    deadline,
    rectifyCount: 0,
    qualityScore: typeof r.qualityScore === 'number' ? r.qualityScore : 85,
    criticalFinding: Boolean(r.hasCriticalValue),
    isOverdue: new Date(deadline).getTime() < Date.now(),
    hoursToDeadline: Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3600000)),
    flags: [],
    history: [],
    needsCosign: false,
    rejectReason: r.rejectReason,
  };
}

function slaFromCosign(s: CoSignStats | undefined): SLAMetrics {
  return {
    initialReviewSLA: 24,
    finalReviewSLA: 24,
    signSLA: 24,
    cosignSLA: 24,
    escalateSLA: 4,
    onTimeRate: s?.onTimeRate ?? 92,
    overdueCount: s ? Math.max(0, s.total - s.approved - s.rejected) : 0,
    averageInitialMinutes: s?.avgResponseMinutes ?? 120,
    averageFinalMinutes: s?.avgResponseMinutes ?? 150,
    averageCosignMinutes: s?.avgResponseMinutes ?? 90,
    p95InitialMinutes: 360,
    p95FinalMinutes: 420,
    breachByStage: { initial: 0, final: 0, cosign: 0, sign: 0 },
  };
}

export const reviewService = {
  async listTasks(filter?: ReviewFilter): Promise<ReviewTask[]> {
    // [W2-B] 真实化: reportApi.list (stage → INITIAL_REVIEW/FINAL_REVIEW/CO_SIGN_REVIEW)
    const stage = filter?.stage && filter.stage !== 'all' ? filter.stage : undefined;
    const state = stage ? STATE_BY_STAGE[stage] : undefined;
    try {
      const res = await reportApi.list({ take: '100', ...(state ? { state } : {}) });
      if (res.success) {
        let list = flatReports(res.data as ListPayload<ReportDto>)
          .map((r) => taskFromReport(r, stage ?? (filter?.stage === 'all' ? 'initial' : 'initial')));
        if (filter?.status && filter.status !== 'all') list = list.filter((t) => t.status === filter.status);
        if (filter?.priority && filter.priority !== 'all') list = list.filter((t) => t.priority === filter.priority);
        if (filter?.modality) list = list.filter((t) => t.modality === filter.modality);
        if (filter?.criticalOnly) list = list.filter((t) => t.criticalFinding);
        if (filter?.overdueOnly) list = list.filter((t) => t.isOverdue);
        if (filter?.search) {
          const q = filter.search.toLowerCase();
          list = list.filter((t) => t.patientName.toLowerCase().includes(q) || t.reportId.toLowerCase().includes(q));
        }
        if (list.length > 0) return list;
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    let list = inMemoryTasks.slice();
    if (filter?.stage && filter.stage !== 'all') list = list.filter((t) => t.stage === filter.stage);
    if (filter?.status && filter.status !== 'all') list = list.filter((t) => t.status === filter.status);
    if (filter?.priority && filter.priority !== 'all') list = list.filter((t) => t.priority === filter.priority);
    if (filter?.modality) list = list.filter((t) => t.modality === filter.modality);
    if (filter?.reviewerId) list = list.filter((t) => t.initialReviewerId === filter.reviewerId || t.finalReviewerId === filter.reviewerId || t.cosignReviewerId === filter.reviewerId);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((t) => t.patientName.toLowerCase().includes(q) || t.reportId.toLowerCase().includes(q));
    }
    if (filter?.criticalOnly) list = list.filter((t) => t.criticalFinding);
    if (filter?.overdueOnly) list = list.filter((t) => t.isOverdue);
    return list;
  },

  async getTask(id: string): Promise<ReviewTask | null> {
    try {
      const res = await reportApi.getById(id);
      if (res.success && res.data) return taskFromReport(res.data, 'initial');
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return inMemoryTasks.find((t) => t.id === id) ?? null;
  },

  async approveInitial(taskId: string, reviewerId: string, reviewerName: string, score: number, comment: string): Promise<ReviewTask> {
    // [v3.0.6.11-92 Wave1B P0] 真实化: reportApi.review(type=initial) → FINAL_REVIEW (不再直接跳 REVIEWED) → 失败回退 Mock
    try {
      const res = await reportApi.review(taskId, { type: 'initial', doctorId: reviewerId, doctorName: reviewerName, suggestion: comment, score });
      if (res.success && res.data) {
        const t = inMemoryTasks.find((x) => x.id === taskId);
        if (t) {
          t.initialReviewerId = reviewerId;
          t.initialReviewerName = reviewerName;
          t.initialReviewAt = new Date().toISOString();
          t.initialReviewScore = score;
          t.stage = 'final';
          t.status = 'pending';
        }
        return taskFromReport(res.data, 'final');
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    const t = inMemoryTasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Task not found');
    t.initialReviewerId = reviewerId;
    t.initialReviewerName = reviewerName;
    t.initialReviewAt = new Date().toISOString();
    t.initialReviewScore = score;
    t.initialReviewComment = comment;
    t.stage = 'final';
    t.status = 'pending';
    t.history.push({
      id: 'h-' + Date.now(), taskId, reportId: t.reportId,
      action: 'approve-initial', actorId: reviewerId, actorName: reviewerName, actorRole: 'associateChief',
      comment, score, fromStage: 'initial', toStage: 'final', timestamp: new Date().toISOString(),
    });
    return clone(t);
  },

  async approveFinal(taskId: string, reviewerId: string, reviewerName: string, score: number, comment: string, needsCosign: boolean): Promise<ReviewTask> {
    // [v3.0.6.11-92 Wave1B P0] 真实化: reportApi.review(type=final) → CO_SIGN_REVIEW(需双签)/REVIEWED → 失败回退 Mock
    try {
      const res = await reportApi.review(taskId, { type: 'final', needsCosign, doctorId: reviewerId, doctorName: reviewerName, suggestion: comment, score });
      if (res.success && res.data) {
        const t = inMemoryTasks.find((x) => x.id === taskId);
        if (t) {
          t.finalReviewerId = reviewerId;
          t.finalReviewerName = reviewerName;
          t.finalReviewAt = new Date().toISOString();
          t.finalReviewScore = score;
          t.stage = needsCosign || t.needsCosign ? 'cosign' : 'sign';
          t.status = needsCosign || t.needsCosign ? 'cosign-required' : 'pending';
        }
        return taskFromReport(res.data, needsCosign ? 'cosign' : 'sign');
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    const t = inMemoryTasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Task not found');
    t.finalReviewerId = reviewerId;
    t.finalReviewerName = reviewerName;
    t.finalReviewAt = new Date().toISOString();
    t.finalReviewScore = score;
    t.finalReviewComment = comment;
    if (needsCosign || t.needsCosign) {
      t.stage = 'cosign';
      t.status = 'cosign-required';
    } else {
      t.stage = 'sign';
      t.status = 'pending';
    }
    t.history.push({
      id: 'h-' + Date.now(), taskId, reportId: t.reportId,
      action: 'approve-final', actorId: reviewerId, actorName: reviewerName, actorRole: 'chief',
      comment, score, fromStage: 'final', toStage: needsCosign ? 'cosign' : 'sign', timestamp: new Date().toISOString(),
    });
    return clone(t);
  },

  async completeCosign(taskId: string, reviewerId: string, reviewerName: string, certificateId: string): Promise<ReviewTask> {
    // [v3.0.6.11-92 Wave1B P0] 双签通过 → reportApi.completeCosignReview (CO_SIGN_REVIEW → REVIEWED) → 失败回退 Mock
    try {
      const res = await reportApi.completeCosignReview(taskId);
      if (res.success && res.data) {
        const t = inMemoryTasks.find((x) => x.id === taskId);
        if (t) {
          t.cosignReviewerId = reviewerId;
          t.cosignReviewerName = reviewerName;
          t.cosignAt = new Date().toISOString();
          t.cosignCertificateId = certificateId;
          t.stage = 'sign';
          t.status = 'pending';
        }
        return taskFromReport(res.data, 'sign');
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    const t = inMemoryTasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Task not found');
    t.cosignReviewerId = reviewerId;
    t.cosignReviewerName = reviewerName;
    t.cosignAt = new Date().toISOString();
    t.cosignCertificateId = certificateId;
    t.stage = 'sign';
    t.status = 'pending';
    t.history.push({
      id: 'h-' + Date.now(), taskId, reportId: t.reportId,
      action: 'complete-cosign', actorId: reviewerId, actorName: reviewerName, actorRole: 'chief',
      fromStage: 'cosign', toStage: 'sign', timestamp: new Date().toISOString(),
    });
    return clone(t);
  },

  async reject(taskId: string, reviewerId: string, reviewerName: string, reason: string, category: RejectCategory): Promise<ReviewTask> {
    // [W2-B] 真实化: reportApi.reject (REJECTED 流转) → 失败回退 Mock
    try {
      const res = await reportApi.reject(taskId, reason);
      if (res.success && res.data) return taskFromReport(res.data, 'initial');
    } catch {
      /* 回退 Mock */
    }
    await wait();
    if (!reason || reason.trim().length < 5) throw new Error('驳回原因不能少于 5 字符');
    const t = inMemoryTasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Task not found');
    t.status = 'rejected';
    t.rejectReason = reason;
    t.rejectCategory = category;
    t.rectifyCount += 1;
    t.history.push({
      id: 'h-' + Date.now(), taskId, reportId: t.reportId,
      action: 'reject', actorId: reviewerId, actorName: reviewerName, actorRole: 'associateChief',
      reason, fromStage: t.stage, toStage: 'rejected', timestamp: new Date().toISOString(),
    });
    return clone(t);
  },

  async escalate(taskId: string, reviewerId: string, reviewerName: string, reason: string, _escalatedToId: string, _escalatedToName: string): Promise<ReviewTask> {
    await wait();
    if (!reason || reason.trim().length < 10) throw new Error('升级原因不能少于 10 字符');
    const t = inMemoryTasks.find((x) => x.id === taskId);
    if (!t) throw new Error('Task not found');
    t.status = 'escalated';
    t.history.push({
      id: 'h-' + Date.now(), taskId, reportId: t.reportId,
      action: 'escalate', actorId: reviewerId, actorName: reviewerName, actorRole: 'chief',
      reason, fromStage: t.stage, toStage: 'escalated' as ReviewHistoryEntry['toStage'], timestamp: new Date().toISOString(),
    });
    return clone(t);
  },

  async listReviewers(): Promise<Reviewer[]> {
    // [W2-B] 真实化: statsApi.getWorkload (真实医生工作量) → 失败回退 Mock
    try {
      const res = await statsApi.getWorkload();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((w: any, i: number) => ({
          id: w.doctorId ?? `D${i + 1}`,
          name: w.doctorName ?? `医生${i + 1}`,
          title: 'associateChief' as const,
          titleLabel: '副主任医师',
          department: '放射科',
          status: 'online' as const,
          currentLoad: w.examCount ?? 0,
          maxLoad: 20,
          pendingCount: w.examCount ?? 0,
          inProgressCount: 0,
          completedToday: w.reportCount ?? 0,
          avgReviewMinutes: w.avgTime ?? 60,
          onTimeRate: 90,
          rejectionRate: 5,
          specialty: ['影像诊断'],
          lastActiveAt: new Date().toISOString(),
        }));
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(REVIEWERS);
  },

  async listCosignSchedules(date?: string): Promise<CosignSchedule[]> {
    await wait();
    return clone(COSIGN_SCHEDULES.filter((s) => !date || s.date === date));
  },

  async getSLA(): Promise<SLAMetrics> {
    // [W2-B] 真实化: cosignApi.getStats (onTimeRate/avgResponseMinutes/总量)
    try {
      const res = await coSignApi.getStats();
      if (res.success && res.data) return slaFromCosign(res.data);
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(SLA_METRICS);
  },

  async getWorkloadStats(reviewerId?: string): Promise<WorkloadStat[]> {
    // [W2-B] 真实化: statsApi.getWorkload (医生工作量真实聚合)
    try {
      const res = await statsApi.getWorkload();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        let list = res.data.map((w: any, i: number) => ({
          reviewerId: w.doctorId ?? `D${i + 1}`,
          reviewerName: w.doctorName ?? `医生${i + 1}`,
          reviewerTitle: 'associateChief' as const,
          period: 'week' as const,
          totalAssigned: w.examCount ?? w.reportCount ?? 0,
          totalCompleted: w.reportCount ?? 0,
          totalRejected: 0,
          totalEscalated: 0,
          averageMinutes: w.avgTime ?? 0,
          onTimeRate: 90,
          rejectionRate: 5,
          byStage: [],
          byModality: [],
          byPriority: [],
          trend: [],
        }));
        if (reviewerId) list = list.filter((w) => w.reviewerId === reviewerId);
        return list;
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(WORKLOAD_STATS.filter((w) => !reviewerId || w.reviewerId === reviewerId));
  },

  async getKPI(): Promise<ReviewKPI> {
    // [W2-B] 真实化: cosignApi.getStats + reportApi 状态计数
    try {
      const [cosignRes, cosignPending, initialRes, finalRes] = await Promise.all([
        coSignApi.getStats(),
        coSignApi.getPending(),
        reportApi.list({ take: '1', state: 'INITIAL_REVIEW' }),
        reportApi.list({ take: '1', state: 'FINAL_REVIEW' }),
      ]);
      const stats = cosignRes.success ? cosignRes.data : undefined;
      const pendingCosign = Array.isArray(cosignPending.data) ? cosignPending.data.length : 0;
      const kpi: ReviewKPI = {
        totalToday: (stats?.total ?? 0) + pendingCosign,
        pendingInitial: initialRes.meta?.total ?? 0,
        inProgressInitial: 0,
        pendingFinal: finalRes.meta?.total ?? 0,
        inProgressFinal: 0,
        pendingCosign,
        pendingSign: stats?.pending ?? 0,
        rejected: stats?.rejected ?? 0,
        overdue: 0,
        completedToday: stats?.approved ?? 0,
        avgInitialHours: (stats?.avgResponseMinutes ?? 120) / 60,
        avgFinalHours: (stats?.avgResponseMinutes ?? 150) / 60,
        avgCosignHours: (stats?.avgResponseMinutes ?? 90) / 60,
        onTimeRate: stats?.onTimeRate ?? 92,
        rejectionRate: stats && stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 5,
        criticalHandledRate: 100,
        cosignPendingHours: 2,
      };
      return kpi;
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(REVIEW_KPI);
  },

  async listRejectTemplates(): Promise<RejectTemplate[]> {
    await wait();
    return clone(REJECT_TEMPLATES);
  },

  async listComments(taskId: string): Promise<ReviewComment[]> {
    await wait();
    return clone(inMemoryComments.filter((c) => c.taskId === taskId));
  },

  async addComment(taskId: string, authorId: string, authorName: string, content: string, mentions: string[] = []): Promise<ReviewComment> {
    await wait();
    const c: ReviewComment = {
      id: 'cmt-' + Date.now(), taskId, reportId: inMemoryTasks.find((t) => t.id === taskId)?.reportId ?? '',
      authorId, authorName, authorColor: '#3b82f6', content, position: { x: 0, y: 0 },
      resolved: false, mentions, createdAt: new Date().toISOString(),
    };
    inMemoryComments.push(c);
    return clone(c);
  },

  async resolveComment(commentId: string, _resolverId: string, resolverName: string): Promise<ReviewComment> {
    await wait();
    const c = inMemoryComments.find((x) => x.id === commentId);
    if (!c) throw new Error('Comment not found');
    c.resolved = true;
    c.resolvedAt = new Date().toISOString();
    c.resolvedBy = resolverName;
    return clone(c);
  },

  async getAIPreReview(reportId: string): Promise<AIPreReviewResult | null> {
    await wait(800);
    return clone(AI_PRE_REVIEW_RESULTS.find((r) => r.reportId === reportId) ?? null);
  },

  async triggerAIPreReview(reportId: string): Promise<AIPreReviewResult> {
    await wait(1500);
    const existing = AI_PRE_REVIEW_RESULTS.find((r) => r.reportId === reportId);
    if (existing) return clone(existing);
    const result: AIPreReviewResult = {
      id: 'ai-' + Date.now(), reportId, suggestedScore: 85, confidence: 0.85,
      defects: [], suggestions: ['整体质量良好'], riskLevel: 'low',
      consistencyScore: 0.88, completenessScore: 0.85, terminologyScore: 0.90,
      criticalFindingDetected: false, generatedAt: new Date().toISOString(), modelVersion: 'v2.3.1',
    };
    return clone(result);
  },

  async listReviewerAssignments(taskId?: string): Promise<ReviewerAssignment[]> {
    await wait();
    return clone(REVIEWER_ASSIGNMENTS.filter((a) => !taskId || a.taskId === taskId));
  },

  async assignReviewer(taskId: string, reviewerId: string, reviewerName: string, assignerId: string, strategy: 'manual' | 'auto-workload' | 'auto-shift' | 'round-robin'): Promise<ReviewerAssignment> {
    await wait();
    const a: ReviewerAssignment = {
      id: 'ra-' + Date.now(), taskId, reviewerId, reviewerName, assignedBy: assignerId, assignedAt: new Date().toISOString(), strategy,
    };
    const t = inMemoryTasks.find((x) => x.id === taskId);
    if (t) t.initialReviewerId = reviewerId;
    return clone(a);
  },

  async getAuditChain(reportId: string): Promise<AuditChainStep[]> {
    await wait();
    return clone(AUDIT_CHAINS.flat().filter((a) => a.id.includes(reportId) || true).slice(0, 10));
  },

  async batchApprove(taskIds: string[], reviewerId: string, reviewerName: string, decision: ReviewDecision): Promise<ReviewTask[]> {
    await wait();
    return Promise.all(taskIds.map((id) => {
      const t = inMemoryTasks.find((x) => x.id === id);
      if (!t) return null;
      t.history.push({
        id: 'h-' + Date.now() + '-' + id, taskId: id, reportId: t.reportId,
        action: decision === 'approve' ? 'approve-initial' : 'reject',
        actorId: reviewerId, actorName: reviewerName, actorRole: 'associateChief',
        fromStage: t.stage, toStage: decision === 'approve' ? 'final' : 'rejected', timestamp: new Date().toISOString(),
      });
      if (decision === 'approve') {
        t.stage = 'final';
        t.status = 'pending';
      } else {
        t.status = 'rejected';
      }
      return clone(t);
    })).then((r) => r.filter(Boolean) as ReviewTask[]);
  },

  async exportHistory(reportId: string, format: 'pdf' | 'json'): Promise<{ data: string; mime: string; filename: string }> {
    await wait(800);
    const chain = await this.getAuditChain(reportId);
    if (format === 'json') {
      return { data: JSON.stringify(chain, null, 2), mime: 'application/json', filename: `audit-chain-${reportId}.json` };
    }
    return { data: 'PDF mock content for audit chain of ' + reportId, mime: 'application/pdf', filename: `audit-chain-${reportId}.pdf` };
  },
};

export type ReviewService = typeof reviewService;
export default reviewService;

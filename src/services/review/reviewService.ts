/**
 * G005 RIS v3.0.5.1 - R3.REVIEW 审核流服务 (Mock)
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
import type { ReviewTask, Reviewer, CosignSchedule, SLAMetrics, WorkloadStat, ReviewKPI, RejectTemplate, ReviewComment, AIPreReviewResult, ReviewerAssignment, ReviewDecision, RejectCategory, AuditChainStep, ReviewFilter } from '../../types/R3/R3.REVIEW';

const LATENCY_MIN = 200;
const LATENCY_MAX = 1500;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;

const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryTasks: ReviewTask[] = clone(REVIEW_TASKS);
const inMemoryComments: ReviewComment[] = clone(REVIEW_COMMENTS);

export const reviewService = {
  async listTasks(filter?: ReviewFilter): Promise<ReviewTask[]> {
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
    await wait();
    return inMemoryTasks.find((t) => t.id === id) ?? null;
  },

  async approveInitial(taskId: string, reviewerId: string, reviewerName: string, score: number, comment: string): Promise<ReviewTask> {
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
      reason, fromStage: t.stage, toStage: 'escalated', timestamp: new Date().toISOString(),
    });
    return clone(t);
  },

  async listReviewers(): Promise<Reviewer[]> {
    await wait();
    return clone(REVIEWERS);
  },

  async listCosignSchedules(date?: string): Promise<CosignSchedule[]> {
    await wait();
    return clone(COSIGN_SCHEDULES.filter((s) => !date || s.date === date));
  },

  async getSLA(): Promise<SLAMetrics> {
    await wait();
    return clone(SLA_METRICS);
  },

  async getWorkloadStats(reviewerId?: string): Promise<WorkloadStat[]> {
    await wait();
    return clone(WORKLOAD_STATS.filter((w) => !reviewerId || w.reviewerId === reviewerId));
  },

  async getKPI(): Promise<ReviewKPI> {
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

/**
 * G005 RIS v3.0.5.1 - R3.REVIEW FINAL CHECK 终核服务
 * 80 点 (15+ 检查项 / 临床一致性 / 终评 / 双驳回 / 笔记 / 工作量 / 既往 / 多签 / 急诊 / 工作流)
 *
 * v3.0.6.17: 终核通过 / 双驳回 / 多签申请与签署均走 report-sign-v2 (报告电子签名
 *   /signs 申请→审批/驳回)。读接口无后端等价端点时保留演示数据, 并置
 *   getFinalCheckDataSource()='demo'。写接口失败不再假装成功。
 */
import {
  FINAL_CHECK_TEMPLATES,
  FINAL_CHECK_LISTS,
  CLINICAL_CONSISTENCY_RESULTS,
  FINAL_SCORING_RUBRICS,
  FINAL_SCORING_RESULTS,
  FINAL_REVIEW_NOTES,
  FINAL_CHECK_WORKLOAD,
  PRIOR_REPORT_COMPARISONS,
  FINAL_MULTI_SIGNATURE_REQUESTS,
  EMERGENCY_REVIEW_REQUESTS,
  FINAL_CHECK_WORKFLOW_CONFIGS,
  FINAL_CHECK_EVENTS,
  buildSummary,
} from "../../data/reportFinalCheckMock";
import type {
  FinalCheckItem,
  FinalCheckList,
  FinalCheckSummary,
  FinalCheckFilter,
  ClinicalConsistencyCheck,
  FinalScoringRubric,
  FinalScoringResult,
  FinalRejectRequest,
  FinalReviewNote,
  FinalCheckWorkload,
  PriorReportComparison,
  FinalMultiSignatureRequest,
  EmergencyReviewRequest,
  FinalCheckWorkflowConfig,
  FinalCheckEvent,
  FinalCheckCategory,
  FinalCheckStatus,
  EmergencyChannel,
} from "../../types/R3/R3.REVIEW.FINAL";
import { reportSignV2Api } from "../api/reportSignV2Api";
import type { SignRequest } from "../api/reportSignV2Api";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryLists: FinalCheckList[] = clone(FINAL_CHECK_LISTS);
const inMemoryNotes: FinalReviewNote[] = clone(FINAL_REVIEW_NOTES);
const inMultiSigs: FinalMultiSignatureRequest[] = clone(
  FINAL_MULTI_SIGNATURE_REQUESTS,
);
const inEmergency: EmergencyReviewRequest[] = clone(EMERGENCY_REVIEW_REQUESTS);
const inConfigs: FinalCheckWorkflowConfig[] = clone(
  FINAL_CHECK_WORKFLOW_CONFIGS,
);
const inEvents: FinalCheckEvent[] = clone(FINAL_CHECK_EVENTS);

// [v3.0.6.17] 数据来源登记
export type FinalCheckDataSource = "api" | "demo";
let lastSource: FinalCheckDataSource = "demo";
export function getFinalCheckDataSource(): FinalCheckDataSource {
  return lastSource;
}

const logEvent = (
  taskId: string,
  reportId: string,
  type: FinalCheckEvent["type"],
  actorId: string,
  actorName: string,
  payload: Record<string, unknown>,
): void => {
  inEvents.unshift({
    id: "fce-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    taskId,
    reportId,
    type,
    actorId,
    actorName,
    payload,
    timestamp: new Date().toISOString(),
  });
};

/** 后端 report-sign-v2 签署请求 → 终核多签请求 (单槽) */
function mapSignToMultiSig(s: SignRequest): FinalMultiSignatureRequest {
  const signed = s.status === "approved";
  const rejected = s.status === "rejected";
  return {
    id: s.id,
    taskId: s.reportId,
    reportId: s.reportId,
    requestedBy: s.applicantId,
    requestedByName: s.applicantName,
    requestedAt: s.createdAt,
    slots: [
      {
        id: "s1",
        order: 1,
        role: "cosigner",
        required: true,
        signerId: s.signerId,
        signerName: s.signerName,
        signedAt: s.signedAt,
        status: signed ? "signed" : rejected ? "rejected" : "pending",
        note: s.approveNote,
        reason: s.rejectReason,
      },
    ],
    reason: s.reason,
    trigger: "manual",
    parallel: false,
    expiresAt: s.updatedAt,
    status: signed
      ? "completed"
      : rejected
        ? "failed"
        : s.status === "cancelled"
          ? "revoked"
          : "collecting",
    completedAt: signed ? s.signedAt : undefined,
    auditId: s.id,
  };
}

function findList(taskId: string): FinalCheckList {
  const list = inMemoryLists.find((l) => l.taskId === taskId);
  if (!list) throw new Error("Final check list not found");
  return list;
}

/**
 * 终核落定: 通过报告电子签名端点 (report-sign-v2 /signs) 先申请再审批/驳回。
 * 该端点不要求报告已存在于报告库, 演示与生产行为一致; 任一步失败即抛出。
 */
async function signOffReport(
  reportId: string,
  signerId: string,
  reason: string,
  action: "approve" | "reject",
): Promise<void> {
  const applied = await reportSignV2Api.applySign({
    reportId,
    kind: "reviewer",
    signerId,
    applicantId: signerId,
    reason,
  });
  if (!applied.success || !applied.data)
    throw new Error(applied.error?.message ?? "电子签名申请失败");
  const resolved =
    action === "approve"
      ? await reportSignV2Api.approveSign(applied.data.id, {
          note: reason,
          actorId: signerId,
        })
      : await reportSignV2Api.rejectSign(applied.data.id, {
          reason,
          actorId: signerId,
        });
  if (!resolved.success)
    throw new Error(
      resolved.error?.message ??
        (action === "approve" ? "终核签署失败" : "驳回签署失败"),
    );
}

export const finalCheckService = {
  // ─── 终核模板 (15+ 标准项) ───
  async listTemplates(): Promise<FinalCheckItem[]> {
    lastSource = "demo";
    return clone(FINAL_CHECK_TEMPLATES);
  },

  async getTemplateByCode(code: string): Promise<FinalCheckItem | null> {
    lastSource = "demo";
    return clone(FINAL_CHECK_TEMPLATES.find((t) => t.code === code) ?? null);
  },

  // ─── 终核清单 ───
  async listLists(filter?: FinalCheckFilter): Promise<FinalCheckList[]> {
    lastSource = "demo";
    let list = inMemoryLists.slice();
    if (filter?.reviewerId)
      list = list.filter((l) => l.reviewerId === filter.reviewerId);
    if (filter?.status && filter.status !== "all")
      list = list.filter((l) => l.status === filter.status);
    if (filter?.modality)
      list = list.filter((_l) =>
        FINAL_CHECK_TEMPLATES.some((t) => t.code.startsWith("FCHK-009")),
      );
    if (filter?.passingOnly) list = list.filter((l) => l.summary.isPublishable);
    if (filter?.blockingOnly) list = list.filter((l) => l.summary.blockers > 0);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.reportId.toLowerCase().includes(q) ||
          l.taskId.toLowerCase().includes(q) ||
          l.reviewerName.toLowerCase().includes(q),
      );
    }
    return list;
  },

  async getListByTask(taskId: string): Promise<FinalCheckList | null> {
    lastSource = "demo";
    return clone(inMemoryLists.find((l) => l.taskId === taskId) ?? null);
  },

  async startCheck(
    taskId: string,
    reportId: string,
    reviewerId: string,
    reviewerName: string,
  ): Promise<FinalCheckList> {
    const existing = inMemoryLists.find((l) => l.taskId === taskId);
    if (existing) return clone(existing);
    const items = clone(FINAL_CHECK_TEMPLATES).map((it) => ({
      ...it,
      status: "pending" as FinalCheckStatus,
      score: 0,
    }));
    const list: FinalCheckList = {
      id: "fcl-" + Date.now(),
      reportId,
      patientId: "P-AUTO",
      taskId,
      reviewerId,
      reviewerName,
      reviewerRole: "associateChief",
      items,
      summary: buildSummary(items),
      status: "in-progress",
      startedAt: new Date().toISOString(),
      totalDurationMs: 0,
      rubricVersion: "v3.0.5.1",
    };
    inMemoryLists.push(list);
    logEvent(taskId, reportId, "started", reviewerId, reviewerName, {
      itemCount: items.length,
    });
    return clone(list);
  },

  async updateItemStatus(
    taskId: string,
    code: string,
    status: FinalCheckStatus,
    remark?: string,
  ): Promise<FinalCheckList> {
    const list = findList(taskId);
    const item = list.items.find((i) => i.code === code);
    if (!item) throw new Error("Check item not found");
    item.status = status;
    item.score =
      status === "passed"
        ? item.maxScore
        : status === "warning"
          ? Math.floor(item.maxScore * 0.5)
          : 0;
    if (remark) item.remark = remark;
    item.checkedAt = new Date().toISOString();
    list.summary = buildSummary(list.items);
    logEvent(
      taskId,
      list.reportId,
      status === "passed"
        ? "item-passed"
        : status === "failed"
          ? "item-failed"
          : "item-warning",
      list.reviewerId,
      list.reviewerName,
      { code, status, remark },
    );
    return clone(list);
  },

  // 终核通过 → 报告电子签名 (report-sign-v2 /signs 申请 + 审批)
  async completeCheck(taskId: string): Promise<FinalCheckList> {
    const list = findList(taskId);
    await signOffReport(
      list.reportId,
      list.reviewerId,
      `终核通过:${list.reviewerName}`,
      "approve",
    );
    list.status = "completed";
    list.completedAt = new Date().toISOString();
    list.totalDurationMs =
      new Date(list.completedAt).getTime() - new Date(list.startedAt).getTime();
    list.summary = buildSummary(list.items);
    logEvent(
      taskId,
      list.reportId,
      "completed",
      list.reviewerId,
      list.reviewerName,
      { score: list.summary.totalScore, grade: list.summary.grade },
    );
    return clone(list);
  },

  async abortCheck(taskId: string, reason: string): Promise<FinalCheckList> {
    const list = findList(taskId);
    list.status = "aborted";
    list.completedAt = new Date().toISOString();
    logEvent(
      taskId,
      list.reportId,
      "item-warning",
      list.reviewerId,
      list.reviewerName,
      { aborted: true, reason },
    );
    return clone(list);
  },

  async getSummary(taskId: string): Promise<FinalCheckSummary> {
    const list = findList(taskId);
    return clone(list.summary);
  },

  // ─── 临床一致性 ───
  async checkConsistency(reportId: string): Promise<ClinicalConsistencyCheck> {
    lastSource = "demo";
    const found =
      CLINICAL_CONSISTENCY_RESULTS.find((c) => c.reportId === reportId) ??
      CLINICAL_CONSISTENCY_RESULTS[0];
    if (!found) throw new Error("No consistency data available");
    return clone(found);
  },

  async listConsistencyReports(): Promise<ClinicalConsistencyCheck[]> {
    lastSource = "demo";
    return clone(CLINICAL_CONSISTENCY_RESULTS);
  },

  // ─── 终评 ───
  async listRubrics(): Promise<FinalScoringRubric[]> {
    lastSource = "demo";
    return clone(FINAL_SCORING_RUBRICS);
  },

  async getDefaultRubric(): Promise<FinalScoringRubric> {
    lastSource = "demo";
    const found =
      FINAL_SCORING_RUBRICS.find((r) => r.isDefault) ??
      FINAL_SCORING_RUBRICS[0];
    if (!found) throw new Error("No rubric available");
    return clone(found);
  },

  async scoreFinal(
    taskId: string,
    reportId: string,
    reviewerId: string,
    reviewerName: string,
    rubricId: string,
    dimensionScores: { code: string; score: number; comment?: string }[],
  ): Promise<FinalScoringResult> {
    const rubric =
      FINAL_SCORING_RUBRICS.find((r) => r.id === rubricId) ??
      FINAL_SCORING_RUBRICS[0];
    if (!rubric) throw new Error("No rubric available");
    const dimScores = rubric.dimensions.map((d) => {
      const input = dimensionScores.find((s) => s.code === d.code);
      const score = input?.score ?? 0;
      return {
        code: d.code,
        name: d.name,
        score,
        weight: d.weight,
        weighted: Math.round(((score * d.weight) / 100) * 100) / 100,
        comment: input?.comment,
      };
    });
    const totalScore = Math.round(
      dimScores.reduce((a, d) => a + d.weighted, 0),
    );
    const percentage = totalScore;
    const lastBand = rubric.gradeBands[rubric.gradeBands.length - 1];
    if (!lastBand) throw new Error("Rubric has no grade bands");
    const gradeBand =
      rubric.gradeBands.find(
        (b) => percentage >= b.minScore && percentage <= b.maxScore,
      ) ?? lastBand;
    const existing = FINAL_SCORING_RESULTS.find((r) => r.taskId === taskId);
    const deltaFromInitial = existing
      ? percentage - existing.percentage
      : undefined;
    const result: FinalScoringResult = {
      id: "fscore-" + Date.now(),
      reportId,
      taskId,
      rubricId,
      rubricVersion: rubric.version,
      reviewerId,
      reviewerName,
      totalScore,
      percentage,
      grade: gradeBand.grade,
      passed: percentage >= rubric.passingScore,
      blocked: percentage < rubric.blockingScore,
      dimensionScores: dimScores,
      hardFailures: [],
      softWarnings: [],
      deltaFromInitial,
      scoredAt: new Date().toISOString(),
      durationMs: 18 * 60 * 1000,
    };
    return clone(result);
  },

  async listScoringResults(taskId?: string): Promise<FinalScoringResult[]> {
    lastSource = "demo";
    return clone(
      FINAL_SCORING_RESULTS.filter((r) => !taskId || r.taskId === taskId),
    );
  },

  // ─── 双驳回路径 (写回真实报告状态) ───
  async rejectToInitial(request: FinalRejectRequest): Promise<FinalCheckList> {
    const list = findList(request.taskId);
    if (!request.reason || request.reason.trim().length < 5)
      throw new Error("驳回原因不能少于 5 字符");
    await signOffReport(
      list.reportId,
      request.reviewerId,
      request.reason,
      "reject",
    );
    list.status = "aborted";
    list.completedAt = new Date().toISOString();
    logEvent(
      request.taskId,
      list.reportId,
      "rejected-initial",
      request.reviewerId,
      request.reviewerName,
      { reason: request.reason, target: request.target },
    );
    return clone(list);
  },

  async rejectToDraft(request: FinalRejectRequest): Promise<FinalCheckList> {
    const list = findList(request.taskId);
    if (!request.reason || request.reason.trim().length < 10)
      throw new Error("直接退回起草原因不能少于 10 字符");
    await signOffReport(
      list.reportId,
      request.reviewerId,
      request.reason,
      "reject",
    );
    list.status = "aborted";
    list.completedAt = new Date().toISOString();
    logEvent(
      request.taskId,
      list.reportId,
      "rejected-draft",
      request.reviewerId,
      request.reviewerName,
      { reason: request.reason, target: request.target },
    );
    return clone(list);
  },

  // ─── 终审笔记 ───
  async listNotes(taskId: string): Promise<FinalReviewNote[]> {
    lastSource = "demo";
    return clone(inMemoryNotes.filter((n) => n.taskId === taskId));
  },

  async addNote(
    note: Omit<FinalReviewNote, "id" | "createdAt">,
  ): Promise<FinalReviewNote> {
    const newNote: FinalReviewNote = {
      id: "frn-" + Date.now(),
      createdAt: new Date().toISOString(),
      ...note,
    };
    inMemoryNotes.unshift(newNote);
    logEvent(
      note.taskId,
      note.reportId,
      "note-added",
      note.authorId,
      note.authorName,
      { type: note.type, content: note.content.slice(0, 50) },
    );
    return clone(newNote);
  },

  async resolveNote(
    noteId: string,
    _resolverId: string,
    resolverName: string,
  ): Promise<FinalReviewNote> {
    const n = inMemoryNotes.find((x) => x.id === noteId);
    if (!n) throw new Error("Note not found");
    n.resolvedAt = new Date().toISOString();
    n.resolvedBy = resolverName;
    return clone(n);
  },

  async pinNote(noteId: string, pinned: boolean): Promise<FinalReviewNote> {
    const n = inMemoryNotes.find((x) => x.id === noteId);
    if (!n) throw new Error("Note not found");
    n.pinned = pinned;
    return clone(n);
  },

  // ─── 工作量 ───
  async getWorkload(
    reviewerId?: string,
    date?: string,
  ): Promise<FinalCheckWorkload[]> {
    lastSource = "demo";
    return clone(
      FINAL_CHECK_WORKLOAD.filter(
        (w) => !reviewerId || w.reviewerId === reviewerId,
      ).filter((w) => !date || w.date === date),
    );
  },

  async getTeamWorkload(
    date?: string,
  ): Promise<{
    totalChecks: number;
    totalRejected: number;
    avgScore: number;
    avgDurationMin: number;
    onTimeRate: number;
    byReviewer: FinalCheckWorkload[];
  }> {
    const list = await this.getWorkload(undefined, date);
    return {
      totalChecks: list.reduce((a, w) => a + w.totalFinalChecks, 0),
      totalRejected: list.reduce((a, w) => a + w.rejectedCount, 0),
      avgScore: Math.round(
        list.reduce((a, w) => a + w.averageScore, 0) / Math.max(1, list.length),
      ),
      avgDurationMin: Math.round(
        list.reduce((a, w) => a + w.averageDurationMin, 0) /
          Math.max(1, list.length),
      ),
      onTimeRate:
        Math.round(
          (list.reduce((a, w) => a + w.onTimeRate, 0) /
            Math.max(1, list.length)) *
            10,
        ) / 10,
      byReviewer: list,
    };
  },

  // ─── 既往报告对比 ───
  async compareWithPrior(
    reportId: string,
  ): Promise<PriorReportComparison | null> {
    lastSource = "demo";
    return clone(
      PRIOR_REPORT_COMPARISONS.find((p) => p.currentReportId === reportId) ??
        null,
    );
  },

  async listPriorComparisons(): Promise<PriorReportComparison[]> {
    lastSource = "demo";
    return clone(PRIOR_REPORT_COMPARISONS);
  },

  // ─── 多签 (后端 report-sign-v2 /signs) ───
  async listMultiSignatures(
    taskId?: string,
  ): Promise<FinalMultiSignatureRequest[]> {
    try {
      const res = await reportSignV2Api.listSigns();
      if (!res.success || !res.data)
        throw new Error(res.error?.message ?? "加载签署请求失败");
      const items = res.data.data ?? [];
      if (items.length > 0) {
        lastSource = "api";
        return items
          .map(mapSignToMultiSig)
          .filter((m) => !taskId || m.taskId === taskId);
      }
    } catch {
      // 降级演示数据
    }
    lastSource = "demo";
    return clone(inMultiSigs.filter((m) => !taskId || m.taskId === taskId));
  },

  async requestMultiSignature(
    taskId: string,
    reportId: string,
    requestedBy: string,
    requestedByName: string,
    reason: string,
    trigger: FinalMultiSignatureRequest["trigger"],
  ): Promise<FinalMultiSignatureRequest> {
    const res = await reportSignV2Api.applySign({
      reportId,
      kind: "reviewer",
      signerId: requestedBy,
      applicantId: requestedBy,
      reason: reason || "终核完成后多签",
    });
    if (!res.success || !res.data)
      throw new Error(res.error?.message ?? "发起多签失败");
    const created = mapSignToMultiSig(res.data);
    created.requestedByName = requestedByName || created.requestedByName;
    created.trigger = trigger;
    inMultiSigs.unshift(created);
    logEvent(
      taskId,
      reportId,
      "signature-collected",
      requestedBy,
      requestedByName,
      { reason, trigger },
    );
    return clone(created);
  },

  async signMultiSignature(
    reqId: string,
    slotId: string,
    signerId: string,
    signerName: string,
    certificateId: string,
  ): Promise<FinalMultiSignatureRequest> {
    const res = await reportSignV2Api.approveSign(reqId, {
      note: `slot:${slotId} signer:${signerName}`,
      actorId: signerId,
    });
    if (!res.success || !res.data)
      throw new Error(res.error?.message ?? "多签签署失败");
    const local = inMultiSigs.find((r) => r.id === reqId);
    if (local) {
      const slot = local.slots.find((s) => s.id === slotId);
      if (slot) {
        slot.signerId = signerId;
        slot.signerName = signerName;
        slot.signedAt = new Date().toISOString();
        slot.certificateId = certificateId;
        slot.status = "signed";
      }
      const allSigned = local.slots
        .filter((s) => s.required)
        .every((s) => s.status === "signed");
      if (allSigned) {
        local.status = "completed";
        local.completedAt = new Date().toISOString();
        local.certificateId = certificateId;
      } else {
        local.status = "in-progress";
      }
      logEvent(
        local.taskId,
        local.reportId,
        "signature-collected",
        signerId,
        signerName,
        { slotId, certificateId },
      );
      return clone(local);
    }
    return mapSignToMultiSig(res.data);
  },

  // ─── 急诊通道 ───
  async listEmergencyRequests(
    status?: string,
  ): Promise<EmergencyReviewRequest[]> {
    lastSource = "demo";
    return clone(
      inEmergency.filter(
        (e) => !status || status === "all" || e.status === status,
      ),
    );
  },

  async triggerEmergencyReview(
    taskId: string,
    reportId: string,
    patientId: string,
    patientName: string,
    triggeredBy: string,
    triggeredByName: string,
    trigger: EmergencyReviewRequest["trigger"],
    severity: EmergencyReviewRequest["severity"],
    description: string,
    channels: EmergencyChannel[],
  ): Promise<EmergencyReviewRequest> {
    const req: EmergencyReviewRequest = {
      id: "emr-" + Date.now(),
      taskId,
      reportId,
      patientId,
      patientName,
      trigger,
      severity,
      description,
      triggeredBy,
      triggeredByName,
      triggeredAt: new Date().toISOString(),
      channels,
      targets: [
        {
          reviewerId: "D001",
          reviewerName: "张明远",
          role: "chief",
          notifiedAt: new Date().toISOString(),
        },
        {
          reviewerId: "D009",
          reviewerName: "吴芳",
          role: "chief",
          notifiedAt: new Date().toISOString(),
        },
      ],
      slaMinutes:
        severity === "life-threatening" ? 5 : severity === "critical" ? 15 : 30,
      status: "open",
      auditId: "audit-emr-" + Date.now(),
    };
    inEmergency.unshift(req);
    logEvent(
      taskId,
      reportId,
      "emergency-triggered",
      triggeredBy,
      triggeredByName,
      { trigger, severity, channels },
    );
    return clone(req);
  },

  async acknowledgeEmergency(
    reqId: string,
    reviewerId: string,
  ): Promise<EmergencyReviewRequest> {
    const req = inEmergency.find((r) => r.id === reqId);
    if (!req) throw new Error("Emergency request not found");
    const t = req.targets.find((x) => x.reviewerId === reviewerId);
    if (t) {
      t.acknowledgedAt = new Date().toISOString();
      t.responseTimeMs =
        new Date(t.acknowledgedAt).getTime() -
        new Date(req.triggeredAt).getTime();
    }
    if (req.targets.some((x) => x.acknowledgedAt)) {
      req.status = "acknowledged";
    }
    return clone(req);
  },

  // ─── 工作流配置 ───
  async listConfigs(): Promise<FinalCheckWorkflowConfig[]> {
    lastSource = "demo";
    return clone(inConfigs);
  },

  async getDefaultConfig(): Promise<FinalCheckWorkflowConfig> {
    lastSource = "demo";
    const found = inConfigs.find((c) => c.isDefault) ?? inConfigs[0];
    if (!found) throw new Error("No workflow config available");
    return clone(found);
  },

  async updateConfig(
    configId: string,
    updates: Partial<FinalCheckWorkflowConfig>,
    updatedBy: string,
  ): Promise<FinalCheckWorkflowConfig> {
    const c = inConfigs.find((x) => x.id === configId);
    if (!c) throw new Error("Config not found");
    Object.assign(c, updates, {
      updatedAt: new Date().toISOString(),
      updatedBy,
    });
    return clone(c);
  },

  // ─── 事件流 ───
  async listEvents(taskId?: string, limit = 50): Promise<FinalCheckEvent[]> {
    lastSource = "demo";
    return clone(
      inEvents.filter((e) => !taskId || e.taskId === taskId).slice(0, limit),
    );
  },

  // ─── 批量辅助 ───
  async getDashboard(): Promise<{
    summary: {
      totalLists: number;
      inProgress: number;
      completed: number;
      blocked: number;
      avgScore: number;
    };
    byCategory: {
      category: FinalCheckCategory;
      count: number;
      failureRate: number;
    }[];
    recentEvents: FinalCheckEvent[];
  }> {
    lastSource = "demo";
    const lists = inMemoryLists;
    const completed = lists.filter((l) => l.status === "completed");
    const blocked = lists.filter((l) => l.summary.blockers > 0);
    const avgScore =
      completed.length === 0
        ? 0
        : Math.round(
            completed.reduce((a, l) => a + l.summary.percentage, 0) /
              completed.length,
          );
    const catMap = new Map<
      FinalCheckCategory,
      { count: number; failed: number }
    >();
    FINAL_CHECK_TEMPLATES.forEach((t) => {
      const v = catMap.get(t.category) ?? { count: 0, failed: 0 };
      v.count += 1;
      catMap.set(t.category, v);
    });
    lists.forEach((l) =>
      l.items.forEach((i) => {
        if (i.status === "failed") {
          const v = catMap.get(i.category) ?? { count: 0, failed: 0 };
          v.failed += 1;
          catMap.set(i.category, v);
        }
      }),
    );
    const byCategory: {
      category: FinalCheckCategory;
      count: number;
      failureRate: number;
    }[] = Array.from(catMap.entries()).map(([category, v]) => ({
      category,
      count: v.count,
      failureRate: v.count === 0 ? 0 : Math.round((v.failed / v.count) * 100),
    }));
    return {
      summary: {
        totalLists: lists.length,
        inProgress: lists.filter((l) => l.status === "in-progress").length,
        completed: completed.length,
        blocked: blocked.length,
        avgScore,
      },
      byCategory,
      recentEvents: inEvents.slice(0, 10),
    };
  },
};

export type FinalCheckService = typeof finalCheckService;
export default finalCheckService;

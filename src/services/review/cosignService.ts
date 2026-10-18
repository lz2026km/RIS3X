/**
 * G005 RIS v3.0.5.1 - R3.REVIEW COSIGN Service
 * 覆盖 10 大特性:
 *  - Cosign scheduling      (排班)
 *  - Emergency dual sign    (急诊双签)
 *  - Multi-signature mgmt   (多人签)
 *  - Sign conflict resolve  (签冲突)
 *  - Auto-assign superior   (自动派主任)
 *  - Cosign SLA monitor     (SLA 监控)
 *  - Cosign history         (历史记录)
 *  - Skip Cosign config     (跳过配置)
 *  - Cosign temp auth       (临时授权)
 *  - Batch Cosign           (批量签)
 *
 * v3.0.6.17: 待签列表 / 历史 / KPI 优先调用后端 (/cosign/*), 失败降级演示数据并置
 *   getCosignDataSource()='demo'; 通过 / 拒签必须走后端, 失败抛出 (不再假装成功)。
 */
import {
  COSIGN_RECORDS,
  COSIGN_EMERGENCY,
  COSIGN_MULTI_SIGN,
  COSIGN_CONFLICTS,
  COSIGN_SUPERIOR_RULES,
  COSIGN_SLA_CONFIG,
  COSIGN_SLA_METRICS,
  COSIGN_SKIP_CONFIG,
  COSIGN_TEMP_AUTHS,
  COSIGN_BATCH_REQUESTS,
  COSIGN_DASHBOARD_KPI,
  COSIGN_CALENDAR_V2,
  COSIGN_REVIEWERS,
  COSIGN_AUDIT_LOG,
  COSIGN_CERTIFICATES,
} from "../../data/cosignMock";
import type {
  CosignRecord,
  CosignPriority,
  CosignHistoryStep,
  EmergencyCosign,
  MultiSignConfig,
  SignConflict,
  SuperiorAssignRule,
  CosignSLAConfig,
  CosignSkipConfig,
  TemporaryAuth,
  BatchCosignRequest,
  CosignDashboardKPI,
  CosignCalendarEntry,
  CosignSLAMetric,
  CosignStatus,
  ConflictResolution,
  SkipReason,
  ConflictType,
} from "../../types/R3/R3.COSIGN";
import type { Reviewer, ReviewerRole } from "../../types/R3/R3.REVIEW";
import { coSignApi } from "../api/cosignApi";
import type { CoSignItem, CoSignHistoryEntry } from "../api/cosignApi";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const uuid = () =>
  "cs-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

const records: CosignRecord[] = clone(COSIGN_RECORDS);
const conflicts: SignConflict[] = clone(COSIGN_CONFLICTS);
const tempAuths: TemporaryAuth[] = clone(COSIGN_TEMP_AUTHS);
const batchReqs: BatchCosignRequest[] = clone(COSIGN_BATCH_REQUESTS);
const multiSigns: MultiSignConfig[] = clone(COSIGN_MULTI_SIGN);

// [v3.0.6.17] 数据来源登记: 'api' = 后端返回, 'demo' = 演示兜底
export type CosignDataSource = "api" | "demo";
let lastSource: CosignDataSource = "demo";
export function getCosignDataSource(): CosignDataSource {
  return lastSource;
}

const PRIORITIES: CosignPriority[] = ["stat", "urgent", "routine", "scheduled"];

function mapPriority(
  value: string | undefined,
  fallback: CosignPriority,
): CosignPriority {
  const v = String(value ?? "") as CosignPriority;
  return PRIORITIES.includes(v) ? v : fallback;
}

function mapPendingStatus(
  value: string | undefined,
  fallback: CosignStatus,
): CosignStatus {
  const v = String(value ?? "").toUpperCase();
  if (v.includes("CO_SIGN") || v.includes("PENDING") || v === "")
    return "pending";
  return fallback;
}

/** 后端待签行 (CoSignItem) → R3.COSIGN.CosignRecord, 同 reportId 时保留演示种子的丰富字段 */
function mapPendingToRecord(
  item: CoSignItem,
  seed?: CosignRecord,
): CosignRecord {
  const slaMinutes = seed?.slaMinutes ?? 240;
  const elapsedMinutes = Math.round((item.waitingHours ?? 0) * 60);
  return {
    id: item.id,
    reportId: item.reportId,
    taskId: seed?.taskId ?? item.id,
    patientName: item.patientName || seed?.patientName || "未知患者",
    modality: item.modality || seed?.modality || "",
    bodyPart: item.bodyPart || seed?.bodyPart || "",
    triggerReason: seed?.triggerReason ?? "manual-escalation",
    priority: mapPriority(item.priority, seed?.priority ?? "routine"),
    status: mapPendingStatus(item.status, seed?.status ?? "pending"),
    authorId: item.authorId || seed?.authorId || "",
    authorName: item.authorName || seed?.authorName || "",
    authorTitle: seed?.authorTitle ?? "attending",
    cosignerId: seed?.cosignerId ?? "",
    cosignerName: seed?.cosignerName ?? "",
    cosignerTitle: seed?.cosignerTitle ?? "chief",
    certificateId: seed?.certificateId,
    certificateSerial: seed?.certificateSerial,
    scheduledAt: seed?.scheduledAt,
    startedAt: seed?.startedAt,
    signedAt: seed?.signedAt,
    expiresAt: seed?.expiresAt,
    slaMinutes,
    elapsedMinutes,
    remainMinutes: Math.max(0, slaMinutes - elapsedMinutes),
    signatureValue: seed?.signatureValue,
    remark: seed?.remark,
    rejectReason: seed?.rejectReason,
    history: seed?.history ?? [],
  };
}

const ACTION_STEP: Record<string, CosignHistoryStep["step"]> = {
  APPROVE: "sign",
  REJECT: "reject",
  APPLY: "trigger",
  CANCEL: "expire",
};

function mapHistoryEntry(e: {
  id: string;
  reportId: string;
  action: string;
  actor: string;
  actorId: string;
  timestamp: string;
  detail: string;
}): CosignHistoryStep {
  return {
    id: e.id,
    step: ACTION_STEP[String(e.action).toUpperCase()] ?? "notify",
    actorId: e.actorId,
    actorName: e.actor,
    action: e.action,
    detail: e.detail,
    timestamp: e.timestamp,
  };
}

export const cosignService = {
  // ============================================================
  // 1. 排班(Cosign scheduling)
  // ============================================================
  async listCalendar(date?: string): Promise<CosignCalendarEntry[]> {
    lastSource = "demo";
    const all = clone(COSIGN_CALENDAR_V2);
    if (!date) return all;
    return all.filter((c) => c.date === date);
  },

  async listReviewers(): Promise<Reviewer[]> {
    lastSource = "demo";
    return clone(COSIGN_REVIEWERS);
  },

  async createCalendarEntry(
    entry: Omit<CosignCalendarEntry, "id">,
  ): Promise<CosignCalendarEntry> {
    return clone({ id: uuid(), ...entry });
  },

  async updateCalendarEntry(
    id: string,
    patch: Partial<CosignCalendarEntry>,
  ): Promise<CosignCalendarEntry> {
    const all = COSIGN_CALENDAR_V2;
    const cur = all.find((e) => e.id === id);
    if (!cur) throw new Error("Calendar entry not found");
    return clone({ ...cur, ...patch });
  },

  async deleteCalendarEntry(
    id: string,
  ): Promise<{ id: string; deleted: boolean }> {
    return { id, deleted: true };
  },

  // ============================================================
  // 2. 双签记录 (后端 /cosign/pending)
  // ============================================================
  async listRecords(filter?: {
    status?: CosignStatus;
    cosignerId?: string;
    reportId?: string;
  }): Promise<CosignRecord[]> {
    let list: CosignRecord[];
    try {
      const res = await coSignApi.getPending();
      if (!res.success)
        throw new Error(res.error?.message ?? "加载待签列表失败");
      const items = res.data ?? [];
      list = items.map((item) => {
        const seed = records.find(
          (r) => r.id === item.id || r.reportId === item.reportId,
        );
        return mapPendingToRecord(item, seed);
      });
      lastSource = "api";
    } catch {
      list = records.slice();
      lastSource = "demo";
    }
    if (filter?.status) list = list.filter((r) => r.status === filter.status);
    if (filter?.cosignerId)
      list = list.filter((r) => r.cosignerId === filter.cosignerId);
    if (filter?.reportId)
      list = list.filter((r) => r.reportId === filter.reportId);
    return clone(list);
  },

  async getRecord(id: string): Promise<CosignRecord | null> {
    const list = await this.listRecords();
    return (
      list.find((r) => r.id === id) ?? records.find((r) => r.id === id) ?? null
    );
  },

  async startCosign(
    recordId: string,
    actorId: string,
    actorName: string,
  ): Promise<CosignRecord> {
    const r = records.find((x) => x.id === recordId);
    if (!r) throw new Error("Record not found");
    r.startedAt = new Date().toISOString();
    r.elapsedMinutes = 0;
    r.history.push({
      id: uuid(),
      step: "start",
      actorId,
      actorName,
      action: "开始签",
      timestamp: r.startedAt,
    });
    return clone(r);
  },

  async completeCosign(
    recordId: string,
    actorId: string,
    actorName: string,
    certificateId: string,
    signatureValue: string,
  ): Promise<CosignRecord> {
    const res = await coSignApi.approve(recordId, {
      note: `会签通过:${actorName || actorId}`,
    });
    if (!res.success) throw new Error(res.error?.message ?? "会签通过失败");
    const r = records.find((x) => x.id === recordId);
    if (!r) {
      // 后端已成功但本地无种子: 回读待签列表补齐
      const list = await this.listRecords({ reportId: recordId }).catch(
        () => [] as CosignRecord[],
      );
      const fetched = list[0];
      if (!fetched) throw new Error("Record not found");
      records.push(fetched);
    }
    const target = records.find((x) => x.id === recordId)!;
    if (target.status === "signed" || target.status === "rejected")
      throw new Error("Record already finalized");
    target.signedAt = new Date().toISOString();
    target.signatureValue = signatureValue;
    target.certificateId = certificateId;
    target.status = "signed";
    target.history.push({
      id: uuid(),
      step: "sign",
      actorId,
      actorName,
      action: "完成签",
      timestamp: target.signedAt,
      hash: signatureValue.slice(0, 16),
    });
    return clone(target);
  },

  async rejectCosign(
    recordId: string,
    actorId: string,
    actorName: string,
    reason: string,
  ): Promise<CosignRecord> {
    if (!reason || reason.trim().length < 5)
      throw new Error("拒绝原因不能少于 5 字符");
    const res = await coSignApi.reject(recordId, { reason });
    if (!res.success) throw new Error(res.error?.message ?? "会签拒签失败");
    const r = records.find((x) => x.id === recordId);
    if (!r) throw new Error("Record not found");
    r.status = "rejected";
    r.rejectReason = reason;
    r.history.push({
      id: uuid(),
      step: "reject",
      actorId,
      actorName,
      action: "拒绝",
      detail: reason,
      timestamp: new Date().toISOString(),
    });
    return clone(r);
  },

  async skipCosign(
    recordId: string,
    reason: SkipReason,
    actorId: string,
    actorName: string,
    comment: string,
  ): Promise<CosignRecord> {
    const r = records.find((x) => x.id === recordId);
    if (!r) throw new Error("Record not found");
    if (
      !COSIGN_SKIP_CONFIG.conditions.some(
        (c) => c.reason === reason && c.enabled,
      )
    )
      throw new Error("该跳过原因未启用");
    r.status = "skipped";
    r.rejectReason = `[跳过] ${reason}: ${comment}`;
    r.history.push({
      id: uuid(),
      step: "skip",
      actorId,
      actorName,
      action: "跳过",
      detail: `${reason} - ${comment}`,
      timestamp: new Date().toISOString(),
    });
    return clone(r);
  },

  // ============================================================
  // 3. 急诊双签
  // ============================================================
  async listEmergency(): Promise<EmergencyCosign[]> {
    lastSource = "demo";
    return clone(COSIGN_EMERGENCY);
  },

  async triggerEmergency(
    payload: Omit<
      EmergencyCosign,
      "id" | "smsSent" | "emailSent" | "phoneCalled" | "appPushed"
    >,
  ): Promise<EmergencyCosign> {
    return clone({
      id: uuid(),
      smsSent: true,
      emailSent: true,
      phoneCalled: false,
      appPushed: true,
      ...payload,
    });
  },

  // ============================================================
  // 4. 多人签
  // ============================================================
  async listMultiSignConfigs(): Promise<MultiSignConfig[]> {
    lastSource = "demo";
    return clone(multiSigns);
  },

  async getMultiSign(id: string): Promise<MultiSignConfig | null> {
    return clone(multiSigns.find((m) => m.id === id) ?? null);
  },

  async addMultiSignSignature(
    id: string,
    signerId: string,
    certificateId: string,
  ): Promise<MultiSignConfig> {
    const m = multiSigns.find((x) => x.id === id);
    if (!m) throw new Error("MultiSign not found");
    const signer = m.signers.find((s) => s.signerId === signerId);
    if (!signer) throw new Error("Signer not in chain");
    signer.signed = true;
    signer.signedAt = new Date().toISOString();
    signer.certificateId = certificateId;
    m.currentSignedCount = m.signers.filter((s) => s.signed).length;
    if (m.currentSignedCount >= m.requiredSignerCount) {
      m.status = "completed";
      m.completedAt = new Date().toISOString();
    } else if (m.currentSignedCount > 0) {
      m.status = "partial";
    }
    return clone(m);
  },

  // ============================================================
  // 5. 签冲突
  // ============================================================
  async listConflicts(
    status?: SignConflict["status"],
  ): Promise<SignConflict[]> {
    lastSource = "demo";
    let list = conflicts.slice();
    if (status) list = list.filter((c) => c.status === status);
    return clone(list);
  },

  async resolveConflict(
    id: string,
    resolution: ConflictResolution,
    resolvedById: string,
    resolvedByName: string,
  ): Promise<SignConflict> {
    const c = conflicts.find((x) => x.id === id);
    if (!c) throw new Error("Conflict not found");
    c.resolution = resolution;
    c.resolvedAt = new Date().toISOString();
    c.resolvedById = resolvedById;
    c.resolvedByName = resolvedByName;
    c.status = "resolved";
    return clone(c);
  },

  async detectConflict(
    reportId: string,
    conflictType: ConflictType,
    description: string,
    parties: SignConflict["parties"],
  ): Promise<SignConflict> {
    const c: SignConflict = {
      id: uuid(),
      reportId,
      recordId: "n/a",
      conflictType,
      detectedAt: new Date().toISOString(),
      detectedBy: "system",
      parties,
      description,
      status: "open",
    };
    conflicts.push(c);
    return clone(c);
  },

  // ============================================================
  // 6. 自动派主任
  // ============================================================
  async listSuperiorRules(): Promise<SuperiorAssignRule[]> {
    lastSource = "demo";
    return clone(COSIGN_SUPERIOR_RULES);
  },

  async autoAssignSuperior(
    ruleId: string,
    _reportId: string,
    _modality: string,
    _priority: string,
  ): Promise<{
    assigned: Reviewer | null;
    rule: SuperiorAssignRule | null;
    reason: string;
  }> {
    const rule = COSIGN_SUPERIOR_RULES.find((r) => r.id === ruleId);
    if (!rule) throw new Error("Rule not found");
    const eligible = COSIGN_REVIEWERS.filter((rv) => {
      const titleOk = titleRank(rv.title) >= titleRank(rule.criteria.minTitle);
      if (!titleOk) return false;
      if (rule.criteria.requireValidCert) {
        const hasCert = COSIGN_CERTIFICATES.some(
          (c) => c.holderId === rv.id && c.status === "valid",
        );
        if (!hasCert) return false;
      }
      if (rule.criteria.preferOnline && rv.status !== "online") return false;
      return true;
    });
    if (eligible.length === 0)
      return { assigned: null, rule, reason: "无符合规则的主任" };
    eligible.sort((a, b) => a.currentLoad - b.currentLoad);
    const first = eligible[0];
    if (!first) return { assigned: null, rule, reason: "无符合规则的主任" };
    return {
      assigned: first,
      rule,
      reason: `自动派主任:${first.name}(${first.titleLabel})`,
    };
  },

  async updateSuperiorRule(
    id: string,
    patch: Partial<SuperiorAssignRule>,
  ): Promise<SuperiorAssignRule> {
    const r = COSIGN_SUPERIOR_RULES.find((x) => x.id === id);
    if (!r) throw new Error("Rule not found");
    return clone({ ...r, ...patch, updatedAt: new Date().toISOString() });
  },

  // ============================================================
  // 7. SLA 监控
  // ============================================================
  async getSLAConfig(): Promise<CosignSLAConfig> {
    lastSource = "demo";
    return clone(COSIGN_SLA_CONFIG);
  },

  async updateSLAConfig(
    patch: Partial<CosignSLAConfig>,
  ): Promise<CosignSLAConfig> {
    return clone({
      ...COSIGN_SLA_CONFIG,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },

  async listSLAMetrics(): Promise<CosignSLAMetric[]> {
    lastSource = "demo";
    return clone(COSIGN_SLA_METRICS);
  },

  async refreshSLA(): Promise<{
    breached: string[];
    warning: string[];
    refreshedAt: string;
  }> {
    const breached = COSIGN_SLA_METRICS.filter(
      (m) => m.status === "breached",
    ).map((m) => m.recordId);
    const warning = COSIGN_SLA_METRICS.filter(
      (m) => m.status === "warning",
    ).map((m) => m.recordId);
    return { breached, warning, refreshedAt: new Date().toISOString() };
  },

  // ============================================================
  // 8. 历史记录 (后端 /cosign/history)
  // ============================================================
  async getHistory(reportId: string): Promise<CosignRecord["history"]> {
    try {
      const res = await coSignApi.getHistory();
      if (!res.success)
        throw new Error(res.error?.message ?? "加载会签历史失败");
      // 后端返回 { data: [...] }, MSW 旧 handler 返回裸数组 —— 两种形状都兼容
      const raw = res.data as unknown;
      const entries: CoSignHistoryEntry[] = Array.isArray(raw)
        ? (raw as CoSignHistoryEntry[])
        : ((raw as { data?: CoSignHistoryEntry[] })?.data ?? []);
      const filtered = entries.filter((e) => e.reportId === reportId);
      if (filtered.length > 0) {
        lastSource = "api";
        return filtered.map(mapHistoryEntry);
      }
    } catch {
      // 降级
    }
    lastSource = "demo";
    const recs = records.filter((r) => r.reportId === reportId);
    const all = recs.flatMap((r) => r.history);
    return clone(all);
  },

  async listAuditLog(): Promise<typeof COSIGN_AUDIT_LOG> {
    lastSource = "demo";
    return clone(COSIGN_AUDIT_LOG);
  },

  // ============================================================
  // 9. 跳过配置
  // ============================================================
  async getSkipConfig(): Promise<CosignSkipConfig> {
    lastSource = "demo";
    return clone(COSIGN_SKIP_CONFIG);
  },

  async updateSkipConfig(
    patch: Partial<CosignSkipConfig>,
  ): Promise<CosignSkipConfig> {
    return clone({
      ...COSIGN_SKIP_CONFIG,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },

  async toggleSkipCondition(
    conditionId: string,
    enabled: boolean,
  ): Promise<CosignSkipConfig> {
    const cfg = clone(COSIGN_SKIP_CONFIG);
    const cond = cfg.conditions.find((c) => c.id === conditionId);
    if (cond) cond.enabled = enabled;
    cfg.updatedAt = new Date().toISOString();
    return cfg;
  },

  // ============================================================
  // 10. 临时授权
  // ============================================================
  async listTempAuths(
    status?: TemporaryAuth["status"],
  ): Promise<TemporaryAuth[]> {
    lastSource = "demo";
    let list = tempAuths.slice();
    if (status) list = list.filter((t) => t.status === status);
    return clone(list);
  },

  async createTempAuth(
    payload: Omit<TemporaryAuth, "id" | "status" | "usedCount" | "createdAt">,
  ): Promise<TemporaryAuth> {
    const auth: TemporaryAuth = {
      id: uuid(),
      status: "active",
      usedCount: 0,
      createdAt: new Date().toISOString(),
      ...payload,
    };
    tempAuths.push(auth);
    return clone(auth);
  },

  async revokeTempAuth(
    id: string,
    revokedBy: string,
    reason: string,
  ): Promise<TemporaryAuth> {
    const a = tempAuths.find((x) => x.id === id);
    if (!a) throw new Error("TempAuth not found");
    a.status = "revoked";
    a.revokedAt = new Date().toISOString();
    a.revokedBy = revokedBy;
    a.revokeReason = reason;
    return clone(a);
  },

  // ============================================================
  // 11. 批量签
  // ============================================================
  async listBatchRequests(): Promise<BatchCosignRequest[]> {
    lastSource = "demo";
    return clone(batchReqs);
  },

  async startBatchCosign(
    payload: Omit<
      BatchCosignRequest,
      | "id"
      | "startedAt"
      | "totalCount"
      | "successCount"
      | "failCount"
      | "skipCount"
      | "results"
    >,
  ): Promise<BatchCosignRequest> {
    const req: BatchCosignRequest = {
      id: uuid(),
      startedAt: new Date().toISOString(),
      totalCount: payload.reportIds.length,
      successCount: 0,
      failCount: 0,
      skipCount: 0,
      results: payload.reportIds.map((rid) => ({
        recordId: "bc-" + rid,
        reportId: rid,
        status: "skipped",
        reason: "待处理",
      })),
      ...payload,
    };
    batchReqs.push(req);
    return clone(req);
  },

  async executeBatchCosign(
    reqId: string,
    _actorId: string,
    _actorName: string,
  ): Promise<BatchCosignRequest> {
    const req = batchReqs.find((x) => x.id === reqId);
    if (!req) throw new Error("Batch request not found");
    // 逐条走真实会签端点, 单条失败计入 failCount (不整体假装成功)
    const results: BatchCosignRequest["results"] = [];
    for (const rid of req.reportIds) {
      if (req.decision === "approve") {
        const res = await coSignApi.approve(rid, { note: req.comment });
        results.push({
          recordId: "bc-" + rid,
          reportId: rid,
          status: res.success ? "approved" : "failed",
          reason: res.success ? undefined : (res.error?.message ?? "会签失败"),
          signedAt: res.success ? new Date().toISOString() : undefined,
        });
      } else {
        const res = await coSignApi.reject(rid, {
          reason: req.comment || "批量拒签",
        });
        results.push({
          recordId: "bc-" + rid,
          reportId: rid,
          status: res.success ? "rejected" : "failed",
          reason: res.success ? undefined : (res.error?.message ?? "拒签失败"),
        });
      }
    }
    req.results = results;
    req.successCount = results.filter((r) => r.status === "approved").length;
    req.failCount = results.filter((r) => r.status === "failed").length;
    req.skipCount = results.filter((r) => r.status === "skipped").length;
    req.completedAt = new Date().toISOString();
    return clone(req);
  },

  // ============================================================
  // 12. 仪表盘 (后端 /cosign/stats)
  // ============================================================
  async getDashboardKPI(): Promise<CosignDashboardKPI> {
    try {
      const res = await coSignApi.getStats();
      if (!res.success || !res.data)
        throw new Error(res.error?.message ?? "加载会签统计失败");
      const s = res.data;
      const base = clone(COSIGN_DASHBOARD_KPI);
      lastSource = "api";
      return {
        ...base,
        totalTriggered: s.total ?? base.totalTriggered,
        totalSigned: s.approved ?? base.totalSigned,
        totalRejected: s.rejected ?? base.totalRejected,
        avgResponseMinutes: s.avgResponseMinutes ?? base.avgResponseMinutes,
        onTimeRate: s.onTimeRate ?? base.onTimeRate,
      };
    } catch {
      lastSource = "demo";
      return clone(COSIGN_DASHBOARD_KPI);
    }
  },

  // ============================================================
  // 13. 证书
  // ============================================================
  async listCertificates() {
    lastSource = "demo";
    return clone(COSIGN_CERTIFICATES);
  },
};

function titleRank(t: ReviewerRole): number {
  const order: Record<ReviewerRole, number> = {
    resident: 0,
    attending: 1,
    associateChief: 2,
    chief: 3,
    director: 4,
  };
  return order[t] ?? 0;
}

export type CosignService = typeof cosignService;
export default cosignService;

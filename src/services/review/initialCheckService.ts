/**
 * G005 RIS v3.0.5.1 - R3.REVIEW INITIAL CHECK 初核清单服务 (Mock)
 * 对应章节 1.1 初核清单(80 点)
 */
import {
  CHECK_ITEM_TEMPLATES,
  INITIAL_CHECK_LISTS,
  INITIAL_CHECK_AUDIT,
  INITIAL_CHECK_SLA_CONFIG,
  INITIAL_CHECK_CUSTOM_ITEMS,
  INITIAL_CHECK_WORKLOAD,
  INITIAL_CHECK_SUMMARY,
  INITIAL_CHECK_BATCH_RESULT,
} from '../../data/reportInitialCheckMock';
import type {
  InitialCheckItem,
  InitialCheckListInstance,
  InitialCheckResult,
  InitialCheckAuditEntry,
  InitialCheckSLAConfig,
  InitialCheckCustomItem,
  InitialCheckWorkloadStats,
  InitialCheckSummary,
  InitialCheckBatchRequest,
  InitialCheckBatchResult,
  InitialCheckFilter,
  OneClickValidation,
  CheckItemResultStatus,
} from '../../types/R3/R3.REVIEW.INITIAL';
import type { ReviewTask } from '../../types/R3/R3.REVIEW';

const LATENCY_MIN = 120;
const LATENCY_MAX = 800;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;
const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const uid = (prefix: string) => prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

const lists: InitialCheckListInstance[] = clone(INITIAL_CHECK_LISTS);
const audits: InitialCheckAuditEntry[] = clone(INITIAL_CHECK_AUDIT);
const customItems: InitialCheckCustomItem[] = clone(INITIAL_CHECK_CUSTOM_ITEMS);
let slaConfig: InitialCheckSLAConfig = clone(INITIAL_CHECK_SLA_CONFIG);
let workloadStats: InitialCheckWorkloadStats[] = clone(INITIAL_CHECK_WORKLOAD);
let summary: InitialCheckSummary = clone(INITIAL_CHECK_SUMMARY);

const recomputeListStats = (list: InitialCheckListInstance): void => {
  const allRequired = list.items.filter((i) => i.required);
  const totalPassed = list.items.filter((i) => list.results[i.id]?.status === 'passed').length;
  const passedRequired = allRequired.filter((i) => list.results[i.id]?.status === 'passed').length;
  list.requiredPassRate = allRequired.length > 0 ? passedRequired / allRequired.length : 1;
  list.passRate = list.items.length > 0 ? totalPassed / list.items.length : 1;
  list.requiredAllPassed = list.requiredPassRate >= 1;
  list.autoScore = Math.round(list.passRate * 100);
  list.overallStatus = list.overallStatus === 'approved' || list.overallStatus === 'rejected'
    ? list.overallStatus
    : (list.requiredAllPassed ? 'ready-to-approve' : 'in-progress');
  const remainMs = new Date(list.slaDeadline).getTime() - Date.now();
  list.slaRemainingMinutes = Math.floor(remainMs / 60000);
  list.isOverdue = list.slaRemainingMinutes < 0;
  list.updatedAt = new Date().toISOString();
};

const appendAudit = (
  list: InitialCheckListInstance,
  action: InitialCheckAuditEntry['action'],
  actorId: string,
  actorName: string,
  detail?: string,
  itemId?: string,
): InitialCheckAuditEntry => {
  const e: InitialCheckAuditEntry = {
    id: uid('auc'),
    listId: list.id,
    reportId: list.reportId,
    action,
    actorId,
    actorName,
    detail,
    itemId,
    timestamp: new Date().toISOString(),
  };
  audits.push(e);
  return e;
};

const validateSingle = (item: InitialCheckItem, payload: { findings?: string; impression?: string; recommendation?: string; clinicalHistory?: string; patientInfo?: string; studyInfo?: string; qualityScore?: number }): OneClickValidation => {
  const source = (item.sourceField ? payload[item.sourceField] ?? '' : payload.findings ?? '').toString();
  const result: OneClickValidation = {
    canPass: true,
    missing: [],
    warnings: [],
    passRate: 1,
    requiredPassRate: 1,
  };
  if (item.minLength !== undefined && source.length < item.minLength) {
    result.canPass = false;
    result.missing.push(`${item.name}:长度不足 ${item.minLength} 字符`);
  }
  if (item.maxLength !== undefined && source.length > item.maxLength) {
    result.warnings.push(`${item.name}:长度超过 ${item.maxLength} 字符`);
  }
  if (item.keywords && item.keywords.length > 0) {
    const hit = item.keywords.some((k) => source.includes(k));
    if (!hit) {
      if (item.required) {
        result.canPass = false;
        result.missing.push(`${item.name}:未命中关键字 ${item.keywords.slice(0, 3).join(' / ')}`);
      } else {
        result.warnings.push(`${item.name}:未命中关键字`);
      }
    }
  }
  if (item.patterns && item.patterns.length > 0) {
    const hit = item.patterns.some((p) => { try { return new RegExp(p, 'i').test(source); } catch { return false; } });
    if (!hit) {
      if (item.required) {
        result.canPass = false;
        result.missing.push(`${item.name}:正则未命中`);
      } else {
        result.warnings.push(`${item.name}:正则未命中`);
      }
    }
  }
  if (item.code === 'CHK-QUALITY-SCORE' && payload.qualityScore !== undefined && payload.qualityScore < 60) {
    result.canPass = false;
    result.missing.push('AI 质量评分 < 60,无法一键通过');
  }
  return result;
};

export const initialCheckService = {
  async listItems(): Promise<InitialCheckItem[]> {
    await wait();
    return clone(CHECK_ITEM_TEMPLATES);
  },

  async listCustomItems(reviewerId?: string): Promise<InitialCheckCustomItem[]> {
    await wait();
    return clone(customItems.filter((c) => !reviewerId || c.reviewerId === reviewerId));
  },

  async createCustomItem(reviewerId: string, reviewerName: string, partial: Partial<InitialCheckItem>, scope: InitialCheckCustomItem['scope'] = 'private'): Promise<InitialCheckCustomItem> {
    await wait();
    const item: InitialCheckItem = {
      ...(CHECK_ITEM_TEMPLATES[0]!),
      ...partial,
      id: uid('ci-cus'),
      code: partial.code ?? 'CUS-' + Date.now().toString(36).toUpperCase(),
      isSystem: false,
      createdBy: reviewerId,
      createdAt: new Date().toISOString(),
    } as InitialCheckItem;
    const rec: InitialCheckCustomItem = {
      id: uid('cus'),
      reviewerId,
      reviewerName,
      item,
      scope,
      usedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customItems.push(rec);
    return clone(rec);
  },

  async deleteCustomItem(id: string): Promise<{ ok: boolean }> {
    await wait();
    const idx = customItems.findIndex((c) => c.id === id);
    if (idx === -1) return { ok: false };
    customItems.splice(idx, 1);
    return { ok: true };
  },

  async listCheckLists(filter?: InitialCheckFilter): Promise<InitialCheckListInstance[]> {
    await wait();
    let result = lists.slice();
    if (filter?.status && filter.status !== 'all') result = result.filter((l) => l.overallStatus === filter.status);
    if (filter?.priority && filter.priority !== 'all') {
      const t = (await import('../../data/reportReviewMock')).REVIEW_TASKS;
      const allowedIds = new Set(t.filter((tk) => tk.priority === filter.priority).map((tk) => tk.id));
      result = result.filter((l) => allowedIds.has(l.taskId));
    }
    if (filter?.modality) {
      const t = (await import('../../data/reportReviewMock')).REVIEW_TASKS;
      const allowedIds = new Set(t.filter((tk) => tk.modality === filter.modality).map((tk) => tk.id));
      result = result.filter((l) => allowedIds.has(l.taskId));
    }
    if (filter?.overdueOnly) result = result.filter((l) => l.isOverdue);
    if (filter?.requiredIncompleteOnly) result = result.filter((l) => !l.requiredAllPassed);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((l) => l.reportId.toLowerCase().includes(q) || l.id.toLowerCase().includes(q));
    }
    if (filter?.sortBy) {
      const dir = filter.sortOrder === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        switch (filter.sortBy) {
          case 'deadline': return (a.slaRemainingMinutes - b.slaRemainingMinutes) * dir;
          case 'passRate': return (a.passRate - b.passRate) * dir;
          case 'createdAt': return (a.createdAt < b.createdAt ? -1 : 1) * dir;
          default: return 0;
        }
      });
    } else {
      result.sort((a, b) => a.slaRemainingMinutes - b.slaRemainingMinutes);
    }
    const page = filter?.page ?? 1;
    const size = filter?.pageSize ?? 20;
    return clone(result.slice((page - 1) * size, page * size));
  },

  async getCheckList(id: string): Promise<InitialCheckListInstance | null> {
    await wait();
    const found = lists.find((l) => l.id === id);
    return found ? clone(found) : null;
  },

  async getCheckListByReport(reportId: string): Promise<InitialCheckListInstance | null> {
    await wait();
    const found = lists.find((l) => l.reportId === reportId);
    return found ? clone(found) : null;
  },

  async listAudit(listId: string): Promise<InitialCheckAuditEntry[]> {
    await wait();
    return clone(audits.filter((a) => a.listId === listId));
  },

  async getSLAConfig(): Promise<InitialCheckSLAConfig> {
    await wait();
    return clone(slaConfig);
  },

  async updateSLAConfig(partial: Partial<InitialCheckSLAConfig>, actor: { id: string; name: string }): Promise<InitialCheckSLAConfig> {
    await wait();
    slaConfig = { ...slaConfig, ...partial, updatedAt: new Date().toISOString(), updatedBy: actor.id };
    return clone(slaConfig);
  },

  async validateOneClick(listId: string, payload: { findings?: string; impression?: string; recommendation?: string; clinicalHistory?: string; patientInfo?: string; studyInfo?: string; qualityScore?: number }): Promise<OneClickValidation> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    const allRequired = list.items.filter((i) => i.required);
    const failures: string[] = [];
    const warnings: string[] = [];
    let requiredPass = 0;
    let passed = 0;
    list.items.forEach((item) => {
      const v = validateSingle(item, payload);
      if (v.canPass) {
        passed += 1;
        if (item.required) requiredPass += 1;
      } else {
        failures.push(...v.missing);
      }
      warnings.push(...v.warnings);
    });
    return {
      canPass: requiredPass === allRequired.length,
      missing: failures,
      warnings,
      passRate: list.items.length > 0 ? passed / list.items.length : 1,
      requiredPassRate: allRequired.length > 0 ? requiredPass / allRequired.length : 1,
    };
  },

  async overrideItem(listId: string, itemId: string, status: CheckItemResultStatus, note: string, actor: { id: string; name: string }): Promise<InitialCheckListInstance> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    const r = list.results[itemId];
    if (!r) throw new Error('Result not found');
    r.status = status;
    r.note = note;
    r.overridden = true;
    r.checkedAt = new Date().toISOString();
    recomputeListStats(list);
    appendAudit(list, 'item-overridden', actor.id, actor.name, `将 ${r.itemCode} 标记为 ${status}:${note}`, itemId);
    return clone(list);
  },

  async batchValidate(listId: string, actor: { id: string; name: string }, payload: { findings?: string; impression?: string; recommendation?: string; clinicalHistory?: string; patientInfo?: string; studyInfo?: string; qualityScore?: number }): Promise<{ list: InitialCheckListInstance; validation: OneClickValidation }> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    let requiredPass = 0;
    const failures: string[] = [];
    const warnings: string[] = [];
    list.items.forEach((item) => {
      if (!item.enabledByDefault && !item.userToggleable) {
        list.results[item.id]!.status = 'skipped';
        return;
      }
      const v = validateSingle(item, payload);
      const cur = list.results[item.id]!;
      if (cur.overridden) return;
      if (v.canPass) {
        cur.status = 'passed';
        cur.reason = undefined;
        cur.autoScore = item.maxScore ?? 10;
        cur.checkedAt = new Date().toISOString();
        if (item.required) requiredPass += 1;
      } else {
        cur.status = item.required ? 'failed' : 'pending';
        cur.reason = v.missing[0] ?? '未通过';
        cur.autoScore = 0;
        cur.checkedAt = new Date().toISOString();
        if (item.required) failures.push(...v.missing);
      }
      warnings.push(...v.warnings);
    });
    recomputeListStats(list);
    const allRequired = list.items.filter((i) => i.required);
    const validation: OneClickValidation = {
      canPass: requiredPass === allRequired.length,
      missing: failures,
      warnings,
      passRate: list.items.length > 0 ? list.items.filter((i) => list.results[i.id]?.status === 'passed').length / list.items.length : 1,
      requiredPassRate: allRequired.length > 0 ? requiredPass / allRequired.length : 1,
    };
    appendAudit(list, 'batch-validated', actor.id, actor.name, `批量校验 ${list.items.length} 项,${list.items.filter((i) => list.results[i.id]?.status === 'passed').length} 通过`);
    return { list: clone(list), validation };
  },

  async oneClickApprove(listId: string, comment: string, actor: { id: string; name: string; title?: string }): Promise<InitialCheckListInstance> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    if (!list.requiredAllPassed) throw new Error('必填项未全部通过,无法一键通过');
    list.overallStatus = 'approved';
    list.decision = 'approve';
    list.decisionAt = new Date().toISOString();
    list.decisionComment = comment;
    appendAudit(list, 'approved', actor.id, actor.name, `一键通过:${comment || '无意见'}`);
    return clone(list);
  },

  async oneClickReject(listId: string, reason: string, rejectCategory: string, actor: { id: string; name: string; title?: string }): Promise<InitialCheckListInstance> {
    await wait();
    if (!reason || reason.trim().length < 5) throw new Error('驳回原因不能少于 5 字符');
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    list.overallStatus = 'rejected';
    list.decision = 'reject';
    list.decisionAt = new Date().toISOString();
    list.decisionComment = reason + (rejectCategory ? `[${rejectCategory}]` : '');
    appendAudit(list, 'rejected', actor.id, actor.name, `一键驳回:${reason}`);
    return clone(list);
  },

  async batchProcess(request: InitialCheckBatchRequest): Promise<InitialCheckBatchResult> {
    await wait(500);
    const startedAt = new Date().toISOString();
    const details: InitialCheckBatchResult['details'] = [];
    let approved = 0, rejected = 0, skipped = 0;
    for (const listId of request.taskIds.map((tid) => lists.find((l) => l.taskId === tid)?.id).filter(Boolean) as string[]) {
      const list = lists.find((l) => l.id === listId);
      if (!list) continue;
      if (request.requireAllRequiredPass && !list.requiredAllPassed) {
        skipped += 1;
        details.push({ listId, reportId: list.reportId, status: 'skipped', reason: '必填项未全部通过' });
        continue;
      }
      if (request.decision === 'approve') {
        list.overallStatus = 'approved';
        list.decision = 'approve';
        list.decisionAt = new Date().toISOString();
        list.decisionComment = request.comment;
        approved += 1;
        details.push({ listId, reportId: list.reportId, status: 'approved' });
        appendAudit(list, 'batch-approve', request.reviewerId, request.reviewerName, request.comment);
      } else {
        if (!request.comment || request.comment.trim().length < 5) {
          skipped += 1;
          details.push({ listId, reportId: list.reportId, status: 'skipped', reason: '驳回原因不足 5 字符' });
          continue;
        }
        list.overallStatus = 'rejected';
        list.decision = 'reject';
        list.decisionAt = new Date().toISOString();
        list.decisionComment = request.comment;
        rejected += 1;
        details.push({ listId, reportId: list.reportId, status: 'rejected' });
        appendAudit(list, 'batch-reject', request.reviewerId, request.reviewerName, request.comment);
      }
    }
    return {
      total: request.taskIds.length,
      approved,
      rejected,
      skipped,
      details,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  },

  async toggleItem(listId: string, itemId: string, enabled: boolean, actor: { id: string; name: string }): Promise<InitialCheckListInstance> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');
    item.enabledByDefault = enabled;
    list.results[itemId]!.status = enabled ? 'pending' : 'skipped';
    recomputeListStats(list);
    appendAudit(list, 'item-toggled', actor.id, actor.name, enabled ? `启用 ${item.code}` : `禁用 ${item.code}`, itemId);
    return clone(list);
  },

  async addItemToList(listId: string, itemId: string, actor: { id: string; name: string }): Promise<InitialCheckListInstance> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    const template = CHECK_ITEM_TEMPLATES.find((i) => i.id === itemId) ?? customItems.find((c) => c.item.id === itemId)?.item;
    if (!template) throw new Error('Template not found');
    if (list.items.some((i) => i.id === template.id)) return clone(list);
    list.items.push(template);
    list.results[template.id] = {
      itemId: template.id,
      itemCode: template.code,
      status: 'pending',
      autoScore: 0,
      overridden: false,
      checkedAt: new Date().toISOString(),
    };
    recomputeListStats(list);
    appendAudit(list, 'custom-item-added', actor.id, actor.name, `新增自定义项 ${template.code}`, template.id);
    return clone(list);
  },

  async removeItemFromList(listId: string, itemId: string, actor: { id: string; name: string }): Promise<InitialCheckListInstance> {
    await wait();
    const list = lists.find((l) => l.id === listId);
    if (!list) throw new Error('CheckList not found');
    const item = list.items.find((i) => i.id === itemId);
    if (item?.isSystem) throw new Error('系统项不可删除');
    list.items = list.items.filter((i) => i.id !== itemId);
    delete list.results[itemId];
    recomputeListStats(list);
    appendAudit(list, 'custom-item-removed', actor.id, actor.name, `移除 ${item?.code ?? itemId}`, itemId);
    return clone(list);
  },

  async getWorkload(): Promise<InitialCheckWorkloadStats[]> {
    await wait();
    return clone(workloadStats);
  },

  async getSummary(): Promise<InitialCheckSummary> {
    await wait();
    summary = { ...summary, reviewerBreakdown: workloadStats };
    return clone(summary);
  },

  async refreshSLA(): Promise<{ breached: string[]; warned: string[]; breachedAt: string }> {
    await wait(150);
    const breached: string[] = [];
    const warned: string[] = [];
    lists.forEach((l) => {
      if (l.isOverdue) breached.push(l.id);
      else if (l.slaRemainingMinutes <= l.slaWarnMinutes) warned.push(l.id);
    });
    return { breached, warned, breachedAt: new Date().toISOString() };
  },
};

export type InitialCheckService = typeof initialCheckService;
export default initialCheckService;

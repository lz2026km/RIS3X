/**
 * G005 RIS v3.0.5.1 - R3.CRITICAL 危急值服务 (API first + demo fallback)
 * v3.0.6.6: 真实升级链 / IVR 语音 / SMS 网关集成
 *
 * v3.0.6.12-A4: 事件源改为 store.criticalEvents (unifiedCriticalValues).
 *   通过 criticalValueAdapter 转回 R3.CRITICAL.CriticalEvent 形状后克隆到 inMemoryEvents.
 *
 * v3.0.6.XX: runEscalationChain 等关键方法优先调用后端 API,失败时降级到 Mock。
 *
 * v3.0.6.17: 读接口改为优先调用真实后端 (criticalApi), 失败时降级演示数据并置
 *   getCriticalDataSource()='demo'; 写接口 (上报/通知/确认/处理/升级) 必须走后端且
 *   不再吞掉失败 —— 后端拒绝时向调用方抛出错误。
 */
import {
  CRITICAL_LEVELS,
  CRITICAL_RULES,
  CRITICAL_ESCALATION_RULES,
  CRITICAL_KPI,
} from "../../data/criticalValueMock";
import { list } from "../mockBackend/store";
import { mapUnifiedToCriticalEvents } from "../../data/criticalValueAdapter";
import { ESCALATION_CHAINS } from "../../data/notificationProviders";
import { onCallResolver } from "../critical/oncall/OnCallResolver";
import type {
  CriticalRule,
  CriticalEvent,
  CriticalLevelConfig,
  CriticalKPI,
  CriticalEscalationRule,
  CriticalLevel,
  NotificationChannel,
  CriticalStatus,
} from "../../types/R3/R3.CRITICAL";
import type {
  EscalationChain,
  EscalationChainNode,
} from "../../types/notification";
import { defaultSmsRouter } from "../notification/SmsGateway";
import { defaultVoiceRouter } from "../notification/VoiceGateway";
import { criticalApi } from "../api/criticalApi";
import type { CriticalValueDto, NotificationMethod } from "../api/criticalApi";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryEvents: CriticalEvent[] = mapUnifiedToCriticalEvents(
  list<any>("criticalEvents"),
);
const inMemoryRules: CriticalRule[] = clone(CRITICAL_RULES);

// [v3.0.6.17] 数据来源登记: 'api' = 后端返回, 'demo' = 后端不可用时的演示兜底
export type CriticalDataSource = "api" | "demo";
let lastSource: CriticalDataSource = "demo";
export function getCriticalDataSource(): CriticalDataSource {
  return lastSource;
}

const DEFAULT_SOP = [
  {
    step: 1,
    title: "发现危急值",
    description: "影像检查发现危急值征象",
    action: "立即记录",
    deadlineMinutes: 1,
  },
  {
    step: 2,
    title: "复核确认",
    description: "上级医生复核危急值",
    action: "双人复核",
    deadlineMinutes: 5,
  },
  {
    step: 3,
    title: "通知临床",
    description: "电话/短信通知主管医生",
    action: "多渠道通知",
    deadlineMinutes: 10,
  },
  {
    step: 4,
    title: "记录确认",
    description: "记录接收医生与时间",
    action: "记录系统",
    deadlineMinutes: 10,
  },
  {
    step: 5,
    title: "持续追踪",
    description: "追踪临床处理情况",
    action: "持续追踪",
    deadlineMinutes: 30,
  },
  {
    step: 6,
    title: "闭环归档",
    description: "归档危急值处理记录",
    action: "闭环归档",
    deadlineMinutes: 60,
  },
];

const SEVERITY_LEVEL: Record<string, CriticalLevel> = {
  critical: "critical",
  life_threatening: "critical",
  危及生命: "critical",
  危急: "critical",
  urgent: "urgent",
  high: "urgent",
  高危: "urgent",
  紧急: "urgent",
  warning: "warning",
  medium: "warning",
  important: "warning",
  警告: "warning",
  low: "info",
  info: "info",
};

const STATE_STATUS: Record<string, CriticalStatus> = {
  FOUND: "pending",
  NOTIFIED: "notified",
  VOICE_CALLED: "notified",
  ACKNOWLEDGED: "acknowledged",
  RECEIPTED: "acknowledged",
  RESOLVING: "acknowledged",
  RESOLVED: "resolved",
  CLOSED_LOOP: "resolved",
  ESCALATED: "escalated",
  CANCELLED: "cancelled",
};

const VALID_STATUS = new Set<string>([
  "pending",
  "notified",
  "acknowledged",
  "resolved",
  "overdue",
  "escalated",
  "cancelled",
]);

const METHOD_CHANNEL: Record<string, NotificationChannel> = {
  PHONE: "phone",
  SMS: "sms",
  WECHAT: "wechat",
  EMAIL: "email",
  DINGTALK: "inApp",
  SYSTEM: "inApp",
  APP: "inApp",
};

const CHANNEL_METHOD: Record<NotificationChannel, NotificationMethod> = {
  phone: "PHONE",
  sms: "SMS",
  wechat: "WECHAT",
  inApp: "SYSTEM",
  email: "EMAIL",
  pager: "SYSTEM",
};

const LEVEL_SEVERITY: Record<
  CriticalLevel,
  "LOW" | "HIGH" | "URGENT" | "CRITICAL"
> = {
  critical: "CRITICAL",
  urgent: "URGENT",
  warning: "HIGH",
  info: "LOW",
};

function deriveStatus(dto: CriticalValueDto): CriticalStatus {
  const s = String(dto.status ?? "").toLowerCase();
  if (VALID_STATUS.has(s)) return s as CriticalStatus;
  return STATE_STATUS[String(dto.state ?? "").toUpperCase()] ?? "pending";
}

function deriveLevel(
  dto: CriticalValueDto,
  fallback: CriticalLevel,
): CriticalLevel {
  const sev = String(dto.severity ?? "").toLowerCase();
  const cat = String(dto.category ?? "").toLowerCase();
  return SEVERITY_LEVEL[sev] ?? SEVERITY_LEVEL[cat] ?? fallback;
}

/** 由后端 DTO 合成一个最小可用的 R3.CRITICAL.CriticalEvent */
function emptyEventFromDto(dto: CriticalValueDto): CriticalEvent {
  const reportedAt =
    dto.triggeredAt ?? dto.createdAt ?? new Date().toISOString();
  return {
    id: dto.id,
    ruleId: "",
    ruleCode: "",
    ruleName: dto.finding || dto.description || "危急值",
    level: deriveLevel(dto, "warning"),
    reportId: dto.reportId ?? "",
    examId: dto.examId ?? "",
    patientId: dto.patientId ?? "",
    patientName: dto.patientName || "未知患者",
    gender: "其他",
    age: 0,
    modality: "",
    bodyPart: "",
    reportedById: "",
    reportedByName: "",
    reportedByTitle: "",
    reportedAt,
    status: deriveStatus(dto),
    channels: dto.notificationMethod
      ? [METHOD_CHANNEL[dto.notificationMethod] ?? "inApp"]
      : [],
    channelAttempts: [],
    detail: dto.description || dto.finding || "",
    onTimeNotification: false,
    escalationLevel: 0,
    sop: clone(DEFAULT_SOP),
    hash: `cvh-${dto.id}`,
    auditChain: [],
  };
}

/** 将后端 DTO 覆盖到演示种子事件 (同 id) 上, 保留演示数据里的丰富字段 */
function mergeDtoOnto(
  seed: CriticalEvent,
  dto: CriticalValueDto,
): CriticalEvent {
  const base = clone(seed);
  return {
    ...base,
    id: dto.id || base.id,
    patientName: dto.patientName || base.patientName,
    patientId: dto.patientId || base.patientId,
    reportId: dto.reportId ?? base.reportId,
    examId: dto.examId ?? base.examId,
    status: deriveStatus(dto),
    level: deriveLevel(dto, base.level),
    detail: dto.description || dto.finding || base.detail,
    reportedAt: dto.triggeredAt ?? dto.createdAt ?? base.reportedAt,
    receivingTime: dto.notifiedAt ?? base.receivingTime,
    receivingDoctorName: dto.notifiedTo || base.receivingDoctorName,
    acknowledgedTime: dto.acknowledgedAt ?? base.acknowledgedTime,
    acknowledgedByName: dto.confirmedBy || base.acknowledgedByName,
    resolvedTime: dto.resolvedAt ?? base.resolvedTime,
    escalatedAt: dto.escalatedAt ?? base.escalatedAt,
    escalatedToName: dto.escalatedTo || base.escalatedToName,
    channels: dto.notificationMethod
      ? Array.from(
          new Set([
            ...base.channels,
            METHOD_CHANNEL[dto.notificationMethod] ?? "inApp",
          ]),
        )
      : base.channels,
    ruleName: base.ruleName || dto.finding || dto.description || "危急值",
  };
}

function upsertLocalEvent(dto: CriticalValueDto): CriticalEvent {
  const idx = inMemoryEvents.findIndex((e) => e.id === dto.id);
  const next =
    idx >= 0 ? mergeDtoOnto(inMemoryEvents[idx]!, dto) : emptyEventFromDto(dto);
  if (idx >= 0) inMemoryEvents[idx] = next;
  else inMemoryEvents.unshift(next);
  return next;
}

/** 写接口的前置校验: 确保本地存在对应事件 (必要时从后端补拉), 否则抛出 */
async function requireLocalEvent(eventId: string): Promise<CriticalEvent> {
  const found = inMemoryEvents.find((e) => e.id === eventId);
  if (found) return found;
  const got = await criticalApi.getById(eventId);
  if (got.success && got.data) return upsertLocalEvent(got.data);
  throw new Error("Event not found");
}

export const criticalValueService = {
  // ============================================================
  // 配置 / 字典 (前端静态配置, 无后端等价端点)
  // ============================================================
  async listLevels(): Promise<CriticalLevelConfig[]> {
    lastSource = "demo";
    return clone(CRITICAL_LEVELS);
  },

  async getLevel(level: CriticalLevel): Promise<CriticalLevelConfig | null> {
    lastSource = "demo";
    return clone(CRITICAL_LEVELS.find((l) => l.level === level) ?? null);
  },

  async listRules(filter?: {
    category?: string;
    modality?: string;
    isActive?: boolean;
  }): Promise<CriticalRule[]> {
    lastSource = "demo";
    let list = inMemoryRules.slice();
    if (filter?.category)
      list = list.filter((r) => r.category === filter.category);
    if (filter?.modality)
      list = list.filter((r) => r.modality.includes(filter.modality!));
    if (filter?.isActive !== undefined)
      list = list.filter((r) => r.isActive === filter.isActive);
    return list;
  },

  async getRule(id: string): Promise<CriticalRule | null> {
    lastSource = "demo";
    return clone(inMemoryRules.find((r) => r.id === id) ?? null);
  },

  async updateRule(
    id: string,
    patch: Partial<CriticalRule>,
  ): Promise<CriticalRule> {
    const r = inMemoryRules.find((x) => x.id === id);
    if (!r) throw new Error("Rule not found");
    Object.assign(r, patch, { updatedAt: new Date().toISOString() });
    return clone(r);
  },

  async toggleRule(id: string, isActive: boolean): Promise<CriticalRule> {
    return this.updateRule(id, { isActive });
  },

  // ============================================================
  // 事件读取 (后端 /criticals, 失败降级演示数据)
  // ============================================================
  async listEvents(filter?: {
    status?: CriticalStatus;
    level?: CriticalLevel;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CriticalEvent[]> {
    let events: CriticalEvent[];
    try {
      const res = await criticalApi.list({
        dateFrom: filter?.dateFrom,
        dateTo: filter?.dateTo,
      });
      if (!res.success) throw new Error(res.error?.message ?? "加载危急值失败");
      const items = res.data?.items ?? [];
      events = items.map((dto) => {
        const seed = inMemoryEvents.find((e) => e.id === dto.id);
        return seed ? mergeDtoOnto(seed, dto) : emptyEventFromDto(dto);
      });
      lastSource = "api";
    } catch {
      events = clone(inMemoryEvents);
      lastSource = "demo";
    }
    let list = events;
    if (filter?.status) list = list.filter((e) => e.status === filter.status);
    if (filter?.level) list = list.filter((e) => e.level === filter.level);
    return list;
  },

  async getEvent(id: string): Promise<CriticalEvent | null> {
    try {
      const res = await criticalApi.getById(id);
      if (!res.success || !res.data)
        throw new Error(res.error?.message ?? "事件不存在");
      lastSource = "api";
      const seed = inMemoryEvents.find((e) => e.id === id);
      return seed ? mergeDtoOnto(seed, res.data) : emptyEventFromDto(res.data);
    } catch {
      lastSource = "demo";
      return clone(inMemoryEvents.find((e) => e.id === id) ?? null);
    }
  },

  // ============================================================
  // 事件写入 (必须走后端, 失败抛出)
  // ============================================================
  async reportEvent(
    event: Omit<
      CriticalEvent,
      | "id"
      | "reportedAt"
      | "status"
      | "channels"
      | "sop"
      | "auditChain"
      | "hash"
      | "escalationLevel"
    >,
  ): Promise<CriticalEvent> {
    const res = await criticalApi.create({
      examId: event.examId,
      description: event.detail || event.ruleName || "危急值",
      severity: LEVEL_SEVERITY[event.level] ?? "HIGH",
      reportId: event.reportId,
    });
    if (!res.success) throw new Error(res.error?.message ?? "危急值上报失败");
    const now = new Date().toISOString();
    const e: CriticalEvent = {
      ...event,
      id: res.data?.id ?? "ce-" + Date.now(),
      reportedAt: res.data?.triggeredAt ?? now,
      status: "pending",
      channels: [],
      sop: clone(DEFAULT_SOP),
      auditChain: [],
      hash: "cv-" + (res.data?.id ?? Date.now()),
      escalationLevel: 0,
    };
    inMemoryEvents.unshift(e);
    return clone(e);
  },

  async notifyEvent(
    eventId: string,
    channels: NotificationChannel[],
    recipientId: string,
    recipientName: string,
  ): Promise<CriticalEvent> {
    const method = CHANNEL_METHOD[channels[0] ?? "inApp"] ?? "SYSTEM";
    const res = await criticalApi.notify(eventId, method, { recipientName });
    if (!res.success) throw new Error(res.error?.message ?? "危急值通知失败");
    const e = await requireLocalEvent(eventId);
    const now = new Date().toISOString();
    e.receivingDoctorId = recipientId;
    e.receivingDoctorName = recipientName;
    e.receivingTime = now;
    e.channels = Array.from(new Set([...e.channels, ...channels]));
    e.status = "notified";
    for (const ch of channels) {
      e.channelAttempts.push({
        channel: ch,
        attemptedAt: now,
        success: true,
        recipientId,
      });
    }
    return clone(e);
  },

  async acknowledgeEvent(
    eventId: string,
    userId: string,
    userName: string,
  ): Promise<CriticalEvent> {
    const res = await criticalApi.acknowledge(eventId);
    if (!res.success) throw new Error(res.error?.message ?? "危急值确认失败");
    const e = await requireLocalEvent(eventId);
    const now = new Date().toISOString();
    e.acknowledgedById = userId;
    e.acknowledgedByName = userName;
    e.acknowledgedTime = now;
    e.responseTimeMinutes = Math.round(
      (Date.now() - new Date(e.reportedAt).getTime()) / 60000,
    );
    e.onTimeNotification = (e.responseTimeMinutes ?? 0) <= 10;
    e.status = "acknowledged";
    return clone(e);
  },

  async resolveEvent(eventId: string): Promise<CriticalEvent> {
    const res = await criticalApi.resolve(eventId);
    if (!res.success) throw new Error(res.error?.message ?? "危急值处理失败");
    const e = await requireLocalEvent(eventId);
    e.resolvedTime = new Date().toISOString();
    e.status = "resolved";
    return clone(e);
  },

  async escalateEvent(
    eventId: string,
    toId: string,
    toName: string,
    reason: string,
  ): Promise<CriticalEvent> {
    if (!reason || reason.length < 5)
      throw new Error("升级原因不能少于 5 字符");
    const res = await criticalApi.escalate(eventId, toName, reason);
    if (!res.success) throw new Error(res.error?.message ?? "危急值升级失败");
    const e = await requireLocalEvent(eventId);
    e.escalatedAt = new Date().toISOString();
    e.escalatedToId = toId;
    e.escalatedToName = toName;
    e.escalationReason = reason;
    e.escalationLevel += 1;
    e.status = "escalated";
    return clone(e);
  },

  /** 升级链:优先调用后端 API,不可用时降级到 Mock */
  async runEscalationChain(
    eventId: string,
  ): Promise<{
    chain: EscalationChain;
    nodesTriggered: Array<{
      level: number;
      role: string;
      doctor: string;
      smsResults: number;
      voiceResults: number;
    }>;
  }> {
    try {
      const res = await criticalApi.runEscalationChain(eventId);
      if (res.success && res.data) {
        lastSource = "api";
        return res.data as {
          chain: EscalationChain;
          nodesTriggered: Array<{
            level: number;
            role: string;
            doctor: string;
            smsResults: number;
            voiceResults: number;
          }>;
        };
      }
    } catch {
      // 降级到本地网关编排
    }
    lastSource = "demo";
    return this._mockRunEscalationChain(eventId);
  },

  /** Mock 实现的升级链(后端不可用时经短信/语音网关本地编排) */
  async _mockRunEscalationChain(
    eventId: string,
  ): Promise<{
    chain: EscalationChain;
    nodesTriggered: Array<{
      level: number;
      role: string;
      doctor: string;
      smsResults: number;
      voiceResults: number;
    }>;
  }> {
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error("Event not found");
    const chain = ESCALATION_CHAINS.find(
      (c) => c.criticalLevel === e.level && c.enabled,
    );
    if (!chain) {
      throw new Error("未找到匹配升级链");
    }
    const resolved = onCallResolver.resolveEscalationChain(e.level);
    const triggered: Array<{
      level: number;
      role: string;
      doctor: string;
      smsResults: number;
      voiceResults: number;
    }> = [];
    for (let i = 0; i < chain.nodes.length; i++) {
      const node = chain.nodes[i]!;
      if (!node.enabled) continue;
      const doctor = resolved[i];
      if (!doctor) continue;
      const vars: Record<string, string | number> = {
        patientName: e.patientName,
        ruleName: e.ruleName,
        doctorName: doctor.name,
        escalateDoctor: doctor.name,
        chief: doctor.name,
        director: doctor.name,
        minutes: node.triggerAfterMinutes,
      };
      const renderedMessage = Object.entries(vars).reduce(
        (acc, [k, v]) =>
          acc.replace(
            new RegExp(
              `\\{${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`,
              "g",
            ),
            String(v),
          ),
        node.messageTemplate,
      );
      let smsResults = 0;
      let voiceResults = 0;
      if (node.channels.includes("sms")) {
        const r = await defaultSmsRouter.dispatch({
          recipients: [
            { phone: doctor.phone, name: doctor.name, userId: doctor.userId },
          ],
          templateId: "critical-v2",
          content: renderedMessage,
          signature: "【G005 RIS】",
          priority: "urgent",
          metadata: { criticalId: eventId, level: node.level },
        });
        smsResults = r.filter((x) => x.success).length;
      }
      if (node.channels.includes("voice")) {
        const gw = defaultVoiceRouter.getGateways()[0];
        if (gw) {
          const r = await gw.call({
            recipients: [
              { phone: doctor.phone, name: doctor.name, userId: doctor.userId },
            ],
            text: renderedMessage,
            ivrMenuId:
              node.level >= 2 ? "ivr-cv-escalate-v1" : "ivr-cv-confirm-v1",
          });
          if (r.success) voiceResults = 1;
        }
      }
      triggered.push({
        level: node.level,
        role: node.roleLabel,
        doctor: doctor.name,
        smsResults,
        voiceResults,
      });
      // 应用到事件:升级元数据
      e.escalatedAt = new Date().toISOString();
      e.escalatedToId = doctor.userId;
      e.escalatedToName = doctor.name;
      e.escalationLevel = Math.max(e.escalationLevel, node.level);
      e.escalationReason = renderedMessage;
      e.status = "escalated";
    }
    return { chain, nodesTriggered: triggered };
  },

  /** 通过 IVR DTMF 确认接收(异步回调场景) */
  async acknowledgeByIvr(
    eventId: string,
    doctorId: string,
    doctorName: string,
  ): Promise<CriticalEvent> {
    return this.acknowledgeEvent(eventId, doctorId, doctorName);
  },

  /** 真实升级链查询 */
  async listEscalationChains(): Promise<EscalationChain[]> {
    lastSource = "demo";
    return clone(ESCALATION_CHAINS);
  },

  async updateEscalationChainNode(
    chainId: string,
    level: number,
    patch: Partial<EscalationChainNode>,
  ): Promise<EscalationChain> {
    const chain = ESCALATION_CHAINS.find((c) => c.id === chainId);
    if (!chain) throw new Error("升级链不存在");
    const node = chain.nodes.find(
      (n: EscalationChainNode) => n.level === level,
    );
    if (!node) throw new Error("节点不存在");
    Object.assign(node, patch);
    return clone(chain);
  },

  async listEscalationRules(): Promise<CriticalEscalationRule[]> {
    lastSource = "demo";
    return clone(CRITICAL_ESCALATION_RULES);
  },

  async updateEscalationRule(
    id: string,
    patch: Partial<CriticalEscalationRule>,
  ): Promise<CriticalEscalationRule> {
    const r = CRITICAL_ESCALATION_RULES.find((x) => x.id === id);
    if (!r) throw new Error("Rule not found");
    Object.assign(r, patch);
    return clone(r);
  },

  async getKPI(): Promise<CriticalKPI> {
    lastSource = "demo";
    return clone(CRITICAL_KPI);
  },

  async dualReview(
    eventId: string,
    reviewerId: string,
    reviewerName: string,
    isSecond: boolean,
  ): Promise<CriticalEvent> {
    const e = await requireLocalEvent(eventId);
    if (!e.dualReview) e.dualReview = {};
    if (!isSecond) {
      e.dualReview.firstReviewerId = reviewerId;
      e.dualReview.firstReviewerName = reviewerName;
      e.dualReview.firstReviewAt = new Date().toISOString();
    } else {
      e.dualReview.secondReviewerId = reviewerId;
      e.dualReview.secondReviewerName = reviewerName;
      e.dualReview.secondReviewAt = new Date().toISOString();
    }
    return clone(e);
  },

  async exportEvents(
    format: "excel" | "pdf",
    filter?: { status?: CriticalStatus },
  ): Promise<{ data: string; mime: string; filename: string }> {
    lastSource = "demo";
    const list = filter?.status
      ? inMemoryEvents.filter((e) => e.status === filter.status)
      : inMemoryEvents;
    return {
      data:
        format === "excel" ? JSON.stringify(list, null, 2) : "Mock PDF content",
      mime:
        format === "excel"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      filename: "critical-events." + format,
    };
  },
};

export type CriticalValueService = typeof criticalValueService;
export default criticalValueService;

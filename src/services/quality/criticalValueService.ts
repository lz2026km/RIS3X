/**
 * G005 RIS v3.0.5.1 - R3.CRITICAL 危急值服务 (API + Mock Fallback)
 * v3.0.6.6: 真实升级链 / IVR 语音 / SMS 网关集成
 *
 * v3.0.6.12-A4: 事件源改为 store.criticalEvents (unifiedCriticalValues).
 *   通过 criticalValueAdapter 转回 R3.CRITICAL.CriticalEvent 形状后克隆到 inMemoryEvents.
 *
 * v3.0.6.XX: runEscalationChain 等关键方法优先调用后端 API,失败时降级到 Mock。
 */
import {
  CRITICAL_LEVELS,
  CRITICAL_RULES,
  CRITICAL_ESCALATION_RULES,
  CRITICAL_KPI,
} from '../../data/criticalValueMock';
import { list } from '../mockBackend/store';
import { mapUnifiedToCriticalEvents } from '../../data/criticalValueAdapter';
import { ESCALATION_CHAINS } from '../../data/notificationProviders';
import { onCallResolver } from '../critical/oncall/OnCallResolver';
import type {
  CriticalRule,
  CriticalEvent,
  CriticalLevelConfig,
  CriticalKPI,
  CriticalEscalationRule,
  CriticalLevel,
  NotificationChannel,
  CriticalStatus,
} from '../../types/R3/R3.CRITICAL';
import type { EscalationChain, EscalationChainNode } from '../../types/notification';
import { defaultSmsRouter } from '../notification/SmsGateway';
import { defaultVoiceRouter } from '../notification/VoiceGateway';

const LATENCY_MIN = 200;
const LATENCY_MAX = 1500;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;
const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryEvents: CriticalEvent[] = mapUnifiedToCriticalEvents(list<any>('criticalEvents'));
const inMemoryRules: CriticalRule[] = clone(CRITICAL_RULES);

import { criticalApi } from '../api/criticalApi';

async function apiWithFallback<T>(apiCall: () => Promise<{ success: boolean; data?: T }>, mockFallback: () => Promise<T>): Promise<T> {
  try {
    const res = await apiCall()
    if (res.success && res.data !== undefined && res.data !== null) return res.data
  } catch {
    // fallback to mock
  }
  return mockFallback()
}

export const criticalValueService = {
  async listLevels(): Promise<CriticalLevelConfig[]> {
    await wait();
    return clone(CRITICAL_LEVELS);
  },

  async getLevel(level: CriticalLevel): Promise<CriticalLevelConfig | null> {
    await wait();
    return clone(CRITICAL_LEVELS.find((l) => l.level === level) ?? null);
  },

  async listRules(filter?: { category?: string; modality?: string; isActive?: boolean }): Promise<CriticalRule[]> {
    await wait();
    let list = inMemoryRules.slice();
    if (filter?.category) list = list.filter((r) => r.category === filter.category);
    if (filter?.modality) list = list.filter((r) => r.modality.includes(filter.modality!));
    if (filter?.isActive !== undefined) list = list.filter((r) => r.isActive === filter.isActive);
    return list;
  },

  async getRule(id: string): Promise<CriticalRule | null> {
    await wait();
    return clone(inMemoryRules.find((r) => r.id === id) ?? null);
  },

  async updateRule(id: string, patch: Partial<CriticalRule>): Promise<CriticalRule> {
    await wait();
    const r = inMemoryRules.find((x) => x.id === id);
    if (!r) throw new Error('Rule not found');
    Object.assign(r, patch, { updatedAt: new Date().toISOString() });
    return clone(r);
  },

  async toggleRule(id: string, isActive: boolean): Promise<CriticalRule> {
    await wait();
    return this.updateRule(id, { isActive });
  },

  async listEvents(filter?: { status?: CriticalStatus; level?: CriticalLevel; dateFrom?: string; dateTo?: string }): Promise<CriticalEvent[]> {
    await wait();
    let list = inMemoryEvents.slice();
    if (filter?.status) list = list.filter((e) => e.status === filter.status);
    if (filter?.level) list = list.filter((e) => e.level === filter.level);
    return list;
  },

  async getEvent(id: string): Promise<CriticalEvent | null> {
    await wait();
    return clone(inMemoryEvents.find((e) => e.id === id) ?? null);
  },

  async reportEvent(event: Omit<CriticalEvent, 'id' | 'reportedAt' | 'status' | 'channels' | 'sop' | 'auditChain' | 'hash' | 'escalationLevel'>): Promise<CriticalEvent> {
    await wait(800);
    const e: CriticalEvent = {
      ...event,
      id: 'ce-' + Date.now(),
      reportedAt: new Date().toISOString(),
      status: 'pending',
      channels: [],
      sop: [
        { step: 1, title: '发现危急值', description: '影像检查发现危急值征象', action: '立即记录', deadlineMinutes: 1 },
        { step: 2, title: '复核确认', description: '上级医生复核危急值', action: '双人复核', deadlineMinutes: 5 },
        { step: 3, title: '通知临床', description: '电话/短信通知主管医生', action: '多渠道通知', deadlineMinutes: 10 },
        { step: 4, title: '记录确认', description: '记录接收医生与时间', action: '记录系统', deadlineMinutes: 10 },
        { step: 5, title: '持续追踪', description: '追踪临床处理情况', action: '持续追踪', deadlineMinutes: 30 },
        { step: 6, title: '闭环归档', description: '归档危急值处理记录', action: '闭环归档', deadlineMinutes: 60 },
      ],
      auditChain: [],
      hash: 'cv-' + Date.now(),
      escalationLevel: 0,
    };
    inMemoryEvents.unshift(e);
    return clone(e);
  },

  async notifyEvent(eventId: string, channels: NotificationChannel[], recipientId: string, recipientName: string): Promise<CriticalEvent> {
    await wait();
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error('Event not found');
    e.receivingDoctorId = recipientId;
    e.receivingDoctorName = recipientName;
    e.receivingTime = new Date().toISOString();
    e.channels = [...e.channels, ...channels];
    e.status = 'notified';
    for (const ch of channels) {
      e.channelAttempts.push({ channel: ch, attemptedAt: new Date().toISOString(), success: true, recipientId });
    }
    return clone(e);
  },

  async acknowledgeEvent(eventId: string, userId: string, userName: string): Promise<CriticalEvent> {
    await wait();
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error('Event not found');
    e.acknowledgedById = userId;
    e.acknowledgedByName = userName;
    e.acknowledgedTime = new Date().toISOString();
    e.responseTimeMinutes = Math.round((Date.now() - new Date(e.reportedAt).getTime()) / 60000);
    e.onTimeNotification = (e.responseTimeMinutes ?? 0) <= 10;
    e.status = 'acknowledged';
    return clone(e);
  },

  async resolveEvent(eventId: string): Promise<CriticalEvent> {
    await wait();
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error('Event not found');
    e.resolvedTime = new Date().toISOString();
    e.status = 'resolved';
    return clone(e);
  },

  async escalateEvent(eventId: string, toId: string, toName: string, reason: string): Promise<CriticalEvent> {
    await wait(500);
    if (!reason || reason.length < 5) throw new Error('升级原因不能少于 5 字符');
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error('Event not found');
    e.escalatedAt = new Date().toISOString();
    e.escalatedToId = toId;
    e.escalatedToName = toName;
    e.escalationReason = reason;
    e.escalationLevel += 1;
    e.status = 'escalated';
    return clone(e);
  },

  /** 升级链:优先调用后端 API,不可用时降级到 Mock */
  async runEscalationChain(eventId: string): Promise<{ chain: EscalationChain; nodesTriggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> }> {
    return apiWithFallback(
      async () => criticalApi.runEscalationChain(eventId),
      async () => this._mockRunEscalationChain(eventId),
    )
  },

  /** Mock 实现的升级链(保留原逻辑作为 fallback) */
  async _mockRunEscalationChain(eventId: string): Promise<{ chain: EscalationChain; nodesTriggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> }> {
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error('Event not found');
    const chain = ESCALATION_CHAINS.find((c) => c.criticalLevel === e.level && c.enabled);
    if (!chain) {
      throw new Error('未找到匹配升级链');
    }
    const resolved = onCallResolver.resolveEscalationChain(e.level);
    const triggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> = [];
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
        (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        node.messageTemplate,
      );
      let smsResults = 0;
      let voiceResults = 0;
      if (node.channels.includes('sms')) {
        const r = await defaultSmsRouter.dispatch({
          recipients: [{ phone: doctor.phone, name: doctor.name, userId: doctor.userId }],
          templateId: 'critical-v2',
          content: renderedMessage,
          signature: '【G005 RIS】',
          priority: 'urgent',
          metadata: { criticalId: eventId, level: node.level },
        });
        smsResults = r.filter((x) => x.success).length;
      }
      if (node.channels.includes('voice')) {
        const gw = defaultVoiceRouter.getGateways()[0];
        if (gw) {
          const r = await gw.call({
            recipients: [{ phone: doctor.phone, name: doctor.name, userId: doctor.userId }],
            text: renderedMessage,
            ivrMenuId: node.level >= 2 ? 'ivr-cv-escalate-v1' : 'ivr-cv-confirm-v1',
          });
          if (r.success) voiceResults = 1;
        }
      }
      triggered.push({ level: node.level, role: node.roleLabel, doctor: doctor.name, smsResults, voiceResults });
      // 应用到事件:升级元数据
      e.escalatedAt = new Date().toISOString();
      e.escalatedToId = doctor.userId;
      e.escalatedToName = doctor.name;
      e.escalationLevel = Math.max(e.escalationLevel, node.level);
      e.escalationReason = renderedMessage;
      e.status = 'escalated';
    }
    return { chain, nodesTriggered: triggered };
  },

  /** 通过 IVR DTMF 确认接收(异步回调场景) */
  async acknowledgeByIvr(eventId: string, doctorId: string, doctorName: string): Promise<CriticalEvent> {
    await wait(200);
    return this.acknowledgeEvent(eventId, doctorId, doctorName);
  },

  /** 真实升级链查询 */
  async listEscalationChains(): Promise<EscalationChain[]> {
    await wait();
    return clone(ESCALATION_CHAINS);
  },

  async updateEscalationChainNode(chainId: string, level: number, patch: Partial<EscalationChainNode>): Promise<EscalationChain> {
    await wait();
    const chain = ESCALATION_CHAINS.find((c) => c.id === chainId);
    if (!chain) throw new Error('升级链不存在');
    const node = chain.nodes.find((n) => n.level === level);
    if (!node) throw new Error('节点不存在');
    Object.assign(node, patch);
    return clone(chain);
  },

  async listEscalationRules(): Promise<CriticalEscalationRule[]> {
    await wait();
    return clone(CRITICAL_ESCALATION_RULES);
  },

  async updateEscalationRule(id: string, patch: Partial<CriticalEscalationRule>): Promise<CriticalEscalationRule> {
    await wait();
    const r = CRITICAL_ESCALATION_RULES.find((x) => x.id === id);
    if (!r) throw new Error('Rule not found');
    Object.assign(r, patch);
    return clone(r);
  },

  async getKPI(): Promise<CriticalKPI> {
    await wait();
    return clone(CRITICAL_KPI);
  },

  async dualReview(eventId: string, reviewerId: string, reviewerName: string, isSecond: boolean): Promise<CriticalEvent> {
    await wait();
    const e = inMemoryEvents.find((x) => x.id === eventId);
    if (!e) throw new Error('Event not found');
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

  async exportEvents(format: 'excel' | 'pdf', filter?: { status?: CriticalStatus }): Promise<{ data: string; mime: string; filename: string }> {
    await wait(1500);
    const list = filter?.status ? inMemoryEvents.filter((e) => e.status === filter.status) : inMemoryEvents;
    return {
      data: format === 'excel' ? JSON.stringify(list, null, 2) : 'Mock PDF content',
      mime: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      filename: 'critical-events.' + format,
    };
  },
};

export type CriticalValueService = typeof criticalValueService;
export default criticalValueService;

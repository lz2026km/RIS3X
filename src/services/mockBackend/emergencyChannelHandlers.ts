// [G005 Wave3A P2] 急诊通道管理 MSW handlers
//   API = /api/v1/emergency-channel  → backend modules/emergency-channel
//   GET/PUT config · GET records · POST trigger (内存 + 种子)
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + "/api/v1"; } catch { return "http://localhost/api/v1"; }
})();

const API = `${API_BASE}/emergency-channel`;

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

type ChannelType = 'sms' | 'phone' | 'in-app' | 'wechat' | 'email' | 'pager';

interface ChannelItem {
  type: ChannelType; label: string; enabled: boolean; priority: number; targetRole: string;
}

interface TriggerRecord {
  id: string;
  patientId: string;
  patientName?: string;
  type: string;
  reason: string;
  channels: ChannelType[];
  triggeredBy: string;
  triggeredAt: string;
  status: 'sent' | 'acknowledged' | 'completed';
  notifications: { channel: ChannelType; targetRole: string; deliveredAt: string; simulated: boolean }[];
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  sms: '短信', phone: '电话', 'in-app': '应用内', wechat: '微信', email: '邮件', pager: '呼叫器',
};

const TARGET_ROLES: Record<string, string> = {
  'critical-finding': '值班主任医师',
  'stat-imaging': '急诊影像二线',
  'icu-request': 'ICU 值班医师',
  'er-request': '急诊科值班医师',
  manual: '终核医师',
};

let config: { channels: ChannelItem[]; autoTrigger: { enabled: boolean; keywords: string[] }; updatedAt?: string } = {
  channels: [
    { type: 'sms', label: '短信', enabled: true, priority: 3, targetRole: '值班医师' },
    { type: 'phone', label: '电话', enabled: true, priority: 1, targetRole: '值班主任医师' },
    { type: 'in-app', label: '应用内', enabled: true, priority: 2, targetRole: '终核医师' },
    { type: 'wechat', label: '微信', enabled: true, priority: 4, targetRole: '急诊科值班医师' },
    { type: 'email', label: '邮件', enabled: false, priority: 5, targetRole: '科主任' },
    { type: 'pager', label: '呼叫器', enabled: false, priority: 6, targetRole: '总值班' },
  ],
  autoTrigger: { enabled: true, keywords: ['主动脉夹层', '急性脑梗死', '张力性气胸', '肝破裂', '肺栓塞'] },
};

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString();

let records: TriggerRecord[] = [
  {
    id: 'EMR-20260813-001', patientId: 'RAD-P003', patientName: '李明', type: 'critical-finding',
    reason: 'CTA 显示主动脉增宽伴内膜片, 疑似主动脉夹层', channels: ['phone', 'in-app', 'sms'],
    triggeredBy: '张明远', triggeredAt: iso(45), status: 'acknowledged',
    notifications: [
      { channel: 'phone', targetRole: '值班主任医师', deliveredAt: iso(44), simulated: true },
      { channel: 'in-app', targetRole: '终核医师', deliveredAt: iso(44), simulated: true },
      { channel: 'sms', targetRole: '值班医师', deliveredAt: iso(43), simulated: true },
    ],
  },
  {
    id: 'EMR-20260813-002', patientId: 'RAD-P001', patientName: '张伟', type: 'stat-imaging',
    reason: 'DWI 显示左侧大脑中动脉供血区大面积高信号', channels: ['phone', 'wechat'],
    triggeredBy: '吴芳', triggeredAt: iso(120), status: 'sent',
    notifications: [
      { channel: 'phone', targetRole: '急诊影像二线', deliveredAt: iso(119), simulated: true },
      { channel: 'wechat', targetRole: '急诊科值班医师', deliveredAt: iso(118), simulated: true },
    ],
  },
  {
    id: 'EMR-20260813-003', patientId: 'RAD-P007', patientName: '周婷', type: 'er-request',
    reason: '急诊科请求优先出片: 疑似肠梗阻伴穿孔', channels: ['in-app'],
    triggeredBy: '系统(自动触发)', triggeredAt: iso(300), status: 'completed',
    notifications: [{ channel: 'in-app', targetRole: '终核医师', deliveredAt: iso(299), simulated: true }],
  },
];

export const emergencyChannelHandlers = [
  http.get(`${API}/config`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: JSON.parse(JSON.stringify(config)) });
  }),

  http.put(`${API}/config`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== 'object') {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请求体不能为空' } }, { status: 400 });
    }
    if (body.channels !== undefined) {
      if (!Array.isArray(body.channels) || body.channels.length === 0) {
        return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'channels 不能为空数组' } }, { status: 400 });
      }
      const seen = new Set<string>();
      const channels: ChannelItem[] = body.channels.map((c: any) => {
        const type = String(c?.type ?? '');
        if (!CHANNEL_LABELS[type as ChannelType] || seen.has(type)) {
          return null;
        }
        seen.add(type);
        return {
          type: type as ChannelType,
          label: CHANNEL_LABELS[type as ChannelType],
          enabled: Boolean(c.enabled),
          priority: Number(c.priority) || 1,
          targetRole: String(c.targetRole || '值班医师'),
        };
      });
      if (channels.some((c) => c === null)) {
        return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '非法或重复通道类型' } }, { status: 400 });
      }
      config.channels = channels as ChannelItem[];
    }
    if (body.autoTrigger !== undefined && body.autoTrigger !== null) {
      config.autoTrigger = {
        enabled: Boolean(body.autoTrigger.enabled),
        keywords: Array.isArray(body.autoTrigger.keywords) ? body.autoTrigger.keywords.map(String).slice(0, 50) : [],
      };
    }
    config.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: JSON.parse(JSON.stringify(config)) });
  }),

  http.get(`${API}/records`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const status = url.searchParams.get('status');
    let items = records;
    if (patientId) items = items.filter((r) => r.patientId === patientId);
    if (status) items = items.filter((r) => r.status === status);
    const sorted = [...items].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
    return HttpResponse.json({ success: true, data: sorted, meta: { total: sorted.length } });
  }),

  http.post(`${API}/trigger`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !String(body.patientId ?? '').trim()) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'patientId 必填' } }, { status: 400 });
    }
    if (String(body.reason ?? '').trim().length < 5) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reason 至少 5 个字符' } }, { status: 400 });
    }
    const enabled = config.channels.filter((c) => c.enabled).sort((a, b) => a.priority - b.priority);
    if (enabled.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '所有通知通道均已停用, 无法触发' } }, { status: 400 });
    }
    const type = String(body.type || 'manual');
    const autoTriggered = config.autoTrigger.enabled && config.autoTrigger.keywords.some((k) => body.reason.includes(k));
    const now = new Date().toISOString();
    const record: TriggerRecord = {
      id: `EMR-${Date.now()}`,
      patientId: body.patientId,
      patientName: body.patientName,
      type,
      reason: body.reason,
      channels: enabled.map((c) => c.type),
      triggeredBy: body.triggeredBy || (autoTriggered ? '系统(自动触发)' : '当前用户'),
      triggeredAt: now,
      status: 'sent',
      notifications: enabled.map((c) => ({
        channel: c.type,
        targetRole: autoTriggered ? TARGET_ROLES[type] ?? c.targetRole : c.targetRole,
        deliveredAt: now,
        simulated: true,
      })),
    };
    records.unshift(record);
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  http.post(`${API}/records/:id/acknowledge`, async ({ params }) => {
    await delay(delayMs());
    const hit = records.find((r) => r.id === params.id);
    if (!hit) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `记录 ${params.id} 不存在` } }, { status: 404 });
    }
    hit.status = 'acknowledged';
    return HttpResponse.json({ success: true, data: hit });
  }),
];

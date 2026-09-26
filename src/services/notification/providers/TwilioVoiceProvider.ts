/**
 * G005 RIS v3.0.6.6 - Twilio Programmable Voice Provider 适配 (Mock)
 * 支持 IVR + DTMF 接收
 */

import type { VoicePayload, VoiceStatus, SendResult } from '../../../types/notification';
import { IVR_MENUS } from '../../../data/notificationProviders';

interface TwilioVoiceConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  twimlBin?: string;
}

interface CallSession {
  providerCallId: string;
  phone: string;
  startedAt: string;
  status: VoiceStatus['status'];
  dtmfs?: string[];
  recordingUrl?: string;
  durationSec?: number;
}

export class TwilioVoiceProvider {
  readonly providerId = 'voice-twilio';
  private cfg: TwilioVoiceConfig;
  private calls: Map<string, CallSession> = new Map();

  constructor(cfg: Partial<TwilioVoiceConfig> = {}) {
    this.cfg = {
      accountSid: cfg.accountSid ?? 'ACmock0000000000000000000000000000',
      authToken: cfg.authToken ?? '***',
      fromNumber: cfg.fromNumber ?? '+15005550006',
      twimlBin: cfg.twimlBin ?? 'https://voice.twilio.com/v1/mock-twiml',
    };
  }

  /** 发起呼叫 */
  async placeCall(payload: VoicePayload): Promise<SendResult> {
    if (payload.recipients.length === 0) {
      return {
        success: false,
        errorCode: 'NO_RECIPIENT',
        errorMessage: '无被叫号码',
        timestamp: new Date().toISOString(),
      };
    }
    await new Promise((r) => setTimeout(r, 150));
    const phone = payload.recipients[0]!.phone;
    const providerCallId = `tw-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    this.calls.set(providerCallId, {
      providerCallId,
      phone,
      startedAt: new Date().toISOString(),
      status: 'initiated',
    });
    // 模拟接通(80% 概率)
    setTimeout(() => {
      const cs = this.calls.get(providerCallId);
      if (!cs) return;
      if (Math.random() > 0.2) {
        cs.status = 'answered';
        // 模拟 DTMF 输入
        if (payload.expectedDtmfs && payload.expectedDtmfs.length > 0) {
          cs.dtmfs = [payload.expectedDtmfs[0]!];
          cs.status = 'dtmf-collected';
        }
        cs.recordingUrl = `https://api.twilio.com/recordings/RE${providerCallId}.mp3`;
        cs.durationSec = 25 + Math.floor(Math.random() * 90);
      } else {
        cs.status = 'no-answer';
      }
    }, 1500);
    return {
      success: true,
      providerMessageId: providerCallId,
      cost: 0.85,
      durationMs: 150,
      timestamp: new Date().toISOString(),
      raw: { CallSid: providerCallId, From: this.cfg.fromNumber, To: phone },
    };
  }

  /** 查询呼叫状态 */
  async queryCall(providerCallId: string): Promise<VoiceStatus> {
    await new Promise((r) => setTimeout(r, 50));
    const cs = this.calls.get(providerCallId);
    if (!cs) {
      return {
        providerCallId,
        phone: '',
        status: 'failed',
      };
    }
    return {
      providerCallId,
      phone: cs.phone,
      status: cs.status,
      answeredAt: cs.status === 'answered' || cs.status === 'dtmf-collected' ? cs.startedAt : undefined,
      endedAt: cs.durationSec ? new Date(new Date(cs.startedAt).getTime() + cs.durationSec * 1000).toISOString() : undefined,
      durationSec: cs.durationSec,
      recordingUrl: cs.recordingUrl,
      dtmfDigits: cs.dtmfs,
      cost: 0.85,
    };
  }

  /** 通过 TwiML Bin 触发 IVR */
  buildTwiml(ivrMenuId: string, vars: Record<string, string> = {}): string {
    const menu = IVR_MENUS.find((m) => m.id === ivrMenuId);
    if (!menu) {
      return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>IVR 菜单不存在</Say></Response>';
    }
    const greeting = Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), v),
      menu.greeting,
    );
    const gather = menu.items
      .map((it: { action: string; digit: string }) => `<Press id="${it.action}">${it.digit}</Press>`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="zh-CN">${greeting}</Say>
  <Gather numDigits="1" timeout="${menu.timeoutSec ?? 10}" action="/twilio/ivr/${ivrMenuId}/callback">
    ${gather}
  </Gather>
  <Say>未收到按键,挂断</Say>
</Response>`;
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 80));
    return { healthy: true, latencyMs: Date.now() - start };
  }

  getConfig(): TwilioVoiceConfig {
    return this.cfg;
  }

  listCalls(): CallSession[] {
    return Array.from(this.calls.values());
  }
}
/**
 * G005 RIS v3.0.6.6 - 语音通知网关 (Mock)
 * 多渠道电话呼叫(Twilio / 讯飞听见 / 阿里云语音)
 */

import type { VoicePayload, VoiceStatus, SendResult } from '../../types/notification';
import { VOICE_PROVIDERS } from '../../data/notificationProviders';
import { IVR_MENUS } from '../../data/notificationProviders';
import { TwilioVoiceProvider } from './providers/TwilioVoiceProvider';
import type { NotificationProviderConfig } from '../../types/notification';

export interface IVoiceGateway {
  readonly providerId: string;
  call(payload: VoicePayload): Promise<SendResult>;
  queryCall(providerCallId: string): Promise<VoiceStatus>;
  playIvr(ivrMenuId: string, phone: string, vars: Record<string, string>): Promise<SendResult>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}

/** Mock 基类,除 Twilio 之外其他通道用同一基类 */
export class MockVoiceGateway implements IVoiceGateway {
  readonly providerId: string;
  private config: NotificationProviderConfig;
  private calls: Map<string, VoiceStatus> = new Map();

  constructor(config: NotificationProviderConfig) {
    this.providerId = config.id;
    this.config = config;
  }

  async call(payload: VoicePayload): Promise<SendResult> {
    if (payload.recipients.length === 0) {
      return {
        success: false,
        errorCode: 'NO_RECIPIENT',
        errorMessage: '无被叫号码',
        timestamp: new Date().toISOString(),
      };
    }
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 150));
    const phone = payload.recipients[0]!.phone;
    const providerCallId = `${this.providerId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const status: VoiceStatus = {
      providerCallId,
      phone,
      status: 'initiated',
      cost: this.config.pricing?.voicePerMin ?? 0.5,
    };
    this.calls.set(providerCallId, status);
    // 模拟接通
    setTimeout(() => {
      const cs = this.calls.get(providerCallId);
      if (!cs) return;
      if (Math.random() > 0.2) {
        cs.status = payload.expectedDtmfs?.length ? 'dtmf-collected' : 'answered';
        cs.durationSec = 20 + Math.floor(Math.random() * 60);
        cs.dtmfDigits = payload.expectedDtmfs?.slice(0, 1);
        cs.recordingUrl = `mock://${this.providerId}/${providerCallId}.wav`;
      } else {
        cs.status = 'no-answer';
      }
    }, 1200);
    return {
      success: true,
      providerMessageId: providerCallId,
      cost: status.cost,
      durationMs: 150,
      timestamp: new Date().toISOString(),
    };
  }

  async queryCall(providerCallId: string): Promise<VoiceStatus> {
    await new Promise((r) => setTimeout(r, 40));
    return (
      this.calls.get(providerCallId) ?? {
        providerCallId,
        phone: '',
        status: 'failed',
      }
    );
  }

  async playIvr(ivrMenuId: string, phone: string, _vars: Record<string, string>): Promise<SendResult> {
    const menu = IVR_MENUS.find((m) => m.id === ivrMenuId);
    if (!menu) {
      return {
        success: false,
        errorCode: 'IVR_NOT_FOUND',
        errorMessage: `未找到 IVR 菜单 ${ivrMenuId}`,
        timestamp: new Date().toISOString(),
      };
    }
    return this.call({
      recipients: [{ phone }],
      ivrMenuId,
      text: menu.greeting,
      expectedDtmfs: [],
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 50));
    return { healthy: this.config.health === 'healthy', latencyMs: Date.now() - start };
  }
}

/** 语音网关路由器 */
export class VoiceGatewayRouter {
  private providers: NotificationProviderConfig[];

  constructor(providers: NotificationProviderConfig[] = VOICE_PROVIDERS.filter((p) => p.kind === 'voice')) {
    this.providers = providers.filter((p) => p.enabled);
  }

  pick(prefer: 'cost' | 'priority' | 'ivrtts' = 'priority'): NotificationProviderConfig | null {
    if (this.providers.length === 0) return null;
    const sorted = this.providers.slice().sort((a, b) => {
      if (prefer === 'cost') {
        return (a.pricing?.voicePerMin ?? 99) - (b.pricing?.voicePerMin ?? 99);
      }
      return (a.priority ?? 99) - (b.priority ?? 99);
    });
    return sorted[0]!;
  }

  getGateways(): IVoiceGateway[] {
    return this.providers.map((p) => {
      if (p.vendor === 'twilio') {
        const t = new TwilioVoiceProvider();
        return t as unknown as IVoiceGateway;
      }
      return new MockVoiceGateway(p);
    });
  }
}

/** 默认单例路由 */
export const defaultVoiceRouter = new VoiceGatewayRouter();
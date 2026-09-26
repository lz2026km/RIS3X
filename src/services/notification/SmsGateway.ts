/**
 * G005 RIS v3.0.6.6 - SMS 短信网关统一接口 (Mock)
 * 阿里云/腾讯云/院内 EMQX 多通道适配
 */

import type {
  SmsPayload,
  SmsRecipient,
  SmsStatus,
  SendResult,
} from '../../types/notification';
import { SMS_PROVIDERS } from '../../data/notificationProviders';
import type { NotificationProviderConfig } from '../../types/notification';

/** 短信网关抽象接口 */
export interface ISmsGateway {
  /** 渠道 ID */
  readonly providerId: string;
  /** 单条发送(优先使用模板) */
  send(payload: SmsPayload): Promise<SendResult>;
  /** 批量 */
  sendBatch(payload: SmsPayload): Promise<SendResult[]>;
  /** 查询发送状态 */
  queryStatus(providerMessageId: string): Promise<SmsStatus>;
  /** 健康度 */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}

/** 路由器:根据健康度/优先级/价格选择合适通道 */
export class SmsGatewayRouter {
  private providers: NotificationProviderConfig[];

  constructor(providers: NotificationProviderConfig[] = SMS_PROVIDERS.filter((p) => p.kind === 'sms')) {
    this.providers = providers.filter((p) => p.enabled);
  }

  pick(prefer: 'cost' | 'priority' | 'health' = 'health'): NotificationProviderConfig | null {
    if (this.providers.length === 0) return null;
    const candidates = this.providers.filter((p) => p.health !== 'offline');
    if (candidates.length === 0) return this.providers[0]!;
    if (prefer === 'priority') {
      return candidates.slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0]!;
    }
    if (prefer === 'cost') {
      return candidates.slice().sort((a, b) => (a.pricing?.smsDomestic ?? 99) - (b.pricing?.smsDomestic ?? 99))[0]!;
    }
    const healthyFirst = candidates.filter((p) => p.health === 'healthy');
    return (healthyFirst[0] ?? candidates[0])!;
  }

  /** 拆批发送(每批最多 N 条) */
  async dispatch(payload: SmsPayload, options: { prefer?: 'cost' | 'priority' | 'health'; perProviderLimit?: number } = {}): Promise<SendResult[]> {
    const limit = options.perProviderLimit ?? 100;
    const results: SendResult[] = [];
    for (let i = 0; i < payload.recipients.length; i += limit) {
      const chunk = (payload.recipients as SmsRecipient[]).slice(i, i + limit);
      const provider = this.pick(options.prefer ?? 'health');
      if (!provider) {
        results.push(...chunk.map<SendResult>(() => ({
          success: false,
          errorCode: 'NO_PROVIDER',
          errorMessage: '无可用 SMS 通道',
          timestamp: new Date().toISOString(),
        })));
        continue;
      }
      // 模拟分发
      for (const _r of chunk) {
        results.push({
          success: true,
          providerMessageId: `${provider.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          cost: provider.pricing?.smsDomestic ?? 0.04,
          durationMs: 80 + Math.floor(Math.random() * 200),
          timestamp: new Date().toISOString(),
        });
      }
    }
    return results;
  }

  getProviders(): NotificationProviderConfig[] {
    return this.providers;
  }
}

/** Mock 单通道短信网关基类 */
export class MockSmsGateway implements ISmsGateway {
  readonly providerId: string;
  private config: NotificationProviderConfig;
  private sentStore = new Map<string, SmsStatus>();

  constructor(config: NotificationProviderConfig) {
    this.providerId = config.id;
    this.config = config;
  }

  async send(payload: SmsPayload): Promise<SendResult> {
    await this.latency();
    const success = Math.random() > 0.02; // 2% 模拟失败
    const providerMessageId = `${this.providerId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    if (success) {
      payload.recipients.forEach((r: SmsRecipient) => {
        this.sentStore.set(`${providerMessageId}-${r.phone}`, {
          providerMessageId,
          phone: r.phone,
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
          cost: this.config.pricing?.smsDomestic ?? 0.04,
        });
      });
      return {
        success: true,
        providerMessageId,
        cost: this.config.pricing?.smsDomestic ?? 0.04,
        durationMs: 120,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: false,
      providerMessageId,
      errorCode: 'PROVIDER_TIMEOUT',
      errorMessage: '短信网关超时',
      timestamp: new Date().toISOString(),
    };
  }

  async sendBatch(payload: SmsPayload): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const r of payload.recipients) {
      results.push(await this.send({ ...payload, recipients: [r] }));
    }
    return results;
  }

  async queryStatus(providerMessageId: string): Promise<SmsStatus> {
    await this.latency(50);
    for (const v of this.sentStore.values()) {
      if (v.providerMessageId === providerMessageId) return v;
    }
    return {
      providerMessageId,
      phone: '',
      status: 'failed',
      failureReason: 'NOT_FOUND',
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    await this.latency(30);
    return { healthy: this.config.health === 'healthy', latencyMs: Date.now() - start };
  }

  private latency(ms = 80): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/** 工厂:从 SMS_PROVIDERS 构建全部 Mock 网关 */
export function buildSmsGateways(): ISmsGateway[] {
  return SMS_PROVIDERS.filter((p) => p.enabled).map((p) => new MockSmsGateway(p));
}

/** 默认路由(单例) */
export const defaultSmsRouter = new SmsGatewayRouter();
// [G005 W13-Security] HSM 服务: 管理多个密钥提供者 + 密钥轮换。
// 默认使用 SoftwareKeyProvider (真实 RSA/SM2 运算); 另注册 MockHsmProvider 供演示/故障演练。
// DB-less-safe: 全部键与轮换历史在内存中维护。
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  KeyAlgorithm,
  KeyProvider,
  ManagedKey,
  MockHsmProvider,
  SignResult,
  SoftwareKeyProvider,
} from './key-provider'

export interface RotationEvent {
  id: string
  provider: string
  algorithm: KeyAlgorithm
  fromKeyId: string | null
  toKeyId: string
  at: string
  reason: string
}

@Injectable()
export class HsmService {
  private readonly logger = new Logger(HsmService.name)
  private readonly providers = new Map<string, KeyProvider>()
  private readonly rotations: RotationEvent[] = []
  private seq = 0

  constructor() {
    const software = new SoftwareKeyProvider()
    const mock = new MockHsmProvider()
    this.providers.set(software.name, software)
    this.providers.set(mock.name, mock)
    // 初始化默认 CA 签名密钥
    software.generate('RSA-2048', 'ca-signing')
    mock.generate('RSA-2048', 'ca-signing')
    this.logger.log(`HsmService: ${this.providers.size} providers initialized`)
  }

  private resolve(provider?: string): KeyProvider {
    const name = provider ?? process.env['HSM_PROVIDER'] ?? 'software-kms'
    const p = this.providers.get(name)
    if (!p) throw new NotFoundException(`HSM provider ${name} 不存在`)
    return p
  }

  listProviders(): Array<{ name: string; kind: string; keyCount: number; activeKeyId: string | null }> {
    return Array.from(this.providers.values()).map((p) => ({
      name: p.name,
      kind: p.kind,
      keyCount: p.getKeys().length,
      activeKeyId: p.getActive()?.keyId ?? null,
    }))
  }

  listKeys(provider?: string): ManagedKey[] {
    return this.resolve(provider).getKeys()
  }

  activeKey(provider?: string): ManagedKey {
    const key = this.resolve(provider).getActive()
    if (!key) throw new NotFoundException('当前无 active 密钥')
    return key
  }

  /** 密钥轮换: 生成同算法新密钥, 旧密钥置 retired, 记录轮换事件 */
  rotate(input: { provider?: string; algorithm?: KeyAlgorithm; label?: string; reason?: string } = {}): { key: ManagedKey; event: RotationEvent } {
    const provider = this.resolve(input.provider)
    const prev = provider.getActive()
    const algorithm = input.algorithm ?? prev?.algorithm ?? 'RSA-2048'
    const label = input.label ?? prev?.label ?? 'ca-signing'
    const key = provider.generate(algorithm, label)
    const event: RotationEvent = {
      id: `rot-${(++this.seq).toString().padStart(4, '0')}`,
      provider: provider.name,
      algorithm,
      fromKeyId: prev?.keyId ?? null,
      toKeyId: key.keyId,
      at: key.createdAt,
      reason: input.reason?.trim() || 'scheduled-rotation',
    }
    this.rotations.unshift(event)
    this.logger.log(`HSM key rotated: ${event.fromKeyId} -> ${event.toKeyId} (${algorithm})`)
    return { key, event }
  }

  listRotations(): RotationEvent[] {
    return this.rotations.map((r) => ({ ...r }))
  }

  sign(data: string, provider?: string, keyId?: string): SignResult {
    const p = this.resolve(provider)
    const target = keyId ?? p.getActive()?.keyId
    if (!target) throw new BadRequestException('无可用密钥, 请先轮换生成')
    return p.sign(target, data)
  }

  verify(data: string, signature: string, keyId: string, provider?: string): boolean {
    return this.resolve(provider).verify(keyId, data, signature)
  }

  getKey(keyId: string, provider?: string): ManagedKey {
    const key = this.resolve(provider).getKeys().find((k) => k.keyId === keyId)
    if (!key) throw new NotFoundException(`密钥 ${keyId} 不存在`)
    return key
  }
}

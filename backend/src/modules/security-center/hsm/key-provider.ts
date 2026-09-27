// [G005 W13-Security] HSM / 密钥提供者抽象层。
// 提供统一接口 (生成/签名/验签/轮换), 含两种实现:
//   - SoftwareKeyProvider: 基于 node:crypto (RSA) + 纯 JS SM2, 真实密码学运算。
//   - MockHsmProvider: 确定性伪 HSM (无真实密钥), 用于演示/单元测试。
// 生产可替换为 PKCS#11 / 云 KMS 实现, 调用方无需改动。
import { createSign, createVerify, generateKeyPairSync } from 'node:crypto'
import { SM2_DEMO_PRIVATE_KEY, getPublicKey, sm2Sign, sm2Verify } from '../sm-crypto/sm2'
import { sm3Hex } from '../../report-sign-v2/report-sm3'

export type KeyAlgorithm = 'RSA-2048' | 'RSA-3072' | 'SM2'
export type KeyStatus = 'active' | 'retired' | 'compromised'

export interface ManagedKey {
  keyId: string
  label: string
  algorithm: KeyAlgorithm
  provider: string
  version: number
  status: KeyStatus
  publicKey: string
  createdAt: string
  retiredAt?: string
  note?: string
}

export interface SignResult {
  signature: string
  algorithm: string
  keyId: string
}

export interface KeyProvider {
  readonly name: string
  readonly kind: 'software' | 'hsm' | 'mock'
  generate(algorithm: KeyAlgorithm, label: string): ManagedKey
  sign(keyId: string, data: string): SignResult
  verify(keyId: string, data: string, signature: string): boolean
  getKeys(): ManagedKey[]
  getActive(): ManagedKey | null
  rotate(label?: string): ManagedKey
}

let globalSeq = 0
function nextKeyId(provider: string, algorithm: KeyAlgorithm): string {
  globalSeq += 1
  return `${provider}-${algorithm.toLowerCase().replace(/[^a-z0-9]/g, '')}-${globalSeq.toString().padStart(4, '0')}`
}

export class SoftwareKeyProvider implements KeyProvider {
  readonly name = 'software-kms'
  readonly kind = 'software' as const
  private readonly keys: ManagedKey[] = []
  private readonly privateKeys = new Map<string, string>()
  private version = 0

  generate(algorithm: KeyAlgorithm, label: string): ManagedKey {
    this.version += 1
    const keyId = nextKeyId('sw', algorithm)
    let publicKey: string
    if (algorithm === 'SM2') {
      const priv = sm3Hex(`G005-HSM-SM2:${label}:${this.version}:${keyId}`)
      this.privateKeys.set(keyId, priv)
      const pub = getPublicKey(priv)
      publicKey = '04' + pub.x.toString(16).padStart(64, '0') + pub.y.toString(16).padStart(64, '0')
    } else {
      const bits = algorithm === 'RSA-3072' ? 3072 : 2048
      const { privateKey, publicKey: pub } = generateKeyPairSync('rsa', {
        modulusLength: bits,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      this.privateKeys.set(keyId, privateKey)
      publicKey = pub
    }
    this.retireActive()
    const key: ManagedKey = {
      keyId,
      label,
      algorithm,
      provider: this.name,
      version: this.version,
      status: 'active',
      publicKey,
      createdAt: new Date().toISOString(),
    }
    this.keys.unshift(key)
    return { ...key }
  }

  private retireActive(): void {
    const now = new Date().toISOString()
    for (const k of this.keys) {
      if (k.status === 'active') {
        k.status = 'retired'
        k.retiredAt = now
      }
    }
  }

  sign(keyId: string, data: string): SignResult {
    const key = this.keys.find((k) => k.keyId === keyId)
    const priv = this.privateKeys.get(keyId)
    if (!key || !priv) throw new Error(`HSM: key ${keyId} not found`)
    if (key.algorithm === 'SM2') {
      const sig = sm2Sign(data, priv)
      return { signature: `${sig.r}${sig.s}`, algorithm: 'SM2-SM3', keyId }
    }
    const signature = createSign('RSA-SHA256').update(data).sign(priv, 'base64')
    return { signature, algorithm: 'RSA-SHA256', keyId }
  }

  verify(keyId: string, data: string, signature: string): boolean {
    const key = this.keys.find((k) => k.keyId === keyId)
    if (!key) return false
    if (key.algorithm === 'SM2') {
      const r = signature.slice(0, 64)
      const s = signature.slice(64, 128)
      return sm2Verify(data, { r, s }, key.publicKey)
    }
    try {
      return createVerify('RSA-SHA256').update(data).verify(key.publicKey, signature, 'base64')
    } catch {
      return false
    }
  }

  getKeys(): ManagedKey[] {
    return this.keys.map((k) => ({ ...k }))
  }

  getActive(): ManagedKey | null {
    const active = this.keys.find((k) => k.status === 'active')
    return active ? { ...active } : null
  }

  rotate(label = 'ca-signing'): ManagedKey {
    const active = this.getActive()
    const algorithm = active?.algorithm ?? 'RSA-2048'
    return this.generate(algorithm, label)
  }
}

export class MockHsmProvider implements KeyProvider {
  readonly name = 'mock-hsm'
  readonly kind = 'mock' as const
  private readonly keys: ManagedKey[] = []
  private version = 0
  failMode = false

  generate(algorithm: KeyAlgorithm, label: string): ManagedKey {
    this.version += 1
    const keyId = nextKeyId('mock', algorithm)
    for (const k of this.keys) if (k.status === 'active') { k.status = 'retired'; k.retiredAt = new Date().toISOString() }
    const key: ManagedKey = {
      keyId,
      label,
      algorithm,
      provider: this.name,
      version: this.version,
      status: 'active',
      publicKey: 'mock:' + sm3Hex(`${keyId}:${label}`),
      createdAt: new Date().toISOString(),
    }
    this.keys.unshift(key)
    return { ...key }
  }

  private pseudoSignature(keyId: string, data: string): string {
    return 'mock-' + sm3Hex(`${keyId}:${data}`)
  }

  sign(keyId: string, data: string): SignResult {
    if (this.failMode) throw new Error('MockHsmProvider: simulated HSM failure')
    if (!this.keys.some((k) => k.keyId === keyId)) throw new Error(`HSM: key ${keyId} not found`)
    return { signature: this.pseudoSignature(keyId, data), algorithm: 'MOCK', keyId }
  }

  verify(keyId: string, data: string, signature: string): boolean {
    return signature === this.pseudoSignature(keyId, data)
  }

  getKeys(): ManagedKey[] {
    return this.keys.map((k) => ({ ...k }))
  }

  getActive(): ManagedKey | null {
    const active = this.keys.find((k) => k.status === 'active')
    return active ? { ...active } : null
  }

  rotate(label = 'ca-signing'): ManagedKey {
    return this.generate(this.getActive()?.algorithm ?? 'RSA-2048', label)
  }
}

/** SM2 演示私钥引用 (供调试), 不用于生产 */
export const SM2_PROVIDER_DEMO_KEY = SM2_DEMO_PRIVATE_KEY

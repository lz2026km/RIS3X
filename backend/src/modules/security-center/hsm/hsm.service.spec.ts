// [G005 W13-Security] HSM 服务 spec: 提供者/签名验签/密钥轮换
import { HsmService } from './hsm.service'

describe('[W13] HsmService', () => {
  let hsm: HsmService
  beforeEach(() => {
    hsm = new HsmService()
  })

  it('注册 software + mock 两个提供者, 默认 RSA-2048 活动密钥', () => {
    const providers = hsm.listProviders()
    expect(providers.map((p) => p.name)).toEqual(expect.arrayContaining(['software-kms', 'mock-hsm']))
    expect(hsm.activeKey().algorithm).toBe('RSA-2048')
  })

  it('RSA 签名/验签往返; 篡改后验签失败', () => {
    const key = hsm.activeKey()
    const sig = hsm.sign('报告内容-A', undefined, key.keyId)
    expect(sig.algorithm).toBe('RSA-SHA256')
    expect(hsm.verify('报告内容-A', sig.signature, key.keyId)).toBe(true)
    expect(hsm.verify('报告内容-B', sig.signature, key.keyId)).toBe(false)
  })

  it('密钥轮换: 旧密钥 retired, 新密钥 active, 记录轮换事件', () => {
    const before = hsm.activeKey()
    const { key, event } = hsm.rotate({ reason: 'manual' })
    expect(key.keyId).not.toBe(before.keyId)
    expect(event.fromKeyId).toBe(before.keyId)
    expect(event.reason).toBe('manual')
    expect(hsm.getKey(before.keyId).status).toBe('retired')
    expect(hsm.activeKey().keyId).toBe(key.keyId)
    expect(hsm.listRotations()[0]!.toKeyId).toBe(key.keyId)
  })

  it('SM2 轮换后可签名验签', () => {
    const { key } = hsm.rotate({ algorithm: 'SM2', label: 'gm-signing' })
    const sig = hsm.sign('国密数据', undefined, key.keyId)
    expect(sig.algorithm).toBe('SM2-SM3')
    expect(hsm.verify('国密数据', sig.signature, key.keyId)).toBe(true)
  })

  it('mock 提供者确定性签名; 未知密钥报错', () => {
    const sig = hsm.sign('x', 'mock-hsm')
    expect(sig.signature.startsWith('mock-')).toBe(true)
    expect(hsm.verify('x', sig.signature, sig.keyId, 'mock-hsm')).toBe(true)
    expect(() => hsm.getKey('nope')).toThrow()
  })
})

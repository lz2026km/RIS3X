// [G005 W13-Security] 字段级加密 spec: AES-256-GCM / SM4-CBC 往返 + 篡改 + 脱敏
import { FieldEncryptionService } from './field-encryption.service'

describe('[W13] FieldEncryptionService', () => {
  let svc: FieldEncryptionService
  beforeEach(() => {
    svc = new FieldEncryptionService()
  })

  it('算法信息: AES-256-GCM 默认, 支持 SM4-CBC', () => {
    const info = svc.algorithmInfo()
    expect(info.default).toBe('AES-256-GCM')
    expect(info.supported).toContain('SM4-CBC')
    expect(svc.isEnabled()).toBe(true)
  })

  it('AES-256-GCM 加解密往返', () => {
    const ct = svc.encrypt('110101196803120011')
    expect(ct.startsWith('v1.aesgcm.')).toBe(true)
    expect(svc.isEncrypted(ct)).toBe(true)
    expect(svc.decrypt(ct)).toBe('110101196803120011')
  })

  it('SM4-CBC 加解密往返', () => {
    const ct = svc.encrypt('青霉素过敏', 'SM4-CBC')
    expect(ct.startsWith('v1.sm4.')).toBe(true)
    expect(svc.decrypt(ct)).toBe('青霉素过敏')
  })

  it('篡改密文 → 解密抛错 (GCM 认证失败)', () => {
    const ct = svc.encrypt('secret')
    const parts = ct.split('.')
    parts[4] = parts[4]!.slice(0, -2) + 'A0'
    expect(() => svc.decrypt(parts.join('.'))).toThrow()
  })

  it('脱敏: 身份证/手机号/过敏史/姓名', () => {
    expect(svc.mask('110101196803120011', 'idCard')).toBe('110101********0011')
    expect(svc.mask('13800001001', 'phone')).toBe('138****1001')
    expect(svc.mask('青霉素过敏', 'allergy')).toBe('青***敏')
    expect(svc.mask('张三', 'name')).toBe('张*')
  })

  it('encryptFields / decryptFields 原地处理指定字段 (幂等)', () => {
    const entity = { idCard: '110101196803120011', phone: '13800001001', name: '张三' }
    const enc = svc.encryptFields(entity, ['idCard', 'phone'])
    expect(svc.isEncrypted(enc.idCard)).toBe(true)
    expect(enc.name).toBe('张三')
    const again = svc.encryptFields(enc, ['idCard', 'phone'])
    expect(again.idCard).toBe(enc.idCard)
    const dec = svc.decryptFields(enc, ['idCard', 'phone'])
    expect(dec.idCard).toBe('110101196803120011')
    expect(dec.phone).toBe('13800001001')
  })

  it('selfTest 三个样本全部解密匹配', () => {
    const r = svc.selfTest()
    expect(r.samples).toHaveLength(3)
    expect(r.samples.every((s) => s.decryptedMatches)).toBe(true)
    expect(r.samples.find((s) => s.field === 'idCard')!.plainMasked).toBe('110101********0011')
  })
})

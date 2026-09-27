// [G005 W13-Security] 国密算法 spec: SM3 标准向量 / SM4 标准向量 + CBC 往返 / SM2 签名验签
import { sm3Hex } from '../../report-sign-v2/report-sm3'
import {
  SM2_DEMO_PRIVATE_KEY,
  SM2_DEMO_PUBLIC_KEY,
  computeE,
  getPublicKey,
  sm2Sign,
  sm2Verify,
} from './sm2'
import {
  sm4CbcDecrypt,
  sm4CbcEncrypt,
  sm4EcbDecryptBlock,
  sm4EcbEncryptBlock,
  sm4Utils,
} from './sm4'

describe('[W13] 国密算法 (SM2 / SM3 / SM4)', () => {
  it('SM3 标准向量', () => {
    expect(sm3Hex('abc')).toBe('66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0')
  })

  it('SM4-ECB 标准向量', () => {
    const key = '0123456789abcdeffedcba9876543210'
    const plain = '0123456789abcdeffedcba9876543210'
    const enc = sm4EcbEncryptBlock(key, plain)
    expect(enc).toBe('681edf34d206965e86b3e94f536e4246')
    expect(sm4EcbDecryptBlock(key, enc)).toBe(plain)
  })

  it('SM4-CBC 加解密往返 + 随机 IV', () => {
    const key = '0123456789abcdeffedcba9876543210'
    const msg = new TextEncoder().encode('患者身份证 110101196803120011 过敏史 青霉素')
    const iv = sm4Utils.hexToBytes('000102030405060708090a0b0c0d0e0f')
    const payload = sm4CbcEncrypt(key, msg, iv)
    expect(sm4Utils.bytesToHex(payload.subarray(0, 16))).toBe('000102030405060708090a0b0c0d0e0f')
    const back = sm4CbcDecrypt(key, payload)
    expect(new TextDecoder().decode(back)).toBe('患者身份证 110101196803120011 过敏史 青霉素')
  })

  it('SM2 演示公钥格式 + 签名验签往返', () => {
    expect(SM2_DEMO_PUBLIC_KEY).toMatch(/^04[0-9a-f]{128}$/)
    const sig = sm2Sign('报告内容-真实SM2签名', SM2_DEMO_PRIVATE_KEY)
    expect(sig.r).toMatch(/^[0-9a-f]{64}$/)
    expect(sig.s).toMatch(/^[0-9a-f]{64}$/)
    expect(sm2Verify('报告内容-真实SM2签名', sig, SM2_DEMO_PUBLIC_KEY)).toBe(true)
  })

  it('SM2 确定性: 同输入同签名', () => {
    const a = sm2Sign('same-message', SM2_DEMO_PRIVATE_KEY)
    const b = sm2Sign('same-message', SM2_DEMO_PRIVATE_KEY)
    expect(a).toEqual(b)
  })

  it('SM2 篡改检测: 改消息/改签名/换公钥均失败', () => {
    const sig = sm2Sign('original', SM2_DEMO_PRIVATE_KEY)
    expect(sm2Verify('tampered', sig, SM2_DEMO_PUBLIC_KEY)).toBe(false)
    const bad = { r: sig.r, s: (BigInt('0x' + sig.s) ^ 1n).toString(16).padStart(64, '0') }
    expect(sm2Verify('original', bad, SM2_DEMO_PUBLIC_KEY)).toBe(false)
    const other = getPublicKey(sm3Hex('other-key'))
    const otherHex = '04' + other.x.toString(16).padStart(64, '0') + other.y.toString(16).padStart(64, '0')
    expect(sm2Verify('original', sig, otherHex)).toBe(false)
  })

  it('SM2 e 摘要随用户 ID 变化', () => {
    const pub = getPublicKey(SM2_DEMO_PRIVATE_KEY)
    expect(computeE('m', pub, '1234567812345678')).not.toBe(computeE('m', pub, 'USER-A'))
  })
})

// [G005 W13-Security] 纯 JS SM2 非对称签名/验签实现 (GM/T 0003-2012), 无新增依赖。
// 曲线 sm2p256v1 (推荐曲线), 摘要使用 SM3 (report-sign-v2/report-sm3.ts)。
// 说明: 这是一个真实可用的 SM2 实现 (BigInt 大数运算), 非生产 HSM/常量时间实现;
// 用于国产算法分支的签名验签, 与 HSM 抽象层配合。
// 演示私钥由固定种子派生 (可复现), 非生产机密。
import { sm3Hex } from '../../report-sign-v2/report-sm3'

// ── 曲线参数 (sm2p256v1) ──
const P = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF')
const A = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC')
const B = BigInt('0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93')
const N = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123')
const GX = BigInt('0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7')
const GY = BigInt('0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0')
const G: Point = { x: GX, y: GY }

export interface Point {
  x: bigint
  y: bigint
}

export interface Sm2Signature {
  r: string
  s: string
}

function mod(a: bigint, m: bigint): bigint {
  const r = a % m
  return r >= 0n ? r : r + m
}

/** 模逆 (扩展欧几里得) */
function inv(a: bigint, m: bigint): bigint {
  let [old_r, r] = [mod(a, m), m]
  let [old_s, s] = [1n, 0n]
  while (r !== 0n) {
    const q = old_r / r
    ;[old_r, r] = [r, old_r - q * r]
    ;[old_s, s] = [s, old_s - q * s]
  }
  return mod(old_s, m)
}

function pointDouble(p: Point): Point | null {
  if (p.y === 0n) return null
  const m = mod(3n * p.x * p.x + A, P) * inv(mod(2n * p.y, P), P) % P
  const x = mod(m * m - 2n * p.x, P)
  const y = mod(m * (p.x - x) - p.y, P)
  return { x, y }
}

function pointAdd(p: Point | null, q: Point | null): Point | null {
  if (!p) return q
  if (!q) return p
  if (p.x === q.x) {
    if (mod(p.y + q.y, P) === 0n) return null
    return pointDouble(p)
  }
  const m = mod(q.y - p.y, P) * inv(mod(q.x - p.x, P), P) % P
  const x = mod(m * m - p.x - q.x, P)
  const y = mod(m * (p.x - x) - p.y, P)
  return { x, y }
}

/** 标量乘 k·P */
function scalarMul(k: bigint, p: Point | null): Point | null {
  let result: Point | null = null
  let addend: Point | null = p
  let n = mod(k, N)
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, addend)
    addend = addend ? pointDouble(addend) : null
    n >>= 1n
  }
  return result
}

function bigToBytes(v: bigint, len = 32): Uint8Array {
  const out = new Uint8Array(len)
  let x = v
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(x & 0xffn)
    x >>= 8n
  }
  return out
}

function bytesToBig(bytes: Uint8Array): bigint {
  let v = 0n
  for (const b of bytes) v = (v << 8n) | BigInt(b)
  return v
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** 计算 ZA = SM3(ENTL || ID || a || b || Gx || Gy || Px || Py) */
export function computeZa(publicKey: Point, userId = '1234567812345678'): string {
  const idBytes = new TextEncoder().encode(userId)
  const entl = new Uint8Array([(idBytes.length >> 8) & 0xff, idBytes.length & 0xff])
  const z = concatBytes(
    entl,
    idBytes,
    bigToBytes(A),
    bigToBytes(B),
    bigToBytes(GX),
    bigToBytes(GY),
    bigToBytes(publicKey.x),
    bigToBytes(publicKey.y),
  )
  return sm3Hex(z)
}

/** 消息摘要 e = SM3(ZA || M) */
export function computeE(message: string | Uint8Array, publicKey: Point, userId = '1234567812345678'): bigint {
  const za = hexToBytes(computeZa(publicKey, userId))
  const msg = typeof message === 'string' ? new TextEncoder().encode(message) : message
  const digest = sm3Hex(concatBytes(za, msg))
  return BigInt('0x' + digest)
}

/** 由私钥 (hex) 推导公钥 */
export function getPublicKey(privateKeyHex: string): Point {
  const d = BigInt('0x' + (privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex))
  const pub = scalarMul(d, G)
  if (!pub) throw new Error('SM2: invalid private key')
  return pub
}

export function publicKeyHex(pub: Point): { x: string; y: string } {
  return { x: bigToBytes(pub.x).reduce((s, b) => s + b.toString(16).padStart(2, '0'), ''), y: bigToBytes(pub.y).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '') }
}

/** 确定性 k (由私钥 + e 派生, 保证同输入同签名, 便于测试/复现) */
function deterministicK(d: bigint, e: bigint): bigint {
  const h = sm3Hex(concatBytes(bigToBytes(d), bigToBytes(e)))
  const k = mod(BigInt('0x' + h), N - 1n) + 1n
  return k
}

/** SM2 签名 (确定性 k; 生产应使用密码学安全随机数) */
export function sm2Sign(message: string | Uint8Array, privateKeyHex: string, userId = '1234567812345678'): Sm2Signature {
  const d = BigInt('0x' + (privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex))
  const pub = getPublicKey(privateKeyHex)
  const e = computeE(message, pub, userId)
  for (let attempt = 0; attempt < 16; attempt++) {
    const k = attempt === 0 ? deterministicK(d, e) : mod(deterministicK(d, e) + BigInt(attempt), N - 1n) + 1n
    const p1 = scalarMul(k, G)
    if (!p1) continue
    const r = mod(e + p1.x, N)
    if (r === 0n || mod(r + k, N) === 0n) continue
    const s = mod(inv(mod(1n + d, N), N) * mod(k - r * d, N), N)
    if (s === 0n) continue
    return { r: bytesToHex(bigToBytes(r)), s: bytesToHex(bigToBytes(s)) }
  }
  throw new Error('SM2: sign failed (retry exhausted)')
}

/** SM2 验签 */
export function sm2Verify(message: string | Uint8Array, signature: Sm2Signature, publicKeyHexStr: string, userId = '1234567812345678'): boolean {
  const clean = publicKeyHexStr.replace(/^04/, '')
  if (clean.length < 128) return false
  const pub: Point = { x: BigInt('0x' + clean.slice(0, 64)), y: BigInt('0x' + clean.slice(64, 128)) }
  const r = BigInt('0x' + signature.r)
  const s = BigInt('0x' + signature.s)
  if (r < 1n || r > N - 1n || s < 1n || s > N - 1n) return false
  const e = computeE(message, pub, userId)
  const t = mod(r + s, N)
  if (t === 0n) return false
  const p = pointAdd(scalarMul(s, G), scalarMul(t, pub))
  if (!p) return false
  return mod(e + p.x, N) === r
}

/** 演示 SM2 私钥 (固定种子派生, 32 字节 hex, 非生产机密) */
export const SM2_DEMO_PRIVATE_KEY = sm3Hex('G005-RIS-SM2-DEMO-PRIVATE-KEY-v1')

/** 演示 SM2 公钥 (04||X||Y, hex) */
export const SM2_DEMO_PUBLIC_KEY = (() => {
  const p = publicKeyHex(getPublicKey(SM2_DEMO_PRIVATE_KEY))
  return '04' + p.x + p.y
})()

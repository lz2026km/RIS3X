// [G005 W8-Report] 纯 JS SM3 哈希实现 (GM/T 0004-2012), 无新增依赖。
// 用于国产算法分支: 当证书算法为 SM3 时对规范化报告内容求摘要。
// 已验证标准向量: SM3('abc') = 66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0

const IV = [0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e]

function rotl(x: number, n: number): number {
  const m = n & 31
  if (m === 0) return x >>> 0
  return ((x << m) | (x >>> (32 - m))) >>> 0
}

function p0(x: number): number {
  return (x ^ rotl(x, 9) ^ rotl(x, 17)) >>> 0
}

function p1(x: number): number {
  return (x ^ rotl(x, 15) ^ rotl(x, 23)) >>> 0
}

function ff(x: number, y: number, z: number, j: number): number {
  return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (x & z) | (y & z)) >>> 0
}

function gg(x: number, y: number, z: number, j: number): number {
  return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (~x & z)) >>> 0
}

function add(...xs: number[]): number {
  let s = 0
  for (const x of xs) s = (s + (x >>> 0)) >>> 0
  return s
}

function compress(v: number[], block: Uint8Array): void {
  const w = new Array<number>(68)
  for (let i = 0; i < 16; i++) {
    w[i] = ((block[i * 4]! << 24) | (block[i * 4 + 1]! << 16) | (block[i * 4 + 2]! << 8) | block[i * 4 + 3]!) >>> 0
  }
  for (let j = 16; j < 68; j++) {
    w[j] = (p1((w[j - 16]! ^ w[j - 9]! ^ rotl(w[j - 3]!, 15)) >>> 0) ^ rotl(w[j - 13]!, 7) ^ w[j - 6]!) >>> 0
  }
  const w1 = new Array<number>(64)
  for (let j = 0; j < 64; j++) w1[j] = (w[j]! ^ w[j + 4]!) >>> 0

  let [a, b, c, d, e, f, g, h] = v as [number, number, number, number, number, number, number, number]
  for (let j = 0; j < 64; j++) {
    const t = j < 16 ? 0x79cc4519 : 0x7a879d8a
    const ss1 = rotl(add(rotl(a, 12), e, rotl(t, j & 31)), 7)
    const ss2 = (ss1 ^ rotl(a, 12)) >>> 0
    const tt1 = add(ff(a, b, c, j), d, ss2, w1[j]!)
    const tt2 = add(gg(e, f, g, j), h, ss1, w[j]!)
    d = c
    c = rotl(b, 9)
    b = a
    a = tt1
    h = g
    g = rotl(f, 19)
    f = e
    e = p0(tt2)
  }
  v[0] = (v[0]! ^ a) >>> 0
  v[1] = (v[1]! ^ b) >>> 0
  v[2] = (v[2]! ^ c) >>> 0
  v[3] = (v[3]! ^ d) >>> 0
  v[4] = (v[4]! ^ e) >>> 0
  v[5] = (v[5]! ^ f) >>> 0
  v[6] = (v[6]! ^ g) >>> 0
  v[7] = (v[7]! ^ h) >>> 0
}

/** SM3 摘要 (hex, 64 字符) */
export function sm3Hex(input: string | Uint8Array): string {
  const msg = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const len = msg.length
  const bitLen = len * 8
  // padding: 1 bit + zeros + 64-bit big-endian length
  const padLen = ((len % 64) < 56 ? 56 - (len % 64) : 120 - (len % 64))
  const total = len + padLen + 8
  const buf = new Uint8Array(total)
  buf.set(msg, 0)
  buf[len] = 0x80
  // 64-bit length (JS 字符串长度安全范围内高 32 位为 0)
  const hi = Math.floor(bitLen / 0x100000000)
  const lo = bitLen >>> 0
  buf[total - 8] = (hi >>> 24) & 0xff
  buf[total - 7] = (hi >>> 16) & 0xff
  buf[total - 6] = (hi >>> 8) & 0xff
  buf[total - 5] = hi & 0xff
  buf[total - 4] = (lo >>> 24) & 0xff
  buf[total - 3] = (lo >>> 16) & 0xff
  buf[total - 2] = (lo >>> 8) & 0xff
  buf[total - 1] = lo & 0xff

  const v = [...IV]
  for (let off = 0; off < total; off += 64) {
    compress(v, buf.subarray(off, off + 64))
  }
  return v.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

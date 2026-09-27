// [G005 W13-Security] 纯 JS SM4 对称加密实现 (GB/T 32907-2016), 无新增依赖。
// 支持 ECB 与 CBC (PKCS#7 填充) 两种模式; 用于敏感字段的国产算法加密分支。
// 已验证标准向量: SM4-ECB(key=0123...3210, plain=0123...3210) = 681edf34d206965e86b3e94f536e4246

const SBOX = new Uint8Array([
  0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28, 0xfb, 0x2c, 0x05,
  0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
  0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98, 0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62,
  0xe4, 0xb3, 0x1c, 0xa9, 0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6,
  0x47, 0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85, 0x4f, 0xa8,
  0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f, 0x4b, 0x70, 0x56, 0x9d, 0x35,
  0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2, 0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87,
  0xd4, 0x00, 0x46, 0x57, 0x9f, 0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e,
  0xea, 0xbf, 0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15, 0xa1,
  0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30, 0xf5, 0x8c, 0xb1, 0xe3,
  0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0, 0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f,
  0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd, 0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51,
  0x8d, 0x1b, 0xaf, 0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
  0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8, 0xe5, 0xb4, 0xb0,
  0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9, 0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84,
  0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d, 0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48,
])

const FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc]
const CK = new Uint32Array([
  0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269, 0x70777e85, 0x8c939aa1, 0xa8afb6bd, 0xc4cbd2d9,
  0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249, 0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9,
  0xc0c7ced5, 0xdce3eaf1, 0xf8ff060d, 0x141b2229, 0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
  0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209, 0x10171e25, 0x2c333a41, 0x484f565d, 0x646b7279,
])

function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0
}

function tau(a: number): number {
  return (
    ((SBOX[(a >>> 24) & 0xff]! << 24) |
      (SBOX[(a >>> 16) & 0xff]! << 16) |
      (SBOX[(a >>> 8) & 0xff]! << 8) |
      SBOX[a & 0xff]!) >>>
    0
  )
}

function tTransform(b: number): number {
  const s = tau(b)
  return (s ^ rotl(s, 2) ^ rotl(s, 10) ^ rotl(s, 18) ^ rotl(s, 24)) >>> 0
}

function tPrime(b: number): number {
  const s = tau(b)
  return (s ^ rotl(s, 13) ^ rotl(s, 23)) >>> 0
}

function expandKey(key: Uint8Array): Uint32Array {
  const mk = new Uint32Array(4)
  for (let i = 0; i < 4; i++) {
    mk[i] = ((key[i * 4]! << 24) | (key[i * 4 + 1]! << 16) | (key[i * 4 + 2]! << 8) | key[i * 4 + 3]!) >>> 0
  }
  const k = new Uint32Array(36)
  for (let i = 0; i < 4; i++) k[i] = (mk[i]! ^ FK[i]!) >>> 0
  const rk = new Uint32Array(32)
  for (let i = 0; i < 32; i++) {
    k[i + 4] = (k[i]! ^ tPrime((k[i + 1]! ^ k[i + 2]! ^ k[i + 3]! ^ CK[i]!) >>> 0)) >>> 0
    rk[i] = k[i + 4]!
  }
  return rk
}

function cryptBlock(block: Uint8Array, rk: Uint32Array): Uint8Array {
  const x = new Uint32Array(36)
  for (let i = 0; i < 4; i++) {
    x[i] = ((block[i * 4]! << 24) | (block[i * 4 + 1]! << 16) | (block[i * 4 + 2]! << 8) | block[i * 4 + 3]!) >>> 0
  }
  for (let i = 0; i < 32; i++) {
    x[i + 4] = (x[i]! ^ tTransform((x[i + 1]! ^ x[i + 2]! ^ x[i + 3]! ^ rk[i]!) >>> 0)) >>> 0
  }
  const out = new Uint8Array(16)
  const words = [x[35]!, x[34]!, x[33]!, x[32]!]
  for (let i = 0; i < 4; i++) {
    out[i * 4] = (words[i]! >>> 24) & 0xff
    out[i * 4 + 1] = (words[i]! >>> 16) & 0xff
    out[i * 4 + 2] = (words[i]! >>> 8) & 0xff
    out[i * 4 + 3] = words[i]! & 0xff
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

/** SM4-ECB 单块加密 (16 字节输入) → 16 字节 hex */
export function sm4EcbEncryptBlock(keyHex: string, plainHex: string): string {
  const key = hexToBytes(keyHex)
  if (key.length !== 16) throw new Error('SM4: key must be 16 bytes')
  const rk = expandKey(key)
  return bytesToHex(cryptBlock(hexToBytes(plainHex), rk))
}

/** SM4-ECB 单块解密 (16 字节输入) → 16 字节 hex */
export function sm4EcbDecryptBlock(keyHex: string, cipherHex: string): string {
  const key = hexToBytes(keyHex)
  if (key.length !== 16) throw new Error('SM4: key must be 16 bytes')
  // 解密 = 逆序轮密钥
  const rk = expandKey(key)
  const rev = new Uint32Array(32)
  for (let i = 0; i < 32; i++) rev[i] = rk[31 - i]!
  return bytesToHex(cryptBlock(hexToBytes(cipherHex), rev))
}

function pkcs7Pad(data: Uint8Array): Uint8Array {
  const pad = 16 - (data.length % 16)
  const out = new Uint8Array(data.length + pad)
  out.set(data, 0)
  out.fill(pad, data.length)
  return out
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  const pad = data[data.length - 1]!
  if (pad < 1 || pad > 16 || pad > data.length) throw new Error('SM4: invalid padding')
  return data.subarray(0, data.length - pad)
}

/** SM4-CBC 加密; iv 缺省时使用固定演示 IV (生产应随机) → base64(iv||cipher) */
export function sm4CbcEncrypt(keyHex: string, plain: Uint8Array, iv?: Uint8Array): Uint8Array {
  const key = hexToBytes(keyHex)
  if (key.length !== 16) throw new Error('SM4: key must be 16 bytes')
  const rk = expandKey(key)
  const ivBytes = iv && iv.length === 16 ? iv : new Uint8Array(16)
  const padded = pkcs7Pad(plain)
  const out = new Uint8Array(16 + padded.length)
  out.set(ivBytes, 0)
  let prev = ivBytes
  for (let off = 0; off < padded.length; off += 16) {
    const block = new Uint8Array(16)
    for (let i = 0; i < 16; i++) block[i] = padded[off + i]! ^ prev[i]!
    const enc = cryptBlock(block, rk)
    out.set(enc, 16 + off)
    prev = enc
  }
  return out
}

/** SM4-CBC 解密; 输入为 iv||cipher */
export function sm4CbcDecrypt(keyHex: string, payload: Uint8Array): Uint8Array {
  const key = hexToBytes(keyHex)
  if (key.length !== 16) throw new Error('SM4: key must be 16 bytes')
  if (payload.length < 32 || payload.length % 16 !== 0) throw new Error('SM4: invalid ciphertext length')
  const rk = expandKey(key)
  const rev = new Uint32Array(32)
  for (let i = 0; i < 32; i++) rev[i] = rk[31 - i]!
  const iv = payload.subarray(0, 16)
  const body = payload.subarray(16)
  const out = new Uint8Array(body.length)
  let prev: Uint8Array = iv
  for (let off = 0; off < body.length; off += 16) {
    const dec = cryptBlock(body.subarray(off, off + 16), rev)
    for (let i = 0; i < 16; i++) out[off + i] = dec[i]! ^ prev[i]!
    prev = body.subarray(off, off + 16)
  }
  return pkcs7Unpad(out)
}

export const sm4Utils = { hexToBytes, bytesToHex }

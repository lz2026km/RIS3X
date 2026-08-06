/**
 * G005 RIS v3.0.6.11-72 - SEC2 路径穿越防护共享工具
 * 所有拼接文件系统路径/存储 key 前必须先经过本模块校验。
 */
import * as path from 'node:path'

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafePathError'
  }
}

function rootPrefix(rootResolved: string): string {
  return rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep
}

/**
 * 校验 p 是 root 内的相对路径。
 * 拒绝: 绝对路径、NUL 字节、任何 resolve 后逃出 root 的路径。
 * 返回归一化为 '/' 分隔的相对路径，可安全用于 path.join / 存储 key。
 * @throws UnsafePathError
 */
export function assertSafeRelativePath(root: string, p: string): string {
  if (!p || typeof p !== 'string' || p.includes('\0')) {
    throw new UnsafePathError(`Invalid path: ${p}`)
  }
  if (path.isAbsolute(p)) {
    throw new UnsafePathError(`Absolute path not allowed: ${p}`)
  }
  const rootResolved = path.resolve(root)
  const resolved = path.resolve(rootResolved, p)
  const prefix = rootPrefix(rootResolved)
  if (resolved !== rootResolved && !resolved.startsWith(prefix)) {
    throw new UnsafePathError(`Path traversal detected: ${p}`)
  }
  const rel = path.relative(rootResolved, resolved)
  if (!rel || rel === '.' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new UnsafePathError(`Path traversal detected: ${p}`)
  }
  return rel.split(path.sep).join('/')
}

/** 将 name 安全拼接到 root 下，返回绝对路径。 @throws UnsafePathError */
export function safeJoin(root: string, name: string): string {
  return path.join(path.resolve(root), assertSafeRelativePath(root, name))
}

/**
 * 兼容历史数据（与 LocalStorageDriver.resolve 语义一致）：
 * 接受相对 key 与已在 root 内的绝对路径，两者都必须在 root 内，返回安全绝对路径。
 * @throws UnsafePathError
 */
export function resolveWithinRoot(root: string, p: string): string {
  if (!p || typeof p !== 'string' || p.includes('\0')) {
    throw new UnsafePathError(`Invalid path: ${p}`)
  }
  const rootResolved = path.resolve(root)
  const abs = path.isAbsolute(p) ? path.normalize(p) : path.resolve(rootResolved, p)
  const prefix = rootPrefix(rootResolved)
  if (abs !== rootResolved && !abs.startsWith(prefix)) {
    throw new UnsafePathError(`Path traversal detected: ${p}`)
  }
  return abs
}

/**
 * 拒绝含分隔符(/、\)、'..'、'.' 的单一文件名/URL id。
 * 用于将客户端传入的 id 净化成可安全拼接的文件名。
 * @throws UnsafePathError
 */
export function assertSafeBasename(name: string): string {
  if (!name || typeof name !== 'string' || name.includes('\0')) {
    throw new UnsafePathError(`Invalid name: ${name}`)
  }
  const base = path.basename(name)
  if (base !== name || base === '.' || base === '..') {
    throw new UnsafePathError(`Invalid name: ${name}`)
  }
  return base
}

/**
 * G005 RIS v3.0.6.11-60 - Local Storage Driver
 * 现有本地文件系统实现的抽象封装。root 即存储根目录(如 DICOM_STORAGE_DIR / VNA_STORAGE_DIR)。
 * 兼容历史数据: get/stat 同时接受相对 key 与已落库的绝对路径。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  StorageDriver,
  StorageListOptions,
  StorageListResult,
  StorageObjectMeta,
  StoragePutOptions,
  StorageTestResult,
} from './storage.interface'

export interface LocalStorageDriverOptions {
  root: string
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local'
  private readonly root: string

  constructor(options: LocalStorageDriverOptions | string) {
    const root = typeof options === 'string' ? options : options.root
    if (!root || typeof root !== 'string') {
      throw new Error('LocalStorageDriver requires a root directory')
    }
    this.root = path.resolve(root)
    fs.mkdirSync(this.root, { recursive: true })
  }

  getRoot(): string {
    return this.root
  }

  /**
   * 将 key 解析为绝对路径并做路径穿越防护。
   * 相对 key → root 下; 绝对路径(历史数据)→ 校验必须在 root 内。
   */
  resolve(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error(`Invalid storage key: ${key}`)
    }
    const abs = path.isAbsolute(key) ? path.normalize(key) : path.resolve(this.root, key)
    const rootPrefix = this.root.endsWith(path.sep) ? this.root : this.root + path.sep
    if (abs !== this.root && !abs.startsWith(rootPrefix)) {
      throw new Error(`Path traversal detected: ${key}`)
    }
    return abs
  }

  async put(key: string, data: Buffer, _options?: StoragePutOptions): Promise<void> {
    const target = this.resolve(key)
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, data)
  }

  async get(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolve(key))
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw err
    }
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    const prefix = options?.prefix ?? ''
    const base = this.resolve(prefix === '' ? '.' : prefix)
    const keys: StorageObjectMeta[] = []
    let isTruncated = false
    let nextContinuationToken: string | undefined

    const walk = async (dir: string, rel: string): Promise<void> => {
      let entries
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (keys.length >= (options?.maxKeys ?? 10000)) {
          isTruncated = true
          return
        }
        const full = path.join(dir, entry.name)
        const relKey = rel ? path.join(rel, entry.name) : entry.name
        const key = relKey.split(path.sep).join('/')
        if (entry.isDirectory()) {
          await walk(full, key)
        } else if (entry.isFile()) {
          try {
            const st = await fs.promises.stat(full)
            keys.push({ key, size: st.size, lastModified: st.mtime })
          } catch {
            /* skip unreadable file */
          }
        }
      }
    }

    const statBase = await fs.promises.stat(base).catch(() => null)
    if (statBase?.isDirectory()) {
      await walk(base, prefix)
    } else if (statBase?.isFile()) {
      keys.push({ key: prefix, size: statBase.size, lastModified: statBase.mtime })
    }
    if (keys.length > 0 && isTruncated) {
      nextContinuationToken = keys[keys.length - 1]!.key
    }
    return { keys, isTruncated, nextContinuationToken }
  }

  async stat(key: string): Promise<StorageObjectMeta> {
    const st = await fs.promises.stat(this.resolve(key))
    return { key, size: st.size, lastModified: st.mtime }
  }

  async testConnection(): Promise<StorageTestResult> {
    const started = Date.now()
    try {
      await fs.promises.access(this.root, fs.constants.R_OK | fs.constants.W_OK)
      return {
        ok: true,
        driver: 'local',
        detail: `本地存储就绪: ${this.root}`,
        latencyMs: Date.now() - started,
      }
    } catch (err) {
      return {
        ok: false,
        driver: 'local',
        detail: `本地存储不可用: ${(err as Error).message}`,
        latencyMs: Date.now() - started,
      }
    }
  }
}

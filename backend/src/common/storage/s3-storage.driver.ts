/**
 * G005 RIS v3.0.6.11-60 - S3 / MinIO Storage Driver
 * 不依赖 @aws-sdk/client-s3: 使用 Node 原生 http/https 实现 S3 REST API
 * (AWS Signature Version 4 签名, path-style, 与 MinIO / AWS S3 兼容)。
 * 如需注入 requester 可传入 S3Requester(用于单元测试的内存模拟)。
 */
import * as http from 'node:http'
import * as https from 'node:https'
import * as crypto from 'node:crypto'
import type {
  StorageDriver,
  StorageListOptions,
  StorageListResult,
  StorageObjectMeta,
  StoragePutOptions,
  StorageTestResult,
} from './storage.interface'

export interface S3StorageDriverOptions {
  endpoint: string
  bucket: string
  accessKey: string
  secretKey: string
  region?: string
  requester?: S3Requester
  timeoutMs?: number
}

export interface S3RequestInit {
  method: string
  url: string
  headers: Record<string, string>
  body?: Buffer
}

export interface S3Response {
  status: number
  headers: Record<string, string>
  body: Buffer
}

export type S3Requester = (req: S3RequestInit) => Promise<S3Response>

// [G005 v3.0.6.11-99 Wave 7A (G-28)] 驱动来源标注: 真实 SigV4 原生 / 内存模拟
export type S3DriverSource = 'aws-sigv4-native' | 'simulated'

export interface S3DeleteManyResult {
  deleted: string[]
  errors: Array<{ key: string; code: string }>
}

export interface S3CopyResult {
  etag?: string
  lastModified?: string
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function sha256Hex(input: Buffer | string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function hmac(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

/** XML 特殊字符转义 (批量删除 payload) */
function xmlEscape(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** RFC 3986 编码: 保留 / 不转义, 用于 S3 canonical URI/query */
function uriEncode(input: string): string {
  return input
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join('/')
}

/** MinIO / S3 响应中的 error 文本提取 */
function extractXmlTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? m[1] : undefined
}

export class S3StorageDriver implements StorageDriver {
  readonly name = 's3'
  /** [G005 v3.0.6.11-99 Wave 7A (G-28)] 驱动来源: 真实 AWS SigV4 原生 HTTP 实现 */
  readonly source: S3DriverSource = 'aws-sigv4-native'
  private readonly endpoint: URL
  private readonly bucket: string
  private readonly accessKey: string
  private readonly secretKey: string
  private readonly region: string
  private readonly requester: S3Requester
  private readonly timeoutMs: number
  private readonly basePath: string

  constructor(options: S3StorageDriverOptions) {
    if (!options.bucket) throw new Error('S3 bucket is required')
    if (!options.accessKey || !options.secretKey) {
      throw new Error('S3_ACCESS_KEY and S3_SECRET_KEY are required')
    }
    this.endpoint = new URL(options.endpoint)
    this.bucket = options.bucket
    this.accessKey = options.accessKey
    this.secretKey = options.secretKey
    this.region = options.region ?? 'us-east-1'
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.basePath = this.endpoint.pathname.replace(/\/+$/, '')
    this.requester = options.requester ?? this.defaultRequester.bind(this)
  }

  private defaultRequester(req: S3RequestInit): Promise<S3Response> {
    const url = new URL(req.url)
    const useTls = url.protocol === 'https:'
    const httpModule = useTls ? https : http
    return new Promise((resolve, reject) => {
      const r = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (useTls ? 443 : 80),
          path: url.pathname + url.search,
          method: req.method,
          headers: req.headers,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 500,
              headers: res.headers as Record<string, string>,
              body: Buffer.concat(chunks),
            })
          })
        },
      )
      r.on('error', reject)
      r.setTimeout(this.timeoutMs, () => {
        r.destroy(new Error(`S3 request timeout after ${this.timeoutMs}ms`))
      })
      if (req.body) r.write(req.body)
      r.end()
    })
  }

  private buildUrl(bucket: string, objectKey?: string, query?: Record<string, string>): string {
    const bucketPath = `/${bucket}`
    const keyPath = objectKey ? `/${objectKey.split('/').map(uriEncode).join('/')}` : ''
    const qs = query
      ? '?' +
        Object.entries(query)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
      : ''
    const base = `${this.endpoint.protocol}//${this.endpoint.host}${this.basePath}`
    return `${base}${bucketPath}${keyPath}${qs}`
  }

  /**
   * AWS Signature V4 签名 (path-style):
   * canonicalRequest = METHOD\ncanonicalUri\ncanonicalQuery\ncanonicalHeaders\nsignedHeaders\npayloadHash
   * [G005 v3.0.6.11-99 Wave 7A (G-28)] 深化: 全部 x-amz-* 头 (含 x-amz-copy-source /
   * x-amz-meta-*) + host 均参与签名, 符合 AWS 官方要求, 与 AWS SDK 行为一致。
   */
  private sign(req: S3RequestInit): void {
    const url = new URL(req.url)
    const method = req.method
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const payloadHash = req.body && req.body.length > 0 ? sha256Hex(req.body) : EMPTY_SHA256

    const hostHeader = url.host
    const headers: Record<string, string> = {
      host: hostHeader,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...req.headers,
    }

    const canonicalUri = uriEncode(url.pathname) || '/'
    const canonicalQuery = url.search
      .replace(/^\?/, '')
      .split('&')
      .filter(Boolean)
      .map((pair) => pair.split('=').map((s) => s.replace(/\+/g, '%20')))
      .sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0))
      .map(([k, v]) => `${k}=${v ?? ''}`)
      .join('&')

    const headerNames = Object.keys(headers)
      .map((h) => h.toLowerCase().trim())
      .filter((h) => h === 'host' || h.startsWith('x-amz-'))
      .sort()

    const signedHeaders = headerNames.join(';')
    const canonicalHeaders = headerNames.map((h) => `${h}:${headers[h] ?? ''}\n`).join('')

    const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n')
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n')

    const kDate = hmac(Buffer.from(`AWS4${this.secretKey}`, 'utf8'), dateStamp)
    const kRegion = hmac(kDate, this.region)
    const kService = hmac(kRegion, 's3')
    const kSigning = hmac(kService, 'aws4_request')
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

    req.headers = {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    }
  }

  private async request(objectKey: string | undefined, method: string, query?: Record<string, string>, body?: Buffer, headers: Record<string, string> = {}): Promise<S3Response> {
    return this.requestToBucket(this.bucket, objectKey, method, query, body, headers)
  }

  private async requestToBucket(bucket: string, objectKey: string | undefined, method: string, query?: Record<string, string>, body?: Buffer, headers: Record<string, string> = {}): Promise<S3Response> {
    const req: S3RequestInit = {
      method,
      url: this.buildUrl(bucket, objectKey, query),
      headers,
      body,
    }
    this.sign(req)
    return this.requester(req)
  }

  private assertOk(res: S3Response, objectKey: string, method: string): void {
    if (res.status >= 200 && res.status < 300) return
    const code = extractXmlTag(res.body.toString('utf8'), 'Code') ?? `HTTP_${res.status}`
    const message = extractXmlTag(res.body.toString('utf8'), 'Message') ?? res.body.toString('utf8').slice(0, 200)
    const err = new Error(`S3 ${method} failed for ${objectKey}: ${code} - ${message}`) as Error & { code?: string; status?: number }
    err.code = code
    err.status = res.status
    throw err
  }

  async put(key: string, data: Buffer, options?: StoragePutOptions): Promise<void> {
    const headers: Record<string, string> = {}
    const contentType = options?.contentType ?? 'application/octet-stream'
    headers['Content-Type'] = contentType
    if (options?.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        headers[`x-amz-meta-${k}`] = v
      }
    }
    const res = await this.request(key, 'PUT', undefined, data, headers)
    this.assertOk(res, key, 'PUT')
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request(key, 'GET')
    this.assertOk(res, key, 'GET')
    return res.body
  }

  async delete(key: string): Promise<void> {
    const res = await this.request(key, 'DELETE')
    this.assertOk(res, key, 'DELETE')
  }

  /**
   * [G005 v3.0.6.11-99 Wave 7A (G-28)] 批量删除对象:
   * POST /{bucket}?delete= 携带 <Delete> XML (AWS S3 原生语义, 等价 AWS SDK DeleteObjectsCommand)。
   * 解析 <Deleted> / <Error> 返回成功与失败明细。
   */
  async deleteMany(keys: string[]): Promise<S3DeleteManyResult> {
    if (!keys.length) return { deleted: [], errors: [] }
    const objectsXml = keys.map((k) => `  <Object><Key>${xmlEscape(k)}</Key></Object>`).join('\n')
    const body = Buffer.from(`<Delete>\n${objectsXml}\n</Delete>`, 'utf8')
    const res = await this.requestToBucket(this.bucket, undefined, 'POST', { delete: '' }, body, {
      'Content-Type': 'application/xml',
    })
    this.assertOk(res, '*', 'DELETE_MANY')
    const xml = res.body.toString('utf8')
    const deleted: string[] = []
    const errors: Array<{ key: string; code: string }> = []
    for (const block of xml.match(/<Deleted>[\s\S]*?<\/Deleted>/g) ?? []) {
      const key = extractXmlTag(block, 'Key')
      if (key) deleted.push(key)
    }
    for (const block of xml.match(/<Error>[\s\S]*?<\/Error>/g) ?? []) {
      const key = extractXmlTag(block, 'Key')
      if (key) errors.push({ key, code: extractXmlTag(block, 'Code') ?? 'Unknown' })
    }
    return { deleted, errors }
  }

  /**
   * [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象复制:
   * PUT /{targetBucket}/{targetKey} + x-amz-copy-source 头 (等价 AWS SDK CopyObjectCommand,
   * 支持跨桶复制 targetBucket 缺省为同桶)。
   */
  async copy(sourceKey: string, targetKey: string, targetBucket?: string): Promise<S3CopyResult> {
    const destBucket = targetBucket?.trim() || this.bucket
    const encodedSource = `/${this.bucket}/${sourceKey.split('/').map(uriEncode).join('/')}`
    const res = await this.requestToBucket(destBucket, targetKey, 'PUT', undefined, undefined, {
      'x-amz-copy-source': encodedSource,
    })
    this.assertOk(res, `${sourceKey} → ${destBucket}/${targetKey}`, 'COPY')
    const xml = res.body.toString('utf8')
    return {
      etag: extractXmlTag(xml, 'ETag'),
      lastModified: extractXmlTag(xml, 'LastModified'),
    }
  }

  async stat(key: string): Promise<StorageObjectMeta> {
    const res = await this.request(key, 'HEAD')
    this.assertOk(res, key, 'HEAD')
    const size = Number(res.headers['content-length'] ?? 0)
    const lastModified = res.headers['last-modified'] ? new Date(res.headers['last-modified']) : undefined
    return { key, size: Number.isFinite(size) ? size : 0, lastModified, etag: res.headers['etag'] }
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    const query: Record<string, string> = { 'list-type': '2' }
    if (options?.prefix) query.prefix = options.prefix
    if (options?.maxKeys !== undefined) query['max-keys'] = String(options.maxKeys)
    if (options?.continuationToken) query['continuation-token'] = options.continuationToken
    const res = await this.request(undefined, 'GET', query)
    this.assertOk(res, '/', 'LIST')
    const xml = res.body.toString('utf8')
    const keys: StorageObjectMeta[] = []
    const keyTags = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []
    for (const block of keyTags) {
      const key = extractXmlTag(block, 'Key')
      const sizeRaw = extractXmlTag(block, 'Size')
      const lastModifiedRaw = extractXmlTag(block, 'LastModified')
      if (!key) continue
      keys.push({
        key,
        size: Number(sizeRaw ?? 0),
        lastModified: lastModifiedRaw ? new Date(lastModifiedRaw) : undefined,
        etag: extractXmlTag(block, 'ETag'),
      })
    }
    return {
      keys,
      isTruncated: extractXmlTag(xml, 'IsTruncated') === 'true',
      nextContinuationToken: extractXmlTag(xml, 'NextContinuationToken'),
    }
  }

  async testConnection(): Promise<StorageTestResult> {
    const started = Date.now()
    try {
      const res = await this.request(undefined, 'GET', { 'list-type': '2', 'max-keys': '1' })
      if (res.status >= 200 && res.status < 300) {
        return {
          ok: true,
          driver: 's3',
          source: this.source,
          detail: `S3 连接成功: ${this.endpoint.host}/${this.bucket} (region=${this.region}, SigV4 原生)`,
          latencyMs: Date.now() - started,
        }
      }
      const code = extractXmlTag(res.body.toString('utf8'), 'Code') ?? `HTTP_${res.status}`
      const message = extractXmlTag(res.body.toString('utf8'), 'Message') ?? ''
      return {
        ok: false,
        driver: 's3',
        source: this.source,
        detail: `S3 连接失败: ${code}${message ? ` - ${message}` : ''} (status=${res.status})`,
        latencyMs: Date.now() - started,
      }
    } catch (err) {
      return {
        ok: false,
        driver: 's3',
        source: this.source,
        detail: `S3 连接失败: ${(err as Error).message}`,
        latencyMs: Date.now() - started,
      }
    }
  }
}

/**
 * G005 RIS v3.0.6.11-60 - Storage 抽象层测试
 * 1) LocalStorageDriver: 临时目录真实读写 (put/get/delete/list/stat + 路径穿越防护)
 * 2) S3StorageDriver: 内存模拟 HTTP requester 验证 SigV4 签名请求与解析
 * 3) StorageModule 工厂: STORAGE_DRIVER 默认 local / env=s3 时返回 S3 驱动
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { ConfigService } from '@nestjs/config'
import { LocalStorageDriver } from './local-storage.driver'
import { S3StorageDriver, type S3RequestInit, type S3Response } from './s3-storage.driver'
import { buildS3DriverOptions, s3ConfigFromEnv, STORAGE_DRIVER } from './storage.module'

describe('LocalStorageDriver', () => {
  let root: string
  let driver: LocalStorageDriver

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'g005-storage-test-'))
    driver = new LocalStorageDriver({ root })
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('put/get roundtrip with nested keys', async () => {
    await driver.put('study/1/series/2/inst.dcm', Buffer.from('DICM-bytes'))
    const data = await driver.get('study/1/series/2/inst.dcm')
    expect(data.toString()).toBe('DICM-bytes')
  })

  it('stat returns size and lastModified', async () => {
    const meta = await driver.stat('study/1/series/2/inst.dcm')
    expect(meta.size).toBe(10)
    expect(typeof (meta.lastModified as Date | undefined)?.getTime).toBe('function')
  })

  it('list returns all keys under prefix', async () => {
    await driver.put('a/1.bin', Buffer.from('x'))
    await driver.put('a/sub/2.bin', Buffer.from('yy'))
    await driver.put('b/3.bin', Buffer.from('zzz'))
    const all = await driver.list()
    expect(all.keys.map((k) => k.key).sort()).toEqual(['a/1.bin', 'a/sub/2.bin', 'b/3.bin', 'study/1/series/2/inst.dcm'])
    const prefixed = await driver.list({ prefix: 'a' })
    expect(prefixed.keys.map((k) => k.key).sort()).toEqual(['a/1.bin', 'a/sub/2.bin'])
  })

  it('list respects maxKeys truncation', async () => {
    const page = await driver.list({ maxKeys: 2 })
    expect(page.keys.length).toBeLessThanOrEqual(2)
    expect(page.isTruncated).toBe(true)
    expect(page.nextContinuationToken).toBeDefined()
  })

  it('delete removes object and get throws ENOENT', async () => {
    await driver.put('tmp/rm.bin', Buffer.from('bye'))
    await driver.delete('tmp/rm.bin')
    await expect(driver.get('tmp/rm.bin')).rejects.toThrow()
    // 删除不存在的文件不报错
    await expect(driver.delete('tmp/rm.bin')).resolves.toBeUndefined()
  })

  it('rejects path traversal', async () => {
    await expect(driver.put('../escape.bin', Buffer.from('x'))).rejects.toThrow(/traversal/i)
    await expect(driver.get('../../etc/passwd')).rejects.toThrow(/traversal/i)
  })

  it('resolves historical absolute paths inside root', async () => {
    const abs = path.join(root, 'legacy', 'old.dcm')
    await fs.promises.mkdir(path.dirname(abs), { recursive: true })
    await fs.promises.writeFile(abs, Buffer.from('legacy'))
    const data = await driver.get(abs)
    expect(data.toString()).toBe('legacy')
  })

  it('testConnection reports ok for writable root', async () => {
    const result = await driver.testConnection()
    expect(result.ok).toBe(true)
    expect(result.driver).toBe('local')
  })
})

describe('S3StorageDriver (SigV4, mocked requester)', () => {
  const makeDriver = (bucket = 'g005') => {
    const requests: S3RequestInit[] = []
    const requester = async (req: S3RequestInit): Promise<S3Response> => {
      requests.push(req)
      const url = new URL(req.url)
      if (req.method === 'PUT') return { status: 200, headers: { etag: '"abc"' }, body: Buffer.alloc(0) }
      if (req.method === 'GET' && !url.searchParams.has('list-type')) {
        return { status: 200, headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from('s3-content') }
      }
      if (req.method === 'HEAD') return { status: 200, headers: { 'content-length': '10', 'last-modified': 'Mon, 03 Aug 2026 00:00:00 GMT' }, body: Buffer.alloc(0) }
      if (req.method === 'DELETE') return { status: 204, headers: {}, body: Buffer.alloc(0) }
      if (url.searchParams.has('list-type')) {
        return {
          status: 200,
          headers: {},
          body: Buffer.from(
            '<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>' +
              '<Contents><Key>study/1.dcm</Key><Size>42</Size><ETag>"e1"</ETag></Contents>' +
              '<Contents><Key>study/2.dcm</Key><Size>43</Size></Contents></ListBucketResult>',
          ),
        }
      }
      return { status: 404, headers: {}, body: Buffer.from('<Error><Code>NoSuchKey</Code></Error>') }
    }
    const driver = new S3StorageDriver({
      endpoint: 'http://localhost:9000',
      bucket,
      accessKey: 'AKIA123',
      secretKey: 'secret123',
      region: 'us-east-1',
      requester,
    })
    return { driver, requests }
  }

  it('put sends signed PUT with x-amz-content-sha256 and Authorization header', async () => {
    const { driver, requests } = makeDriver()
    await driver.put('study/1.dcm', Buffer.from('DICM'), { contentType: 'application/dicom' })
    const req = requests[0]!
    expect(req.method).toBe('PUT')
    expect(req.url).toBe('http://localhost:9000/g005/study/1.dcm')
    expect(req.headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA123\/\d{8}\/us-east-1\/s3\/aws4_request/)
    expect(req.headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/)
    expect(req.headers['Content-Type']).toBe('application/dicom')
  })

  it('get returns body, stat parses HEAD headers, delete sends DELETE', async () => {
    const { driver } = makeDriver()
    const data = await driver.get('study/1.dcm')
    expect(data.toString()).toBe('s3-content')
    const meta = await driver.stat('study/1.dcm')
    expect(meta.size).toBe(10)
    expect(meta.lastModified).toBeInstanceOf(Date)
    await expect(driver.delete('study/1.dcm')).resolves.toBeUndefined()
  })

  it('list parses ListBucketResult XML', async () => {
    const { driver, requests } = makeDriver()
    const result = await driver.list({ prefix: 'study' })
    expect(result.keys).toHaveLength(2)
    expect(result.keys[0]).toMatchObject({ key: 'study/1.dcm', size: 42 })
    expect(result.isTruncated).toBe(false)
    expect(requests[0]!.url).toContain('list-type=2')
    expect(requests[0]!.url).toContain('prefix=study')
  })

  it('testConnection ok on 200, reports failure detail on 403', async () => {
    const { driver } = makeDriver()
    const ok = await driver.testConnection()
    expect(ok.ok).toBe(true)
    expect(ok.driver).toBe('s3')

    const failDriver = new S3StorageDriver({
      endpoint: 'http://localhost:9000',
      bucket: 'nope',
      accessKey: 'a',
      secretKey: 'b',
      requester: async () => ({
        status: 403,
        headers: {},
        body: Buffer.from('<Error><Code>AccessDenied</Code><Message>bad keys</Message></Error>'),
      }),
    })
    const fail = await failDriver.testConnection()
    expect(fail.ok).toBe(false)
    expect(fail.detail).toContain('AccessDenied')
  })

  it('throws descriptive error on failed put', async () => {
    const driver = new S3StorageDriver({
      endpoint: 'http://localhost:9000',
      bucket: 'b',
      accessKey: 'a',
      secretKey: 's',
      requester: async () => ({ status: 404, headers: {}, body: Buffer.from('<Error><Code>NoSuchBucket</Code></Error>') }),
    })
    await expect(driver.put('k', Buffer.from('x'))).rejects.toThrow(/NoSuchBucket/)
  })

  it('rejects missing credentials at construction', () => {
    expect(() => new S3StorageDriver({ endpoint: 'http://x', bucket: 'b', accessKey: '', secretKey: '' })).toThrow()
  })
})

describe('StorageModule factory helpers', () => {
  const mockConfig = (env: Record<string, string | undefined>) => ({
    get: jest.fn((key: string, defaultValue?: unknown) => env[key] ?? defaultValue),
  }) as unknown as ConfigService

  it('s3ConfigFromEnv returns s3 config from env', () => {
    const cfg = s3ConfigFromEnv(mockConfig({ STORAGE_DRIVER: 's3', S3_ENDPOINT: 'http://minio:9000', S3_BUCKET: 'ris', S3_ACCESS_KEY: 'ak', S3_SECRET_KEY: 'sk', S3_REGION: 'cn-1' }))
    expect(cfg).toEqual({ driver: 's3', endpoint: 'http://minio:9000', bucket: 'ris', region: 'cn-1', accessKey: 'ak', secretKey: 'sk' })
  })

  it('s3ConfigFromEnv throws on invalid driver value', () => {
    expect(() => s3ConfigFromEnv(mockConfig({ STORAGE_DRIVER: 'ftp' }))).toThrow()
  })

  it('buildS3DriverOptions fills region default and validates completeness', () => {
    const opts = buildS3DriverOptions({ driver: 's3', endpoint: 'http://e:9000', bucket: 'b', accessKey: 'a', secretKey: 's' })
    expect(opts.region).toBe('us-east-1')
    expect(() => buildS3DriverOptions({ driver: 's3', endpoint: 'http://e:9000' } as never)).toThrow()
  })

  it('STORAGE_DRIVER token is a symbol for Nest DI', () => {
    expect(typeof STORAGE_DRIVER).toBe('symbol')
  })
})

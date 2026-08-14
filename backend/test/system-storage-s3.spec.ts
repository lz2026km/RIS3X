/**
 * [G005 v3.0.6.11-99 Wave 7A (G-28)] 生产级云存储 S3 驱动深化测试
 * 1) 对象生命周期策略 CRUD (内存 + seed, 租户隔离)
 * 2) 多租户桶隔离 (tenantId 过滤 / 桶命名前缀 / 跨租户访问 404)
 * 3) 对象批量操作 (batch-delete / copy, source 标注)
 * 4) S3 驱动真实化: deleteMany (POST ?delete XML) / copy (PUT x-amz-copy-source) SigV4 签名
 */
import { SystemStorageService } from '../src/system-storage/system-storage.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { S3StorageDriver, type S3RequestInit, type S3Response } from '../src/common/storage/s3-storage.driver'
import { tenantStorage } from '../src/common/interceptors/tenant-context.interceptor'

const makePrisma = () => ({
  systemConfig: {
    findMany: jest.fn().mockRejectedValue(new Error('no db')),
    findUnique: jest.fn().mockRejectedValue(new Error('no db')),
    upsert: jest.fn().mockRejectedValue(new Error('no db')),
  },
})

const makeConfig = (env: Record<string, string> = {}) => ({
  get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback),
})

const makeSystemConfig = () => ({ invalidate: jest.fn(), get: jest.fn(), getString: jest.fn(), getNumber: jest.fn() })

const makeService = () =>
  new SystemStorageService(makePrisma() as never, makeConfig() as never, {} as never, makeSystemConfig() as never)

const withTenant = <T>(tenantId: string, fn: () => T): T =>
  tenantStorage.run({ tenantId, enforce: true }, fn)

describe('SystemStorageService (G-28 S3 深化: 生命周期策略)', () => {
  it('listLifecyclePolicies 返回 seed 3 条 (按桶/天数排序)', () => {
    const service = makeService()
    const policies = service.listLifecyclePolicies()
    expect(policies).toHaveLength(3)
    const p = policies.find((x) => x.prefix === 'ct-')
    expect(p).toMatchObject({ bucket: 'g005-dicom', transitionTo: 'tier2', afterDays: 90, deleteAfterDays: 365, enabled: true })
    expect(p!.id).toMatch(/^lp-\d{3}$/)
    expect(p!.tenantId).toBe('default')
  })

  it('createLifecyclePolicy 成功创建并出现在列表', () => {
    const service = makeService()
    const created = service.createLifecyclePolicy({
      bucket: 'g005-files',
      prefix: 'teaching-',
      transitionTo: 'archive',
      afterDays: 180,
      deleteAfterDays: 720,
      enabled: true,
    })
    expect(created.bucket).toBe('g005-files')
    expect(created.id).toMatch(/^lp-\d{3}$/)
    expect(service.listLifecyclePolicies()).toHaveLength(4)
  })

  it('createLifecyclePolicy 拒绝 deleteAfterDays < afterDays', () => {
    const service = makeService()
    expect(() =>
      service.createLifecyclePolicy({
        bucket: 'g005-dicom',
        transitionTo: 'tier2',
        afterDays: 90,
        deleteAfterDays: 30,
      }),
    ).toThrow(BadRequestException)
  })

  it('createLifecyclePolicy 对未知桶抛 404', () => {
    const service = makeService()
    expect(() =>
      service.createLifecyclePolicy({ bucket: 'no-such-bucket', transitionTo: 'archive', afterDays: 30 }),
    ).toThrow(NotFoundException)
  })

  it('updateLifecyclePolicy 支持启用开关与天数调整', () => {
    const service = makeService()
    const p = service.listLifecyclePolicies().find((x) => x.prefix === 'ct-')!
    const updated = service.updateLifecyclePolicy(p.id, { enabled: false, afterDays: 60, deleteAfterDays: 365 })
    expect(updated.enabled).toBe(false)
    expect(updated.afterDays).toBe(60)
    const again = service.updateLifecyclePolicy(p.id, { enabled: true })
    expect(again.enabled).toBe(true)
    expect(again.updatedAt >= p.updatedAt).toBe(true)
  })

  it('updateLifecyclePolicy 拒绝非法天数组合并抛 404 (未知策略)', () => {
    const service = makeService()
    const p = service.listLifecyclePolicies().find((x) => x.prefix === 'ct-')!
    expect(() => service.updateLifecyclePolicy(p.id, { afterDays: 100, deleteAfterDays: 50 })).toThrow(BadRequestException)
    expect(() => service.updateLifecyclePolicy('lp-999', { enabled: true })).toThrow(NotFoundException)
  })

  it('deleteLifecyclePolicy 删除后列表收缩, 未知策略 404', () => {
    const service = makeService()
    const p = service.listLifecyclePolicies().find((x) => x.transitionTo === 'backup')!
    expect(service.deleteLifecyclePolicy(p.id)).toEqual({ deleted: p.id })
    expect(service.listLifecyclePolicies()).toHaveLength(2)
    expect(() => service.deleteLifecyclePolicy(p.id)).toThrow(NotFoundException)
  })
})

describe('SystemStorageService (G-28 S3 深化: 对象批量操作)', () => {
  it('batchDeleteObjects 删除命中键并回报缺失键', () => {
    const service = makeService()
    const res = service.batchDeleteObjects('g005-dicom', ['ct-frame-0001.dcm', 'ct-frame-0002.dcm', 'ghost.dcm'])
    expect(res.deleted).toEqual(['ct-frame-0001.dcm', 'ct-frame-0002.dcm'])
    expect(res.missing).toEqual(['ghost.dcm'])
    expect(res.source).toBe('simulated')
    expect(service.listBucketObjects('g005-dicom')).toHaveLength(2)
    const bucket = service.listBuckets().find((b) => b.name === 'g005-dicom')
    expect(bucket!.objectCount).toBe(2)
  })

  it('batchDeleteObjects 未知桶抛 404', () => {
    const service = makeService()
    expect(() => service.batchDeleteObjects('nope', ['x'])).toThrow(NotFoundException)
  })

  it('copyObject 跨桶复制 (目标同名覆盖)', () => {
    const service = makeService()
    const res = service.copyObject('g005-dicom', { key: 'ct-frame-0001.dcm', targetBucket: 'g005-files' })
    expect(res).toMatchObject({ key: 'ct-frame-0001.dcm', targetBucket: 'g005-files', size: 512_000, copied: true, source: 'simulated' })
    const copied = service.listBucketObjects('g005-files').find((o) => o.key === 'ct-frame-0001.dcm')
    expect(copied).toBeDefined()
    const again = service.copyObject('g005-dicom', { key: 'ct-frame-0001.dcm', targetBucket: 'g005-files' })
    expect(again.size).toBe(512_000)
    expect(service.listBucketObjects('g005-files').filter((o) => o.key === 'ct-frame-0001.dcm')).toHaveLength(1)
  })

  it('copyObject 源键缺失 / 目标桶缺失 / 同桶复制均拒绝', () => {
    const service = makeService()
    expect(() => service.copyObject('g005-dicom', { key: 'missing.dcm', targetBucket: 'g005-vna' })).toThrow(NotFoundException)
    expect(() => service.copyObject('g005-dicom', { key: 'ct-frame-0001.dcm', targetBucket: 'no-such' })).toThrow(NotFoundException)
    expect(() => service.copyObject('g005-dicom', { key: 'ct-frame-0001.dcm', targetBucket: 'g005-dicom' })).toThrow(BadRequestException)
  })
})

describe('SystemStorageService (G-28 S3 深化: 多租户桶隔离)', () => {
  it('default 租户可见 seed 桶, 其他租户列表为空', () => {
    const service = makeService()
    expect(withTenant('default', () => service.listBuckets()).length).toBeGreaterThanOrEqual(3)
    expect(withTenant('tenant-x', () => service.listBuckets())).toHaveLength(0)
  })

  it('非 default 租户新建桶自动加前缀, 跨租户访问 404', () => {
    const service = makeService()
    const created = withTenant('tenant-x', () =>
      service.createBucket({ name: 'archive', provider: 's3', region: 'cn-north-1' }),
    )
    expect(created.name).toBe('tenant-x-archive')
    expect(created.tenantId).toBe('tenant-x')
    expect(withTenant('tenant-x', () => service.listBuckets()).map((b) => b.name)).toEqual(['tenant-x-archive'])
    // default 租户看不到 tenant-x 的桶, 也无法访问
    expect(service.listBuckets().some((b) => b.name === 'tenant-x-archive')).toBe(false)
    expect(() => service.deleteBucket('tenant-x-archive')).toThrow(NotFoundException)
    // tenant-x 可以删除自己的桶
    expect(withTenant('tenant-x', () => service.deleteBucket('tenant-x-archive'))).toEqual({ deleted: 'tenant-x-archive' })
  })

  it('拒绝跨租户命名抢占 (tenant-y 不能创建 tenant-x-* 前缀桶)', () => {
    const service = makeService()
    withTenant('tenant-x', () => service.createBucket({ name: 'data', provider: 's3', region: 'us-east-1' }))
    expect(() =>
      withTenant('tenant-y', () => service.createBucket({ name: 'tenant-x-data', provider: 's3', region: 'us-east-1' })),
    ).toThrow(BadRequestException)
  })

  it('生命周期策略按租户隔离', () => {
    const service = makeService()
    withTenant('tenant-x', () =>
      service.createBucket({ name: 'dicom', provider: 's3', region: 'us-east-1' }),
    )
    const p = withTenant('tenant-x', () =>
      service.createLifecyclePolicy({ bucket: 'tenant-x-dicom', transitionTo: 'archive', afterDays: 90 }),
    )
    expect(p.tenantId).toBe('tenant-x')
    expect(service.listLifecyclePolicies().some((x) => x.id === p.id)).toBe(false)
    expect(withTenant('tenant-x', () => service.listLifecyclePolicies()).some((x) => x.id === p.id)).toBe(true)
  })
})

describe('S3StorageDriver (G-28 深化: deleteMany / copy 真实 S3 REST 语义)', () => {
  const makeDriver = (requester: (req: S3RequestInit) => Promise<S3Response>) =>
    new S3StorageDriver({
      endpoint: 'http://localhost:9000',
      bucket: 'g005',
      accessKey: 'AKIA123',
      secretKey: 'secret123',
      region: 'us-east-1',
      requester,
    })

  it('deleteMany 发送 POST ?delete= 携带 <Delete> XML 并解析 Deleted/Error', async () => {
    let captured: S3RequestInit | undefined
    const driver = makeDriver(async (req) => {
      captured = req
      return {
        status: 200,
        headers: {},
        body: Buffer.from(
          '<DeleteResult><Deleted><Key>a.dcm</Key></Deleted>' +
            '<Error><Key>b.dcm</Key><Code>NoSuchKey</Code></Error></DeleteResult>',
        ),
      }
    })
    const res = await driver.deleteMany(['a.dcm', 'b.dcm'])
    expect(captured!.method).toBe('POST')
    expect(captured!.url).toBe('http://localhost:9000/g005?delete=')
    expect(captured!.body!.toString()).toContain('<Delete>')
    expect(captured!.body!.toString()).toContain('<Key>a.dcm</Key>')
    expect(captured!.headers['Content-Type']).toBe('application/xml')
    expect(captured!.headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256/)
    expect(res.deleted).toEqual(['a.dcm'])
    expect(res.errors).toEqual([{ key: 'b.dcm', code: 'NoSuchKey' }])
  })

  it('deleteMany 空数组直接返回不发起请求', async () => {
    const requester = jest.fn()
    const driver = makeDriver(requester as never)
    await expect(driver.deleteMany([])).resolves.toEqual({ deleted: [], errors: [] })
    expect(requester).not.toHaveBeenCalled()
  })

  it('copy 发送 PUT 到目标桶并签名 x-amz-copy-source 头', async () => {
    let captured: S3RequestInit | undefined
    const driver = makeDriver(async (req) => {
      captured = req
      return {
        status: 200,
        headers: {},
        body: Buffer.from('<CopyObjectResult><ETag>"e1"</ETag><LastModified>2026-08-15T00:00:00Z</LastModified></CopyObjectResult>'),
      }
    })
    const res = await driver.copy('study/1.dcm', 'copy.dcm', 'g005-vna')
    expect(captured!.method).toBe('PUT')
    expect(captured!.url).toBe('http://localhost:9000/g005-vna/copy.dcm')
    expect(captured!.headers['x-amz-copy-source']).toBe('/g005/study/1.dcm')
    // SigV4 深化: x-amz-* 头全部参与签名
    expect(captured!.headers['Authorization']).toMatch(/SignedHeaders=[^,]*(x-amz-copy-source)[^,]*/)
    expect(res.etag).toBe('"e1"')
    expect(res.lastModified).toBe('2026-08-15T00:00:00Z')
  })

  it('copy 同桶复制缺省目标桶', async () => {
    const driver = makeDriver(async (req) => {
      expect(req.headers['x-amz-copy-source']).toBe('/g005/k.dcm')
      return { status: 200, headers: {}, body: Buffer.from('<CopyObjectResult><ETag>"x"</ETag></CopyObjectResult>') }
    })
    await expect(driver.copy('k.dcm', 'k2.dcm')).resolves.toEqual({ etag: '"x"', lastModified: undefined })
  })

  it('驱动 source 标注为 aws-sigv4-native', async () => {
    const driver = makeDriver(async () => ({
      status: 200,
      headers: {},
      body: Buffer.from('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'),
    }))
    expect(driver.source).toBe('aws-sigv4-native')
    const result = await driver.testConnection()
    expect(result.source).toBe('aws-sigv4-native')
    expect(result.ok).toBe(true)
  })
})

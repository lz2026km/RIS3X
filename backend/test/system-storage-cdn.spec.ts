/**
 * [G005 v3.0.6.11-100 Wave 3B (G-28)] 生产级云存储深化测试
 * 1) CDN 签名 URL (本地模拟 + source 标注 / 真实 S3 SigV4 预签名)
 * 2) 跨区复制任务 (内存队列 + 状态: queued→running→completed)
 * 3) 存储监控指标 (容量/增长率/IO/复制队列, 桶派生 + seed 回退)
 */
import { SystemStorageService } from '../src/system-storage/system-storage.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { S3StorageDriver } from '../src/common/storage/s3-storage.driver'
import { tenantStorage } from '../src/common/interceptors/tenant-context.interceptor'

const withTenant = <T>(tenantId: string, fn: () => T): T =>
  tenantStorage.run({ tenantId, enforce: true }, fn)

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

const makeService = (env: Record<string, string> = {}) =>
  new SystemStorageService(makePrisma() as never, makeConfig(env) as never, {} as never, makeSystemConfig() as never)

describe('SystemStorageService (G-28 CDN 签名 URL)', () => {
  it('本地模拟: 返回同构 AWS 预签名 URL (source=simulated, 含过期时间)', async () => {
    const service = makeService()
    const res = await service.generateSignedUrl('g005-dicom', 'ct-frame-0001.dcm', 300)
    expect(res.bucket).toBe('g005-dicom')
    expect(res.key).toBe('ct-frame-0001.dcm')
    expect(res.expiresInSec).toBe(300)
    expect(res.source).toBe('simulated')
    expect(res.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256')
    expect(res.url).toContain('X-Amz-Expires=300')
    expect(res.url).toContain('X-Amz-Signature=')
    expect(res.url).toContain('g005-dicom')
    expect(res.url).toContain(encodeURIComponent('ct-frame-0001.dcm'))
  })

  it('未传 expiresInSec 时默认 3600 秒', async () => {
    const service = makeService()
    const res = await service.generateSignedUrl('g005-dicom', 'ct-frame-0001.dcm')
    expect(res.expiresInSec).toBe(3600)
    expect(res.url).toContain('X-Amz-Expires=3600')
  })

  it('expiresAt 在未来且与 expiresInSec 一致 (±5s)', async () => {
    const service = makeService()
    const res = await service.generateSignedUrl('g005-vna', 'report-0001.pdf', 600)
    const delta = new Date(res.expiresAt).getTime() - Date.now()
    expect(delta).toBeGreaterThan(590_000)
    expect(delta).toBeLessThanOrEqual(610_000)
  })

  it('过期时间封顶 7 天 (604800), 非法值回退 3600', async () => {
    const service = makeService()
    const cap = await service.generateSignedUrl('g005-dicom', 'ct-frame-0001.dcm', 999_999)
    expect(cap.expiresInSec).toBe(604_800)
    const invalid = await service.generateSignedUrl('g005-dicom', 'ct-frame-0001.dcm', Number.NaN)
    expect(invalid.expiresInSec).toBe(3600)
  })

  it('未知桶 / 未知对象抛 404', async () => {
    const service = makeService()
    await expect(service.generateSignedUrl('nope', 'x.dcm', 60)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.generateSignedUrl('g005-dicom', 'ghost.dcm', 60)).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('SystemStorageService (G-28 跨区复制任务)', () => {
  it('replicateBucket 入队并完成: 目标桶对象/容量增加, 任务状态 completed', () => {
    const service = makeService()
    const before = service.listBuckets().find((b) => b.name === 'g005-vna')!
    const task = service.replicateBucket('g005-dicom', { targetBucket: 'g005-vna', region: 'cn-north-1' })
    expect(task.id).toMatch(/^rep-\d{3}$/)
    expect(task.sourceBucket).toBe('g005-dicom')
    expect(task.targetBucket).toBe('g005-vna')
    expect(task.region).toBe('cn-north-1')
    expect(task.status).toBe('completed')
    expect(task.progress).toBe(100)
    expect(task.objectsTotal).toBe(4)
    expect(task.objectsCopied).toBe(4)
    expect(task.bytesCopied).toBe(2_328_576)
    expect(task.source).toBe('simulated')
    expect(task.startedAt).toBeTruthy()
    expect(task.finishedAt).toBeTruthy()
    const after = service.listBuckets().find((b) => b.name === 'g005-vna')!
    expect(after.objectCount).toBe(before.objectCount + 4)
    expect(after.usedBytes).toBe(before.usedBytes + 2_328_576)
    const copied = service.listBucketObjects('g005-vna').find((o) => o.key === 'ct-frame-0001.dcm')
    expect(copied).toMatchObject({ key: 'ct-frame-0001.dcm', size: 512_000 })
  })

  it('同桶复制 / 目标桶缺失 / region 缺失均拒绝', () => {
    const service = makeService()
    expect(() => service.replicateBucket('g005-dicom', { targetBucket: 'g005-dicom', region: 'us-east-1' }))
      .toThrow(BadRequestException)
    expect(() => service.replicateBucket('g005-dicom', { targetBucket: 'no-such', region: 'us-east-1' }))
      .toThrow(NotFoundException)
    expect(() => service.replicateBucket('g005-dicom', { targetBucket: 'g005-vna', region: '  ' }))
      .toThrow(BadRequestException)
  })

  it('源桶不存在抛 404', () => {
    const service = makeService()
    expect(() => service.replicateBucket('nope', { targetBucket: 'g005-vna', region: 'cn-north-1' }))
      .toThrow(NotFoundException)
  })

  it('getReplicationStatus 汇总队列状态', () => {
    const service = makeService()
    service.replicateBucket('g005-dicom', { targetBucket: 'g005-vna', region: 'cn-north-1' })
    service.replicateBucket('g005-files', { targetBucket: 'g005-dicom', region: 'us-west-2' })
    const status = service.getReplicationStatus()
    expect(status.completed).toBe(2)
    expect(status.pending).toBe(0)
    expect(status.running).toBe(0)
    expect(status.failed).toBe(0)
    expect(status.queueDepth).toBe(0)
    expect(status.tasks.length).toBeGreaterThanOrEqual(2)
    expect(status.lastUpdatedAt).toBeTruthy()
    const latest = status.tasks[0]!
    expect(latest.id).toBe('rep-002')
    expect(latest.sourceBucket).toBe('g005-files')
  })
})

describe('SystemStorageService (G-28 存储监控指标)', () => {
  it('getMonitoring 从桶派生: 总容量/已用/桶明细/IO/历史趋势 (source=derived)', () => {
    const service = makeService()
    const monitor = service.getMonitoring()
    const buckets = service.listBuckets()
    const expectedUsed = buckets.reduce((s, b) => s + b.usedBytes, 0)
    expect(monitor.totalUsedBytes).toBe(expectedUsed)
    expect(monitor.totalUsedBytes).toBeGreaterThan(0)
    expect(monitor.objectsTotal).toBe(buckets.reduce((s, b) => s + b.objectCount, 0))
    expect(monitor.usedPercent).toBeGreaterThan(0)
    expect(monitor.usedPercent).toBeLessThanOrEqual(100)
    expect(monitor.growthRatePct30d).toBeGreaterThan(0)
    expect(monitor.buckets.length).toBe(buckets.length)
    const dicom = monitor.buckets.find((b) => b.name === 'g005-dicom')!
    expect(dicom.percentOfTotal).toBeGreaterThan(0)
    expect(monitor.history).toHaveLength(30)
    expect(monitor.history[29]).toMatchObject({ date: expect.any(String) })
    expect(monitor.history[29]!.usedBytes).toBe(expectedUsed)
    expect(monitor.source).toBe('derived')
  })

  it('IO 计数派生 (derived=true) 且复制队列字段齐备', () => {
    const service = makeService()
    const monitor = service.getMonitoring()
    expect(monitor.ioCounts.derived).toBe(true)
    expect(monitor.ioCounts.readPerMin).toBeGreaterThan(0)
    expect(monitor.ioCounts.writePerMin).toBeGreaterThan(0)
    expect(monitor.ioCounts.putPerMin).toBeGreaterThan(0)
    expect(monitor.ioCounts.deletePerMin).toBeGreaterThan(0)
    expect(monitor.replication).toMatchObject({ pending: 0, running: 0, completed: 0, failed: 0, pendingBytes: 0 })
  })

  it('复制完成后监控复制队列计数同步', () => {
    const service = makeService()
    service.replicateBucket('g005-vna', { targetBucket: 'g005-files', region: 'ap-southeast-1' })
    const monitor = service.getMonitoring()
    expect(monitor.replication.completed).toBe(1)
    expect(monitor.replication.failed).toBe(0)
  })

  it('空租户 seed 回退: source=seed, IO 为示例值', () => {
    const service = makeService()
    const monitor = withTenant('tenant-empty', () => service.getMonitoring())
    expect(monitor.totalUsedBytes).toBe(0)
    expect(monitor.source).toBe('seed')
    expect(monitor.buckets).toHaveLength(0)
    expect(monitor.ioCounts.derived).toBe(false)
    expect(monitor.totalCapacityBytes).toBeGreaterThan(0)
    expect(monitor.history).toHaveLength(30)
    expect(monitor.history[29]!.usedBytes).toBe(0)
  })

  it('环境变量 seed: STORAGE_CAPACITY_BYTES / STORAGE_GROWTH_PCT_30D 生效', () => {
    const service = makeService({ STORAGE_CAPACITY_BYTES: '10000000000', STORAGE_GROWTH_PCT_30D: '8.8' })
    const monitor = service.getMonitoring()
    expect(monitor.totalCapacityBytes).toBe(10_000_000_000)
    expect(monitor.growthRatePct30d).toBe(8.8)
    expect(monitor.usedPercent).toBe(Number(((monitor.totalUsedBytes / 10_000_000_000) * 100).toFixed(1)))
  })
})

describe('S3StorageDriver (G-28 预签名 URL SigV4)', () => {
  const makeDriver = () =>
    new S3StorageDriver({
      endpoint: 'http://localhost:9000',
      bucket: 'g005',
      accessKey: 'AKIA123',
      secretKey: 'secret123',
      region: 'us-east-1',
      requester: (async () => ({ status: 200, headers: {}, body: Buffer.from('') })) as never,
    })

  it('presign 生成 AWS 查询参数签名 URL (不发起网络请求)', () => {
    const url = makeDriver().presign('study/1.dcm', 300)
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256')
    expect(url).toContain('X-Amz-Expires=300')
    expect(url).toContain('X-Amz-SignedHeaders=host')
    expect(url).toMatch(/X-Amz-Credential=AKIA123%2F\d{8}%2Fus-east-1%2Fs3%2Faws4_request/)
    expect(url).toMatch(/X-Amz-Signature=[0-9a-f]{64}/)
    expect(url).toContain('/g005/study/1.dcm')
    expect(url).not.toContain('X-Amz-Content-Sha256')
  })

  it('presign 默认 3600 秒且 canonical 查询参数按字母序 (Signature 按 AWS 约定追加在最后)', () => {
    const url = makeDriver().presign('k.dcm')
    expect(url).toContain('X-Amz-Expires=3600')
    const pairs = url.split('?')[1]!.split('&').map((p) => p.split('=')[0]!)
    expect(pairs[pairs.length - 1]).toBe('X-Amz-Signature')
    const canonical = pairs.slice(0, -1)
    expect([...canonical].sort().join(',')).toBe(canonical.join(','))
  })
})

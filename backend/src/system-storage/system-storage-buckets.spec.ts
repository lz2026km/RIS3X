/**
 * G005 RIS v3.0.6.11-91 Wave 4B (PACS P1 G-28) - SystemStorageService 云存储桶管理测试
 * GET/POST/DELETE /system/storage/buckets + GET objects + POST upload + GET download
 * (内存 + seed, 无需 DB)
 */
import { SystemStorageService } from './system-storage.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

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

describe('SystemStorageService (G-28 cloud storage buckets)', () => {
  describe('listBuckets', () => {
    it('returns seeded buckets with computed objectCount/usedBytes', () => {
      const service = makeService()
      const buckets = service.listBuckets()
      expect(buckets.length).toBeGreaterThanOrEqual(3)
      const dicom = buckets.find((b) => b.name === 'g005-dicom')
      expect(dicom).toBeDefined()
      expect(dicom!.provider).toBe('s3')
      expect(dicom!.region).toBe('us-east-1')
      expect(dicom!.objectCount).toBe(4)
      expect(dicom!.usedBytes).toBe(512_000 + 512_000 + 1_048_576 + 256_000)
      expect(dicom!.createdAt).toBeTruthy()
    })
  })

  describe('createBucket', () => {
    it('creates an empty bucket and returns DTO', () => {
      const service = makeService()
      const created = service.createBucket({ name: 'g005-new', provider: 's3', region: 'cn-north-1' })
      expect(created.name).toBe('g005-new')
      expect(created.objectCount).toBe(0)
      expect(created.usedBytes).toBe(0)
      expect(service.listBuckets()).toHaveLength(4)
    })

    it('rejects duplicate bucket names', () => {
      const service = makeService()
      expect(() => service.createBucket({ name: 'g005-dicom', provider: 's3', region: 'us-east-1' }))
        .toThrow(BadRequestException)
    })
  })

  describe('deleteBucket', () => {
    it('deletes an existing bucket', () => {
      const service = makeService()
      expect(service.deleteBucket('g005-vna')).toEqual({ deleted: 'g005-vna' })
      expect(service.listBuckets().find((b) => b.name === 'g005-vna')).toBeUndefined()
    })

    it('throws 404 for unknown bucket', () => {
      const service = makeService()
      expect(() => service.deleteBucket('nope')).toThrow(NotFoundException)
    })
  })

  describe('listBucketObjects', () => {
    it('returns seeded objects for a bucket', () => {
      const service = makeService()
      const objects = service.listBucketObjects('g005-dicom')
      expect(objects).toHaveLength(4)
      expect(objects[0]).toMatchObject({ key: 'ct-frame-0001.dcm', size: 512_000 })
      expect(objects[0]!.modified).toBeTruthy()
    })

    it('throws 404 for unknown bucket', () => {
      const service = makeService()
      expect(() => service.listBucketObjects('nope')).toThrow(NotFoundException)
    })
  })

  describe('uploadObject', () => {
    it('appends a new object and updates bucket counts', () => {
      const service = makeService()
      const uploaded = service.uploadObject('g005-files', { key: 'new-study-0001.dcm', size: 2048 })
      expect(uploaded.key).toBe('new-study-0001.dcm')
      expect(uploaded.size).toBe(2048)
      const objects = service.listBucketObjects('g005-files')
      expect(objects.find((o) => o.key === 'new-study-0001.dcm')).toBeDefined()
      const bucket = service.listBuckets().find((b) => b.name === 'g005-files')
      expect(bucket!.objectCount).toBe(3)
      expect(bucket!.usedBytes).toBe(2_048_000 + 8_388_608 + 2048)
    })

    it('overwrites an existing key and sanitizes slashes', () => {
      const service = makeService()
      const uploaded = service.uploadObject('g005-dicom', { key: 'a/b\\c.dcm', size: 10 })
      expect(uploaded.key).toBe('a-b-c.dcm')
      const again = service.uploadObject('g005-dicom', { key: 'a-b-c.dcm', size: 20 })
      expect(again.size).toBe(20)
      const objects = service.listBucketObjects('g005-dicom')
      expect(objects.filter((o) => o.key === 'a-b-c.dcm')).toHaveLength(1)
    })

    it('throws 404 for unknown bucket', () => {
      const service = makeService()
      expect(() => service.uploadObject('nope', { key: 'x', size: 1 })).toThrow(NotFoundException)
    })
  })

  describe('downloadObject', () => {
    it('returns base64 simulated content with correct contentType', () => {
      const service = makeService()
      const res = service.downloadObject('g005-dicom', 'ct-frame-0001.dcm')
      expect(res.key).toBe('ct-frame-0001.dcm')
      expect(res.contentType).toBe('application/octet-stream')
      expect(res.contentBase64).toBeTruthy()
      const decoded = Buffer.from(res.contentBase64, 'base64').toString('utf8')
      expect(decoded).toContain('G005 模拟下载对象')
      expect(decoded).toContain('g005-dicom')
    })

    it('uses json contentType for manifest keys', () => {
      const service = makeService()
      expect(service.downloadObject('g005-vna', 'archive-manifest.json').contentType).toBe('application/json')
    })

    it('throws 404 for unknown object', () => {
      const service = makeService()
      expect(() => service.downloadObject('g005-dicom', 'missing.dcm')).toThrow(NotFoundException)
    })
  })
})

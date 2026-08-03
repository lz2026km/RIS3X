import * as path from 'node:path'
import { DicomCompressService } from '../src/modules/dicom-compress/dicom-compress.service'

const SAMPLE = path.resolve(__dirname, '../dicom-samples/CT_CHEST/CT_CHEST_001.dcm')

describe('DicomCompressService (real codec)', () => {
  let svc: DicomCompressService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      compressTask: {
        create: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    }
    svc = new DicomCompressService(mockPrisma)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('getSupportedSyntaxes returns six transfer syntaxes', () => {
    expect(svc.getSupportedSyntaxes()).toHaveLength(6)
    expect(svc.getSupportedSyntaxes()[0].name).toContain('JPEG 2000')
  })

  it('compress on a real sample file produces a real ratio > 1 (RLE)', async () => {
    const p = svc.compress(SAMPLE, '1.2.840.10008.1.2.5')
    await jest.runAllTimersAsync()
    const task = await p
    expect(task.status).toBe('done')
    expect(task.simulated).toBe(false)
    expect(task.originalSize).toBeGreaterThan(0)
    expect(task.compressedSize).not.toBeNull()
    expect(task.compressedSize!).toBeLessThan(task.originalSize)
    expect(task.ratio!).toBeGreaterThan(1)
    expect(task.modality).toBe('CT')
    expect(task.lossless).toBe(true)
    expect(task.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('compress with JPEG2000-lossless syntax uses predictive codec and round-trips via decompress', async () => {
    const p = svc.compress(SAMPLE, '1.2.840.10008.1.2.4.90')
    await jest.runAllTimersAsync()
    const task = await p
    expect(task.status).toBe('done')
    expect(task.algorithmName).toContain('Predictive')
    expect(task.ratio!).toBeGreaterThan(1)

    mockPrisma.compressTask.create.mockRejectedValue(new Error('db down'))
    const decomp = await svc.decompress(task.id)
    expect(decomp.status).toBe('done')
    expect(decomp.compressedSize).toBe(task.originalSize)
    expect(decomp.ratio).toBe(1)
  })

  it('lossy quality yields a larger ratio than lossless on the same file', async () => {
    const pLossless = svc.compress(SAMPLE, '1.2.840.10008.1.2.4.91', { quality: 100 })
    await jest.runAllTimersAsync()
    const lossless = await pLossless
    const pLossy = svc.compress(SAMPLE, '1.2.840.10008.1.2.4.91', { quality: 40 })
    await jest.runAllTimersAsync()
    const lossy = await pLossy
    expect(lossy.ratio!).toBeGreaterThan(lossless.ratio!)
    expect(lossy.quality).toBe(40)
  })

  it('same input + algorithm is deterministic (same compressed size twice)', async () => {
    const p1 = svc.compress(SAMPLE, '1.2.840.10008.1.2.4.90')
    await jest.runAllTimersAsync()
    const t1 = await p1
    const p2 = svc.compress(SAMPLE, '1.2.840.10008.1.2.4.90')
    await jest.runAllTimersAsync()
    const t2 = await p2
    expect(t1.compressedSize).toBe(t2.compressedSize)
    expect(t1.ratio).toBe(t2.ratio)
  })

  it('unknown file falls back to simulated ratio and keeps task lifecycle', async () => {
    const p = svc.compress('not-a-real-file-xyz', '1.2.840.10008.1.2.4.90')
    await jest.runAllTimersAsync()
    const task = await p
    expect(task.id).toMatch(/^task-\d+/)
    expect(task.status).toBe('done')
    expect(task.simulated).toBe(true)
    expect(task.compressedSize).toBeGreaterThan(0)
  })

  it('upload via dataBase64 compresses real bytes', async () => {
    const fs = require('node:fs') as typeof import('node:fs')
    const b64 = fs.readFileSync(SAMPLE).toString('base64')
    const p = svc.compress('uploaded.dcm', '1.2.840.10008.1.2.5', { dataBase64: b64 })
    await jest.runAllTimersAsync()
    const task = await p
    expect(task.status).toBe('done')
    expect(task.simulated).toBe(false)
    expect(task.ratio!).toBeGreaterThan(1)
  })

  it('listInstances returns manifest series entries', () => {
    const instances = svc.listInstances()
    expect(instances.length).toBeGreaterThanOrEqual(4)
    const ct = instances.find(i => i.modality === 'CT')
    expect(ct).toBeDefined()
    expect(ct!.rows).toBe(512)
    expect(ct!.sizeBytes).toBeGreaterThan(0)
  })

  it('getRatio returns real ratio for a resolvable instance', async () => {
    const r = await svc.getRatio(SAMPLE)
    expect(r.real).toBe(true)
    expect(r.compressedSize).toBeLessThan(r.originalSize)
    expect(r.ratio).toBeGreaterThan(1)
  })

  it('getRatio falls back to sop-class table when instance unknown', async () => {
    mockPrisma.compressTask.create.mockRejectedValue(new Error('db down'))
    const r = await svc.getRatio('inst-unknown-0001')
    expect(r.real).toBe(false)
    expect(r.originalSize).toBeGreaterThan(0)
    expect(r.compressedSize).toBeLessThan(r.originalSize)
  })

  it('getRatios aggregates completed tasks by algorithm and modality', async () => {
    mockPrisma.compressTask.findMany.mockResolvedValue([
      { id: 't1', instanceUid: SAMPLE, algorithm: '1.2.840.10008.1.2.4.90', status: 'done', progress: 100, originalSize: 524288, compressedSize: 192000, ratio: 2.73, error: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 't2', instanceUid: SAMPLE, algorithm: '1.2.840.10008.1.2.5', status: 'done', progress: 100, originalSize: 524288, compressedSize: 94000, ratio: 5.57, error: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 't3', instanceUid: SAMPLE, algorithm: '1.2.840.10008.1.2.5', status: 'failed', progress: 50, originalSize: 524288, compressedSize: null, error: 'x', createdAt: new Date(), updatedAt: new Date() },
    ])
    const stats = await svc.getRatios()
    expect(stats.totalTasks).toBe(2)
    expect(stats.totalSavedBytes).toBeGreaterThan(0)
    expect(stats.byAlgorithm.length).toBeGreaterThanOrEqual(2)
    const rle = stats.byAlgorithm.find(a => a.algorithm === '1.2.840.10008.1.2.5')
    expect(rle).toBeDefined()
    expect(rle!.count).toBe(1)
    expect(rle!.avgRatio).toBeGreaterThan(1)
  })

  it('getStats returns overview', async () => {
    const stats = await svc.getStats()
    expect(typeof stats.totalTasks).toBe('number')
    expect(Array.isArray(stats.algorithmDistribution)).toBe(true)
  })
})


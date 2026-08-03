import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { NotFoundException } from '@nestjs/common'
import { VolumeService } from '../src/modules/volume/volume.service'

/** 构造最小 Explicit VR LE DICOM Part 10 文件 (仅包含 VolumeService 需要的 tags) */
function makeDicom(opts: { instanceNumber: number; rows: number; cols: number; pixel: Buffer; junk?: boolean }): Buffer {
  if (opts.junk) return Buffer.from('not a dicom file at all, definitely not')
  const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'])
  const chunks: Buffer[] = [Buffer.alloc(128), Buffer.from('DICM', 'ascii')]
  const elem = (group: number, el: number, vr: string, value: Buffer): Buffer => {
    const padded = value.length % 2 === 0 ? value : Buffer.concat([value, Buffer.alloc(1)])
    if (LONG_VR.has(vr)) {
      const h = Buffer.alloc(12)
      h.writeUInt16LE(group, 0)
      h.writeUInt16LE(el, 2)
      h.write(vr, 4, 'ascii')
      h.writeUInt32LE(padded.length, 8)
      return Buffer.concat([h, padded])
    }
    const h = Buffer.alloc(8)
    h.writeUInt16LE(group, 0)
    h.writeUInt16LE(el, 2)
    h.write(vr, 4, 'ascii')
    h.writeUInt16LE(padded.length, 6)
    return Buffer.concat([h, padded])
  }
  const us = (g: number, e: number, v: number) => {
    const b = Buffer.alloc(2)
    b.writeUInt16LE(v, 0)
    return elem(g, e, 'US', b)
  }
  const ds = (g: number, e: number, s: string) => elem(g, e, 'DS', Buffer.from(s, 'ascii'))
  chunks.push(
    us(0x0028, 0x0010, opts.rows),
    us(0x0028, 0x0011, opts.cols),
    us(0x0028, 0x0100, 16),
    us(0x0028, 0x0103, 0),
    ds(0x0028, 0x1050, '40'),
    ds(0x0028, 0x1051, '400'),
    ds(0x0028, 0x1052, '0'),
    ds(0x0028, 0x1053, '1'),
    ds(0x0028, 0x0030, '1.0\\1.0'),
    ds(0x0028, 0x0050, '5'),
    elem(0x0020, 0x0013, 'IS', Buffer.from(String(opts.instanceNumber), 'ascii')),
    elem(0x7fe0, 0x0010, 'OB', opts.pixel),
  )
  return Buffer.concat(chunks)
}

describe('VolumeService', () => {
  let svc: VolumeService
  let dir: string
  let mockPrisma: any

  const sliceFiles: string[] = []

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vol-'))
    const makeSlice = (instanceNumber: number, values: number[]) => {
      const pixel = Buffer.alloc(values.length * 2)
      values.forEach((v, i) => pixel.writeUInt16LE(v, i * 2))
      const buf = makeDicom({ instanceNumber, rows: 2, cols: 2, pixel })
      const file = path.join(dir, `slice-${instanceNumber}.dcm`)
      fs.writeFileSync(file, buf)
      sliceFiles.push(file)
      return file
    }
    // 2 层 2x2 体素: 第一层值 10..40, 第二层 100..160 (rescale slope=1, intercept=0)
    makeSlice(1, [10, 20, 30, 40])
    makeSlice(2, [100, 120, 140, 160])
    fs.writeFileSync(path.join(dir, 'junk.dcm'), makeDicom({ instanceNumber: 9, rows: 2, cols: 2, pixel: Buffer.alloc(8), junk: true }))
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  beforeEach(() => {
    mockPrisma = {
      dicomInstance: {
        findMany: jest.fn(),
      },
    }
    svc = new VolumeService(mockPrisma)
  })

  describe('listSeries', () => {
    it('returns [] when prisma model is missing', async () => {
      const bare = new VolumeService({} as any)
      await expect(bare.listSeries()).resolves.toEqual([])
    })

    it('returns [] when findMany throws', async () => {
      mockPrisma.dicomInstance.findMany.mockRejectedValue(new Error('db down'))
      await expect(svc.listSeries()).resolves.toEqual([])
    })

    it('groups instances by series and parses real files for rows/columns', async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[0], createdAt: new Date() },
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[1], createdAt: new Date() },
      ])
      const result = await svc.listSeries()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ seriesInstanceUid: 'S1', modality: 'CT', instanceCount: 2, rows: 2, columns: 2 })
    })

    it('falls back to 512x512 when file cannot be parsed', async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S2', modality: 'CT', storagePath: path.join(dir, 'junk.dcm'), createdAt: new Date() },
      ])
      const result = await svc.listSeries()
      expect(result[0]).toMatchObject({ rows: 512, columns: 512 })
    })
  })

  describe('reconstruct', () => {
    /** 创建合成回退 job (fake timers, 推进到 interval 结束, 避免真实 setInterval 挂起) */
    async function syntheticJob(seriesUID: string) {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([])
      const result = await svc.reconstruct(seriesUID)
      jest.advanceTimersByTime(2500)
      return result
    }

    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('builds a real volume from real DICOM files', async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[0] },
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[1] },
      ])
      const result = await svc.reconstruct('S1')
      expect(result.source).toBe('real')
      expect(result.instanceCount).toBe(2)
      expect(result.volume).toEqual({ x: 2, y: 2, z: 2 })
      const status = svc.getStatus(result.jobId)
      expect(status.status).toBe('completed')
      expect(status.progress).toBe(100)
      expect(status.slices).toBe(2)
      expect(status.modality).toBe('CT')
    })

    it('falls back to synthetic when instances exist but no readable files', async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S2', modality: 'CT', storagePath: path.join(dir, 'missing.dcm') },
      ])
      const result = await svc.reconstruct('S2')
      expect(result.source).toBe('synthetic')
      expect(result.volume).toEqual({ x: 512, y: 512, z: 256 })
    })

    it('falls back to synthetic when prisma throws', async () => {
      mockPrisma.dicomInstance.findMany.mockRejectedValue(new Error('db down'))
      const result = await svc.reconstruct('S3')
      expect(result.source).toBe('synthetic')
    })

    it('falls back to synthetic without instances and completes via progress simulation', async () => {
      const result = await syntheticJob('S4')
      expect(result.source).toBe('synthetic')
      const status = svc.getStatus(result.jobId)
      expect(status.status).toBe('completed')
      expect(status.progress).toBe(100)
    })
  })

  describe('getStatus', () => {
    it('throws NotFoundException for unknown job', () => {
      expect(() => svc.getStatus('nope')).toThrow(NotFoundException)
    })
  })

  describe('generateMPR', () => {
    let realJobId: string

    beforeEach(async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[0] },
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[1] },
      ])
      realJobId = (await svc.reconstruct('S1')).jobId
    })

    it('axial plane from real volume', () => {
      const r = svc.generateMPR({ jobId: realJobId, plane: 'axial', sliceIndex: 1 })
      expect(r.plane).toBe('axial')
      expect(r.source).toBe('real')
      expect(r.dimensions).toEqual({ width: 2, height: 2 })
      expect(r.totalSlices).toBe(2)
      expect(r.windowWidth).toBe(400)
      expect(r.windowLevel).toBe(40)
    })

    it('sagittal plane from real volume', () => {
      const r = svc.generateMPR({ jobId: realJobId, plane: 'sagittal', sliceIndex: 0 })
      expect(r.source).toBe('real')
      expect(r.dimensions).toEqual({ width: 2, height: 10 })
    })

    it('coronal plane from real volume', () => {
      const r = svc.generateMPR({ jobId: realJobId, plane: 'coronal', sliceIndex: 0 })
      expect(r.source).toBe('real')
      expect(r.dimensions).toEqual({ width: 2, height: 10 })
    })

    it('clamps sliceIndex to valid range', () => {
      const r = svc.generateMPR({ jobId: realJobId, plane: 'axial', sliceIndex: 999 })
      expect(r.sliceIndex).toBe(1)
    })

    it('synthetic fallback MPR', async () => {
      jest.useFakeTimers()
      try {
        mockPrisma.dicomInstance.findMany.mockResolvedValue([])
        const job = await svc.reconstruct('SX')
        jest.advanceTimersByTime(2500)
        const r = svc.generateMPR({ jobId: job.jobId, plane: 'axial', sliceIndex: 10 })
        expect(r.source).toBe('synthetic')
        expect(r.dimensions).toEqual({ width: 512, height: 512 })
        expect(r.totalSlices).toBe(256)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('generateMIP', () => {
    let realJobId: string

    beforeEach(async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[0] },
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[1] },
      ])
      realJobId = (await svc.reconstruct('S1')).jobId
    })

    it('axial MIP from real volume', () => {
      const r = svc.generateMIP({ jobId: realJobId, direction: 'axial' })
      expect(r.source).toBe('real')
      expect(r.dimensions).toEqual({ width: 2, height: 2 })
    })

    it('axial MIP with limited thickness', () => {
      const r = svc.generateMIP({ jobId: realJobId, direction: 'axial', thickness: 1 })
      expect(r.source).toBe('real')
    })

    it('sagittal MIP from real volume', () => {
      const r = svc.generateMIP({ jobId: realJobId, direction: 'sagittal' })
      expect(r.source).toBe('real')
    })

    it('coronal MIP from real volume', () => {
      const r = svc.generateMIP({ jobId: realJobId, direction: 'coronal' })
      expect(r.source).toBe('real')
    })
  })

  describe('generateVR', () => {
    let realJobId: string

    beforeEach(async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[0] },
        { seriesInstanceUid: 'S1', modality: 'CT', storagePath: sliceFiles[1] },
      ])
      realJobId = (await svc.reconstruct('S1')).jobId
    })

    it('renders real volume with default preset', () => {
      const r = svc.generateVR({ jobId: realJobId })
      expect(r.source).toBe('real')
      expect(r.width).toBe(2)
      expect(r.height).toBe(2)
      expect(r.pixelData.dataBase64.length).toBeGreaterThan(0)
    })

    it('applies bone/softTissue/vessel/lung presets and clamps opacity', () => {
      for (const preset of ['bone', 'softTissue', 'vessel', 'lung']) {
        const r = svc.generateVR({ jobId: realJobId, preset, opacity: 5, rotation: { x: 30, z: 45 } })
        expect(r.source).toBe('real')
        expect(r.pixelData.dataBase64.length).toBeGreaterThan(0)
      }
    })

    it('unknown preset falls back to default', () => {
      const r = svc.generateVR({ jobId: realJobId, preset: 'nope' as any })
      expect(r.windowWidth).toBe(400)
      expect(r.windowLevel).toBe(40)
    })
  })
})

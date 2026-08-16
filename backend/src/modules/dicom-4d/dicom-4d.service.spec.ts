import { NotFoundException } from '@nestjs/common'
import { Dicom4dService } from './dicom-4d.service'
import {
  buildPhaseDistribution,
  deriveCardiacPhase,
  deriveRespiratoryPhase,
  deriveGatingType,
  ecgCurve,
  interpolationParams,
  phaseSequence,
  rrIntervals,
  CARDIAC_PHASE_COUNT,
  RESPIRATORY_PHASE_COUNT,
} from './phase-engine'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    dicomInstance: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    dicom4dJob: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      upsert: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

const instance = (seriesUid: string, i: number, modality = 'CT') => ({
  id: `inst-${i}`,
  seriesInstanceUid: seriesUid,
  studyInstanceUid: `study-${seriesUid}`,
  modality,
  sopInstanceUid: `sop.${seriesUid}.${i}`,
  storagePath: `/dicom/4d/${seriesUid}/frame/${i}`,
  createdAt: new Date(Date.UTC(2026, 6, 1, 0, i)),
})

describe('Dicom4dService', () => {
  describe('真实系列查询 (DB 可用)', () => {
    let service: Dicom4dService

    beforeEach(() => {
      const prisma = makePrisma({
        dicomInstance: {
          findMany: jest.fn().mockResolvedValue([
            instance('1.2.3.4', 0),
            instance('1.2.3.4', 1),
            instance('1.2.3.4', 2),
            instance('1.2.3.5', 3, 'MR'),
            instance('1.2.3.5', 4, 'MR'),
          ]),
        },
        dicom4dJob: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      })
      service = new Dicom4dService(prisma)
    })

    it('list 从 dicomInstance 按 series 聚合真实 4D 系列 (frameCount=实例数, simulated 未标注)', async () => {
      const list = await service.list()
      expect(list).toHaveLength(2)
      const ct = list.find((s) => s.seriesUid === '1.2.3.4')
      expect(ct?.frameCount).toBe(3)
      expect(ct?.modality).toBe('CT')
      expect(ct?.simulated).toBeUndefined()
      const mr = list.find((s) => s.seriesUid === '1.2.3.5')
      expect(mr?.modality).toBe('MR')
      expect(mr?.dimensions).toEqual({ width: 256, height: 256 })
    })

    it('getFrames 返回真实实例数量帧且 phase 单调递增', async () => {
      const frames = await service.getFrames('1.2.3.4')
      expect(frames).toHaveLength(3)
      expect(frames[0]?.frameIndex).toBe(0)
      expect(frames[0]?.phase).toBe(0)
      expect(frames[0]?.phase).toBeLessThan(frames[1]?.phase as number)
      expect(frames[1]?.phase).toBeLessThan(frames[2]?.phase as number)
      expect(frames[2]?.phase).toBeLessThanOrEqual(100)
    })

    it('getPhase 相位确定性: 同一系列两次调用结果一致', async () => {
      const a = await service.getPhase('1.2.3.4')
      const b = await service.getPhase('1.2.3.4')
      expect(a).toEqual(b)
      expect(a.frameCount).toBe(3)
    })

    it('未知系列抛 NotFound', async () => {
      await expect(service.getFrames('9.9.9.9')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('回退 (DB 不可用)', () => {
    it('list 回退 MOCK_SERIES seed 并标注 simulated=true', async () => {
      const service = new Dicom4dService(makePrisma())
      const list = await service.list()
      expect(list.length).toBeGreaterThan(0)
      expect(list[0]?.simulated).toBe(true)
    })

    it('getFrames 回退 mock 目录生成帧', async () => {
      const service = new Dicom4dService(makePrisma())
      const frames = await service.getFrames('1.2.840.113619.2.55.3.6047.1.2.1.1')
      expect(frames).toHaveLength(80)
    })
  })

  // ==================== [G005 v3.0.6.11-101 Wave 1B (G-07)] 4D 相位派生 ====================

  describe('phase-engine 相位派生 (G-07)', () => {
    it('cardiac 时相覆盖 0..19 且每个时相恰一帧 (20 实例)', () => {
      const seq = phaseSequence(CARDIAC_PHASE_COUNT, 'cardiac')
      expect(seq).toHaveLength(CARDIAC_PHASE_COUNT)
      const bins = new Set(seq.map((p) => p.cardiacPhase))
      expect(bins.size).toBe(CARDIAC_PHASE_COUNT)
      for (let p = 0; p < CARDIAC_PHASE_COUNT; p++) expect(bins.has(p)).toBe(true)
    })

    it('respiratory 时相覆盖 0..9 (10 实例)', () => {
      const seq = phaseSequence(RESPIRATORY_PHASE_COUNT, 'respiratory')
      const bins = new Set(seq.map((p) => p.respiratoryPhase))
      expect(bins.size).toBe(RESPIRATORY_PHASE_COUNT)
    })

    it('derived phases 随实例索引单调非降 (等距分箱)', () => {
      const total = 40
      let prev = -1
      for (let i = 0; i < total; i++) {
        const p = deriveCardiacPhase(i, total)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(CARDIAC_PHASE_COUNT)
        expect(p).toBeGreaterThanOrEqual(prev)
        prev = p
      }
    })

    it('gatingType 确定性: 同一 seriesUid 恒同', () => {
      expect(deriveGatingType('1.2.3.4')).toBe(deriveGatingType('1.2.3.4'))
      expect(['cardiac', 'respiratory', 'both']).toContain(deriveGatingType('abc'))
    })

    it('相位分布: 20 bin 总和 = 帧数, 含空 bin (count=0)', () => {
      const frames = Array.from({ length: 20 }, (_, i) => ({
        frameIndex: i,
        cardiacPhase: deriveCardiacPhase(i, 20),
        respiratoryPhase: i < 5 ? deriveRespiratoryPhase(i, 20) : undefined,
      }))
      const dist = buildPhaseDistribution(frames, 'both')
      expect(dist.cardiac).toHaveLength(CARDIAC_PHASE_COUNT)
      expect(dist.cardiac.reduce((s, b) => s + b.count, 0)).toBe(20)
      expect(dist.respiratory).toHaveLength(RESPIRATORY_PHASE_COUNT)
      expect(dist.respiratory.reduce((s, b) => s + b.count, 0)).toBe(5)
      expect(dist.respiratory.some((b) => b.count === 0)).toBe(true)
      expect(dist.totalFrames).toBe(20)
    })

    it('RR 间期确定性 + bpm 收敛到目标心率', () => {
      const a = rrIntervals('1.2.3.4', 800, 16)
      const b = rrIntervals('1.2.3.4', 800, 16)
      expect(a.rr).toEqual(b.rr)
      expect(a.bpm).toBe(b.bpm)
      expect(a.bpm).toBeGreaterThan(50)
      expect(a.bpm).toBeLessThan(120)
      for (const r of a.rr) expect(r).toBeGreaterThan(600)
      for (const r of a.rr) expect(r).toBeLessThan(1000)
      const c = rrIntervals('9.9.9.9', 800, 16)
      expect(c.rr).not.toEqual(a.rr)
    })

    it('ECG 曲线时间单调递增且 RR 归一化到周期', () => {
      const { rr, bpm } = rrIntervals('ecg-test', 800, 12)
      const curve = ecgCurve(rr, 800)
      expect(curve).toHaveLength(12)
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i]!.t).toBeGreaterThan(curve[i - 1]!.t)
      }
      expect(bpm).toBeGreaterThan(50)
    })

    it('插值参数: 非整除帧数 → linear + 插值帧 > 0', () => {
      const p = interpolationParams(26, 10, 'cardiac')
      expect(p.framesPerPhase).toBe(2)
      expect(p.interpolatedFrames).toBe(20 * 2 - 26)
      expect(p.interpolationMode).toBe('linear')
      const q = interpolationParams(20, 10, 'cardiac')
      expect(q.interpolatedFrames).toBe(0)
      expect(q.interpolationMode).toBe('phase-bin')
    })
  })

  describe('Dicom4dService 新端点 (G-07)', () => {
    let service: Dicom4dService

    beforeEach(() => {
      const prisma = makePrisma({
        dicomInstance: {
          findMany: jest.fn().mockResolvedValue(
            Array.from({ length: 20 }, (_, i) => instance('4d.real.series', i)),
          ),
        },
        dicom4dJob: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      })
      service = new Dicom4dService(prisma)
    })

    it('getPhaseInfo: 分布完整 (20 bin), 帧数与实例一致, 时相单调', async () => {
      const info = await service.getPhaseInfo('4d.real.series')
      expect(info.frameCount).toBe(20)
      expect(info.distribution?.cardiac.reduce((s, b) => s + b.count, 0)).toBe(20)
      const gating = info.gatingType
      if (gating === 'cardiac' || gating === 'both') {
        expect(info.distribution?.cardiac.length).toBe(CARDIAC_PHASE_COUNT)
      }
      if (gating === 'respiratory' || gating === 'both') {
        expect(info.distribution?.respiratory.length).toBe(RESPIRATORY_PHASE_COUNT)
      }
      expect(info.cardiacCycleMs).toBeGreaterThan(0)
      expect(info.respiratoryCycleMs).toBeGreaterThan(0)
    })

    it('getFrames: 真实实例携带 sopInstanceUid + storagePath + 相位字段', async () => {
      const frames = await service.getFrames('4d.real.series')
      expect(frames).toHaveLength(20)
      for (const f of frames) {
        expect(f.sopInstanceUid).toContain('4d.real.series')
        expect(f.storagePath).toContain('/dicom/4d/')
        if (f.cardiacPhase !== undefined) {
          expect(f.cardiacPhase).toBeGreaterThanOrEqual(0)
          expect(f.cardiacPhase).toBeLessThan(CARDIAC_PHASE_COUNT)
        }
        if (f.respiratoryPhase !== undefined) {
          expect(f.respiratoryPhase).toBeGreaterThanOrEqual(0)
          expect(f.respiratoryPhase).toBeLessThan(RESPIRATORY_PHASE_COUNT)
        }
      }
    })

    it('getMovieData: 帧间插值参数 + 心电/RR 数据完整且确定性', async () => {
      const m1 = await service.getMovieData('4d.real.series')
      const m2 = await service.getMovieData('4d.real.series')
      expect(m1).toEqual(m2)
      expect(m1.frameCount).toBe(20)
      expect(m1.framesPerPhase).toBeGreaterThanOrEqual(1)
      expect(m1.interpolatedFrames).toBeGreaterThanOrEqual(0)
      expect(['linear', 'phase-bin']).toContain(m1.interpolationMode)
      expect(m1.bpm).toBeGreaterThan(40)
      expect(m1.rrIntervals.length).toBeGreaterThanOrEqual(8)
      expect(m1.ecgWaveform.length).toBe(m1.rrIntervals.length)
      expect(m1.phaseSequence).toHaveLength(20)
      for (const p of m1.phaseSequence) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(CARDIAC_PHASE_COUNT)
      }
    })

    it('未知系列 phase-info/movie 抛 NotFound', async () => {
      await expect(service.getPhaseInfo('9.9.9.9')).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.getMovieData('9.9.9.9')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})

import * as path from 'node:path'
import * as fs from 'node:fs'
import { SimilarCaseService } from '../src/modules/similar-case/similar-case.service'
import {
  parseDicomPart10,
  extractFeatures,
  buildDemoFeatures,
  imageSimilarity,
  isCtFamily,
  hashString,
} from '../src/modules/similar-case/image-features'

const SAMPLES = path.resolve(__dirname, '..', 'dicom-samples')
const pad = (n: number) => String(n).padStart(3, '0')
const headFiles = Array.from({ length: 10 }, (_, i) => path.join(SAMPLES, 'CT_HEAD', `CT_HEAD_${pad(i + 1)}.dcm`))
const chestFiles = Array.from({ length: 15 }, (_, i) => path.join(SAMPLES, 'CT_CHEST', `CT_CHEST_${pad(i + 1)}.dcm`))
const mrFiles = Array.from({ length: 10 }, (_, i) => path.join(SAMPLES, 'MR_BRAIN', `MR_BRAIN_${pad(i + 1)}.dcm`))

const realFeatures = (files: string[], uid: string, modality: string, bodyPart: string) => ({
  seriesUid: uid,
  studyUid: `study-${uid}`,
  modality,
  bodyPart,
  slices: files.map((f) => parseDicomPart10(fs.readFileSync(f))),
  instanceCount: files.length,
  source: 'real' as const,
})

describe('SimilarCaseService 影像级相似检索 (v3.0.6.11-62)', () => {
  let svc: SimilarCaseService

  beforeAll(() => {
    svc = new SimilarCaseService(null as any)
  })

  describe('真实样本特征提取 (dicom-samples)', () => {
    it('CT 头颅与 MR 脑部特征显著不同', () => {
      const ctHead = extractFeatures(realFeatures(headFiles, 'CT.S.1', 'CT', '颅脑'))
      const mrBrain = extractFeatures(realFeatures(mrFiles, 'MR.S.3', 'MR', '颅脑'))
      // CT 域为 HU; MR 域为归一信号 → 均值/分位数落在不同区间
      expect(ctHead.mean).toBeLessThan(0)
      expect(mrBrain.mean).toBeGreaterThan(100)
      expect(Math.abs(ctHead.mean - mrBrain.mean)).toBeGreaterThan(300)
      expect(ctHead.percentiles[2] - mrBrain.percentiles[2]).not.toBe(0)
      expect(ctHead.histogram.length).toBe(32)
      expect(mrBrain.histogram.length).toBe(32)
      expect(ctHead.vector).not.toEqual(mrBrain.vector)
    })

    it('特征提取确定性: 同一输入两次提取向量完全一致', () => {
      const a = extractFeatures(realFeatures(headFiles, 'CT.S.1', 'CT', '颅脑'))
      const b = extractFeatures(realFeatures(headFiles, 'CT.S.1', 'CT', '颅脑'))
      expect(a.vector).toEqual(b.vector)
      expect(a.histogram).toEqual(b.histogram)
    })

    it('同模态相似度 > 不同模态相似度 (真实样本)', () => {
      const ctHead = extractFeatures(realFeatures(headFiles, 'CT.S.1', 'CT', '颅脑'))
      const ctChest = extractFeatures(realFeatures(chestFiles, 'CT.S.2', 'CT', '胸部'))
      const mrBrain = extractFeatures(realFeatures(mrFiles, 'MR.S.3', 'MR', '颅脑'))
      const sameMod = imageSimilarity(ctHead, ctChest)
      const crossMod = imageSimilarity(ctHead, mrBrain)
      expect(sameMod.score).toBeGreaterThan(crossMod.score)
      // 跨模态家族特征余弦记 0 (域不同不可直接比较)
      expect(crossMod.cos).toBe(0)
    })

    it('直方图总计数与采样体素一致, 高/低密度占比在 [0,1]', () => {
      const ctHead = extractFeatures(realFeatures(headFiles, 'CT.S.1', 'CT', '颅脑'))
      const total = ctHead.histogram.reduce((a, b) => a + b, 0)
      expect(total).toBeGreaterThan(0)
      expect(ctHead.highDensityRatio).toBeGreaterThanOrEqual(0)
      expect(ctHead.highDensityRatio).toBeLessThanOrEqual(1)
      expect(ctHead.lowDensityRatio).toBeGreaterThanOrEqual(0)
      expect(ctHead.lowDensityRatio).toBeLessThanOrEqual(1)
    })
  })

  describe('demo 特征库 (确定性模拟, source: demo)', () => {
    it('同一病例两次生成特征完全一致', () => {
      const a = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1007', studyUid: 'demo-study-rpt-1007', modality: 'CT', bodyPart: '颅脑' })
      const b = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1007', studyUid: 'demo-study-rpt-1007', modality: 'CT', bodyPart: '颅脑' })
      expect(a.vector).toEqual(b.vector)
      expect(a.source).toBe('demo')
    })

    it('CT 颅脑 vs MR 颅脑 特征不同 (域分离)', () => {
      const ct = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1007', studyUid: 'demo-study-rpt-1007', modality: 'CT', bodyPart: '颅脑' })
      const mr = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1009', studyUid: 'demo-study-rpt-1009', modality: 'MR', bodyPart: '颅脑' })
      expect(isCtFamily(ct.modality)).not.toBe(isCtFamily(mr.modality))
      // 域不同 (HU vs 信号): 特征向量不相等; 跨家族特征余弦经模态门控记为 0
      expect(ct.vector).not.toEqual(mr.vector)
      const gated = imageSimilarity(ct, mr)
      expect(gated.cos).toBe(0)
    })

    it('同模态相似度 > 不同模态相似度 (demo 库)', () => {
      const ctHeadA = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1007', studyUid: 's', modality: 'CT', bodyPart: '颅脑' })
      const ctHeadB = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1008', studyUid: 's', modality: 'CT', bodyPart: '颅脑' })
      const ctChest = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1001', studyUid: 's', modality: 'CT', bodyPart: '胸部' })
      const mrBrain = buildDemoFeatures({ seriesUid: 'demo-series-rpt-1009', studyUid: 's', modality: 'MR', bodyPart: '颅脑' })
      const sameMod = imageSimilarity(ctHeadA, ctHeadB).score
      const ctVsChest = imageSimilarity(ctHeadA, ctChest).score
      const crossMod = imageSimilarity(ctHeadA, mrBrain).score
      expect(sameMod).toBeGreaterThan(crossMod)
      expect(sameMod).toBeGreaterThanOrEqual(ctVsChest)
      expect(sameMod).toBeGreaterThan(0.8)
      expect(crossMod).toBeLessThan(0.3)
    })
  })

  describe('imageSearch', () => {
    it('按 seriesUID 检索返回匿名 Top 10, 同模态优先 (DB 不可用回退 demo 库)', async () => {
      const results = await svc.imageSearch({ seriesUID: 'demo-series-rpt-1001', limit: 10 })
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(10)
      expect(results[0].modality).toBe('CT')
      for (const r of results) {
        expect(r.similarity).toBeGreaterThan(0)
        expect(r.featureSummary).toBeDefined()
        expect(r.featureSummary.histogram.length).toBe(32)
        expect((r as any).patientName).toBeUndefined()
        expect((r as any).patientId).toBeUndefined()
      }
      // 同模态排在异模态之前
      const firstNonCt = results.findIndex((r) => !isCtFamily(r.modality))
      const lastCt = results.map((r) => isCtFamily(r.modality)).lastIndexOf(true)
      expect(firstNonCt === -1 || lastCt < firstNonCt).toBe(true)
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity)
    })

    it('CT 胸部检查 → 返回相似 CT 胸影像', async () => {
      const results = await svc.imageSearch({ seriesUID: 'demo-series-rpt-1003', limit: 10 })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].bodyPart).toBe('胸部')
      expect(results[0].modality).toBe('CT')
      expect(results[0].similarity).toBeGreaterThan(50)
    })

    it('结果确定性', async () => {
      const a = await svc.imageSearch({ seriesUID: 'demo-series-rpt-1007', limit: 10 })
      const b = await svc.imageSearch({ seriesUID: 'demo-series-rpt-1007', limit: 10 })
      expect(a.map((r) => `${r.seriesUid}:${r.similarity}`)).toEqual(b.map((r) => `${r.seriesUid}:${r.similarity}`))
    })

    it('未知 seriesUID 返回空', async () => {
      const results = await svc.imageSearch({ seriesUID: 'unknown-series-xyz' })
      expect(results).toEqual([])
    })
  })

  describe('hybridSearch', () => {
    it('reportText + seriesUID → 文本分与影像分分别返回, 综合加权', async () => {
      const results = await svc.hybridSearch({
        reportText: '右肺上叶磨玻璃密度结节,边界清晰,考虑早期肺癌可能',
        seriesUID: 'demo-series-rpt-1001',
        limit: 10,
      })
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) {
        expect(r.textScore).not.toBeNull()
        expect(r.imageScore).not.toBeNull()
        expect(r.featureSummary).not.toBeNull()
        const expected = Math.round(100 * (0.5 * (r.textScore ?? 0) + 0.5 * (r.imageScore ?? 0)))
        expect(r.similarity).toBe(expected)
      }
    })

    it('仅 text → 文本相似主导, imageScore 为 null', async () => {
      const results = await svc.hybridSearch({ reportText: '左侧基底节区梗死灶,脑缺血改变', limit: 10 })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].keywords).toContain('梗死')
      for (const r of results) expect(r.imageScore).toBeNull()
    })

    it('仅 seriesUID → 影像相似主导', async () => {
      const results = await svc.hybridSearch({ seriesUID: 'demo-series-rpt-1007', limit: 10 })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].imageScore).not.toBeNull()
      expect(results[0].similarity).toBeGreaterThan(50)
    })

    it('reportId → 文本分 + 影像分 (demo 关联)', async () => {
      const results = await svc.hybridSearch({ reportId: 'rpt-1001', limit: 10 })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].textScore).not.toBeNull()
    })

    it('结果确定性', async () => {
      const a = await svc.hybridSearch({ reportText: '骨折伴骨质疏松', seriesUID: 'demo-series-rpt-1015', limit: 10 })
      const b = await svc.hybridSearch({ reportText: '骨折伴骨质疏松', seriesUID: 'demo-series-rpt-1015', limit: 10 })
      expect(a.map((r) => `${r.id}:${r.similarity}`)).toEqual(b.map((r) => `${r.id}:${r.similarity}`))
    })
  })

  describe('listImageSeries', () => {
    it('返回 demo 库序列 (DB 不可用)', async () => {
      const list = await svc.listImageSeries()
      expect(list.length).toBeGreaterThan(0)
      const first = list[0]
      expect(first.seriesUid).toBeDefined()
      expect(first.modality).toBeDefined()
      expect(first.source).toBeDefined()
    })
  })

  describe('hashString 确定性', () => {
    it('同一输入同一输出', () => {
      expect(hashString('demo-series-rpt-1001')).toBe(hashString('demo-series-rpt-1001'))
      expect(hashString('a') !== hashString('b')).toBe(true)
    })
  })
})

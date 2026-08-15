/**
 * [G-21 Wave3C] DBT 微钙化检测 → BI-RADS 自动评分 spec
 *  - POST /dbt/:id/birads-score: 钙化(数量/分布/形态) + 肿块(大小/边缘/形态) → 分类 0-5 + 依据
 *  - GET  /dbt/:id/birads-score: 已有评分查询
 * 按 ACR BI-RADS 规则确定性判定 (同一输入恒定同类别, 无随机)
 */
import { NotFoundException } from '@nestjs/common'
import { DbtService } from '../src/modules/dbt/dbt.service'

const prismaStub = { dicomInstance: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } } as never

describe('DbtService BI-RADS 自动评分', () => {
  const svc = new DbtService(prismaStub)

  describe('POST /dbt/:id/birads-score', () => {
    it('无特征输入 → BI-RADS 0 类 (需补充影像评估)', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {})
      expect(res.category).toBe('0')
      expect(res.categoryLabel).toContain('0 类')
      expect(res.recommendation).toContain('补充影像评估')
      expect(res.basis.length).toBeGreaterThan(0)
    })

    it('弥漫分布点状钙化 → BI-RADS 2 类 (典型良性)', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 6, distribution: 'diffuse', morphology: 'punctate' }],
      })
      expect(res.category).toBe('2')
      expect(res.basis.join('')).toContain('典型良性')
    })

    it('簇状分布圆形钙化 → BI-RADS 2 类', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 12, distribution: 'clustered', morphology: 'round' }],
      })
      expect(res.category).toBe('2')
      expect(res.basis.join('')).toContain('簇状')
    })

    it('簇状无定形钙化 → BI-RADS 4B 类', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 8, distribution: 'clustered', morphology: 'amorphous' }],
      })
      expect(res.category).toBe('4B')
      expect(res.recommendation).toContain('活检')
    })

    it('细小多形性钙化 → BI-RADS 4C 类', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 15, distribution: 'clustered', morphology: 'fine_pleomorphic' }],
      })
      expect(res.category).toBe('4C')
    })

    it('细小线样钙化 → BI-RADS 4C 类', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 10, distribution: 'linear', morphology: 'fine_linear' }],
      })
      expect(res.category).toBe('4C')
      expect(res.basis.join('')).toContain('线样')
    })

    it('段样分布点状钙化 (形态良性) → BI-RADS 4A 类 (可疑分布)', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 20, distribution: 'segmental', morphology: 'punctate' }],
      })
      expect(res.category).toBe('4A')
      expect(res.malignancyRisk).toContain('2-10%')
    })

    it('肿块毛刺状边缘 → BI-RADS 5 类 (高度怀疑恶性)', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        mass: { size: 18, shape: 'irregular', margin: 'spiculated' },
      })
      expect(res.category).toBe('5')
      expect(res.malignancyRisk).toContain('95%')
      expect(res.recommendation).toContain('活检')
    })

    it('圆形肿块边缘清晰 (<25mm) → BI-RADS 2 类; ≥25mm → BI-RADS 3 类', async () => {
      const small = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        mass: { size: 12, shape: 'round', margin: 'circumscribed' },
      })
      expect(small.category).toBe('2')
      const large = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        mass: { size: 32, shape: 'round', margin: 'circumscribed' },
      })
      expect(large.category).toBe('3')
    })

    it('不规则形态肿块 → BI-RADS 4C 类', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        mass: { size: 20, shape: 'irregular', margin: 'indistinct' },
      })
      expect(res.category).toBe('4C')
    })

    it('钙化+肿块组合取最重类别 (毛刺肿块 5 类 > 无定形钙化 4B)', async () => {
      const res = await svc.scoreBirads('DBT-STUDY-CURRENT', {
        calcifications: [{ count: 8, distribution: 'clustered', morphology: 'amorphous' }],
        mass: { size: 15, shape: 'irregular', margin: 'spiculated' },
      })
      expect(res.category).toBe('5')
    })

    it('确定性: 同一输入两次评分类别/依据完全一致', async () => {
      const input = {
        calcifications: [{ count: 9, distribution: 'clustered' as const, morphology: 'fine_pleomorphic' as const }],
        mass: { size: 22, shape: 'oval' as const, margin: 'microlobulated' as const },
      }
      const a = await svc.scoreBirads('DBT-STUDY-CURRENT', input)
      const b = await svc.scoreBirads('DBT-STUDY-CURRENT', input)
      expect(a.category).toBe(b.category)
      expect(a.basis).toEqual(b.basis)
      expect(a.basis.length).toBeGreaterThan(1)
    })

    it('未知检查 id → NotFound', async () => {
      await expect(svc.scoreBirads('NO-SUCH-STUDY', { mass: { size: 10, shape: 'round', margin: 'circumscribed' } }))
        .rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('GET /dbt/:id/birads-score', () => {
    it('未评分 → { scored: false }', () => {
      const res = svc.getBiradsScore('DBT-STUDY-PRIOR')
      expect(res.scored).toBe(false)
    })

    it('评分后 → 返回存储的评分结果', async () => {
      const scored = await svc.scoreBirads('DBT-STUDY-PRIOR', {
        calcifications: [{ count: 10, distribution: 'linear', morphology: 'fine_linear' }],
      })
      const res = svc.getBiradsScore('DBT-STUDY-PRIOR')
      expect(res.scored).toBe(true)
      expect(res.score?.category).toBe(scored.category)
      expect(res.score?.studyId).toBe('DBT-STUDY-PRIOR')
      expect(res.score?.basis.length).toBeGreaterThan(0)
    })
  })
})

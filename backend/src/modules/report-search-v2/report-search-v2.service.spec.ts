/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-search-v2) - 报告检索 V2 服务测试
 * 覆盖:
 *   1. 自然语言条件解析: "近 3 个月肺结节阳性 CT 报告" → 时间+模态+关键词 (确定性时间)
 *   2. 检索正确性: 命中包含匹配项; 高亮片段与 ranges; 结构化条件过滤 (机构/医生/时间)
 *   3. 排序确定性: 相关性降序; 同查询两次恒同结果; 跨机构聚合
 *   4. 元数据与统计
 */
import { BadRequestException } from '@nestjs/common'
import { ReportSearchV2Service } from './report-search-v2.service'

const FIXED_NOW = new Date('2026-08-16T00:00:00.000Z').getTime()

function makeService(): ReportSearchV2Service {
  return new ReportSearchV2Service(() => FIXED_NOW)
}

describe('ReportSearchV2Service (Wave 8A 报告检索 V2)', () => {
  describe('1. 自然语言条件解析 (确定性解析器)', () => {
    it('"近 3 个月肺结节阳性 CT 报告" → 时间范围 + 模态 CT + 诊断关键词 肺结节 + 全文关键词', () => {
      const svc = makeService()
      const { conditions, parsed } = svc.parseNaturalLanguage('近 3 个月肺结节阳性 CT 报告')
      expect(conditions.modality).toBe('CT')
      expect(conditions.diagnosisKeyword).toBe('肺结节')
      expect(conditions.keyword).toContain('肺结节')
      expect(conditions.keyword).toContain('阳性')
      expect(conditions.dateFrom).toBe('2026-05-16')
      expect(conditions.dateTo).toBe('2026-08-16')
      const keys = parsed.map((p) => p.key)
      expect(keys).toContain('dateRange')
      expect(keys).toContain('modality')
      expect(keys).toContain('diagnosisKeyword')
      expect(keys).toContain('keyword')
    })

    it('"近 7 天" → 时间范围 (确定性日期)', () => {
      const svc = makeService()
      const { conditions } = svc.parseNaturalLanguage('近 7 天肺炎报告')
      expect(conditions.dateFrom).toBe('2026-08-09')
      expect(conditions.dateTo).toBe('2026-08-16')
      expect(conditions.diagnosisKeyword).toBe('肺炎')
    })

    it('"2026年6月脑梗死 MR" → 月份范围 + 模态 MR + 诊断关键词 脑梗死', () => {
      const svc = makeService()
      const { conditions } = svc.parseNaturalLanguage('2026年6月脑梗死 MR')
      expect(conditions.dateFrom).toBe('2026-06-01')
      expect(conditions.dateTo).toBe('2026-06-30')
      expect(conditions.modality).toBe('MR')
      expect(conditions.diagnosisKeyword).toBe('脑梗死')
    })

    it('"东城分院 张医生" → 机构维度解析 (跨机构检索条件)', () => {
      const svc = makeService()
      const { conditions } = svc.parseNaturalLanguage('东城分院 张海涛 骨折')
      expect(conditions.organization).toBe('东城分院')
      expect(conditions.doctor).toBe('张海涛')
      expect(conditions.diagnosisKeyword).toBe('骨折')
    })

    it('空短语 → BadRequestException; 无匹配短语 → 空条件 (不抛错)', () => {
      const svc = makeService()
      expect(() => svc.parseNaturalLanguage('  ')).toThrow(BadRequestException)
      const { conditions } = svc.parseNaturalLanguage('随便看看')
      expect(conditions.modality).toBeUndefined()
      expect(conditions.dateFrom).toBeUndefined()
    })

    it('同短语两次解析 → 条件完全一致 (确定性, 无随机)', () => {
      const svc = makeService()
      const a = svc.parseNaturalLanguage('近 3 个月肺结节阳性 CT 报告')
      const b = svc.parseNaturalLanguage('近 3 个月肺结节阳性 CT 报告')
      expect(a.conditions).toEqual(b.conditions)
    })
  })

  describe('2. 检索正确性', () => {
    it('关键词全文检索 → 命中均匹配关键词, 高亮片段 ranges 切片等于关键词', () => {
      const svc = makeService()
      const res = svc.search({ keyword: '肺结节' })
      expect(res.total).toBeGreaterThan(0)
      for (const item of res.items) {
        expect(item.matchedKeywords).toContain('肺结节')
      }
      const withSnippet = res.items.filter((i) => i.snippets.length > 0)
      expect(withSnippet.length).toBeGreaterThan(0)
      for (const item of withSnippet) {
        for (const s of item.snippets) {
          expect(s.text.length).toBeGreaterThan(0)
          expect(Array.isArray(s.ranges)).toBe(true)
          for (const r of s.ranges) {
            expect(r.start).toBeLessThan(r.end)
            expect(s.text.slice(r.start, r.end)).toBe('肺结节')
          }
        }
      }
    })

    it('结构化条件: 模态 + 机构 + 医生 + 时间范围 过滤', () => {
      const svc = makeService()
      const res = svc.search({ modality: 'MR', organization: '东城分院', doctor: '李建国' })
      expect(res.total).toBeGreaterThan(0)
      for (const item of res.items) {
        expect(item.modality).toBe('MR')
        expect(item.organization).toBe('东城分院')
        expect(item.doctorName).toBe('李建国')
      }
    })

    it('诊断关键词检索: 命中结论含诊断词 (权重更高)', () => {
      const svc = makeService()
      const res = svc.search({ diagnosisKeyword: '脑梗死' })
      expect(res.total).toBeGreaterThan(0)
      for (const item of res.items) {
        expect(item.conclusion).toContain('脑梗死')
      }
    })

    it('时间范围检索: 仅返回范围内报告', () => {
      const svc = makeService()
      const res = svc.search({ dateFrom: '2026-07-01', dateTo: '2026-08-31' })
      expect(res.total).toBeGreaterThan(0)
      for (const item of res.items) {
        expect(item.examDate >= '2026-07-01' && item.examDate <= '2026-08-31').toBe(true)
      }
    })

    it('自然语言一体化: 短语 → 条件 → 命中 (近 3 个月肺结节阳性 CT 报告)', () => {
      const svc = makeService()
      const res = svc.naturalLanguage('近 3 个月肺结节阳性 CT 报告')
      expect(res.phrase).toBe('近 3 个月肺结节阳性 CT 报告')
      expect(res.conditions.modality).toBe('CT')
      expect(res.conditions.diagnosisKeyword).toBe('肺结节')
      expect(res.total).toBeGreaterThan(0)
      for (const item of res.items) {
        expect(item.modality).toBe('CT')
        expect(item.conclusion).toContain('肺结节')
        expect(item.examDate >= '2026-05-16').toBe(true)
      }
    })
  })

  describe('3. 排序确定性与聚合', () => {
    it('相关性降序: 首个命中相关性最高, 且全部 ≤ 100', () => {
      const svc = makeService()
      const res = svc.search({ keyword: '结节' })
      expect(res.total).toBeGreaterThanOrEqual(3)
      for (let i = 1; i < res.items.length; i += 1) {
        expect(res.items[i - 1]!.relevance).toBeGreaterThanOrEqual(res.items[i]!.relevance)
      }
      expect(res.items[0]!.relevance).toBeGreaterThanOrEqual(40)
      expect(res.items.every((i) => i.relevance >= 0 && i.relevance <= 100)).toBe(true)
    })

    it('同查询两次 → 命中 id 顺序完全一致 (确定性)', () => {
      const svc = makeService()
      const a = svc.search({ keyword: '肺结节' })
      const b = svc.search({ keyword: '肺结节' })
      expect(a.items.map((i) => i.reportId)).toEqual(b.items.map((i) => i.reportId))
      expect(a.items.map((i) => i.relevance)).toEqual(b.items.map((i) => i.relevance))
    })

    it('聚合统计: 模态/机构/医生分布与命中集一致, dateRange 正确', () => {
      const svc = makeService()
      const res = svc.search({ organization: '中心医院' })
      const agg = res.aggregations
      expect(agg.total).toBe(res.total)
      expect(agg.byOrganization.every((o) => o.key === '中心医院')).toBe(true)
      expect(agg.byModality.reduce((a, x) => a + x.count, 0)).toBe(res.total)
      expect(agg.byDoctor.reduce((a, x) => a + x.count, 0)).toBe(res.total)
      expect(agg.dateRange.from).toBeTruthy()
      expect(agg.dateRange.to).toBeTruthy()
    })

    it('跨机构检索: 机构维度命中仅含该机构, byOrganization 单值', () => {
      const svc = makeService()
      const res = svc.search({ keyword: '脑梗死', organization: '东城分院' })
      expect(res.total).toBe(1)
      expect(res.items[0]!.organization).toBe('东城分院')
      expect(res.aggregations.byOrganization[0]!.key).toBe('东城分院')
    })
  })

  describe('4. 元数据与统计', () => {
    it('getMeta: 模态/机构/医生/关键词 非空且确定性排序', () => {
      const svc = makeService()
      const meta = svc.getMeta()
      expect(meta.modalities).toContain('CT')
      expect(meta.modalities).toContain('MR')
      expect(meta.organizations.length).toBeGreaterThanOrEqual(4)
      expect(meta.doctors.length).toBeGreaterThan(0)
      expect(meta.keywords).toContain('肺结节')
      expect(meta.organizations).toEqual(svc.getMeta().organizations)
    })

    it('getStats: 语料统计 (机构/模态分布 + 危急值数 + 日期范围)', () => {
      const svc = makeService()
      const stats = svc.getStats()
      expect(stats.totalReports).toBeGreaterThanOrEqual(13)
      expect(stats.organizationCount).toBeGreaterThanOrEqual(4)
      expect(stats.criticalCount).toBeGreaterThanOrEqual(3)
      expect(stats.byOrganization.reduce((a, x) => a + x.count, 0)).toBe(stats.totalReports)
      expect(stats.latestExamDate).toBe('2026-08-12')
      expect(stats.earliestExamDate).toBe('2026-02-14')
    })
  })
})

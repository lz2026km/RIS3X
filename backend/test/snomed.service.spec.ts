import { SnomedService } from '../src/modules/snomed/snomed.service'

describe('SnomedService', () => {
  let svc: SnomedService

  beforeAll(() => {
    svc = new SnomedService()
  })

  it('encode maps Chinese medical terms to SNOMED codes', async () => {
    const result = await svc.encode('患者肺部结节，伴有钙化')
    expect(result.codes.length).toBeGreaterThanOrEqual(2)
    expect(result.codes.some(c => c.conceptId === '30092000')).toBe(true) // Nodule
    expect(result.codes.some(c => c.conceptId === '473840003')).toBe(true) // Calcification
    expect(result.text).toBe('患者肺部结节，伴有钙化')
  })

  it('encode returns empty codes for text with no matching terms', async () => {
    const result = await svc.encode('患者无明显异常发现')
    expect(result.codes).toHaveLength(0)
  })

  it('encode deduplicates matching concept IDs', async () => {
    const result = await svc.encode('结节和肿瘤和骨折')
    const conceptIds = result.codes.map(c => c.conceptId)
    const uniqueIds = new Set(conceptIds)
    expect(conceptIds.length).toBe(uniqueIds.size)
  })

  it('search finds SNOMED codes by English term', async () => {
    const result = await svc.search('Nodule')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].pt).toContain('Nodule')
  })

  it('search returns empty array for empty query', async () => {
    const result = await svc.search('')
    expect(result).toEqual([])
  })
})

import { NlpService } from '../src/modules/nlp/nlp.service'

describe('NlpService', () => {
  let svc: NlpService

  beforeAll(() => {
    svc = new NlpService()
  })

  it('spellcheck returns original text with suggestions for known words', async () => {
    const result = await svc.spellcheck('患者肝囊肿，考虑肝硬化')
    expect(result.original).toBe('患者肝囊肿，考虑肝硬化')
    expect(result.suggestions.length).toBeGreaterThanOrEqual(2)
    expect(result.suggestions.some(s => s.word === '肝囊肿')).toBe(true)
    expect(result.suggestions.some(s => s.word === '肝硬化')).toBe(true)
  })

  it('spellcheck returns empty suggestions for text with no known words', async () => {
    const result = await svc.spellcheck('患者无明显异常')
    expect(result.suggestions).toHaveLength(0)
  })

  it('terminology normalizes medical abbreviations', async () => {
    const result = await svc.terminology('患者肺CA可能性大，有胸水')
    expect(result.normalized.some(n => n.term === 'CA' && n.preferred === '癌')).toBe(true)
    expect(result.normalized.some(n => n.term === '胸水' && n.preferred === '胸腔积液')).toBe(true)
  })

  it('terminology returns empty normalized for text with no known terms', async () => {
    const result = await svc.terminology('患者各项指标正常')
    expect(result.normalized).toHaveLength(0)
  })

  it('terminology deduplicates overlapping matches at same offset', async () => {
    const result = await svc.terminology('胸水胸水')
    const offsets = result.normalized.map(n => n.offset)
    const uniqueOffsets = new Set(offsets)
    expect(offsets.length).toBe(uniqueOffsets.size)
  })
})

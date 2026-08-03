import { CrossModalService } from '../src/modules/cross-modal/cross-modal.service'

describe('CrossModalService', () => {
  let svc: CrossModalService

  beforeAll(() => {
    svc = new CrossModalService()
  })

  it('search without query returns first three images', () => {
    expect(svc.search('')).toHaveLength(3)
    expect(svc.search(undefined as any)).toHaveLength(3)
  })

  it('search matches by patient name', () => {
    const results = svc.search('zhang')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].patientName).toBe('Zhang San')
  })

  it('search matches by patient id and modality', () => {
    expect(svc.search('P003').map((i) => i.id)).toEqual(['img-003'])
    const ct = svc.search('CT')
    expect(ct.every((i) => i.modality === 'CT')).toBe(true)
  })

  it('search matches by description', () => {
    const results = svc.search('pneumonia')
    expect(results[0].description).toContain('pneumonia')
  })

  it('findSimilar returns top-5 by similarity excluding source', () => {
    const similar = svc.findSimilar('img-001')
    expect(similar).toHaveLength(4)
    expect(similar.some((i) => i.id === 'img-001')).toBe(false)
    expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1].similarity)
  })

  it('findSimilar falls back to first three for unknown image', () => {
    expect(svc.findSimilar('nope')).toHaveLength(3)
  })
})

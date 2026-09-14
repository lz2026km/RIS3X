import { ListQuerySchema, PaginationQuerySchema, resolvePagination } from './pagination.dto'

describe('[v3.0.6.11-104 Wave 1C] pagination.dto', () => {
  it('coerces page/pageSize from query strings', () => {
    const parsed = PaginationQuerySchema.parse({ page: '2', pageSize: '50' })
    expect(parsed).toEqual({ page: 2, pageSize: 50 })
  })

  it('rejects pageSize above the 200 cap', () => {
    const result = PaginationQuerySchema.safeParse({ pageSize: '201' })
    expect(result.success).toBe(false)
  })

  it('keeps both paging styles optional (backward compatible)', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({})
    expect(ListQuerySchema.parse({})).toEqual({})
  })

  it('accepts common list filters', () => {
    const parsed = ListQuerySchema.parse({
      keyword: 'ct',
      status: 'SIGNED',
      dateFrom: '2026-01-01',
      dateTo: '2026-02-01',
    })
    expect(parsed.keyword).toBe('ct')
    expect(parsed.status).toBe('SIGNED')
  })

  describe('resolvePagination', () => {
    it('prefers page/pageSize and computes skip/take', () => {
      expect(resolvePagination({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 })
    })

    it('uses the provided default page size when only page is given', () => {
      expect(resolvePagination({ page: 2 }, 50)).toEqual({ skip: 50, take: 50 })
    })

    it('falls back to skip/take when page/pageSize are absent', () => {
      expect(resolvePagination({ skip: 10, take: 5 })).toEqual({ skip: 10, take: 5 })
    })

    it('returns empty object when nothing is provided (service defaults apply)', () => {
      expect(resolvePagination({})).toEqual({ skip: undefined, take: undefined })
    })
  })
})

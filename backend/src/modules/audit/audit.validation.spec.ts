import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuditExportQuerySchema, AuditListQuerySchema } from './audit.controller'

describe('[v3.0.6.11-104 Wave 1C] 审计列表查询校验', () => {
  const list = new ZodValidationPipe(AuditListQuerySchema)
  const exportPipe = new ZodValidationPipe(AuditExportQuerySchema)

  it('强制分页与筛选参数为数字', () => {
    const q = list.transform({ page: '2', pageSize: '50', action: 'DELETE_REPORT' }, {} as never) as Record<string, unknown>
    expect(q).toEqual({ page: 2, pageSize: 50, action: 'DELETE_REPORT' })
  })

  it('拒绝非法 pageSize (>200) 与 page (<1)', () => {
    expect(() => list.transform({ pageSize: '201' }, {} as never)).toThrow(BadRequestException)
    expect(() => list.transform({ page: '0' }, {} as never)).toThrow(BadRequestException)
  })

  it('导出查询不含分页字段, 保留筛选', () => {
    const q = exportPipe.transform({ userId: 'u1', startDate: '2026-01-01' }, {} as never)
    expect(q).toEqual({ userId: 'u1', startDate: '2026-01-01' })
  })
})

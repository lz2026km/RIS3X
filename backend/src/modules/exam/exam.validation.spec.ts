import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { resolvePagination } from '../../common/dto/pagination.dto'
import { ExamListQuerySchema } from './exam.controller'

describe('[v3.0.6.11-104 Wave 1C] 检查列表查询校验', () => {
  const pipe = new ZodValidationPipe(ExamListQuerySchema)

  it('接受筛选参数并强制分页为数字', () => {
    const q = pipe.transform(
      { page: '2', pageSize: '30', patientId: 'p1', modality: 'CT', state: 'SCHEDULED' },
      {} as never,
    ) as Record<string, unknown>
    expect(q).toMatchObject({ page: 2, pageSize: 30, patientId: 'p1', modality: 'CT', state: 'SCHEDULED' })
  })

  it('支持 skip/take 兼容形态', () => {
    const q = pipe.transform({ skip: '0', take: '50' }, {} as never) as Record<string, unknown>
    expect(resolvePagination(q as never)).toEqual({ skip: 0, take: 50 })
  })

  it('未传分页时保持 service 默认 (take 为 undefined)', () => {
    expect(resolvePagination(pipe.transform({}, {} as never) as never)).toEqual({ skip: undefined, take: undefined })
  })

  it('拒绝非法 pageSize', () => {
    expect(() => pipe.transform({ pageSize: '999' }, {} as never)).toThrow(BadRequestException)
  })
})

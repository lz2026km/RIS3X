import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  CreateFollowUpTemplateSchema,
  ListFollowUpQuerySchema,
  UpdateFollowUpTemplateSchema,
} from './followup.schema'

describe('[v3.0.6.11-104 Wave 1C] 随访模板/列表校验', () => {
  const create = new ZodValidationPipe(CreateFollowUpTemplateSchema)
  const update = new ZodValidationPipe(UpdateFollowUpTemplateSchema)

  it('接受合法的随访模板', () => {
    const body = create.transform(
      { name: '肺结节随访', category: '病种', intervals: [90, 180], items: ['薄层CT'], active: true },
      {} as never,
    )
    expect(body).toMatchObject({ name: '肺结节随访', intervals: [90, 180] })
  })

  it('拒绝缺少 name / 非法 intervals 的模板', () => {
    expect(() => create.transform({ category: '病种' }, {} as never)).toThrow(BadRequestException)
    expect(() => create.transform({ name: 'x', intervals: [0] }, {} as never)).toThrow(BadRequestException)
  })

  it('更新模板使用 partial schema (空 body 可用)', () => {
    expect(update.transform({}, {} as never)).toEqual({})
    expect(update.transform({ active: false }, {} as never)).toEqual({ active: false })
  })

  it('列表查询强制分页为数字并限制 pageSize ≤ 200', () => {
    const ok = ListFollowUpQuerySchema.parse({ page: '2', pageSize: '100', status: 'PENDING' })
    expect(ok).toEqual({ page: 2, pageSize: 100, status: 'PENDING' })
    expect(ListFollowUpQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false)
  })
})

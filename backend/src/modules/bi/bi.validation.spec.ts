import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CreateWallTemplateSchema, UpdateWallTemplateSchema } from './bi.controller'

describe('[v3.0.6.11-104 Wave 1C] BI 大屏模板 body 校验', () => {
  const create = new ZodValidationPipe(CreateWallTemplateSchema)
  const update = new ZodValidationPipe(UpdateWallTemplateSchema)

  it('accepts a valid create payload', () => {
    const body = create.transform({ name: '科室总览', layout: 'overview', active: true }, {} as never)
    expect(body).toEqual({ name: '科室总览', layout: 'overview', active: true })
  })

  it('rejects missing name and invalid layout', () => {
    expect(() => create.transform({ layout: 'overview' }, {} as never)).toThrow(BadRequestException)
    expect(() => create.transform({ name: 'x', layout: 'nope' }, {} as never)).toThrow(BadRequestException)
  })

  it('update accepts partial body (PATCH semantics)', () => {
    expect(update.transform({}, {} as never)).toEqual({})
    expect(update.transform({ active: false }, {} as never)).toEqual({ active: false })
  })

  it('update still rejects an unknown layout', () => {
    expect(() => update.transform({ layout: 'bad' }, {} as never)).toThrow(BadRequestException)
  })
})

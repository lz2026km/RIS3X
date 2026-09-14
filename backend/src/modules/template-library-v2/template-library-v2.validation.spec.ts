import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { FavoriteSchema } from './template-library-v2.controller'

describe('[v3.0.6.11-104 Wave 1C] 模板收藏 body 校验', () => {
  const pipe = new ZodValidationPipe(FavoriteSchema)

  it('接受空 body 与合法 userId', () => {
    expect(pipe.transform({}, {} as never)).toEqual({})
    expect(pipe.transform({ userId: 'u-1' }, {} as never)).toEqual({ userId: 'u-1' })
  })

  it('拒绝超长 userId', () => {
    expect(() => pipe.transform({ userId: 'x'.repeat(65) }, {} as never)).toThrow(BadRequestException)
  })
})

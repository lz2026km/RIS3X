import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CreateObjectSchema } from './vna.controller'

describe('[v3.0.6.11-104 Wave 1C] VNA 归档对象 body 校验', () => {
  const pipe = new ZodValidationPipe(CreateObjectSchema)

  it('接受合法的归档对象元数据', () => {
    const body = pipe.transform(
      { patientId: 'p1', objectType: 'document', name: '报告.pdf', size: 1024 },
      {} as never,
    )
    expect(body).toMatchObject({ patientId: 'p1', objectType: 'document', size: 1024 })
  })

  it('空 body 也合法 (所有字段可选, 兼容 multipart)', () => {
    expect(pipe.transform({}, {} as never)).toEqual({})
  })

  it('拒绝非法 objectType / 负数 size / 超限 size', () => {
    expect(() => pipe.transform({ objectType: 'video' }, {} as never)).toThrow(BadRequestException)
    expect(() => pipe.transform({ size: -1 }, {} as never)).toThrow(BadRequestException)
    expect(() => pipe.transform({ size: 200 * 1024 * 1024 }, {} as never)).toThrow(BadRequestException)
  })
})

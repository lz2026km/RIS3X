import { BadRequestException } from '@nestjs/common'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { HistoryQuerySchema } from './notifications.controller'

describe('[v3.0.6.11-104 Wave 1C] 通知历史查询校验', () => {
  const pipe = new ZodValidationPipe(HistoryQuerySchema)

  it('缺省时套用 page=1/pageSize=50 默认值', () => {
    expect(pipe.transform({}, {} as never)).toEqual({ page: 1, pageSize: 50 })
  })

  it('接受 limit 与 type 筛选并强制为数字', () => {
    const q = pipe.transform({ page: '3', limit: '20', type: 'CRITICAL' }, {} as never) as Record<string, unknown>
    expect(q).toEqual({ page: 3, pageSize: 50, limit: 20, type: 'CRITICAL' })
  })

  it('拒绝超过 200 的 limit 与非法 page', () => {
    expect(() => pipe.transform({ limit: '500' }, {} as never)).toThrow(BadRequestException)
    expect(() => pipe.transform({ page: '0' }, {} as never)).toThrow(BadRequestException)
  })
})

/**
 * G005 W3-BackendParity - AI 诊断通用模型路由服务 spec
 * GET/POST /ai-diagnosis/:model/results[/:id][/review]; 仅支持 4 模型, 其他 400。
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AiDiagnosisService } from './ai-diagnosis.service'

describe('AiDiagnosisService 通用模型路由', () => {
  let svc: AiDiagnosisService
  beforeEach(() => {
    svc = new AiDiagnosisService()
  })

  it('4 个支持模型均返回结果列表', () => {
    for (const model of ['lung-cad', 'breast-cad', 'fracture-cad', 'cardiac-ai']) {
      const res = svc.listResultsByModel(model)
      expect(res.success).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
      expect((res.data as unknown[]).length).toBeGreaterThan(0)
    }
  })

  it('未知模型 → BadRequestException (400)', () => {
    expect(() => svc.listResultsByModel('mystery-ai')).toThrow(BadRequestException)
  })

  it('按 id 返回详情, 不存在 → 404', () => {
    const list = svc.listResultsByModel('lung-cad') as unknown as { data: Array<{ id: string }> }
    const id = list.data[0]!.id
    const res = svc.getResultByModel('lung-cad', id)
    expect((res.data as { id: string }).id).toBe(id)
    expect(() => svc.getResultByModel('lung-cad', 'NOPE')).toThrow(NotFoundException)
  })

  it('复核更新状态', () => {
    const list = svc.listResultsByModel('cardiac-ai') as unknown as { data: Array<{ id: string }> }
    const id = list.data[0]!.id
    const res = svc.reviewResultByModel('cardiac-ai', id, { status: 'confirmed', comment: 'ok' })
    expect((res.data as { status: string }).status).toBe('confirmed')
  })

  it('查询过滤 status', () => {
    const res = svc.listResultsByModel('lung-cad', { status: 'confirmed' })
    for (const r of res.data as Array<{ status: string }>) expect(r.status).toBe('confirmed')
  })
})

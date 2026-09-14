import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WorklistService } from '../src/modules/worklist/worklist.service'

describe('WorklistService', () => {
  let svc: WorklistService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      exam: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: complete 会查/建 PENDING_ASSIGNMENT 报告
      report: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'r1', state: 'PENDING_ASSIGNMENT' }),
      },
    }
    svc = new WorklistService(mockPrisma)
  })

  const exam = (state: string, timeoutVerified = true) => ({ id: 'e1', state, timeoutVerified, patient: {} })

  it('checkIn transitions SCHEDULED exam to ARRIVED', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(exam('SCHEDULED'))
    mockPrisma.exam.update.mockResolvedValue({ id: 'e1', state: 'ARRIVED' })
    const r = await svc.checkIn('e1')
    expect(r.state).toBe('ARRIVED')
    expect(mockPrisma.exam.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'ARRIVED' }) }))
  })

  it('checkIn rejects non-SCHEDULED exam', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(exam('IN_PROGRESS'))
    await expect(svc.checkIn('e1')).rejects.toThrow(BadRequestException)
  })

  it('start transitions ARRIVED exam to IN_PROGRESS', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(exam('ARRIVED'))
    mockPrisma.exam.update.mockResolvedValue({ id: 'e1', state: 'IN_PROGRESS' })
    const r = await svc.start('e1')
    expect(r.state).toBe('IN_PROGRESS')
  })

  it('start rejects non-ARRIVED exam', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(exam('SCHEDULED'))
    await expect(svc.start('e1')).rejects.toThrow(BadRequestException)
  })

  // [v3.0.6.11-104 Wave 3A P0] 检查前核对门禁: 未完成 Time-Out 不允许开始检查
  it('start rejects when pre-exam Time-Out not verified', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(exam('ARRIVED', false))
    await expect(svc.start('e1')).rejects.toThrow('TIMEOUT_NOT_VERIFIED')
  })

  it('complete transitions IN_PROGRESS exam to COMPLETED', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(exam('IN_PROGRESS'))
    mockPrisma.exam.update.mockResolvedValue({ id: 'e1', state: 'COMPLETED' })
    const r = await svc.complete('e1')
    expect(r.state).toBe('COMPLETED')
  })

  it('cancel works from SCHEDULED/ARRIVED/IN_PROGRESS and rejects otherwise', async () => {
    for (const state of ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS']) {
      mockPrisma.exam.findUnique.mockResolvedValue(exam(state))
      mockPrisma.exam.update.mockResolvedValue({ id: 'e1', state: 'CANCELLED' })
      await expect(svc.cancel('e1', '患者取消')).resolves.toMatchObject({ state: 'CANCELLED' })
    }
    mockPrisma.exam.findUnique.mockResolvedValue(exam('COMPLETED'))
    await expect(svc.cancel('e1')).rejects.toThrow(BadRequestException)
  })

  it('throws NotFoundException for missing exam', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(null)
    await expect(svc.checkIn('ghost')).rejects.toThrow(NotFoundException)
  })
})

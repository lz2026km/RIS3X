import { NotFoundException } from '@nestjs/common'
import { CadService } from './cad.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    dicomInstance: {
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

describe('CadService', () => {
  describe('确定性检测', () => {
    let service: CadService

    beforeEach(() => {
      service = new CadService(makePrisma())
    })

    it('同一 instanceId 两次 detect 结果完全一致 (无随机)', async () => {
      const a = await service.detect('INST-001')
      const b = await service.detect('INST-001')
      expect(a.findings).toEqual(b.findings)
      expect(a.findings.length).toBeGreaterThanOrEqual(2)
      expect(a.findings.every((f) => f.confidence >= 0.55 && f.confidence <= 0.98)).toBe(true)
      expect(a.findings.every((f) => f.type === 'nodule' || f.type === 'calcification')).toBe(true)
    })

    it('不同 instanceId 生成不同检出结果', async () => {
      const a = await service.detect('INST-001')
      const b = await service.detect('INST-002')
      expect(a.findings).not.toEqual(b.findings)
    })

    it('getResult 返回已检测结果 (内存), 未知实例抛 NotFound', async () => {
      await service.detect('INST-003')
      const result = await service.getResult('INST-003')
      expect(result.instanceId).toBe('INST-003')
      await expect(service.getResult('UNKNOWN-XYZ')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('detect 结果标注 simulated=true (schema 无 cadResult 表, 内存未落库)', async () => {
      const result = await service.detect('INST-004')
      expect(result.simulated).toBe(true)
      expect(result.heatmapUrl).toBe('/ai/cad/heatmap/INST-004')
    })
  })

  describe('真实影像数据驱动', () => {
    it('命中 dicomInstance 时以 modality/patient 生成确定性结果', async () => {
      const prisma = makePrisma({
        dicomInstance: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'dcm-1',
            sopInstanceUid: '1.2.840.1',
            modality: 'MR',
            report: { patient: { name: 'Zhang San' } },
          }),
        },
      })
      const service = new CadService(prisma)
      const a = await service.detect('1.2.840.1')
      const b = await service.detect('1.2.840.1')
      expect(a.findings).toEqual(b.findings)
      expect((service as unknown as { prisma: unknown }).prisma).toBeDefined()
    })
  })
})

/**
 * G005 RIS v3.0.6.11-79 (W3-B) - ClinicalConfigService 测试
 * GET/PUT /system/clinical-config + PUT /system/clinical-config/:module (SystemConfig key=clinical_config)
 */
import { ClinicalConfigService, CLINICAL_CONFIG_KEY } from './clinical-config.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    systemConfig: {
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      upsert: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

const makeService = (prisma: unknown) => new ClinicalConfigService(prisma as never)

describe('ClinicalConfigService (W3-B persistence)', () => {
  describe('getConfig', () => {
    it('returns null modules when nothing is stored', async () => {
      const prisma = makePrisma({
        systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      })
      const service = makeService(prisma)
      const cfg = await service.getConfig()
      expect(cfg).toEqual({ modules: null, updatedAt: null })
    })

    it('parses stored modules payload', async () => {
      const stored = {
        modules: { gradingScales: { scales: [{ id: 'dr' }] }, iolFormulas: { formulas: [] } },
        updatedAt: '2026-08-07T00:00:00.000Z',
      }
      const prisma = makePrisma({
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue({ key: CLINICAL_CONFIG_KEY, value: stored }),
        },
      })
      const service = makeService(prisma)
      const cfg = await service.getConfig()
      expect(cfg.modules).not.toBeNull()
      expect((cfg.modules as Record<string, unknown>)['gradingScales']).toEqual({ scales: [{ id: 'dr' }] })
      expect(cfg.updatedAt).toBe('2026-08-07T00:00:00.000Z')
    })

    it('returns null when stored value has no modules field', async () => {
      const prisma = makePrisma({
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue({ key: CLINICAL_CONFIG_KEY, value: { foo: 1 } }),
        },
      })
      const service = makeService(prisma)
      const cfg = await service.getConfig()
      expect(cfg.modules).toBeNull()
    })
  })

  describe('saveConfig', () => {
    it('persists all 7 modules and returns saved shape', async () => {
      const upsert = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({ systemConfig: { findUnique: jest.fn().mockResolvedValue(null), upsert } })
      const service = makeService(prisma)
      const modules = {
        gradingScales: { scales: [] },
        aiModels: { models: [] },
        imagingDevices: { devices: [] },
        kpiThresholds: { metrics: [] },
        reportTemplates: { templates: [] },
        findingsLexicon: { entries: [] },
        iolFormulas: { formulas: [] },
      }
      const result = await service.saveConfig(modules)
      expect(result.modules).toEqual(modules)
      expect(typeof result.updatedAt).toBe('string')
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: CLINICAL_CONFIG_KEY },
          update: expect.objectContaining({ value: expect.objectContaining({ modules }) }),
        }),
      )
    })

    it('throws 400 for empty modules', async () => {
      const service = makeService(makePrisma({}))
      await expect(service.saveConfig({})).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws 400 for unknown module key', async () => {
      const service = makeService(makePrisma({}))
      await expect(
        service.saveConfig({ gradingScales: {}, evil_key: {} }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('saveModule', () => {
    it('persists a single module merged over existing ones', async () => {
      const upsert = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        systemConfig: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              key: CLINICAL_CONFIG_KEY,
              value: { modules: { gradingScales: { scales: [{ id: 'dr' }] } }, updatedAt: 'x' },
            }),
          upsert,
        },
      })
      const service = makeService(prisma)
      const saved = await service.saveModule('iolFormulas', { formulas: [{ name: 'SRK/T' }] })
      expect(saved.module).toEqual({ formulas: [{ name: 'SRK/T' }] })
      expect(typeof saved.updatedAt).toBe('string')
      const payload = upsert.mock.calls[0]?.[0] as { update: { value: { modules: Record<string, unknown> } } }
      expect(payload.update.value.modules['gradingScales']).toEqual({ scales: [{ id: 'dr' }] })
      expect(payload.update.value.modules['iolFormulas']).toEqual({ formulas: [{ name: 'SRK/T' }] })
    })

    it('throws 404 for unknown module key', async () => {
      const service = makeService(makePrisma({}))
      await expect(service.saveModule('nope', {})).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws 400 for non-object module payload', async () => {
      const service = makeService(makePrisma({}))
      await expect(service.saveModule('gradingScales', 'text')).rejects.toBeInstanceOf(
        BadRequestException,
      )
      await expect(service.saveModule('gradingScales', null)).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })
  })
})

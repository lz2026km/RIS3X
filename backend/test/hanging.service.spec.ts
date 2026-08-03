import { NotFoundException } from '@nestjs/common'
import { HangingService } from '../src/modules/hanging/hanging.service'

const failingPrisma = {
  hangingProtocol: {
    count: async () => { throw new Error('db unavailable') },
    findFirst: async () => { throw new Error('db unavailable') },
    create: async () => { throw new Error('db unavailable') },
    findMany: async () => { throw new Error('db unavailable') },
    findUnique: async () => { throw new Error('db unavailable') },
    update: async () => { throw new Error('db unavailable') },
    delete: async () => { throw new Error('db unavailable') },
  },
}

describe('HangingService (auto-hanging)', () => {
  let svc: HangingService

  beforeEach(() => {
    svc = new HangingService(failingPrisma as never)
  })

  it('seeds 8 default protocols', async () => {
    const all = await svc.list()
    expect(all.length).toBe(8)
    const chest = all.find((p) => p.modality === 'CT' && p.bodyPart === 'CHEST')
    expect(chest?.layout).toMatchObject({ rows: 2, cols: 2 })
    const mrHead = all.find((p) => p.modality === 'MR' && p.bodyPart === 'HEAD')
    expect(mrHead?.layout).toMatchObject({ rows: 2, cols: 3 })
  })

  it('filters list by modality and bodyPart', async () => {
    const drs = await svc.list('DR')
    expect(drs.length).toBe(1)
    expect(drs[0]?.name).toContain('DR 胸部')
    const mrs = await svc.list('MR', 'HEAD')
    expect(mrs.length).toBe(1)
    expect(mrs[0]?.bodyPart).toBe('HEAD')
  })

  it('creates a custom protocol', async () => {
    const created = await svc.create({
      name: 'US 肝脏 扫查',
      modality: 'US',
      bodyPart: 'LIVER',
      layout: { rows: 1, cols: 2, seriesOrder: ['灰阶', '彩色多普勒'] },
      priority: 70,
    })
    expect(created.id).toBeTruthy()
    const found = await svc.getById(created.id)
    expect(found?.name).toBe('US 肝脏 扫查')
    expect(found?.layout.cols).toBe(2)
  })

  it('updates a protocol', async () => {
    const created = await svc.create({
      name: 'XA 冠脉 造影',
      modality: 'XA',
      bodyPart: 'CARDIAC',
      layout: { rows: 1, cols: 1, seriesOrder: ['正位'] },
    })
    const updated = await svc.update(created.id, {
      name: 'XA 冠脉 双体位造影',
      layout: { rows: 1, cols: 2, seriesOrder: ['正位', '左前斜'] },
    })
    expect(updated.name).toBe('XA 冠脉 双体位造影')
    expect(updated.layout.cols).toBe(2)
  })

  it('throws NotFound for unknown update/remove', async () => {
    await expect(svc.update('nope', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.remove('nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('removes a custom protocol', async () => {
    const created = await svc.create({
      name: 'TO-DELETE',
      modality: 'CT',
      bodyPart: 'HEAD',
      layout: { rows: 1, cols: 1, seriesOrder: [] },
    })
    await svc.remove(created.id)
    expect(await svc.getById(created.id)).toBeNull()
  })

  it('matches CT CHEST to the 2x2 dual-window protocol', () => {
    const result = svc.match({
      modality: 'CT',
      bodyPart: 'CHEST',
      series: [
        { description: '轴位-肺窗', modality: 'CT' },
        { description: '轴位-纵隔窗', modality: 'CT' },
        { description: '冠状位', modality: 'CT' },
      ],
    })
    expect(result.protocol?.modality).toBe('CT')
    expect(result.protocol?.bodyPart).toBe('CHEST')
    expect(result.layout).toMatchObject({ rows: 2, cols: 2 })
    expect(result.cells.length).toBe(4)
    expect(result.cells.filter((c) => c.empty).length).toBe(0)
    expect(result.cells[0]?.series).toBe('轴位-肺窗')
    expect(result.reasons.some((r) => r.includes('模态+部位'))).toBe(true)
    expect(result.candidates.length).toBeGreaterThan(0)
  })

  it('matches MR HEAD to the 2x3 multi-sequence protocol', () => {
    const result = svc.match({ modality: 'MR', bodyPart: 'HEAD', seriesCount: 5 })
    expect(result.protocol?.name).toContain('MR 头颅')
    expect(result.layout).toMatchObject({ rows: 2, cols: 3 })
    expect(result.cells.length).toBe(6)
  })

  it('falls back to generic protocol when no modality/bodyPart match', () => {
    const result = svc.match({ modality: 'MG', bodyPart: 'BREAST' })
    expect(result.protocol).not.toBeNull()
    expect(result.reasons.some((r) => r.includes('通用兜底'))).toBe(true)
  })
})

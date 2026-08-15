/**
 * G005 RIS v3.0.6.11-100 (Wave 2B 报告-影像标注双向同步) - ReportsService 影像标注测试
 * 端点 (backend/src/reports):
 *   - POST /reports/:id/image-annotations  保存 (覆盖) 报告关联影像标注
 *   - GET  /reports/:id/image-annotations  读取 (无记录返回空列表形状)
 * 内存 + 种子, 与 report-annotation 模块同风格
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReportsService } from '../src/reports/reports.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'
import { createNoopGateway, NotificationsGateway } from '../src/notifications/notifications.gateway'
import { SystemConfigService } from '../src/system-storage/system-config.service'
import { FollowUpService } from '../src/modules/followup/followup.service'

const mockSystemConfig = {
  getNumber: jest.fn().mockResolvedValue(20),
  getString: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  invalidate: jest.fn(),
}

const mockPrisma = {
  report: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  reportRevision: { create: jest.fn() },
  $transaction: jest.fn(),
}

const mockQueue = { addReportExport: jest.fn() }

const VALID_ITEMS = [
  { id: 'ann-1', type: 'arrow', x1: 100, y1: 120, x2: 150, y2: 100, label: '右肺上叶结节', color: '#ff4d4f' },
  { id: 'ann-2', type: 'ruler', x1: 200, y1: 220, x2: 280, y2: 220, label: '长径', color: '#fbbf24' },
] as const

describe('ReportsService - 报告影像标注 (image-annotations)', () => {
  let svc: ReportsService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: NotificationsGateway, useValue: createNoopGateway() },
        { provide: SystemConfigService, useValue: mockSystemConfig },
        { provide: FollowUpService, useValue: {} },
      ],
    }).compile()
    svc = module.get(ReportsService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('GET /reports/:id/image-annotations', () => {
    it('种子报告返回非空标注 (箭头/标尺/圆 ROI, 含坐标与颜色)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000001' })
      const res = await svc.getImageAnnotations('RPT-000001')
      expect(res.reportId).toBe('RPT-000001')
      expect(res.annotations.length).toBeGreaterThanOrEqual(3)
      expect(res.annotations.some((a) => a.type === 'arrow')).toBe(true)
      expect(res.annotations.some((a) => a.type === 'ruler')).toBe(true)
      expect(res.annotations[0]!.x1).toBeGreaterThanOrEqual(0)
      expect(res.annotations[0]!.color).toBeTruthy()
      expect(mockPrisma.report.findUnique).toHaveBeenCalledWith({ where: { id: 'RPT-000001' } })
    })

    it('无标注记录的报告返回空列表形状 (annotations: [])', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000002' })
      const res = await svc.getImageAnnotations('RPT-000002')
      expect(res.reportId).toBe('RPT-000002')
      expect(res.annotations).toEqual([])
      expect(res.imageBase64).toBe('')
      expect(res.updatedAt).toBeNull()
    })

    it('报告不存在 → NotFoundException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.getImageAnnotations('RPT-NOPE')).rejects.toThrow(NotFoundException)
    })
  })

  describe('POST /reports/:id/image-annotations', () => {
    it('保存成功: 覆盖写入并返回记录 (含源检查 UID / 标注 / 创建人)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000100' })
      const saved = await svc.saveImageAnnotations(
        'RPT-000100',
        {
          studyUid: '1.2.840.10008.1',
          seriesUid: '1.2.840.10008.2',
          instanceUid: '1.2.840.10008.3',
          annotations: [...VALID_ITEMS] as any,
          imageBase64: 'data:image/png;base64,iVBORw0KGgo=',
        },
        'u-doctor-1',
      )
      expect(saved.reportId).toBe('RPT-000100')
      expect(saved.studyUid).toBe('1.2.840.10008.1')
      expect(saved.seriesUid).toBe('1.2.840.10008.2')
      expect(saved.instanceUid).toBe('1.2.840.10008.3')
      expect(saved.annotations).toHaveLength(2)
      expect(saved.createdBy).toBe('u-doctor-1')
      expect(saved.updatedAt).toBeTruthy()
      // 保存后 GET 可回读
      const read = await svc.getImageAnnotations('RPT-000100')
      expect(read.annotations.map((a) => a.id)).toEqual(['ann-1', 'ann-2'])
    })

    it('重复保存覆盖旧标注 (updatedAt 更新, 数量替换)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000100' })
      await svc.saveImageAnnotations('RPT-000100', { annotations: [...VALID_ITEMS] as any }, 'u-1')
      const before = (await svc.getImageAnnotations('RPT-000100')).updatedAt
      await new Promise((r) => setTimeout(r, 5))
      const saved2 = await svc.saveImageAnnotations(
        'RPT-000100',
        { annotations: [{ id: 'ann-x', type: 'circle', x1: 10, y1: 10, x2: 40, y2: 40, label: '仅一条', color: '#22c55e' }] as any },
        'u-1',
      )
      expect(saved2.annotations).toHaveLength(1)
      expect(saved2.annotations[0]!.id).toBe('ann-x')
      expect(saved2.updatedAt).not.toBe(before)
      const read = await svc.getImageAnnotations('RPT-000100')
      expect(read.annotations).toHaveLength(1)
    })

    it('annotations 空数组 → BadRequestException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000100' })
      await expect(svc.saveImageAnnotations('RPT-000100', { annotations: [] as any }, 'u-1')).rejects.toThrow(BadRequestException)
    })

    it('标注类型非法 (boxx/无 id) → BadRequestException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000100' })
      await expect(
        svc.saveImageAnnotations('RPT-000100', { annotations: [{ id: 'a1', type: 'boxx', x1: 0, y1: 0, x2: 1, y2: 1, label: '', color: '#fff' }] as any }, 'u-1'),
      ).rejects.toThrow(BadRequestException)
      await expect(
        svc.saveImageAnnotations('RPT-000100', { annotations: [{ type: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1, label: '', color: '#fff' }] as any }, 'u-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('坐标非数字 → BadRequestException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000100' })
      await expect(
        svc.saveImageAnnotations('RPT-000100', { annotations: [{ id: 'a1', type: 'arrow', x1: 'abc', y1: 0, x2: 1, y2: 1, label: '', color: '#fff' }] as any }, 'u-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('报告不存在 → NotFoundException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.saveImageAnnotations('RPT-NOPE', { annotations: [...VALID_ITEMS] as any }, 'u-1')).rejects.toThrow(NotFoundException)
    })

    it('annotation type 支持全部 4 类: arrow|circle|ruler|box', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'RPT-000100' })
      const all = (['arrow', 'circle', 'ruler', 'box'] as const).map((type, i) => ({
        id: `t${i}`, type, x1: i, y1: i, x2: i + 10, y2: i + 10, label: type, color: '#fff',
      }))
      const saved = await svc.saveImageAnnotations('RPT-000100', { annotations: all as any }, 'u-1')
      expect(saved.annotations.map((a) => a.type)).toEqual(['arrow', 'circle', 'ruler', 'box'])
    })
  })
})

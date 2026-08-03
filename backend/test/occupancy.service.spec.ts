import { NotFoundException } from '@nestjs/common'
import { OccupancyService } from '../src/modules/occupancy/occupancy.service'

describe('OccupancyService', () => {
  let svc: OccupancyService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      examRoom: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      exam: { findMany: jest.fn() },
    }
    svc = new OccupancyService(mockPrisma)
  })

  describe('getRooms', () => {
    it('maps rooms with overdue flag for long-occupied rooms', async () => {
      const longAgo = new Date(Date.now() - 20 * 60 * 1000)
      mockPrisma.examRoom.findMany.mockResolvedValue([
        { id: 'r1', roomNo: 'CT1', status: 'occupied', currentPatient: '张三', examItem: 'CT头', startTime: new Date(), expectedEnd: longAgo },
        { id: 'r2', roomNo: 'MR1', status: 'idle', startTime: null, expectedEnd: null },
        { id: 'r3', name: 'DR2', status: 'disinfecting' },
      ] as any)
      const rooms = await svc.getRooms()
      expect(rooms).toHaveLength(3)
      expect(rooms[0].overdue).toBe(true)
      expect(rooms[1].overdue).toBe(false)
      expect(rooms[2].roomNo).toBe('DR2')
    })

    it('marks not-overdue when expectedEnd is recent', async () => {
      mockPrisma.examRoom.findMany.mockResolvedValue([
        { id: 'r1', roomNo: 'CT1', status: 'occupied', expectedEnd: new Date(Date.now() - 5 * 60 * 1000) },
      ] as any)
      const rooms = await svc.getRooms()
      expect(rooms[0].overdue).toBe(false)
    })
  })

  describe('getQueue', () => {
    it('returns queued exams with positions', async () => {
      mockPrisma.examRoom.findUnique.mockResolvedValue({ id: 'r1', roomNo: 'CT1' })
      mockPrisma.exam.findMany.mockResolvedValue([
        { patientName: '张三', examItem: 'CT头' },
        { patientName: '李四', examItem: 'CT腹' },
      ] as any)
      const q = await svc.getQueue('r1')
      expect(q.queue).toHaveLength(2)
      expect(q.queue[0]).toMatchObject({ position: 1, estimatedWaitMin: 15 })
      expect(q.queue[1].position).toBe(2)
    })

    it('throws for unknown room', async () => {
      mockPrisma.examRoom.findUnique.mockResolvedValue(null)
      await expect(svc.getQueue('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getTrends', () => {
    it('returns 24 hourly points', async () => {
      mockPrisma.examRoom.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
      const points = await svc.getTrends()
      expect(points).toHaveLength(24)
      expect(points[0].total).toBe(2)
      expect(points[0].rate).toBeGreaterThanOrEqual(0)
      expect(points[0].rate).toBeLessThanOrEqual(100)
      expect(points[0].time).toMatch(/^\d{2}:00$/)
    })
  })

  describe('updateStatus', () => {
    it('updates to a valid status', async () => {
      mockPrisma.examRoom.findUnique.mockResolvedValue({ id: 'r1', roomNo: 'CT1' })
      mockPrisma.examRoom.update.mockResolvedValue({ id: 'r1', roomNo: 'CT1', status: 'occupied' })
      const r = await svc.updateStatus('r1', 'occupied')
      expect(r.status).toBe('occupied')
      expect(r.overdue).toBe(false)
    })

    it('throws for unknown room or invalid status', async () => {
      mockPrisma.examRoom.findUnique.mockResolvedValue(null)
      await expect(svc.updateStatus('nope', 'idle')).rejects.toThrow(NotFoundException)
      mockPrisma.examRoom.findUnique.mockResolvedValue({ id: 'r1', roomNo: 'CT1' })
      await expect(svc.updateStatus('r1', 'bogus')).rejects.toThrow(NotFoundException)
    })
  })
})

import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface RoomStatus {
  id: string
  roomNo: string
  status: 'idle' | 'occupied' | 'disinfecting' | 'fault'
  currentPatient?: string
  examItem?: string
  startTime?: string
  expectedEnd?: string
  overdue: boolean
}

export interface QueueEntry {
  position: number
  patientName: string
  examItem: string
  estimatedWaitMin: number
}

export interface TrendPoint {
  time: string
  occupied: number
  total: number
  rate: number
}

@Injectable()
export class OccupancyService {
  constructor(private readonly prisma: PrismaService) {}

  async getRooms(): Promise<RoomStatus[]> {
    const rooms = await this.prisma.examRoom.findMany({ orderBy: { roomNo: 'asc' } })
    const now = new Date()
    return rooms.map(r => {
      const status = (r.status ?? 'idle') as RoomStatus['status']
      const overdue = status === 'occupied' && r.expectedEnd ? now > new Date(r.expectedEnd) : false
      return {
        id: r.id,
        roomNo: r.roomNo ?? r.name,
        status,
        currentPatient: r.currentPatient ?? undefined,
        examItem: r.examItem ?? undefined,
        startTime: r.startTime?.toISOString() ?? undefined,
        expectedEnd: r.expectedEnd?.toISOString() ?? undefined,
        overdue: overdue && now.getTime() - new Date(r.expectedEnd!).getTime() > 15 * 60 * 1000,
      }
    })
  }

  async getQueue(roomId: string): Promise<{ roomId: string; queue: QueueEntry[] }> {
    const room = await this.prisma.examRoom.findUnique({ where: { id: roomId } })
    if (!room) throw new NotFoundException(`Room ${roomId} not found`)
    const exams = await this.prisma.exam.findMany({
      where: { roomId, status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    return {
      roomId,
      queue: exams.map((e, i) => ({
        position: i + 1,
        patientName: e.patientName ?? '--',
        examItem: e.examItem ?? '--',
        estimatedWaitMin: (i + 1) * 15,
      })),
    }
  }

  async getTrends(): Promise<TrendPoint[]> {
    const now = new Date()
    const points: TrendPoint[] = []
    const rooms = await this.prisma.examRoom.findMany()
    const total = rooms.length || 1
    for (let i = 23; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 60 * 60 * 1000)
      const occupied = Math.floor(Math.random() * (total + 1))
      points.push({
        time: `${String(t.getHours()).padStart(2, '0')}:00`,
        occupied,
        total,
        rate: Math.round((occupied / total) * 100),
      })
    }
    return points
  }

  async updateStatus(roomId: string, status: string): Promise<RoomStatus> {
    const room = await this.prisma.examRoom.findUnique({ where: { id: roomId } })
    if (!room) throw new NotFoundException(`Room ${roomId} not found`)
    const valid = ['idle', 'occupied', 'disinfecting', 'fault']
    if (!valid.includes(status)) throw new NotFoundException(`Invalid status: ${status}`)
    const updated = await this.prisma.examRoom.update({
      where: { id: roomId },
      data: { status: status as any },
    })
    return {
      id: updated.id,
      roomNo: updated.roomNo ?? updated.name,
      status: status as RoomStatus['status'],
      overdue: false,
    }
  }
}

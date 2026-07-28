import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class WorklistService {
  constructor(private readonly prisma: PrismaService) {}

  private async getExam(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, include: { patient: true } })
    if (!exam) throw new NotFoundException(`Exam ${id} not found`)
    return exam
  }

  async checkIn(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'SCHEDULED') throw new BadRequestException(`Exam ${id} is not in SCHEDULED state`)
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'ARRIVED', startedAt: new Date() },
      include: { patient: true },
    })
  }

  async start(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'ARRIVED') throw new BadRequestException(`Exam ${id} is not in ARRIVED state`)
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'IN_PROGRESS' },
      include: { patient: true },
    })
  }

  async complete(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'IN_PROGRESS') throw new BadRequestException(`Exam ${id} is not in IN_PROGRESS state`)
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'COMPLETED', completedAt: new Date() },
      include: { patient: true },
    })
  }

  async cancel(id: string, reason?: string) {
    const exam = await this.getExam(id)
    if (!['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'].includes(exam.state)) {
      throw new BadRequestException(`Exam ${id} cannot be cancelled in ${exam.state} state`)
    }
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'CANCELLED' },
      include: { patient: true },
    })
  }
}

import { Injectable, NotFoundException } from '@nestjs/common'
import { hash } from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

const publicUserSelect = {
  id: true,
  tenantId: true,
  username: true,
  fullName: true,
  role: true,
  department: true,
  active: true,
  totpEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(skip = 0, take = 20) {
    return this.prisma.user.findMany({
      skip,
      take,
      select: { id: true, username: true, fullName: true, role: true, department: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, fullName: true, role: true, department: true, active: true, createdAt: true, updatedAt: true, tenantId: true, totpEnabled: true },
    })
    if (!u) throw new NotFoundException(`User ${id} not found`)
    return u
  }

  async create(input: {
    username: string
    password: string
    fullName: string
    role: string
    department?: string
  }) {
    const passwordHash = await hash(input.password, 10)
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        fullName: input.fullName,
        role: input.role as any,
        department: input.department,
        tenantId: 'default',
      },
      select: publicUserSelect,
    })
  }

  async update(id: string, data: { fullName?: string; role?: string; department?: string; active?: boolean }) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`User ${id} not found`)
    return this.prisma.user.update({ where: { id }, data: data as any, select: publicUserSelect })
  }

  async delete(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`User ${id} not found`)
    return this.prisma.user.update({ where: { id }, data: { active: false }, select: publicUserSelect })
  }

  async getActivity(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException(`User ${userId} not found`)
    const [ops, loginLogs] = await Promise.all([
      this.prisma.worklistOp.findMany({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.loginLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ])
    return { ops, loginLogs }
  }
}

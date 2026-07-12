jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true),
}))

import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { UsersService } from '../src/users/users.service'
import { PrismaService } from '../src/prisma/prisma.service'

const fullUser = {
  id: 'u1', username: 'doc1', passwordHash: 'hash',
  fullName: 'Dr. One', role: 'DOCTOR' as const,
  department: 'Radiology', active: true,
  tenantId: 't1',
  totpSecret: null, totpEnabled: false,
  failedLoginAttempts: 0, lockedUntil: null,
  createdAt: new Date(), updatedAt: new Date(),
}

describe('UsersService', () => {
  let svc: UsersService
  let prisma: any

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    worklistOp: { findMany: jest.fn().mockResolvedValue([]) },
    loginLog: { findMany: jest.fn().mockResolvedValue([]) },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(UsersService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns paginated users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([fullUser])
      const result = await svc.list(0, 10)
      expect(result).toHaveLength(1)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 })
      )
    })
  })

  describe('findById', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser)
      const result = await svc.findById('u1')
      expect(result.id).toBe('u1')
    })

    it('throws NotFoundException when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(svc.findById('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates user with hashed password', async () => {
      mockPrisma.user.create.mockResolvedValue(fullUser)
      const result = await svc.create({
        username: 'doc1',
        password: 'secret',
        fullName: 'Dr. One',
        role: 'DOCTOR',
        department: 'Radiology',
      })
      expect(result.id).toBe('u1')
      expect(mockPrisma.user.create).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('updates user fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser)
      mockPrisma.user.update.mockResolvedValue({ ...fullUser, fullName: 'Updated' })
      const result = await svc.update('u1', { fullName: 'Updated' })
      expect(result.fullName).toBe('Updated')
    })

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(svc.update('x', {})).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('soft-deletes by setting active=false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser)
      mockPrisma.user.update.mockResolvedValue({ ...fullUser, active: false })
      const result = await svc.delete('u1')
      expect(result.active).toBe(false)
    })

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(svc.delete('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getActivity', () => {
    it('returns ops and loginLogs', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser)
      const result = await svc.getActivity('u1')
      expect(result).toHaveProperty('ops')
      expect(result).toHaveProperty('loginLogs')
    })

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(svc.getActivity('x')).rejects.toThrow(NotFoundException)
    })
  })
})

jest.mock('bcrypt', () => ({
  hashSync: jest.fn().mockReturnValue('hashed-pass'),
  compare: jest.fn(),
  hash: jest.fn(),
}))

import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException, ForbiddenException, HttpException } from '@nestjs/common'
import { AuthService } from '../src/auth/auth.service'
import { PrismaService } from '../src/prisma/prisma.service'
import * as bcrypt from 'bcrypt'

describe('AuthService', () => {
  let auth: AuthService
  let prisma: any
  let jwt: jest.Mocked<JwtService>

  const mockUser = {
    id: 'u1', tenantId: 't1',
    username: 'doc1', passwordHash: 'hashed-pass',
    fullName: 'Dr. One', role: 'DOCTOR' as const,
    department: null, active: true,
    totpSecret: null, totpEnabled: false,
    failedLoginAttempts: 0, lockedUntil: null,
    createdAt: new Date(), updatedAt: new Date(),
  }

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    loginLog: {
      create: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('mock-token') },
        },
      ],
    }).compile()
    auth = module.get(AuthService)
    prisma = module.get(PrismaService)
    jwt = module.get(JwtService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
  })

  describe('login', () => {
    it('returns token + user for valid credentials without TOTP', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      const result = await auth.login('doc1', 'pass123', '127.0.0.1')
      expect(result.accessToken).toBe('mock-token')
      expect(result.user.totpRequired).toBe(false)
      expect(mockPrisma.loginLog.create).toHaveBeenCalledTimes(1)
    })

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.user.update.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
      await expect(auth.login('doc1', 'wrong', '127.0.0.1')).rejects.toThrow(UnauthorizedException)
    })

    it('throws HttpException when account is locked', async () => {
      const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 60000) }
      mockPrisma.user.findUnique.mockResolvedValue(lockedUser)
      await expect(auth.login('doc1', 'pass123', '127.0.0.1')).rejects.toThrow(HttpException)
    })

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(auth.login('nobody', 'x', '')).rejects.toThrow(UnauthorizedException)
    })

    it('requires TOTP for ADMIN/DIRECTOR roles without totpEnabled', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN', totpEnabled: false }
      mockPrisma.user.findUnique.mockResolvedValue(adminUser)
      await expect(auth.login('admin', 'pass123', '')).rejects.toThrow(ForbiddenException)
    })

    it('returns temp token when TOTP required', async () => {
      const totpUser = { ...mockUser, role: 'DIRECTOR', totpEnabled: true }
      mockPrisma.user.findUnique.mockResolvedValue(totpUser)
      const result = await auth.login('dir', 'pass123', '')
      expect(result.user.totpRequired).toBe(true)
    })
  })

  describe('verifyTotp', () => {
    it('throws when TOTP not configured', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, totpSecret: null })
      await expect(auth.verifyTotp('u1', '123456')).rejects.toThrow(UnauthorizedException)
    })

    it('throws for invalid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, totpSecret: 'JBSWY3DPEHPK3PXP' })
      await expect(auth.verifyTotp('u1', '000000')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('setupTotp', () => {
    it('generates secret and updates user', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, totpSecret: 'test', totpEnabled: true })
      const result = await auth.setupTotp('u1')
      expect(result.secret).toBeDefined()
      expect(result.qrCodeUrl).toBeDefined()
    })
  })

  describe('disableTotp', () => {
    it('clears totp fields', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUser)
      await expect(auth.disableTotp('u1')).resolves.toBeUndefined()
    })
  })

  describe('me', () => {
    it('returns user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      const result = await auth.me('u1')
      expect(result.username).toBe('doc1')
      expect(result.role).toBe('DOCTOR')
    })

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(auth.me('x')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('changePassword', () => {
    it('updates password hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.user.update.mockResolvedValue(mockUser)
      const result = await auth.changePassword('u1', 'pass123', 'newPass123')
      expect(result.ok).toBe(true)
    })

    it('throws when old password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
      await expect(auth.changePassword('u1', 'wrong', 'newPass123')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('refresh', () => {
    it('issues new access token', async () => {
      const result = await auth.refresh('u1', 'doc1', 'DOCTOR')
      expect(result.accessToken).toBe('mock-token')
      expect(result.user.id).toBe('u1')
    })
  })
})

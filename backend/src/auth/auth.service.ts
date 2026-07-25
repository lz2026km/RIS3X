import { HttpException, HttpStatus, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare, hash } from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import * as speakeasy from 'speakeasy'

export interface JwtPayload {
  sub: string
  username: string
  role: string
  tenantId?: string
  tokenVersion?: number
  totpPending?: true
}

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000
const TOTP_REQUIRED_ROLES = new Set(['ADMIN', 'DIRECTOR'])

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login(username: string, password: string, ip?: string): Promise<{ accessToken: string; user: { id: string; username: string; role: string; totpRequired: boolean } }> {
    const user = await this.prisma.user.findUnique({ where: { username } })
    if (!user) throw new UnauthorizedException('账号或密码错误')

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      throw new HttpException(`账号已锁定，请${remaining}分钟后重试`, HttpStatus.TOO_MANY_REQUESTS)
    }

    const ok = await compare(password, user.passwordHash)
    if (!ok) {
      const failedLoginAttempts = user.failedLoginAttempts + 1
      const lockedUntil = failedLoginAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts, lockedUntil },
      })
      await this.prisma.loginLog.create({
        data: {
          userId: user.id,
          ip: ip || 'unknown',
          userAgent: '',
          success: false,
          tenantId: user.tenantId ?? 'default',
        },
      })
      throw new UnauthorizedException('账号或密码错误')
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    await this.prisma.loginLog.create({
      data: {
        userId: user.id,
        ip: ip || 'unknown',
        userAgent: '',
        success: true,
        tenantId: user.tenantId ?? 'default',
      },
    })

    const totpRequired = user.totpEnabled || TOTP_REQUIRED_ROLES.has(user.role)

    if (TOTP_REQUIRED_ROLES.has(user.role) && !user.totpEnabled) {
      throw new ForbiddenException('ADMIN / DIRECTOR 角色必须先启用 TOTP 双因素认证')
    }

    if (!totpRequired) {
      const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role, tenantId: user.tenantId, tokenVersion: user.tokenVersion }
      const accessToken = await this.jwt.signAsync(payload)
      return {
        accessToken,
        user: { id: user.id, username: user.username, role: user.role, totpRequired: false },
      }
    }

    const tempPayload: JwtPayload & { totpPending: true } = { sub: user.id, username: user.username, role: user.role, tenantId: user.tenantId, tokenVersion: user.tokenVersion, totpPending: true }
    const tempToken = await this.jwt.signAsync(tempPayload, { expiresIn: '5m' })
    return {
      accessToken: tempToken,
      user: { id: user.id, username: user.username, role: user.role, totpRequired: true },
    }
  }

  async verifyTotp(userId: string, token: string): Promise<{ accessToken: string; user: { id: string; username: string; role: string } }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.totpSecret) throw new UnauthorizedException('TOTP未配置')

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1,
    })
    if (!verified) throw new UnauthorizedException('TOTP验证码错误')

    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role, tenantId: user.tenantId, tokenVersion: user.tokenVersion }
    const accessToken = await this.jwt.signAsync(payload)
    return {
      accessToken,
      user: { id: user.id, username: user.username, role: user.role },
    }
  }

  async setupTotp(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const secret = speakeasy.generateSecret({ name: 'G005-RIS' })
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret.base32, totpEnabled: true },
    })
    return { secret: secret.base32, qrCodeUrl: secret.otpauth_url || '' }
  }

  async disableTotp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    })
  }

  async me(userId: string): Promise<{ id: string; username: string; role: string; fullName: string; totpEnabled: boolean }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!u) throw new UnauthorizedException('用户不存在')
    return { id: u.id, username: u.username, role: u.role, fullName: u.fullName, totpEnabled: u.totpEnabled }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ ok: true }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!u) throw new UnauthorizedException('用户不存在')
    if (!(await compare(oldPassword, u.passwordHash))) throw new UnauthorizedException('原密码错误')
    const newHash = await hash(newPassword, 10)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    })
    return { ok: true }
  }

  /**
   * Issue a fresh access token. Called by the refresh endpoint after the
   * refresh-token cookie has been verified. TTL stays at 15m (mirrors
   * JwtModule.signOptions.expiresIn).
   */
  async refresh(userId: string, username: string, role: string, tenantId?: string): Promise<{ accessToken: string; user: { id: string; username: string; role: string } }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } })
    const payload: JwtPayload = { sub: userId, username, role, tenantId, tokenVersion: user?.tokenVersion }
    const accessToken = await this.jwt.signAsync(payload)
    return { accessToken, user: { id: userId, username, role } }
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })
  }
}

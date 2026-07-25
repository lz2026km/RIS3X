import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'

type AuthenticatedUser = {
  sub: string
  username: string
  role: string
  tenantId: string
  totpPending: boolean
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly prisma: PrismaService

  constructor(prisma: PrismaService, config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET')
    if (!secret || (config.get<string>('NODE_ENV') === 'production' && Buffer.byteLength(secret) < 32)) {
      throw new Error('JWT_SECRET must be at least 32 bytes in production')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    })
    this.prisma = prisma
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !Number.isInteger(payload.tokenVersion)) {
      throw new UnauthorizedException('无效Token')
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { username: true, role: true, tenantId: true, tokenVersion: true, active: true },
    })
    if (!user || !user.active) {
      throw new UnauthorizedException('用户不存在或已停用')
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token已过期，请重新登录')
    }
    return {
      sub: payload.sub,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
      totpPending: payload.totpPending === true,
    }
  }
}

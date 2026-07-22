import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'

const JWT_SECRET = process.env['JWT_SECRET']

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly prisma: PrismaService

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    })
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    this.prisma = new PrismaService()
  }

  async validate(payload: JwtPayload & { tokenVersion?: number }): Promise<{ sub: string; username: string; role: string; tenantId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, active: true },
    })
    if (!user || !user.active) {
      throw new UnauthorizedException('用户不存在或已停用')
    }
    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token已过期，请重新登录')
    }
    return { sub: payload.sub, username: payload.username, role: payload.role, tenantId: payload.tenantId || '' }
  }
}

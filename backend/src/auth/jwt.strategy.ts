/**
 * G005 放射RIS系统 v3.0.1 - JWT 策略
 */
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload } from './auth.service'

const JWT_SECRET = process.env['JWT_SECRET']

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    if (!JWT_SECRET) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production')
      }
      throw new Error('JWT_SECRET environment variable is required')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    })
  }

  validate(payload: JwtPayload): { sub: string; username: string; role: string } {
    return { sub: payload.sub, username: payload.username, role: payload.role }
  }
}

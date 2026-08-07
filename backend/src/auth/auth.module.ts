/**
 * G005 放射RIS系统 v3.0.1 - 认证模块
 * 简版:登录 / 刷新 / 当前用户 / 修改密码
 */
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET')
        if (!secret || (config.get<string>('NODE_ENV') === 'production' && Buffer.byteLength(secret) < 32)) {
          throw new Error('JWT_SECRET must be at least 32 bytes in production')
        }
        // [W3-B] JWT_EXPIRES_IN: access token 有效期 (默认 15m)
        const rawExpiresIn = (config.get<string>('JWT_EXPIRES_IN') ?? '15m').trim() || '15m'
        return {
          secret,
          signOptions: {
            expiresIn: rawExpiresIn as JwtSignOptions['expiresIn'],
            algorithm: 'HS256' as const,
          },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

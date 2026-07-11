/**
 * G005 放射RIS系统 v3.0.1 - 认证模块
 * 简版:登录 / 刷新 / 当前用户 / 修改密码
 */
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'

const jwtSecret = process.env['JWT_SECRET']

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required')
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/public.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AuthService } from './auth.service'
// TODO v3.0.4: 安装 @nestjs/throttler 并应用 5 req/min 限流

export const LoginSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6).max(128),
})
export type LoginDto = z.infer<typeof LoginSchema>

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(8).max(128),
})
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>

export const TotpSchema = z.object({
  token: z.string().length(6),
})
export type TotpDto = z.infer<typeof TotpSchema>

@ApiTags('auth')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '账号密码登录' })
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto, @Req() req: { ip: string }) {
    return this.auth.login(dto.username, dto.password, req.ip)
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新 access token (使用 HttpOnly refresh cookie)' })
  async refresh(@Req() req: { user?: { sub: string; username: string; role: string } }) {
    if (!req.user) {
      throw new UnauthorizedException('缺少有效的 refresh token，请重新登录')
    }
    return this.auth.refresh(req.user.sub, req.user.username, req.user.role)
  }

  @Post('totp/verify')
  @ApiOperation({ summary: 'TOTP验证' })
  verifyTotp(@Req() req: { user: { sub: string } }, @Body(new ZodValidationPipe(TotpSchema)) dto: TotpDto) {
    return this.auth.verifyTotp(req.user.sub, dto.token)
  }

  @Post('totp/setup')
  @ApiOperation({ summary: '设置TOTP' })
  setupTotp(@Req() req: { user: { sub: string } }) {
    return this.auth.setupTotp(req.user.sub)
  }

  @Post('totp/disable')
  @ApiOperation({ summary: '关闭TOTP' })
  disableTotp(@Req() req: { user: { sub: string } }) {
    return this.auth.disableTotp(req.user.sub)
  }

  @Get('me')
  @ApiOperation({ summary: '当前登录用户' })
  me(@Req() req: { user: { sub: string } }) {
    return this.auth.me(req.user.sub)
  }

  @Post('change-password')
  @ApiOperation({ summary: '修改密码' })
  changePassword(
    @Req() req: { user: { sub: string } },
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto
  ) {
    return this.auth.changePassword(req.user.sub, dto.oldPassword, dto.newPassword)
  }
}

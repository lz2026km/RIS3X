import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AllowTotpPending,
  Public,
} from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

export const LoginSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(8).max(128),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const TotpSchema = z.object({
  token: z.string().length(6),
});
export type TotpDto = z.infer<typeof TotpSchema>;

@ApiTags("auth")
@ApiBearerAuth()
@Roles("DOCTOR", "DIRECTOR", "ADMIN", "TECHNICIAN", "NURSE")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @ApiOperation({ summary: "账号密码登录" })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: { ip: string },
  ) {
    const result = await this.auth.login(dto.username, dto.password, req.ip);
    return {
      accessToken: result.accessToken,
      user: result.user,
      success: true,
      data: {
        token: result.accessToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
        userId: result.user.id,
        userName: result.user.username,
        role: result.user.role,
        totpRequired: result.user.totpRequired,
      },
    };
  }

  @Post("refresh")
  @ApiOperation({ summary: "刷新 access token (使用当前有效的 Bearer token)" })
  async refresh(
    @Req()
    req: {
      user: { sub: string; username: string; role: string; tenantId?: string };
    },
  ) {
    const result = await this.auth.refresh(
      req.user.sub,
      req.user.username,
      req.user.role,
      req.user.tenantId,
    );
    return {
      success: true,
      data: {
        token: result.accessToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
        userId: result.user.id,
        userName: result.user.username,
        role: result.user.role,
      },
    };
  }

  @AllowTotpPending()
  @Post("totp/verify")
  @ApiOperation({ summary: "TOTP验证" })
  verifyTotp(
    @Req() req: { user: { sub: string } },
    @Body(new ZodValidationPipe(TotpSchema)) dto: TotpDto,
  ) {
    return this.auth.verifyTotp(req.user.sub, dto.token);
  }

  @AllowTotpPending()
  @Post("totp/setup")
  @ApiOperation({ summary: "设置TOTP（生成密钥，验证通过后才启用）" })
  setupTotp(@Req() req: { user: { sub: string } }) {
    return this.auth.setupTotp(req.user.sub);
  }

  @Post("totp/disable")
  @ApiOperation({ summary: "关闭TOTP（需提供TOTP验证码二次认证）" })
  disableTotp(
    @Req() req: { user: { sub: string } },
    @Body(new ZodValidationPipe(TotpSchema)) dto: TotpDto,
  ) {
    return this.auth.disableTotp(req.user.sub, dto.token);
  }

  @Get("me")
  @ApiOperation({ summary: "当前登录用户" })
  me(@Req() req: { user: { sub: string } }) {
    return this.auth.me(req.user.sub);
  }

  @Post("logout")
  @ApiOperation({ summary: "登出（使所有当前 token 失效）" })
  logout(@Req() req: { user: { sub: string } }) {
    return this.auth.logout(req.user.sub);
  }

  @Post("change-password")
  @ApiOperation({ summary: "修改密码" })
  changePassword(
    @Req() req: { user: { sub: string } },
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      req.user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}

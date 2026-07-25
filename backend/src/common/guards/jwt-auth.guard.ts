import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { isObservable, lastValueFrom } from 'rxjs'
import { ALLOW_TOTP_PENDING_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const activation = super.canActivate(context)
    const allowed = isObservable(activation) ? await lastValueFrom(activation) : await activation
    if (!allowed) throw new UnauthorizedException()

    const allowTotpPending = this.reflector.getAllAndOverride<boolean>(ALLOW_TOTP_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const request = context.switchToHttp().getRequest<{ user?: { totpPending?: boolean } }>()
    if (request.user?.totpPending && !allowTotpPending) {
      throw new UnauthorizedException('需要完成TOTP验证')
    }
    return true
  }
}

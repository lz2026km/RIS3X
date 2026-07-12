import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common'
import { Observable } from 'rxjs'

@Injectable()
export class CsrfInterceptor implements NestInterceptor {
  private readonly safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const method = request.method?.toUpperCase()

    if (this.safeMethods.has(method)) {
      return next.handle()
    }

    const origin = request.headers['origin'] as string | undefined
    const referer = request.headers['referer'] as string | undefined

    const allowedOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5191').split(',').map((s) => s.trim())
    const header = origin || referer

    if (!header) {
      throw new ForbiddenException('Missing Origin or Referer header')
    }

    try {
      const parsed = new URL(header)
      const isAllowed = allowedOrigins.some((allowed) => {
        try {
          const a = new URL(allowed)
          return a.origin === parsed.origin
        } catch {
          return false
        }
      })
      if (!isAllowed) {
        throw new ForbiddenException('CSRF validation failed: origin not allowed')
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e
      throw new ForbiddenException('CSRF validation failed: invalid origin')
    }

    return next.handle()
  }
}

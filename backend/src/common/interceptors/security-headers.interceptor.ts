import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'

interface HeaderResponse {
  setHeader(name: string, value: string): void
}

export function applySecurityHeaders(response: HeaderResponse): void {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  response.setHeader('X-XSS-Protection', '0')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'")
}

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    applySecurityHeaders(context.switchToHttp().getResponse<HeaderResponse>())
    return next.handle()
  }
}

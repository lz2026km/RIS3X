import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse()
    return next.handle().pipe(
      map((data) => {
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('X-Frame-Options', 'DENY')
        response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
        response.setHeader('X-XSS-Protection', '0')
        response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        return data
      }),
    )
  }
}

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { httpRequestCounter, httpRequestDurationHistogram } from './metrics.factory'

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const method = request.method
    const path = request.route?.path ?? request.path ?? request.url

    const end = httpRequestDurationHistogram.startTimer({ method, path })

    return next.handle().pipe(
      tap({
        next: () => {
          const status = context.switchToHttp().getResponse().statusCode
          end({ status: String(status) })
          httpRequestCounter.inc({ method, path, status: String(status) })
        },
        error: (err) => {
          const status = err?.status ?? 500
          end({ status: String(status) })
          httpRequestCounter.inc({ method, path, status: String(status) })
        },
      }),
    )
  }
}

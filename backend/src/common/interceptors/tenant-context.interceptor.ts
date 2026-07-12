import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { AsyncLocalStorage } from 'async_hooks'

export const tenantStorage = new AsyncLocalStorage<{ tenantId: string }>()

export function getCurrentTenantId(): string {
  const store = tenantStorage.getStore()
  return store?.tenantId ?? 'default'
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const tenantId = request.user?.tenantId || request.headers?.['x-tenant-id'] || 'default'
    return new Observable((subscriber) => {
      tenantStorage.run({ tenantId }, () => {
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        })
      })
    })
  }
}

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common'
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
    const jwtTenant = request.user?.tenantId
    const headerTenant = request.headers?.['x-tenant-id']
    if (jwtTenant && headerTenant && jwtTenant !== headerTenant) {
      throw new ForbiddenException('Tenant mismatch: x-tenant-id does not match JWT tenant')
    }
    const tenantId = jwtTenant || headerTenant || 'default'
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

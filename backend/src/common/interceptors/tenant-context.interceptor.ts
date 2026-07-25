import { BadRequestException, Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { AsyncLocalStorage } from 'async_hooks'

interface TenantContext {
  tenantId: string
  enforce: boolean
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

export function getCurrentTenantId(): string {
  return tenantStorage.getStore()?.tenantId ?? 'default'
}

export function getEnforcedTenantId(): string | undefined {
  const store = tenantStorage.getStore()
  return store?.enforce ? store.tenantId : undefined
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      user?: { tenantId?: string }
      headers?: Record<string, string | string[] | undefined>
    }>()
    const rawHeader = request.headers?.['x-tenant-id']
    if (Array.isArray(rawHeader)) {
      throw new BadRequestException('Invalid x-tenant-id header')
    }
    const headerTenant = rawHeader?.trim()
    if (headerTenant && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(headerTenant)) {
      throw new BadRequestException('Invalid x-tenant-id header')
    }

    let tenantId = 'default'
    let enforce = false
    if (request.user) {
      const jwtTenant = request.user.tenantId?.trim()
      if (!jwtTenant || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(jwtTenant)) {
        throw new ForbiddenException('Authenticated user has no valid tenant')
      }
      if (headerTenant && jwtTenant !== headerTenant) {
        throw new ForbiddenException('Tenant mismatch: x-tenant-id does not match JWT tenant')
      }
      tenantId = jwtTenant
      enforce = true
    }

    return new Observable((subscriber) => {
      const subscription = tenantStorage.run({ tenantId, enforce }, () => next.handle().subscribe({
        next: (value) => subscriber.next(value),
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete(),
      }))
      return () => subscription.unsubscribe()
    })
  }
}

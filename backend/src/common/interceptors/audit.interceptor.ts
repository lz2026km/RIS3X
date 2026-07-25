import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { AuditService } from '../../modules/audit/audit.service'

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const SENSITIVE_FIELDS = /password|secret|token|authorization|cookie|credential|key/i

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name)

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string
      baseUrl?: string
      route?: { path?: string }
      originalUrl?: string
      url?: string
      user?: { sub?: string }
      ip?: string
      headers?: Record<string, string | string[] | undefined>
      params?: Record<string, string>
      body?: unknown
    }>()
    const method = request.method?.toUpperCase() ?? 'UNKNOWN'
    if (!AUDITED_METHODS.has(method)) return next.handle()

    const routePath = this.routePath(request)
    const action = `${method}:${routePath}`
    const userId = request.user?.sub
    const ip = request.ip ?? 'unknown'
    const rawUserAgent = request.headers?.['user-agent']
    const userAgent = typeof rawUserAgent === 'string' ? rawUserAgent.slice(0, 512) : ''
    const resourceId = request.params?.['id']
    const fields = this.changedFields(request.body)

    return next.handle().pipe(
      tap({
        next: () => this.record({
          userId,
          action,
          resource: routePath,
          resourceId,
          detail: { method, fields },
          ip,
          userAgent,
          success: true,
        }),
        error: (error: unknown) => this.record({
          userId,
          action,
          resource: routePath,
          resourceId,
          detail: {
            method,
            error: error instanceof Error ? error.name : 'UnknownError',
            statusCode: error instanceof HttpException ? error.getStatus() : 500,
          },
          ip,
          userAgent,
          success: false,
        }),
      }),
    )
  }

  private routePath(request: { baseUrl?: string; route?: { path?: string }; originalUrl?: string; url?: string }): string {
    const route = request.route?.path
    const path = route
      ? `${request.baseUrl ?? ''}${route === '/' ? '' : route}`
      : (request.originalUrl ?? request.url ?? '/').split('?')[0]
    const normalized = path.startsWith('/') ? path : `/${path}`
    return normalized.replace(/^\/api(?=\/)/, '') || '/'
  }

  private changedFields(body: unknown): string[] {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return []
    return Object.keys(body as Record<string, unknown>)
      .filter((field) => !SENSITIVE_FIELDS.test(field))
      .slice(0, 50)
  }

  private record(entry: Parameters<AuditService['log']>[0]): void {
    void this.audit.log(entry).catch((error: unknown) => {
      this.logger.error('Failed to persist audit log', error instanceof Error ? error.stack : undefined)
    })
  }
}

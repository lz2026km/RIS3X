import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { AuditService } from '../../modules/audit/audit.service'

const SENSITIVE_ACTIONS = new Set([
  'POST:/auth/login',
  'POST:/auth/logout',
  'POST:/auth/change-password',
  'POST:/users',
  'PATCH:/users',
  'DELETE:/users',
  'PATCH:/users/:id/role',
  'POST:/files/upload-complete',
  'DELETE:/reports',
  'DELETE:/patients',
  'DELETE:/exams',
  'DELETE:/appointments',
  'PATCH:/appointments/:id',
  'POST:/criticals',
  'PATCH:/criticals/:id',
  'DELETE:/criticals/:id',
  'POST:/safety/adverse-events',
  'POST:/safety/rca-investigations',
  'POST:/hl7/oru',
  'POST:/hl7/orm',
  'POST:/hl7/dft',
])

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const method = request.method?.toUpperCase()
    const routePath = request.route?.path ?? request.path ?? request.url
    const actionKey = `${method}:${routePath}`
    const userId = request.user?.sub
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'unknown'
    const userAgent = request.headers?.['user-agent'] || ''

    if (!SENSITIVE_ACTIONS.has(actionKey)) {
      return next.handle()
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.audit.log({
            userId,
            action: actionKey,
            resource: routePath,
            resourceId: request.params?.id,
            detail: { method, body: this.sanitizeBody(request.body) },
            ip,
            userAgent,
            success: true,
          }).catch(() => {})
        },
        error: (err) => {
          this.audit.log({
            userId,
            action: actionKey,
            resource: routePath,
            resourceId: request.params?.id,
            detail: { method, error: err?.message },
            ip,
            userAgent,
            success: false,
          }).catch(() => {})
        },
      }),
    )
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined
    const sanitized = { ...body }
    if (sanitized.password) sanitized.password = '***'
    if (sanitized.oldPassword) sanitized.oldPassword = '***'
    if (sanitized.newPassword) sanitized.newPassword = '***'
    if (sanitized.token) sanitized.token = '***'
    return sanitized
  }
}

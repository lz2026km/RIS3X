import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

@Injectable()
export class CsrfInterceptor implements NestInterceptor {
  private readonly safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
  private readonly secret: string
  private readonly allowedOrigins: Set<string>

  constructor() {
    const secret = process.env['CSRF_SECRET']?.trim() || process.env['JWT_SECRET']
    if (!secret || (process.env['NODE_ENV'] === 'production' && Buffer.byteLength(secret) < 32)) {
      throw new Error('CSRF_SECRET must be at least 32 bytes in production')
    }
    this.secret = secret
    const fallback = process.env['NODE_ENV'] === 'production'
      ? ''
      : 'http://localhost:5173,http://localhost:5191,http://localhost:4173'
    this.allowedOrigins = new Set(
      (process.env['CORS_ORIGINS'] ?? fallback)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => new URL(value).origin),
    )
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string
      headers: Record<string, string | string[] | undefined>
    }>()
    const response = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>()
    const method = request.method?.toUpperCase() ?? ''

    if (this.safeMethods.has(method)) {
      if (method !== 'OPTIONS') response.setHeader('X-CSRF-Token', this.createToken())
      return next.handle()
    }

    const origin = request.headers['origin']
    const referer = request.headers['referer']
    if (origin || referer) {
      response.setHeader('Vary', 'Origin')
      this.validateOrigin(origin, referer)
    } else {
      throw new ForbiddenException('CSRF validation failed: missing Origin and Referer headers')
    }

    const token = request.headers['x-csrf-token']
    if (typeof token !== 'string' || !this.validateToken(token)) {
      throw new ForbiddenException('CSRF validation failed: invalid X-CSRF-Token')
    }
    return next.handle()
  }

  private createToken(): string {
    const payload = `${Date.now() + TOKEN_TTL_MS}.${randomBytes(32).toString('base64url')}`
    return `${payload}.${this.sign(payload)}`
  }

  private validateToken(token: string): boolean {
    if (token.length > 256) return false
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [expiresAt, nonce, signature] = parts
    if (!expiresAt || !/^\d+$/.test(expiresAt) || !nonce || !signature) return false
    const expiry = Number(expiresAt)
    if (!Number.isSafeInteger(expiry) || expiry < Date.now() || expiry > Date.now() + TOKEN_TTL_MS) return false
    const expected = Buffer.from(this.sign(`${expiresAt}.${nonce}`))
    const actual = Buffer.from(signature)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url')
  }

  private validateOrigin(origin: string | string[] | undefined, referer: string | string[] | undefined): void {
    const value = typeof origin === 'string' ? origin : typeof referer === 'string' ? referer : undefined
    if (!value) throw new ForbiddenException('Missing Origin or Referer header')
    try {
      if (!this.allowedOrigins.has(new URL(value).origin)) {
        throw new ForbiddenException('CSRF validation failed: origin not allowed')
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error
      throw new ForbiddenException('CSRF validation failed: invalid origin')
    }
  }
}

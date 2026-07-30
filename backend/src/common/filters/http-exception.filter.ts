import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import * as Sentry from '@sentry/node'
import type { Request } from 'express'
import { applySecurityHeaders } from '../interceptors/security-headers.interceptor'

const isProd = process.env['NODE_ENV'] === 'production'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse()
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response)
      return
    }
    applySecurityHeaders(response)

    const httpStatus = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR
    const isClientError = exception instanceof HttpException && httpStatus < 500
    const responseBody = isClientError
      ? exception.getResponse()
      : { message: 'Internal Server Error' }

    let message: unknown = 'Internal Server Error'
    let errors: unknown
    let responseCode: unknown
    if (typeof responseBody === 'string') {
      message = responseBody
    } else if (responseBody && typeof responseBody === 'object') {
      const body = responseBody as Record<string, unknown>
      responseCode = body['code']
      if (body['ok'] === false && body['code'] === 'VALIDATION_ERROR') {
        message = 'Validation failed'
        errors = body['errors']
      } else if (Array.isArray(body['message'])) {
        message = 'Validation failed'
        errors = body['message']
      } else if (body['message']) {
        message = body['message']
      }
    }

    const normalizedMessage = typeof message === 'string' ? message : JSON.stringify(message)
    const requestPath = this.requestPath(request)
    const safeMessage = (httpStatus >= 500 && isProd) ? 'Internal Server Error' : normalizedMessage
    const errorResponse: Record<string, unknown> = {
      success: false,
      data: null,
      error: {
        code: typeof responseCode === 'string' ? responseCode : `HTTP_${httpStatus}`,
        message: safeMessage,
        ...((httpStatus < 500 && errors) ? { details: errors } : {}),
      },
      statusCode: httpStatus,
      message: safeMessage,
      path: requestPath,
      method: request.method,
      timestamp: new Date().toISOString(),
    }

    if (httpStatus >= 500) {
      this.logger.error(
        `${request.method} ${requestPath} - ${httpStatus}`,
        exception instanceof Error ? exception.stack : undefined,
      )
      Sentry.captureException(exception, {
        tags: { httpStatus: String(httpStatus), method: request.method, path: requestPath },
      })
    } else if (httpStatus >= 400) {
      this.logger.warn(`${request.method} ${requestPath} - ${httpStatus}: ${JSON.stringify(message)}`)
    }

    httpAdapter.reply(response, errorResponse, httpStatus)
  }

  private requestPath(request: Request): string {
    try {
      return new URL(request.originalUrl ?? request.url, 'http://localhost').pathname
    } catch {
      return '/'
    }
  }
}

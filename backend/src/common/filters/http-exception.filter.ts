import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import type { Request } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const isHttpException = exception instanceof HttpException
    const responseBody = isHttpException
      ? exception.getResponse()
      : { message: 'Internal Server Error' }

    let message: unknown = 'Internal Server Error'
    let errors: unknown = undefined

    if (typeof responseBody === 'string') {
      message = responseBody
    } else if (responseBody && typeof responseBody === 'object') {
      const body = responseBody as Record<string, unknown>
      if (body['ok'] === false && body['code'] === 'VALIDATION_ERROR') {
        message = 'Validation failed'
        errors = body['errors']
      } else if (body['message']) {
        message = body['message']
      }
    }

    const errorResponse: Record<string, unknown> = {
      statusCode: httpStatus,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    }
    if (errors) errorResponse['errors'] = errors

    if (httpStatus >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${httpStatus}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    } else if (httpStatus >= 400) {
      this.logger.warn(`${request.method} ${request.url} - ${httpStatus}: ${JSON.stringify(message)}`)
    }

    httpAdapter.reply(ctx.getResponse(), errorResponse, httpStatus)
  }
}

/**
 * G005 放射RIS系统 v3.0.7.0 - NestJS 后端入口
 * 启动 NestJS + ValidationPipe + CORS + Swagger + Prometheus /metrics
 */
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { Logger as PinoLogger } from 'nestjs-pino'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { Request, Response } from 'express'
import client from 'prom-client'
import * as Sentry from '@sentry/node'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  app.useLogger(app.get(PinoLogger))

  client.collectDefaultMetrics({ register: client.register })

  if (process.env['SENTRY_DSN']) {
    Sentry.init({
      dsn: process.env['SENTRY_DSN'],
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: 0.1,
    })
    app.use(Sentry.expressErrorHandler())
  }

  app.use('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', client.register.contentType)
    res.end(await client.register.metrics())
  })

  app.enableCors({
    origin: (process.env['CORS_ORIGINS'] ?? 'http://localhost:5191').split(','),
    credentials: true,
  })

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  )

  const config = new DocumentBuilder()
    .setTitle('G005-RISv API')
    .setDescription('G005 放射信息系统 API 文档')
    .setVersion('3.0.6.11-20')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  app.getHttpAdapter().get('/api/docs-json', (_req: Request, res: Response) => {
    res.json(document)
  })

  if (process.env['GENERATE_OPENAPI']) {
    const fs = require('fs')
    const path = require('path')
    const outputPath = path.resolve(__dirname, '..', 'openapi.json')
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8')
    console.log(`OpenAPI spec written to ${outputPath}`)
    await app.close()
    return
  }

  const port = Number(process.env['PORT'] ?? 3001)
  await app.listen(port)

  const logger = app.get(PinoLogger)
  logger.log(`G005 Backend v3.0.7.0 listening on http://localhost:${port}/api`)
}

void bootstrap()

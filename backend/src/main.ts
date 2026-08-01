/**
 * G005 放射RIS系统 v3.0.6.11-49 - NestJS 后端入口
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
  const trustProxy = process.env['TRUST_PROXY']?.trim()
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)
  }

  const jwtSecret = process.env['JWT_SECRET']?.trim()
  if (!jwtSecret || (process.env['NODE_ENV'] === 'production' && Buffer.byteLength(jwtSecret) < 32)) {
    throw new Error('JWT_SECRET is required (≥32 bytes in production). Run: openssl rand -base64 32')
  }

  client.collectDefaultMetrics({ register: client.register })

  if (process.env['SENTRY_DSN']) {
    Sentry.init({
      dsn: process.env['SENTRY_DSN'],
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? 0.1),
    })
    app.use(Sentry.expressErrorHandler())
  }

  const METRICS_ALLOWED_IPS = (process.env['METRICS_ALLOWED_IPS'] ?? '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const isAllowedIp = (ip: string): boolean => {
    for (const allowed of METRICS_ALLOWED_IPS) {
      if (allowed.includes('/')) {
        const [range, bits] = allowed.split('/')
        const mask = ~((1 << (32 - Number(bits))) - 1) >>> 0
        const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
        const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
        if ((ipNum & mask) === (rangeNum & mask)) return true
      } else if (ip === allowed) {
        return true
      }
    }
    return false
  }
  app.use('/metrics', async (_req: Request, res: Response) => {
    const clientIp = (_req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? _req.socket.remoteAddress ?? ''
    const normalizedIp = clientIp.replace('::ffff:', '')
    if (!isAllowedIp(normalizedIp)) {
      res.status(403).json({ statusCode: 403, message: 'Forbidden: /metrics access denied' })
      return
    }
    res.set('Content-Type', client.register.contentType)
    res.end(await client.register.metrics())
  })

  const isProd = process.env['NODE_ENV'] === 'production'
  const corsOriginsRaw = process.env['CORS_ORIGINS']
    ?? (isProd ? '' : 'http://localhost:5173,http://localhost:5191,http://localhost:4173')
  const corsOrigins = corsOriginsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  if (isProd && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be configured in production')
  }

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'],
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
    .setVersion('3.0.6.11-49')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)

  const SWAGGER_DISABLED = process.env['SWAGGER_DISABLED'] === 'true'
  if (!SWAGGER_DISABLED) {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
      },
    })
  }

  const swaggerIpWhitelist = (process.env['SWAGGER_ALLOWED_IPS'] ?? '127.0.0.1,::1')
    .split(',').map((s) => s.trim()).filter(Boolean)
  app.getHttpAdapter().get('/api/docs-json', (_req: Request, res: Response) => {
    const clientIp = (_req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? _req.socket.remoteAddress ?? ''
    const normalizedIp = clientIp.replace('::ffff:', '')
    if (isProd && !swaggerIpWhitelist.includes(normalizedIp) && !swaggerIpWhitelist.some((ip) => ip.includes('/') && isAllowedIp(ip))) {
      res.status(403).json({ statusCode: 403, message: 'Forbidden: OpenAPI spec access denied in production' })
      return
    }
    res.json(document)
  })

  if (isProd) {
    app.getHttpAdapter().get('/api/docs', (_req: Request, res: Response) => {
      const clientIp = (_req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? _req.socket.remoteAddress ?? ''
      const normalizedIp = clientIp.replace('::ffff:', '')
      if (!swaggerIpWhitelist.includes(normalizedIp) && !swaggerIpWhitelist.some((ip) => ip.includes('/') && isAllowedIp(ip))) {
        res.status(403).json({ statusCode: 403, message: 'Forbidden: Swagger UI access denied in production' })
        return
      }
      res.redirect('/api/docs')
    })
  }

  if (process.env['GENERATE_OPENAPI']) {
    const fs = require('fs')
    const path = require('path')
    const outputPath = path.resolve(__dirname, '..', 'openapi.json')
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8')
    console.log(`OpenAPI spec written to ${outputPath}`)
    await app.close()
    return
  }

  const rawPort = process.env['PORT']
  const port = rawPort ? (() => {
    const n = Number(rawPort)
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`PORT must be 1-65535, got "${rawPort}"`)
    return n
  })() : 3001
  await app.listen(port)

  const logger = app.get(PinoLogger)
  logger.log(`G005 Backend v3.0.6.11-49 listening on http://localhost:${port}/api`)
}

void bootstrap()

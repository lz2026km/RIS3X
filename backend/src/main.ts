/**
 * G005 放射RIS系统 v3.0.1 - NestJS 后端入口
 * 启动 NestJS + ValidationPipe + CORS + Swagger
 */
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { Logger as PinoLogger } from 'nestjs-pino'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  app.useLogger(app.get(PinoLogger))

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
    .setTitle('G005 Radiology RIS API')
    .setVersion('3.0.6.11-8')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = Number(process.env['PORT'] ?? 3001)
  await app.listen(port)

  const logger = app.get(PinoLogger)
  logger.log(`G005 Backend v3.0.1 listening on http://localhost:${port}/api`)
}

void bootstrap()

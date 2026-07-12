import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from '../src/app.module'
import * as fs from 'fs'
import * as path from 'path'

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false })
  app.setGlobalPrefix('api')

  const config = new DocumentBuilder()
    .setTitle('G005-RISv API')
    .setDescription('G005 放射信息系统 API 文档')
    .setVersion('3.0.6.11-20')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  const outputPath = path.resolve(__dirname, '..', 'openapi.json')
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8')
  console.log(`OpenAPI spec written to ${outputPath}`)
  await app.close()
}

void generate()

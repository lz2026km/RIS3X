/**
 * G005 放射RIS系统 v3.0.6.11-60 - 文件管理
 * 端点: GET upload-url / POST upload-complete / POST upload / GET download/:id/:name
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

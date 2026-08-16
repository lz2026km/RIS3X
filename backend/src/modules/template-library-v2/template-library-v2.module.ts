import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { TemplateLibraryV2Controller } from './template-library-v2.controller'
import { TemplateLibraryV2Service } from './template-library-v2.service'

/**
 * [G005 v3.0.6.11-101 Wave 7B F13] 模板库 V2 (孤儿模块, 不注册进 app.module,
 * spec 直接注入测试; DB 不可用时 seed 回退)
 */
@Module({
  imports: [PrismaModule],
  controllers: [TemplateLibraryV2Controller],
  providers: [TemplateLibraryV2Service],
  exports: [TemplateLibraryV2Service],
})
export class TemplateLibraryV2Module {}

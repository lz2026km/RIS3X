import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PacsAdminService } from './pacs-admin.service'

// [G005 Wave1A] PACS Admin 管理 (前端 pacsAdminApi / PacsAdminPage 系列)
const UpdateConfigSchema = z.object({
  value: z.string().min(1),
  description: z.string().optional(),
})

@ApiTags('pacs-admin')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('pacs-admin')
export class PacsAdminController {
  constructor(private readonly service: PacsAdminService) {}

  @Get('nodes')
  @ApiOperation({ summary: 'DICOM 节点列表 (Device 表派生)' })
  listNodes() {
    return this.service.listNodes()
  }

  @Post('nodes/:id/test')
  @ApiOperation({ summary: '节点连通性测试' })
  testNode(@Param('id') id: string) {
    return this.service.testNode(id)
  }

  @Post('nodes/:id/sync')
  @ApiOperation({ summary: '节点数据同步' })
  syncNode(@Param('id') id: string) {
    return this.service.syncNode(id)
  }

  @Get('storage')
  @ApiOperation({ summary: '存储组列表' })
  listStorage() {
    return this.service.listStorage()
  }

  @Post('storage/cleanup')
  @ApiOperation({ summary: '存储空间清理' })
  cleanupStorage() {
    return this.service.cleanupStorage()
  }

  @Get('worklist-entries')
  @ApiOperation({ summary: 'Worklist 条目 (Exam 表派生)' })
  listWorklistEntries() {
    return this.service.listWorklistEntries()
  }

  @Get('archives')
  @ApiOperation({ summary: '归档记录' })
  listArchives() {
    return this.service.listArchives()
  }

  @Get('logs')
  @ApiOperation({ summary: 'PACS 操作日志 (AuditLog 派生)' })
  listLogs(@Query('limit') limit?: string) {
    return this.service.listLogs(Number(limit))
  }

  @Get('configs')
  @ApiOperation({ summary: 'PACS 配置项' })
  listConfigs() {
    return this.service.listConfigs()
  }

  @Post('configs/:key')
  @ApiOperation({ summary: '更新配置项' })
  updateConfig(@Param('key') key: string, @Body(new ZodValidationPipe(UpdateConfigSchema)) body: z.infer<typeof UpdateConfigSchema>) {
    return this.service.updateConfig(key, body.value, body.description)
  }

  @Get('routes')
  @ApiOperation({ summary: '转发路由列表' })
  listRoutes() {
    return this.service.listRoutes()
  }
}

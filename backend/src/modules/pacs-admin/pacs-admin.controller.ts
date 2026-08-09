import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
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

// [G005 Wave1B P1] servers / storage-groups 写操作
const ServerSchema = z.object({
  name: z.string().min(1),
  hostname: z.string().min(1),
  port: z.number().int().positive().optional(),
  aeTitle: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).optional(),
})

const StorageGroupSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  totalBytes: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'readonly', 'offline']).optional(),
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

  // ===== [G005 Wave1B P1] pacsAdminApi 4 组: servers / storage-groups / associations / stats =====

  @Get('servers')
  @ApiOperation({ summary: 'DICOM 服务器列表 (Device 派生 + 内存)' })
  listServers(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listServers({
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get('servers/:id')
  @ApiOperation({ summary: 'DICOM 服务器详情' })
  getServer(@Param('id') id: string) {
    return this.service.getServer(id)
  }

  @Post('servers')
  @ApiOperation({ summary: '新增 DICOM 服务器' })
  createServer(@Body(new ZodValidationPipe(ServerSchema)) body: z.infer<typeof ServerSchema>) {
    return this.service.createServer(body)
  }

  @Put('servers/:id')
  @ApiOperation({ summary: '更新 DICOM 服务器' })
  updateServer(@Param('id') id: string, @Body(new ZodValidationPipe(ServerSchema.partial())) body: z.infer<typeof ServerSchema>) {
    return this.service.updateServer(id, body)
  }

  @Delete('servers/:id')
  @ApiOperation({ summary: '删除 DICOM 服务器' })
  deleteServer(@Param('id') id: string) {
    return this.service.deleteServer(id)
  }

  @Post('servers/:id/test')
  @ApiOperation({ summary: '服务器连通性测试' })
  testServer(@Param('id') id: string) {
    return this.service.testServer(id)
  }

  @Get('storage-groups')
  @ApiOperation({ summary: '存储组列表' })
  listStorageGroups(@Query('status') status?: string) {
    return this.service.listStorageGroups({ status })
  }

  @Post('storage-groups')
  @ApiOperation({ summary: '新增存储组' })
  createStorageGroup(@Body(new ZodValidationPipe(StorageGroupSchema)) body: z.infer<typeof StorageGroupSchema>) {
    return this.service.createStorageGroup(body)
  }

  @Delete('storage-groups/:id')
  @ApiOperation({ summary: '删除存储组' })
  deleteStorageGroup(@Param('id') id: string) {
    return this.service.deleteStorageGroup(id)
  }

  @Get('associations')
  @ApiOperation({ summary: 'DICOM 关联列表' })
  listAssociations(@Query('status') status?: string) {
    return this.service.listAssociations({ status })
  }

  @Get('stats')
  @ApiOperation({ summary: 'PACS 管理统计' })
  getStats() {
    return this.service.getStats()
  }
}

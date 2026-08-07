import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ComplianceDocsService, CreateComplianceDocInput, UpdateComplianceDocInput } from './compliance-docs.service'
import { CreateComplianceDocSchema, UpdateComplianceDocSchema } from './compliance-docs.schema'

@ApiTags('compliance-docs')
@Controller('compliance-docs')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
export class ComplianceDocsController {
  constructor(private readonly svc: ComplianceDocsService) {}

  @Get()
  @ApiOperation({ summary: '合规文档列表 (category/status/search 筛选)' })
  list(
    @Query() query: { category?: string; status?: string; search?: string },
  ) {
    return this.svc.findAll({
      category: query.category,
      status: query.status,
      search: query.search,
    })
  }

  @Get('report')
  @ApiOperation({ summary: '生成合规文档报告' })
  report() {
    return this.svc.generateReport()
  }

  @Get(':id')
  @ApiOperation({ summary: '合规文档详情' })
  detail(@Param('id') id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: '创建合规文档 (title/category/type/version/content/status)' })
  create(
    @Body(new ZodValidationPipe(CreateComplianceDocSchema)) dto: CreateComplianceDocInput,
  ) {
    return this.svc.create(dto)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新合规文档' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateComplianceDocSchema)) dto: UpdateComplianceDocInput,
  ) {
    return this.svc.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除合规文档' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }

  @Post(':id/publish')
  @ApiOperation({ summary: '发布合规文档 (DRAFT -> CURRENT)' })
  publish(@Param('id') id: string) {
    return this.svc.publish(id)
  }

  @Post(':id/archive')
  @ApiOperation({ summary: '归档合规文档 (CURRENT -> ARCHIVED)' })
  archive(@Param('id') id: string) {
    return this.svc.archive(id)
  }
}

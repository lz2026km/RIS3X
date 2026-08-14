import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { BiService, CreateWallTemplateDto } from './bi.service'

@ApiTags('bi')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('bi')
export class BiController {
  constructor(private readonly service: BiService) {}

  @Get('kpi')
  @ApiOperation({ summary: '今日综合 KPI' })
  getKpi() {
    return this.service.getKpi()
  }

  @Get('report-timeliness')
  @ApiOperation({ summary: '报告时效分布' })
  getReportTimeliness() {
    return this.service.getReportTimeliness()
  }

  @Get('physician-rvu')
  @ApiOperation({ summary: '医生工作量 (报告数/RVU/平均时长)' })
  getPhysicianRvu() {
    return this.service.getPhysicianRvu()
  }

  @Get('device-oee')
  @ApiOperation({ summary: '设备 OEE 实时 (最近 N 天)' })
  getDeviceOee(@Query('days', new DefaultValuePipe(14), new ParseIntPipe({ optional: true })) days = 14) {
    return this.service.getDeviceOee(days)
  }

  @Get('critical-sla')
  @ApiOperation({ summary: '危急值 SLA (响应时长分布/达标率/超时清单)' })
  getCriticalSla() {
    return this.service.getCriticalSla()
  }

  @Get('trend')
  @ApiOperation({ summary: '核心指标趋势' })
  getTrend(@Query('days', new DefaultValuePipe(30), new ParseIntPipe({ optional: true })) days = 30) {
    return this.service.getTrend(days)
  }

  // ── [v3.0.6.11-99 Wave 5B-A] 大屏模板库 ────────────────────────────────
  @Get('wall-templates')
  @ApiOperation({ summary: '大屏模板列表 (overview|equipment|quality|finance|mixed)' })
  listWallTemplates() {
    return this.service.listWallTemplates()
  }

  @Get('wall-templates/:id')
  @ApiOperation({ summary: '大屏模板详情' })
  getWallTemplate(@Param('id') id: string) {
    const template = this.service.getWallTemplate(id)
    if (!template) throw new NotFoundException(`模板不存在: ${id}`)
    return template
  }

  @Post('wall-templates')
  @ApiOperation({ summary: '创建大屏模板' })
  createWallTemplate(@Body() body: CreateWallTemplateDto) {
    return this.service.createWallTemplate(body)
  }

  @Patch('wall-templates/:id')
  @ApiOperation({ summary: '更新大屏模板' })
  updateWallTemplate(@Param('id') id: string, @Body() body: Partial<CreateWallTemplateDto>) {
    const template = this.service.updateWallTemplate(id, body)
    if (!template) throw new NotFoundException(`模板不存在: ${id}`)
    return template
  }

  @Delete('wall-templates/:id')
  @ApiOperation({ summary: '删除大屏模板' })
  deleteWallTemplate(@Param('id') id: string) {
    return this.service.deleteWallTemplate(id)
  }

  // ── [v3.0.6.11-99 Wave 5B-B] 医生绩效 ──────────────────────────────────
  @Get('physician-performance')
  @ApiOperation({ summary: '医生绩效 (RVU×单价×质量系数→奖金)' })
  getPhysicianPerformance() {
    return this.service.getPhysicianPerformance()
  }
}

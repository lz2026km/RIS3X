import { Controller, Get, Post, Param, Query, Req, Res } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuditService } from './audit.service'
import { Response } from 'express'

@ApiTags('audit')
@Controller('audit')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: '瀹¤鏃ュ織鍒楄〃' })
  list(@Query() query: { page?: string; pageSize?: string; userId?: string; action?: string; resource?: string; startDate?: string; endDate?: string }) {
    return this.audit.list({
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      userId: query.userId,
      action: query.action,
      resource: query.resource,
      startDate: query.startDate,
      endDate: query.endDate,
    })
  }

  @Get('stats')
  @ApiOperation({ summary: '瀹¤鏃ュ織缁熻' })
  stats() {
    return this.audit.stats()
  }

  // [G005 Wave1A P0] 审计聚合 (AuditCompliancePage 在用): 按操作/资源/用户/时间聚合
  @Get('aggregation')
  @ApiOperation({ summary: '瀹¤鏃ュ織鑱氬悎缁熻 (byAction/byResource/byUser)' })
  aggregation() {
    return this.audit.aggregation()
  }

  @Get('export')
  @ApiOperation({ summary: '瀹¤鏃ュ織 CSV 瀵煎嚭' })
  async export(
    @Query() query: { userId?: string; action?: string; resource?: string; startDate?: string; endDate?: string },
    @Res() res: Response,
  ) {
    const csv = await this.audit.exportCsv({
      userId: query.userId,
      action: query.action,
      resource: query.resource,
      startDate: query.startDate,
      endDate: query.endDate,
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send(csv)
  }

  // [W10E-3] 扩展端点 (总览/用户活跃/操作趋势/高危操作) — 静态路由须在 :id 之前声明
  @Get('overview')
  @ApiOperation({ summary: '审计总览 (今日操作/活跃用户/高危操作/成功率)' })
  overview() {
    return this.audit.getOverview()
  }

  @Get('user-activity')
  @ApiOperation({ summary: '用户活跃排行' })
  userActivity(@Query('limit') limit?: string) {
    const parsed = Number(limit)
    return this.audit.getUserActivity(Number.isFinite(parsed) && parsed > 0 ? parsed : 10)
  }

  @Get('action-trend')
  @ApiOperation({ summary: '近 30 日操作趋势' })
  actionTrend(@Query('days') days?: string) {
    const parsed = Number(days)
    return this.audit.getActionTrend(Number.isFinite(parsed) && parsed > 0 ? parsed : 30)
  }

  @Get('high-risk')
  @ApiOperation({ summary: '高危操作清单 (删除/导出/批量)' })
  highRisk() {
    return this.audit.getHighRisk()
  }

  // [W2-C] 详情 (静态路由 stats/export 已在上方声明, 不会被 :id 抢占)
  @Get(':id')
  @ApiOperation({ summary: '瀹¤鏃ュ織璇︽儏' })
  getById(@Param('id') id: string) {
    return this.audit.getById(id)
  }
}

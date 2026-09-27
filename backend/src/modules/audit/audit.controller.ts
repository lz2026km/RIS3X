import { Body, Controller, Get, HttpCode, HttpStatus, Post, Param, Query, Res } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AuditService } from './audit.service'
import { Response } from 'express'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ListQuerySchema } from '../../common/dto/pagination.dto'
import { AuditChainService } from '../security-center/audit-chain/audit-chain.service'

// [G005 W13-Security] 冷归档请求体
const ColdArchiveSchema = z.object({
  before: z.string().max(40).optional(),
  executedBy: z.string().max(120).optional(),
})

// [v3.0.6.11-104 Wave 1C] 审计列表查询校验 (分页上限 200 + 筛选)
export const AuditListQuerySchema = ListQuerySchema.extend({
  userId: z.string().max(64).optional(),
  action: z.string().max(128).optional(),
  resource: z.string().max(128).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
})

export const AuditExportQuerySchema = AuditListQuerySchema.omit({
  page: true,
  pageSize: true,
  skip: true,
  take: true,
  keyword: true,
})

@ApiTags('audit')
@Controller('audit')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly auditChain: AuditChainService,
  ) {}

  @Get()
  @ApiOperation({ summary: '瀹¤鏃ュ織鍒楄〃' })
  list(@Query(new ZodValidationPipe(AuditListQuerySchema)) query: z.infer<typeof AuditListQuerySchema>) {
    return this.audit.list({
      page: query.page,
      pageSize: query.pageSize,
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
    @Query(new ZodValidationPipe(AuditExportQuerySchema)) query: z.infer<typeof AuditExportQuerySchema>,
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

  // [G005 W13-Security] 审计链端到端校验 (逐条重算哈希)
  @Get('verify-chain')
  @ApiOperation({ summary: '审计链端到端校验 (hash-chain)' })
  verifyChain() {
    return this.auditChain.verifyChain()
  }

  // [G005 W13-Security] 审计留存策略 (6 个月 + 冷归档)
  @Get('retention-policy')
  @ApiOperation({ summary: '审计留存策略 (≥6 个月 + 冷归档)' })
  retentionPolicy() {
    return this.auditChain.getRetentionPolicy()
  }

  // [G005 W13-Security] 审计冷归档
  @Post('cold-archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '审计日志冷归档' })
  coldArchive(@Body(new ZodValidationPipe(ColdArchiveSchema)) body: z.infer<typeof ColdArchiveSchema>) {
    return this.auditChain.coldArchive(body)
  }

  // [W2-C] 详情 (静态路由 stats/export 已在上方声明, 不会被 :id 抢占)
  @Get(':id')
  @ApiOperation({ summary: '瀹¤鏃ュ織璇︽儏' })
  getById(@Param('id') id: string) {
    return this.audit.getById(id)
  }
}

import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { QcExtService } from './qcext.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { RateQcImageSchema, ReportQcDefectSchema } from './qcext.schema'
import { PaginationQuerySchema, resolvePagination } from '../common/dto/pagination.dto'

// [v3.0.6.11-104 Wave 1C] QC 扩展列表统一分页 (page/pageSize 或 skip/take, 上限 200)
const QcListQuerySchema = PaginationQuerySchema
type QcListQuery = z.infer<typeof QcListQuerySchema>

@ApiTags('qc-ext')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('qc-ext')
export class QcExtController {
  constructor(private readonly svc: QcExtService) {}

  @Get('dashboard')
  getQcDashboard() { return this.svc.getQcDashboard() }

  @Get('dashboard/:id')
  getQcDashboardItem(@Param('id') id: string) { return this.svc.getQcDashboardItem(id) }

  @Get('image')
  listQcImages(@Query(new ZodValidationPipe(QcListQuerySchema)) query: QcListQuery) {
    return this.svc.listQcImages(resolvePagination(query))
  }

  @Get('image/:id')
  getQcImage(@Param('id') id: string) { return this.svc.getQcImage(id) }

  @Post('image/:id/rate')
  rateQcImage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RateQcImageSchema)) body: Record<string, unknown>,
  ) {
    return this.svc.rateQcImage(id, body)
  }

  @Get('radiologist-annual')
  listRadiologistAnnual(@Query(new ZodValidationPipe(QcListQuerySchema)) query: QcListQuery) {
    return this.svc.listRadiologistAnnual(resolvePagination(query))
  }

  @Get('radiologist-annual/:id')
  getRadiologistAnnual(@Param('id') id: string) { return this.svc.getRadiologistAnnual(id) }

  @Get('defect')
  listQcDefects(@Query(new ZodValidationPipe(QcListQuerySchema)) query: QcListQuery) {
    return this.svc.listQcDefects(resolvePagination(query))
  }

  @Post('defect')
  reportQcDefect(@Body(new ZodValidationPipe(ReportQcDefectSchema)) body: Record<string, unknown>) { return this.svc.reportQcDefect(body) }

  @Get('stats')
  getQcStats() { return this.svc.getQcStats() }

  @Get('scores')
  listQcScores(@Query(new ZodValidationPipe(QcListQuerySchema)) query: QcListQuery) {
    return this.svc.listQcScores(resolvePagination(query))
  }
}

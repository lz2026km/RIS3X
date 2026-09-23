/**
 * G005 放射RIS系统 - 口腔影像后处理 (dental-imaging) 控制器
 * 挂载于 @Controller('dental'), 与 DentalController 同前缀互补 (路径互不重叠)。
 * 端点见 dental-imaging.service.ts。@Roles 与 DentalController 保持一致。
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { DentalImagingService } from './dental-imaging.service'

const LooseBodySchema = z.object({}).passthrough()

@ApiTags('dental')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dental')
export class DentalImagingController {
  constructor(private readonly svc: DentalImagingService) {}

  // ===== 影像路径 / 分割 / MPR / 3D =====

  @Get('studies/:id/dicom-paths')
  getDicomPaths(@Param('id') id: string) {
    return this.svc.getDicomPaths(id)
  }

  @Get('studies/:id/segments')
  getSegments(@Param('id') id: string) {
    return this.svc.getSegments(id)
  }

  @Post('studies/:id/segment')
  @HttpCode(201)
  triggerSegment(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { model?: string }) {
    return this.svc.triggerSegment(id, body)
  }

  @Get('studies/:id/mpr')
  getMpr(@Param('id') id: string) {
    return this.svc.getMpr(id)
  }

  @Get('studies/:id/3d-model')
  get3dModel(@Param('id') id: string) {
    return this.svc.get3dModel(id)
  }

  // ===== CBCT 专项 =====

  @Get('cbct/:id/nerve-canal')
  getNerveCanal(@Param('id') id: string) {
    return this.svc.getNerveCanal(id)
  }

  @Get('cbct/:id/bone-density')
  getBoneDensity(@Param('id') id: string) {
    return this.svc.getBoneDensity(id)
  }

  @Get('cbct/:id/measure')
  getCbctMeasure(@Param('id') id: string) {
    return this.svc.getCbctMeasure(id)
  }

  // ===== 口扫对比 / 配准 =====

  @Get('scan/:id/compare')
  compareScan(@Param('id') id: string) {
    return this.svc.compareScan(id)
  }

  @Post('scan/:id/align')
  @HttpCode(200)
  alignScan(@Param('id') id: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: { targetScanId?: string }) {
    return this.svc.alignScan(id, body)
  }

  // ===== CAD/CAM 研磨状态 =====

  @Get('cad/milling-status/:id')
  getMillingStatus(@Param('id') id: string) {
    return this.svc.getMillingStatus(id)
  }

  // ===== 种植体库 =====

  @Get('implant/abutments')
  listAbutments(@Query('brand') brand?: string) {
    return this.svc.listAbutments(brand)
  }

  @Get('implant/inventory/price-check')
  priceCheck(@Query('brand') brand?: string, @Query('models') models?: string) {
    return this.svc.priceCheck(brand, models)
  }
}

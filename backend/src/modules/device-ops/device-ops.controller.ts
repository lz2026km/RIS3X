/**
 * [G005 W11-DeviceOps] 设备运维中心控制器 (设备工单状态机 / 校准认证 / 资产折旧 /
 * OEE 停机 / 成本核算 + DRG / 定时 BI 报表)
 * 静态子路由 (stats/due/failures/overview/trend) 必须先于 :id 参数路由注册。
 */
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DeviceOpsService } from './device-ops.service'
import {
  AdvanceWorkOrderSchema,
  ApproveRetirementSchema,
  CreateAssetSchema,
  CreateCalibrationSchema,
  CreateReportDefinitionSchema,
  CreateWorkOrderSchema,
  GroupDiagnosisSchema,
  RequestRetirementSchema,
  RunReportSchema,
  UpdateAssetSchema,
  UpdateReportDefinitionSchema,
  UpdateWorkOrderSchema,
} from './device-ops.schema'
import type { DepreciationMethod } from './device-ops.types'

const ok = <T>(data: T) => ({ success: true, data })

@ApiTags('device-ops')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('device-ops')
export class DeviceOpsController {
  constructor(private readonly svc: DeviceOpsService) {}

  // ============================== 工单 ==============================

  @Get('work-orders/stats')
  workOrderStats() {
    return ok(this.svc.getWorkOrderStats())
  }

  @Get('work-orders')
  listWorkOrders(
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('priority') priority?: string,
    @Query('deviceId') deviceId?: string,
    @Query('assignee') assignee?: string,
  ) {
    return ok(this.svc.listWorkOrders({ status, kind, priority, deviceId, assignee }))
  }

  @Get('work-orders/:id')
  getWorkOrder(@Param('id') id: string) {
    return ok(this.svc.getWorkOrder(id))
  }

  @Post('work-orders')
  @HttpCode(201)
  createWorkOrder(@Body(new ZodValidationPipe(CreateWorkOrderSchema)) body: z.infer<typeof CreateWorkOrderSchema>) {
    return ok(this.svc.createWorkOrder(body))
  }

  @Put('work-orders/:id')
  updateWorkOrder(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateWorkOrderSchema)) body: z.infer<typeof UpdateWorkOrderSchema>) {
    return ok(this.svc.updateWorkOrder(id, body))
  }

  @Post('work-orders/:id/advance')
  advanceWorkOrder(@Param('id') id: string, @Body(new ZodValidationPipe(AdvanceWorkOrderSchema)) body: z.infer<typeof AdvanceWorkOrderSchema>) {
    return ok(this.svc.advanceWorkOrder(id, body))
  }

  // ============================== 校准 / 认证 ==============================

  @Get('calibrations/due')
  calibrationDue(@Query('days') days?: string) {
    return ok(this.svc.calibrationDue(Number(days ?? 30)))
  }

  @Get('calibrations/failures')
  calibrationFailures() {
    return ok(this.svc.calibrationFailures())
  }

  @Get('calibrations/stats')
  calibrationStats() {
    return ok(this.svc.getCalibrationStats())
  }

  @Get('calibrations')
  listCalibrations(
    @Query('deviceId') deviceId?: string,
    @Query('kind') kind?: string,
    @Query('result') result?: string,
  ) {
    return ok(this.svc.listCalibrations({ deviceId, kind, result }))
  }

  @Post('calibrations')
  @HttpCode(201)
  createCalibration(@Body(new ZodValidationPipe(CreateCalibrationSchema)) body: z.infer<typeof CreateCalibrationSchema>) {
    return ok(this.svc.createCalibration(body))
  }

  // ============================== 资产 / 折旧 ==============================

  @Get('assets/stats')
  assetStats() {
    return ok(this.svc.getAssetStats())
  }

  @Get('assets/retirements')
  listRetirements() {
    return ok(this.svc.listRetirements())
  }

  @Post('assets/retirements/:id/approve')
  approveRetirement(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveRetirementSchema)) body: z.infer<typeof ApproveRetirementSchema>) {
    return ok(this.svc.approveRetirement(id, body))
  }

  @Get('assets')
  listAssets(@Query('deviceId') deviceId?: string, @Query('status') status?: string) {
    return ok(this.svc.listAssets({ deviceId, status }))
  }

  @Get('assets/:id')
  getAsset(@Param('id') id: string) {
    return ok(this.svc.getAsset(id))
  }

  @Get('assets/:id/depreciation')
  depreciation(@Param('id') id: string, @Query('method') method?: string, @Query('asOf') asOf?: string) {
    const m = method === 'straight-line' || method === 'declining' ? (method as DepreciationMethod) : undefined
    return ok(this.svc.getDepreciationSchedule(id, { method: m, asOf }))
  }

  @Post('assets')
  @HttpCode(201)
  createAsset(@Body(new ZodValidationPipe(CreateAssetSchema)) body: z.infer<typeof CreateAssetSchema>) {
    return ok(this.svc.createAsset(body))
  }

  @Put('assets/:id')
  updateAsset(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateAssetSchema)) body: z.infer<typeof UpdateAssetSchema>) {
    return ok(this.svc.updateAsset(id, body))
  }

  @Post('assets/:id/retire')
  requestRetirement(@Param('id') id: string, @Body(new ZodValidationPipe(RequestRetirementSchema)) body: z.infer<typeof RequestRetirementSchema>) {
    return ok(this.svc.requestRetirement(id, body))
  }

  // ============================== OEE ==============================

  @Get('oee/overview')
  oeeOverview() {
    return ok(this.svc.getOeeOverview())
  }

  @Get('oee/trend')
  oeeTrend(@Query('days') days?: string) {
    return ok(this.svc.getOeeTrend(Number(days ?? 7)))
  }

  @Get('oee/downtime-loss')
  downtimeLoss(@Query('deviceId') deviceId?: string) {
    return ok(this.svc.getDowntimeLoss(deviceId))
  }

  @Get('oee/devices/:deviceId')
  oeeDevice(@Param('deviceId') deviceId: string) {
    return ok(this.svc.getOeeDevice(deviceId))
  }

  @Get('oee')
  listOee() {
    return ok(this.svc.listOee())
  }

  // ============================== 成本核算 + DRG ==============================

  @Get('cost/summary')
  costSummary() {
    return ok(this.svc.getCostSummary())
  }

  @Get('cost/by-exam')
  costByExam() {
    return ok(this.svc.getCostByExam())
  }

  @Get('drg/groups')
  drgGroups(@Query('baseRate') baseRate?: string) {
    return ok(this.svc.listDrg(Number(baseRate ?? 12000)))
  }

  @Post('drg/group')
  groupDiagnosis(@Body(new ZodValidationPipe(GroupDiagnosisSchema)) body: z.infer<typeof GroupDiagnosisSchema>) {
    return ok(this.svc.groupDiagnosis(body.principalDiagnosisCode, body.baseRate ?? 12000))
  }

  // ============================== 定时 BI 报表 ==============================

  @Get('scheduled-reports')
  listReportDefinitions() {
    return ok(this.svc.listReportDefinitions())
  }

  @Post('scheduled-reports')
  @HttpCode(201)
  createReportDefinition(@Body(new ZodValidationPipe(CreateReportDefinitionSchema)) body: z.infer<typeof CreateReportDefinitionSchema>) {
    return ok(this.svc.createReportDefinition(body))
  }

  @Put('scheduled-reports/:id')
  updateReportDefinition(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateReportDefinitionSchema)) body: z.infer<typeof UpdateReportDefinitionSchema>) {
    return ok(this.svc.updateReportDefinition(id, body))
  }

  @Post('scheduled-reports/:id/run')
  runReportDefinition(@Param('id') id: string, @Body(new ZodValidationPipe(RunReportSchema)) body: z.infer<typeof RunReportSchema>) {
    return ok(this.svc.runReportDefinition(id, body))
  }

  @Get('report-instances')
  listReportInstances(@Query('definitionId') definitionId?: string) {
    return ok(this.svc.listReportInstances({ definitionId }))
  }
}

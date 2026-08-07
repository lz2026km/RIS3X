import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { DeviceMgmtService } from './devicemgmt.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  AddMaterialSchema,
  CreateMaintenancePlanSchema,
  RecordDoseSchema,
  ReportAdverseReactionSchema,
  ReportDeviceFaultSchema,
  UpdateContrastInventorySchema,
  UpdateDeviceSchema,
  UpdateEquipmentLifecycleSchema,
  UpdateMaintenancePlanSchema,
} from './devicemgmt.schema'

@ApiTags('device-mgmt')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('device-mgmt')
export class DeviceMgmtController {
  constructor(private readonly svc: DeviceMgmtService) {}

  @Get('equipment-lifecycle')
  listEquipmentLifecycle() { return this.svc.listEquipmentLifecycle() }

  @Get('equipment-lifecycle/:id')
  getEquipmentLifecycle(@Param('id') id: string) { return this.svc.getEquipmentLifecycle(id) }

  @Put('equipment-lifecycle/:id')
  updateEquipmentLifecycle(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateEquipmentLifecycleSchema)) body: Record<string, unknown>) { return this.svc.updateEquipmentLifecycle(id, body) }

  @Get('devices')
  listDevices() { return this.svc.listDevices() }

  @Get('devices/:id')
  getDevice(@Param('id') id: string) { return this.svc.getDevice(id) }

  @Put('devices/:id')
  updateDevice(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDeviceSchema)) body: Record<string, unknown>) { return this.svc.updateDevice(id, body) }

  @Get('faults')
  listDeviceFaults() { return this.svc.listDeviceFaults() }

  @Post('faults')
  reportDeviceFault(@Body(new ZodValidationPipe(ReportDeviceFaultSchema)) body: Record<string, unknown>) { return this.svc.reportDeviceFault(body) }

  @Get('materials')
  listMaterials() { return this.svc.listMaterials() }

  @Post('materials')
  addMaterial(@Body(new ZodValidationPipe(AddMaterialSchema)) body: Record<string, unknown>) { return this.svc.addMaterial(body) }

  @Get('dose-tracking')
  getDoseTracking() { return this.svc.getDoseTracking() }

  @Post('dose-tracking')
  recordDose(@Body(new ZodValidationPipe(RecordDoseSchema)) body: Record<string, unknown>) { return this.svc.recordDose(body) }

  @Get('contrast/adverse-reactions')
  listAdverseReactions() { return this.svc.listAdverseReactions() }

  @Post('contrast/adverse-reactions')
  @HttpCode(HttpStatus.CREATED)
  reportAdverseReaction(@Body(new ZodValidationPipe(ReportAdverseReactionSchema)) body: Record<string, unknown>) { return this.svc.reportAdverseReaction(body) }

  @Get('contrast/injection')
  getInjectionWorkstation() { return this.svc.getInjectionWorkstation() }

  @Get('contrast/inventory')
  getContrastInventory() { return this.svc.getContrastInventory() }

  @Put('contrast/inventory/:id')
  updateContrastInventory(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateContrastInventorySchema)) body: Record<string, unknown>) { return this.svc.updateContrastInventory(id, body) }

  @Get('contrast/quality')
  getContrastQuality() { return this.svc.getContrastQuality() }

  // [W4-B] 保养计划 CRUD + 到期提醒 (静态子路由 maintenance-due 先于 :id 注册)
  @Get('maintenance-due')
  maintenanceDue(@Query('days') days?: string) { return this.svc.maintenanceDue(Number(days ?? 30)) }

  @Get('maintenance-plans')
  listMaintenancePlans(@Query('deviceId') deviceId?: string, @Query('status') status?: string) {
    return this.svc.listMaintenancePlans({ deviceId, status })
  }

  @Post('maintenance-plans')
  @HttpCode(HttpStatus.CREATED)
  createMaintenancePlan(@Body(new ZodValidationPipe(CreateMaintenancePlanSchema)) body: Record<string, unknown>) {
    return this.svc.createMaintenancePlan(body)
  }

  @Put('maintenance-plans/:id')
  updateMaintenancePlan(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateMaintenancePlanSchema)) body: Record<string, unknown>) {
    return this.svc.updateMaintenancePlan(id, body)
  }

  @Delete('maintenance-plans/:id')
  deleteMaintenancePlan(@Param('id') id: string) { return this.svc.deleteMaintenancePlan(id) }
}

import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { DeviceMgmtService } from './devicemgmt.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  AddMaterialSchema,
  RecordDoseSchema,
  ReportAdverseReactionSchema,
  ReportDeviceFaultSchema,
  UpdateContrastInventorySchema,
  UpdateDeviceSchema,
  UpdateEquipmentLifecycleSchema,
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
}

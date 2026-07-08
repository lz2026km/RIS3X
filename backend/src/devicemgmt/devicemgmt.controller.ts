import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Device-mgmtService } from './device-mgmt.service';
@ApiTags('device-mgmt')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/device-mgmt')
export class Device-mgmtController {
  constructor(private readonly svc: Device-mgmtService) {}
  @Get('equipment-lifecycle')
  listEquipmentLifecycle(@Param('id') id: string) {
    return this.svc.listEquipmentLifecycle(id);
  }

  @Get('equipment-lifecycle/:id')
  getEquipmentLifecycle(@Param('id') id: string) {
    return this.svc.getEquipmentLifecycle(id);
  }

  @Put('equipment-lifecycle/:id')
  updateEquipmentLifecycle(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateEquipmentLifecycle(id, body);
  }

  @Get('devices')
  listDevices(@Param('id') id: string) {
    return this.svc.listDevices(id);
  }

  @Get('devices/:id')
  getDevice(@Param('id') id: string) {
    return this.svc.getDevice(id);
  }

  @Put('devices/:id')
  updateDevice(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateDevice(id, body);
  }

  @Get('faults')
  listDeviceFaults(@Param('id') id: string) {
    return this.svc.listDeviceFaults(id);
  }

  @Post('faults')
  reportDeviceFault(@Body() body: any) {
    return this.svc.reportDeviceFault(body);
  }

  @Get('materials')
  listMaterials(@Param('id') id: string) {
    return this.svc.listMaterials(id);
  }

  @Post('materials')
  addMaterial(@Body() body: any) {
    return this.svc.addMaterial(body);
  }

  @Get('dose-tracking')
  getDoseTracking(@Param('id') id: string) {
    return this.svc.getDoseTracking(id);
  }

  @Post('dose-tracking')
  recordDose(@Body() body: any) {
    return this.svc.recordDose(body);
  }

  @Get('contrast/adverse-reactions')
  listAdverseReactions(@Param('id') id: string) {
    return this.svc.listAdverseReactions(id);
  }

  @Post('contrast/adverse-reactions')
  reportAdverseReaction(@Body() body: any) {
    return this.svc.reportAdverseReaction(body);
  }

  @Get('contrast/injection')
  getInjectionWorkstation(@Param('id') id: string) {
    return this.svc.getInjectionWorkstation(id);
  }

  @Get('contrast/inventory')
  getContrastInventory(@Param('id') id: string) {
    return this.svc.getContrastInventory(id);
  }

  @Put('contrast/inventory/:id')
  updateContrastInventory(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateContrastInventory(id, body);
  }

  @Get('contrast/quality')
  getContrastQuality(@Param('id') id: string) {
    return this.svc.getContrastQuality(id);
  }
}

import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DentalService } from './dental.service';
@ApiTags('dental')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/dental')
export class DentalController {
  constructor(private readonly svc: DentalService) {}
  @Get('studies')
  listStudies(@Param('id') id: string) {
    return this.svc.listStudies(id);
  }

  @Get('studies/:id')
  getStudy(@Param('id') id: string) {
    return this.svc.getStudy(id);
  }

  @Post('studies')
  createStudy(@Body() body: any) {
    return this.svc.createStudy(body);
  }

  @Put('studies/:id')
  updateStudy(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateStudy(id, body);
  }

  @Delete('studies/:id')
  deleteStudy(@Param('id') id: string) {
    return this.svc.deleteStudy(id);
  }

  @Get('ai-findings')
  listAiFindings(@Param('id') id: string) {
    return this.svc.listAiFindings(id);
  }

  @Post('ai-findings')
  createAiFinding(@Body() body: any) {
    return this.svc.createAiFinding(body);
  }

  @Get('implants')
  listImplants(@Param('id') id: string) {
    return this.svc.listImplants(id);
  }

  @Post('implants')
  createImplant(@Body() body: any) {
    return this.svc.createImplant(body);
  }

  @Put('implants/:id')
  updateImplant(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateImplant(id, body);
  }

  @Get('appointments')
  listAppointments(@Param('id') id: string) {
    return this.svc.listAppointments(id);
  }

  @Post('appointments')
  createAppointment(@Body() body: any) {
    return this.svc.createAppointment(body);
  }

  @Put('appointments/:id')
  updateAppointment(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateAppointment(id, body);
  }

  @Get('invoices')
  listInvoices(@Param('id') id: string) {
    return this.svc.listInvoices(id);
  }

  @Post('invoices')
  createInvoice(@Body() body: any) {
    return this.svc.createInvoice(body);
  }

  @Get('inventory')
  listInventory(@Param('id') id: string) {
    return this.svc.listInventory(id);
  }

  @Post('inventory')
  addInventoryItem(@Body() body: any) {
    return this.svc.addInventoryItem(body);
  }

  @Put('inventory/:id')
  updateInventoryItem(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateInventoryItem(id, body);
  }
}

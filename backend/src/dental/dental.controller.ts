import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { DentalService } from './dental.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  AddInventoryItemSchema,
  CreateAiFindingSchema,
  CreateDentalAppointmentSchema,
  CreateDentalInvoiceSchema,
  CreateDentalStudySchema,
  CreateImplantSchema,
  UpdateDentalAppointmentSchema,
  UpdateDentalStudySchema,
  UpdateImplantSchema,
  UpdateInventoryItemSchema,
} from './dental.schema'

@ApiTags('dental')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('dental')
export class DentalController {
  constructor(private readonly svc: DentalService) {}

  @Get('studies')
  listStudies() { return this.svc.listStudies() }

  @Get('studies/:id')
  getStudy(@Param('id') id: string) { return this.svc.getStudy(id) }

  @Post('studies')
  createStudy(@Body(new ZodValidationPipe(CreateDentalStudySchema)) body: Record<string, unknown>) { return this.svc.createStudy(body) }

  @Put('studies/:id')
  updateStudy(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDentalStudySchema)) body: Record<string, unknown>) { return this.svc.updateStudy(id, body) }

  @Delete('studies/:id')
  deleteStudy(@Param('id') id: string) { return this.svc.deleteStudy(id) }

  @Get('ai-findings')
  listAiFindings() { return this.svc.listAiFindings() }

  @Post('ai-findings')
  createAiFinding(@Body(new ZodValidationPipe(CreateAiFindingSchema)) body: Record<string, unknown>) { return this.svc.createAiFinding(body) }

  @Get('implants')
  listImplants() { return this.svc.listImplants() }

  @Post('implants')
  createImplant(@Body(new ZodValidationPipe(CreateImplantSchema)) body: Record<string, unknown>) { return this.svc.createImplant(body) }

  @Put('implants/:id')
  updateImplant(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateImplantSchema)) body: Record<string, unknown>) { return this.svc.updateImplant(id, body) }

  @Get('appointments')
  listAppointments() { return this.svc.listAppointments() }

  @Post('appointments')
  createAppointment(@Body(new ZodValidationPipe(CreateDentalAppointmentSchema)) body: Record<string, unknown>) { return this.svc.createAppointment(body) }

  @Put('appointments/:id')
  updateAppointment(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDentalAppointmentSchema)) body: Record<string, unknown>) { return this.svc.updateAppointment(id, body) }

  @Get('invoices')
  listInvoices() { return this.svc.listInvoices() }

  @Post('invoices')
  createInvoice(@Body(new ZodValidationPipe(CreateDentalInvoiceSchema)) body: Record<string, unknown>) { return this.svc.createInvoice(body) }

  @Get('inventory')
  listInventory() { return this.svc.listInventory() }

  @Post('inventory')
  addInventoryItem(@Body(new ZodValidationPipe(AddInventoryItemSchema)) body: Record<string, unknown>) { return this.svc.addInventoryItem(body) }

  @Put('inventory/:id')
  updateInventoryItem(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateInventoryItemSchema)) body: Record<string, unknown>) { return this.svc.updateInventoryItem(id, body) }
}

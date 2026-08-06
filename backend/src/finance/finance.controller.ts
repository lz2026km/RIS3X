import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FinanceService } from './finance.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CreateChargeItemSchema, CreateInvoiceSchema, PayInvoiceSchema, UpdateChargeItemSchema } from './finance.schema'

@ApiTags('finance')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Get('charge-items')
  listChargeItems() { return this.svc.listChargeItems() }

  @Post('charge-items')
  createChargeItem(@Body(new ZodValidationPipe(CreateChargeItemSchema)) body: Record<string, unknown>) { return this.svc.createChargeItem(body) }

  @Put('charge-items/:id')
  updateChargeItem(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateChargeItemSchema)) body: Record<string, unknown>) { return this.svc.updateChargeItem(id, body) }

  @Delete('charge-items/:id')
  deleteChargeItem(@Param('id') id: string) { return this.svc.deleteChargeItem(id) }

  @Get('invoices')
  listInvoices() { return this.svc.listInvoices() }

  @Post('invoices')
  createInvoice(@Body(new ZodValidationPipe(CreateInvoiceSchema)) body: Record<string, unknown>) { return this.svc.createInvoice(body) }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) { return this.svc.getInvoice(id) }

  @Post('invoices/:id/pay')
  payInvoice(@Body(new ZodValidationPipe(PayInvoiceSchema)) body: Record<string, unknown>) { return this.svc.payInvoice(body) }

  @Get('revenue-analysis')
  getRevenueAnalysis() { return this.svc.getRevenueAnalysis() }

  @Get('cost-accounting')
  getCostAccounting() { return this.svc.getCostAccounting() }

  @Get('financial-reports')
  getFinancialReports() { return this.svc.getFinancialReports() }
}

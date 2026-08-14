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

  // [v3.0.6.11-99 Wave 10D] 财务总览 (本月收入/成本/利润)
  @Get('overview')
  getOverview() { return this.svc.getOverview() }

  // [v3.0.6.11-99 Wave 10D] 近 30 日收入趋势
  @Get('daily-trend')
  getDailyTrend(@Query('days') days?: string) { return this.svc.getDailyTrend(Number(days ?? 30)) }

  // [v3.0.6.11-99 Wave 10D] 模态收入构成
  @Get('by-modality')
  getByModality() { return this.svc.getByModality() }

  // [v3.0.6.11-99 Wave 10D] 应收分析 (账龄分布)
  @Get('accounts-receivable')
  getAccountsReceivable() { return this.svc.getAccountsReceivable() }

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

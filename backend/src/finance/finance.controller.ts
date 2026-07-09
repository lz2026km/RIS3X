import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FinanceService } from './finance.service'

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Get('charge-items')
  listChargeItems() { return this.svc.listChargeItems() }

  @Post('charge-items')
  createChargeItem(@Body() body: any) { return this.svc.createChargeItem(body) }

  @Put('charge-items/:id')
  updateChargeItem(@Param('id') id: string, @Body() body: any) { return this.svc.updateChargeItem(id, body) }

  @Get('invoices')
  listInvoices() { return this.svc.listInvoices() }

  @Post('invoices')
  createInvoice(@Body() body: any) { return this.svc.createInvoice(body) }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) { return this.svc.getInvoice(id) }

  @Post('invoices/:id/pay')
  payInvoice(@Body() body: any) { return this.svc.payInvoice(body) }

  @Get('revenue-analysis')
  getRevenueAnalysis() { return this.svc.getRevenueAnalysis() }

  @Get('cost-accounting')
  getCostAccounting() { return this.svc.getCostAccounting() }

  @Get('financial-reports')
  getFinancialReports() { return this.svc.getFinancialReports() }
}

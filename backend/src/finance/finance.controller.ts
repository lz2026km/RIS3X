import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}
  @Get('charge-items')
  listChargeItems(@Param('id') id: string) {
    return this.svc.listChargeItems(id);
  }

  @Post('charge-items')
  createChargeItem(@Body() body: any) {
    return this.svc.createChargeItem(body);
  }

  @Put('charge-items/:id')
  updateChargeItem(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateChargeItem(id, body);
  }

  @Get('invoices')
  listInvoices(@Param('id') id: string) {
    return this.svc.listInvoices(id);
  }

  @Post('invoices')
  createInvoice(@Body() body: any) {
    return this.svc.createInvoice(body);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) {
    return this.svc.getInvoice(id);
  }

  @Post('invoices/:id/pay')
  payInvoice(@Body() body: any) {
    return this.svc.payInvoice(body);
  }

  @Get('revenue-analysis')
  getRevenueAnalysis(@Param('id') id: string) {
    return this.svc.getRevenueAnalysis(id);
  }

  @Get('cost-accounting')
  getCostAccounting(@Param('id') id: string) {
    return this.svc.getCostAccounting(id);
  }

  @Get('financial-reports')
  getFinancialReports(@Param('id') id: string) {
    return this.svc.getFinancialReports(id);
  }
}

/**
 * [G005 W12-PatientService] 支付控制器
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  PaymentService,
  type PaymentItemType,
  type PaymentMethod,
  type PaymentStatus,
} from './payment.service'

const MethodEnum = z.enum(['WECHAT', 'ALIPAY', 'INSURANCE', 'CASH', 'MIXED'])
const ItemEnum = z.enum(['REGISTRATION', 'APPOINTMENT', 'EXAM', 'REPORT'])

const CreateOrderSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().optional(),
  itemType: ItemEnum.optional(),
  refId: z.string().optional(),
  amount: z.number().positive().optional(),
  method: MethodEnum.optional(),
  subject: z.string().optional(),
})

const FromRegistrationSchema = z.object({
  visitId: z.string().min(1),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  amount: z.number().positive().optional(),
  method: MethodEnum.optional(),
})

const FromAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  amount: z.number().positive().optional(),
  method: MethodEnum.optional(),
  modality: z.string().optional(),
})

const PaySchema = z.object({
  method: MethodEnum.optional(),
  transactionId: z.string().optional(),
})

const RefundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
  operator: z.string().optional(),
})

const CloseSchema = z.object({ reason: z.string().optional() })

const NotifySchema = z.object({
  orderNo: z.string().min(1),
  method: MethodEnum,
  result: z.enum(['SUCCESS', 'FAIL']),
  transactionId: z.string().optional(),
  failureReason: z.string().optional(),
  raw: z.record(z.any()).optional(),
})

@ApiTags('payment')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('payment')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Post('orders')
  createOrder(@Body(new ZodValidationPipe(CreateOrderSchema)) body: z.infer<typeof CreateOrderSchema>) {
    return this.service.createOrder(body)
  }

  @Post('orders/from-registration')
  createFromRegistration(@Body(new ZodValidationPipe(FromRegistrationSchema)) body: z.infer<typeof FromRegistrationSchema>) {
    return this.service.createFromRegistration(body)
  }

  @Post('orders/from-appointment')
  createFromAppointment(@Body(new ZodValidationPipe(FromAppointmentSchema)) body: z.infer<typeof FromAppointmentSchema>) {
    return this.service.createFromAppointment(body)
  }

  @Get('orders')
  listOrders(
    @Query('status') status?: PaymentStatus,
    @Query('method') method?: PaymentMethod,
    @Query('patientId') patientId?: string,
    @Query('itemType') itemType?: PaymentItemType,
  ) {
    return this.service.listOrders({ status, method, patientId, itemType })
  }

  @Get('reconciliation')
  reconciliation(@Query('date') date?: string, @Query('method') method?: PaymentMethod) {
    return this.service.reconciliation({ date, method })
  }

  @Get('refunds')
  listRefunds(@Query('orderId') orderId?: string) {
    return { items: this.service.listRefunds(orderId), total: this.service.listRefunds(orderId).length }
  }

  @Get('stats')
  stats() {
    return this.service.stats()
  }

  @Post('notify')
  @Public()
  notify(@Body(new ZodValidationPipe(NotifySchema)) body: z.infer<typeof NotifySchema>) {
    return this.service.notify(body)
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.service.getOrder(id)
  }

  @Post('orders/:id/pay')
  pay(@Param('id') id: string, @Body(new ZodValidationPipe(PaySchema)) body: z.infer<typeof PaySchema>) {
    return this.service.pay(id, body)
  }

  @Post('orders/:id/refund')
  refund(@Param('id') id: string, @Body(new ZodValidationPipe(RefundSchema)) body: z.infer<typeof RefundSchema>) {
    return this.service.refund(id, body)
  }

  @Post('orders/:id/close')
  close(@Param('id') id: string, @Body(new ZodValidationPipe(CloseSchema)) body: z.infer<typeof CloseSchema>) {
    return this.service.close(id, body)
  }
}

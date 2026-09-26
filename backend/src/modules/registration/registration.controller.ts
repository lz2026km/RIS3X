/**
 * G005 放射RIS系统 - 登记工作站控制器
 *
 * - GET  /registration/scan                  条码/二维码/身份证号/EMPI 检索
 * - POST /registration/:visitId/prep-confirm 准备项合规确认
 * - POST /registration/:visitId/consent      预约/登记知情同意
 * - GET  /registration/:visitId/charge       缴费单
 * - POST /registration/:visitId/pay          缴费
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RegistrationService, type PrepItem } from './registration.service'

const PrepItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
  checked: z.boolean().optional(),
})

const PrepConfirmSchema = z.object({
  items: z.array(PrepItemSchema).max(50).optional(),
  confirmedBy: z.string().optional(),
})

const ConsentSchema = z.object({
  patientId: z.string().optional(),
  consentType: z.string().optional(),
  procedure: z.string().optional(),
  agreed: z.boolean().optional(),
  signedBy: z.string().optional(),
  witnessName: z.string().optional(),
})

const PaySchema = z.object({
  amount: z.number().positive().optional(),
  method: z.string().optional(),
  operator: z.string().optional(),
})

@ApiTags('registration')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'NURSE', 'TECHNICIAN', 'DOCTOR')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly service: RegistrationService) {}

  // 静态路径先注册 (避免被 :visitId 参数路由影响)
  @Get('scan')
  scan(@Query('code') code: string, @Query('type') type?: string) {
    return this.service.scan(code, type)
  }

  @Get(':visitId/charge')
  getCharge(@Param('visitId') visitId: string) {
    return this.service.getCharge(visitId)
  }

  @Post(':visitId/prep-confirm')
  prepConfirm(
    @Param('visitId') visitId: string,
    @Body(new ZodValidationPipe(PrepConfirmSchema)) body: { items?: PrepItem[]; confirmedBy?: string },
  ) {
    return this.service.prepConfirm(visitId, body)
  }

  @Post(':visitId/consent')
  consent(
    @Param('visitId') visitId: string,
    @Body(new ZodValidationPipe(ConsentSchema)) body: z.infer<typeof ConsentSchema>,
  ) {
    return this.service.recordConsent(visitId, body)
  }

  @Post(':visitId/pay')
  pay(
    @Param('visitId') visitId: string,
    @Body(new ZodValidationPipe(PaySchema)) body: z.infer<typeof PaySchema>,
  ) {
    return this.service.pay(visitId, body)
  }
}

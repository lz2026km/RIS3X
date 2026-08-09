import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { KioskService } from './kiosk.service'

// [G005 Wave1A] 自助签到机模块 (前端 kioskApi 全部方法 + settings/messages)

const CheckInSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().optional(),
  examItemId: z.string().min(1),
  idCardLast4: z.string().optional(),
  modality: z.string().optional(),
})

@ApiTags('kiosk')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN', 'NURSE')
@Controller('kiosk')
export class KioskController {
  constructor(private readonly service: KioskService) {}

  @Get('patients')
  @ApiOperation({ summary: '按身份证后4位查询患者与待检项目 (Patient 派生)' })
  lookupPatients(@Query('last4') last4?: string) {
    return this.service.lookupPatients(last4 ?? '')
  }

  @Post('patients/:id/checkin')
  @ApiOperation({ summary: '患者签到' })
  checkInById(@Param('id') id: string, @Body(new ZodValidationPipe(CheckInSchema)) body: z.infer<typeof CheckInSchema>) {
    return this.service.checkIn({ patientId: id, patientName: body.patientName, examItemId: body.examItemId, modality: body.modality })
  }

  // 前端 kioskApi.checkIn 兼容别名
  @Post('check-in')
  @ApiOperation({ summary: '患者签到 (兼容 /check-in)' })
  checkIn(@Body(new ZodValidationPipe(CheckInSchema)) body: z.infer<typeof CheckInSchema>) {
    return this.service.checkIn({ patientId: body.patientId, patientName: body.patientName, examItemId: body.examItemId, modality: body.modality })
  }

  // 前端 kioskApi.todayStats 兼容别名
  @Get('today-stats')
  @ApiOperation({ summary: '今日签到统计 (兼容 /today-stats)' })
  todayStats() {
    return this.service.getStats()
  }

  @Get('stats')
  @ApiOperation({ summary: '今日签到统计' })
  getStats() {
    return this.service.getStats()
  }

  @Get('settings')
  @ApiOperation({ summary: '签到机设置' })
  listSettings() {
    return this.service.listSettings()
  }

  @Get('messages')
  @ApiOperation({ summary: '屏幕公告消息' })
  listMessages() {
    return this.service.listMessages()
  }
}

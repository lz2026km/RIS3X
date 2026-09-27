/**
 * [G005 W9-QC] 设备质控控制器 (equipment-qc)
 *   - GET  /equipment-qc/items?modality=&frequency=   检测项
 *   - GET  /equipment-qc/items/:id                    单项
 *   - GET  /equipment-qc/schedule                     排程 (模态 × 频率)
 *   - GET  /equipment-qc/records?...                  检测记录
 *   - POST /equipment-qc/records                      录入 (自动判定 pass/fail)
 *   - GET  /equipment-qc/stats                        统计 (通过率/模态/频率)
 *   - GET  /equipment-qc/failures                     失败清单
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EquipmentQcService } from './equipment-qc.service'
import type { EquipmentModality, QcFrequency } from './equipment-qc.types'

const ModalitySchema = z.enum(['CT', 'DR', 'MRI', 'MG'])
const FrequencySchema = z.enum(['daily', 'weekly', 'monthly'])

const CreateRecordSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  modality: ModalitySchema,
  testItemId: z.string().min(1),
  value: z.number(),
  testedAt: z.string().optional(),
  testerId: z.string().optional(),
  testerName: z.string().optional(),
  note: z.string().optional(),
})

@ApiTags('equipment-qc')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('equipment-qc')
export class EquipmentQcController {
  constructor(private readonly service: EquipmentQcService) {}

  @Get('items')
  listItems(@Query('modality') modality?: string, @Query('frequency') frequency?: string) {
    const mod = ModalitySchema.safeParse(modality).success ? (modality as EquipmentModality) : undefined
    const freq = FrequencySchema.safeParse(frequency).success ? (frequency as QcFrequency) : undefined
    return { success: true, data: this.service.listItems(mod, freq) }
  }

  @Get('schedule')
  schedule() {
    return { success: true, data: this.service.listSchedule() }
  }

  @Get('records')
  listRecords(
    @Query('deviceId') deviceId?: string,
    @Query('modality') modality?: string,
    @Query('frequency') frequency?: string,
    @Query('onlyFailed') onlyFailed?: string,
  ) {
    const mod = ModalitySchema.safeParse(modality).success ? (modality as EquipmentModality) : undefined
    const freq = FrequencySchema.safeParse(frequency).success ? (frequency as QcFrequency) : undefined
    return {
      success: true,
      data: this.service.listRecords({ deviceId, modality: mod, frequency: freq, onlyFailed: onlyFailed === 'true' }),
    }
  }

  @Post('records')
  @HttpCode(201)
  createRecord(@Body(new ZodValidationPipe(CreateRecordSchema)) body: z.infer<typeof CreateRecordSchema>) {
    return this.service.createRecord(body)
  }

  @Get('stats')
  stats() {
    return { success: true, data: this.service.getStats() }
  }

  @Get('failures')
  failures() {
    return { success: true, data: this.service.listFailures() }
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.service.getItem(id)
  }
}

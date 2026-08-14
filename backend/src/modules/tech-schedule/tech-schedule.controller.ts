/**
 * G005 放射RIS系统 v3.0.6.11-99 Wave 6B (tech-schedule) - 技师排班管理控制器
 * 端点:
 * - GET    /tech-schedules               排班列表 (date/month/technicianId/status 筛选)
 * - POST   /tech-schedules               新建排班
 * - PATCH  /tech-schedules/:id           编辑排班
 * - DELETE /tech-schedules/:id           删除排班
 * - POST   /tech-schedules/:id/confirm   确认排班
 * - POST   /tech-schedules/:id/swap      换班 (targetId|targetTechId + reason → 双方交换)
 * - POST   /tech-schedules/:id/leave     请假 (reason → 状态请假 + 补位提示)
 * - GET    /tech-schedules/calendar      月历视图 (month=YYYY-MM&year=YYYY → 日期×技师矩阵)
 * - GET    /tech-schedules/stats         统计 (本月班次/技师分布/请假数/夜班数)
 * - GET    /tech-schedules/meta          技师名册 + 检查室 (供筛选/新建表单)
 * - POST   /tech-schedules/batch-create  批量生成 (startDate/endDate/shiftPattern)
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TechScheduleService, type TechShift } from './tech-schedule.service'

const SHIFTS = ['DAY', 'NIGHT', 'WEEKEND', 'BACKUP'] as const

const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date 格式应为 YYYY-MM-DD'),
  shift: z.enum(SHIFTS),
  technicianId: z.string().min(1),
  roomId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const PatchSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    shift: z.enum(SHIFTS).optional(),
    technicianId: z.string().min(1).optional(),
    roomId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个字段' })

const SwapSchema = z
  .object({
    targetId: z.string().min(1).optional(),
    targetTechId: z.string().min(1).optional(),
    reason: z.string().optional(),
  })
  .refine((v) => v.targetId || v.targetTechId, { message: 'targetId 或 targetTechId 必填' })

const LeaveSchema = z.object({
  reason: z.string().min(1, 'reason 必填'),
})

const BatchSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftPattern: z.array(z.enum(SHIFTS)).min(1),
})

@ApiTags('tech-schedule')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller()
export class TechScheduleController {
  constructor(private readonly service: TechScheduleService) {}

  @Get('tech-schedules')
  list(
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('technicianId') technicianId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ date, month, technicianId, status })
  }

  @Get('tech-schedules/calendar')
  getCalendar(@Query('month') month?: string, @Query('year') year?: string) {
    return this.service.getCalendar({ month, year })
  }

  @Get('tech-schedules/stats')
  getStats(@Query('month') month?: string, @Query('year') year?: string) {
    return this.service.getStats({ month, year })
  }

  @Get('tech-schedules/meta')
  getMeta() {
    return { technicians: this.service.getTechnicians(), rooms: this.service.getRooms() }
  }

  @Post('tech-schedules')
  create(@Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>) {
    return this.service.create(body)
  }

  @Post('tech-schedules/batch-create')
  batchCreate(@Body(new ZodValidationPipe(BatchSchema)) body: z.infer<typeof BatchSchema>) {
    const created = this.service.batchCreate(body as { startDate: string; endDate: string; shiftPattern: TechShift[] })
    return { created, count: created.length }
  }

  @Patch('tech-schedules/:id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PatchSchema)) body: z.infer<typeof PatchSchema>,
  ) {
    return this.service.update(id, body)
  }

  @Delete('tech-schedules/:id')
  remove(@Param('id') id: string) {
    this.service.remove(id)
    return { success: true }
  }

  @Post('tech-schedules/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirm(id)
  }

  @Post('tech-schedules/:id/swap')
  swap(@Param('id') id: string, @Body(new ZodValidationPipe(SwapSchema)) body: z.infer<typeof SwapSchema>) {
    return this.service.swap(id, body)
  }

  @Post('tech-schedules/:id/leave')
  leave(@Param('id') id: string, @Body(new ZodValidationPipe(LeaveSchema)) body: z.infer<typeof LeaveSchema>) {
    return this.service.leave(id, body)
  }
}

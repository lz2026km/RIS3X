/**
 * G005 放射RIS系统 - 预约控制器
 * 基础 CRUD + 5 子资源 + [W5] 资源/冲突/提醒/失约/绿色通道/编号策略
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  AppointmentsService,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  type ReminderChannel,
} from './appointments.service'

// [v3.0.6.11-104 Wave 1B] 枚举对齐 Prisma AppointmentState: 补齐漏掉的 REGISTERED
const AppointmentStateEnum = z.enum([
  'SCHEDULED', 'CONFIRMED', 'REGISTERED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
])

const CreateSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  startAt: z.string().datetime().or(z.date()),
  endAt: z.string().datetime().or(z.date()),
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  room: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  note: z.string().optional(),
  referringDoctor: z.string().optional(),
  createdById: z.string().min(1),
  // [W5] 资源与安全字段
  roomId: z.string().optional(),
  roomName: z.string().optional(),
  technicianId: z.string().optional(),
  technicianName: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  bufferMin: z.number().int().min(0).optional(),
  prepInstruction: z.string().optional(),
  consentRequired: z.boolean().optional(),
  insuranceType: z.string().optional(),
  insurancePreAuthNo: z.string().optional(),
  greenChannel: z.boolean().optional(),
  rescheduleOf: z.string().optional(),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  allergyHistory: z.string().optional(),
  pregnant: z.boolean().optional(),
  renalFunction: z.string().optional(),
  contrastAgent: z.boolean().optional(),
  clinicalIndication: z.string().optional(),
})

const UpdateSchema = z.object({
  state: AppointmentStateEnum.optional(),
  startAt: z.string().datetime().or(z.date()).optional(),
  endAt: z.string().datetime().or(z.date()).optional(),
  note: z.string().optional(),
  deviceId: z.string().optional(),
  roomId: z.string().optional(),
  technicianId: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  bufferMin: z.number().int().min(0).optional(),
  consentRequired: z.boolean().optional(),
  cancelReason: z.string().optional(),
  rescheduleOf: z.string().optional(),
  greenChannel: z.boolean().optional(),
  insuranceType: z.string().optional(),
  insurancePreAuthNo: z.string().optional(),
})

const RoomSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  modality: z.string().min(1),
  location: z.string().optional(),
  maxPerSlot: z.number().int().positive().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'CLOSED']).optional(),
})

const WaitlistSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().optional(),
  phone: z.string().optional(),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  examItemName: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
})

const ReminderPlanSchema = z.object({
  appointmentId: z.string().optional(),
  patientName: z.string().min(1),
  phone: z.string().optional(),
  channel: z.enum(['SMS', 'WECHAT', 'PHONE']),
  scheduledAt: z.string().datetime().or(z.date()),
  template: z.string().optional(),
})

const GreenChannelSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().optional(),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  roomId: z.string().optional(),
  technicianId: z.string().optional(),
  createdById: z.string().optional(),
  startAt: z.string().datetime().or(z.date()).optional(),
})

@ApiTags('appointments')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('state') state?: string,
    @Query('deviceId') deviceId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: Number(take ?? 50),
      state: state && AppointmentStateEnum.safeParse(state).success ? (state as any) : undefined,
      deviceId,
      dateFrom,
      dateTo,
      patientId,
    })
  }

  // ===== 静态子路由 (必须先于 :id, 避免被 :id 吞掉) =====
  @Get('rules')
  rules() {
    return this.service.rules()
  }

  // ---- [W5] 机房资源 CRUD ----
  @Get('rooms')
  listRooms() {
    return this.service.listRooms()
  }

  @Post('rooms')
  createRoom(@Body(new ZodValidationPipe(RoomSchema)) body: any) {
    return this.service.createRoom(body)
  }

  @Patch('rooms/:id')
  updateRoom(@Param('id') id: string, @Body(new ZodValidationPipe(RoomSchema.partial())) body: any) {
    return this.service.updateRoom(id, body)
  }

  @Delete('rooms/:id')
  deleteRoom(@Param('id') id: string) {
    return this.service.deleteRoom(id)
  }

  // ---- [W5] 技师资源 ----
  @Get('technicians')
  listTechnicians(@Query('modality') modality?: string) {
    return this.service.listTechnicians(modality ? { modality } : undefined)
  }

  // ---- [W5] 时段容量 ----
  @Get('slots/capacity')
  slotCapacity(
    @Query('date') date?: string,
    @Query('deviceId') deviceId?: string,
    @Query('roomId') roomId?: string,
  ) {
    return this.service.slotCapacity({ date, deviceId, roomId })
  }

  // ---- [W5] 等候队列 ----
  @Get('waitlist')
  waitlist() {
    return this.service.waitlist()
  }

  @Post('waitlist')
  addWaitlist(@Body(new ZodValidationPipe(WaitlistSchema)) body: any) {
    return this.service.addWaitlist(body)
  }

  @Get('waitlist/next')
  nextWaitlist() {
    return this.service.nextWaitlist()
  }

  @Post('waitlist/:id/assign')
  assignWaitlist(@Param('id') id: string, @Body() body: any) {
    return this.service.assignWaitlist(id, body)
  }

  // ---- [W5] 提醒计划 ----
  @Get('reminder-templates')
  reminderTemplates() {
    return this.service.reminderTemplates()
  }

  @Get('reminder-plans')
  listReminderPlans() {
    return this.service.listReminderPlans()
  }

  @Post('reminder-plans')
  createReminderPlan(@Body(new ZodValidationPipe(ReminderPlanSchema)) body: any) {
    return this.service.createReminderPlan(body as { patientName: string; channel: ReminderChannel; scheduledAt: string })
  }

  @Post('reminder-plans/fire-due')
  fireDueReminders() {
    return this.service.fireDueReminders()
  }

  @Post('reminder-plans/:id/fire')
  fireReminderPlan(@Param('id') id: string) {
    return this.service.fireReminderPlan(id)
  }

  // ---- [W5] 失约管理 ----
  @Get('no-show')
  listNoShow() {
    return this.service.listNoShow()
  }

  @Post('no-show/scan')
  scanNoShow(@Query('thresholdMin') thresholdMin?: string) {
    return this.service.runNoShowScan(thresholdMin ? Number(thresholdMin) : 30)
  }

  @Post('no-show/:id/restore')
  restoreNoShow(@Param('id') id: string) {
    return this.service.restoreNoShow(id)
  }

  @Post('no-show/:id')
  markNoShow(@Param('id') id: string, @Query('thresholdMin') thresholdMin?: string) {
    return this.service.markNoShow(id, thresholdMin ? Number(thresholdMin) : 0)
  }

  // ---- [W5] 急诊绿色通道 ----
  @Get('green-channel')
  listGreenChannel() {
    return this.service.listGreenChannel()
  }

  @Post('green-channel')
  greenChannel(@Body(new ZodValidationPipe(GreenChannelSchema)) body: any) {
    return this.service.greenChannel(body)
  }

  // ---- [W5] 冲突预检 ----
  @Post('check-conflicts')
  checkConflicts(@Body() body: any) {
    return this.service.checkConflicts(body)
  }

  // ---- [W5] 编号策略 ----
  @Get('accession/next')
  nextAccession(@Query('modality') modality?: string, @Query('year') year?: string) {
    return { accessionNumber: this.service.nextAccession(modality ?? 'CT', year ? { year: Number(year) } : undefined) }
  }

  @Get('accession/parse')
  parseAccession(@Query('accession') accession: string) {
    return this.service.parseAccession(accession)
  }

  // ---- 旧子资源 ----
  @Get('reminders')
  reminders() {
    return this.service.reminders()
  }

  @Get('reschedules')
  reschedules() {
    return this.service.reschedules()
  }

  @Get('reschedule-history')
  rescheduleHistory() {
    return this.service.rescheduleHistory()
  }

  @Get('cancellations')
  cancellations() {
    return this.service.cancellations()
  }

  @Get('audit')
  audit(@Query('appointmentId') appointmentId?: string) {
    return this.service.appointmentAudit(appointmentId)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateSchema)) body: CreateAppointmentDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: UpdateAppointmentDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @Query('reason') reason?: string) {
    return this.service.cancel(id, reason)
  }
}

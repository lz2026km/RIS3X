/**
 * G005 放射RIS系统 v3.0.6.11-92 Wave3A (P2) - 科室公告/值班管理控制器
 * 端点:
 * - GET    /dept-announcements             公告列表 (置顶优先)
 * - GET    /dept-announcements/active      当前有效公告
 * - POST   /dept-announcements             新建公告
 * - PATCH  /dept-announcements/:id         更新公告 (置顶开关/内容)
 * - DELETE /dept-announcements/:id         删除公告
 * - GET    /on-call-schedules              值班列表 (month=YYYY-MM 过滤)
 * - GET    /on-call-schedules/calendar     月历视图 (month=YYYY-MM)
 * - POST   /on-call-schedules              新增值班
 * - PUT    /on-call-schedules/:id          更新值班
 * - DELETE /on-call-schedules/:id          删除值班
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DeptAnnouncementService } from './dept-announcement.service'

const AnnouncementSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(5),
  category: z.enum(['notice', 'meeting', 'policy', 'urgent', 'other']).default('notice'),
  pinned: z.boolean().default(false),
  expiresAt: z.string().optional(),
  author: z.string().optional(),
})

const AnnouncementPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    content: z.string().min(5).optional(),
    category: z.enum(['notice', 'meeting', 'policy', 'urgent', 'other']).optional(),
    pinned: z.boolean().optional(),
    expiresAt: z.string().optional(),
    author: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个字段' })

const OnCallScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date 格式应为 YYYY-MM-DD'),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  shift: z.enum(['DAY', 'NIGHT', 'WEEKEND']),
  role: z.string().optional(),
})

const OnCallSchedulePatchSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    doctorId: z.string().min(1).optional(),
    doctorName: z.string().min(1).optional(),
    shift: z.enum(['DAY', 'NIGHT', 'WEEKEND']).optional(),
    role: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个字段' })

@ApiTags('dept-announcement')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller()
export class DeptAnnouncementController {
  constructor(private readonly service: DeptAnnouncementService) {}

  // ================= 公告 =================

  @Get('dept-announcements')
  listAnnouncements() {
    return this.service.listAnnouncements()
  }

  @Get('dept-announcements/active')
  listActiveAnnouncements() {
    return this.service.listActiveAnnouncements()
  }

  @Post('dept-announcements')
  createAnnouncement(@Body(new ZodValidationPipe(AnnouncementSchema)) body: z.infer<typeof AnnouncementSchema>) {
    return this.service.createAnnouncement(body)
  }

  @Patch('dept-announcements/:id')
  updateAnnouncement(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AnnouncementPatchSchema)) body: z.infer<typeof AnnouncementPatchSchema>,
  ) {
    return this.service.updateAnnouncement(id, body)
  }

  @Delete('dept-announcements/:id')
  deleteAnnouncement(@Param('id') id: string) {
    this.service.deleteAnnouncement(id)
    return { success: true }
  }

  // ================= 值班 =================

  @Get('on-call-schedules')
  listSchedules(@Query('month') month?: string) {
    return this.service.listSchedules(month)
  }

  @Get('on-call-schedules/calendar')
  getCalendar(@Query('month') month: string) {
    return this.service.getCalendar(month || new Date().toISOString().slice(0, 7))
  }

  @Post('on-call-schedules')
  createSchedule(@Body(new ZodValidationPipe(OnCallScheduleSchema)) body: z.infer<typeof OnCallScheduleSchema>) {
    return this.service.createSchedule(body)
  }

  @Put('on-call-schedules/:id')
  updateSchedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OnCallSchedulePatchSchema)) body: z.infer<typeof OnCallSchedulePatchSchema>,
  ) {
    return this.service.updateSchedule(id, body)
  }

  @Delete('on-call-schedules/:id')
  deleteSchedule(@Param('id') id: string) {
    this.service.deleteSchedule(id)
    return { success: true }
  }
}

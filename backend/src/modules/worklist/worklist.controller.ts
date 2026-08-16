import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { WorklistService, WORKLIST_STATES, QC_STATES, type AssignDto, type WorklistListParams } from './worklist.service'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'

const CancelBodySchema = z.object({
  reason: z.string().max(500).optional(),
})

// [v3.0.6.11-92 Wave1B P0] 影像质控回写: PATCH /worklist/:id/state { state: IMAGE_READY|QC_REJECT|QC_PASS|IN_PROGRESS, note?, rating?, techNote?, qcNote? }
// [v3.0.6.11-95 Wave 1A] IN_PROGRESS = 重拍登记 (QC_REJECT → IN_PROGRESS); rating/备注随状态落库
// [v3.0.6.11-100 Wave 1B] + retakeReason 重拍原因 (重拍率统计原因维度)
export const RETAKE_REASON_CODES = ['motion_artifact', 'positioning', 'wrong_protocol', 'contrast_issue', 'equipment', 'other'] as const
const UpdateQcStateSchema = z.object({
  state: z.enum(QC_STATES),
  note: z.string().max(500).optional(),
  rating: z.string().max(16).optional(),
  techNote: z.string().max(500).optional(),
  qcNote: z.string().max(500).optional(),
  retakeReason: z.enum(RETAKE_REASON_CODES).optional(),
})

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(WORKLIST_STATES).optional(),
  modality: z.string().max(32).optional(),
  patientId: z.string().max(64).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  search: z.string().max(128).optional(),
})

const UpdateWorklistSchema = z.object({
  status: z.enum(WORKLIST_STATES).optional(),
  state: z.enum(WORKLIST_STATES).optional(),
  // [v3.0.6.11-95 Wave 1A P0-3] 批量改优先级: ROUTINE/URGENT/STAT + 中文别名 (普通/紧急/危重)
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT', '普通', '紧急', '危重']).optional(),
  // [v3.0.6.11-95 Wave 1A P1] 技师注释/质控备注/评级
  techNote: z.string().max(500).optional(),
  qcNote: z.string().max(500).optional(),
  rating: z.string().max(16).optional(),
  deviceId: z.string().max(64).nullable().optional(),
  bodyPart: z.string().max(128).optional(),
  modality: z.string().max(32).optional(),
  scheduledAt: z.string().max(40).nullable().optional(),
  // [v3.0.6.11-103 Wave 11] 剂量记录 (CT 剂量: DLP / CTDIvol, 技师工作站完成检查强制项)
  doseDlp: z.coerce.number().min(0).max(100000).optional(),
  doseCtdivol: z.coerce.number().min(0).max(10000).optional(),
})

const AssignBodySchema = z.object({
  doctorId: z.string().max(64).optional(),
  deviceId: z.string().max(64).optional(),
})

const BatchAssignBodySchema = z.object({
  ids: z.array(z.string().max(64)).min(1).max(500),
  doctorId: z.string().max(64).optional(),
  deviceId: z.string().max(64).optional(),
})

// [v3.0.6.11-95 Wave1B] 批量状态流转 (签到/开始/完成): { ids[] } 逐条校验源态
const BatchTransitionBodySchema = z.object({
  ids: z.array(z.string().max(64)).min(1).max(500),
})

// [v3.0.6.11-99 Wave 10D] 技师备注保存: note 必填; latest=true 覆盖式写入 (默认追加带时间戳)
const NoteBodySchema = z.object({
  note: z.string().min(1).max(2000),
  latest: z.boolean().optional(),
})

// [v3.0.6.11-100 Wave 1A] 技师 KPI 看板查询参数 (日期范围 + 可选技师)
const TechnicianDashboardQuerySchema = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  technicianId: z.string().max(64).optional(),
})

// [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配 (至少一项)
const AssignTechniciansBodySchema = z
  .object({
    primaryId: z.string().max(64).optional(),
    backupId: z.string().max(64).optional(),
  })
  .refine((v) => v.primaryId || v.backupId, { message: 'primaryId or backupId is required' })

// [v3.0.6.11-100 Wave 1A] 多技师协作: 交接班 (from → to + 备注)
const HandoverBodySchema = z.object({
  fromId: z.string().max(64),
  toId: z.string().max(64),
  note: z.string().max(500).optional(),
})

@ApiTags('worklist')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('worklist')
export class WorklistController {
  constructor(private readonly service: WorklistService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ListQuerySchema)) query: WorklistListParams) {
    return this.service.list(query)
  }

  // ⚠️ 必须在 GET /worklist/:id 之前注册
  @Get('stats')
  stats() {
    return this.service.getStats()
  }

  // [v3.0.6.11-99 Wave 10D] 今日总览 (按状态/模态/房间) — 静态子路由先于 :id 注册
  @Get('overview')
  overview() {
    return this.service.getOverview()
  }

  // [v3.0.6.11-99 Wave 10D] 模态分组列表
  @Get('by-modality')
  byModality() {
    return this.service.getByModality()
  }

  // [v3.0.6.11-99 Wave 10D] 技师维度明细 (完成数/平均时长/重拍数)
  @Get('technician-stats')
  technicianStats() {
    return this.service.getTechnicianStats()
  }

  // [v3.0.6.11-100 Wave 1B] 检查间实时状态看板 (房间级, 由 worklist 列表派生)
  @Get('room-status')
  roomStatus() {
    return this.service.getRoomStatus()
  }

  // [v3.0.6.11-100 Wave 1B] 重拍率统计 + 原因分类 (dimension: tech|modality|reason)
  @Get('retake-stats')
  retakeStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dimension') dimension?: string,
  ) {
    const dim = dimension === 'tech' || dimension === 'modality' ? dimension : 'reason'
    return this.service.getRetakeStats({ from, to, dimension: dim })
  }

  // [v3.0.6.11-100 Wave 1A] 技师 KPI 看板 (完成数/平均时长/重拍率/等待/设备占用/按时签到 + 每日趋势)
  @Get('technician-dashboard')
  technicianDashboard(@Query(new ZodValidationPipe(TechnicianDashboardQuerySchema)) query: { from?: string; to?: string; technicianId?: string }) {
    return this.service.getTechnicianDashboard(query)
  }

  // [v3.0.6.11-99 Wave 10D] 检查时间线 (登记→签到→开始→暂停→完成→质控 事件流)
  @Get('timeline/:id')
  timeline(@Param('id') id: string) {
    return this.service.getTimeline(id)
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorklistSchema)) body: z.infer<typeof UpdateWorklistSchema>,
  ) {
    return this.service.update(id, {
      state: body.state ?? body.status,
      priority: body.priority,
      techNote: body.techNote,
      qcNote: body.qcNote,
      rating: body.rating,
      deviceId: body.deviceId,
      bodyPart: body.bodyPart,
      modality: body.modality,
      scheduledAt: body.scheduledAt,
      doseDlp: body.doseDlp,
      doseCtdivol: body.doseCtdivol,
    })
  }

  @Patch(':id/state')
  updateQcState(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateQcStateSchema)) body: z.infer<typeof UpdateQcStateSchema>,
  ) {
    return this.service.updateQcState(id, body.state, body.note, {
      rating: body.rating,
      techNote: body.techNote,
      qcNote: body.qcNote,
      retakeReason: body.retakeReason,
    })
  }

  @Post('batch-assign')
  batchAssign(@Body(new ZodValidationPipe(BatchAssignBodySchema)) body: { ids: string[]; doctorId?: string; deviceId?: string }) {
    return this.service.batchAssign(body.ids, { doctorId: body.doctorId, deviceId: body.deviceId })
  }

  // [v3.0.6.11-95 Wave1B] 批量签到: 仅 SCHEDULED → ARRIVED
  @Post('batch-checkin')
  batchCheckIn(@Body(new ZodValidationPipe(BatchTransitionBodySchema)) body: { ids: string[] }) {
    return this.service.batchTransition(body.ids, 'checkin')
  }

  // [v3.0.6.11-95 Wave1B] 批量开始: 仅 ARRIVED → IN_PROGRESS
  @Post('batch-start')
  batchStart(@Body(new ZodValidationPipe(BatchTransitionBodySchema)) body: { ids: string[] }) {
    return this.service.batchTransition(body.ids, 'start')
  }

  // [v3.0.6.11-95 Wave1B] 批量完成: 仅 IN_PROGRESS → COMPLETED
  @Post('batch-complete')
  batchComplete(@Body(new ZodValidationPipe(BatchTransitionBodySchema)) body: { ids: string[] }) {
    return this.service.batchTransition(body.ids, 'complete')
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body(new ZodValidationPipe(AssignBodySchema)) body: AssignDto) {
    return this.service.assign(id, body)
  }

  // [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配
  @Post(':id/assign-technicians')
  assignTechnicians(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignTechniciansBodySchema)) body: { primaryId?: string; backupId?: string },
  ) {
    return this.service.assignTechnicians(id, body)
  }

  // [v3.0.6.11-100 Wave 1A] 多技师协作: 交接班
  @Post(':id/handover')
  handover(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HandoverBodySchema)) body: { fromId: string; toId: string; note?: string },
  ) {
    return this.service.handover(id, body)
  }

  @Post(':id/checkin')
  checkIn(@Param('id') id: string) {
    return this.service.checkIn(id)
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id)
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id)
  }

  // [v3.0.6.11-95 Wave 1A P1] 暂停/继续: IN_PROGRESS → PAUSED → IN_PROGRESS
  @Post(':id/pause')
  pause(@Param('id') id: string, @Body(new ZodValidationPipe(CancelBodySchema)) body: { reason?: string }) {
    return this.service.pause(id, body.reason)
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.service.resume(id)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(CancelBodySchema)) body: { reason?: string }) {
    return this.service.cancel(id, body.reason)
  }

  // [v3.0.6.11-99 Wave 10D] 技师备注保存 (techNote 落库, 新列未迁移时回退内存)
  @Post(':id/notes')
  notes(@Param('id') id: string, @Body(new ZodValidationPipe(NoteBodySchema)) body: { note: string; latest?: boolean }) {
    return this.service.saveNotes(id, body.note, { latest: body.latest })
  }
}

// [G005 Wave 3A v3.0.6.11-99] qc-pdca 质控闭环模块 Controller
// 12 端点: cycles CRUD / advance / phases CRUD / defects / stats / complete
import { Controller, Get, Post, Put, Patch, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import { QcPdcaService } from './qc-pdca.service'

const CreateCycleSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['报告质控', '图像质控', '流程质控', '服务质控']),
  description: z.string().optional(),
  target: z.string().optional(),
  ownerId: z.string().optional(),
})

const UpdateCycleSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.enum(['报告质控', '图像质控', '流程质控', '服务质控']).optional(),
  description: z.string().optional(),
  target: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().optional(),
})

const AddPhaseSchema = z.object({
  phase: z.enum(['plan', 'do', 'check', 'act']),
  content: z.string().min(1),
})

const UpdatePhaseSchema = z.object({
  phase: z.enum(['plan', 'do', 'check', 'act']).optional(),
  content: z.string().min(1).optional(),
})

const LinkDefectSchema = z.object({
  defectId: z.string().min(1),
})

const CompleteSchema = z.object({
  summary: z.string().optional(),
})

// [W9-QC] 整改措施 / 问题发现
const PhaseSchema = z.enum(['plan', 'do', 'check', 'act'])
const ActionStatusSchema = z.enum(['pending', 'in_progress', 'done', 'overdue'])

const CreateActionSchema = z.object({
  description: z.string().min(1),
  phase: PhaseSchema.optional(),
  ownerId: z.string().optional(),
  deadline: z.string().optional(),
})

const UpdateActionSchema = z.object({
  description: z.string().min(1).optional(),
  phase: PhaseSchema.optional(),
  ownerId: z.string().optional(),
  deadline: z.string().optional(),
  status: ActionStatusSchema.optional(),
})

const CreateFindingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  source: z.string().optional(),
})

@ApiTags('qc-pdca')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('qc-pdca')
export class QcPdcaController {
  constructor(private readonly service: QcPdcaService) {}

  @Get('cycles')
  listCycles() {
    return this.service.listCycles()
  }

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  createCycle(@Body(new ZodValidationPipe(CreateCycleSchema)) body: z.infer<typeof CreateCycleSchema>) {
    return this.service.createCycle(body)
  }

  @Get('cycles/:id')
  getCycle(@Param('id') id: string) {
    return this.service.getCycle(id)
  }

  @Patch('cycles/:id')
  updateCycle(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateCycleSchema)) body: z.infer<typeof UpdateCycleSchema>) {
    return this.service.updateCycle(id, body)
  }

  @Delete('cycles/:id')
  deleteCycle(@Param('id') id: string) {
    return this.service.deleteCycle(id)
  }

  @Post('cycles/:id/advance')
  advanceCycle(@Param('id') id: string) {
    return this.service.advanceCycle(id)
  }

  @Post('cycles/:id/complete')
  completeCycle(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteSchema)) body: z.infer<typeof CompleteSchema>) {
    return this.service.completeCycle(id, body)
  }

  @Get('cycles/:id/phases')
  listPhases(@Param('id') id: string) {
    return this.service.listPhases(id)
  }

  @Post('cycles/:id/phases')
  @HttpCode(HttpStatus.CREATED)
  addPhase(@Param('id') id: string, @Body(new ZodValidationPipe(AddPhaseSchema)) body: z.infer<typeof AddPhaseSchema>) {
    return this.service.addPhase(id, body)
  }

  @Patch('phases/:phaseId')
  updatePhase(@Param('phaseId') phaseId: string, @Body(new ZodValidationPipe(UpdatePhaseSchema)) body: z.infer<typeof UpdatePhaseSchema>) {
    return this.service.updatePhase(phaseId, body)
  }

  @Get('cycles/:id/defects')
  listCycleDefects(@Param('id') id: string) {
    return this.service.listCycleDefects(id)
  }

  @Post('cycles/:id/defects')
  @HttpCode(HttpStatus.CREATED)
  linkDefect(@Param('id') id: string, @Body(new ZodValidationPipe(LinkDefectSchema)) body: z.infer<typeof LinkDefectSchema>) {
    return this.service.linkDefect(id, body)
  }

  // [W9-QC] 整改措施 (actions)
  @Get('cycles/:id/actions')
  listActions(@Param('id') id: string) {
    return this.service.listActions(id)
  }

  @Post('cycles/:id/actions')
  @HttpCode(HttpStatus.CREATED)
  addAction(@Param('id') id: string, @Body(new ZodValidationPipe(CreateActionSchema)) body: z.infer<typeof CreateActionSchema>) {
    return this.service.addAction(id, body)
  }

  @Patch('actions/:actionId')
  updateAction(@Param('actionId') actionId: string, @Body(new ZodValidationPipe(UpdateActionSchema)) body: z.infer<typeof UpdateActionSchema>) {
    return this.service.updateAction(actionId, body)
  }

  @Delete('actions/:actionId')
  deleteAction(@Param('actionId') actionId: string) {
    return this.service.deleteAction(actionId)
  }

  @Post('actions/:actionId/complete')
  completeAction(@Param('actionId') actionId: string) {
    return this.service.completeAction(actionId)
  }

  // [W9-QC] 问题发现 (findings)
  @Get('cycles/:id/findings')
  listFindings(@Param('id') id: string) {
    return this.service.listFindings(id)
  }

  @Post('cycles/:id/findings')
  @HttpCode(HttpStatus.CREATED)
  addFinding(@Param('id') id: string, @Body(new ZodValidationPipe(CreateFindingSchema)) body: z.infer<typeof CreateFindingSchema>) {
    return this.service.addFinding(id, body)
  }

  @Get('metrics')
  getMetrics() {
    return this.service.getMetrics()
  }

  @Get('stats')
  getStats() {
    return this.service.getStats()
  }

  @Get('defects')
  listAllDefects() {
    return this.service.listAllDefects()
  }
}

import { Controller, Get, Post, Body, Logger, Query, Param } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import {
  AiDiagnosisService,
  AccuracyRequest,
  LungCadReviewDto,
  BreastCadReviewDto,
  FractureCadReviewDto,
  CardiacAiReviewDto,
} from './ai-diagnosis.service'

const AccuracySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  siteId: z.string().optional(),
  modality: z.string().optional(),
})

// [W1-B] 实体 id 字段放宽为可选: 支持"仅确认整条结果"的场景 (前端 confirmResult 可不携带病灶 id)
const LungReviewSchema = z.object({
  noduleId: z.string().min(1).optional(),
  status: z.enum(['confirmed', 'rejected', 'amended']),
  amendedDiagnosis: z.string().optional(),
  comment: z.string().optional(),
})

const BreastReviewSchema = z.object({
  lesionId: z.string().min(1).optional(),
  status: z.enum(['confirmed', 'rejected', 'amended']),
  amendedBiRads: z.string().optional(),
  comment: z.string().optional(),
})

const FractureReviewSchema = z.object({
  findingId: z.string().min(1).optional(),
  status: z.enum(['confirmed', 'rejected', 'amended']),
  amendedDiagnosis: z.string().optional(),
  comment: z.string().optional(),
})

const CardiacReviewSchema = z.object({
  status: z.enum(['confirmed', 'rejected', 'amended']),
  amendedAssessment: z.string().optional(),
  comment: z.string().optional(),
})

// [W1-B] 批量确认: ids 跨模型全表匹配, model 可选限定范围
const BatchConfirmSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.enum(['confirmed', 'rejected']),
  model: z.enum(['lung-cad', 'breast-cad', 'fracture-cad', 'cardiac-ai']).optional(),
})

// [G005 W3-BackendParity] 通用复核 DTO (兼容各模型特有字段)
const GenericReviewSchema = z.object({
  status: z.enum(['confirmed', 'rejected', 'amended']),
  noduleId: z.string().optional(),
  lesionId: z.string().optional(),
  findingId: z.string().optional(),
  amendedDiagnosis: z.string().optional(),
  amendedBiRads: z.string().optional(),
  amendedAssessment: z.string().optional(),
  comment: z.string().optional(),
}).passthrough()

/**
 * AI 辅助诊断端点
 * 前端(real 模式)请求 `{VITE_API_BASE_URL}/ai-diagnosis/*`,配合 main.ts 全局前缀 /api
 * 实际路径为 /api/ai-diagnosis/*;dev mock 模式由 MSW 拦截 /api/v1/ai-diagnosis/*
 */
@ApiTags('ai-diagnosis')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ai-diagnosis')
export class AiDiagnosisController {
  private readonly logger = new Logger(AiDiagnosisController.name)
  constructor(private readonly service: AiDiagnosisService) {}

  // ── [G005 Wave 10A] 病例库 (seed 扩充: 每模型 +15 例) ──
  @Get('cases')
  @ApiOperation({ summary: 'AI 病例库总览 (seed 扩充: 肺 10 类/乳腺 BI-RADS/骨折 8 类/心脏 6 类)' })
  listCases() {
    return this.service.listCaseLibrary()
  }

  @Get('cases/:model/:id')
  @ApiOperation({ summary: 'AI 病例详情 (按模型)' })
  getCase(@Param('model') model: string, @Param('id') id: string) {
    return this.service.getCaseById(model, id)
  }

  // ── 肺结节 CAD ────────────────────────────────────────────────────────────
  @Get('lung-cad/results')
  @ApiOperation({ summary: 'Lung CAD result list' })
  listLungCad() {
    return this.service.listLungCad()
  }

  @Get('lung-cad/results/:id')
  @ApiOperation({ summary: 'Lung CAD result detail' })
  getLungCad(@Param('id') id: string) {
    return this.service.getLungCad(id)
  }

  @Get('lung-cad/stats')
  @ApiOperation({ summary: 'Lung CAD stats' })
  lungCadStats() {
    return this.service.lungCadStats()
  }

  @Post('lung-cad/analyze/:studyId')
  @ApiOperation({ summary: 'Analyze lung study' })
  analyzeLungCad(@Param('studyId') studyId: string) {
    return this.service.analyzeLungCad(studyId)
  }

  @Post('lung-cad/results/:id/review')
  @ApiOperation({ summary: 'Review lung CAD result' })
  reviewLungCad(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LungReviewSchema)) dto: LungCadReviewDto,
  ) {
    return this.service.reviewLungCad(id, dto)
  }

  // ── 乳腺 CAD ──────────────────────────────────────────────────────────────
  @Get('breast-cad/results')
  @ApiOperation({ summary: 'Breast CAD result list' })
  listBreastCad() {
    return this.service.listBreastCad()
  }

  @Get('breast-cad/results/:id')
  @ApiOperation({ summary: 'Breast CAD result detail' })
  getBreastCad(@Param('id') id: string) {
    return this.service.getBreastCad(id)
  }

  @Get('breast-cad/stats')
  @ApiOperation({ summary: 'Breast CAD stats' })
  breastCadStats() {
    return this.service.breastCadStats()
  }

  @Post('breast-cad/analyze/:studyId')
  @ApiOperation({ summary: 'Analyze breast study' })
  analyzeBreastCad(@Param('studyId') studyId: string) {
    return this.service.analyzeBreastCad(studyId)
  }

  @Post('breast-cad/results/:id/review')
  @ApiOperation({ summary: 'Review breast CAD result' })
  reviewBreastCad(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BreastReviewSchema)) dto: BreastCadReviewDto,
  ) {
    return this.service.reviewBreastCad(id, dto)
  }

  // ── 骨折 CAD ──────────────────────────────────────────────────────────────
  @Get('fracture-cad/results')
  @ApiOperation({ summary: 'Fracture CAD result list' })
  listFractureCad() {
    return this.service.listFractureCad()
  }

  @Get('fracture-cad/results/:id')
  @ApiOperation({ summary: 'Fracture CAD result detail' })
  getFractureCad(@Param('id') id: string) {
    return this.service.getFractureCad(id)
  }

  @Get('fracture-cad/stats')
  @ApiOperation({ summary: 'Fracture CAD stats' })
  fractureCadStats() {
    return this.service.fractureCadStats()
  }

  @Post('fracture-cad/analyze/:studyId')
  @ApiOperation({ summary: 'Analyze fracture study' })
  analyzeFractureCad(@Param('studyId') studyId: string) {
    return this.service.analyzeFractureCad(studyId)
  }

  @Post('fracture-cad/results/:id/review')
  @ApiOperation({ summary: 'Review fracture CAD result' })
  reviewFractureCad(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FractureReviewSchema)) dto: FractureCadReviewDto,
  ) {
    return this.service.reviewFractureCad(id, dto)
  }

  // ── 心脏 AI ───────────────────────────────────────────────────────────────
  @Get('cardiac-ai/results')
  @ApiOperation({ summary: 'Cardiac AI result list' })
  listCardiacAi() {
    return this.service.listCardiacAi()
  }

  @Get('cardiac-ai/results/:id')
  @ApiOperation({ summary: 'Cardiac AI result detail' })
  getCardiacAi(@Param('id') id: string) {
    return this.service.getCardiacAi(id)
  }

  @Get('cardiac-ai/stats')
  @ApiOperation({ summary: 'Cardiac AI stats' })
  cardiacAiStats() {
    return this.service.cardiacAiStats()
  }

  @Post('cardiac-ai/analyze/:studyId')
  @ApiOperation({ summary: 'Analyze cardiac study' })
  analyzeCardiacAi(@Param('studyId') studyId: string) {
    return this.service.analyzeCardiacAi(studyId)
  }

  @Post('cardiac-ai/results/:id/review')
  @ApiOperation({ summary: 'Review cardiac AI result' })
  reviewCardiacAi(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CardiacReviewSchema)) dto: CardiacAiReviewDto,
  ) {
    return this.service.reviewCardiacAi(id, dto)
  }

  // ── 统计与准确率 ──────────────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'AI diagnosis stats for all models' })
  stats() {
    return this.service.stats()
  }

  // [W1-B] 批量确认 (前端 aiDiagnosisApi.batchConfirm)
  @Post('batch-confirm')
  @ApiOperation({ summary: 'Batch confirm/reject AI diagnosis results' })
  batchConfirm(@Body(new ZodValidationPipe(BatchConfirmSchema)) body: { ids: string[]; status: 'confirmed' | 'rejected'; model?: string }) {
    return this.service.batchConfirm(body)
  }

  // [W1-B] 模型重训 (模拟)
  @Post('retrain/:modelVersion')
  @ApiOperation({ summary: 'Retrain AI diagnosis model (simulated)' })
  retrainModel(@Param('modelVersion') modelVersion: string) {
    return this.service.retrainModel(modelVersion)
  }

  @Post('accuracy')
  @ApiOperation({ summary: 'AI diagnosis accuracy metrics' })
  accuracy(@Body(new ZodValidationPipe(AccuracySchema)) body: AccuracyRequest) {
    return this.service.accuracy(body)
  }

  @Get('trend')
  @ApiOperation({ summary: 'AI accuracy trend' })
  trend(@Query(new ZodValidationPipe(AccuracySchema)) body: AccuracyRequest) {
    return this.service.trend(body)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // [G005 W3-BackendParity] 通用模型路由 (必须声明在上述所有显式子路由之后,
  //   避免 :model 通配遮蔽 lung-cad/breast-cad/fracture-cad/cardiac-ai 显式端点)
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':model/results')
  @ApiOperation({ summary: '通用模型结果列表 (model: lung-cad|breast-cad|fracture-cad|cardiac-ai)' })
  listResultsByModel(
    @Param('model') model: string,
    @Query('status') status?: string,
    @Query('modality') modality?: string,
  ) {
    return this.service.listResultsByModel(model, { status, modality })
  }

  @Get(':model/results/:id')
  @ApiOperation({ summary: '通用模型结果详情' })
  getResultByModel(@Param('model') model: string, @Param('id') id: string) {
    return this.service.getResultByModel(model, id)
  }

  @Post(':model/results/:id/review')
  @ApiOperation({ summary: '通用模型结果复核' })
  reviewResultByModel(
    @Param('model') model: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(GenericReviewSchema)) body: Record<string, unknown>,
  ) {
    return this.service.reviewResultByModel(model, id, body)
  }
}

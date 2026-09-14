import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ConsentEducationService, CONSENT_STATUSES } from './consent-education.service'

// [G005 Wave1A] 知情同意/宣教模块 (前端 consentEducationApi 全部方法 + records/sign 新路径)
// [v3.0.6.11-104 Wave 3C] patientId/examId 绑定 + pediatric/pregnancy 类型 + witnessName + verify

const CreateConsentSchema = z.object({
  patient: z.string().min(1).max(64).optional(),
  patientId: z.string().min(1).max(64).optional(),
  examId: z.string().min(1).max(64).optional(),
  type: z.string().min(1).max(80).optional(),
  procedure: z.string().max(200).optional(),
  witnessName: z.string().max(64).optional(),
})

const UpdateConsentSchema = z.object({
  patient: z.string().min(1).max(64).optional(),
  patientId: z.string().max(64).nullable().optional(),
  examId: z.string().max(64).nullable().optional(),
  type: z.string().min(1).max(80).optional(),
  procedure: z.string().max(200).optional(),
  status: z.enum(['pending', 'signed', 'refused', 'expired']).optional(),
  witness: z.string().max(64).nullable().optional(),
  witnessName: z.string().max(64).nullable().optional(),
})

const SignSchema = z.object({
  signer: z.string().max(64).optional(),
  witnessName: z.string().max(64).optional(),
})

const VerifyQuerySchema = z.object({
  examId: z.string().min(1).max(64),
  type: z.string().max(80).optional(),
})

const CreateMaterialSchema = z.object({
  title: z.string().optional(),
  lang: z.string().optional(),
  category: z.string().optional(),
  pages: z.number().int().optional(),
  format: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
})

@ApiTags('consent-education')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('consent-education')
export class ConsentEducationController {
  constructor(private readonly service: ConsentEducationService) {}

  // ===== Records (新路径, 与 /consents 同存储) =====
  @Get('records')
  @ApiOperation({ summary: '知情同意记录列表 (可按 patientId/examId/status/type 过滤)' })
  listRecords(
    @Query('patientId') patientId?: string,
    @Query('examId') examId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.service.listConsents({ patientId, examId, status, type })
  }

  @Post('records')
  @HttpCode(200)
  @ApiOperation({ summary: '创建知情同意记录 (含 examId/patientId 绑定)' })
  createRecord(@Body(new ZodValidationPipe(CreateConsentSchema)) body: z.infer<typeof CreateConsentSchema>) {
    return this.service.createConsent(body)
  }

  // 静态路由 verify 先于 records/:id (不同前缀, 无冲突; 显式声明保证匹配)
  @Get('verify')
  @ApiOperation({ summary: '校验某检查某类型同意书是否已签 (增强检查/注射前) ' })
  verify(@Query(new ZodValidationPipe(VerifyQuerySchema)) query: z.infer<typeof VerifyQuerySchema>) {
    return this.service.verifyConsent(query.examId, query.type)
  }

  @Get('records/:id')
  @ApiOperation({ summary: '知情同意记录详情' })
  getRecord(@Param('id') id: string) {
    return this.service.getConsent(id)
  }

  @Patch('records/:id')
  @ApiOperation({ summary: '更新知情同意记录' })
  updateRecord(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateConsentSchema)) body: z.infer<typeof UpdateConsentSchema>) {
    return this.service.updateConsent(id, body)
  }

  @Post('records/:id/sign')
  @HttpCode(200)
  @ApiOperation({ summary: '签署知情同意' })
  signRecord(@Param('id') id: string, @Body(new ZodValidationPipe(SignSchema)) body: z.infer<typeof SignSchema>) {
    return this.service.signConsent(id, body)
  }

  // ===== Education Materials =====
  @Get('education-materials')
  @ApiOperation({ summary: '宣教内容库列表' })
  listEducationMaterials() {
    return this.service.listMaterials()
  }

  @Get('education-materials/:id')
  @ApiOperation({ summary: '宣教材料详情' })
  getEducationMaterial(@Param('id') id: string) {
    return this.service.getMaterial(id)
  }

  @Post('education-materials')
  @ApiOperation({ summary: '创建宣教材料' })
  createEducationMaterial(@Body(new ZodValidationPipe(CreateMaterialSchema)) body: z.infer<typeof CreateMaterialSchema>) {
    return this.service.createMaterial(body)
  }

  @Patch('education-materials/:id')
  @ApiOperation({ summary: '更新宣教材料' })
  updateEducationMaterial(@Param('id') id: string, @Body(new ZodValidationPipe(CreateMaterialSchema.partial())) body: z.infer<typeof CreateMaterialSchema>) {
    return this.service.updateMaterial(id, body)
  }

  // ===== 前端现有路径别名 (consents / materials) =====
  @Get('consents')
  @ApiOperation({ summary: '知情同意记录列表 (兼容 /consents)' })
  listConsents(
    @Query('patientId') patientId?: string,
    @Query('examId') examId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.service.listConsents({ patientId, examId, status, type })
  }

  @Post('consents')
  @ApiOperation({ summary: '创建知情同意记录 (兼容 /consents)' })
  createConsent(@Body(new ZodValidationPipe(CreateConsentSchema)) body: z.infer<typeof CreateConsentSchema>) {
    return this.service.createConsent(body)
  }

  @Patch('consents/:id')
  @ApiOperation({ summary: '更新知情同意记录 (兼容 /consents/:id)' })
  updateConsent(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateConsentSchema)) body: z.infer<typeof UpdateConsentSchema>) {
    return this.service.updateConsent(id, body)
  }

  @Get('materials')
  @ApiOperation({ summary: '宣教内容库列表 (兼容 /materials)' })
  listMaterials() {
    return this.service.listMaterials()
  }

  @Post('materials')
  @ApiOperation({ summary: '创建宣教材料 (兼容 /materials)' })
  createMaterial(@Body(new ZodValidationPipe(CreateMaterialSchema)) body: z.infer<typeof CreateMaterialSchema>) {
    return this.service.createMaterial(body)
  }
}

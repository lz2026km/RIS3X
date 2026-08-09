import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ConsentEducationService } from './consent-education.service'

// [G005 Wave1A] 知情同意/宣教模块 (前端 consentEducationApi 全部方法 + records/sign 新路径)

const CreateConsentSchema = z.object({
  patient: z.string().optional(),
  type: z.string().optional(),
  procedure: z.string().optional(),
})

const UpdateConsentSchema = z.object({
  patient: z.string().optional(),
  type: z.string().optional(),
  procedure: z.string().optional(),
  status: z.enum(['signed', 'pending', 'refused']).optional(),
  witness: z.string().nullable().optional(),
})

const SignSchema = z.object({ signer: z.string().optional() })

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
  @ApiOperation({ summary: '知情同意记录列表' })
  listRecords() {
    return this.service.listConsents()
  }

  @Post('records')
  @ApiOperation({ summary: '创建知情同意记录' })
  createRecord(@Body(new ZodValidationPipe(CreateConsentSchema)) body: z.infer<typeof CreateConsentSchema>) {
    return this.service.createConsent(body)
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
  @ApiOperation({ summary: '签署知情同意' })
  signRecord(@Param('id') id: string, @Body(new ZodValidationPipe(SignSchema)) body: z.infer<typeof SignSchema>) {
    return this.service.signConsent(id, body.signer)
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
  listConsents() {
    return this.service.listConsents()
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

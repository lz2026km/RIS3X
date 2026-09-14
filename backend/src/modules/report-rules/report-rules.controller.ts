// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎 Controller — 13 端点
// rules CRUD / evaluate / rulesets CRUD / history / stats
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import { ReportRulesService } from './report-rules.service'
import { RULE_FIELDS, RULE_OPERATORS, RULE_SEVERITIES, RULE_TYPES } from './report-rules.types'
import type { RuleField, RuleOperator, RuleSeverity, RuleType } from './report-rules.types'

const asTuple = <T extends string>(arr: readonly T[]): [T, ...T[]] => arr as unknown as [T, ...T[]]

const ConditionSchema = z.object({
  field: z.enum(asTuple<RuleField>(RULE_FIELDS)),
  operator: z.enum(asTuple<RuleOperator>(RULE_OPERATORS)),
  value: z.union([z.string(), z.number()]),
  when: z
    .object({
      field: z.enum(asTuple<RuleField>(RULE_FIELDS)),
      operator: z.enum(asTuple<RuleOperator>(RULE_OPERATORS)),
      value: z.union([z.string(), z.number()]),
    })
    .optional(),
})

const CreateRuleSchema = z.object({
  code: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(80),
  type: z.enum(asTuple<RuleType>(RULE_TYPES)),
  severity: z.enum(asTuple<RuleSeverity>(RULE_SEVERITIES)),
  description: z.string().max(200).optional(),
  condition: ConditionSchema,
  suggestion: z.string().max(300).optional(),
  examTypes: z.array(z.string().max(20)).max(10).optional(),
})

const UpdateRuleSchema = z.object({
  code: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(80).optional(),
  type: z.enum(asTuple<RuleType>(RULE_TYPES)).optional(),
  severity: z.enum(asTuple<RuleSeverity>(RULE_SEVERITIES)).optional(),
  description: z.string().max(200).optional(),
  condition: ConditionSchema.optional(),
  suggestion: z.string().max(300).optional(),
  enabled: z.boolean().optional(),
  examTypes: z.array(z.string().max(20)).max(10).optional(),
})

const EvaluateSchema = z.object({
  findings: z.string().max(20000).optional(),
  diagnosis: z.string().max(10000).optional(),
  impression: z.string().max(10000).optional(),
  conclusion: z.string().max(10000).optional(),
  recommendations: z.string().max(10000).optional(),
  examType: z.string().max(20).optional(),
  reportId: z.string().max(64).optional(),
  rulesetId: z.string().max(64).optional(),
})

const CreateRulesetSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  examTypes: z.array(z.string().max(20)).max(10).optional(),
  ruleIds: z.array(z.string().max(64)).max(100).optional(),
})

const UpdateRulesetSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  examTypes: z.array(z.string().max(20)).max(10).optional(),
  ruleIds: z.array(z.string().max(64)).max(100).optional(),
})

// [v3.0.6.11-105 Wave 1C] 国标报告书写规范 (RQI-RWS-03) 评估输入
// 中文说明 / English description: 结构化真值字段与报告文本字段
const RwsReportSchema = z
  .object({
    reportId: z.string().max(64).optional().describe('报告 ID / Report ID'),
    examType: z.string().max(20).optional().describe('检查类型, 如 CT / MRI / DR / Modality'),
    bodyPart: z.string().max(40).optional().describe('申请单检查部位 (真值) / Ordered body part'),
    patientName: z.string().max(60).optional().describe('报告内患者姓名 / Patient name on report'),
    patientId: z.string().max(64).optional().describe('报告内患者 ID / Patient ID on report'),
    orderPatientName: z.string().max(60).optional().describe('申请单患者姓名 / Ordered patient name'),
    orderPatientId: z.string().max(64).optional().describe('申请单患者 ID / Ordered patient ID'),
    clinicalHistory: z.string().max(2000).optional().describe('临床病史 (如 胆囊切除术后) / Clinical history'),
    findings: z.string().max(20000).optional().describe('影像所见 / Findings'),
    diagnosis: z.string().max(10000).optional().describe('诊断 / Diagnosis'),
    impression: z.string().max(10000).optional().describe('印象 / Impression'),
    conclusion: z.string().max(10000).optional().describe('结论 / Conclusion'),
    recommendations: z.string().max(10000).optional().describe('建议 / Recommendations'),
    signedBy: z.string().max(60).optional().describe('报告签署医生 / Signed by'),
    radiologistSignature: z.string().max(60).optional().describe('放射科医生签名 / Radiologist signature'),
    hasRadiologistSignature: z.boolean().optional().describe('是否已签名 / Has radiologist signature'),
    reportedBodyPart: z.string().max(40).optional().describe('报告内声明的检查部位 / Reported body part'),
    reportedSide: z.string().max(10).optional().describe('报告内声明的侧别 / Reported laterality'),
    examSide: z.string().max(10).optional().describe('申请单侧别 / Ordered laterality'),
  })
  .describe('国标报告书写规范评估输入 / National RWS report input')

const RwsRateSchema = z
  .object({
    reports: z.array(RwsReportSchema).min(1).max(500).describe('待评估报告列表 / Reports to evaluate'),
  })
  .describe('批量书写规范率评估 / Batch RWS compliance rate')

@ApiTags('report-rules')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('report-rules')
export class ReportRulesController {
  constructor(private readonly service: ReportRulesService) {}

  @Get('rules')
  listRules(@Query('examType') examType?: string) {
    return this.service.listRules(examType)
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createRule(@Body(new ZodValidationPipe(CreateRuleSchema)) body: z.infer<typeof CreateRuleSchema>) {
    return this.service.createRule(body)
  }

  @Put('rules/:id')
  updateRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateRuleSchema)) body: z.infer<typeof UpdateRuleSchema>) {
    return this.service.updateRule(id, body)
  }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.service.deleteRule(id)
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  evaluate(@Body(new ZodValidationPipe(EvaluateSchema)) body: z.infer<typeof EvaluateSchema>) {
    return this.service.evaluate(body)
  }

  // [v3.0.6.11-105 Wave 1C] 国标报告书写规范 (RQI-RWS-03)
  @Get('national-rws')
  getNationalRws() {
    return this.service.getNationalRwsRules()
  }

  @Post('evaluate-rws')
  @HttpCode(HttpStatus.OK)
  evaluateRws(@Body(new ZodValidationPipe(RwsReportSchema)) body: z.infer<typeof RwsReportSchema>) {
    return this.service.evaluateRws(body)
  }

  @Post('rws-rate')
  @HttpCode(HttpStatus.OK)
  rwsRate(@Body(new ZodValidationPipe(RwsRateSchema)) body: z.infer<typeof RwsRateSchema>) {
    return this.service.computeRwsRate(body.reports)
  }

  @Get('rulesets')
  listRulesets() {
    return this.service.listRulesets()
  }

  @Post('rulesets')
  @HttpCode(HttpStatus.CREATED)
  createRuleset(@Body(new ZodValidationPipe(CreateRulesetSchema)) body: z.infer<typeof CreateRulesetSchema>) {
    return this.service.createRuleset(body)
  }

  @Put('rulesets/:id')
  updateRuleset(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateRulesetSchema)) body: z.infer<typeof UpdateRulesetSchema>) {
    return this.service.updateRuleset(id, body)
  }

  @Delete('rulesets/:id')
  deleteRuleset(@Param('id') id: string) {
    return this.service.deleteRuleset(id)
  }

  @Get('history')
  listHistory(@Query('reportId') reportId?: string) {
    return this.service.listHistory(reportId)
  }

  @Get('stats')
  getStats() {
    return this.service.getStats()
  }
}

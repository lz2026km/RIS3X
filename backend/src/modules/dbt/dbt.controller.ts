/**
 * G005 RIS v3.0.6.11-62 - DBT 乳腺断层 Controller
 * 对标 Hologic/GE/Infinitt 乳腺断层阅片:
 *   GET  /dbt/studies                -> DBT 检查列表 (当前/既往)
 *   GET  /dbt/studies/:id/slices     -> 断层切片列表 (0°/+15°/-15° 角度)
 *   POST /dbt/studies/:id/reconstruct-> 断层重建模拟 (切片堆叠 → 厚度投影)
 *   POST /dbt/compare                -> 当前 vs 既往双图对比
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DbtService } from './dbt.service'

const ReconstructSchema = z.object({
  seriesInstanceUid: z.string().min(1),
  projection: z.enum(['mip', 'mean']).default('mip'),
  thickness: z.number().int().positive().optional(),
})

const CompareSchema = z.object({
  currentStudyId: z.string().min(1),
  priorStudyId: z.string().min(1),
})

// [G-21 Wave3C] DBT 微钙化检测 → BI-RADS 自动评分
const CalcificationSchema = z.object({
  count: z.number().int().min(0),
  distribution: z.enum(['clustered', 'linear', 'segmental', 'regional', 'diffuse']),
  morphology: z.enum([
    'round', 'punctate', 'popcorn', 'egg_shell', 'coarse', 'large_rod', 'vascular',
    'amorphous', 'coarse_heterogeneous', 'fine_pleomorphic', 'fine_linear',
  ]).optional(),
})

const BiradsScoreSchema = z.object({
  calcifications: z.array(CalcificationSchema).optional(),
  mass: z.object({
    size: z.number().positive(),
    shape: z.enum(['round', 'oval', 'irregular']),
    margin: z.enum(['circumscribed', 'microlobulated', 'indistinct', 'spiculated']),
  }).optional(),
})

@ApiTags('dbt')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dbt')
export class DbtController {
  constructor(private readonly service: DbtService) {}

  @Get('studies')
  @ApiOperation({ summary: 'List DBT studies (current + prior breast tomosynthesis)' })
  listStudies() {
    return this.service.listStudies()
  }

  @Get('studies/:id/slices')
  @ApiOperation({ summary: 'Get DBT tomosynthesis slices with projection angles' })
  getSlices(@Param('id') id: string, @Query('series') series?: string) {
    return this.service.getSlices(id, series)
  }

  @Post('studies/:id/reconstruct')
  @ApiOperation({ summary: 'Reconstruct DBT slices into thickness projection (MIP/Mean)' })
  reconstruct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReconstructSchema)) body: z.infer<typeof ReconstructSchema>,
  ) {
    return this.service.reconstruct(id, body.seriesInstanceUid, body.projection, body.thickness)
  }

  @Post('compare')
  @ApiOperation({ summary: 'Compare current vs prior DBT study (side-by-side metadata)' })
  compare(@Body(new ZodValidationPipe(CompareSchema)) body: z.infer<typeof CompareSchema>) {
    return this.service.compare(body)
  }

  // [G-21 Wave3C] 微钙化特征 → BI-RADS 自动评分 (按 ACR BI-RADS 规则确定性判定)
  @Post(':id/birads-score')
  @ApiOperation({ summary: 'Auto BI-RADS score from DBT calcification/mass features (ACR rules)' })
  scoreBirads(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BiradsScoreSchema)) body: z.infer<typeof BiradsScoreSchema>,
  ) {
    return this.service.scoreBirads(id, body)
  }

  // [G-21 Wave3C] 已有 BI-RADS 评分查询
  @Get(':id/birads-score')
  @ApiOperation({ summary: 'Get stored BI-RADS score for DBT study' })
  getBiradsScore(@Param('id') id: string) {
    return this.service.getBiradsScore(id)
  }
}

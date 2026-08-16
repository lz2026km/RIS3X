import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PathologyService, type CreateAnnotationDto } from './pathology.service'

const CreateAnnotationSchema = z.object({
  kind: z.enum(['rect', 'circle', 'polygon']),
  // rect=[x1,y1,x2,y2] / circle=[cx,cy,r] / polygon=[x1,y1,x2,y2,...] (≥3 个点)
  points: z.array(z.number()).min(3).max(400),
  label: z.string().min(1).max(200),
  category: z.string().max(100).default('uncategorized'),
  color: z.string().min(1).max(30).default('#ff4d4f'),
  confidence: z.number().min(0).max(1).optional(),
  level: z.number().int().min(0).max(31).default(0),
})

const UpdateAnnotationSchema = CreateAnnotationSchema.partial()

@ApiTags('pathology')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('pathology')
export class PathologyController {
  constructor(private readonly service: PathologyService) {}

  // ── 切片列表 / 病例摘要 ──
  @Get('cases')
  cases() {
    return { success: true, data: this.service.listCases() }
  }

  @Get('slides')
  slides(@Query('patientId') patientId?: string, @Query('stain') stain?: string) {
    return { success: true, data: this.service.listSlides({ patientId, stain }) }
  }

  @Get('slides/:slideId')
  slideDetail(@Param('slideId') slideId: string) {
    return { success: true, data: this.service.getSlide(slideId) }
  }

  // ── 金字塔瓦片 (PNG 二进制, 确定性生成) ──
  @Get('slides/:slideId/tile/:level/:x/:y')
  @Header('Cache-Control', 'public, max-age=86400')
  tile(
    @Param('slideId') slideId: string,
    @Param('level') level: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    const png = this.service.getTile(slideId, Number(level), Number(x), Number(y))
    res.setHeader('Content-Type', 'image/png')
    res.send(png)
  }

  // ── 标注 CRUD (坐标/标签/分类/置信度) ──
  @Get('slides/:slideId/annotations')
  async annotations(@Param('slideId') slideId: string) {
    return { success: true, data: await this.service.listAnnotations(slideId) }
  }

  @Post('slides/:slideId/annotations')
  @HttpCode(200)
  async createAnnotation(
    @Param('slideId') slideId: string,
    @Body(new ZodValidationPipe(CreateAnnotationSchema)) body: CreateAnnotationDto,
  ) {
    return { success: true, data: await this.service.createAnnotation(slideId, body) }
  }

  @Put('annotations/:id')
  @HttpCode(200)
  async updateAnnotation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAnnotationSchema)) body: Partial<CreateAnnotationDto>,
  ) {
    return { success: true, data: await this.service.updateAnnotation(id, body) }
  }

  @Delete('annotations/:id')
  @HttpCode(200)
  async deleteAnnotation(@Param('id') id: string) {
    return { success: true, data: await this.service.deleteAnnotation(id) }
  }
}

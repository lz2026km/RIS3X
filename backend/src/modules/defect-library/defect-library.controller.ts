/**
 * [G005 W9-QC] 规范化缺陷库控制器 (defect-library)
 *   - GET  /defect-library/categories           分类
 *   - POST /defect-library/categories           新建分类
 *   - GET  /defect-library/items                缺陷项 (?categoryCode=&severity=&keyword=)
 *   - GET  /defect-library/items/:id            单项
 *   - POST /defect-library/items                新建缺陷项
 *   - PATCH /defect-library/items/:id           更新缺陷项
 *   - DELETE /defect-library/items/:id          删除缺陷项
 *   - GET  /defect-library/aggregation          聚合 (分类/严重度)
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DefectLibraryService } from './defect-library.service'
import type { DefectSeverity } from './defect-library.types'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

const CreateCategorySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  description: z.string().optional(),
})

const CreateItemSchema = z.object({
  code: z.string().min(1),
  categoryCode: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  severity: SeveritySchema,
  description: z.string().min(1),
  standard: z.string().optional(),
  checkMethod: z.string().optional(),
})

const UpdateItemSchema = z.object({
  categoryCode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  nameEn: z.string().optional(),
  severity: SeveritySchema.optional(),
  description: z.string().optional(),
  standard: z.string().optional(),
  checkMethod: z.string().optional(),
})

@ApiTags('defect-library')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('defect-library')
export class DefectLibraryController {
  constructor(private readonly service: DefectLibraryService) {}

  @Get('categories')
  listCategories() {
    return { success: true, data: this.service.listCategories() }
  }

  @Post('categories')
  @HttpCode(201)
  createCategory(@Body(new ZodValidationPipe(CreateCategorySchema)) body: z.infer<typeof CreateCategorySchema>) {
    return { success: true, data: this.service.createCategory(body) }
  }

  @Get('items')
  listItems(
    @Query('categoryCode') categoryCode?: string,
    @Query('severity') severity?: string,
    @Query('keyword') keyword?: string,
  ) {
    const sev = SeveritySchema.safeParse(severity).success ? (severity as DefectSeverity) : undefined
    return { success: true, data: this.service.listItems({ categoryCode, severity: sev, keyword }) }
  }

  @Get('aggregation')
  aggregation() {
    return { success: true, data: this.service.aggregation() }
  }

  @Post('items')
  @HttpCode(201)
  createItem(@Body(new ZodValidationPipe(CreateItemSchema)) body: z.infer<typeof CreateItemSchema>) {
    return { success: true, data: this.service.createItem(body) }
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateItemSchema)) body: z.infer<typeof UpdateItemSchema>) {
    return { success: true, data: this.service.updateItem(id, body) }
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return { success: true, data: this.service.deleteItem(id) }
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return { success: true, data: this.service.getItem(id) }
  }
}

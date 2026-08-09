import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TypicalCasesService } from './typical-cases.service'

// [G005 Wave1B P1] /typical-cases — 内存 + seed (typicalCasesSeed 对齐)
const CreateCaseSchema = z.object({
  patientName: z.string().min(1),
  age: z.number().int().nonnegative().optional(),
  gender: z.string().optional(),
  examType: z.string().optional(),
  examName: z.string().optional(),
  bodyPart: z.string().optional(),
  disease: z.string().optional(),
  diagnosis: z.string().optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  tags: z.array(z.string()).optional(),
  teaching: z.boolean().optional(),
})

@ApiTags('typical-cases')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('typical-cases')
export class TypicalCasesController {
  constructor(private readonly service: TypicalCasesService) {}

  @Get()
  @ApiOperation({ summary: '典型病例列表 (Report 派生 + seed)' })
  list() {
    return this.service.list()
  }

  @Get('stats')
  @ApiOperation({ summary: '典型病例统计' })
  stats() {
    return this.service.stats()
  }

  @Get('categories')
  @ApiOperation({ summary: '典型病例分类' })
  categories() {
    return this.service.categories()
  }

  @Get(':id')
  @ApiOperation({ summary: '典型病例详情' })
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @ApiOperation({ summary: '创建典型病例' })
  create(@Body(new ZodValidationPipe(CreateCaseSchema)) body: z.infer<typeof CreateCaseSchema>) {
    return this.service.create(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新典型病例' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(CreateCaseSchema.partial())) body: z.infer<typeof CreateCaseSchema>) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除典型病例' })
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }
}

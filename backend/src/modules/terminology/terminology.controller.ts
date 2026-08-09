import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TerminologyService } from './terminology.service'

// [G005 Wave1B P1] /terminology — 从 DictEntry 字典派生 + seed
const MappingSchema = z.object({
  source: z.string().min(1),
  sourceSystem: z.string().optional(),
  target: z.string().min(1),
  targetSystem: z.string().optional(),
  mapType: z.enum(['equivalent', 'broader', 'narrower', 'related']).optional(),
  status: z.enum(['active', 'draft', 'retired']).optional(),
})

@ApiTags('terminology')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('terminology')
export class TerminologyController {
  constructor(private readonly service: TerminologyService) {}

  @Get('mappings')
  @ApiOperation({ summary: '术语映射列表 (DictEntry 派生)' })
  listMappings() {
    return this.service.listMappings()
  }

  @Post('mappings')
  @ApiOperation({ summary: '创建术语映射' })
  createMapping(@Body(new ZodValidationPipe(MappingSchema)) body: z.infer<typeof MappingSchema>) {
    return this.service.createMapping(body)
  }

  @Delete('mappings/:id')
  @ApiOperation({ summary: '删除术语映射' })
  deleteMapping(@Param('id') id: string) {
    return this.service.deleteMapping(id)
  }

  @Get('systems')
  @ApiOperation({ summary: '术语系统状态' })
  listSystems() {
    return this.service.listSystems()
  }

  @Get('stats')
  @ApiOperation({ summary: '术语统计' })
  getStats() {
    return this.service.getStats()
  }
}

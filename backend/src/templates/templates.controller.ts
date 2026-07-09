import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { TemplatesService, CreateTemplateDto } from './templates.service'

const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  bodyPart: z.string().min(1),
  body: z.string().min(1),
  parentId: z.string().optional(),
  radsCategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdById: z.string().min(1),
})

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  bodyPart: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
})

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  list(@Query('category') category?: string, @Query('bodyPart') bodyPart?: string, @Query('keyword') keyword?: string) {
    return this.service.list({ category, bodyPart, keyword })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateSchema)) body: CreateTemplateDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  @Post(':id/clone')
  clone(@Param('id') id: string) {
    return this.service.clone(id)
  }
}

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { HangingService, type MatchHangingInput } from './hanging.service'

const LayoutSchema = z.object({
  rows: z.number().int().min(1).max(4),
  cols: z.number().int().min(1).max(4),
  seriesOrder: z.array(z.string()).default([]),
})

const CreateProtocolSchema = z.object({
  name: z.string().min(1).max(100),
  modality: z.string().min(1).max(10),
  bodyPart: z.string().min(1).max(50),
  layout: LayoutSchema,
  priority: z.number().int().min(0).max(999).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
})

const UpdateProtocolSchema = CreateProtocolSchema.partial()

const MatchSchema = z.object({
  modality: z.string().min(1).max(10),
  bodyPart: z.string().max(50).optional(),
  seriesCount: z.number().int().min(0).max(100).optional(),
  series: z
    .array(
      z.object({
        description: z.string().optional(),
        modality: z.string().optional(),
        seriesNumber: z.number().int().optional(),
        images: z.number().int().optional(),
      }),
    )
    .optional(),
})

class HangingLayoutDto {
  rows?: number
  cols?: number
  seriesOrder?: string[]
}

class CreateHangingProtocolDto {
  name?: string
  modality?: string
  bodyPart?: string
  layout?: HangingLayoutDto
  priority?: number
  description?: string
  enabled?: boolean
}

class MatchHangingDto {
  modality?: string
  bodyPart?: string
  seriesCount?: number
  series?: { description?: string; modality?: string; seriesNumber?: number; images?: number }[]
}

@ApiTags('hanging')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('hanging')
export class HangingController {
  constructor(private readonly service: HangingService) {}

  @Get('protocols')
  list(@Query('modality') modality?: string, @Query('bodyPart') bodyPart?: string) {
    return this.service.list(modality, bodyPart)
  }

  @Post('protocols')
  create(@Body(new ZodValidationPipe(CreateProtocolSchema)) dto: CreateHangingProtocolDto) {
    return this.service.create(dto as never as import('./hanging.service').CreateHangingProtocolDto)
  }

  @Put('protocols/:id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProtocolSchema)) dto: Partial<CreateHangingProtocolDto>,
  ) {
    return this.service.update(id, dto as never as Partial<import('./hanging.service').CreateHangingProtocolDto>)
  }

  @Delete('protocols/:id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id)
    return { success: true }
  }

  @Post('match')
  match(@Body(new ZodValidationPipe(MatchSchema)) dto: MatchHangingDto) {
    return this.service.match(dto as MatchHangingInput)
  }

  @Get('protocols/:id')
  async detail(@Param('id') id: string) {
    const item = await this.service.getById(id)
    if (!item) throw new NotFoundException(`Hanging protocol ${id} not found`)
    return item
  }
}

/**
 * G005 RIS v3.0.6.11-79 (W3-B) - Clinical Config Controller
 * GET/PUT /system/clinical-config (ADMIN), PUT /system/clinical-config/:module (ADMIN)
 */
import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { ClinicalConfigService } from './clinical-config.service'

const ClinicalConfigSaveSchema = z.object({
  modules: z
    .record(z.string(), z.unknown())
    .refine((v) => Object.keys(v).length > 0, { message: 'modules 不能为空' }),
})

const ClinicalConfigModuleSaveSchema = z.object({
  module: z.record(z.string(), z.unknown()),
})

@ApiTags('system')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('system')
export class ClinicalConfigController {
  constructor(private readonly service: ClinicalConfigService) {}

  @Get('clinical-config')
  get() {
    return this.service.getConfig()
  }

  @Put('clinical-config')
  save(
    @Body(new ZodValidationPipe(ClinicalConfigSaveSchema))
    body: z.infer<typeof ClinicalConfigSaveSchema>,
  ) {
    return this.service.saveConfig(body.modules)
  }

  @Put('clinical-config/:module')
  saveModule(
    @Param('module') module: string,
    @Body(new ZodValidationPipe(ClinicalConfigModuleSaveSchema))
    body: z.infer<typeof ClinicalConfigModuleSaveSchema>,
  ) {
    return this.service.saveModule(module, body.module)
  }
}

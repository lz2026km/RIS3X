import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { DicomDimseService } from './dicom-dimse.service'
import { z } from 'zod'
import { CEchoSchema, CFindMwlSchema, CMoveSchema, CStoreSchema, UploadS3Schema } from './dto'

@ApiTags('dicom-dimse')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@UseGuards(AuthGuard('jwt'))
@Controller('dicom-dimse')
export class DicomDimseController {
  constructor(private readonly service: DicomDimseService) {}

  @Post('echo')
  async cEcho(@Body(new ZodValidationPipe(CEchoSchema)) body: z.infer<typeof CEchoSchema>) {
    return this.service.cEcho(body)
  }

  @Post('store')
  async cStore(@Body(new ZodValidationPipe(CStoreSchema)) body: z.infer<typeof CStoreSchema>) {
    return this.service.cStore(body)
  }

  @Post('find')
  async cFind(@Body(new ZodValidationPipe(CFindMwlSchema)) body: z.infer<typeof CFindMwlSchema>) {
    return this.service.cFindMwl(body)
  }

  @Post('move')
  async cMove(@Body(new ZodValidationPipe(CMoveSchema)) body: z.infer<typeof CMoveSchema>) {
    return this.service.cMove(body)
  }

  @Post('upload')
  async upload(@Body(new ZodValidationPipe(UploadS3Schema)) body: z.infer<typeof UploadS3Schema>) {
    return this.service.uploadToS3(body)
  }
}

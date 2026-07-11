import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { DicomDimseService } from './dicom-dimse.service'
import { CEchoSchema, CFindMwlSchema, CMoveSchema, CStoreSchema, UploadS3Schema } from './dto'

@ApiTags('dicom-dimse')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@UseGuards(AuthGuard('jwt'))
@Controller('dicom-dimse')
export class DicomDimseController {
  constructor(private readonly service: DicomDimseService) {}

  @Post('echo')
  async cEcho() {
    return this.service.cEcho()
  }

  @Post('store')
  async cStore(@Body(new ZodValidationPipe(CStoreSchema)) body: any) {
    return this.service.cStore(body)
  }

  @Post('find')
  async cFind(@Body(new ZodValidationPipe(CFindMwlSchema)) body: any) {
    return this.service.cFindMwl(body)
  }

  @Post('move')
  async cMove(@Body(new ZodValidationPipe(CMoveSchema)) body: any) {
    return this.service.cMove(body)
  }

  @Post('upload')
  async upload(@Body(new ZodValidationPipe(UploadS3Schema)) body: any) {
    return this.service.uploadToS3(body)
  }
}

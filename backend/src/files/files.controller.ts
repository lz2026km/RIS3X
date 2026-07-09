/**
 * G005 鏀惧皠RIS绯荤粺 v3.0.2 - 鏂囦欢鎺у埗鍣?
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { FilesService } from './files.service'

const UploadCompleteSchema = z.object({
  token: z.string().min(1),
  metadata: z.object({
    size: z.number().int().nonnegative(),
    checksum: z.string().min(1),
    filename: z.string().min(1),
  }),
})

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Get('upload-url')
  getUploadUrl(@Query('filename') filename: string, @Query('contentType') contentType = 'application/octet-stream') {
    return this.service.getUploadUrl(filename, contentType)
  }

  @Post('upload-complete')
  confirm(@Body(new ZodValidationPipe(UploadCompleteSchema)) body: any) {
    return this.service.confirmUpload(body.token, body.metadata)
  }
}

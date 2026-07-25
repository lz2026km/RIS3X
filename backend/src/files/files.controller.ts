/**
 * G005 RIS v3.0.6.11-32 - Files Controller
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
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
@Roles('ADMIN', 'DIRECTOR')
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Get('upload-url')
  getUploadUrl(@Query('filename') filename: string, @Query('contentType') contentType = 'application/octet-stream') {
    return this.service.getUploadUrl(filename, contentType)
  }

  @Post('upload-complete')
  confirm(@Body(new ZodValidationPipe(UploadCompleteSchema)) body: z.infer<typeof UploadCompleteSchema>) {
    return this.service.confirmUpload(body.token, body.metadata)
  }
}

/**
 * G005 RIS v3.0.6.11-60 - Files Controller
 * v3.0.6.11-60: 新增 POST /files/upload (raw body) + GET /files/download/:id/:name
 */
import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
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

  @Post('upload')
  async upload(
    @Query('token') token: string,
    @Query('name') name: string,
    @Query('ct') ct = 'application/octet-stream',
    @Req() req: Request,
  ) {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? [])
    return this.service.upload(token, name ?? 'file.bin', ct, raw)
  }

  @Get('download/:id/:name')
  async download(@Param('id') id: string, @Param('name') name: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.service.download(id, name)
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
    return file.buffer
  }
}

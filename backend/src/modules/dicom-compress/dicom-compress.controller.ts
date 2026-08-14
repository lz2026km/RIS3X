import { Controller, Get, Post, Delete, Param, Body, Query, Logger } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { DicomCompressService } from './dicom-compress.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const CompressSchema = z.object({
  fileId: z.string().min(1),
  transferSyntax: z.string().min(1),
  quality: z.number().int().min(1).max(100).optional(),
  dataBase64: z.string().optional(),
})
const BatchSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1).max(50),
  transferSyntax: z.string().min(1),
  quality: z.number().int().min(1).max(100).optional(),
})
const DecompressSchema = z.object({ fileId: z.string().min(1) })
const RealJpeg2000Schema = z.object({
  fileId: z.string().min(1),
  quality: z.number().int().min(1).max(100).optional(),
  dataBase64: z.string().optional(),
})

@ApiTags('dicom-compress')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dicom/compress')
export class DicomCompressController {
  private readonly logger = new Logger(DicomCompressController.name)
  constructor(private readonly service: DicomCompressService) {}

  @Get('instances')
  @ApiOperation({ summary: 'List available DICOM sample instances' })
  listInstances() {
    return this.service.listInstances()
  }

  @Post()
  @ApiOperation({ summary: 'Compress DICOM file with real codec (RLE / predictive), transfer syntax based' })
  compress(@Body(new ZodValidationPipe(CompressSchema)) body: { fileId: string; transferSyntax: string; quality?: number; dataBase64?: string }) {
    return this.service.compress(body.fileId, body.transferSyntax, { quality: body.quality, dataBase64: body.dataBase64 })
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch compress multiple DICOM files' })
  batchCompress(@Body(new ZodValidationPipe(BatchSchema)) body: { fileIds: string[]; transferSyntax: string; quality?: number }) {
    return this.service.batchCompress(body.fileIds, body.transferSyntax, { quality: body.quality })
  }

  @Get('status/:id')
  @ApiOperation({ summary: 'Get compression task status' })
  getStatus(@Param('id') id: string) {
    return this.service.getStatus(id)
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List compression tasks' })
  listTasks(@Query() query: { status?: string; algorithm?: string; page?: string; pageSize?: string }) {
    return this.service.listTasks({
      status: query.status,
      algorithm: query.algorithm,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    })
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get single compression task detail' })
  getTask(@Param('id') id: string) {
    return this.service.getStatus(id)
  }

  @Post('decompress')
  @ApiOperation({ summary: 'Decompress DICOM file back to original pixel data' })
  decompress(@Body(new ZodValidationPipe(DecompressSchema)) body: { fileId: string }) {
    return this.service.decompress(body.fileId)
  }

  @Get('ratio/:instanceId')
  @ApiOperation({ summary: 'Get real compression ratio by instance (JPEG2000 lossless, OpenJPEG WASM)' })
  getRatio(@Param('instanceId') instanceId: string) {
    return this.service.getRatio(instanceId)
  }

  @Post('real-jpeg2000')
  @ApiOperation({ summary: 'Real JPEG2000 encode via OpenJPEG WASM (lossless, DICOM J2K codestream)' })
  realJpeg2000(@Body(new ZodValidationPipe(RealJpeg2000Schema)) body: { fileId: string; quality?: number; dataBase64?: string }) {
    return this.service.realJpeg2000(body.fileId, { quality: body.quality, dataBase64: body.dataBase64 })
  }

  @Get('ratios')
  @ApiOperation({ summary: 'Compression ratio statistics grouped by algorithm and modality' })
  getRatios() {
    return this.service.getRatios()
  }

  @Get('stats')
  @ApiOperation({ summary: 'Compression statistics overview' })
  getStats() {
    return this.service.getStats()
  }

  @Get('syntaxes')
  @ApiOperation({ summary: 'List supported transfer syntaxes' })
  getSupportedSyntaxes() {
    return this.service.getSupportedSyntaxes()
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: 'Cancel a compression task' })
  cancelTask(@Param('id') id: string) {
    return this.service.cancelTask(id)
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Delete a compression task' })
  deleteTask(@Param('id') id: string) {
    return this.service.deleteTask(id)
  }
}

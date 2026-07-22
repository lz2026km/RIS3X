import { Controller, Get, Post, Delete, Param, Query, Body, Req, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger'
import { TeachService } from './teach.service'

@ApiTags('teach')
@Controller('teach')
@ApiBearerAuth()
@Roles('DOCTOR', 'TECHNICIAN', 'ADMIN', 'DIRECTOR')
export class TeachController {
  constructor(private readonly teach: TeachService) {}

  @Post('lecture')
  @ApiOperation({ summary: '创建示教录制' })
  create(@Body() body: { title: string; patientId?: string; examId?: string; reportId?: string }, @Req() req: { user: { sub: string } }) {
    return this.teach.create({ ...body, userId: req.user.sub })
  }

  @Post('lecture/:id/blob')
  @ApiOperation({ summary: '上传录制 blob（分片）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('blob', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadBlob(@Param('id') id: string, @UploadedFile() file: any, @Query('sequence') sequence?: string) {
    if (!file) throw new BadRequestException('文件不能为空')
    const allowedMimes = ['video/webm', 'video/mp4', 'application/octet-stream']
    if (file.mimetype && !allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('不支持的文件类型')
    }
    const seq = sequence ? parseInt(sequence) : 0
    return this.teach.uploadBlob(id, file.buffer, seq)
  }

  @Get('lecture/:id')
  @ApiOperation({ summary: '获取录制详情' })
  findOne(@Param('id') id: string) {
    return this.teach.findById(id)
  }

  @Get('lectures')
  @ApiOperation({ summary: '录制备列表' })
  findAll(@Query() query: { page?: string; pageSize?: string; search?: string }) {
    return this.teach.findAll({
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      search: query.search,
    })
  }

  @Delete('lecture/:id')
  @ApiOperation({ summary: '删除录制' })
  delete(@Param('id') id: string) {
    return this.teach.delete(id)
  }
}

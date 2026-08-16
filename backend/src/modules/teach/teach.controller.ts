import { Controller, Get, Post, Delete, Patch, Param, Query, Body, Req, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger'
import { TeachService } from './teach.service'
import { TeachingCaseService, type CaseDifficulty } from './teaching-case.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const CreateLectureSchema = z.object({ title: z.string().min(1).max(200), patientId: z.string().min(1).optional(), examId: z.string().min(1).optional(), reportId: z.string().min(1).optional() })

// [G005 v3.0.6.11-103 Wave 18] 教学病例库 Schemas
const CreateTeachingCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  patientId: z.string().optional(),
  examId: z.string().optional(),
  reportId: z.string().optional(),
  disease: z.string().max(64).optional(),
  bodyPart: z.string().max(32).optional(),
  difficulty: z.enum(['入门', '进阶', '高级']).optional(),
  keyPoints: z.array(z.string().max(200)).max(20).optional(),
  tags: z.array(z.string().max(32)).max(20).optional(),
  diagnosis: z.string().max(1000).optional(),
  findings: z.string().max(4000).optional(),
})

const UpdateTeachingCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  disease: z.string().max(64).optional(),
  bodyPart: z.string().max(32).optional(),
  difficulty: z.enum(['入门', '进阶', '高级']).optional(),
  keyPoints: z.array(z.string().max(200)).max(20).optional(),
  tags: z.array(z.string().max(32)).max(20).optional(),
  diagnosis: z.string().max(1000).optional(),
  findings: z.string().max(4000).optional(),
  favoriteCount: z.number().int().nonnegative().optional(),
  shared: z.boolean().optional(),
})

const CommentSchema = z.object({ content: z.string().min(1).max(1000) })

const GenerateExamSchema = z.object({
  count: z.number().int().min(2).max(20).optional(),
  difficulty: z.enum(['入门', '进阶', '高级', '全部']).optional(),
  category: z.string().max(64).optional(),
})

const SubmitExamSchema = z.object({
  examId: z.string().min(1),
  answers: z.array(z.object({ caseId: z.string().min(1), selectedIndex: z.number().int().min(-1).max(9) })).min(1),
})

@ApiTags('teach')
@Controller('teach')
@ApiBearerAuth()
@Roles('DOCTOR', 'TECHNICIAN', 'ADMIN', 'DIRECTOR')
export class TeachController {
  constructor(
    private readonly teach: TeachService,
    private readonly teachingCase: TeachingCaseService,
  ) {}

  @Post('lecture')
  @ApiOperation({ summary: '创建示教录制' })
  create(@Body(new ZodValidationPipe(CreateLectureSchema)) body: { title: string; patientId?: string; examId?: string; reportId?: string }, @Req() req: { user: { sub: string } }) {
    return this.teach.create({ ...body, userId: req.user.sub })
  }

  @Post('lecture/:id/blob')
  @ApiOperation({ summary: '上传录制 blob（分片）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('blob', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadBlob(@Param('id') id: string, @UploadedFile() file: { buffer: Buffer; mimetype?: string }, @Query('sequence') sequence?: string) {
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

  // ════════════ [G005 v3.0.6.11-103 Wave 18] 教学病例库 ════════════

  @Post('case')
  @ApiOperation({ summary: '收藏教学病例 (从检查/报告一键收藏)' })
  createTeachingCase(@Body(new ZodValidationPipe(CreateTeachingCaseSchema)) body: z.infer<typeof CreateTeachingCaseSchema>, @Req() req: { user: { sub: string } }) {
    return this.teachingCase.create(body, req.user.sub)
  }

  @Get('cases')
  @ApiOperation({ summary: '教学病例列表 (病种/部位/难度/标签/搜索筛选)' })
  listTeachingCases(@Query() query: { page?: string; pageSize?: string; search?: string; disease?: string; bodyPart?: string; difficulty?: string; tag?: string; sharedOnly?: string }) {
    return this.teachingCase.list({
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      search: query.search,
      disease: query.disease,
      bodyPart: query.bodyPart,
      difficulty: query.difficulty,
      tag: query.tag,
      sharedOnly: query.sharedOnly === 'true',
    })
  }

  @Get('categories')
  @ApiOperation({ summary: '教学病例分类树 (病种/部位/难度/标签)' })
  teachingCategories() {
    return this.teachingCase.categories()
  }

  @Get('stats')
  @ApiOperation({ summary: '教学病例库统计' })
  teachingStats() {
    return this.teachingCase.stats()
  }

  @Get('case/:id')
  @ApiOperation({ summary: '教学病例详情' })
  getTeachingCase(@Param('id') id: string) {
    return this.teachingCase.findById(id)
  }

  @Patch('case/:id')
  @ApiOperation({ summary: '更新教学病例' })
  updateTeachingCase(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateTeachingCaseSchema)) body: z.infer<typeof UpdateTeachingCaseSchema>) {
    return this.teachingCase.update(id, body)
  }

  @Delete('case/:id')
  @ApiOperation({ summary: '删除教学病例' })
  deleteTeachingCase(@Param('id') id: string) {
    return this.teachingCase.remove(id)
  }

  @Post('case/:id/share')
  @ApiOperation({ summary: '分享教学病例 (链接 + QR 数据)' })
  shareTeachingCase(@Param('id') id: string) {
    return this.teachingCase.share(id)
  }

  @Get('share/:token')
  @ApiOperation({ summary: '通过分享 token 查看病例' })
  sharedCase(@Param('token') token: string) {
    return this.teachingCase.getSharedCase(token)
  }

  @Get('case/:id/comments')
  @ApiOperation({ summary: '教学病例评论列表' })
  listComments(@Param('id') id: string) {
    return this.teachingCase.listComments(id)
  }

  @Post('case/:id/comments')
  @ApiOperation({ summary: '发表教学病例评论' })
  addComment(@Param('id') id: string, @Body(new ZodValidationPipe(CommentSchema)) body: z.infer<typeof CommentSchema>, @Req() req: { user: { sub: string } }) {
    return this.teachingCase.addComment(id, body.content, req.user.sub)
  }

  @Post('exam/generate')
  @ApiOperation({ summary: '考试模式: 随机抽题 (病例→诊断选项)' })
  generateExam(@Body(new ZodValidationPipe(GenerateExamSchema)) body: z.infer<typeof GenerateExamSchema>) {
    return this.teachingCase.generateExam(body)
  }

  @Post('exam/submit')
  @ApiOperation({ summary: '考试模式: 提交答卷并评分' })
  submitExam(@Body(new ZodValidationPipe(SubmitExamSchema)) body: z.infer<typeof SubmitExamSchema>) {
    return this.teachingCase.submitExam(body.examId ?? '', body.answers)
  }

  @Get('wrong-book')
  @ApiOperation({ summary: '错题本列表' })
  wrongBook() {
    return this.teachingCase.wrongBook()
  }

  @Delete('wrong-book')
  @ApiOperation({ summary: '清空错题本' })
  clearWrongBook() {
    return this.teachingCase.clearWrongBook()
  }
}

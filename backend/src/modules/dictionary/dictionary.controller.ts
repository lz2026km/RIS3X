// [W4-A v3.0.6.11-79] 数据字典控制器 (分类列表 + 分类条目 CRUD)
// 路由: GET /dictionary | GET/POST /dictionary/:category | PUT/DELETE /dictionary/:category/:key
import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DictionaryService, type CreateDictEntryDto, type UpdateDictEntryDto } from './dictionary.service'

const CreateDictEntrySchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(128),
  sort: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

const UpdateDictEntrySchema = z.object({
  key: z.string().min(1).max(64).optional(),
  value: z.string().min(1).max(128).optional(),
  sort: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

@ApiTags('dictionary')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly service: DictionaryService) {}

  /** 分类列表 */
  @Get()
  async listCategories() {
    const categories = await this.service.listCategories()
    return { categories, total: categories.length }
  }

  /** 分类列表别名 (前端新版 dictionaryApi 使用, 避免与旧 GET /dictionary 协议冲突) */
  @Get('categories')
  async listCategoriesAlias() {
    return this.listCategories()
  }

  /** 分类条目列表 */
  @Get(':category')
  listEntries(@Param('category') category: string) {
    return this.service.listEntries(category)
  }

  /** 新增条目 */
  @Post(':category')
  create(
    @Param('category') category: string,
    @Body(new ZodValidationPipe(CreateDictEntrySchema)) body: CreateDictEntryDto,
  ) {
    return this.service.create(category, body)
  }

  /** 更新条目 */
  @Put(':category/:key')
  update(
    @Param('category') category: string,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateDictEntrySchema)) body: UpdateDictEntryDto,
  ) {
    return this.service.update(category, key, body)
  }

  /** 删除条目 */
  @Delete(':category/:key')
  remove(@Param('category') category: string, @Param('key') key: string) {
    return this.service.remove(category, key)
  }
}

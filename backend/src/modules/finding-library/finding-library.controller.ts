import { Controller, Get, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FindingLibraryService } from './finding-library.service'

@ApiTags('finding-library')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN')
@Controller('finding-library')
export class FindingLibraryController {
  constructor(private readonly service: FindingLibraryService) {}

  // [v3.0.6.11-98 Wave2B P1] 征象库分组列表: [{ category, items: { id, name, description, keywords } }]
  @Get()
  list() {
    return this.service.list()
  }

  // [v3.0.6.11-98 Wave2B P1] 征象库关键词检索 (name/description/keywords 命中)
  @Get('search')
  search(@Query('q') q?: string) {
    return this.service.search(q)
  }
}

import { Controller, Get, Post, Query, Req } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuditService } from './audit.service'

@ApiTags('audit')
@Controller('audit')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: '瀹¤鏃ュ織鍒楄〃' })
  list(@Query() query: { page?: string; pageSize?: string; userId?: string; action?: string; resource?: string; startDate?: string; endDate?: string }) {
    return this.audit.list({
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      userId: query.userId,
      action: query.action,
      resource: query.resource,
      startDate: query.startDate,
      endDate: query.endDate,
    })
  }

  @Get('stats')
  @ApiOperation({ summary: '瀹¤鏃ュ織缁熻' })
  stats() {
    return this.audit.stats()
  }
}

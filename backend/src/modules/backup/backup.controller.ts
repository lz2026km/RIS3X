import { Controller, Get, Post, Query, Req } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { BackupService } from './backup.service'

@ApiTags('backup')
@Controller('backup')
@ApiBearerAuth()
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Post()
  @ApiOperation({ summary: '鍒涘缓澶囦唤' })
  create(@Query('type') type: string, @Req() req: { user: { sub: string } }) {
    return this.backup.createBackup(type || 'FULL', req.user.sub)
  }

  @Get()
  @ApiOperation({ summary: '澶囦唤鍒楄〃' })
  list(@Query() query: { page?: string; pageSize?: string; type?: string }) {
    return this.backup.listBackups({
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      type: query.type,
    })
  }
}

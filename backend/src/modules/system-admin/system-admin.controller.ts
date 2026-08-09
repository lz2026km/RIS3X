import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { SystemAdminService } from './system-admin.service'

// [G005 Wave1B P1] /system/admin/users + /system/admin/roles — User 表派生 (只读)
// 注意: 与 system-storage.controller (GET/PUT/PATCH /system/admin/configs) 路径互补, 不冲突
@ApiTags('system-admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('system/admin')
export class SystemAdminController {
  constructor(private readonly service: SystemAdminService) {}

  @Get('users')
  @ApiOperation({ summary: '系统用户列表 (User 表派生, 只读)' })
  listUsers() {
    return this.service.listUsers()
  }

  @Get('roles')
  @ApiOperation({ summary: '系统角色列表 (只读)' })
  listRoles() {
    return this.service.listRoles()
  }
}

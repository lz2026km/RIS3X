import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { TenantService, type TenantFeatures } from './tenant.service'

@ApiTags('tenant')
@Controller('tenant')
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('current')
  @ApiOperation({ summary: '当前租户信息' })
  current() {
    return this.tenant.getCurrent()
  }

  @Get('usage')
  @ApiOperation({ summary: '当前租户用量' })
  usage() {
    return this.tenant.getUsage()
  }

  @Put('profile')
  @ApiOperation({ summary: '更新当前租户信息' })
  updateProfile(@Body() body: { name?: string; license?: string; maxUsers?: number; maxStorageGb?: number; config?: Record<string, unknown> }) {
    return this.tenant.updateProfile(body)
  }

  @Get('features')
  @ApiOperation({ summary: '当前租户功能开关' })
  features() {
    return this.tenant.getFeatures()
  }

  @Put('features')
  @ApiOperation({ summary: '更新当前租户功能开关' })
  updateFeatures(@Body() body: Partial<TenantFeatures>) {
    return this.tenant.updateFeatures(body)
  }

  // ─────────── 平台管理（多租户） ───────────

  @Get('list')
  @Roles('ADMIN')
  @ApiOperation({ summary: '全部租户列表（平台管理）' })
  list() {
    return this.tenant.listAll()
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: '创建租户' })
  create(@Body() body: { code: string; name: string; license?: string; maxUsers?: number; maxStorageGb?: number; features?: Partial<TenantFeatures> }) {
    return this.tenant.create(body)
  }

  @Put(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: '启用/停用租户' })
  setStatus(@Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'DISABLED' }) {
    return this.tenant.setStatus(id, body.status)
  }
}

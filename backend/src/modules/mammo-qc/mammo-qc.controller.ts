import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { MammoQcService } from './mammo-qc.service'

// [G005 Wave1B P1] /mammo-qc — 从 Exam(MG/TOM)+质控派生 + seed 回退
@ApiTags('mammo-qc')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('mammo-qc')
export class MammoQcController {
  constructor(private readonly service: MammoQcService) {}

  @Get('overview')
  @ApiOperation({ summary: '乳腺质控总览 (MG/TOM 检查派生)' })
  getOverview() {
    return this.service.getOverview()
  }

  @Get('records')
  @ApiOperation({ summary: '乳腺质控记录列表' })
  listRecords(@Query('search') search?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listRecords({
      search,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get('tests')
  @ApiOperation({ summary: '质控测试项' })
  listTests() {
    return this.service.listTests()
  }

  @Get('standards')
  @ApiOperation({ summary: '质控标准 (ACR/MQSA)' })
  listStandards() {
    return this.service.listStandards()
  }

  @Get('stats')
  @ApiOperation({ summary: '质控统计' })
  getStats() {
    return this.service.getStats()
  }
}

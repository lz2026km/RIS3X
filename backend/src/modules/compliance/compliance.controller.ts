import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ComplianceService } from './compliance.service'

@ApiTags('compliance')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  /** 兼容旧端点: 返回等保评估 + 旧版报表字段 */
  @Get('report')
  @ApiOperation({ summary: '合规报表 (兼容)' })
  getReport() {
    return this.service.getReport()
  }

  /** 等保 2.0 实时评估 */
  @Get('assessment')
  @ApiOperation({ summary: '等保 2.0 实时评估 (得分/域/差距/整改)' })
  getAssessment() {
    return this.service.getAssessment()
  }

  /** 控制项清单 */
  @Get('controls')
  @ApiOperation({ summary: '等保 2.0 控制项目录 + 自动评估结果' })
  getControls() {
    return this.service.getControls()
  }

  /** 强制重新评估 */
  @Post('reassess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新评估 (采集最新安全信号)' })
  reassess() {
    return this.service.reassess()
  }
}

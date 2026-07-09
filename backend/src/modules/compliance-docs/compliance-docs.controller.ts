import { Controller, Get } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ComplianceDocsService } from './compliance-docs.service'

@ApiTags('compliance-docs')
@Controller('compliance-docs')
@ApiBearerAuth()
export class ComplianceDocsController {
  constructor(private readonly svc: ComplianceDocsService) {}

  @Get()
  @ApiOperation({ summary: '鐢熸垚鍚堣鏂囨。鎶ュ憡' })
  report() {
    return this.svc.generateReport()
  }
}

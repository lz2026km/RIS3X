import { Controller, Get, HttpCode, HttpStatus, Post, Query, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SmartAuthService } from './smart-auth.service'

@ApiTags('fhir-smart')
@Controller('fhir/r4')
export class SmartAuthController {
  constructor(private readonly smartAuth: SmartAuthService) {}

  @Get('.well-known/smart-configuration')
  wellKnownSmart() {
    return this.smartAuth.smartConfiguration()
  }

  @Get('auth/authorize')
  authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('patient') patientId?: string,
    @Query('encounter') encounterId?: string,
    @Query('user_id') userId = 'anonymous',
  ) {
    return this.smartAuth.authorize(clientId, redirectUri, scope, state, userId, patientId, encounterId)
  }

  @Post('auth/token')
  @HttpCode(HttpStatus.CREATED)
  token(@Body('code') code: string, @Body('client_id') clientId: string) {
    return this.smartAuth.token(code, clientId)
  }
}

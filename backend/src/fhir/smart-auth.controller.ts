import { Body, Controller, Get, Post, Query } from '@nestjs/common'
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

  @Post('auth/authorize')
  authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('patient') patientId?: string,
    @Query('encounter') encounterId?: string,
    @Body('user_id') userId?: string,
  ) {
    return this.smartAuth.authorize(clientId, redirectUri, scope, state, userId ?? 'anonymous', patientId, encounterId)
  }

  @Post('auth/token')
  token(@Body('code') code: string, @Body('client_id') clientId: string) {
    return this.smartAuth.token(code, clientId)
  }
}

import { Controller, Get, HttpCode, HttpStatus, Post, Query, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SmartAuthService } from './smart-auth.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'

const TokenSchema = z.object({ code: z.string().min(1), client_id: z.string().min(1) })

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
  token(@Body(new ZodValidationPipe(TokenSchema)) body: { code: string; client_id: string }) {
    return this.smartAuth.token(body.code, body.client_id)
  }
}

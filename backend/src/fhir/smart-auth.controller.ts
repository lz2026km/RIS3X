import { Controller, Get, HttpCode, HttpStatus, Post, Query, Body } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../common/decorators/roles.decorator'
import { SmartAuthService } from './smart-auth.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'

const TokenSchema = z.object({ code: z.string().min(1), client_id: z.string().min(1) })
const RevokeSchema = z.object({ token: z.string().min(1) })
const IntrospectSchema = z.object({ token: z.string().min(1) })

@ApiTags('fhir-smart')
@ApiBearerAuth()
@Controller('fhir/r4')
export class SmartAuthController {
  constructor(private readonly smartAuth: SmartAuthService) {}

  @Get('.well-known/smart-configuration')
  wellKnownSmart() {
    return this.smartAuth.smartConfiguration()
  }

  @Get('auth/authorize')
  @Roles('DOCTOR', 'DIRECTOR', 'ADMIN')
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

  @Post('auth/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Body(new ZodValidationPipe(RevokeSchema)) body: { token: string }) {
    await this.smartAuth.revokeToken(body.token)
    return { success: true }
  }

  @Post('auth/introspect')
  @HttpCode(HttpStatus.OK)
  async introspect(@Body(new ZodValidationPipe(IntrospectSchema)) body: { token: string }) {
    return this.smartAuth.introspectToken(body.token)
  }
}

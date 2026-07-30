import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { randomUUID } from 'crypto'

export interface SmartTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  patient?: string
  encounter?: string
  fhirContext?: { reference: string }[]
  need_patient_banner?: boolean
  smart_style_url?: string
  intent?: string
}

@Injectable()
export class SmartAuthService {
  private authCodes = new Map<string, { clientId: string; scope: string; patientId?: string; encounterId?: string; userId: string }>()
  private revokedTokens = new Set<string>()
  private revokedTokensExpiry = new Map<string, number>()

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {
    setInterval(() => this.cleanupRevokedTokens(), 60 * 60 * 1000)
  }

  private cleanupRevokedTokens() {
    const now = Date.now()
    for (const [token, expiry] of this.revokedTokensExpiry) {
      if (expiry < now) {
        this.revokedTokens.delete(token)
        this.revokedTokensExpiry.delete(token)
      }
    }
  }

  async authorize(clientId: string, redirectUri: string, scope: string, state: string, userId: string, patientId?: string, encounterId?: string) {
    const code = randomUUID()
    this.authCodes.set(code, { clientId, scope, patientId, encounterId, userId })
    setTimeout(() => this.authCodes.delete(code), 5 * 60 * 1000)
    const params = new URLSearchParams({ code, state })
    return { redirectUrl: `${redirectUri}?${params.toString()}` }
  }

  async token(code: string, clientId: string): Promise<SmartTokenResponse> {
    const session = this.authCodes.get(code)
    if (!session || session.clientId !== clientId) {
      throw new UnauthorizedException('Invalid authorization code')
    }
    this.authCodes.delete(code)

    const payload = { sub: session.userId, scope: session.scope, client_id: clientId }
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '60m' })

    const response: SmartTokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: session.scope,
      need_patient_banner: true,
    }

    if (session.patientId) response.patient = session.patientId
    if (session.encounterId) response.encounter = session.encounterId
    if (session.patientId) {
      response.fhirContext = [{ reference: `Patient/${session.patientId}` }]
    }

    return response
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const payload = this.jwt.verify(token)
      const exp = payload.exp ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000
      this.revokedTokens.add(token)
      this.revokedTokensExpiry.set(token, exp)
    } catch {
      throw new UnauthorizedException('Invalid token')
    }
  }

  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token)
  }

  async introspectToken(token: string): Promise<{ active: boolean; scope?: string; sub?: string; exp?: number }> {
    if (this.revokedTokens.has(token)) {
      return { active: false }
    }
    try {
      const payload = this.jwt.verify(token)
      return {
        active: true,
        scope: payload.scope,
        sub: payload.sub,
        exp: payload.exp,
      }
    } catch {
      return { active: false }
    }
  }

  smartConfiguration() {
    const baseUrl = process.env['FHIR_BASE_URL'] ?? 'http://localhost:3001/api/fhir/r4'
    const authUrl = process.env['SMART_AUTH_URL'] ?? 'http://localhost:3001/api/fhir/r4'
    return {
      issuer: baseUrl,
      jwks_uri: `${authUrl}/.well-known/jwks.json`,
      authorization_endpoint: `${authUrl}/auth/authorize`,
      token_endpoint: `${authUrl}/auth/token`,
      revocation_endpoint: `${authUrl}/auth/revoke`,
      introspection_endpoint: `${authUrl}/auth/introspect`,
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
      scopes_supported: ['openid', 'profile', 'fhirUser', 'patient/*.read', 'user/*.read'],
      response_types_supported: ['code'],
      capabilities: [
        'launch-standalone',
        'client-public',
        'client-confidential-symmetric',
        'sso-openid-connect',
        'context-standalone-patient',
        'context-standalone-encounter',
        'permission-offline',
      ],
    }
  }
}

import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PrismaModule } from '../prisma/prisma.module'
import { FhirController } from './fhir.controller'
import { FhirService } from './fhir.service'
import { SmartAuthController } from './smart-auth.controller'
import { SmartAuthService } from './smart-auth.service'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env['JWT_SECRET'] ?? 'g005-dev-secret-change-in-prod',
      signOptions: { expiresIn: '15m' },
    }),
    PrismaModule,
  ],
  controllers: [FhirController, SmartAuthController],
  providers: [FhirService, SmartAuthService],
})
export class FhirModule {}

import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PrismaModule } from '../prisma/prisma.module'
import { QueueModule } from '../queue/queue.module'
import { FhirController } from './fhir.controller'
import { FhirService } from './fhir.service'
import { SmartAuthController } from './smart-auth.controller'
import { SmartAuthService } from './smart-auth.service'

const jwtSecret = process.env['JWT_SECRET']

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required')
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '15m' },
    }),
    PrismaModule,
    QueueModule,
  ],
  controllers: [FhirController, SmartAuthController],
  providers: [FhirService, SmartAuthService],
})
export class FhirModule {}

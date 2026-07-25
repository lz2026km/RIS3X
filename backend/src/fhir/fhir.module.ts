import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PrismaModule } from '../prisma/prisma.module'
import { QueueModule } from '../queue/queue.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { FhirController } from './fhir.controller'
import { FhirService } from './fhir.service'
import { SmartAuthController } from './smart-auth.controller'
import { SmartAuthService } from './smart-auth.service'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET')
        if (!secret || (config.get<string>('NODE_ENV') === 'production' && Buffer.byteLength(secret) < 32)) {
          throw new Error('JWT_SECRET must be at least 32 bytes in production')
        }
        return { secret, signOptions: { expiresIn: '15m' as const, algorithm: 'HS256' as const } }
      },
    }),
    PrismaModule,
    QueueModule,
    NotificationsModule,
  ],
  controllers: [FhirController, SmartAuthController],
  providers: [FhirService, SmartAuthService],
})
export class FhirModule {}

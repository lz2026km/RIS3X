/**
 * G005 放射RIS系统 v3.0.6.11-7 - NestJS 根模块（扩 14 新 module）
 */
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { CacheModule } from './cache/cache.module'
import { QueueModule } from './queue/queue.module'
import { AppScheduleModule } from './schedule/schedule.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ReportsModule } from './reports/reports.module'
import { PrismaModule } from './prisma/prisma.module'
import { HealthController } from './health/health.controller'
import { AppointmentsModule } from './appointments/appointments.module'
import { CriticalsModule } from './criticals/criticals.module'
import { TemplatesModule } from './templates/templates.module'
import { FilesModule } from './files/files.module'
import { Hl7Module } from './hl7/hl7.module'
import { ReportsQualityModule } from './reports-quality/reports-quality.module'
import { DicomWebModule } from './dicom-web/dicom-web.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AiModule } from './modules/ai/ai.module'
import { StatsModule } from './modules/stats/stats.module'
import { ComplianceModule } from './modules/compliance/compliance.module'
import { PatientModule } from './modules/patient/patient.module'
import { ExamModule } from './modules/exam/exam.module'
import { DeviceModule } from './modules/device/device.module'
import { AuditModule } from './modules/audit/audit.module'
import { BackupModule } from './modules/backup/backup.module'
import { ExportApprovalModule } from './modules/export-approval/export-approval.module'
import { ComplianceDocsModule } from './modules/compliance-docs/compliance-docs.module'
import { SafetyModule } from './safety/safety.module'
import { EyeModule } from './eye/eye.module'
import { DentalModule } from './dental/dental.module'
import { WorkflowModule } from './workflow/workflow.module'
import { FinanceModule } from './finance/finance.module'
import { DataReportModule } from './datareport/datareport.module'
import { RegionalModule } from './regional/regional.module'
import { PatientPortalModule } from './patientportal/patientportal.module'
import { CosignModule } from './cosign/cosign.module'
import { CdsModule } from './cds/cds.module'
import { CriticalExtModule } from './criticalext/criticalext.module'
import { QcExtModule } from './qcext/qcext.module'
import { ReportQualityModule } from './reportquality/reportquality.module'
import { FhirModule } from './fhir/fhir.module'
import { DicomDimseModule } from './dicom-dimse/dicom-dimse.module'
import { CaModule } from './ca/ca.module'
import { DeviceMgmtModule } from './devicemgmt/devicemgmt.module'
import { AiPlatformModule } from './aiplatform/aiplatform.module'
import { OlapModule } from './modules/olap/olap.module'
import { RolesGuard } from './common/guards/roles.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
    QueueModule,
    AppScheduleModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        transport: process.env['NODE_ENV'] === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReportsModule,
    AppointmentsModule,
    CriticalsModule,
    TemplatesModule,
    FilesModule,
    Hl7Module,
    ReportsQualityModule,
    DicomWebModule,
    NotificationsModule,
    AiModule,
    StatsModule,
    ComplianceModule,
    PatientModule,
    ExamModule,
    DeviceModule,
    AuditModule,
    BackupModule,
    ExportApprovalModule,
    ComplianceDocsModule,
    SafetyModule,
    EyeModule,
    DentalModule,
    WorkflowModule,
    FinanceModule,
    DataReportModule,
    RegionalModule,
    PatientPortalModule,
    CosignModule,
    CdsModule,
    CriticalExtModule,
    QcExtModule,
    ReportQualityModule,
    CaModule,
    FhirModule,
    DeviceMgmtModule,
    AiPlatformModule,
    DicomDimseModule,
    OlapModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

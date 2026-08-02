/**
 * G005 放射RIS系统 v3.0.6.11-50 - NestJS 根模块（扩 14 新 module）
 */
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { CacheModule } from "./cache/cache.module";
import { QueueModule } from "./queue/queue.module";
import { AppScheduleModule } from "./schedule/schedule.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ReportsModule } from "./reports/reports.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { MetricsModule } from "./observability/metrics.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { CriticalsModule } from "./criticals/criticals.module";
import { TemplatesModule } from "./templates/templates.module";
import { FilesModule } from "./files/files.module";
import { Hl7Module } from "./hl7/hl7.module";
import { ReportsQualityModule } from "./reports-quality/reports-quality.module";
import { DicomWebModule } from "./dicom-web/dicom-web.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AiModule } from "./modules/ai/ai.module";
import { CadModule } from "./modules/cad/cad.module";
import { StatsModule } from "./modules/stats/stats.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { PatientModule } from "./modules/patient/patient.module";
import { ExamModule } from "./modules/exam/exam.module";
import { DeviceModule } from "./modules/device/device.module";
import { AuditModule } from "./modules/audit/audit.module";
import { BackupModule } from "./modules/backup/backup.module";
import { ExportApprovalModule } from "./modules/export-approval/export-approval.module";
import { ComplianceDocsModule } from "./modules/compliance-docs/compliance-docs.module";
import { SafetyModule } from "./safety/safety.module";
import { EyeModule } from "./eye/eye.module";
import { DentalModule } from "./dental/dental.module";
import { WorkflowModule } from "./workflow/workflow.module";
import { FinanceModule } from "./finance/finance.module";
import { DataReportModule } from "./datareport/datareport.module";
import { RegionalModule } from "./regional/regional.module";
import { PatientPortalModule } from "./patientportal/patientportal.module";
import { CosignModule } from "./cosign/cosign.module";
import { CdsModule } from "./cds/cds.module";
import { CriticalExtModule } from "./criticalext/criticalext.module";
import { QcExtModule } from "./qcext/qcext.module";
import { ReportQualityModule } from "./reportquality/reportquality.module";
import { FhirModule } from "./fhir/fhir.module";
import { DicomDimseModule } from "./dicom-dimse/dicom-dimse.module";
import { CaModule } from "./ca/ca.module";
import { DeviceMgmtModule } from "./devicemgmt/devicemgmt.module";
import { AiPlatformModule } from "./aiplatform/aiplatform.module";
import { TeleModule } from "./modules/tele/tele.module";
import { OlapModule } from "./modules/olap/olap.module";
import { FusionModule } from "./modules/fusion/fusion.module";
import { FusionV2Module } from "./modules/fusion-v2/fusion-v2.module";
import { OccupancyModule } from "./modules/occupancy/occupancy.module";
import { VolumeModule } from "./modules/volume/volume.module";
import { BenchmarkModule } from "./modules/benchmark/benchmark.module";
import { AiDiagnosisModule } from "./modules/ai-diagnosis/ai-diagnosis.module";
import { DicomCompressModule } from "./modules/dicom-compress/dicom-compress.module";
import { Dicom4dModule } from "./modules/dicom-4d/dicom-4d.module";
import { AiMarketplaceModule } from "./modules/ai-marketplace/ai-marketplace.module";
import { CrossModalModule } from "./modules/cross-modal/cross-modal.module";
import { DualReadModule } from "./modules/dual-read/dual-read.module";
import { TeleSignModule } from "./modules/tele-sign/tele-sign.module";
import { SmartRouteModule } from "./modules/smart-route/smart-route.module";
import { Hl7SiuModule } from "./modules/hl7-siu/hl7-siu.module";
import { RadiomicsModule } from "./modules/radiomics/radiomics.module";
import { WorklistSmartModule } from "./modules/worklist-smart/worklist-smart.module";
import { WorklistModule } from "./modules/worklist/worklist.module";
import { TriageModule } from "./modules/triage/triage.module";
import { TeachModule } from "./modules/teach/teach.module";
import { OeeModule } from "./modules/oee/oee.module";
import { RadPathModule } from "./modules/radpath/radpath.module";
import { OrchestratorModule } from "./modules/orchestrator/orchestrator.module";
import { ImageAiModule } from "./modules/qc/image-ai.module";
import { NlpModule } from "./modules/nlp/nlp.module";
import { AsrModule } from "./modules/asr/asr.module";
import { SnomedModule } from "./modules/snomed/snomed.module";
import { AiDraftModule } from "./modules/ai-draft/ai-draft.module";
import { RdsrModule } from "./modules/rdsr/rdsr.module";
import { DicomSrModule } from "./modules/dicom-sr/dicom-sr.module";
import { MobileModule } from "./mobile/mobile.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { CsrfInterceptor } from "./common/interceptors/csrf.interceptor";
import { SecurityHeadersInterceptor } from "./common/interceptors/security-headers.interceptor";
import { TenantContextInterceptor } from "./common/interceptors/tenant-context.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredTtl = Number(
          config.get<string>("THROTTLE_TTL_MS") ?? 60000,
        );
        const configuredLimit = Number(
          config.get<string>("THROTTLE_LIMIT") ?? 100,
        );
        const ttl =
          Number.isFinite(configuredTtl) && configuredTtl >= 1000
            ? Math.floor(configuredTtl)
            : 60000;
        const limit =
          Number.isFinite(configuredLimit) && configuredLimit >= 1
            ? Math.floor(configuredLimit)
            : 100;
        return [{ ttl, limit, blockDuration: ttl }];
      },
    }),
    MetricsModule,
    CacheModule,
    QueueModule,
    AppScheduleModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env["LOG_LEVEL"] ?? "info",
        transport:
          process.env["NODE_ENV"] === "production"
            ? undefined
            : { target: "pino-pretty" },
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
    CadModule,
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
    NlpModule,
    AsrModule,
    SnomedModule,
    AiDraftModule,
    RdsrModule,
    CriticalExtModule,
    QcExtModule,
    ReportQualityModule,
    CaModule,
    FhirModule,
    DeviceMgmtModule,
    AiPlatformModule,
    DicomDimseModule,
    OlapModule,
    OccupancyModule,
    FusionModule,
    FusionV2Module,
    OeeModule,
    VolumeModule,
    TeachModule,
    ImageAiModule,
    RadPathModule,
    TeleModule,
    MobileModule,
    BenchmarkModule,
    AiDiagnosisModule,
    TriageModule,
    DicomCompressModule,
    Dicom4dModule,
    AiMarketplaceModule,
    CrossModalModule,
    DualReadModule,
    TeleSignModule,
    SmartRouteModule,
    Hl7SiuModule,
    RadiomicsModule,
    OrchestratorModule,
    WorklistSmartModule,
    WorklistModule,
    DicomSrModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: SecurityHeadersInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CsrfInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}

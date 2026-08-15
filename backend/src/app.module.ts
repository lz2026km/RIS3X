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
import { SignModule } from "./sign/sign.module";
import { AmendModule } from "./amend/amend.module";
import { PatientPortalModule } from "./patientportal/patientportal.module";
import { CosignModule } from "./cosign/cosign.module";
import { CdsModule } from "./cds/cds.module";
import { CriticalExtModule } from "./criticalext/criticalext.module";
import { QcExtModule } from "./qcext/qcext.module";
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
import { DbtModule } from "./modules/dbt/dbt.module";
import { AiMarketplaceModule } from "./modules/ai-marketplace/ai-marketplace.module";
import { CrossModalModule } from "./modules/cross-modal/cross-modal.module";
import { SimilarCaseModule } from "./modules/similar-case/similar-case.module";
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
import { HangingModule } from "./modules/hanging/hanging.module";
import { BiModule } from "./modules/bi/bi.module";
import { VnaModule } from "./modules/vna/vna.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { FollowUpModule } from "./modules/followup/followup.module";
import { DictionaryModule } from "./modules/dictionary/dictionary.module";
import { VoiceWorkstationModule } from "./modules/voice-workstation/voice-workstation.module";
import { MobileModule } from "./mobile/mobile.module";
import { CallQueueModule } from "./modules/queue/queue.module";
import { CriticalAlertModule } from "./modules/critical-alert/critical-alert.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { CsrfInterceptor } from "./common/interceptors/csrf.interceptor";
import { SecurityHeadersInterceptor } from "./common/interceptors/security-headers.interceptor";
import { TenantContextInterceptor } from "./common/interceptors/tenant-context.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { StorageModule } from "./common/storage/storage.module";
import { SystemStorageModule } from "./system-storage/system-storage.module";
import { ClinicalConfigModule } from "./clinical-config/clinical-config.module";
import { RemoteReadingModule } from "./modules/remote-reading/remote-reading.module";
import { ClinicalPathwaysModule } from "./modules/clinical-pathways/clinical-pathway.module";
import { NuclearStatsModule } from "./modules/nuclear-stats/nuclear-stats.module";
import { ScreeningModule } from "./modules/screening/screening.module";
import { DicomShareModule } from "./modules/dicom-share/dicom-share.module";
import { TreatmentPlansModule } from "./modules/treatment-plans/treatment-plan.module";
// [G005 Wave1A] 后端扩充 (P1 六模块 + 医保审核写操作)
import { PacsAdminModule } from "./modules/pacs-admin/pacs-admin.module";
import { ConsultationsModule } from "./modules/consultations/consultations.module";
import { PrintModule } from "./modules/print/print.module";
import { AutoCollectionModule } from "./modules/auto-collection/auto-collection.module";
import { KioskModule } from "./modules/kiosk/kiosk.module";
import { ConsentEducationModule } from "./modules/consent-education/consent-education.module";
import { InsuranceAuditsModule } from "./modules/insurance-audits/insurance-audits.module";
// [G005 Wave1B P1] 第 8 轮盘点: 有页面无后端模块补 controller (14 组)
import { ResearchModule } from "./modules/research/research.module";
import { TypicalCasesModule } from "./modules/typical-cases/typical-cases.module";
import { MammoQcModule } from "./modules/mammo-qc/mammo-qc.module";
import { DiagnosisAccuracyModule } from "./modules/diagnosis-accuracy/diagnosis-accuracy.module";
import { TerminologyModule } from "./modules/terminology/terminology.module";
import { SystemAdminModule } from "./modules/system-admin/system-admin.module";
// [G005 Wave1A P0] MSW-only 真实化: 眼科教学病例库 + 亚专科 + 牙科收费字典
import { EyeEduModule } from "./modules/eye-edu/eye-edu.module";
import { EyeSubspecialtyModule } from "./modules/eye-subspecialty/eye-subspecialty.module";
// [G005 Wave3A P2] 急诊通道管理 + 科室公告/值班管理
import { EmergencyChannelModule } from "./modules/emergency-channel/emergency-channel.module";
import { DeptAnnouncementModule } from "./modules/dept-announcement/dept-announcement.module";
import { ReportAnnotationModule } from "./modules/report-annotation/report-annotation.module";
// [v3.0.6.11-98 Wave2B (报告 P1)] 征象库后端化: GET /finding-library + /finding-library/search
import { FindingLibraryModule } from "./modules/finding-library/finding-library.module";
// [G005 Wave1A 17] 神经专科 + 视光中心闭环 (MSW 真实化)
import { NeuroModule } from "./modules/neuro/neuro.module";
import { EyeOptometryModule } from "./modules/eye-optometry/eye-optometry.module";
// [G005 Wave 3A v3.0.6.11-99] qc-pdca 质控闭环模块
import { QcPdcaModule } from "./modules/qc-pdca/qc-pdca.module";
// [v3.0.6.11-99 Wave 4A] 病灶追踪 (lesion-tracking): 登记/测量/趋势/对比/统计/随访联动
import { LesionTrackingModule } from "./modules/lesion-tracking/lesion-tracking.module";
// [v3.0.6.11-99 Wave 5A] 自定义报表 (custom-report): 定义 CRUD + 执行/结果/历史/定时/导出
import { CustomReportModule } from "./modules/custom-report/custom-report.module";
// [v3.0.6.11-99 Wave 6B (tech-schedule)] 技师排班: 班次/换班/统计/月历/批量生成
import { TechScheduleModule } from "./modules/tech-schedule/tech-schedule.module";
// [G005 Wave 10A] 眼科远程会诊桥接 + 眼科像素级图像处理 (MSW 真实化)
import { EyeTeleModule } from "./modules/eye-tele/eye-tele.module";
import { EyePixelModule } from "./modules/eye-pixel/eye-pixel.module";
// [v3.0.6.11-100 Wave 4A] 移动审批 (mobile-approval): 待办/通过/驳回/委派/历史
import { MobileApprovalModule } from "./modules/mobile-approval/mobile-approval.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule,
    SystemStorageModule,
    ClinicalConfigModule,
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
    SignModule,
    AmendModule,
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
    QcPdcaModule,
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
    DbtModule,
    AiMarketplaceModule,
    CrossModalModule,
    SimilarCaseModule,
    DualReadModule,
    TeleSignModule,
    SmartRouteModule,
    Hl7SiuModule,
    RadiomicsModule,
    OrchestratorModule,
    WorklistSmartModule,
    WorklistModule,
    DicomSrModule,
    HangingModule,
    VnaModule,
    TenantModule,
    DictionaryModule,
    // [v3.0.6.11-99 Wave3B] 随访闭环 (计划状态机 + 模板库 + 统计 + 检查联动)
    FollowUpModule,
    CallQueueModule,
    CriticalAlertModule,
    RemoteReadingModule,
    ClinicalPathwaysModule,
    NuclearStatsModule,
    ScreeningModule,
    DicomShareModule,
    TreatmentPlansModule,
    PacsAdminModule,
    ConsultationsModule,
    PrintModule,
    AutoCollectionModule,
    KioskModule,
    ConsentEducationModule,
    InsuranceAuditsModule,
    ResearchModule,
    TypicalCasesModule,
    MammoQcModule,
    DiagnosisAccuracyModule,
    TerminologyModule,
    SystemAdminModule,
    EyeEduModule,
    EyeSubspecialtyModule,
    EmergencyChannelModule,
    DeptAnnouncementModule,
    ReportAnnotationModule,
    FindingLibraryModule,
    NeuroModule,
    EyeOptometryModule,
    // [v3.0.6.11-99 Wave 4A] 病灶追踪 (lesion-tracking)
    LesionTrackingModule,
    // [v3.0.6.11-99 Wave 5A] 自定义报表 (custom-report)
    CustomReportModule,
    // [v3.0.6.11-99 Wave 6B (tech-schedule)] 技师排班
    TechScheduleModule,
    // [v3.0.6.11-99 Wave 6A] 语音工作站 (voice-workstation)
    VoiceWorkstationModule,
    // [G005 Wave 10A] 眼科远程会诊桥接 + 眼科像素级图像处理
    EyeTeleModule,
    EyePixelModule,
    // [v3.0.6.11-100 Wave 4A] 移动审批
    MobileApprovalModule,
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

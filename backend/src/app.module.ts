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
// [G005 W3-BackendParity] AI 融合工作站 + 骨科影像分析 (孤儿模块, 无 DB 可启动)
import { AiFusionWorkspaceModule } from "./modules/ai-fusion-workspace/ai-fusion-workspace.module";
import { OrthoSpecialtyModule } from "./modules/ortho-specialty/ortho-specialty.module";
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
// [v3.0.6.11-101 Wave 2B] 病理切片 WSI 浏览与标注 (孤儿模块, 可无 DB 启动)
import { PathologyModule } from "./modules/pathology/pathology.module";
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
// [G005 v3.0.6.11-101 Wave 2A] 影像对比 (imaging-compare): 多时点/多序列/多模态并排 + 同步浏览 + 差异指标
import { ImagingCompareModule } from "./modules/imaging-compare/imaging-compare.module";
// [v3.0.6.11-101 Wave 2C] 影像分割深化 (segmentation-v2): 多算法分割 + 结果管理 + 测量联动
import { SegmentationV2Module } from "./modules/segmentation-v2/segmentation-v2.module";
// [v3.0.6.11-101 Wave 3B] 影像测量 V2 (measurement-v2): 8 工具确定性测量 + 标注 V2 双向同步 (孤儿模块)
import { MeasurementV2Module } from "./modules/measurement-v2/measurement-v2.module";
// [v3.0.6.11-101 Wave 3C] AI 增强 (ai-v2): 多器官自动检出 + 报告草稿评分 + 智能挂片 (孤儿模块, 无 DB 可启动)
import { AiV2Module } from "./modules/ai-v2/ai-v2.module";
// [v3.0.6.11-101 Wave 4A] 技师工作站 V2 (tech-v2): 双检间轮转 + 工作量预测 (孤儿模块, 无 DB 可启动)
import { TechV2Module } from "./modules/tech-v2/tech-v2.module";
// [v3.0.6.11-101 Wave 4B (tech-ops)] 技师工作站 V2: 设备利用率历史 + 紧急插入 + 跨机房排程优化 (孤儿模块, 无 DB 可启动)
import { TechOpsModule } from "./modules/tech-ops/tech-ops.module";
// [v3.0.6.11-101 Wave 5 (tech-overview)] 技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏 (孤儿模块, 无 DB 可启动)
import { TechOverviewModule } from "./modules/tech-overview/tech-overview.module";
// [v3.0.6.11-101 Wave 6B] 报告质控 V2 (report-qc-v2): 多维智能评分 + 质控任务流 + 二次复核 + 统计 (孤儿模块, 无 DB 可启动)
import { ReportQcV2Module } from "./modules/report-qc-v2/report-qc-v2.module";
// [v3.0.6.11-101 Wave 6B] 危急值升级链 V2 (critical-escalation): 升级链配置/执行状态机/响应耗时统计 (孤儿模块, 无 DB 可启动)
import { CriticalEscalationModule } from "./modules/critical-escalation/critical-escalation.module";
// [v3.0.6.11-101 Wave 7A (F1)] AI 报告助理 V2 (ai-draft-v2): 结构化字段提取 + 多模态草稿生成 + 信心溯源 + 修改建议 (孤儿模块, 无 DB 可启动)
import { AiDraftV2Module } from "./modules/ai-draft-v2/ai-draft-v2.module";
// [v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎: 18+ 内置规则 + 自定义规则 CRUD + 规则集绑定 (孤儿模块, 无 DB 可启动)
import { ReportRulesModule } from "./modules/report-rules/report-rules.module";
// [v3.0.6.11-105 Wave 1C] 质量指标库镜像: 40 条国标质控指标 + 图像/报告/流程质控标准 (孤儿模块, 无 DB 可启动)
import { QualityIndicatorsModule } from "./modules/quality-indicators/quality-indicators.module";
// [v3.0.6.11-101 Wave 6A F8] 水印签章 V2: 报告水印 (文字/图像/防篡改校验码) + 电子签名申请/审批/记录 (孤儿模块, 无 DB 可启动)
import { ReportSignV2Module } from "./modules/report-sign-v2/report-sign-v2.module";
// [v3.0.6.11-101 Wave 7C F14] AI 二次检出 V2: 定稿前 AI 复查 (漏诊/缺项/不一致) + 忽略/采纳/加入报告 (孤儿模块)
import { AiSecondReadModule } from "./modules/ai-second-read/ai-second-read.module";
// [v3.0.6.11-101 Wave 7C F6] 委员会会诊 V2: 会诊室/发言时序/投票汇总/结论签名/记录导出 (孤儿模块, 独立于 consultations)
import { ConsultationV2Module } from "./modules/consultation-v2/consultation-v2.module";
// [v3.0.6.11-101 Wave 7C F9] 报告互评: 按科室确定性分配 + 三维度 5 分制 + 评语/状态/统计 (孤儿模块)
import { ReportPeerReviewModule } from "./modules/report-peer-review/report-peer-review.module";
// [v3.0.6.11-101 Wave 8A (F16)] 报告对比 V2: 同患者不同时点/双阅双报告/医生与AI 逐段diff + 关键字段 + 相似度 (孤儿模块)
import { ReportCompareV2Module } from "./modules/report-compare-v2/report-compare-v2.module";
// [v3.0.6.11-101 Wave 8A] 报告检索 V2: 关键词全文 + 结构化条件 + 自然语言解析 + 跨机构检索 + 高亮/聚合 (孤儿模块)
import { ReportSearchV2Module } from "./modules/report-search-v2/report-search-v2.module";
// [v3.0.6.11-101 Wave 8B] 报告质控闭环与趋势分析 (qc-analytics): 缺陷→整改→复查→关闭 + 帕累托/科室排名/驾驶舱 (孤儿模块, 无 DB 可启动)
import { QcAnalyticsModule } from "./modules/qc-analytics/qc-analytics.module";
// [v3.0.6.11-104 Wave 3C] 临床反馈闭环 (clinical-feedback): 异议/补充/更正 + 回应 + 关闭 (孤儿模块, 无 DB 可启动)
import { ClinicalFeedbackModule } from "./modules/clinical-feedback/clinical-feedback.module";
// [v3.0.6.11-104 Wave 3B] 对比剂安全闭环 (contrast-safety): 过敏试验 + 注射前核查 + 注射后留观 (孤儿模块, 无 DB 可启动)
import { ContrastSafetyModule } from "./modules/contrast-safety/contrast-safety.module";
// [G005 W6] 登记工作站: 扫码检索 + 准备项确认 + 知情同意 + 缴费 (孤儿模块, 无 DB 可启动)
import { RegistrationModule } from "./modules/registration/registration.module";
// [v3.0.6.11-105 Wave 1A] 放射影像专业质控指标 (2024 年版) (rqi-2024): 7 条国标指标采集与计算 (孤儿模块, 无 DB 可启动)
import { Rqi2024Module } from "./modules/rqi-2024/rqi-2024.module";
// [v3.0.6.11-105 Wave 2A] 放射影像质控指标国家上报中心 (rqi-report-center): 周期上报→提交→回执闭环 (孤儿模块, 无 DB 可启动)
import { RqiReportCenterModule } from "./modules/rqi-report-center/rqi-report-center.module";
// [G005 W9-QC] 质量管理专业化: 统一可配置评分量表 (quality-rubric)
import { QualityRubricModule } from "./modules/quality-rubric/quality-rubric.module";
// [G005 W9-QC] 设备质控 (equipment-qc): CT/DR/MRI/MG 模体检测 + 排程 + 统计
import { EquipmentQcModule } from "./modules/equipment-qc/equipment-qc.module";
// [G005 W11-DeviceOps] 设备运维中心 (工单/校准/资产折旧/OEE/成本DRG/定时报表)
import { DeviceOpsModule } from "./modules/device-ops/device-ops.module";
// [G005 W9-QC] 规范化缺陷库 (defect-library): 分类 + 缺陷项 + 聚合
import { DefectLibraryModule } from "./modules/defect-library/defect-library.module";
// [G005 BackendParity] 注册孤儿模块: IHE 集成 + 危急值 V2 + 报告导出中心 V2 + 模板审批/模板库 V2
import { IheModule } from "./ihe/ihe.module";
import { CriticalV2Module } from "./modules/critical-v2/critical-v2.module";
import { ReportExportCenterV2Module } from "./modules/report-export-center-v2/report-export-center-v2.module";
import { TemplateApprovalModule } from "./modules/template-approval/template-approval.module";
import { TemplateLibraryV2Module } from "./modules/template-library-v2/template-library-v2.module";
// [v3.0.6.13] 接口监控 + 持久化重试队列
import { InterfaceMonitorModule } from "./modules/interface-monitor/interface-monitor.module";
// [G005 W12-PatientService] 患者服务专业化: 微信服务号/支付/通知渠道/满意度/自助登记 (孤儿模块, 无 DB 可启动)
import { WechatModule } from "./modules/wechat/wechat.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { NotificationChannelModule } from "./modules/notification-channel/notification-channel.module";
import { SatisfactionModule } from "./modules/satisfaction/satisfaction.module";
import { SelfRegistrationModule } from "./modules/self-registration/self-registration.module";
// [G005 W13-Security] 安全与合规中心: RA/OCSP/HSM/字段加密/等保评估/灾难恢复/审计链
import { SecurityCenterModule } from "./modules/security-center/security-center.module";

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
    // [G005 v3.0.6.11-101 Wave 2A] 影像对比 (imaging-compare)
    ImagingCompareModule,
    // [v3.0.6.11-101 Wave 2C] 影像分割深化 (segmentation-v2)
    SegmentationV2Module,
    // [v3.0.6.11-101 Wave 2B] 病理切片 WSI 浏览与标注
    PathologyModule,
    // [v3.0.6.11-101 Wave 3B] 影像测量 V2 + 标注 V2 双向同步
    MeasurementV2Module,
    // [v3.0.6.11-101 Wave 3C] AI 增强 (ai-v2)
    AiV2Module,
    // [v3.0.6.11-101 Wave 4A] 技师工作站 V2 (tech-v2): 双检间轮转 + 工作量预测
    TechV2Module,
    // [v3.0.6.11-101 Wave 4B (tech-ops)] 技师工作站 V2: 利用率历史 + 紧急插入 + 跨机房优化
    TechOpsModule,
    // [v3.0.6.11-101 Wave 5 (tech-overview)] 技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏
    TechOverviewModule,
    // [v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎 (孤儿模块, 无 DB 可启动)
    ReportRulesModule,
    // [v3.0.6.11-105 Wave 1C] 质量指标库镜像 (孤儿模块, 无 DB 可启动)
    QualityIndicatorsModule,
    // [v3.0.6.11-101 Wave 6A F8] 水印签章 V2 (孤儿模块, 无 DB 可启动)
    ReportSignV2Module,
    // [v3.0.6.11-101 Wave 6B] 报告质控 V2 (report-qc-v2): 多维智能评分 + 任务流 + 二次复核 + 统计
    ReportQcV2Module,
    // [v3.0.6.11-101 Wave 6B] 危急值升级链 V2 (critical-escalation): 升级链配置/执行/统计
    CriticalEscalationModule,
    // [v3.0.6.11-101 Wave 7A (F1)] AI 报告助理 V2 (ai-draft-v2): 结构化字段 + 草稿生成 + 溯源 + 建议 (孤儿模块)
    AiDraftV2Module,
    // [v3.0.6.11-101 Wave 7C] 报告 V2: AI 二次检出 V2 (F14) + 委员会会诊 V2 (F6) + 报告互评 (F9) (孤儿模块)
    AiSecondReadModule,
    ConsultationV2Module,
    ReportPeerReviewModule,
    // [v3.0.6.11-101 Wave 8A (F16)] 报告对比 V2 (report-compare-v2): 逐段 diff + 关键字段 + 相似度 (孤儿模块)
    ReportCompareV2Module,
    // [v3.0.6.11-101 Wave 8A] 报告检索 V2 (report-search-v2): 自然语言 + 跨机构 + 高亮/聚合 (孤儿模块)
    ReportSearchV2Module,
    // [v3.0.6.11-101 Wave 8B] 报告质控闭环与趋势分析 (qc-analytics): 缺陷→整改→复查→关闭 + 帕累托/科室排名/驾驶舱 (孤儿模块)
    QcAnalyticsModule,
    // [v3.0.6.11-104 Wave 3B] 对比剂安全闭环 (contrast-safety): 过敏试验 + 注射前核查 + 注射后留观
    ContrastSafetyModule,
    // [G005 W6] 登记工作站: 扫码检索 + 准备项确认 + 知情同意 + 缴费 (孤儿模块, 无 DB 可启动)
    RegistrationModule,
    // [v3.0.6.11-104 Wave 3C] 临床反馈闭环 (clinical-feedback): 异议/补充/更正 + 回应 + 关闭
    ClinicalFeedbackModule,
    // [v3.0.6.11-105 Wave 1A] 放射影像专业质控指标 (2024 年版) (rqi-2024): 7 条国标指标
    Rqi2024Module,
    // [v3.0.6.11-105 Wave 2A] 放射影像质控指标国家上报中心 (rqi-report-center): 周期上报→提交→回执闭环
    RqiReportCenterModule,
    // [G005 W9-QC] 质量管理专业化模块
    DefectLibraryModule,
    QualityRubricModule,
    EquipmentQcModule,
    // [G005 W11-DeviceOps] 设备运维中心 (工单/校准/资产折旧/OEE/成本DRG/定时报表)
    DeviceOpsModule,
    // [G005 W3-BackendParity] 前端已调用但后端缺失端点补齐 (孤儿模块, 无 DB 可启动)
    AiFusionWorkspaceModule,
    OrthoSpecialtyModule,
    // [G005 BackendParity] 孤儿模块注册: IHE 集成 + 危急值 V2 + 报告导出中心 V2 + 模板审批/模板库 V2
    IheModule,
    CriticalV2Module,
    ReportExportCenterV2Module,
    TemplateApprovalModule,
    TemplateLibraryV2Module,
    // [v3.0.6.13] 接口监控 + 持久化重试队列 (孤儿模块, 无 DB 可启动)
    InterfaceMonitorModule,
    // [G005 W12-PatientService] 患者服务专业化 (微信/支付/通知/满意度/自助登记)
    WechatModule,
    PaymentModule,
    NotificationChannelModule,
    SatisfactionModule,
    SelfRegistrationModule,
    // [G005 W13-Security] 安全与合规中心 (RA/OCSP/HSM/字段加密/灾难恢复/审计链)
    SecurityCenterModule,
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

/**
 * G005 放射RIS系统 - 路由表 v3.0.6.11-50
 * 122+ lazy 页面 + Login + Forbidden + Navigate 重定向
 * 全部路由由 RequireAuth 包裹(基于 sidebarConfig 的角色映射)
 */
import React, { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { RequireAuth } from "../components/auth/RequireAuth";
import { SIDEBAR_ITEMS, type Role } from "./sidebarConfig";

const HomePage = lazy(() => import("../pages/HomePage"));
const PatientPage = lazy(() => import("../pages/PatientPage"));
const ExamPage = lazy(() => import("../pages/ExamPage"));
// [v3.0.6.11-96 Wave 3A P1] 检查执行详情独立路由 (仅跳转可达, 侧边栏不加菜单)
const ExamDetailPage = lazy(() => import("../pages/ExamDetailPage"));
const ReportPage = lazy(() => import("../pages/ReportPage"));
const OfflineReportsPage = lazy(() => import("../pages/OfflineReportsPage")); // [v3.0.6.11-99 Wave7B] 离线报告包
const ReportWritePage = lazy(() => import("../pages/ReportWritePage"));
const WorklistPage = lazy(() => import("../pages/WorklistPage"));
const StatisticsPage = lazy(() => import("../pages/StatisticsPage"));
const CriticalValuePage = lazy(
  () => import("../pages/critical/CriticalValuePage"),
);
const TermLibraryPage = lazy(() => import("../pages/TermLibraryPage"));
const DevicePage = lazy(() => import("../pages/DevicePage"));
const ConsultationPage = lazy(() => import("../pages/ConsultationPage"));
const QCPage = lazy(() => import("../pages/QCPage"));
const AppointmentPage = lazy(() => import("../pages/AppointmentPage"));
const DoseTrackPage = lazy(() => import("../pages/DoseTrackPage"));
const QueueCallPage = lazy(() => import("../pages/QueueCallPage"));
const DicomViewerClassicPage = lazy(() => import("../pages/DicomViewerPage"));
const DicomViewerProPage = lazy(() => import("../pages/dicom/DicomViewerPro"));
const DicomCompressPage = lazy(
  () => import("../pages/dicom/DicomCompressPage"),
);
const Dicom4dPage = lazy(() => import("../pages/dicom/Dicom4dPage"));
const TypicalCasesPage = lazy(() => import("../pages/TypicalCasesPage"));
const FindingLibraryPage = lazy(() => import("../pages/FindingLibraryPage"));
const OperationLogPage = lazy(() => import("../pages/OperationLogPage"));
const NotificationCenter = lazy(() => import("../pages/NotificationCenter"));
const SchedulePage = lazy(() => import("../pages/SchedulePage"));
const ClinicalConfigCenter = lazy(
  () => import("../pages/admin/ClinicalConfigCenter"),
);
const DepartmentPage = lazy(() => import("../pages/DepartmentPage"));
const PrintManagementPage = lazy(() => import("../pages/PrintManagementPage"));
const RegionalReportPage = lazy(() => import("../pages/RegionalReportPage"));
const AIAssistPage = lazy(() => import("../pages/AIAssistPage"));
const AIOrchestrationPage = lazy(() => import("../pages/AIOrchestrationPage"));
const CostAnalysisPage = lazy(() => import("../pages/CostAnalysisPage"));
const EquipmentLifecyclePage = lazy(
  () => import("../pages/EquipmentLifecyclePage"),
);
const FollowUpPage = lazy(() => import("../pages/FollowUpPage"));
const CancerScreenPage = lazy(() => import("../pages/CancerScreenPage"));
const NationalReportPage = lazy(() => import("../pages/NationalReportPage"));
const InsuranceAuditPage = lazy(() => import("../pages/InsuranceAuditPage"));
const DataReportCenterPage = lazy(
  () => import("../pages/DataReportCenterPage"),
);
const DictionaryPage = lazy(() => import("../pages/DictionaryPage"));
const OperationsCenterPage = lazy(
  () => import("../pages/OperationsCenterPage"),
);
const DepartmentDashboardPage = lazy(
  () => import("../pages/DepartmentDashboardPage"),
);
const StatsReportPage = lazy(() => import("../pages/StatsReportPage"));
const ClinicalDataPage = lazy(() => import("../pages/ClinicalDataPage"));
const TemplateManagementPage = lazy(
  () => import("../pages/TemplateManagementPage"),
);
const TemplateDesignerPage = lazy(
  () => import("../pages/TemplateDesignerPage"),
);
const TemplateInheritancePage = lazy(
  () => import("../pages/TemplateInheritancePage"),
);
const TemplateCategoryPage = lazy(
  () => import("../pages/TemplateCategoryPage"),
);
const ReportReviewPage = lazy(() => import("../pages/ReportReviewPage"));
const ReportRevisionsPage = lazy(() => import("../pages/ReportRevisionsPage"));
const CollaborationPage = lazy(() => import("../pages/CollaborationPage"));
// [v3.0.6.11-100 Wave 2A] 委员会会诊室 (多医生合议)
const CommitteeRoomPage = lazy(() => import("../pages/review/CommitteeRoomPage"));
const KeywordCheckPage = lazy(() => import("../pages/KeywordCheckPage"));
const ReportScoreRulePage = lazy(() => import("../pages/ReportScoreRulePage"));
const ReportDefectLibraryPage = lazy(
  () => import("../pages/ReportDefectLibraryPage"),
);
const AIReportDraftPage = lazy(() => import("../pages/AIReportDraftPage"));
const CriticalValueRulePage = lazy(
  () => import("../pages/CriticalValueRulePage"),
);
const CriticalValueStatsPage = lazy(
  () => import("../pages/CriticalValueStatsPage"),
);
const SpecialAssessmentPages = lazy(
  () => import("../pages/SpecialAssessmentPages"),
);
const ReportExportPage = lazy(() => import("../pages/ReportExportPage"));
const ExportApprovalPage = lazy(() => import("../pages/export/ExportApprovalPage")); // [W1-5] 导出审批中心
const ReportDeliveryPage = lazy(() => import("../pages/ReportDeliveryPage"));
const PublishPage = lazy(() => import("../pages/PublishPage"));
const PatientReportPortalPage = lazy(
  () => import("../pages/PatientReportPortalPage"),
);
const CASignaturePage = lazy(() => import("../pages/CASignaturePage"));
const BlockchainProofPage = lazy(() => import("../pages/BlockchainProofPage"));
// [v3.0.6.11-103 Wave 10] 重复页合并: AppointmentManagementPage/DeviceFaultPage 已嵌入目标页, 旧路由 redirect (见 routes 下方)
const AIQCPage = lazy(() => import("../pages/AIQCPage"));
const AIStructuredReportPage = lazy(
  () => import("../pages/AIStructuredReportPage"),
);
const RegionalImagingPage = lazy(() => import("../pages/RegionalImagingPage"));
const EquipmentEfficiencyPage = lazy(
  () => import("../pages/EquipmentEfficiencyPage"),
);
const UserManagementPage = lazy(() => import("../pages/UserManagementPage"));
// [v3.0.6.11-79] W1-B 用户中心
const UserCenterPage = lazy(() => import("../pages/user/UserCenterPage"));
const PatientPortalPage = lazy(() => import("../pages/patient/PatientPortalPage"));
const DirectorDashboardPage = lazy(
  () => import("../pages/DirectorDashboardPage"),
);
const GreenITPage = lazy(() => import("../pages/GreenITPage"));
const ResearchPage = lazy(() => import("../pages/ResearchPage"));
const DicomPrintPage = lazy(() => import("../pages/System/DicomPrintPage"));
const FileManagementPage = lazy(() => import("../pages/system/FileManagementPage")); // [W1-A v3.0.6.11-79] 文件管理
const FhirServerPage = lazy(
  () => import("../pages/integration/FhirServerPage"),
);
const IheConnectathonPage = lazy(
  () => import("../pages/integration/IheConnectathonPage"),
);
const MllpMonitorPage = lazy(
  () => import("../pages/integration/MllpMonitorPage"),
);
const Hl7ArchivePage = lazy(
  () => import("../pages/integration/Hl7ArchivePage"),
);
const Hl7BuilderPage = lazy(
  () => import("../pages/integration/Hl7BuilderPage"),
);
const MllpConfigPage = lazy(
  () => import("../pages/integration/MllpConfigPage"),
);
const SmartAuthPage = lazy(
  () => import("../pages/integration/SmartAuthPage"),
);
const DimseUploadPage = lazy(
  () => import("../pages/integration/DimseUploadPage"),
);
const NuclearStatsPage = lazy(() => import("../pages/NuclearStatsPage"));
const AIMedicalDevicePage = lazy(() => import("../pages/AIMedicalDevicePage"));
const TermSynonymGraphPage = lazy(
  () => import("../pages/TermSynonymGraphPage"),
);
const ReportPhraseBankPage = lazy(
  () => import("../pages/ReportPhraseBankPage"),
);
const ReportKpiDashboardPage = lazy(
  () => import("../pages/ReportKpiDashboardPage"),
);
const DoctorWorkloadPage = lazy(() => import("../pages/DoctorWorkloadPage"));
const DiagnosisAccuracyPage = lazy(
  () => import("../pages/DiagnosisAccuracyPage"),
);
const ReportTimelinessPage = lazy(
  () => import("../pages/ReportTimelinessPage"),
);
const ReportSearchPage = lazy(() => import("../pages/ReportSearchPage"));
const ChargeItemPage = lazy(() => import("../pages/rcm/ChargeItemPage"));
const AccountsReceivablePage = lazy(
  () => import("../pages/rcm/AccountsReceivablePage"),
);
const RevenueAnalysisPage = lazy(
  () => import("../pages/rcm/RevenueAnalysisPage"),
);
const CostAccountingPage = lazy(
  () => import("../pages/rcm/CostAccountingPage"),
);
const FinancialReportsPage = lazy(
  () => import("../pages/rcm/FinancialReportsPage"),
);
const BusinessContinuityPage = lazy(
  () => import("../pages/BusinessContinuityPage"),
);
const CloudStorageDashboardPage = lazy(
  () => import("../pages/CloudStorageDashboardPage"),
);
const EnterpriseSearchPage = lazy(
  () => import("../pages/EnterpriseSearchPage"),
);
const MultiSiteDashboardPage = lazy(
  () => import("../pages/MultiSiteDashboardPage"),
);
// [G005 Wave 4B] 区域医联体协同中心 (RegionalCollaborationPage)
const RegionalCollaborationPage = lazy(
  () => import("../pages/regional/RegionalCollaborationPage"),
);
// [G005 Wave 4B] 影像像素实验室 (EyePixelPage)
const EyePixelPage = lazy(() => import("../pages/eye/pacs/EyePixelPage"));
const VNADashboardPage = lazy(() => import("../pages/VNADashboardPage"));
const AdverseEventPage = lazy(() => import("../pages/safety/AdverseEventPage"));
const CQIPage = lazy(() => import("../pages/safety/CQIPage"));
const PatientSafetyGoalsPage = lazy(
  () => import("../pages/safety/PatientSafetyGoalsPage"),
);
const RadiationSafetyPage = lazy(
  () => import("../pages/safety/RadiationSafetyPage"),
);
const RCAAnalysisPage = lazy(() => import("../pages/safety/RCAAnalysisPage"));
const RiskManagementPage = lazy(
  () => import("../pages/safety/RiskManagementPage"),
);
const AdverseReactionPage = lazy(
  () => import("../pages/contrast/AdverseReactionPage"),
);
const ContrastInjectionWorkstationPage = lazy(
  () => import("../pages/contrast/ContrastInjectionWorkstationPage"),
);
const ContrastInventoryPage = lazy(
  () => import("../pages/contrast/ContrastInventoryPage"),
);
const ContrastQualityCompliancePage = lazy(
  () => import("../pages/contrast/ContrastQualityCompliancePage"),
);
const CvDatabasePage = lazy(() => import("../pages/cardiac/CvDatabasePage"));
const CvOperationsPage = lazy(
  () => import("../pages/cardiac/CvOperationsPage"),
);
const CvQcPage = lazy(() => import("../pages/cardiac/CvQcPage"));
const DeviceOpsPage = lazy(() => import("../pages/ops/DeviceOpsPage"));
const HrOperationsPage = lazy(() => import("../pages/ops/HrOperationsPage"));
const OpsDashboardPage = lazy(() => import("../pages/ops/OpsDashboardPage"));
// [v3.0.6.11-88] Wave6A 科室 KPI 墙屏
const KpiWallPage = lazy(() => import("../pages/ops/KpiWallPage"));
// [v3.0.6.11-99 Wave 6B (tech-schedule)] 技师排班管理 -> [v3.0.6.11-103 Wave 10] 已合并入 /schedule (SchedulePage Tab), 旧路由 redirect
// [v3.0.6.11-101 Wave 4B (tech-ops)] 技师工作站 V2: 利用率历史 + 紧急插入 + 跨机房优化
const TechOpsPage = lazy(() => import("../pages/tech/TechOpsPage"));
// [v3.0.6.11-103 Wave 11] 技师工作站: 端到端应用流程贯通 (今日检查/房间状态/重拍/交接/紧急插队)
const TechWorkbenchPage = lazy(() => import("../pages/tech/TechWorkbenchPage"));
// [v3.0.6.11-100 Wave 1A] 技师 KPI 看板 (运营组)
const TechnicianKpiDashboardPage = lazy(() => import("../pages/tech/TechnicianKpiDashboardPage"));
// [v3.0.6.11-101 Wave 4A] 技师工作站 V2: 双检间轮转 + 工作量预测
const TechRotationPage = lazy(() => import("../pages/tech/TechRotationPage"));
// [v3.0.6.11-101 Wave 5] 技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏
const TechOverviewPage = lazy(() => import("../pages/tech/TechOverviewPage"));
// [v3.0.6.11-88] Wave6A 血管分析工作台
const VesselAnalysisPage = lazy(() => import("../pages/cardiac/VesselAnalysisPage"));
const CdsManagementPage = lazy(() => import("../pages/cds/CdsManagementPage"));
const CdsStatisticsPage = lazy(() => import("../pages/cds/CdsStatisticsPage"));
// [G005 W2-B] CDS 6 方法页面: 指南库 / 告警中心 / 剂量监测
const GuidelineLibraryPage = lazy(() => import("../pages/cds/GuidelineLibraryPage"));
const AlertCenterPage = lazy(() => import("../pages/cds/AlertCenterPage"));
const CdsDoseMonitoringPage = lazy(() => import("../pages/cds/CdsDoseMonitoringPage"));
const DepartmentFinancePage = lazy(
  () => import("../pages/finance/DepartmentFinancePage"),
);
const PatientFinancePage = lazy(
  () => import("../pages/finance/PatientFinancePage"),
);
const DepartmentOperationsPage = lazy(
  () => import("../pages/mammo/DepartmentOperationsPage"),
);
const QualityManagementPage = lazy(
  () => import("../pages/mammo/QualityManagementPage"),
);
const SelfServicePortal = lazy(
  () => import("../pages/patient/SelfServicePortal"),
);
const ServiceManagement = lazy(
  () => import("../pages/patient/ServiceManagement"),
);
const Patient360Page = lazy(() => import("../pages/patient/Patient360Page"));
const PatientEducationPage = lazy(
  () => import("../pages/education/PatientEducationPage"),
);
const MedicalAlliancePage = lazy(
  () => import("../pages/hie/MedicalAlliancePage"),
);
const KioskCheckIn = lazy(() => import("../pages/kiosk/KioskCheckIn"));
const PatientMobileApp = lazy(() => import("../pages/mobile/PatientMobileApp"));
const DoctorMobileWorkstation = lazy(
  () => import("../pages/mobile/doctor/DoctorMobileWorkstation"),
);
const NurseMobileWorkstation = lazy(
  () => import("../pages/mobile/nurse/NurseMobileWorkstation"),
);
const TechMobileWorkstation = lazy(
  () => import("../pages/mobile/tech/TechMobileWorkstation"),
);
const MobilePushPage = lazy(() => import("../pages/mobile/MobilePushPage"));
const DepartmentQualityPage = lazy(
  () => import("../pages/quality/DepartmentQualityPage"),
);
const LoginPage = lazy(() => import("../pages/LoginPage"));
const ForbiddenPage = lazy(() => import("../pages/ForbiddenPage"));
const ReviewCenterPage = lazy(() => import("../pages/ReviewCenterPage"));
// [v3.0.6.11-103 Wave 10] 重复页合并: QualityControlPage 已嵌入 QCPage Tab, 旧路由 /quality-control redirect → /qc
const NlpCheckPage = lazy(() => import("../pages/report/NlpCheckPage"));
const AsrPage = lazy(() => import("../pages/report/AsrPage"));
// [v3.0.6.11-103 Wave 17] PACS 对标第一批: 结构化报告 V3 / 语音听写 V2 / 自动编码
const StructuredReportV3Page = lazy(() => import("../pages/report/StructuredReportV3Page"));
const AsrDictationPage = lazy(() => import("../pages/report/AsrDictationPage"));
const AutoCodingPage = lazy(() => import("../pages/report/AutoCodingPage"));
// [v3.0.6.11-100 Wave 4A] 自定义报表独立完整版 / 语音工作站 / 移动审批
const CustomReportPage = lazy(() => import("../pages/report/CustomReportPage"));
const VoiceWorkstationPage = lazy(() => import("../pages/voice/VoiceWorkstationPage"));
const MobileApprovalPage = lazy(() => import("../pages/mobile/MobileApprovalPage"));
const SnomedPage = lazy(() => import("../pages/report/SnomedPage"));
const RuleConfigPanel = lazy(() => import("../pages/cds/RuleConfigPanel"));
const RdsrPage = lazy(() => import("../pages/dose/RdsrPage"));
const CriticalValueCenterPage = lazy(
  () => import("../pages/CriticalValueCenterPage"),
);
// [v3.0.6.11-79] W2-A 危急值接收端门户
const ReceiverPortalPage = lazy(
  () => import("../pages/critical/ReceiverPortalPage"),
);
const DefectManagementPage = lazy(
  () => import("../pages/DefectManagementPage"),
);
const CoSignPage = lazy(() => import("../pages/review/CoSignPage"));
const WorkflowDesignerPage = lazy(
  () => import("../pages/WorkflowDesignerPage"),
);
const RoutingRulePage = lazy(() => import("../pages/RoutingRulePage"));
const WorkloadHeatmapPage = lazy(() => import("../pages/WorkloadHeatmapPage"));
const SlaPolicyPage = lazy(() => import("../pages/SlaPolicyPage"));
// [v3.0.6.8-27] 新增质控页面; [v3.0.6.11-103 Wave 10] RadiologyQCDashboardPage 已嵌入 QCPage Tab, 旧路由 /qc-dashboard redirect → /qc
const ImageQualityControlPage = lazy(
  () => import("../pages/qc/ImageQualityControlPage"),
);
const RadiologistAnnualQCPage = lazy(
  () => import("../pages/qc/RadiologistAnnualQCPage"),
);
const QcImageAiPage = lazy(() => import("../pages/qc/QcImageAiPage"));
// [G005 Wave 3A v3.0.6.11-99] PDCA 质控闭环
const QcPdcaPage = lazy(() => import("../pages/qc/QcPdcaPage"));
// [G005 Wave 8B v3.0.6.11-101] 报告质控闭环与趋势分析
const QcAnalyticsPage = lazy(() => import("../pages/qc/QcAnalyticsPage"));
// [G005 v3.0.6.11-101 Wave 6A] 报告 V2: 质控规则引擎 (F11) + 水印签章 V2 (F8)
const ReportRulesPage = lazy(() => import("../pages/qc/ReportRulesPage"));
const ReportWatermarkPage = lazy(() => import("../pages/qc/ReportWatermarkPage"));
// [v3.0.6.11-100 Wave 1B] 技师工作站: 检查间实时看板 + 重拍分析
const ExamRoomStatusBoard = lazy(
  () => import("../pages/tech/ExamRoomStatusBoard"),
);
const RetakeRateAnalyticsPage = lazy(
  () => import("../pages/tech/RetakeRateAnalyticsPage"),
);

const EyeWorkspacePage = lazy(() => import("../pages/eye/EyeWorkspacePage"));
const PacsStudyListPage = lazy(
  () => import("../pages/eye/pacs/PacsStudyListPage"),
);
const PacsViewerPage = lazy(() => import("../pages/eye/pacs/PacsViewerPage"));
// [v3.0.6.8-34] PR 1: 真实 DICOM 渲染
const RealDicomViewerPage = lazy(
  () => import("../pages/eye/pacs/RealDicomViewerPage"),
);
// [v3.0.6.8-35] PR 2: AI 报告书写
const AiReportWriterPage = lazy(
  () => import("../pages/eye/report/AiReportWriterPage"),
);
// [v3.0.6.8-36] PR 3: IOL 规划 (Toric 散光)
const ToricPlannerPage = lazy(
  () => import("../pages/eye/ris/ToricPlannerPage"),
);
// [v3.0.6.8-37] PR 4: 8 亚专科纵深
import {
  StrabismusPage,
  NeuroOphthalmologyPage,
  OcularOncologyPage,
  CorneaPage,
  ContactLensFittingPage,
  LowVisionPage,
  CataractPage,
  RefractivePage,
} from "../pages/eye/sub/SubspecialtyExamsPage";
// [v3.0.6.8-41] PR 8: 远程眼科 + 视光中心
const TeleConsultPage = lazy(() => import("../pages/eye/tele/TeleConsultPage"));
// [v3.0.6.8-42] PR 9: 教学病例库
const CaseLibraryPage = lazy(() => import("../pages/eye/edu/CaseLibraryPage"));
// [v3.0.6.8-44] PR 11: 视光中心闭环
const OptometryClosedLoopPage = lazy(
  () => import("../pages/eye/optometry/OptometryClosedLoopPage"),
);
// [v3.0.6.8-45] PR 1: 报告流程核心
const ReportWorkflowPage = lazy(
  () => import("../pages/reports/ReportWorkflowPage"),
);
// [v3.0.6.8-46] PR 2: 患者 + 设备管理
const PatientDeviceManagementPage = lazy(
  () => import("../pages/admin/PatientDeviceManagementPage"),
);
// [v3.0.6.8-47] PR 3: 通知 + 模板 + 词典
const NotificationTemplateDictPage = lazy(
  () => import("../pages/admin/NotificationTemplateDictPage"),
);
// [v3.0.6.8-48] PR 4: 初核 + 终核 + 复审
const ReviewCheckPage = lazy(() => import("../pages/review/ReviewCheckPage"));
// [v3.0.6.8-49] PR 5: CA 签名 + 修订
const SignAmendPage = lazy(() => import("../pages/security/SignAmendPage"));
// [v3.0.6.8-50] PR 6: v3 报告全栈
const V3ReportHubPage = lazy(() => import("../pages/v3/V3ReportHubPage"));
// [v3.0.6.8-51] PR 7: 眼料 (IOL + 接触镜)
const MaterialsV2Page = lazy(() => import("../pages/materials/MaterialsPage"));
const ToothChartPage = lazy(() => import("../pages/dental/ToothChartPage"));
const DentalAIPage = lazy(() => import("../pages/dental/DentalAIPage"));
const DentalWorkspacePage = lazy(
  () => import("../pages/dental/DentalWorkspacePage"),
);
const DentalTreatmentPage = lazy(
  () => import("../pages/dental/DentalTreatmentPage"),
);
const DentalImplantPlanPage = lazy(
  () => import("../pages/dental/DentalImplantPlanPage"),
);
const DentalOrthoPage = lazy(() => import("../pages/dental/DentalOrthoPage"));
const DentalEndoPage = lazy(() => import("../pages/dental/DentalEndoPage"));
const DentalPerioPage = lazy(() => import("../pages/dental/DentalPerioPage"));
const DentalRestorativePage = lazy(
  () => import("../pages/dental/DentalRestorativePage"),
);
const DentalSurgeryPage = lazy(
  () => import("../pages/dental/DentalSurgeryPage"),
);
const DentalPediatricPage = lazy(
  () => import("../pages/dental/DentalPediatricPage"),
);
const DentalTelePage = lazy(() => import("../pages/dental/DentalTelePage"));
const DentalInventoryPage = lazy(
  () => import("../pages/dental/DentalInventoryPage"),
);
const DentalDashboardPage = lazy(
  () => import("../pages/dental/DentalDashboardPage"),
);
const EmrTemplatesPage = lazy(() => import("../pages/emr/EmrTemplatesPage"));
const SystemAdminPage = lazy(() => import("../pages/admin/SystemAdminPage"));
const TreatmentPlanCenterPage = lazy(
  () => import("../pages/treatment/TreatmentPlanCenterPage"),
);
const PatientPortalPageV2 = lazy(
  () => import("../pages/patient/PatientPortalPage"),
);
const CommandCenterPage = lazy(
  () => import("../pages/operations/CommandCenterPage"),
);
const BenchmarkPageV2 = lazy(
  () => import("../pages/analytics/BenchmarkPageV2"),
);
const BenchmarkAiDiagnosisPage = lazy(
  () => import("../pages/analytics/BenchmarkAiDiagnosisPage"),
);
const TatDashboardPage = lazy(
  () => import("../pages/analytics/TatDashboardPage"),
);
const RoomOccupancyPage = lazy(
  () => import("../pages/operations/RoomOccupancyPage"),
);
const DicomSharePage = lazy(() => import("../pages/imaging/DicomSharePage"));
const ImagingComparePage = lazy(
  () => import("../pages/imaging/ImagingComparePage"),
); // [G005 v3.0.6.11-101 Wave 2A] 影像对比
const SchedulingCenterPage = lazy(
  () => import("../pages/operations/SchedulingCenterPage"),
);
const OEEDashboardPage = lazy(
  () => import("../pages/operations/OEEDashboardPage"),
);
const ClinicalPathwayPage = lazy(
  () => import("../pages/clinical/ClinicalPathwayPage"),
);
const AuditCompliancePage = lazy(
  () => import("../pages/compliance/AuditCompliancePage"),
);
const ComplianceDocsPage = lazy(
  () => import("../pages/compliance/ComplianceDocsPage"),
); // [v3.0.6.11-79 W1-C] 合规文档库
const DicomSrPage = lazy(() => import("../pages/dicom/DicomSrPage"));
const DicomWebPage = lazy(() => import("../pages/dicom/DicomWebPage"));
const RadiomicsPage = lazy(() => import("../pages/dicom/RadiomicsPage"));
const FusionPage = lazy(() => import("../pages/dicom/FusionPage"));
const FusionV2Page = lazy(() => import("../pages/dicom/FusionV2Page"));
const VolumeViewerPage = lazy(() => import("../pages/dicom/VolumeViewerPage"));
const SegmentationPage = lazy(() => import("../pages/dicom/SegmentationPage")); // [v3.0.6.11-62] 3D 分割与定量
// [v3.0.6.11-101 Wave 2B] 病理切片 WSI 浏览与标注
const WsiViewerPage = lazy(() => import("../pages/imaging/WsiViewerPage"));
const TerminologyServerPage = lazy(
  () => import("../pages/clinical/TerminologyServerPage"),
);
const ReportTemplateManagerPage = lazy(
  () => import("../pages/reports/ReportTemplateManagerPage"),
);
const IheIntegrationPage = lazy(
  () => import("../pages/integration/IheIntegrationPage"),
);
const PixPage = lazy(() => import("../pages/ihe/PixPage"));
const FhirBulkExportPage = lazy(
  () => import("../pages/integration/FhirBulkExportPage"),
);
const FhirBulkExportDetailPage = lazy(
  () => import("../pages/integration/FhirBulkExportDetailPage"),
);
const PamPage = lazy(() => import("../pages/ihe/PamPage"));
const VisitPage = lazy(() => import("../pages/ihe/VisitPage"));
const VisitDetailPage = lazy(() => import("../pages/ihe/VisitDetailPage"));
const TeleConferencePage = lazy(
  () => import("../pages/tele/TeleConferencePage"),
);
const AiFusionWorkspacePage = lazy(
  () => import("../pages/ai/AiFusionWorkspacePage"),
);
const AiCadPage = lazy(() => import("../pages/ai/AiCadPage"));
const AiDraftPage = lazy(() => import("../pages/ai/AiDraftPage"));
const AiRadsPage = lazy(() => import("../pages/ai/AiRadsPage"));
const AiReviewPage = lazy(() => import("../pages/ai/AiReviewPage"));
// [v3.0.6.11-101 Wave 3C] AI 增强工作台: 多器官检出 + 草稿评分 + 智能挂片
const AiEnhancedPage = lazy(() => import("../pages/ai/AiEnhancedPage"));
const AiProvidersPage = lazy(() => import("../pages/ai/AiProvidersPage"));
const ClinicalCalculatorHubPage = lazy(
  () => import("../pages/clinical/ClinicalCalculatorHubPage"),
);
const ConsentEducationPage = lazy(
  () => import("../pages/consent/ConsentEducationPage"),
);
const PatientSafetyDashboardPage = lazy(
  () => import("../pages/safety/PatientSafetyDashboardPage"),
);
const DentalCadPage = lazy(() => import("../pages/dental/DentalCadPage"));
const DentalImplant3DPage = lazy(
  () => import("../pages/dental/DentalImplant3DPage"),
);
const DentalGuidePage = lazy(() => import("../pages/dental/DentalGuidePage"));
const DentalCephPage = lazy(() => import("../pages/dental/DentalCephPage"));
const DentalAlignerPage = lazy(
  () => import("../pages/dental/DentalAlignerPage"),
);
const DentalVolumeViewerPage = lazy(
  () => import("../pages/dental/DentalVolumeViewerPage"),
);
const DentalEmrPage = lazy(() => import("../pages/dental/DentalEmrPage"));
const DentalBillingPage = lazy(
  () => import("../pages/dental/DentalBillingPage"),
);
const DentalSchedulePage = lazy(
  () => import("../pages/dental/DentalSchedulePage"),
);
const DentalPhotoPage = lazy(() => import("../pages/dental/DentalPhotoPage"));
const DentalStudiesPage = lazy(
  () => import("../pages/dental/DentalStudiesPage"),
);
const DentalViewerPage = lazy(() => import("../pages/dental/DentalViewerPage"));
const Scan3DViewerPage = lazy(() => import("../pages/dental/Scan3DViewerPage"));
const PanoramicAnnotatorPage = lazy(
  () => import("../pages/dental/PanoramicAnnotatorPage"),
);
const MprViewerPage = lazy(() => import("../pages/dental/MprViewerPage"));
const DentalAiOnnxPage = lazy(() => import("../pages/dental/DentalAiOnnxPage"));
const CrossSpecialtyReferralPage = lazy(() =>
  import("../pages/dental/DentalRadFusionPages").then((m) => ({
    default: m.CrossSpecialtyReferralPage,
  })),
);
const CBCTUnifiedReportPage = lazy(() =>
  import("../pages/dental/DentalRadFusionPages").then((m) => ({
    default: m.CBCTUnifiedReportPage,
  })),
);
const DentalRadFusionPage = lazy(() =>
  import("../pages/dental/DentalRadFusionPages").then((m) => ({
    default: m.DentalRadFusionPage,
  })),
);
const OctViewerPage = lazy(() => import("../pages/eye/pacs/OctViewerPage"));
const IolCalculatorPage = lazy(
  () => import("../pages/eye/ris/IolCalculatorPage"),
);
const VisionExamPage = lazy(() => import("../pages/eye/ris/VisionExamPage"));
const IntraocularPressurePage = lazy(
  () => import("../pages/eye/ris/IntraocularPressurePage"),
);
const FundusViewerPage = lazy(
  () => import("../pages/eye/pacs/FundusViewerPage"),
);
const OctAngiographyPage = lazy(
  () => import("../pages/eye/pacs/OctAngiographyPage"),
);
const VisualFieldPage = lazy(() => import("../pages/eye/pacs/VisualFieldPage"));
const TopographyPage = lazy(() => import("../pages/eye/pacs/TopographyPage"));
const FfaViewerPage = lazy(() => import("../pages/eye/pacs/FfaViewerPage"));
const ImageComparePage = lazy(
  () => import("../pages/eye/pacs/ImageComparePage"),
);
const MontagePage = lazy(() => import("../pages/eye/pacs/MontagePage"));
const EyeRisPage = lazy(() => import("../pages/eye/ris/EyeRisPage"));
const EyeEmrPage = lazy(() => import("../pages/eye/emr/EyeEmrPage"));
const EyeAiPage = lazy(() => import("../pages/eye/ai/EyeAiPage"));
const EyeReportWritePage = lazy(
  () => import("../pages/eye/report/EyeReportWritePage"),
);
const EyeKpiDashboardPage = lazy(
  () => import("../pages/eye/EyeKpiDashboardPage"),
);
const TeachLecturePage = lazy(() => import("../pages/teach/TeachLecturePage"));
// [G005 v3.0.6.11-103 Wave 18] PACS 对标新增 (第二批): 教学病例库 + 科研数据导出中心 + 设备调度甘特图 V2
const TeachingCaseLibraryPage = lazy(
  () => import("../pages/teach/TeachingCaseLibraryPage"),
);
const ResearchExportCenterPage = lazy(
  () => import("../pages/research/ResearchExportCenterPage"),
);
const DeviceScheduleGanttPage = lazy(
  () => import("../pages/device/DeviceScheduleGanttPage"),
);
const RadPathTrackerPage = lazy(
  () => import("../pages/radpath/RadPathTrackerPage"),
);
const RadPathDetailPage = lazy(
  () => import("../pages/radpath/RadPathDetailPage"),
);
const TriagePage = lazy(() => import("../pages/triage/TriagePage"));
const TriageDashboardPage = lazy(
  () => import("../pages/triage/TriageDashboardPage"),
);
const SnomedEncoderPage = lazy(
  () => import("../pages/snomed/SnomedEncoderPage"),
);
const OrchestratorPage = lazy(
  () => import("../pages/workflow/OrchestratorPage"),
);

// [v3.0.6.11-40] A9-A14 后端模块对接路由
const LungCadPage = lazy(() => import("../pages/ai/LungCadPage"));
const BreastCadPage = lazy(() => import("../pages/ai/BreastCadPage"));
const FractureCadPage = lazy(() => import("../pages/ai/FractureCadPage"));
const CardiacAiPage = lazy(() => import("../pages/ai/CardiacAiPage"));
const WadoRsPage = lazy(() => import("../pages/dicom/WadoRsPage"));
const StowRsPage = lazy(() => import("../pages/dicom/StowRsPage"));
const SrReportPage = lazy(() => import("../pages/dicom/SrReportPage"));
const CriticalAlertPage = lazy(
  () => import("../pages/critical/CriticalAlertPage"),
);
const AutoCollectionPage = lazy(
  () => import("../pages/operations/AutoCollectionPage"),
);
// [v3.0.6.11-103 Wave 4B] 急诊通道管理
const EmergencyChannelPage = lazy(
  () => import("../pages/operations/EmergencyChannelPage"),
);
// [v3.0.6.11-104 Wave 3C] 临床反馈闭环
const ClinicalFeedbackPage = lazy(
  () => import("../pages/ClinicalFeedbackPage"),
);
const DeptDashboardPageV2 = lazy(
  () => import("../pages/department/DeptDashboardPage"),
);
const RemoteReadingPage = lazy(
  () => import("../pages/department/RemoteReadingPage"),
);
const PacsAdminPage = lazy(() => import("../pages/admin/PacsAdminPage"));

// [Sprint 4] F13 AI Marketplace
const AiMarketplacePage = lazy(() => import("../pages/ai/AiMarketplacePage"));
// [Sprint 4] F14 Cross-Modal Search
const CrossModalSearchPage = lazy(
  () => import("../pages/dicom/CrossModalSearchPage"),
);
// [v3.0.6.11-60] G005 相似病例检索 (对标 Siemens Similar Patient Search)
const SimilarCasePage = lazy(() => import("../pages/case/SimilarCasePage"));
// [Sprint 4] F15 Dual Read Workflow
const DualReadPage = lazy(() => import("../pages/review/DualReadPage"));
// [Sprint 4] F16 Tele-Sign
const TeleSignPage = lazy(() => import("../pages/tele/TeleSignPage"));

// [v3.0.6.11-101 Wave 7C] 报告 V2: AI 二次检出 V2 + 委员会会诊 V2 + 报告互评 (三面板一页三 Tab)
const ReportV2Page = lazy(() => import("../pages/report-v2/ReportV2Page"));

// [v3.0.6.11-101 Wave 3A] 多平面重建 V2 工作室 (MPR 三平面联动 + VR + CPR + 切割)
const VolumeStudioPage = lazy(
  () => import("../pages/imaging/VolumeStudioPage"),
);
// [v3.0.6.11-41] A11-A13 PACS 对标补齐
const ThirdPartyAiPage = lazy(() => import("../pages/ai/ThirdPartyAiPage"));
const MprPage = lazy(() => import("../pages/dicom/MprPage"));
const MipPage = lazy(() => import("../pages/dicom/MipPage"));
const VrPage = lazy(() => import("../pages/dicom/VrPage"));
const LesionTrackingPage = lazy(() => import("../pages/dicom/LesionTrackingPage")); // [v3.0.6.11-99 Wave 4A] 病灶追踪
const PostProcessingPage = lazy(
  () => import("../pages/dicom/PostProcessingPage"),
);
const DbtPage = lazy(() => import("../pages/dicom/DbtPage"));
// [v3.0.6.11-60] Auto-hanging 自动布局协议管理
const HangingProtocolPage = lazy(
  () => import("../pages/dicom/HangingProtocolPage"),
);
const DlDenoisePage = lazy(() => import("../pages/ai/DlDenoisePage"));

// [Sprint 4] F17 Smart Route
const SmartRoutePage = lazy(() => import("../pages/workflow/SmartRoutePage"));
// [Sprint 4] F18 HL7 SIU
const Hl7SiuPage = lazy(() => import("../pages/integration/Hl7SiuPage"));

// [v3.0.6.11-41] A11-A13 PACS 对标补齐: AI + DICOM + 专科
// (ThirdPartyAiPage, MprPage, MipPage, VrPage, PostProcessingPage, DbtPage, DlDenoisePage 已在上方声明)

// [audit-fix-2026-07-28] 后端端点补齐: FHIR/DICOM/Fusion/Radiomics/IHE/HL7 前端页面
const FhirPatientPage = lazy(() => import("../pages/fhir/FhirPatientPage"));
const FhirObservationPage = lazy(
  () => import("../pages/fhir/FhirObservationPage"),
);
const FhirSubscriptionPage = lazy(
  () => import("../pages/fhir/FhirSubscriptionPage"),
);
const FhirDiagnosticReportPage = lazy(
  () => import("../pages/fhir/FhirDiagnosticReportPage"),
);
const FhirImagingStudyPage = lazy(
  () => import("../pages/fhir/FhirImagingStudyPage"),
);
const DicomDimsePage = lazy(() => import("../pages/dicom/DicomDimsePage"));
const DicomSrTemplatePage = lazy(
  () => import("../pages/dicom/DicomSrTemplatePage"),
);
const FusionManagerPage = lazy(
  () => import("../pages/fusion/FusionManagerPage"),
);
const RadiomicsFeaturePage = lazy(
  () => import("../pages/radiomics/RadiomicsFeaturePage"),
);
const IheManagerPage = lazy(() => import("../pages/ihe/IheManagerPage"));
const Hl7ManagerPage = lazy(() => import("../pages/hl7/Hl7ManagerPage"));

// 从 sidebarConfig 构建 path -> roles 映射
const ALL_ROLES: ReadonlyArray<Role> = [
  "医生",
  "技师",
  "护士",
  "管理员",
  "主任",
];
const roleMap: Record<string, ReadonlyArray<Role>> = {};
SIDEBAR_ITEMS.forEach((section) => {
  section.items.forEach((item) => {
    roleMap[item.path] = item.roles;
  });
});

// 路由表中存在但未在 sidebarConfig 列出的路径(由各页面的合理角色手动补全)
const extraRoleMap: Record<string, ReadonlyArray<Role>> = {
  "/": ALL_ROLES, // 首页所有已登录角色可访问
  "/dicom-viewer-classic": roleMap["/dicom-viewer"] ?? ALL_ROLES, // 经典DICOM浏览器,同 /dicom-viewer
  "/ai-orchestration": roleMap["/ai-assist"] ?? ALL_ROLES, // AI 编排,同 /ai-assist
  "/regional-imaging": roleMap["/regional-report"] ?? ALL_ROLES, // 区域影像,管理员专享
  "/integration/mllp-monitor":
    roleMap["/integration/ihe-connectathon"] ?? ALL_ROLES, // MLLP 监控,管理员专享
  "/patients/:id": roleMap["/patients"] ?? ALL_ROLES,
  // [v3.0.6.11-96 Wave 3A P1] 检查执行详情独立页, 同 /exams 角色
  "/exam/:id": roleMap["/exams"] ?? ALL_ROLES,
  "/template-designer/:id": roleMap["/template-designer"] ?? ALL_ROLES,
  "/research": ["医生", "主任", "管理员"],
  // [G005 v3.0.6.11-103 Wave 18] 科研数据导出中心
  "/research/export-center": ["医生", "主任", "管理员"],
  // [G005 v3.0.6.11-103 Wave 18] 教学病例库 (TeachingCaseService 后端 Roles: DOCTOR/TECHNICIAN/ADMIN/DIRECTOR)
  "/teach/case-library": ["医生", "主任", "技师", "管理员"],
  // [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2
  "/ops/device-gantt": ["主任", "管理员", "技师"],
  "/director-dashboard": ["主任", "管理员"],
  "/mammo/operations": ["主任", "管理员"],
  "/mammo/quality": ["主任", "管理员"],
  "/workbench": ALL_ROLES,
  "/triage/worklist": ["医生", "主任", "管理员"],
  "/triage/dashboard": ["医生", "主任", "管理员"],
  "/eye": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/viewer": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/real-viewer": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-34] PR 1
  "/eye/ai-report": ["医生", "主任", "管理员"], // [v3.0.6.8-35] PR 2
  "/eye/toric-planner": ["医生", "主任", "管理员"], // [v3.0.6.8-36] PR 3
  "/eye/sub/strabismus": ["医生", "主任", "管理员"], // [v3.0.6.8-37] PR 4
  "/eye/sub/neuro": ["医生", "主任", "管理员"],
  "/eye/sub/oncology": ["医生", "主任", "管理员"],
  "/eye/sub/cornea": ["医生", "主任", "管理员"],
  "/eye/sub/contact-lens": ["医生", "主任", "管理员"],
  "/eye/sub/low-vision": ["医生", "主任", "管理员"],
  "/eye/sub/cataract": ["医生", "主任", "管理员"], // [v3.0.6.8-83] PR 4 补齐
  "/eye/sub/refractive": ["医生", "主任", "管理员"], // [v3.0.6.8-83] PR 4 补齐
  "/eye/tele": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-41] PR 8
  "/eye/case-library": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-42] PR 9
  "/eye/optometry-loop": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-44] PR 11
  "/report-workflow": ["医生", "主任", "管理员"], // [v3.0.6.8-45] PR 1
  "/patient-device-mgmt": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-46] PR 2
  "/notif-tpl-dict": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-47] PR 3
  "/review-check": ["医生", "主任", "管理员"], // [v3.0.6.8-48] PR 4
  "/sign-amend": ["医生", "主任", "管理员"], // [v3.0.6.8-49] PR 5
  "/v3-report-hub": ["医生", "主任", "管理员"], // [v3.0.6.8-50] PR 6
  "/materials": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-51] PR 7,
  "/eye/pacs/oct": ["医生", "主任", "技师", "管理员"],
  "/eye/ris/iol-calculator": ["医生", "主任", "管理员"],
  "/eye/ris/va": ["医生", "技师", "管理员"],
  "/eye/ris/iop": ["医生", "技师", "管理员"],
  "/eye/pacs/fundus": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/oct-a": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/visual-field": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/topography": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/ffa": ["医生", "主任", "技师", "管理员"],
  "/eye/pacs/compare": ["医生", "主任", "管理员"],
  "/eye/pacs/montage": ["医生", "技师", "管理员"],
  "/eye/ris": ["医生", "技师", "护士", "管理员"],
  "/eye/emr": ["医生", "主任", "管理员"],
  "/eye/ai": ["医生", "主任", "管理员"],
  "/dental/chart": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-53]
  "/dental/ai": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-53]
  "/dental": ["医生", "主任", "技师", "管理员"],
  "/dental/treatment": ["医生", "主任", "管理员"],
  "/dental/implant": ["医生", "主任", "管理员"],
  "/dental/ortho": ["医生", "主任", "管理员"],
  "/dental/endo": ["医生", "主任", "管理员"],
  "/dental/perio": ["医生", "主任", "管理员"],
  "/dental/restorative": ["医生", "主任", "管理员"],
  "/dental/surgery": ["医生", "主任", "技师", "管理员"],
  "/dental/pediatric": ["医生", "主任", "技师", "管理员"],
  "/tele/conference": ["医生", "主任", "技师", "管理员"],
  "/dental/tele": ["医生", "主任", "管理员"],
  "/dental/inventory": ["医生", "主任", "技师", "管理员"],
  "/dental/dashboard": ["主任", "管理员"],
  "/dental/studies": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-54]
  "/dental/viewer": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-54]
  "/dental/viewer/scan-3d": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-55]
  "/dental/annotate": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-55]
  "/dental/viewer/mpr": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-56]
  "/dental/ai-onnx": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-56]
  "/dental/referral": ["医生", "主任", "管理员"], // [v3.0.6.8-59]
  "/dental/cbct-report": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-59]
  "/dental/rad-fusion": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-59]
  "/dental/cad": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-87] Phase 1: 修复CAD
  "/dental/implant-3d": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-88] Phase 1: 种植3D
  "/dental/guide": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-89] Phase 1: 导板+上部
  "/dental/ceph": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-90] Phase 2: 头影测量
  "/dental/aligner": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-92] Phase 2: 隐形矫治
  "/dental/volume-viewer": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-93] Phase 3: 体渲染
  "/dental/patient-view": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-94] Phase 4: 360° 患者视图
  "/dental/billing": ["医生", "主任", "管理员", "护士"], // [v3.0.6.8-95] Phase 4: 收费/划价/医保
  "/export/approval": ["医生", "主任", "管理员"], // [W1-5] 导出审批中心
  "/dental/schedule": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-96] Phase 4: 排班+PSR
  "/dental/photo": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-98] Phase 5: 口内照片
  "/emr-templates": ["医生", "主任", "管理员"], // [v3.0.6.8-63]
  "/system-admin": ["管理员"], // [v3.0.6.8-64]
  "/user/center": ALL_ROLES, // [v3.0.6.11-79] W1-B 用户中心
  // [v3.0.6.11-100 Wave 2A] 委员会会诊室 (审核组, 同 review-center 角色)
  "/committee-room": roleMap["/review-center"] ?? ["主任", "管理员"],
  "/treatment-plans": ["医生", "主任", "管理员"], // [v3.0.6.8-65]
  "/patient-unified": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-66]
  "/patients/:id/360": ["医生", "主任", "技师", "护士", "管理员"],
  "/command-center": ["主任", "管理员"], // [v3.0.6.8-67]
  "/operations/occupancy": ["主任", "管理员", "技师"], // [v3.0.6.11-17]
  "/dicom-viewer-pro": ["医生", "技师", "主任", "管理员"], // DicomViewerPro
  "/dicom-share": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-68]
  "/scheduling-center": ["主任", "管理员", "技师"], // [v3.0.6.8-69]
  "/operations/oee": ["主任", "管理员", "技师"],
  "/clinical-pathways": ["医生", "主任", "管理员", "护士"], // [v3.0.6.8-70]
  "/audit-compliance": ["主任", "管理员"], // [v3.0.6.8-71]
  "/compliance-docs": ["主任", "管理员"], // [v3.0.6.11-79 W1-C] 合规文档库
  "/dicom-sr-manager": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-72]
  "/dicom/web": ["医生", "主任", "技师", "管理员"],
  "/dicom/fusion": ["医生", "主任", "技师", "管理员"], // [v3.0.6.11-18] PET-CT/MR fusion
  "/dicom/fusion-v2": ["医生", "主任", "技师", "管理员"], // [v3.0.6.11-22] Multi-modal fusion V2
  "/dicom/volume-viewer": ["医生", "主任", "技师", "管理员"], // [v3.0.6.11-18] 3D Volume Rendering
  "/dicom/segmentation": ["医生", "主任", "技师", "管理员"], // [v3.0.6.11-62] 3D 分割与定量
  // [v3.0.6.11-101 Wave 2B] 病理切片 WSI 浏览与标注
  "/pathology/wsi-viewer": ["医生", "主任", "技师", "管理员"],
  "/dicom/mpr": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-41] MPR
  "/dicom/mip": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-41] MIP
  "/dicom/vr": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-41] VR
  // [v3.0.6.11-101 Wave 3A] 多平面重建 V2 工作室
  "/dicom/volume-studio": ["医生", "技师", "主任", "管理员"],
  "/dicom/post-processing": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-41] Post-Processing
  "/dicom/dbt": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-41] DBT
  "/dicom/hanging-protocols": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-60] Auto-hanging 自动布局
  "/terminology-server": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-73]
  "/report-templates": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-74]
  "/ihe-integration": ["主任", "管理员", "技师"], // [v3.0.6.8-75]
  "/ai-fusion-workspace": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-76]
  "/ai-cad": ["医生", "主任", "技师", "管理员"],
  "/ai-draft": ["医生", "主任", "管理员"],
  "/clinical-calculators": ["医生", "主任", "技师", "护士", "管理员"], // [v3.0.6.8-78]
  "/consent-education": ["医生", "主任", "技师", "护士", "管理员"], // [v3.0.6.8-79]
  "/clinical-feedback": ["医生", "主任", "技师", "护士", "管理员"], // [v3.0.6.11-104 Wave 3C]
  "/patient-safety": ["主任", "管理员", "护士"], // [v3.0.6.8-80]
  "/eye/report-write": ["医生", "主任", "管理员"],
  "/eye/kpi-dashboard": ["主任", "管理员"],
  "/radpath/tracker": ["医生", "主任", "管理员"],
  "/radpath/detail/:reportId": ["医生", "主任", "管理员"],
  "/analytics/benchmark-v2": ["主任", "管理员"],
  "/analytics/benchmark-ai-diagnosis": ["主任", "管理员"],
  "/analytics/tat-dashboard": ["主任", "管理员", "医生"],
  "/admin/config": ["管理员"],
  "/ihe/pam": ["主任", "管理员", "技师"],
  "/ihe/visit": ["医生", "主任", "技师", "管理员"],
  "/ihe/visit-detail/:patientId/:visitNumber": [
    "医生",
    "主任",
    "技师",
    "管理员",
  ],
  "/ihe/pix": ["主任", "管理员", "技师"],
  "/integration/fhir/bulk-export": ["主任", "管理员", "技师"],
  "/integration/fhir/bulk-export-detail": ["主任", "管理员", "技师"],
  "/integration/hl7-archive": ["技师", "管理员"],
  "/integration/hl7-builder": ["技师", "管理员"],
  "/integration/mllp-config": ["管理员"],
  "/integration/smart-auth": ["管理员", "主任"], // [G005 W2] FHIR SMART 授权流程
  "/integration/dimse": ["技师", "管理员", "医生", "主任"],
  "/integration/dimse/upload": ["技师", "管理员"],
  // [v3.0.6.11-21] 新页面路由角色映射
  "/security/mfa-setup": ["管理员", "主任", "医生", "技师", "护士"],
  "/system/audit": ["管理员"],
  "/system/backup": ["管理员"],
  "/system/tenant-config": ["管理员"],
  "/system/compliance": ["管理员", "主任"],
  "/system/files": ["管理员", "主任"], // [W1-A v3.0.6.11-79] 文件管理
  // [v3.0.6.11-103 Wave 4B] 急诊通道管理 (后端 Roles: ADMIN/DIRECTOR/DOCTOR)
  "/emergency-channel": ["管理员", "主任", "医生"],
  "/dicom/radiomics": ["医生", "主任", "管理员"],
  "/dicom/lesion-tracking": ["医生", "技师", "主任", "管理员"], // [v3.0.6.11-99 Wave 4A] 病灶追踪
  "/dicom/compress": ["医生", "技师", "主任", "管理员"],
  "/dicom/sr-manager": ["医生", "技师", "主任", "管理员"],
  "/orchestrator": ["管理员", "主任"],
  "/nlp/spellcheck": ["医生", "主任", "管理员"],
  "/asr/transcribe": ["医生", "主任", "管理员"],
  // [v3.0.6.11-100 Wave 4A] 新页面路由角色映射
  "/report/custom": ["主任", "管理员"],
  "/voice/workstation": ["医生", "主任", "管理员"],
  "/mobile/approval": ["主任", "管理员"],
  "/snomed/encode": ["医生", "主任", "管理员"],
  "/snomed/encoder": ["医生", "主任", "管理员"],
  "/cds/rule-config": ["主任", "管理员"],
  // [G005 W2-B] CDS 指南库 / 告警中心 / 剂量监测
  "/cds/guidelines": ["医生", "主任", "管理员"],
  "/cds/alerts": ["医生", "主任", "管理员"],
  "/cds/dose-monitoring": ["主任", "管理员", "技师"],
  "/rdsr": ["技师", "管理员", "主任"],
  // [Sprint 4] F13-F18 角色映射
  "/ai-marketplace": ["医生", "主任", "管理员"],
  "/ai/review": ["医生", "主任", "管理员"],
  "/ai/providers": ["管理员"],
  "/cross-modal-search": ["医生", "主任", "技师", "管理员"],
  "/similar-case": ["医生", "主任", "技师", "管理员"],
  "/dual-read": ["医生", "主任", "管理员"],
  "/tele-sign": ["医生", "主任", "管理员"],
  "/smart-route": ["管理员"],
  "/hl7-siu": ["技师", "管理员"],
  "/dicom/4d": ["医生", "技师", "主任", "管理员"],
  // [audit-fix-2026-07-28] 后端端点补齐路由角色映射
  "/fhir/patient": ["医生", "技师", "主任", "管理员"],
  "/fhir/observation": ["医生", "技师", "主任", "管理员"],
  "/fhir/diagnostic-report": ["医生", "技师", "主任", "管理员"],
  "/fhir/imaging-study": ["医生", "技师", "主任", "管理员"],
  "/fhir/subscription": ["管理员"],
  "/dicom/dimse": ["技师", "管理员", "医生", "主任"],
  "/dicom/sr-templates": ["医生", "技师", "主任", "管理员"],
  "/fusion/manager": ["医生", "技师", "主任", "管理员"],
  "/radiomics/features": ["医生", "主任", "管理员"],
  "/ihe/manager": ["主任", "管理员", "技师"],
  "/hl7/manager": ["技师", "管理员"],
  // [workflow-gap] 7项缺失功能补齐路由角色映射
  "/smart-mwl": ["医生", "技师", "主任", "管理员"],
  "/ai-triage": ["医生", "主任", "管理员"],
  "/smart-routing": ["管理员", "主任"],
  "/cosign-review": ["医生", "主任", "管理员"],
  "/radpath": ["医生", "主任", "管理员"],
  "/critical-value-5step": ["医生", "主任", "管理员", "护士"],
  // [v3.0.6.11-40] A9-A14 后端模块对接路由角色映射
  "/ai/lung-cad": ["医生", "主任", "技师", "管理员"],
  "/ai/breast-cad": ["医生", "主任", "技师", "管理员"],
  "/ai/fracture-cad": ["医生", "主任", "技师", "管理员"],
  "/ai/cardiac-ai": ["医生", "主任", "技师", "管理员"],
  "/ai/third-party": ["管理员"],
  "/ai/dl-denoise": ["医生", "主任", "技师", "管理员"],
  "/dicom/wado-rs": ["医生", "技师", "主任", "管理员"],
  "/dicom/stow-rs": ["技师", "管理员"],
  "/dicom/sr-report": ["医生", "技师", "主任", "管理员"],
  "/critical-alert": ["医生", "主任", "管理员", "护士"],
  // [v3.0.6.11-79] W2-A 危急值接收端门户
  "/critical-value-receiver": ["医生", "主任", "管理员", "护士"],
  "/auto-collection": ["管理员"],
  "/dept-dashboard": ["主任", "管理员"],
  "/remote-reading": ["医生", "主任", "管理员"],
  "/pacs-admin": ["管理员"],
  // [v3.0.6.11-40] A15 专科模块路由角色映射
  "/mammo/breast-specialty": ["医生", "主任", "管理员"],
  "/cardiac/cardiac-specialty": ["医生", "主任", "管理员"],
  // [v3.0.6.11-88] Wave6A 血管分析工作台
  "/cardiac/vessel-analysis": ["医生", "主任", "管理员"],
  // [v3.0.6.11-88] Wave6A 科室 KPI 墙屏
  "/ops/kpi-wall": ["主任", "管理员"],
  // [v3.0.6.11-99 Wave 6B (tech-schedule)] 技师排班管理
  "/ops/tech-schedule": ["主任", "管理员", "技师"],
  // [v3.0.6.11-101 Wave 4B (tech-ops)] 技师工作站 V2
  "/ops/tech-ops": ["主任", "管理员", "技师"],
  // [v3.0.6.11-100 Wave 1A] 技师 KPI 看板
  "/tech/kpi": ["主任", "管理员", "技师"],
  // [v3.0.6.11-101 Wave 4A] 技师工作站 V2: 双检间轮转 + 工作量预测
  "/tech/rotation": ["主任", "管理员", "技师"],
  // [v3.0.6.11-101 Wave 5] 技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏
  "/tech/overview": ["主任", "管理员", "技师"],
  // [v3.0.6.11-103 Wave 11] 技师工作站: 端到端应用流程贯通
  "/tech/workbench": ["主任", "管理员", "技师"],
  "/ortho-specialty": ["医生", "主任", "管理员"],
  "/neuro-specialty": ["医生", "主任", "管理员"],
};

function rolesFor(path: string): ReadonlyArray<Role> | undefined {
  if (path === "*") return undefined;
  return extraRoleMap[path] ?? roleMap[path] ?? ALL_ROLES;
}

const wrapped = (path: string, element: React.ReactNode): RouteObject => ({
  path,
  element: React.createElement(
    RequireAuth as React.ComponentType<{
      roles?: readonly string[];
      children?: React.ReactNode;
    }>,
    { roles: rolesFor(path) ? [...rolesFor(path)!] : undefined },
    element,
  ),
});

export const routes: RouteObject[] = [
  // 无需鉴权的路由
  { path: "/login", element: React.createElement(LoginPage) },
  { path: "/forbidden", element: React.createElement(ForbiddenPage) },
  // 受 RBAC 保护的业务路由
  wrapped("/", React.createElement(HomePage)),
  wrapped("/workbench", React.createElement(HomePage)),
  wrapped("/worklist", React.createElement(WorklistPage)), // [audit-fix-2026-07-02]
  wrapped("/patients", React.createElement(PatientPage)),
  wrapped("/patients/:id", React.createElement(PatientPage)),
  wrapped("/patients/:id/360", React.createElement(Patient360Page)),
  wrapped("/exams", React.createElement(ExamPage)),
  // [v3.0.6.11-96 Wave 3A P1] 检查执行详情独立页 (行"详情"按钮 /exam/:id 跳转可达)
  wrapped("/exam/:id", React.createElement(ExamDetailPage)),
  wrapped("/reports", React.createElement(ReportPage)),
  // [v3.0.6.11-99 Wave7B] 离线报告包 (IndexedDB 快照浏览/管理; 断网可用)
  wrapped("/reports/offline", React.createElement(OfflineReportsPage)),
  wrapped("/write-report", React.createElement(ReportWritePage)),
  wrapped("/report/write", React.createElement(ReportWritePage)), // [v3.0.6.11-92 Wave1B P0] 移动端医生工作台 /report/write 目标路由
  wrapped("/reports/v3-write", React.createElement(ReportWritePage)),
  wrapped("/statistics", React.createElement(StatisticsPage)),
  wrapped("/critical-value", React.createElement(CriticalValuePage)),
  wrapped("/term-library", React.createElement(TermLibraryPage)),
  wrapped("/devices", React.createElement(DevicePage)),
  wrapped("/consultation", React.createElement(ConsultationPage)),
  wrapped("/qc", React.createElement(QCPage)),
  wrapped("/appointments", React.createElement(AppointmentPage)),
  wrapped("/dose-track", React.createElement(DoseTrackPage)),
  wrapped("/queue-call", React.createElement(QueueCallPage)),
  wrapped("/dicom-viewer-classic", React.createElement(DicomViewerClassicPage)),
  wrapped("/dicom-viewer", React.createElement(DicomViewerProPage)),
  wrapped("/dicom-viewer-pro", React.createElement(DicomViewerProPage)),
  wrapped("/typical-cases", React.createElement(TypicalCasesPage)),
  wrapped("/finding-library", React.createElement(FindingLibraryPage)),
  wrapped("/operation-log", React.createElement(OperationLogPage)),
  wrapped("/notification-center", React.createElement(NotificationCenter)),
  wrapped("/schedule", React.createElement(SchedulePage)),
  wrapped("/department", React.createElement(DepartmentPage)),
  wrapped("/print-management", React.createElement(PrintManagementPage)),
  wrapped("/regional-report", React.createElement(RegionalReportPage)),
  wrapped("/ai-assist", React.createElement(AIAssistPage)),
  wrapped("/ai-orchestration", React.createElement(AIOrchestrationPage)),
  wrapped("/cost-analysis", React.createElement(CostAnalysisPage)),
  wrapped("/equipment-lifecycle", React.createElement(EquipmentLifecyclePage)),
  wrapped("/follow-up", React.createElement(FollowUpPage)),
  wrapped("/cancer-screen", React.createElement(CancerScreenPage)),
  wrapped("/national-report", React.createElement(NationalReportPage)),
  wrapped("/insurance-audit", React.createElement(InsuranceAuditPage)),
  wrapped("/data-report-center", React.createElement(DataReportCenterPage)),
  wrapped("/dictionary", React.createElement(DictionaryPage)),
  wrapped("/operations-center", React.createElement(OperationsCenterPage)),
  wrapped(
    "/department-dashboard",
    React.createElement(DepartmentDashboardPage),
  ),
  wrapped("/stats-report", React.createElement(StatsReportPage)),
  wrapped("/clinical-data", React.createElement(ClinicalDataPage)),
  wrapped("/template-management", React.createElement(TemplateManagementPage)),
  wrapped("/template-designer", React.createElement(TemplateDesignerPage)),
  wrapped("/template-designer/:id", React.createElement(TemplateDesignerPage)),
  wrapped(
    "/template-inheritance",
    React.createElement(TemplateInheritancePage),
  ),
  wrapped("/template-category", React.createElement(TemplateCategoryPage)),
  wrapped("/report-review", React.createElement(ReportReviewPage)),
  wrapped("/report-revisions", React.createElement(ReportRevisionsPage)),
  wrapped("/collaboration", React.createElement(CollaborationPage)),
  // [v3.0.6.11-100 Wave 2A] 委员会会诊室 (多医生合议, 支持 ?reportId= 直达)
  wrapped("/committee-room", React.createElement(CommitteeRoomPage)),
  wrapped("/keyword-check", React.createElement(KeywordCheckPage)),
  wrapped("/report-score-rule", React.createElement(ReportScoreRulePage)),
  wrapped(
    "/report-defect-library",
    React.createElement(ReportDefectLibraryPage),
  ),
  wrapped("/ai-report-draft", React.createElement(AIReportDraftPage)),
  wrapped("/critical-value-rule", React.createElement(CriticalValueRulePage)),
  wrapped("/critical-value-stats", React.createElement(CriticalValueStatsPage)),
  wrapped("/special-assessment", React.createElement(SpecialAssessmentPages)),
  wrapped("/report-export", React.createElement(ReportExportPage)),
  wrapped("/export/approval", React.createElement(ExportApprovalPage)), // [W1-5] 导出审批中心
  wrapped("/report-delivery", React.createElement(ReportDeliveryPage)),
  wrapped("/publish", React.createElement(PublishPage)),
  wrapped(
    "/patient-report-portal",
    React.createElement(PatientReportPortalPage),
  ),
  wrapped("/ca-signature", React.createElement(CASignaturePage)),
  wrapped("/blockchain-proof", React.createElement(BlockchainProofPage)),
  wrapped(
    "/appointment-management",
    // [v3.0.6.11-103 Wave 10] 重复页合并: AppointmentManagementPage 嵌入 AppointmentPage (预约管理视图)
    React.createElement(Navigate, { to: "/appointments", replace: true }),
  ),
  // [v3.0.6.11-103 Wave 10] 重复页合并: DeviceFaultPage 嵌入 DevicePage (设备故障 Tab)
  wrapped("/device-fault", React.createElement(Navigate, { to: "/devices", replace: true })),
  wrapped("/ai-qc", React.createElement(AIQCPage)),
  wrapped("/ai-structured-report", React.createElement(AIStructuredReportPage)),
  wrapped("/ai-medical-device", React.createElement(AIMedicalDevicePage)),
  wrapped("/regional-imaging", React.createElement(RegionalImagingPage)),
  wrapped(
    "/equipment-efficiency",
    React.createElement(EquipmentEfficiencyPage),
  ),
  wrapped("/user-management", React.createElement(UserManagementPage)),
  // [v3.0.6.11-79] W1-B 用户中心 (所有已登录角色)
  wrapped("/user/center", React.createElement(UserCenterPage)),
  wrapped("/authority", React.createElement(UserManagementPage)), // [F16] 权限管理: 侧边栏 /authority 对齐
  wrapped("/admin/config", React.createElement(ClinicalConfigCenter)),
  wrapped("/patient-portal", React.createElement(PatientPortalPage)),
  wrapped("/director-dashboard", React.createElement(DirectorDashboardPage)),
  wrapped("/green-it", React.createElement(GreenITPage)),
  wrapped("/research", React.createElement(ResearchPage)),
  // [G005 v3.0.6.11-103 Wave 18] 科研数据导出中心 (数据集构建/字段选择/导出任务/统计)
  wrapped("/research/export-center", React.createElement(ResearchExportCenterPage)),
  wrapped("/nuclear-stats", React.createElement(NuclearStatsPage)),
  wrapped("/system/dicom-print", React.createElement(DicomPrintPage)),
  wrapped("/system/files", React.createElement(FileManagementPage)), // [W1-A v3.0.6.11-79] 文件管理
  wrapped("/term-synonym-graph", React.createElement(TermSynonymGraphPage)),
  wrapped("/report-phrase-bank", React.createElement(ReportPhraseBankPage)),
  wrapped("/report-kpi-dashboard", React.createElement(ReportKpiDashboardPage)),
  wrapped("/doctor-workload", React.createElement(DoctorWorkloadPage)),
  wrapped("/diagnosis-accuracy", React.createElement(DiagnosisAccuracyPage)),
  wrapped("/report-timeliness", React.createElement(ReportTimelinessPage)),
  wrapped("/report-search", React.createElement(ReportSearchPage)),
  wrapped("/charge-items", React.createElement(ChargeItemPage)),
  wrapped("/accounts-receivable", React.createElement(AccountsReceivablePage)),
  wrapped("/revenue-analysis", React.createElement(RevenueAnalysisPage)),
  wrapped("/cost-accounting", React.createElement(CostAccountingPage)),
  wrapped("/financial-reports", React.createElement(FinancialReportsPage)),
  wrapped("/business-continuity", React.createElement(BusinessContinuityPage)),
  wrapped("/cloud-storage", React.createElement(CloudStorageDashboardPage)),
  wrapped("/enterprise-search", React.createElement(EnterpriseSearchPage)),
  wrapped("/multi-site", React.createElement(MultiSiteDashboardPage)),
  // [G005 Wave 4B] 区域医联体协同中心
  wrapped(
    "/regional/collaboration",
    React.createElement(RegionalCollaborationPage),
  ),
  // [G005 Wave 4B] 影像像素实验室
  wrapped("/eye/pixel-lab", React.createElement(EyePixelPage)),
  wrapped("/vna-dashboard", React.createElement(VNADashboardPage)),
  wrapped("/safety/adverse-events", React.createElement(AdverseEventPage)),
  wrapped("/safety/cqi", React.createElement(CQIPage)),
  wrapped(
    "/safety/patient-safety-goals",
    React.createElement(PatientSafetyGoalsPage),
  ),
  wrapped("/safety/radiation-safety", React.createElement(RadiationSafetyPage)),
  wrapped("/safety/rca-analysis", React.createElement(RCAAnalysisPage)),
  wrapped("/safety/risk-management", React.createElement(RiskManagementPage)),
  wrapped(
    "/contrast/adverse-reactions",
    React.createElement(AdverseReactionPage),
  ),
  wrapped(
    "/contrast/injection-workstation",
    React.createElement(ContrastInjectionWorkstationPage),
  ),
  wrapped("/contrast/inventory", React.createElement(ContrastInventoryPage)),
  wrapped(
    "/contrast/quality-compliance",
    React.createElement(ContrastQualityCompliancePage),
  ),
  wrapped("/cardiac/database", React.createElement(CvDatabasePage)),
  wrapped("/cardiac/operations", React.createElement(CvOperationsPage)),
  wrapped("/cardiac/qc", React.createElement(CvQcPage)),
  wrapped("/ops/devices", React.createElement(DeviceOpsPage)),
  // [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2 (周视图/拖拽调整/冲突检测)
  wrapped("/ops/device-gantt", React.createElement(DeviceScheduleGanttPage)),
  wrapped("/ops/hr", React.createElement(HrOperationsPage)),
  wrapped("/ops/dashboard", React.createElement(OpsDashboardPage)),
  // [v3.0.6.11-88] Wave6A 科室 KPI 墙屏 (大屏看板)
  wrapped("/ops/kpi-wall", React.createElement(KpiWallPage)),
  // [v3.0.6.11-99 Wave 6B (tech-schedule)] 技师排班管理 -> [v3.0.6.11-103 Wave 10] 已合并入 /schedule (SchedulePage 技师排班 Tab)
  wrapped("/ops/tech-schedule", React.createElement(Navigate, { to: "/schedule", replace: true })),
  // [v3.0.6.11-101 Wave 4B (tech-ops)] 技师工作站 V2
  wrapped("/ops/tech-ops", React.createElement(TechOpsPage)),
  // [v3.0.6.11-100 Wave 1A] 技师 KPI 看板
  wrapped("/tech/kpi", React.createElement(TechnicianKpiDashboardPage)),
  // [v3.0.6.11-101 Wave 4A] 技师工作站 V2: 双检间轮转 + 工作量预测
  wrapped("/tech/rotation", React.createElement(TechRotationPage)),
  // [v3.0.6.11-101 Wave 5] 技师工作站 V2 收尾: 患者预约分布 + 技师值班大屏
  wrapped("/tech/overview", React.createElement(TechOverviewPage)),
  // [v3.0.6.11-103 Wave 11] 技师工作站: 端到端应用流程贯通
  wrapped("/tech/workbench", React.createElement(TechWorkbenchPage)),
  wrapped("/cds/management", React.createElement(CdsManagementPage)),
  wrapped("/cds/statistics", React.createElement(CdsStatisticsPage)),
  // [G005 W2-B] CDS 6 方法页面: 指南库 / 告警中心 / 剂量监测
  wrapped("/cds/guidelines", React.createElement(GuidelineLibraryPage)),
  wrapped("/cds/alerts", React.createElement(AlertCenterPage)),
  wrapped("/cds/dose-monitoring", React.createElement(CdsDoseMonitoringPage)),
  wrapped("/finance/department", React.createElement(DepartmentFinancePage)),
  wrapped("/finance/patient", React.createElement(PatientFinancePage)),
  wrapped("/mammo/operations", React.createElement(DepartmentOperationsPage)),
  wrapped("/mammo/quality", React.createElement(QualityManagementPage)),
  // [v3.0.6.11-40] A15 专科模块: 乳腺/心脏/骨科/神经
  wrapped(
    "/mammo/breast-specialty",
    React.createElement(
      lazy(() => import("../pages/mammo/BreastSpecialtyPage")),
    ),
  ),
  wrapped(
    "/cardiac/cardiac-specialty",
    React.createElement(
      lazy(() => import("../pages/cardiac/CardiacSpecialtyPage")),
    ),
  ),
  // [v3.0.6.11-88] Wave6A 血管分析工作台 (cardiac 域扩展)
  wrapped("/cardiac/vessel-analysis", React.createElement(VesselAnalysisPage)),
  wrapped(
    "/ortho-specialty",
    React.createElement(lazy(() => import("../pages/OrthoSpecialtyPage"))),
  ),
  wrapped(
    "/neuro-specialty",
    React.createElement(lazy(() => import("../pages/NeuroSpecialtyPage"))),
  ),
  wrapped("/patient/self-service", React.createElement(SelfServicePortal)),
  wrapped(
    "/patient/service-management",
    React.createElement(ServiceManagement),
  ),
  wrapped(
    "/education/patient-education",
    React.createElement(PatientEducationPage),
  ),
  wrapped("/hie/medical-alliance", React.createElement(MedicalAlliancePage)),
  wrapped("/integration/fhir-server", React.createElement(FhirServerPage)),
  wrapped(
    "/integration/ihe-connectathon",
    React.createElement(IheConnectathonPage),
  ),
  wrapped("/integration/mllp-monitor", React.createElement(MllpMonitorPage)),
  wrapped("/integration/hl7-archive", React.createElement(Hl7ArchivePage)),
  wrapped("/integration/hl7-builder", React.createElement(Hl7BuilderPage)),
  wrapped("/integration/mllp-config", React.createElement(MllpConfigPage)),
  wrapped("/integration/smart-auth", React.createElement(SmartAuthPage)),
  // [v3.0.6.11-95] W4-B P2: 旧版 /integration/dimse 重定向至新版 /dicom/dimse (DimsePage 保留标注)
  wrapped("/integration/dimse", React.createElement(Navigate, { to: "/dicom/dimse", replace: true })),
  wrapped("/integration/dimse/upload", React.createElement(DimseUploadPage)),
  wrapped("/kiosk/check-in", React.createElement(KioskCheckIn)),
  wrapped("/mobile/patient", React.createElement(PatientMobileApp)),
  wrapped("/mobile/doctor", React.createElement(DoctorMobileWorkstation)),
  wrapped("/mobile/nurse", React.createElement(NurseMobileWorkstation)),
  wrapped("/mobile/tech", React.createElement(TechMobileWorkstation)),
  wrapped("/mobile/push", React.createElement(MobilePushPage)),
  wrapped("/quality/department", React.createElement(DepartmentQualityPage)),
  wrapped("/review-center", React.createElement(ReviewCenterPage)),
  // [v3.0.6.11-103 Wave 10] 重复页合并: QualityControlPage 嵌入 QCPage (质控管理 Tab), 旧路由 redirect
  wrapped("/quality-control", React.createElement(Navigate, { to: "/qc", replace: true })),
  wrapped(
    "/critical-value-center",
    React.createElement(CriticalValueCenterPage),
  ),
  wrapped("/defect-management", React.createElement(DefectManagementPage)),
  wrapped("/cosign", React.createElement(CoSignPage)),
  wrapped("/workflow-designer", React.createElement(WorkflowDesignerPage)),
  wrapped("/routing-rules", React.createElement(RoutingRulePage)),
  wrapped("/workload-heatmap", React.createElement(WorkloadHeatmapPage)),
  wrapped("/sla-policy", React.createElement(SlaPolicyPage)),
  wrapped("/eye", React.createElement(EyeWorkspacePage)),
  wrapped("/eye/pacs", React.createElement(PacsStudyListPage)),
  wrapped("/eye/pacs/viewer", React.createElement(PacsViewerPage)),
  wrapped("/dental/chart", React.createElement(ToothChartPage)), // [v3.0.6.8-53]
  wrapped("/dental/ai", React.createElement(DentalAIPage)), // [v3.0.6.8-53]
  wrapped("/dental", React.createElement(DentalWorkspacePage)),
  wrapped("/dental/treatment", React.createElement(DentalTreatmentPage)),
  wrapped("/dental/implant", React.createElement(DentalImplantPlanPage)),
  wrapped("/dental/ortho", React.createElement(DentalOrthoPage)),
  wrapped("/dental/endo", React.createElement(DentalEndoPage)),
  wrapped("/dental/perio", React.createElement(DentalPerioPage)),
  wrapped("/dental/restorative", React.createElement(DentalRestorativePage)),
  wrapped("/dental/surgery", React.createElement(DentalSurgeryPage)),
  wrapped("/dental/pediatric", React.createElement(DentalPediatricPage)),
  wrapped("/dental/tele", React.createElement(DentalTelePage)),
  wrapped("/dental/inventory", React.createElement(DentalInventoryPage)),
  wrapped("/dental/dashboard", React.createElement(DentalDashboardPage)),
  wrapped("/dental/studies", React.createElement(DentalStudiesPage)), // [v3.0.6.8-54]
  wrapped("/dental/viewer", React.createElement(DentalViewerPage)), // [v3.0.6.8-54]
  wrapped("/dental/viewer/scan-3d", React.createElement(Scan3DViewerPage)), // [v3.0.6.8-55]
  wrapped("/dental/annotate", React.createElement(PanoramicAnnotatorPage)), // [v3.0.6.8-55]
  wrapped("/dental/viewer/mpr", React.createElement(MprViewerPage)), // [v3.0.6.8-56]
  wrapped("/dental/ai-onnx", React.createElement(DentalAiOnnxPage)), // [v3.0.6.8-56]
  wrapped("/dental/referral", React.createElement(CrossSpecialtyReferralPage)), // [v3.0.6.8-59]
  wrapped("/dental/cbct-report", React.createElement(CBCTUnifiedReportPage)), // [v3.0.6.8-59]
  wrapped("/dental/rad-fusion", React.createElement(DentalRadFusionPage)), // [v3.0.6.8-59]
  wrapped("/dental/cad", React.createElement(DentalCadPage)), // [v3.0.6.8-87] Phase 1: 修复CAD
  wrapped("/dental/implant-3d", React.createElement(DentalImplant3DPage)), // [v3.0.6.8-88] Phase 1: 种植3D
  wrapped("/dental/guide", React.createElement(DentalGuidePage)), // [v3.0.6.8-89] Phase 1: 导板+上部
  wrapped("/dental/ceph", React.createElement(DentalCephPage)), // [v3.0.6.8-90] Phase 2: 头影测量
  wrapped("/dental/aligner", React.createElement(DentalAlignerPage)), // [v3.0.6.8-92] Phase 2: 隐形矫治
  wrapped("/dental/volume-viewer", React.createElement(DentalVolumeViewerPage)), // [v3.0.6.8-93] Phase 3: 体渲染
  wrapped("/dental/patient-view", React.createElement(DentalEmrPage)), // [v3.0.6.8-94] Phase 4: 360° 患者视图
  wrapped("/dental/billing", React.createElement(DentalBillingPage)), // [v3.0.6.8-95] Phase 4: 收费/划价/医保
  wrapped("/dental/schedule", React.createElement(DentalSchedulePage)), // [v3.0.6.8-96] Phase 4: 排班+PSR
  wrapped("/dental/photo", React.createElement(DentalPhotoPage)), // [v3.0.6.8-98] Phase 5: 口内照片
  wrapped("/emr-templates", React.createElement(EmrTemplatesPage)), // [v3.0.6.8-63]
  wrapped("/system-admin", React.createElement(SystemAdminPage)), // [v3.0.6.8-64]
  wrapped("/treatment-plans", React.createElement(TreatmentPlanCenterPage)), // [v3.0.6.8-65]
  wrapped("/patient-unified", React.createElement(PatientPortalPageV2)), // [v3.0.6.8-66]
  wrapped("/command-center", React.createElement(CommandCenterPage)), // [v3.0.6.8-67]
  wrapped("/dicom-share", React.createElement(DicomSharePage)), // [v3.0.6.8-68]
  wrapped("/operations/occupancy", React.createElement(RoomOccupancyPage)), // [v3.0.6.11-17]
  wrapped("/scheduling-center", React.createElement(SchedulingCenterPage)), // [v3.0.6.8-69]
  wrapped("/operations/oee", React.createElement(OEEDashboardPage)),
  wrapped("/clinical-pathways", React.createElement(ClinicalPathwayPage)), // [v3.0.6.8-70]
  wrapped("/audit-compliance", React.createElement(AuditCompliancePage)), // [v3.0.6.8-71]
  wrapped("/compliance-docs", React.createElement(ComplianceDocsPage)), // [v3.0.6.11-79 W1-C] 合规文档库
  wrapped("/dicom-sr-manager", React.createElement(DicomSrPage)), // [v3.0.6.8-72]
  wrapped("/dicom/sr-manager", React.createElement(DicomSrPage)), // DICOM SR 结构化报告
  wrapped("/dicom/web", React.createElement(DicomWebPage)),
  wrapped("/terminology-server", React.createElement(TerminologyServerPage)), // [v3.0.6.8-73]
  wrapped("/report-templates", React.createElement(ReportTemplateManagerPage)), // [v3.0.6.8-74]
  wrapped("/ihe-integration", React.createElement(IheIntegrationPage)), // [v3.0.6.8-75]
  wrapped("/ihe/pix", React.createElement(PixPage)),
  wrapped(
    "/integration/fhir/bulk-export",
    React.createElement(FhirBulkExportPage),
  ),
  wrapped(
    "/integration/fhir/bulk-export-detail",
    React.createElement(FhirBulkExportDetailPage),
  ),
  wrapped("/ihe/pam", React.createElement(PamPage)),
  wrapped("/ihe/visit", React.createElement(VisitPage)),
  wrapped(
    "/ihe/visit-detail/:patientId/:visitNumber",
    React.createElement(VisitDetailPage),
  ),
  wrapped("/dicom/fusion", React.createElement(FusionPage)), // [v3.0.6.11-18] PET-CT/MR fusion
  wrapped("/dicom/fusion-v2", React.createElement(FusionV2Page)), // [v3.0.6.11-22] Multi-modal fusion V2
  // [G005 v3.0.6.11-101 Wave 2A] 影像对比: 多时点/多序列/多模态并排 + 同步浏览
  wrapped("/imaging-compare", React.createElement(ImagingComparePage)),
  wrapped("/dicom/volume-viewer", React.createElement(VolumeViewerPage)), // [v3.0.6.11-18] 3D Volume Rendering
  wrapped("/dicom/segmentation", React.createElement(SegmentationPage)), // [v3.0.6.11-62] 3D 分割与定量 (结节/骨/肝/肺)
  // [v3.0.6.11-101 Wave 2B] 病理切片 WSI 浏览与标注
  wrapped("/pathology/wsi-viewer", React.createElement(WsiViewerPage)),
  // [v3.0.6.11-99 Wave 4A] 病灶追踪 (登记/跨期对比/趋势图/随访联动)
  wrapped("/dicom/lesion-tracking", React.createElement(LesionTrackingPage)),
  // [v3.0.6.11-41] A12 影像处理补齐路由
  wrapped("/dicom/mpr", React.createElement(MprPage)),
  wrapped("/dicom/mip", React.createElement(MipPage)),
  wrapped("/dicom/vr", React.createElement(VrPage)),
  // [v3.0.6.11-101 Wave 3A] 多平面重建 V2 工作室 (MPR 三平面联动 + VR + CPR + 切割)
  wrapped("/dicom/volume-studio", React.createElement(VolumeStudioPage)),
  wrapped("/dicom/post-processing", React.createElement(PostProcessingPage)),
  wrapped("/dicom/dbt", React.createElement(DbtPage)),
  // [v3.0.6.11-60] Auto-hanging 自动布局协议管理
  wrapped("/dicom/hanging-protocols", React.createElement(HangingProtocolPage)),
  wrapped("/ai-fusion-workspace", React.createElement(AiFusionWorkspacePage)), // [v3.0.6.8-76]
  wrapped("/ai-cad", React.createElement(AiCadPage)),
  wrapped("/ai-draft", React.createElement(AiDraftPage)),
  wrapped("/ai/rads-scoring", React.createElement(AiRadsPage)),
  wrapped("/ai/review", React.createElement(AiReviewPage)),
  // [v3.0.6.11-101 Wave 3C] AI 增强工作台
  wrapped("/ai/enhanced", React.createElement(AiEnhancedPage)),
  wrapped("/ai/providers", React.createElement(AiProvidersPage)),
  wrapped(
    "/clinical-calculators",
    React.createElement(ClinicalCalculatorHubPage),
  ), // [v3.0.6.8-78]
  wrapped("/consent-education", React.createElement(ConsentEducationPage)), // [v3.0.6.8-79]
  wrapped("/clinical-feedback", React.createElement(ClinicalFeedbackPage)), // [v3.0.6.11-104 Wave 3C]
  wrapped("/patient-safety", React.createElement(PatientSafetyDashboardPage)), // [v3.0.6.8-80]
  wrapped("/eye/pacs/real-viewer", React.createElement(RealDicomViewerPage)), // [v3.0.6.8-34] PR 1
  wrapped("/eye/ai-report", React.createElement(AiReportWriterPage)), // [v3.0.6.8-35] PR 2
  wrapped("/eye/toric-planner", React.createElement(ToricPlannerPage)), // [v3.0.6.8-36] PR 3
  wrapped("/eye/sub/strabismus", React.createElement(StrabismusPage)), // [v3.0.6.8-37] PR 4
  wrapped("/eye/sub/neuro", React.createElement(NeuroOphthalmologyPage)),
  wrapped("/eye/sub/oncology", React.createElement(OcularOncologyPage)),
  wrapped("/eye/sub/cornea", React.createElement(CorneaPage)),
  wrapped("/eye/sub/contact-lens", React.createElement(ContactLensFittingPage)),
  wrapped("/eye/sub/low-vision", React.createElement(LowVisionPage)),
  wrapped("/eye/sub/cataract", React.createElement(CataractPage)), // [v3.0.6.8-83] PR 4 补齐
  wrapped("/eye/sub/refractive", React.createElement(RefractivePage)), // [v3.0.6.8-83] PR 4 补齐
  wrapped("/tele/conference", React.createElement(TeleConferencePage)),
  wrapped("/eye/tele", React.createElement(TeleConsultPage)), // [v3.0.6.8-41] PR 8
  wrapped("/eye/case-library", React.createElement(CaseLibraryPage)), // [v3.0.6.8-42] PR 9
  wrapped("/eye/optometry-loop", React.createElement(OptometryClosedLoopPage)), // [v3.0.6.8-44] PR 11
  wrapped("/report-workflow", React.createElement(ReportWorkflowPage)), // [v3.0.6.8-45] PR 1
  wrapped(
    "/patient-device-mgmt",
    React.createElement(PatientDeviceManagementPage),
  ), // [v3.0.6.8-46] PR 2
  wrapped("/notif-tpl-dict", React.createElement(NotificationTemplateDictPage)), // [v3.0.6.8-47] PR 3
  wrapped("/review-check", React.createElement(ReviewCheckPage)), // [v3.0.6.8-48] PR 4
  wrapped("/sign-amend", React.createElement(SignAmendPage)), // [v3.0.6.8-49] PR 5
  wrapped("/v3-report-hub", React.createElement(V3ReportHubPage)), // [v3.0.6.8-50] PR 6
  wrapped("/materials", React.createElement(MaterialsV2Page)), // [v3.0.6.8-51] PR 7
  wrapped("/supplies", React.createElement(MaterialsV2Page)), // [F16] 耗材: 侧边栏 /supplies 对齐
  wrapped("/radiology-materials", React.createElement(MaterialsV2Page)), // [F16] 放射耗材: 侧边栏 /radiology-materials 对齐
  wrapped("/eye/pacs/oct", React.createElement(OctViewerPage)),
  wrapped("/eye/ris/iol-calculator", React.createElement(IolCalculatorPage)),
  wrapped("/eye/ris/va", React.createElement(VisionExamPage)),
  wrapped("/eye/ris/iop", React.createElement(IntraocularPressurePage)),
  wrapped("/eye/pacs/fundus", React.createElement(FundusViewerPage)),
  wrapped("/eye/pacs/oct-a", React.createElement(OctAngiographyPage)),
  wrapped("/eye/pacs/visual-field", React.createElement(VisualFieldPage)),
  wrapped("/eye/pacs/topography", React.createElement(TopographyPage)),
  wrapped("/eye/pacs/ffa", React.createElement(FfaViewerPage)),
  wrapped("/eye/pacs/compare", React.createElement(ImageComparePage)),
  wrapped("/eye/pacs/montage", React.createElement(MontagePage)),
  wrapped("/eye/ris", React.createElement(EyeRisPage)),
  wrapped("/eye/emr", React.createElement(EyeEmrPage)),
  wrapped("/eye/ai", React.createElement(EyeAiPage)),
  wrapped("/eye/report-write", React.createElement(EyeReportWritePage)),
  wrapped("/eye/kpi-dashboard", React.createElement(EyeKpiDashboardPage)),
  wrapped("/analytics/benchmark-v2", React.createElement(BenchmarkPageV2)),
  wrapped(
    "/analytics/benchmark-ai-diagnosis",
    React.createElement(BenchmarkAiDiagnosisPage),
  ),
  wrapped("/analytics/tat-dashboard", React.createElement(TatDashboardPage)),
  // [v3.0.6.8-27] 放射科质控总看板 + 影像质控 + 医生档案
  // [v3.0.6.11-103 Wave 10] 重复页合并: RadiologyQCDashboardPage 嵌入 QCPage (放射质控总览 Tab), 旧路由 redirect
  wrapped("/qc-dashboard", React.createElement(Navigate, { to: "/qc", replace: true })),
  wrapped("/qc-image", React.createElement(ImageQualityControlPage)),
  wrapped(
    "/qc-radiologist-annual",
    React.createElement(RadiologistAnnualQCPage),
  ),
  wrapped("/qc/image-ai", React.createElement(QcImageAiPage)),
  // [G005 Wave 3A v3.0.6.11-99] PDCA 质控闭环
  wrapped("/qc/pdca", React.createElement(QcPdcaPage)),
  // [G005 Wave 8B v3.0.6.11-101] 报告质控闭环与趋势分析
  wrapped("/qc/analytics", React.createElement(QcAnalyticsPage)),
  // [G005 v3.0.6.11-101 Wave 6A] 报告 V2: 质控规则引擎 + 水印签章 V2
  wrapped("/report-v2/rules", React.createElement(ReportRulesPage)),
  wrapped("/report-v2/watermark", React.createElement(ReportWatermarkPage)),
  // [G005 v3.0.6.11-101 Wave 7C] 报告 V2: AI 二次检出 V2 + 委员会会诊 V2 + 报告互评
  wrapped("/report-v2/workbench", React.createElement(ReportV2Page)),
  // [v3.0.6.11-100 Wave 1B] 技师工作站: 检查间实时看板 + 重拍分析
  wrapped("/tech/room-status", React.createElement(ExamRoomStatusBoard)),
  wrapped("/tech/retake-analytics", React.createElement(RetakeRateAnalyticsPage)),
  wrapped("/radpath/tracker", React.createElement(RadPathTrackerPage)),
  wrapped("/radpath/detail/:reportId", React.createElement(RadPathDetailPage)),
  wrapped("/triage/worklist", React.createElement(TriagePage)),
  wrapped("/triage/dashboard", React.createElement(TriageDashboardPage)),
  wrapped("/teach/lecture", React.createElement(TeachLecturePage)),
  // [G005 v3.0.6.11-103 Wave 18] 教学病例库 (病例收藏/分类/分享评论/考试模式)
  wrapped("/teach/case-library", React.createElement(TeachingCaseLibraryPage)),
  wrapped(
    "/system/audit",
    React.createElement(lazy(() => import("../pages/AuditPage"))),
  ),
  wrapped(
    "/audit",
    React.createElement(lazy(() => import("../pages/AuditPage"))),
  ), // [F16] 侧边栏 /audit 对齐
  wrapped(
    "/system/backup",
    React.createElement(lazy(() => import("../pages/BackupPage"))),
  ),
  wrapped(
    "/system/tenant-config",
    React.createElement(lazy(() => import("../pages/TenantConfigPage"))),
  ),
  wrapped("/dicom/radiomics", React.createElement(RadiomicsPage)),
  wrapped("/dicom/4d", React.createElement(Dicom4dPage)),
  wrapped("/dicom/compress", React.createElement(DicomCompressPage)),
  wrapped("/orchestrator", React.createElement(OrchestratorPage)),
  // [v3.0.6.11-21] P0 fix: MFA 设置页接入路由
  wrapped(
    "/security/mfa-setup",
    React.createElement(lazy(() => import("../pages/security/MfaSetupPage"))),
  ),
  // [v3.0.6.11-21] P0 fix: 合规管理页接入路由
  wrapped(
    "/system/compliance",
    React.createElement(lazy(() => import("../pages/CompliancePage"))),
  ),
  // [Sprint 3] F07-F12 新页面路由
  wrapped("/nlp/spellcheck", React.createElement(NlpCheckPage)),
  wrapped("/asr/transcribe", React.createElement(AsrPage)),
  wrapped("/snomed/encode", React.createElement(SnomedPage)),
  // [v3.0.6.11-103 Wave 17] PACS 对标第一批: 结构化报告 V3 / 语音听写 V2 / 自动编码
  wrapped("/report/v4/structured", React.createElement(StructuredReportV3Page)),
  wrapped("/asr/dictation", React.createElement(AsrDictationPage)),
  wrapped("/snomed/auto-coding", React.createElement(AutoCodingPage)),
  wrapped("/snomed/encoder", React.createElement(SnomedEncoderPage)),
  wrapped("/cds/rule-config", React.createElement(RuleConfigPanel)),
  wrapped("/rdsr", React.createElement(RdsrPage)),
  // [Sprint 4] F13-F18 新页面路由
  wrapped("/ai-marketplace", React.createElement(AiMarketplacePage)),
  wrapped("/cross-modal-search", React.createElement(CrossModalSearchPage)),
  wrapped("/similar-case", React.createElement(SimilarCasePage)),
  wrapped("/dual-read", React.createElement(DualReadPage)),
  wrapped("/tele-sign", React.createElement(TeleSignPage)),
  wrapped("/smart-route", React.createElement(SmartRoutePage)),
  wrapped("/hl7-siu", React.createElement(Hl7SiuPage)),
  // [workflow-gap] 7项缺失功能补齐: Smart MWL / AI Triage / Smart Routing / CoSign Review / Rad-Path
  wrapped(
    "/smart-mwl",
    React.createElement(lazy(() => import("../pages/worklist/SmartMwlPage"))),
  ),
  wrapped(
    "/ai-triage",
    React.createElement(lazy(() => import("../pages/triage/AiTriagePage"))),
  ),
  wrapped(
    "/smart-routing",
    React.createElement(
      lazy(() => import("../pages/workflow/SmartRoutingPage")),
    ),
  ),
  wrapped(
    "/cosign-review",
    React.createElement(lazy(() => import("../pages/review/CoSignPage"))),
  ),
  wrapped(
    "/radpath",
    React.createElement(lazy(() => import("../pages/radpath/RadPathPage"))),
  ),
  wrapped(
    "/critical-value-5step",
    React.createElement(
      lazy(() => import("../pages/critical/CriticalValue5StepPage")),
    ),
  ),
  // [audit-fix-2026-07-28] 后端端点补齐: FHIR/DICOM/Fusion/Radiomics/IHE/HL7 前端页面
  wrapped("/fhir/patient", React.createElement(FhirPatientPage)),
  wrapped("/fhir/observation", React.createElement(FhirObservationPage)),
  wrapped(
    "/fhir/diagnostic-report",
    React.createElement(FhirDiagnosticReportPage),
  ),
  wrapped("/fhir/imaging-study", React.createElement(FhirImagingStudyPage)),
  wrapped("/fhir/subscription", React.createElement(FhirSubscriptionPage)),
  wrapped("/dicom/dimse", React.createElement(DicomDimsePage)),
  wrapped("/dicom/sr-templates", React.createElement(DicomSrTemplatePage)),
  wrapped("/fusion/manager", React.createElement(FusionManagerPage)),
  wrapped("/radiomics/features", React.createElement(RadiomicsFeaturePage)),
  wrapped("/ihe/manager", React.createElement(IheManagerPage)),
  wrapped("/hl7/manager", React.createElement(Hl7ManagerPage)),
  // [v3.0.6.11-41] A11 AI 集成补齐路由
  wrapped("/ai/lung-cad", React.createElement(LungCadPage)),
  wrapped("/ai/breast-cad", React.createElement(BreastCadPage)),
  wrapped("/ai/fracture-cad", React.createElement(FractureCadPage)),
  wrapped("/ai/cardiac-ai", React.createElement(CardiacAiPage)),
  wrapped("/ai/third-party", React.createElement(ThirdPartyAiPage)),
  wrapped("/ai/dl-denoise", React.createElement(DlDenoisePage)),
  wrapped("/dicom/wado-rs", React.createElement(WadoRsPage)),
  wrapped("/dicom/stow-rs", React.createElement(StowRsPage)),
  wrapped("/dicom/sr-report", React.createElement(SrReportPage)),
  wrapped("/critical-alert", React.createElement(CriticalAlertPage)),
  // [v3.0.6.11-100 Wave 4A] 自定义报表 / 语音工作站 / 移动审批
  wrapped("/report/custom", React.createElement(CustomReportPage)),
  wrapped("/voice/workstation", React.createElement(VoiceWorkstationPage)),
  wrapped("/mobile/approval", React.createElement(MobileApprovalPage)),
  // [v3.0.6.11-79] W2-A 危急值接收端门户
  wrapped("/critical-value-receiver", React.createElement(ReceiverPortalPage)),
  wrapped("/auto-collection", React.createElement(AutoCollectionPage)),
  // [v3.0.6.11-103 Wave 4B] 急诊通道管理
  wrapped("/emergency-channel", React.createElement(EmergencyChannelPage)),
  wrapped("/dept-dashboard", React.createElement(DeptDashboardPageV2)),
  wrapped("/remote-reading", React.createElement(RemoteReadingPage)),
  wrapped("/pacs-admin", React.createElement(PacsAdminPage)),
  {
    path: "*",
    element: React.createElement(Navigate, { to: "/forbidden", replace: true }),
  },
];

/**
 * G005 放射RIS系统 - 路由表 v3.0.6.8
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
const ReportPage = lazy(() => import("../pages/ReportPage"));
const ReportWritePage = lazy(() => import("../pages/ReportWritePage"));
const WorklistPage = lazy(() => import("../pages/WorklistPage"));
const StatisticsPage = lazy(() => import("../pages/StatisticsPage"));
const CriticalValuePage = lazy(() => import("../pages/critical/CriticalValuePage"));
const TermLibraryPage = lazy(() => import("../pages/TermLibraryPage"));
const DevicePage = lazy(() => import("../pages/DevicePage"));
const ConsultationPage = lazy(() => import("../pages/ConsultationPage"));
const QCPage = lazy(() => import("../pages/QCPage"));
const AppointmentPage = lazy(() => import("../pages/AppointmentPage"));
const DoseTrackPage = lazy(() => import("../pages/DoseTrackPage"));
const QueueCallPage = lazy(() => import("../pages/QueueCallPage"));
const DicomViewerClassicPage = lazy(() => import("../pages/DicomViewerPage"));
const DicomViewerProPage = lazy(() => import("../pages/dicom/DicomViewerPro"));
const TypicalCasesPage = lazy(() => import("../pages/TypicalCasesPage"));
const FindingLibraryPage = lazy(() => import("../pages/FindingLibraryPage"));
const OperationLogPage = lazy(() => import("../pages/OperationLogPage"));
const NotificationCenter = lazy(() => import("../pages/NotificationCenter"));
const SchedulePage = lazy(() => import("../pages/SchedulePage"));
const ClinicalConfigCenter = lazy(() => import("../pages/admin/ClinicalConfigCenter"));
const DepartmentPage = lazy(() => import("../pages/DepartmentPage"));
const MaterialsPage = lazy(() => import("../pages/MaterialsPage"));
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
const ReportDeliveryPage = lazy(() => import("../pages/ReportDeliveryPage"));
const PublishPage = lazy(() => import("../pages/PublishPage"));
const PatientReportPortalPage = lazy(
  () => import("../pages/PatientReportPortalPage"),
);
const CASignaturePage = lazy(() => import("../pages/CASignaturePage"));
const BlockchainProofPage = lazy(() => import("../pages/BlockchainProofPage"));
const AppointmentManagementPage = lazy(
  () => import("../pages/AppointmentManagementPage"),
);
const DeviceFaultPage = lazy(() => import("../pages/DeviceFaultPage"));
const AIQCPage = lazy(() => import("../pages/AIQCPage"));
const AIStructuredReportPage = lazy(
  () => import("../pages/AIStructuredReportPage"),
);
const RegionalImagingPage = lazy(() => import("../pages/RegionalImagingPage"));
const EquipmentEfficiencyPage = lazy(
  () => import("../pages/EquipmentEfficiencyPage"),
);
const UserManagementPage = lazy(() => import("../pages/UserManagementPage"));
const PatientPortalPage = lazy(() => import("../pages/PatientPortalPage"));
const DirectorDashboardPage = lazy(
  () => import("../pages/DirectorDashboardPage"),
);
const GreenITPage = lazy(() => import("../pages/GreenITPage"));
const ResearchPage = lazy(() => import("../pages/ResearchPage"));
const DicomPrintPage = lazy(() => import("../pages/System/DicomPrintPage"));
const FhirServerPage = lazy(() => import("../pages/integration/FhirServerPage"));
const IheConnectathonPage = lazy(
  () => import("../pages/integration/IheConnectathonPage"),
);
const MllpMonitorPage = lazy(
  () => import("../pages/integration/MllpMonitorPage"),
);
const Hl7ArchivePage = lazy(() => import("../pages/integration/Hl7ArchivePage"));
const Hl7BuilderPage = lazy(() => import("../pages/integration/Hl7BuilderPage"));
const MllpConfigPage = lazy(() => import("../pages/integration/MllpConfigPage"));
const DimsePage = lazy(() => import("../pages/integration/DimsePage"));
const DimseUploadPage = lazy(() => import("../pages/integration/DimseUploadPage"));
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
const CdsManagementPage = lazy(() => import("../pages/cds/CdsManagementPage"));
const CdsStatisticsPage = lazy(() => import("../pages/cds/CdsStatisticsPage"));
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
const DepartmentQualityPage = lazy(
  () => import("../pages/quality/DepartmentQualityPage"),
);
const LoginPage = lazy(() => import("../pages/LoginPage"));
const ForbiddenPage = lazy(() => import("../pages/ForbiddenPage"));
const ReviewCenterPage = lazy(() => import("../pages/ReviewCenterPage"));
const QualityControlPage = lazy(() => import("../pages/QualityControlPage"));
const CriticalValueCenterPage = lazy(
  () => import("../pages/CriticalValueCenterPage"),
);
const DefectManagementPage = lazy(
  () => import("../pages/DefectManagementPage"),
);
const CoSignPage = lazy(() => import("../pages/CoSignPage"));
const WorkflowDesignerPage = lazy(
  () => import("../pages/WorkflowDesignerPage"),
);
const RoutingRulePage = lazy(() => import("../pages/RoutingRulePage"));
const WorkloadHeatmapPage = lazy(() => import("../pages/WorkloadHeatmapPage"));
const SlaPolicyPage = lazy(() => import("../pages/SlaPolicyPage"));
// [v3.0.6.8-27] 新增质控页面
const RadiologyQCDashboardPage = lazy(() => import("../pages/qc/RadiologyQCDashboardPage"));
const ImageQualityControlPage = lazy(() => import("../pages/qc/ImageQualityControlPage"));
const RadiologistAnnualQCPage = lazy(() => import("../pages/qc/RadiologistAnnualQCPage"));
const QcImageAiPage = lazy(() => import("../pages/qc/QcImageAiPage"));

const EyeWorkspacePage = lazy(() => import("../pages/eye/EyeWorkspacePage"));
const PacsStudyListPage = lazy(
  () => import("../pages/eye/pacs/PacsStudyListPage"),
);
const PacsViewerPage = lazy(() => import("../pages/eye/pacs/PacsViewerPage"));
// [v3.0.6.8-34] PR 1: 真实 DICOM 渲染
const RealDicomViewerPage = lazy(() => import("../pages/eye/pacs/RealDicomViewerPage"));
// [v3.0.6.8-35] PR 2: AI 报告书写
const AiReportWriterPage = lazy(() => import("../pages/eye/report/AiReportWriterPage"));
// [v3.0.6.8-36] PR 3: IOL 规划 (Toric 散光)
const ToricPlannerPage = lazy(() => import("../pages/eye/ris/ToricPlannerPage"));
// [v3.0.6.8-37] PR 4: 8 亚专科纵深
import { StrabismusPage, NeuroOphthalmologyPage, OcularOncologyPage, CorneaPage, ContactLensFittingPage, LowVisionPage, CataractPage, RefractivePage } from "../pages/eye/sub/SubspecialtyExamsPage";
// [v3.0.6.8-41] PR 8: 远程眼科 + 视光中心
const TeleConsultPage = lazy(() => import("../pages/eye/tele/TeleConsultPage"));
// [v3.0.6.8-42] PR 9: 教学病例库
const CaseLibraryPage = lazy(() => import("../pages/eye/edu/CaseLibraryPage"));
// [v3.0.6.8-44] PR 11: 视光中心闭环
const OptometryClosedLoopPage = lazy(() => import("../pages/eye/optometry/OptometryClosedLoopPage"));
// [v3.0.6.8-45] PR 1: 报告流程核心
const ReportWorkflowPage = lazy(() => import("../pages/reports/ReportWorkflowPage"));
// [v3.0.6.8-46] PR 2: 患者 + 设备管理
const PatientDeviceManagementPage = lazy(() => import("../pages/admin/PatientDeviceManagementPage"));
// [v3.0.6.8-47] PR 3: 通知 + 模板 + 词典
const NotificationTemplateDictPage = lazy(() => import("../pages/admin/NotificationTemplateDictPage"));
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
const DentalWorkspacePage = lazy(() => import("../pages/dental/DentalWorkspacePage"));
const DentalTreatmentPage = lazy(() => import("../pages/dental/DentalTreatmentPage"));
const DentalImplantPlanPage = lazy(() => import("../pages/dental/DentalImplantPlanPage"));
const DentalOrthoPage = lazy(() => import("../pages/dental/DentalOrthoPage"));
const DentalEndoPage = lazy(() => import("../pages/dental/DentalEndoPage"));
const DentalPerioPage = lazy(() => import("../pages/dental/DentalPerioPage"));
const DentalRestorativePage = lazy(() => import("../pages/dental/DentalRestorativePage"));
const DentalSurgeryPage = lazy(() => import("../pages/dental/DentalSurgeryPage"));
const DentalPediatricPage = lazy(() => import("../pages/dental/DentalPediatricPage"));
const DentalTelePage = lazy(() => import("../pages/dental/DentalTelePage"));
const DentalInventoryPage = lazy(() => import("../pages/dental/DentalInventoryPage"));
const DentalDashboardPage = lazy(() => import("../pages/dental/DentalDashboardPage"));
const EmrTemplatesPage = lazy(() => import("../pages/emr/EmrTemplatesPage"));
const SystemAdminPage = lazy(() => import("../pages/admin/SystemAdminPage"));
const TreatmentPlanCenterPage = lazy(() => import("../pages/treatment/TreatmentPlanCenterPage"));
const PatientPortalPageV2 = lazy(() => import("../pages/patient/PatientPortalPage"));
const CommandCenterPage = lazy(() => import("../pages/operations/CommandCenterPage"));
const BenchmarkPageV2 = lazy(() => import("../pages/analytics/BenchmarkPageV2"));
const BenchmarkAiDiagnosisPage = lazy(() => import("../pages/analytics/BenchmarkAiDiagnosisPage"));
const RoomOccupancyPage = lazy(() => import("../pages/operations/RoomOccupancyPage"));
const DicomSharePage = lazy(() => import("../pages/imaging/DicomSharePage"));
const SchedulingCenterPage = lazy(() => import("../pages/operations/SchedulingCenterPage"));
const OEEDashboardPage = lazy(() => import("../pages/operations/OEEDashboardPage"));
const ClinicalPathwayPage = lazy(() => import("../pages/clinical/ClinicalPathwayPage"));
const AuditCompliancePage = lazy(() => import("../pages/compliance/AuditCompliancePage"));
const DicomSrManagerPage = lazy(() => import("../pages/imaging/DicomSrManagerPage"));
const FusionPage = lazy(() => import("../pages/dicom/FusionPage"));
const VolumeViewerPage = lazy(() => import("../pages/dicom/VolumeViewerPage"));
const TerminologyServerPage = lazy(() => import("../pages/clinical/TerminologyServerPage"));
const ReportTemplateManagerPage = lazy(() => import("../pages/reports/ReportTemplateManagerPage"));
const IheIntegrationPage = lazy(() => import("../pages/integration/IheIntegrationPage"));
const PixPage = lazy(() => import("../pages/ihe/PixPage"));
const FhirBulkExportPage = lazy(() => import("../pages/integration/FhirBulkExportPage"));
const FhirBulkExportDetailPage = lazy(() => import("../pages/integration/FhirBulkExportDetailPage"));
const PamPage = lazy(() => import("../pages/ihe/PamPage"));
const VisitPage = lazy(() => import("../pages/ihe/VisitPage"));
const VisitDetailPage = lazy(() => import("../pages/ihe/VisitDetailPage"));
const TeleConferencePage = lazy(() => import("../pages/tele/TeleConferencePage"));
const AiFusionWorkspacePage = lazy(() => import("../pages/ai/AiFusionWorkspacePage"));
const AiCadPage = lazy(() => import("../pages/ai/AiCadPage"));
const ClinicalCalculatorHubPage = lazy(() => import("../pages/clinical/ClinicalCalculatorHubPage"));
const ConsentEducationPage = lazy(() => import("../pages/consent/ConsentEducationPage"));
const PatientSafetyDashboardPage = lazy(() => import("../pages/safety/PatientSafetyDashboardPage"));
const DentalCadPage = lazy(() => import("../pages/dental/DentalCadPage"));
const DentalImplant3DPage = lazy(() => import("../pages/dental/DentalImplant3DPage"));
const DentalGuidePage = lazy(() => import("../pages/dental/DentalGuidePage"));
const DentalCephPage = lazy(() => import("../pages/dental/DentalCephPage"));
const DentalAlignerPage = lazy(() => import("../pages/dental/DentalAlignerPage"));
const DentalVolumeViewerPage = lazy(() => import("../pages/dental/DentalVolumeViewerPage"));
const DentalEmrPage = lazy(() => import("../pages/dental/DentalEmrPage"));
const DentalBillingPage = lazy(() => import("../pages/dental/DentalBillingPage"));
const DentalSchedulePage = lazy(() => import("../pages/dental/DentalSchedulePage"));
const DentalPhotoPage = lazy(() => import("../pages/dental/DentalPhotoPage"));
const DentalStudiesPage = lazy(() => import("../pages/dental/DentalStudiesPage"));
const DentalViewerPage = lazy(() => import("../pages/dental/DentalViewerPage"));
const Scan3DViewerPage = lazy(() => import("../pages/dental/Scan3DViewerPage"));
const PanoramicAnnotatorPage = lazy(() => import("../pages/dental/PanoramicAnnotatorPage"));
const MprViewerPage = lazy(() => import("../pages/dental/MprViewerPage"));
const DentalAiOnnxPage = lazy(() => import("../pages/dental/DentalAiOnnxPage"));
const CrossSpecialtyReferralPage = lazy(() => import("../pages/dental/DentalRadFusionPages").then(m => ({ default: m.CrossSpecialtyReferralPage })));
const CBCTUnifiedReportPage = lazy(() => import("../pages/dental/DentalRadFusionPages").then(m => ({ default: m.CBCTUnifiedReportPage })));
const DentalRadFusionPage = lazy(() => import("../pages/dental/DentalRadFusionPages").then(m => ({ default: m.DentalRadFusionPage })));
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
const EyeKpiDashboardPage = lazy(() => import("../pages/eye/EyeKpiDashboardPage"));
const TeachLecturePage = lazy(() => import("../pages/teach/TeachLecturePage"));
const RadPathTrackerPage = lazy(() => import("../pages/radpath/RadPathTrackerPage"));
const RadPathDetailPage = lazy(() => import("../pages/radpath/RadPathDetailPage"));

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
  "/patient/:id": roleMap["/patients"] ?? ALL_ROLES,
  "/template-designer/:id": roleMap["/template-designer"] ?? ALL_ROLES,
  "/research": ["医生", "主任", "管理员"],
  "/director-dashboard": ["主任", "管理员"],
  "/mammo/operations": ["主任", "管理员"],
  "/mammo/quality": ["主任", "管理员"],
  "/workbench": ALL_ROLES,
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
  "/dental/schedule": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-96] Phase 4: 排班+PSR
  "/dental/photo": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-98] Phase 5: 口内照片
  "/emr-templates": ["医生", "主任", "管理员"], // [v3.0.6.8-63]
  "/system-admin": ["管理员"], // [v3.0.6.8-64]
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
  "/dicom-sr-manager": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-72]
  "/dicom/fusion": ["医生", "主任", "技师", "管理员"], // [v3.0.6.11-18] PET-CT/MR fusion
  "/dicom/volume-viewer": ["医生", "主任", "技师", "管理员"], // [v3.0.6.11-18] 3D Volume Rendering
  "/terminology-server": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-73]
  "/report-templates": ["医生", "主任", "技师", "管理员", "护士"], // [v3.0.6.8-74]
  "/ihe-integration": ["主任", "管理员", "技师"], // [v3.0.6.8-75]
  "/ai-fusion-workspace": ["医生", "主任", "技师", "管理员"], // [v3.0.6.8-76]
  "/ai-cad": ["医生", "主任", "技师", "管理员"],
  "/clinical-calculators": ["医生", "主任", "技师", "护士", "管理员"], // [v3.0.6.8-78]
  "/consent-education": ["医生", "主任", "技师", "护士", "管理员"], // [v3.0.6.8-79]
  "/patient-safety": ["主任", "管理员", "护士"], // [v3.0.6.8-80]
  "/eye/report-write": ["医生", "主任", "管理员"],
  "/eye/kpi-dashboard": ["主任", "管理员"],
  "/radpath/tracker": ["医生", "主任", "管理员"],
  "/radpath/detail/:reportId": ["医生", "主任", "管理员"],
  "/analytics/benchmark-v2": ["主任", "管理员"],
  "/analytics/benchmark-ai-diagnosis": ["主任", "管理员"],
  "/admin/config": ["管理员"],
  "/ihe/pam": ["主任", "管理员", "技师"],
  "/ihe/visit": ["医生", "主任", "技师", "管理员"],
  "/ihe/visit-detail/:patientId/:visitNumber": ["医生", "主任", "技师", "管理员"],
  "/ihe/pix": ["主任", "管理员", "技师"],
  "/integration/fhir/bulk-export": ["主任", "管理员", "技师"],
  "/integration/fhir/bulk-export-detail": ["主任", "管理员", "技师"],
  "/integration/hl7-archive": ["技师", "管理员"],
  "/integration/hl7-builder": ["技师", "管理员"],
  "/integration/mllp-config": ["管理员"],
  "/integration/dimse": ["技师", "管理员", "医生", "主任"],
  "/integration/dimse/upload": ["技师", "管理员"],
  // [v3.0.6.11-21] 新页面路由角色映射
  "/security/mfa-setup": ["管理员", "主任", "医生", "技师", "护士"],
  "/system/audit": ["管理员"],
  "/system/backup": ["管理员"],
  "/system/tenant-config": ["管理员"],
  "/system/compliance": ["管理员", "主任"],
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
  wrapped("/patient/:id", React.createElement(PatientPage)),
  wrapped("/patients/:id/360", React.createElement(Patient360Page)),
  wrapped("/exams", React.createElement(ExamPage)),
  wrapped("/reports", React.createElement(ReportPage)),
  wrapped("/write-report", React.createElement(ReportWritePage)),
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
  wrapped("/materials", React.createElement(MaterialsPage)),
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
    React.createElement(AppointmentManagementPage),
  ),
  wrapped("/device-fault", React.createElement(DeviceFaultPage)),
  wrapped("/ai-qc", React.createElement(AIQCPage)),
  wrapped("/ai-structured-report", React.createElement(AIStructuredReportPage)),
  wrapped("/ai-medical-device", React.createElement(AIMedicalDevicePage)),
  wrapped("/regional-imaging", React.createElement(RegionalImagingPage)),
  wrapped(
    "/equipment-efficiency",
    React.createElement(EquipmentEfficiencyPage),
  ),
  wrapped("/user-management", React.createElement(UserManagementPage)),
  wrapped("/admin/config", React.createElement(ClinicalConfigCenter)),
  wrapped("/patient-portal", React.createElement(PatientPortalPage)),
  wrapped("/director-dashboard", React.createElement(DirectorDashboardPage)),
  wrapped("/green-it", React.createElement(GreenITPage)),
  wrapped("/research", React.createElement(ResearchPage)),
  wrapped("/nuclear-stats", React.createElement(NuclearStatsPage)),
  wrapped("/system/dicom-print", React.createElement(DicomPrintPage)),
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
  wrapped("/ops/hr", React.createElement(HrOperationsPage)),
  wrapped("/ops/dashboard", React.createElement(OpsDashboardPage)),
  wrapped("/cds/management", React.createElement(CdsManagementPage)),
  wrapped("/cds/statistics", React.createElement(CdsStatisticsPage)),
  wrapped("/finance/department", React.createElement(DepartmentFinancePage)),
  wrapped("/finance/patient", React.createElement(PatientFinancePage)),
  wrapped("/mammo/operations", React.createElement(DepartmentOperationsPage)),
  wrapped("/mammo/quality", React.createElement(QualityManagementPage)),
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
  wrapped("/integration/ihe-connectathon", React.createElement(IheConnectathonPage)),
  wrapped("/integration/mllp-monitor", React.createElement(MllpMonitorPage)),
  wrapped("/integration/hl7-archive", React.createElement(Hl7ArchivePage)),
  wrapped("/integration/hl7-builder", React.createElement(Hl7BuilderPage)),
  wrapped("/integration/mllp-config", React.createElement(MllpConfigPage)),
  wrapped("/integration/dimse", React.createElement(DimsePage)),
  wrapped("/integration/dimse/upload", React.createElement(DimseUploadPage)),
  wrapped("/kiosk/check-in", React.createElement(KioskCheckIn)),
  wrapped("/mobile/patient", React.createElement(PatientMobileApp)),
  wrapped("/mobile/doctor", React.createElement(DoctorMobileWorkstation)),
  wrapped("/mobile/nurse", React.createElement(NurseMobileWorkstation)),
  wrapped("/mobile/tech", React.createElement(TechMobileWorkstation)),
  wrapped("/quality/department", React.createElement(DepartmentQualityPage)),
  wrapped("/review-center", React.createElement(ReviewCenterPage)),
  wrapped("/quality-control", React.createElement(QualityControlPage)),
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
  wrapped("/dicom-sr-manager", React.createElement(DicomSrManagerPage)), // [v3.0.6.8-72]
  wrapped("/terminology-server", React.createElement(TerminologyServerPage)), // [v3.0.6.8-73]
  wrapped("/report-templates", React.createElement(ReportTemplateManagerPage)), // [v3.0.6.8-74]
  wrapped("/ihe-integration", React.createElement(IheIntegrationPage)), // [v3.0.6.8-75]
  wrapped("/ihe/pix", React.createElement(PixPage)),
  wrapped("/integration/fhir/bulk-export", React.createElement(FhirBulkExportPage)),
  wrapped("/integration/fhir/bulk-export-detail", React.createElement(FhirBulkExportDetailPage)),
  wrapped("/ihe/pam", React.createElement(PamPage)),
  wrapped("/ihe/visit", React.createElement(VisitPage)),
  wrapped("/ihe/visit-detail/:patientId/:visitNumber", React.createElement(VisitDetailPage)),
  wrapped("/dicom/fusion", React.createElement(FusionPage)), // [v3.0.6.11-18] PET-CT/MR fusion
  wrapped("/dicom/volume-viewer", React.createElement(VolumeViewerPage)), // [v3.0.6.11-18] 3D Volume Rendering
  wrapped("/ai-fusion-workspace", React.createElement(AiFusionWorkspacePage)), // [v3.0.6.8-76]
  wrapped("/ai-cad", React.createElement(AiCadPage)),
  wrapped("/clinical-calculators", React.createElement(ClinicalCalculatorHubPage)), // [v3.0.6.8-78]
  wrapped("/consent-education", React.createElement(ConsentEducationPage)), // [v3.0.6.8-79]
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
  wrapped("/patient-device-mgmt", React.createElement(PatientDeviceManagementPage)), // [v3.0.6.8-46] PR 2
  wrapped("/notif-tpl-dict", React.createElement(NotificationTemplateDictPage)), // [v3.0.6.8-47] PR 3
  wrapped("/review-check", React.createElement(ReviewCheckPage)), // [v3.0.6.8-48] PR 4
  wrapped("/sign-amend", React.createElement(SignAmendPage)), // [v3.0.6.8-49] PR 5
  wrapped("/v3-report-hub", React.createElement(V3ReportHubPage)), // [v3.0.6.8-50] PR 6
  wrapped("/materials", React.createElement(MaterialsV2Page)), // [v3.0.6.8-51] PR 7
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
  wrapped("/analytics/benchmark-ai-diagnosis", React.createElement(BenchmarkAiDiagnosisPage)),
  // [v3.0.6.8-27] 放射科质控总看板 + 影像质控 + 医生档案
  wrapped("/qc-dashboard", React.createElement(RadiologyQCDashboardPage)),
  wrapped("/qc-image", React.createElement(ImageQualityControlPage)),
  wrapped("/qc-radiologist-annual", React.createElement(RadiologistAnnualQCPage)),
  wrapped("/qc/image-ai", React.createElement(QcImageAiPage)),
  wrapped("/radpath/tracker", React.createElement(RadPathTrackerPage)),
  wrapped("/radpath/detail/:reportId", React.createElement(RadPathDetailPage)),
  wrapped("/teach/lecture", React.createElement(TeachLecturePage)),
  wrapped("/system/audit", React.createElement(lazy(() => import("../pages/AuditPage")))),
  wrapped("/system/backup", React.createElement(lazy(() => import("../pages/BackupPage")))),
  wrapped("/system/tenant-config", React.createElement(lazy(() => import("../pages/TenantConfigPage")))),
  // [v3.0.6.11-21] P0 fix: MFA 设置页接入路由
  wrapped("/security/mfa-setup", React.createElement(lazy(() => import("../pages/security/MfaSetupPage")))),
  // [v3.0.6.11-21] P0 fix: 合规管理页接入路由
  wrapped("/system/compliance", React.createElement(lazy(() => import("../pages/CompliancePage")))),
  {
    path: "*",
    element: React.createElement(Navigate, { to: "/", replace: true }),
  },
];

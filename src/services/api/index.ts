export { api } from './client'
export type { ApiResponse, PageResult, ApiError, ExamQueryParams, PatientQueryParams, ReportQueryParams } from './types'

export { v3AiPlatformApi, v3AiAssistApi, v3AnalyticsApi, v3WritingApi, v3DistApi, v3IntegrationApi, v3QualityReportApi, v3PacsApi } from './v3Api'
export type { AiGenerateDto, AiReviewDto, AiScoreDto } from './v3Api'

export { examApi } from './examApi'
export type { ExamDto, CreateExamDto, UpdateExamDto } from './examApi'

export { patientApi } from './patientApi'
export type { PatientDto } from './patientApi'

export { reportApi } from './reportApi'
export type { ReportDto } from './reportApi'

export { deviceApi } from './deviceApi'
export type { DeviceDto, CreateDeviceDto, UpdateDeviceDto } from './deviceApi'

export { fusionV2Api } from './fusionV2Api'
export type {
  FusionV2RegisterDto, FusionV2RegisterResult,
  FusionV2RenderDto, FusionV2RenderResult,
  FusionV2SeriesItem, FusionV2SeriesResult,
} from './fusionV2Api'

export { radpathApi } from './radpathApi'
export type {
  RadPathCreateDto, RadPathUpdateConsistencyDto,
  RadPathRecord, RadPathStats,
} from './radpathApi'

export { deviceMgmtApi } from './deviceMgmtApi'
export type {
  EquipmentLifecycle, UpdateEquipmentLifecycleDto,
  DeviceMgmtItem, CreateDeviceMgmtDto, UpdateDeviceMgmtDto,
  DeviceFault, ReportDeviceFaultDto,
  Material, AddMaterialDto,
  DoseRecord, RecordDoseDto,
  AdverseReaction, ReportAdverseReactionDto,
  ContrastInventory, UpdateContrastInventoryDto,
  InjectionWorkstation, ContrastQuality,
} from './deviceMgmtApi'

export { criticalApi } from './criticalApi'
export type { CriticalValueDto } from './criticalApi'

export { appointmentApi } from './appointmentApi'
export type { AppointmentDto } from './appointmentApi'

export { statsApi } from './statsApi'
export type { DailyStatsDto, WeeklyStatsDto, WorkloadDto, QualityDto } from './statsApi'

export { userApi } from './userApi'
export type { UserDto } from './userApi'

export { consultationApi } from './consultationApi'
export type { ConsultationDto } from './consultationApi'

export { queueApi } from './queueApi'
export type { QueueCallDto, ExamRoomStatus } from './queueApi'

export { termApi } from './termApi'
export type { TermDto, TermSuggestionDto, SynonymRelationDto, TranslationDto, ExtractedTermDto, CategoryTreeNodeDto } from './termApi'

export { insuranceApi } from './insuranceApi'
export type { InsuranceAuditDto } from './insuranceApi'

export { datareportApi } from './datareportApi'
export type { NationalReportDto, DataReportDto, InsuranceAuditDto as InsuranceAuditApiDto, EnterpriseSearchResult, ExamStatisticsDto, ReportLogDto, MonthlyTrendDto } from './datareportApi'

export { qcextApi } from './qcextApi'
export type { QcDashboardDto, QcImageDto, RadiologistAnnualDto, QcDefectDto, QcStatsDto, QcScoreDto } from './qcextApi'

export { regionalApi } from './regionalApi'
export type { RegionalImagingDto, RegionalReportDto, DepartmentScheduleDto, DepartmentDto, MedicalAllianceDto, IntegrationStatusDto, RegionalConsultationDto, RegionalReportRecordDto, CriticalValueReportDto, RemoteDiagnosisDto, CoSignRecordDto } from './regionalApi'

export { financeApi } from './financeApi'
export type { ChargeItemDto, InvoiceDto, RevenueAnalysisDto, CostAccountingDto, FinancialReportDto } from './financeApi'

export { cdsApi } from './cdsApi'
export type {
  CdsGuidelineDto, CdsAlertDto, CdsDoseMonitoringDto, CdsManagementDto,
} from './cdsApi'

export { caApi } from './caApi'
export type {
  CACertificateDto,
  SignDocumentRequest,
  SignDocumentResult,
  VerifySignatureRequest,
  VerifySignatureResult,
  SignatureRecord,
  CaConfig,
  CaHistoryEntry,
} from './caApi'

export { hl7Api, iheApi } from './integrationApi'
export type {
  Hl7Report, Hl7OruResponse, Hl7BatchResponse, Hl7OrmOrder, Hl7OrmResponse,
  Hl7DftTransaction, Hl7DftResponse, Hl7ArchiveRecord,
  MllpStatus, ConnectionLogEntry,
  AffinityDomain, IheStatus,
  PixFeedRequest, PixQueryRequest, PixQueryResult,
  PdqQueryRequest, PdqResult,
  PamMessageRequest, PamAckResponse, PamMessagesResponse, VisitState,
} from './integrationApi'

export { reportQualityApi } from './reportQualityApi'
export type {
  QualityRuleDimension,
  QualityGrade,
  QualityRulesResponse,
  ScoreRule,
  DefectEntry,
  QualityStatsData,
  EvaluateDto,
  QualityEvaluation,
} from './reportQualityApi'

export { templatesApi } from './templatesApi'
export type { TemplateDto, TemplateListParams } from './templatesApi'

export { backupApi } from './systemApi'
export type { AuditLogDto, AuditListParams, AuditStatsDto, AuditListResponse, BackupDto, BackupListParams } from './systemApi'

export { notificationApi } from './notificationTemplateDictApi'
export type { NotificationDto, CreateNotificationData, BroadcastNotificationData } from './notificationTemplateDictApi'

export { healthApi } from './healthApi'
export type { HealthCheckResponse, HealthReadyResponse } from './healthApi'

export { mfaApi } from './mfaApi'
export type { TotpSetupResponse, TotpVerifyResponse } from './mfaApi'

export { tenantApi } from './tenantApi'
export type { ComplianceReport } from './tenantApi'

export { patientPortalApi } from './patientPortalApi'
export type {
  PortalPatientDto,
  PortalClinicalDataDto,
  PortalEducationDto,
  PortalMobileUserDto,
  ExamHistoryItemDto,
  ImagePreviewDto,
} from './patientPortalApi'

export { complianceApi } from './complianceApi'
export type { ComplianceReportDto, ComplianceDocDto } from './complianceApi'

export { radsApi } from './radsApi'
export type { RadsScore, RadsHistoryEntry } from './radsApi'

export { exportApprovalApi, olapApi, analyticsStatsApi } from './analyticsApi'
export type {
  ExportApprovalDto, ExportApprovalListParams,
  OlapQueryDto, OlapMetadataDto,
  StatsDashboardDto,
  ForecastPointDto,
  UtilizationDto,
  AccuracyDto,
} from './analyticsApi'

export { triageApi } from './triageApi'
export type { TriageExamInput, TriageScoreResult, TriageFactor, TriagePendingItem } from './triageApi'

export { snomedApi } from './snomedApi'
export type { SnomedCode } from './snomedApi'

export { mobileApi } from './mobileApi'
export type { DoctorWorklistItem, DoctorStats } from './mobileApi'

export { crossModalSearchApi } from './dicomApi'
export type { CrossModalSearchResult } from './dicomApi'

export { systemAdminApi } from './systemAdminApi'
export type { SystemUserDto, SystemRoleDto, SystemConfigDto } from './systemAdminApi'

export { criticalStatsApi } from './criticalStatsApi'
export type { MissedReportStats, NotificationCompletionStats } from './criticalStatsApi'

export { eyePacsApi } from './eyePacsApi'
export type { EyeStudyDto, EyeMeasurementDto, KeyImageDto, LesionSegmentationDto, AiDiagnosisDto, EyeAnnotationDto } from './eyePacsApi'

export { smartRouteApi } from './smartRouteApi'
export type { SmartRouteRule, SmartRouteAssignment, SmartRouteStats, SmartRouteAssignDto } from './smartRouteApi'

export { teachApi } from './teachApi'
export type { TeachLecture, TeachLectureBlob, CreateLectureDto, LecturesQuery, LecturesResult } from './teachApi'

export { aiDraftApi } from './aiDraftApi'
export type { AiDraftParagraph, AiDraftResult, AiDraftGenerateDto, AiDraftRewriteDto, AiDraftRewriteResult, AiDraftContinueDto } from './aiDraftApi'

export { aiMarketplaceApi } from './aiMarketplaceApi'
export type { AiModel, DeployModelDto } from './aiMarketplaceApi'

// [v3.0.6.11-40] A9-A14 后端模块对接
export { dualReadApi } from './dualReadApi'
export type { DualReadAssignment, CreateDualReadDto, SubmitDualReadDto, ArbitrateDto, DualReadStats } from './dualReadApi'

export { qcImageAiApi } from './qcImageAiApi'
export type { QcImageAiResult, QcImageAiIssue, QcImageAiReviewDto, QcImageAiBatchDto, QcImageAiStats } from './qcImageAiApi'

export { aiPlatformApi } from './aiPlatformApi'
export type { AiPlatformModel, AiPlatformTask, AiPlatformInferenceDto, AiPlatformStats } from './aiPlatformApi'

export { aiDiagnosisApi } from './aiDiagnosisApi'
export type { AiDiagnosisResult, AiDiagnosisConfirmDto, AiDiagnosisQueryParams, AiDiagnosisStats } from './aiDiagnosisApi'

export { benchmarkApi } from './benchmarkApi'
export type { BenchmarkRecord, BenchmarkComparison, BenchmarkAiDiagnosis, BenchmarkQueryParams, BenchmarkReport } from './benchmarkApi'

export { dicomCompressApi } from './dicomCompressApi'
export type { DicomCompressTask, DicomCompressDto, DicomCompressBatchDto, DicomCompressStats } from './dicomCompressApi'

export { occupancyApi } from './occupancyApi'
export type { OccupancyRoom, OccupancyTimelineEntry, OccupancyStats, OccupancyQueryParams } from './occupancyApi'

export { oeeApi } from './oeeApi'
export type { OeeRecord, OeeSummary, OeeQueryParams, OeeTrend, OeeDowntimeReason } from './oeeApi'

export { teleApi } from './teleApi'
export type { TeleSession, TeleParticipant, CreateTeleSessionDto, TeleMessage, TeleStats } from './teleApi'

export { teleSignApi } from './teleSignApi'
export type { TeleSignSession, TeleSignDto, TeleSignRejectDto, TeleSignQueryParams, TeleSignStats } from './teleSignApi'

export { lungCadApi } from './lungCadApi'
export type { LungNodule, LungCadResult, LungCadReviewDto, LungCadStats } from './lungCadApi'

export { breastCadApi } from './breastCadApi'
export type { BreastLesion, BreastCadResult, BreastCadReviewDto, BreastCadStats } from './breastCadApi'

export { fractureCadApi } from './fractureCadApi'
export type { FractureFinding, FractureCadResult, FractureCadReviewDto, FractureCadStats } from './fractureCadApi'

export { cardiacAiApi } from './cardiacAiApi'
export type { CardiacMeasurement, CardiacAiResult, CardiacStenosis, CardiacAiReviewDto, CardiacAiStats } from './cardiacAiApi'

export { wadoRsApi } from './wadoRsApi'
export type { WadoRsStudy, WadoRsSeries, WadoRsInstance, WadoRsQueryParams } from './wadoRsApi'

export { stowRsApi } from './stowRsApi'
export type { StowRsStoreResult, StowRsStoreResponse, StowRsQueryParams, StowRsStoredInstance } from './stowRsApi'

export { srReportApi } from './srReportApi'
export type { SrReport, SrReportContent, SrFinding, SrMeasurement, CreateSrReportDto, SrReportQueryParams } from './srReportApi'

export { criticalAlertApi } from './criticalAlertApi'
export type { CriticalAlert, CriticalAlertQueryParams, AcknowledgeAlertDto, ResolveAlertDto, CriticalAlertStats } from './criticalAlertApi'

export { autoCollectionApi } from './autoCollectionApi'
export type { AutoCollectionRule, AutoCollectionTask, AutoCollectionConfig, AutoCollectionStats } from './autoCollectionApi'

export { deptDashboardApi } from './deptDashboardApi'
export type { DeptDashboardSummary, DeptDashboardWorkload, DeptDashboardEquipment, DeptDashboardTrend, DeptDashboardQueryParams } from './deptDashboardApi'

export { remoteReadingApi } from './remoteReadingApi'
export type { RemoteReadingSession, CreateRemoteReadingDto, RemoteReadingQueryParams, RemoteReadingStats } from './remoteReadingApi'

export { pacsAdminApi } from './pacsAdminApi'
export type { PacsServer, PacsStorageGroup, PacsAssociation, PacsQueryParams, PacsAdminStats } from './pacsAdminApi'

// [v3.0.6.11-42] F07 后端模块对接
export { criticalExtApi } from './criticalExtApi'
export type { CriticalExtRuleDto, CriticalExtStatsDto, CriticalExtSummaryDto, CriticalExtTimelineDto, CriticalExtCenterDto } from './criticalExtApi'

export { cadApi } from './cadApi'
export type { CadModelDto, CadAnalysisDto, CadFindingDto } from './cadApi'

export { complianceDocsApi } from './complianceDocsApi'
export type { ComplianceDocDto, ComplianceDocListParams } from './complianceDocsApi'

export { crossModalApi } from './crossModalApi'
export type { CrossModalSearchDto, CrossModalSearchResult, CrossModalIndexStatus } from './crossModalApi'

export { dicom4dApi } from './dicom4dApi'
export type { Dicom4dStudyDto, Dicom4dPlaybackDto, Dicom4dMeasurementDto, Dicom4dAnalysisDto } from './dicom4dApi'

// [v3.0.6.11-42] F08 后端模块对接
export { volumeApi } from './volumeApi'
export type { VolumeStudyDto, VolumeRenderDto, VolumeRenderResult, VolumeVrDto, VolumeMprDto, VolumeSegmentationDto } from './volumeApi'

export { worklistApi } from './worklistApi'
export type { WorklistItemDto, WorklistQueryParams, WorklistStatsDto } from './worklistApi'

export { notificationsApi } from './notificationsApi'
export type { NotificationDto, NotificationQueryParams, NotificationStatsDto, PushSubscriptionDto } from './notificationsApi'

export { olapApi } from './olapApi'
export type { OlapCubeDto, OlapQueryResult, OlapDrillDownDto, OlapChartDataDto } from './olapApi'

export { auditApi } from './auditApi'
export type { AuditEventDto, AuditQueryParams, AuditAggregationDto } from './auditApi'

export { fusionApi } from './fusionApi'
export type { FusionStudyDto, FusionRegisterDto, FusionRegistrationResult, FusionRenderDto, FusionRenderResult } from './fusionApi'

export { smartAuthApi } from './smartAuthApi'
export type { SmartAuthSessionDto, SmartAuthPolicyDto, SmartAuthRuleDto, SmartAuthMfaDto, SmartAuthVerifyDto } from './smartAuthApi'

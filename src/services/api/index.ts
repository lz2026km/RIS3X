export { api } from "./client";
export type {
  ApiResponse,
  PageResult,
  ApiError,
  ExamQueryParams,
  PatientQueryParams,
  ReportQueryParams,
} from "./types";

// [v3.0.6.11-79] W1-B 用户中心: auth 端点封装
export { authApi } from "./authApi";
export type { AuthLoginData, AuthMeDto, ChangePasswordResult } from "./authApi";

export {
  v3AiPlatformApi,
  v3AiAssistApi,
  v3AnalyticsApi,
  v3WritingApi,
  v3DistApi,
  v3IntegrationApi,
  v3QualityReportApi,
  v3PacsApi,
} from "./v3Api";
export type { AiReviewDto } from "./v3Api";

export { examApi } from "./examApi";
export type { ExamDto, CreateExamDto, UpdateExamDto } from "./examApi";
export type {
  ImportExamRow,
  ImportResultDto as ExamImportResult,
  ExportCsvDto as ExamExportCsv,
  // [v3.0.6.11-104 Wave 2B] 检查统计 / 时间线 / 备注
  ExamOverviewDto,
  ExamByModalityDto,
  ExamByModalityItem,
  ExamDailyTrendDto,
  ExamDailyTrendItem,
  ExamTimelineDto,
  ExamTimelineEvent,
  ExamNotesResult,
} from "./examApi";

export { patientApi } from "./patientApi";
export type { PatientDto } from "./patientApi";
export type { ImportPatientRow as PatientImportRow } from "./patientApi";
export type {
  // [v3.0.6.11-104 Wave 2B] 患者档案: 总览 / 年龄分布 / 摘要 / 就诊历史
  PatientOverviewDto,
  PatientAgeDistributionDto,
  PatientAgeBucket,
  PatientSummaryDto,
  PatientVisitHistoryDto,
  PatientVisitEvent,
} from "./patientApi";

// [W4-A v3.0.6.11-79] 数据字典: 分类列表 + 分类条目 CRUD
export { dictionaryApi } from "./dictionaryApi";
export type {
  DictEntryDto,
  DictCategoryDto,
  DictEntryInput,
} from "./dictionaryApi";

export { reportApi } from "./reportApi";
export type { ReportDto } from "./reportApi";

export { deviceApi } from "./deviceApi";
export type { DeviceDto, CreateDeviceDto, UpdateDeviceDto } from "./deviceApi";

export { fusionV2Api } from "./fusionV2Api";
export type {
  FusionV2RegisterDto,
  FusionV2RegisterResult,
  FusionV2RenderDto,
  FusionV2RenderResult,
  FusionV2SeriesItem,
  FusionV2SeriesResult,
} from "./fusionV2Api";

export { radpathApi } from "./radpathApi";
export type {
  RadPathCreateDto,
  RadPathUpdateConsistencyDto,
  RadPathRecord,
  RadPathStats,
} from "./radpathApi";

export { deviceMgmtApi } from "./deviceMgmtApi";
export type {
  EquipmentLifecycle,
  UpdateEquipmentLifecycleDto,
  DeviceMgmtItem,
  CreateDeviceMgmtDto,
  UpdateDeviceMgmtDto,
  DeviceFault,
  ReportDeviceFaultDto,
  Material,
  AddMaterialDto,
  DoseRecord,
  RecordDoseDto,
  AdverseReaction,
  ReportAdverseReactionDto,
  ContrastInventory,
  UpdateContrastInventoryDto,
  InjectionWorkstation,
  ContrastQuality,
} from "./deviceMgmtApi";

export { criticalApi } from "./criticalApi";
export type { CriticalValueDto } from "./criticalApi";

export { appointmentApi } from "./appointmentApi";
export type { AppointmentDto } from "./appointmentApi";

export { statsApi } from "./statsApi";
export type {
  DailyStatsDto,
  WeeklyStatsDto,
  WorkloadDto,
  QualityDto,
} from "./statsApi";

export { biApi } from "./biApi";
export type { KpiDto, DeviceOeeDto, WallTemplateDto } from "./biApi";

export { userApi } from "./userApi";
export type { UserDto } from "./userApi";

// [G005 Wave1B] 后端已实现 (consultations.controller)
export { consultationApi } from "./consultationApi";
export type { ConsultationDto } from "./consultationApi";

export { queueApi } from "./queueApi";
export type { QueueCallDto, ExamRoomStatus } from "./queueApi";

// [G005 W1-C] MOCK_ONLY: 后端无 controller, MSW 支撑
export { termApi } from "./termApi";
export type {
  TermDto,
  TermSuggestionDto,
  SynonymRelationDto,
  TranslationDto,
  ExtractedTermDto,
  CategoryTreeNodeDto,
} from "./termApi";

export { insuranceApi } from "./insuranceApi";
export type { InsuranceAuditDto } from "./insuranceApi";

export { datareportApi } from "./datareportApi";
export type {
  NationalReportDto,
  DataReportDto,
  InsuranceAuditDto as InsuranceAuditApiDto,
  EnterpriseSearchResult,
  ExamStatisticsDto,
  ReportLogDto,
  MonthlyTrendDto,
} from "./datareportApi";

export { qcextApi } from "./qcextApi";
export type {
  QcDashboardDto,
  QcImageDto,
  RadiologistAnnualDto,
  QcDefectDto,
  QcStatsDto,
  QcScoreDto,
} from "./qcextApi";

// [G005 v3.0.6.11-105 Wave 2B] 放射影像质控国标指标 (2024 版)
export { rqi2024Api, RQI_INDICATOR_CODES } from "./rqi2024Api";
export type {
  RqiIndicatorCode,
  RqiIndicatorStatus,
  RqiIndicatorUnit,
  RqiIndicatorDirection,
  RqiGranularity,
  RqiItemKind,
  RqiSource,
  RqiExportFormat,
  RqiCategoryKey,
  RqiWindowParams,
  RqiDimensionResult,
  RqiIndicator,
  RqiIndicatorsResult,
  RqiDetailItem,
  RqiDetailResult,
  RqiTrendPoint,
  RqiTrendResult,
  RqiMomItem,
  RqiDashboardResult,
  RqiIndicatorConfig,
  RqiIndicatorConfigInput,
  RqiConfigResult,
  RqiExportInput,
  RqiExportResult,
  RqiQualityIndicator,
  RqiQualityCategoryStat,
  RqiExtendedResult,
  RqiExtendedParams,
} from "./rqi2024Api";

export { regionalApi } from "./regionalApi";
export type {
  RegionalImagingDto,
  RegionalReportDto,
  DepartmentScheduleDto,
  DepartmentDto,
  MedicalAllianceDto,
  IntegrationStatusDto,
  RegionalConsultationDto,
  RegionalReportRecordDto,
  CriticalValueReportDto,
  RemoteDiagnosisDto,
  CoSignRecordDto,
} from "./regionalApi";

export { financeApi } from "./financeApi";
export type {
  ChargeItemDto,
  InvoiceDto,
  RevenueAnalysisDto,
  CostAccountingDto,
  FinancialReportDto,
} from "./financeApi";

export { cdsApi } from "./cdsApi";
export type {
  CdsGuidelineDto,
  CdsAlertDto,
  CdsDoseMonitoringDto,
  CdsManagementDto,
} from "./cdsApi";

export { caApi } from "./caApi";
export type {
  CACertificateDto,
  SignDocumentRequest,
  SignDocumentResult,
  VerifySignatureRequest,
  VerifySignatureResult,
  SignatureRecord,
  CaConfig,
  CaHistoryEntry,
} from "./caApi";

export { hl7Api, iheApi } from "./integrationApi";
export type {
  Hl7Report,
  Hl7OruResponse,
  Hl7BatchResponse,
  Hl7OrmOrder,
  Hl7OrmResponse,
  Hl7DftTransaction,
  Hl7DftResponse,
  Hl7ArchiveRecord,
  MllpStatus,
  ConnectionLogEntry,
  AffinityDomain,
  IheStatus,
  PixFeedRequest,
  PixQueryRequest,
  PixQueryResult,
  PdqQueryRequest,
  PdqResult,
  PamMessageRequest,
  PamAckResponse,
  PamMessagesResponse,
  VisitState,
} from "./integrationApi";

export { reportQualityApi } from "./reportQualityApi";
export type {
  QualityRuleDimension,
  QualityGrade,
  QualityRulesResponse,
  ScoreRule,
  DefectEntry,
  QualityStatsData,
  EvaluateDto,
  QualityEvaluation,
} from "./reportQualityApi";

export { templatesApi } from "./templatesApi";
export type { TemplateDto, TemplateListParams, TemplateCategoryDto } from "./templatesApi";

export { backupApi } from "./systemApi";
export type {
  AuditLogDto,
  AuditListParams,
  AuditStatsDto,
  AuditListResponse,
  BackupDto,
  BackupListParams,
} from "./systemApi";

export { notificationApi } from "./notificationTemplateDictApi";
export type {
  NotificationDto,
  CreateNotificationData,
  BroadcastNotificationData,
} from "./notificationTemplateDictApi";

export { healthApi } from "./healthApi";
export type { HealthCheckResponse, HealthReadyResponse } from "./healthApi";

export { mfaApi } from "./mfaApi";
export type { TotpSetupResponse, TotpVerifyResponse } from "./mfaApi";

export { tenantApi } from "./tenantApi";
export type {
  ComplianceReport,
  TenantFeatures,
  TenantProfile,
  TenantUsage,
} from "./tenantApi";

export { patientPortalApi } from "./patientPortalApi";
export type {
  PortalPatientDto,
  PortalClinicalDataDto,
  PortalEducationDto,
  PortalMobileUserDto,
  ExamHistoryItemDto,
  ImagePreviewDto,
  PortalAppointmentDto,
  CreatePortalAppointmentInput,
  PortalReportDto,
  PortalImageSeriesDto,
  PortalImageStudyDto,
  PortalFeedbackDto,
  CreatePortalFeedbackInput,
  CreateEducationInput,
} from "./patientPortalApi";

export { complianceApi } from "./complianceApi";
export type { ComplianceReportDto, ComplianceDocDto } from "./complianceApi";

export { radsApi } from "./radsApi";
export type { RadsScore, RadsHistoryEntry } from "./radsApi";

export { exportApprovalApi, analyticsStatsApi } from "./analyticsApi";
export type {
  ExportApprovalDto,
  ExportApprovalListParams,
  OlapQueryDto,
  OlapMetadataDto,
  StatsDashboardDto,
  ForecastPointDto,
  UtilizationDto,
  AccuracyDto,
} from "./analyticsApi";

export { triageApi } from "./triageApi";
export type {
  TriageExamInput,
  TriageScoreResult,
  TriageFactor,
  TriagePendingItem,
} from "./triageApi";

export { snomedApi } from "./snomedApi";
export type { SnomedCode } from "./snomedApi";

export { mobileApi } from "./mobileApi";
export type {
  WorklistItem,
  TodaySummary,
  CriticalValueItem,
  AckResult,
  LatestReportItem,
  DeviceTokenPayload,
  DeviceTokenResult,
  DoctorWorklistItem,
  DoctorStats,
} from "./mobileApi";

export { systemAdminApi } from "./systemAdminApi";
export type {
  SystemUserDto,
  SystemRoleDto,
  SystemConfigDto,
} from "./systemAdminApi";

export { criticalStatsApi } from "./criticalStatsApi";
export type {
  MissedReportStats,
  NotificationCompletionStats,
} from "./criticalStatsApi";

export { eyePacsApi } from "./eyePacsApi";
export type {
  EyeStudyDto,
  EyeMeasurementDto,
  KeyImageDto,
  LesionSegmentationDto,
  AiDiagnosisDto,
  EyeAnnotationDto,
} from "./eyePacsApi";

export { smartRouteApi } from "./smartRouteApi";
export type {
  SmartRouteRule,
  SmartRouteAssignment,
  SmartRouteStats,
  SmartRouteAssignDto,
} from "./smartRouteApi";

export { teachApi } from "./teachApi";
export type {
  TeachLecture,
  TeachLectureBlob,
  CreateLectureDto,
  LecturesQuery,
  LecturesResult,
} from "./teachApi";

export { aiDraftApi } from "./aiDraftApi";
export type {
  AiDraftParagraph,
  AiDraftResult,
  AiDraftGenerateDto,
  AiDraftRewriteDto,
  AiDraftRewriteResult,
  AiDraftContinueDto,
} from "./aiDraftApi";

export { aiMarketplaceApi } from "./aiMarketplaceApi";
export type { AiModel, DeployModelDto } from "./aiMarketplaceApi";

// [v3.0.6.11-40] A9-A14 后端模块对接
export { dualReadApi } from "./dualReadApi";
export type {
  DualReadAssignment,
  CreateDualReadDto,
  SubmitDualReadDto,
  ArbitrateDto,
  DualReadStats,
} from "./dualReadApi";

export { qcImageAiApi } from "./qcImageAiApi";
export type {
  QcImageAiResult,
  QcImageAiIssue,
  QcImageAiReviewDto,
  QcImageAiBatchDto,
  QcImageAiStats,
  QcImageAiScoreV2Dto,
  QcImageAiScoreV2Result,
  QcImageAiStatsV2,
  QcImageAiStatsV2Query,
} from "./qcImageAiApi";

export { aiPlatformApi } from "./aiPlatformApi";
export type {
  AiPlatformModel,
  AiPlatformTask,
  AiPlatformInferenceDto,
  AiPlatformStats,
  AiPlatformQcResult,
  AiPlatformMedicalDevice,
  AiPlatformTestResult,
} from "./aiPlatformApi";

export { aiDiagnosisApi } from "./aiDiagnosisApi";
export type {
  AiDiagnosisResult,
  AiDiagnosisConfirmDto,
  AiDiagnosisQueryParams,
  AiDiagnosisStats,
} from "./aiDiagnosisApi";

export { benchmarkApi } from "./benchmarkApi";
export type {
  BenchmarkRecord,
  BenchmarkComparison,
  BenchmarkAiDiagnosis,
  BenchmarkQueryParams,
  BenchmarkReport,
} from "./benchmarkApi";

export { dicomCompressApi } from "./dicomCompressApi";
export type {
  DicomCompressTask,
  DicomCompressDto,
  DicomCompressBatchDto,
  DicomCompressStats,
} from "./dicomCompressApi";

// [v3.0.6.11-99 Wave 2A] 报告批注 (报告详情/书写页协作批注)
export { reportAnnotationApi } from "./reportAnnotationApi";
export type {
  ReportAnnotation,
  ReportAnnotationReply,
  ReportAnnotationStats,
  ReportAnnotationStatus,
  CreateReportAnnotationDto,
} from "./reportAnnotationApi";

export { occupancyApi } from "./occupancyApi";
export type {
  OccupancyRoom,
  OccupancyQueue,
  OccupancyQueueEntry,
  OccupancyTrendPoint,
  RoomStatusValue,
} from "./occupancyApi";

export { oeeApi } from "./oeeApi";
export type {
  OeeDeviceMetric,
  OeeDeviceDetail,
  OeePoint,
  OeeStats,
} from "./oeeApi";

export { teleApi } from "./teleApi";
export type {
  TeleSession,
  TeleParticipant,
  CreateTeleSessionDto,
  TeleMessage,
  TeleStats,
  JoinTeleSessionDto,
  TeleSignalMessage,
  TeleChatMessageDto,
  TeleCursorDto,
} from "./teleApi";

export { teleSignApi } from "./teleSignApi";
export type {
  TeleSignSession,
  TeleSignDto,
  TeleSignRejectDto,
  TeleSignQueryParams,
  CreateTeleSignSessionInput,
} from "./teleSignApi";

export { lungCadApi } from "./lungCadApi";
export type {
  LungNodule,
  LungCadResult,
  LungCadReviewDto,
  LungCadStats,
} from "./lungCadApi";

export { breastCadApi } from "./breastCadApi";
export type {
  BreastLesion,
  BreastCadResult,
  BreastCadReviewDto,
  BreastCadStats,
} from "./breastCadApi";

export { fractureCadApi } from "./fractureCadApi";
export type {
  FractureFinding,
  FractureCadResult,
  FractureCadReviewDto,
  FractureCadStats,
} from "./fractureCadApi";

export { cardiacAiApi } from "./cardiacAiApi";
export type {
  CardiacMeasurement,
  CardiacAiResult,
  CardiacStenosis,
  CardiacAiReviewDto,
  CardiacAiStats,
} from "./cardiacAiApi";

export { wadoRsApi } from "./wadoRsApi";
export type {
  WadoRsStudy,
  WadoRsSeries,
  WadoRsInstance,
  WadoRsQueryParams,
} from "./wadoRsApi";

export { stowRsApi } from "./stowRsApi";
export type {
  StowRsStoreResult,
  StowRsStoreResponse,
  StowRsQueryParams,
  StowRsStoredInstance,
} from "./stowRsApi";

export { srReportApi } from "./srReportApi";
export { srDocumentApi } from "./srReportApi";
export type {
  SrReport,
  SrReportContent,
  SrFinding,
  SrMeasurement,
  CreateSrReportDto,
  SrReportQueryParams,
} from "./srReportApi";
export type {
  SrDocument,
  SrStatus,
  SrContentTree,
  SrSection,
  SrContentItem,
  SrConceptName,
  GenerateSrPayload,
  PushOruResult,
  SrTemplateInfo,
} from "./srReportApi";

export { criticalAlertApi } from "./criticalAlertApi";
export type {
  CriticalAlert,
  CriticalAlertQueryParams,
  AcknowledgeAlertDto,
  ResolveAlertDto,
  CriticalAlertStats,
} from "./criticalAlertApi";

// [G005 Wave1B] 后端已实现 (auto-collection.controller)
export { autoCollectionApi } from "./autoCollectionApi";
export type {
  AutoCollectionRule,
  AutoCollectionTask,
  AutoCollectionConfig,
  AutoCollectionStats,
} from "./autoCollectionApi";

export { remoteReadingApi } from "./remoteReadingApi";
export type {
  RemoteReadingSession,
  CreateRemoteReadingDto,
  RemoteReadingQueryParams,
  RemoteReadingStats,
} from "./remoteReadingApi";

// [G005 Wave1B] 后端已实现 (pacs-admin.controller)
export { pacsAdminApi } from "./pacsAdminApi";
export type {
  PacsServer,
  PacsStorageGroup,
  PacsAssociation,
  PacsQueryParams,
  PacsAdminStats,
} from "./pacsAdminApi";

// [v3.0.6.11-42] F07 后端模块对接
export { criticalExtApi } from "./criticalExtApi";
export type {
  CriticalExtRuleDto,
  CriticalExtStatsDto,
  CriticalExtSummaryDto,
  CriticalExtTimelineDto,
  CriticalExtCenterDto,
  CriticalChannelDto,
} from "./criticalExtApi";

export { cadApi } from "./cadApi";
export type { CadDetection, CadResult } from "./cadApi";

export { complianceDocsApi } from "./complianceDocsApi";
export type {
  ComplianceDocListParams,
} from "./complianceDocsApi";

export { crossModalApi } from "./crossModalApi";
export type {
  CrossModalSearchDto,
  CrossModalIndexStatus,
  CrossModalSimilarResult,
} from "./crossModalApi";
export type { CrossModalSearchResult as CrossModalHit } from "./dicomApi";
export { crossModalSearchApi } from "./dicomApi";
export { shareApi } from "./shareApi";
export type {
  ShareRecord,
  CreateShareDto,
  ShareStats,
  ShareLinkResult,
} from "./shareApi";

export { similarCaseApi } from "./similarCaseApi";
export type {
  SimilarCaseSearchDto,
  SimilarCaseResult,
  SimilarCaseFeedbackDto,
  // v3.0.6.11-62 影像级相似检索
  ImageSearchDto,
  ImageSearchResult,
  ImageFeatureSummary,
  ImageSeriesItem,
  HybridSearchDto,
  HybridSearchResult,
} from "./similarCaseApi";

export { dicom4dApi } from "./dicom4dApi";
export type {
  Series4D,
  FrameData4D,
  PhaseInfo4D,
} from "./dicom4dApi";

// [v3.0.6.11-42] F08 后端模块对接
// [G005 W1-C] 移除已删旧方法类型 VolumeStudyDto / VolumeRenderDto
export { volumeApi } from "./volumeApi";
export type {
  VolumeVrDto,
  VolumeMprDto,
  VolumeSegmentationDto,
} from "./volumeApi";

// [v3.0.6.11-101 Wave 2C] 影像分割深化 (segmentation-v2)
export { segmentationV2Api } from "./segmentationV2Api";
export type {
  SegmentationV2Algorithm,
  ThresholdMode,
  OrganClass,
  SegmentationV2SegmentDto,
  SegmentSummaryDto,
  SegmentationV2HistoryItemDto,
} from "./segmentationV2Api";

export { worklistApi } from "./worklistApi";
export type {
  WorklistItemDto,
  WorklistQueryParams,
  WorklistStatsDto,
} from "./worklistApi";

export { notificationsApi } from "./notificationsApi";
export type {
  NotificationType,
  NotificationSeverity,
  NotificationStatsDto,
  PushSubscriptionDto,
} from "./notificationsApi";

export { olapApi } from "./olapApi";
export type {
  OlapCubeDto,
  OlapQueryResult,
  OlapDrillDownDto,
  OlapChartDataDto,
} from "./olapApi";

export { auditApi } from "./auditApi";
export type {
  AuditEventDto,
  AuditQueryParams,
  AuditAggregationDto,
} from "./auditApi";

export { fusionApi } from "./fusionApi";
export type {
  FusionStudyDto,
  FusionRegisterDto,
  FusionRegistrationResult,
  FusionRenderDto,
  FusionRenderResult,
} from "./fusionApi";

// [G005 W1-C] smartAuthApi 移除 /smart-auth/* 孤儿段, 同步移除已删 DTO 类型导出
export { smartAuthApi } from "./smartAuthApi";

export { kioskApi } from "./kioskApi";
export type {
  KioskPatientDto,
  KioskCheckInRequest,
  KioskCheckInResultDto,
  KioskTodayStatsDto,
} from "./kioskApi";

export { screeningApi } from "./screeningApi";
export type {
  ScreeningStatsDto,
  ScreeningQueueItemDto,
  ScreeningTrendDto,
} from "./screeningApi";

// [W1-A v3.0.6.11-79] 文件管理 (upload-url / upload / upload-complete / download)
export { filesApi } from "./filesApi";
export type {
  UploadUrlDto,
  UploadResultDto,
  UploadCompletePayload,
  UploadedFileRecord,
  DownloadResult,
} from "./filesApi";

// [Wave2A] 胶片打印 + 科研数据 (DicomViewerPage / ResearchPage 真实化)
export { printApi } from "./printApi";
export type {
  PrintTaskDto,
  PrintTaskStatus,
  PrinterDto,
  PrintStatsDto,
} from "./printApi";
export { researchApi } from "./researchApi";
export type {
  ResearchProjectDto,
  ExamRecordDto,
  ResearchLabelDto,
  ExportRecordDto,
  IRBSubmissionDto,
  CohortDefinitionDto,
  ExportAuditDto,
  DataQualityScoreDto,
} from "./researchApi";

// [v3.0.6.11-101 Wave 3B] 影像测量 V2 + 标注 V2 双向同步 (8 工具确定性测量 / 标注 CRUD / 版本回滚)
export { measurementV2Api } from "./measurementV2Api";
export type {
  MeasureV2Type,
  AnnotationV2Type,
  Point2D,
  MeasurementTypeMeta,
  ComputeResult,
  MeasurementV2Record,
  MeasurementV2Version,
  AnnotationV2Record,
  AnnotationV2Version,
  CreateMeasurementV2Dto,
  CreateAnnotationV2Dto,
  ConvertCoordinatesInput,
  ConvertCoordinatesResult,
} from "./measurementV2Api";

// [v3.0.6.11-101 Wave 7C] 报告 V2: AI 二次检出 V2 (F14) + 委员会会诊 V2 (F6) + 报告互评 (F9)
export { aiSecondReadApi } from "./aiSecondReadApi";
export type {
  SecondReadCategory,
  SecondReadSeverity,
  SecondReadRiskStatus,
  SecondReadRiskLevel,
  SecondReadRiskItem,
  SecondReadFeatureStats,
  SecondReadResult,
  SecondReadInput,
  SecondReadStatsData,
} from "./aiSecondReadApi";
export { consultationV2Api } from "./consultationV2Api";
export type {
  RoomMemberRole,
  MemberStatus,
  RoomStatus,
  VoteOpinion,
  RoomMember,
  RoomMessage,
  RoomVote,
  SignatureEntry,
  RoomConclusion,
  ConsultationRoomV2,
  VoteSummary,
  ExportRecord,
  ConsultationV2Stats,
  CreateRoomInput,
} from "./consultationV2Api";
export { reportPeerReviewApi } from "./reportPeerReviewApi";
export type {
  ScoreDimension,
  PeerReviewStatus,
  PeerScores,
  PeerReviewTask,
  PeerReviewStats,
  AssignPeerReviewInput,
  PeerDimensionMeta,
} from "./reportPeerReviewApi";

// [v3.0.6.11-104 Wave 3B] 对比剂安全闭环 (过敏试验 + 注射前核查 + 注射后留观)
export { contrastSafetyApi } from "./contrastSafetyApi";
export type {
  ContrastAllergyResult,
  ContrastAllergyTestRecord,
  ContrastAllergyTestList,
  RecordAllergyTestDto,
  PreInjectionCheckDto,
  PreInjectionCheckItem,
  PreInjectionCheckResult,
  ContrastInjectionDto,
  ContrastInjectionResult,
  ObservationRecordEntry,
  ContrastObservation,
  StartObservationDto,
  AddObservationRecordDto,
  DischargeObservationDto,
} from "./contrastSafetyApi";



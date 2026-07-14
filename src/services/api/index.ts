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
export type { TermDto } from './termApi'

export { insuranceApi } from './insuranceApi'
export type { InsuranceAuditDto } from './insuranceApi'

export { datareportApi } from './datareportApi'
export type { NationalReportDto, DataReportDto, InsuranceAuditDto as InsuranceAuditApiDto, EnterpriseSearchResult } from './datareportApi'

export { qcextApi } from './qcextApi'
export type { QcDashboardDto, QcImageDto, RadiologistAnnualDto, QcDefectDto, QcStatsDto, QcScoreDto } from './qcextApi'

export { regionalApi } from './regionalApi'
export type { RegionalImagingDto, RegionalReportDto, DepartmentScheduleDto, DepartmentDto, MedicalAllianceDto, IntegrationStatusDto } from './regionalApi'

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

export { auditApi, backupApi } from './systemApi'
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
} from './analyticsApi'

// ============================================================
// G005 放射科RIS系统 - 类型定义 v3.0.3.31
// v3.0.3.31 报告子系统全面升级 - 20 态状态机 + 5 新接口
// 安全加固版：移除password字段，引入RBAC权限控制
// ============================================================


import { UserSchema, PatientSchema, ExamSchema, ReportSchema } from '../utils/validation';

// ---------- 基础枚举 ----------
export type Gender = '男' | '女' | '其他';
export type PatientType = '门诊' | '住院' | '体检' | '急诊';
export type ExamStatus = '待登记' | '已登记' | '已报到' | '待检查' | '检查中' | '待报告' | '已报告' | '已发布' | '已取消' | '检查异常' | '已暂停' | '已归档';

// [v1.0.1 R0] 报告全生命周期 14 态状态机
// 旧 6 态：未开始 | 书写中 | 待审核 | 已审核 | 已发布 | 已驳回
// 新 14 态：在保留旧 5 态基础上扩展分配/初终审/签发/修订/撤回/归档
// v3.0.3.31 新增 5 态:CoSign双签 / 已升级 / 整改中 / 补充中 / 已补充
export type ReportStatus =
  | '待分配' | '已分配' | '书写中' | '已提交'
  | '初审中' | '初审通过' | '终审中' | '已审核' | 'CoSign双签'
  | '签发中' | '已签发' | '已发布'
  | '修订中' | '已修订' | '已撤回' | '已驳回' | '已归档'
  | '已暂停' | '质控退回' | '已升级' | '整改中' | '补充中' | '已补充';

// 状态分组（用于 UI 筛选分组）
export type ReportStatusGroup = 'draft' | 'review' | 'sign' | 'published' | 'special';
export type ModalityType = 'CT' | 'MR' | 'DR' | 'DSA' | 'CR' | 'MG' | 'RF' | 'US' | 'PET-CT' | 'SPECT' | 'GI';
export type BodyPart = '头颅' | '颈部' | '胸部' | '腹部' | '盆腔' | '脊柱' | '四肢' | '心脏' | '血管' | '全身';
export type Priority = '普通' | '紧急' | '危重' | '会诊';
export type UserRole = '医生' | '技师' | '护士' | '管理员' | '主任';

// 【S1安全加固】用户类型 - 移除password字段，使用token机制
export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  phone: string;
  username: string;
  // password字段已移除 - 使用token机制进行身份验证
  title?: string;        // 职称：主任医师/副主任医师/主治医师/住院医师
  specialty?: string;    // 专业：CT/MR/DSA/DR
  permissions?: Permission[]; // 细粒度权限
}

// 【S6 RBAC】权限定义
export type Permission = 
  // 患者管理
  | 'patient:read' | 'patient:create' | 'patient:update' | 'patient:delete'
  // 检查管理
  | 'exam:read' | 'exam:create' | 'exam:update' | 'exam:delete' | 'exam:submit'
  // 报告管理
  | 'report:read' | 'report:create' | 'report:update' | 'report:delete' | 'report:sign' | 'report:audit' | 'report:publish'
  // 设备管理
  | 'device:read' | 'device:create' | 'device:update' | 'device:delete' | 'device:maintenance'
  // 打印管理
  | 'print:read' | 'print:create' | 'print:cancel' | 'print:reprint'
  // 系统管理
  | 'user:read' | 'user:create' | 'user:update' | 'user:delete' | 'user:reset-password'
  // 统计报表
  | 'statistics:view' | 'statistics:export'
  // 审核管理
  | 'audit:view' | 'audit:export'
  // 危急值
  | 'critical:manage' | 'critical:notify';

// 【S6 RBAC】角色权限映射
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  '医生': [
    'patient:read', 'patient:create',
    'exam:read', 'exam:create', 'exam:update',
    'report:read', 'report:create', 'report:update', 'report:sign',
    'device:read', 'print:read', 'print:create',
    'statistics:view',
    'critical:manage', 'critical:notify',
  ],
  '技师': [
    'patient:read',
    'exam:read', 'exam:create', 'exam:update', 'exam:submit',
    'device:read', 'device:maintenance',
    'print:read', 'print:create', 'print:cancel', 'print:reprint',
    'statistics:view',
  ],
  '护士': [
    'patient:read', 'patient:create',
    'exam:read', 'exam:create',
    'print:read', 'print:create',
    'statistics:view',
  ],
  '管理员': [
    'patient:read', 'patient:create', 'patient:update', 'patient:delete',
    'exam:read', 'exam:create', 'exam:update', 'exam:delete', 'exam:submit',
    'report:read', 'report:create', 'report:update', 'report:delete', 'report:sign', 'report:audit', 'report:publish',
    'device:read', 'device:create', 'device:update', 'device:delete', 'device:maintenance',
    'print:read', 'print:create', 'print:cancel', 'print:reprint',
    'user:read', 'user:create', 'user:update', 'user:delete', 'user:reset-password',
    'statistics:view', 'statistics:export',
    'audit:view', 'audit:export',
    'critical:manage', 'critical:notify',
  ],
  '主任': [
    'patient:read', 'patient:create', 'patient:update',
    'exam:read', 'exam:create', 'exam:update', 'exam:submit',
    'report:read', 'report:create', 'report:update', 'report:sign', 'report:audit', 'report:publish',
    'device:read', 'device:create', 'device:update', 'device:maintenance',
    'print:read', 'print:create', 'print:cancel', 'print:reprint',
    'user:read', 'user:create', 'user:update',
    'statistics:view', 'statistics:export',
    'audit:view', 'audit:export',
    'critical:manage', 'critical:notify',
  ],
};

// 【S6 RBAC】检查用户是否有特定权限
export function hasPermission(user: User, permission: Permission): boolean {
  if (!user.permissions) {
    // Fall back to role-based permissions
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
  }
  return user.permissions.includes(permission);
}

// 【S6 RBAC】检查用户是否有任意一个权限
export function hasAnyPermission(user: User, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(user, p));
}

// 【S6 RBAC】检查用户是否有所有权限
export function hasAllPermissions(user: User, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(user, p));
}

// 【S8 审计日志】操作类型枚举
export type AuditAction =
  | 'create' | 'read' | 'update' | 'delete' | 'submit'
  | 'login' | 'logout' | 'refresh_token'
  | 'sign_report' | 'audit_report' | 'publish_report'
  | 'print' | 'cancel_print' | 'reprint'
  | 'export' | 'import'
  | 'settings_change' | 'permission_change';

// 【S8 审计日志】实体类型
export type AuditEntityType = 
  | 'patient' | 'exam' | 'report' | 'template' 
  | 'device' | 'user' | 'print_job' | 'system';

// 【S8 审计日志】审计日志条目
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// 【S7 会话管理】会话信息
export interface SessionInfo {
  userId: string;
  userName: string;
  role: UserRole;
  loginTime: string;
  lastActivity: string;
  tokenExpiry: string;
  ipAddress?: string;
}

// 【S9 打印水印】水印配置
export interface WatermarkConfig {
  enabled: boolean;
  patientName?: boolean;
  examDate?: boolean;
  reportDate?: boolean;
  hospitalName?: boolean;
  customText?: string;
  opacity: number;
  position: 'center' | 'corner' | 'diagonal';
}

// 【S9 打印水印】胶片打印配置
export interface FilmPrintConfig {
  filmSize: '8x10' | '10x12' | '11x14' | '14x14';
  orientation: 'portrait' | 'landscape';
  layout: '1x1' | '2x2' | '2x3' | '3x4';
  brightness: number;
  contrast: number;
  filters?: string[];
  watermark: WatermarkConfig;
  copies: number;
}

// ---------- 患者 ----------
export interface Patient {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  birthDate?: string;
  phone: string;
  idCard: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  patientType: PatientType;
  allergyHistory: string;
  medicalHistory: string;
  registrationDate: string;
  lastExamDate?: string;
  totalExamCount: number;
  insuranceType?: string;
  bedNumber?: string;
  attendingDoctor?: string;
}

// ---------- 检查项目 ----------
export interface ExamItem {
  id: string;
  code: string;
  name: string;
  modality: ModalityType;
  bodyPart: BodyPart;
  price: number;
  preparationInstructions?: string;
  duration: number;
  isActive: boolean;
}

// ---------- 放射检查 ----------
export interface RadiologyExam {
  id: string;
  patientId: string;
  patientName: string;
  gender: Gender;
  age: number;
  patientType: PatientType;
  examItemId: string;
  examItemName: string;
  modality: ModalityType;
  bodyPart: BodyPart;
  examDate: string;
  examTime?: string;
  scheduledTime?: string;
  priority: Priority;
  clinicalDiagnosis?: string;
  clinicalHistory?: string;
  examIndications?: string;
  relevantLabResults?: string;
  priorImagingSummary?: string;
  technologistId?: string;
  technologistName?: string;
  radiologistId?: string;
  radiologistName?: string;
  deviceId?: string;
  deviceName?: string;
  roomId?: string;
  roomName?: string;
  referringDoctorId?: string;
  referringDoctorName?: string;
  referringDoctorDept?: string;
  thumbnailUrl?: string;
  status: ExamStatus;
  findings?: string;
  diagnosis?: string;
  impression?: string;
  comparisonWithPrior?: string;
  recommendations?: string;
  criticalFinding?: boolean;
  criticalFindingDetails?: string;
  reportId?: string;
  reportTime?: string;
  publishedTime?: string;
  imagesAcquired: number;
  accessionNumber: string;
  studyInstanceUID?: string;
  createdTime: string;
  updatedTime: string;
}

// ---------- 放射报告 ----------
export interface RadiologyReport {
  id: string;
  reportId: string;
  examId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  gender: Gender;
  age: number;
  patientType: PatientType;
  examItemName: string;
  modality: ModalityType;
  bodyPart: BodyPart;
  examDate: string;
  deviceName?: string;
  clinicalHistory?: string;
  examFindings: string;
  diagnosis: string;
  impression: string;
  recommendations?: string;
  comparisonWithPrior?: string;
  criticalFinding: boolean;
  criticalFindingDetails?: string;
  qualityScore?: number;
  templateId?: string;
  templateName?: string;
  reportDoctorId?: string;
  reportDoctorName?: string;
  signedTime?: string;
  reportVerificationCode?: string;
  auditorId?: string;
  auditorName?: string;
  approvedTime?: string;
  auditVerificationCode?: string;
  auditSuggestion?: string;
  status: ReportStatus;
  isPreliminary: boolean;
  isAddendum: boolean;
  addendumReportId?: string;
  publishedTime?: string;
  publishedBy?: string;
  createdTime: string;
  updatedTime: string;
  // [v1.0.1] 任务分配
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  assignedTime?: string;
  // [v1.0.1] 审核流程
  initialAuditDoctorId?: string;
  initialAuditDoctorName?: string;
  initialAuditTime?: string;
  initialAuditSuggestion?: string;
  finalAuditDoctorId?: string;
  finalAuditDoctorName?: string;
  finalAuditTime?: string;
  // [v1.0.1] 报告溯源
  reportSource?: 'manual' | 'template' | 'ai-assist' | 'voice';
  wordCount?: number;
  draftSavedAt?: string;
  // [v1.0.1] 时效监控
  timelinessFlag?: 'onTime' | 'late' | 'overdue';
  expectedFinishTime?: string;
  // [v1.0.1] 修订链
  addendumChainIds?: string[];
  // [v3.0.2.10] 患者扩展
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  allergies?: string;
  smokingHistory?: string;
  contrastAllergy?: boolean;
  eGFR?: number;
  gestationalWeeks?: number;
  // [v3.0.2.10] 检查扩展
  contrastName?: string;
  contrastDose?: string;
  contrastBatchNo?: string;
  injectionMethod?: string;
  radiationDose?: number;
  dlp?: number;
  ctdiVol?: number;
  kVp?: number;
  mA?: number;
  exposureTime?: number;
  examInstitution?: string;
  reportInstitution?: string;
  deviceSerialNumber?: string;
  softwareVersion?: string;
  // [v3.0.2.10] 报告结构
  reportTitle?: string;
  methodology?: string;
  limitations?: string;
  resultSummary?: string;
  keyImageCount?: number;
  appendix?: string;
  references?: string;
  // [v3.0.2.10] 发现结构化
  findingsSegments?: { title: string; content: string }[];
  lesionLocations?: string[];
  lesionSizes?: string[];
  lesionMorphology?: string;
  lesionMargins?: string;
  lesionDensity?: string;
  enhancementPattern?: string;
  lesionStability?: 'new' | 'stable' | 'improved' | 'progressed';
  // [v3.0.2.10] 诊断扩展
  mainDiagnosis?: string;
  differentialDiagnosis?: string[];
  acrScore?: number;
  clinicalQuestion?: string;
  icdCode?: string;
  snomedCode?: string;
  radlexCode?: string;
  // [v3.0.2.10] 测量扩展
  suvMax?: number;
  suvMean?: number;
  adc?: number;
  doublingTime?: number;
  // [v3.0.2.10] 质量扩展
  completenessScore?: number;
  accuracyScore?: number;
  terminologyScore?: number;
  timelinessScore?: number;
  overallGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
  spellingErrors?: number;
  guidelineAdherence?: boolean;
  // [v3.0.3.31] CoSign 双签 / 升级 / 整改 / 补充
  coSignRequired?: boolean;
  escalatedTo?: string;
  escalatedToName?: string;
  escalatedAt?: string;
  escalationReason?: string;
  rectifyingReason?: string;
  supplementNote?: string;
  supplementedAt?: string;
  rejectReason?: string;
  peerReviewStatus?: 'pending' | 'passed' | 'failed' | 'not_required';
  // [v3.0.2.10] 工作流扩展
  previousVersions?: string[];
  nextReviewDate?: string;
  slaDeadline?: string;
  overriddenBy?: string;
  overrideReason?: string;
  escalationLevel?: number;
  // [v3.0.2.10] 审计安全
  signingIP?: string;
  signingDevice?: string;
  encryptionHash?: string;
  consentVerified?: boolean;
  dataRetentionDate?: string;
  auditEventId?: string;
  // [Phase R3/R6]
  structuredFields?: StructuredField[];
  measurements?: Measurement[];
  annotations?: Annotation[];
  images?: ReportImage[];
  voiceTranscript?: string;
  signature?: DigitalSignature;
  blockchainHash?: string;
}

// [v1.0.1 R0] 结构化字段值
export interface StructuredField {
  templateFieldId: string;
  fieldKey: string;
  fieldLabel: string;
  value: string | number | string[];
  unit?: string;
  dataType: 'text' | 'number' | 'enum' | 'multi-enum' | 'date' | 'scale' | 'boolean';
  options?: { label: string; value: string; color?: string }[];
  category?: string;
}

// [v1.0.1 R0] 病灶测量
export interface Measurement {
  id: string;
  type: 'length' | 'area' | 'volume' | 'angle' | 'density';
  value: number;
  unit: string;
  location: string;
  lesionNumber: number;
  imageSliceIndex: number;
  coordinates: { x: number; y: number; z?: number }[];
  isTarget: boolean;
}

// [v1.0.1 R0] 图像标注
export interface Annotation {
  id: string;
  type: 'arrow' | 'circle' | 'rect' | 'text' | 'ruler' | 'freehand';
  coordinates: any;
  color: string;
  label?: string;
  authorId: string;
  timestamp: string;
}

// [v1.0.1 R0] 报告图
export interface ReportImage {
  id: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  thumbnailUrl: string;
  caption?: string;
  measurementIds?: string[];
}

// [v1.0.1 R0] 数字签名
export interface DigitalSignature {
  certificateId: string;
  signerName: string;
  signerTitle: string;
  signedAt: string;
  signatureValue: string;
  certificateChain: string[];
  timestampAuthority: string;
  algorithm: 'RSA-SHA256' | 'SM3-SM2';
}

// ---------- 报告模板 ----------
export interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  modality: ModalityType;
  bodyPart: BodyPart;
  level: 'default' | 'dept' | 'personal';
  content: string;
  sections?: TemplateSection[];
  createdBy: string;
  usageCount: number;
  isActive: boolean;
  isFavorite?: boolean;
}

export interface TemplateSection {
  title: string;
  content: string;
  order: number;
}

// ---------- 设备/仪器 ----------
export interface ModalityDevice {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  modality: ModalityType;
  department: string;
  roomNumber?: string;
  status: '空闲' | '使用中' | '维护中' | '维修中' | '已报废';
  acquisitionYear?: number;
  dailyCapacity?: number;
  currentLoad?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
}

// ---------- 检查室 ----------
export interface ExamRoom {
  id: string;
  name: string;
  roomNumber: string;
  modality: ModalityType[];
  deviceId?: string;
  deviceName?: string;
  status: '空闲' | '使用中' | '维护中';
  currentPatient?: string;
  todaysBookings?: number;
}

// ---------- 预约 ----------
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  gender: Gender;
  age: number;
  patientType: PatientType;
  examItemId: string;
  examItemName: string;
  modality: ModalityType;
  appointmentDate: string;
  appointmentTime: string;
  deviceId?: string;
  deviceName?: string;
  roomId?: string;
  roomName?: string;
  technologistId?: string;
  technologistName?: string;
  priority: Priority;
  clinicalDiagnosis?: string;
  notes?: string;
  status: '待确认' | '已确认' | '已登记' | '已完成' | '已取消' | '迟到';
  createdTime: string;
}

// ---------- 危急值 ----------
export interface CriticalValue {
  id: string;
  reportId: string;
  examId: string;
  patientId: string;
  patientName: string;
  modality: ModalityType;
  examItemName: string;
  criticalFinding: string;
  findingDetails: string;
  severity: '高危' | '危急';
  reportedBy: string;
  reportedByName: string;
  reportedTime: string;
  receivingDoctorId?: string;
  receivingDoctorName?: string;
  receivingTime?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedTime?: string;
  followUpNotes?: string;
  status: '待通知' | '已通知' | '已接收' | '已处理';
}

// ---------- 词汇库 ----------
export interface TermItem {
  id: string;
  category: string;
  modality: ModalityType[];
  keyword: string;
  pinyin: string;
  fullTerm: string;
  synonyms?: string[];
  typicalFindings?: string;
  typicalDiagnosis?: string;
  usageExamples?: string[];
  isActive: boolean;
}

// ---------- 统计 ----------
export interface StatisticsData {
  today: { exams: number; reports: number; pending: number; critical: number };
  week: { exams: number; reports: number; critical: number };
  month: { exams: number; reports: number; critical: number; revenue: number };
  byModality: Record<ModalityType, number>;
  byBodyPart: Record<string, number>;
}

// ---------- 医师排班 ----------
export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctorName: string;
  modality: ModalityType;
  date: string;
  shiftType: '上午' | '下午' | '夜班' | '全天' | '休息';
  roomId?: string;
  roomName?: string;
  status: '已排班' | '请假' | '替班';
  notes?: string;
}

// ---------- 数据字典 ----------
export interface DictionaryItem {
  id: string;
  category: string;
  code: string;
  name: string;
  pinyin: string;
  sortOrder: number;
  isActive: boolean;
  extra?: Record<string, string>;
}

// ---------- 科室工作负载 ----------
export interface WorkloadStats {
  doctorId: string;
  doctorName: string;
  modality: ModalityType;
  todayReports: number;
  weekReports: number;
  monthReports: number;
  avgReportTime: number;
  criticalFindings: number;
  qualityScore: number;
}

// ---------- DICOM工作列表项 ----------
export interface DicomWorklistItem {
  patientId: string;
  patientName: string;
  patientBirthDate?: string;
  patientSex?: Gender;
  accessionNumber: string;
  studyInstanceUID?: string;
  examItemName: string;
  modality: ModalityType;
  bodyPart: BodyPart;
  clinicalHistory?: string;
  requestingPhysician?: string;
  scheduledDate: string;
  scheduledTime: string;
  roomName?: string;
  deviceName?: string;
  priority?: Priority;
  status: 'scheduled' | 'arrived' | 'in-progress' | 'completed' | 'cancelled';
}

// ---------- 影像质量控制 ----------
export interface ImageQCRecord {
  id: string;
  examId: string;
  reportId: string;
  modalitiesAcquired: string[];
  imageCount: number;
  requiredImages: number;
  missingSequences?: string[];
  qualityIssue?: string;
  score: number;
  qcDoctorId?: string;
  qcDoctorName?: string;
  qcTime?: string;
  notes?: string;
}

// ---------- 体检接口 ----------
export interface PhysicalExamOrder {
  orderId: string;
  patientId: string;
  patientName: string;
  gender: Gender;
  age: number;
  examItems: { itemId: string; itemName: string; modality: ModalityType }[];
  packageName?: string;
  appointmentDate: string;
  status: '待检查' | '部分完成' | '已完成' | '已取消';
  hospitalName?: string;
  notes?: string;
}

// ---------- 设备维护记录 ----------
export interface DeviceMaintenance {
  id: string;
  deviceId: string;
  deviceName: string;
  modality: ModalityType;
  maintenanceType: '日常维护' | '定期保养' | '故障维修' | '性能检测' | '校准';
  performedBy: string;
  performedDate: string;
  nextMaintenanceDate?: string;
  cost?: number;
  status: '已完成' | '进行中' | '已延期';
  notes?: string;
  partsReplaced?: string[];
}

// ---------- 会诊记录 ----------
export interface Consultation {
  id: string;
  reportId: string;
  examId: string;
  patientId: string;
  patientName: string;
  modality: ModalityType;
  examItemName: string;
  requestingDoctorId: string;
  requestingDoctorName: string;
  requestingDepartment: string;
  consultedDoctorId?: string;
  consultedDoctorName?: string;
  consultedDepartment?: string;
  consultationType: '疑难病例' | 'MDT' | '远程会诊' | '二次意见';
  status: '待回复' | '已回复' | '已拒绝' | '已取消' | '已完成';
  requestTime: string;
  responseTime?: string;
  requestReason: string;
  responseContent?: string;
  isRemote: boolean;
  remotePlatform?: string;
}

// ---------- 排程/叫号 ----------
export interface QueueCall {
  id: string;
  roomId: string;
  roomName: string;
  modality: ModalityType;
  patientId: string;
  patientName: string;
  examItemName: string;
  queueNumber: number;
  calledNumber?: number;
  status: '等待中' | '已叫号' | '检查中' | '已完成';
  calledTime?: string;
  examStartTime?: string;
  examEndTime?: string;
}

// ---------- 打印任务 ----------
export interface PrintJob {
  id: string;
  patientId: string;
  patientName: string;
  examId: string;
  studyInstanceUID: string;
  modality: ModalityType;
  filmSize: string;
  copies: number;
  priority: 'normal' | 'urgent';
  status: 'Pending' | 'Printing' | 'Completed' | 'Failed';
  requestedBy: string;
  requestedTime: string;
  completedTime?: string;
  printerId: string;
  printerName: string;
  errorMessage?: string;
}

// ---------- 旧版审核日志（兼容） ----------
export interface LegacyAuditLog {
  id: string;
  entityType: 'report' | 'exam' | 'patient' | 'template';
  entityId: string;
  action: string;
  operatorId: string;
  operatorName: string;
  operatorRole: UserRole;
  details?: string;
  timestamp: string;
}
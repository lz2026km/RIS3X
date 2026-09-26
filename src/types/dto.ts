// RED07: Consolidated DTO types extracted from src/services/api/*.ts

export interface PatientDto {
  id: string
  patientId?: string
  name: string
  patientName?: string
  gender: string
  age: number
  birthDate?: string
  phone?: string
  idCard?: string
  address?: string
  patientType?: string
  insuranceType?: string
  emergencyContact?: string
  allergyHistory?: string
  medicalHistory?: string
  bloodType?: string
  department?: string
  diagnosis?: string
  lastVisitAt?: string
  registeredAt?: string
}

export interface ReportDto {
  id: string
  reportId: string
  patientId: string
  patientName: string
  examId: string
  modality: string
  bodyPart: string
  status: string
  findings?: string
  // [v3.0.6.11-98 Wave 1A P0] 富文本 HTML 持久化 (书写页图片/表格/格式)
  htmlContent?: string
  diagnosis?: string
  impression?: string
  recommendations?: string
  createdTime: string
  updatedTime: string
  doctorId?: string
  qualityScore?: number
  reviewerId?: string
  coSignerId?: string
  qcGrade?: string
  defectCount?: number
  icd10?: string
  clinicalDiagnosis?: string
  priority?: string
  hasCriticalValue?: boolean
  reportAt?: string
  reviewedAt?: string
  signedAt?: string
  signatureHash?: string
  rejectReason?: string
  reviseReason?: string
  // [v3.0.6.11-92 Wave1B P0] 后端 reports.service.toReportDto 已返回 state (ReportState 大写枚举)
  state?: string
}

export interface ExamDto {
  id: string
  examId: string
  patientId: string
  patientName: string
  gender: string
  age: number
  modality: string
  bodyPart: string
  status: string
  priority: string
  scheduledAt: string
  patientType: string
  deviceId?: string
  roomId?: string
  doctorId?: string
  contrastUsed?: boolean
  radiationDose?: number
  dlp?: number
  technicianId?: string
  imageCount?: number
  examItem?: string
  examItemName?: string
  deviceName?: string
  deviceModel?: string
  hasCriticalValue?: boolean
  // [v3.0.6.11-95 Wave 1A 技师工作站] 注释/评级/重拍计数
  techNotes?: string
  qcNotes?: string
  qualityRating?: string
  retakeCount?: number
}

export interface CreateExamDto {
  patientId: string
  accessionNumber: string
  modality: string
  bodyPart: string
  scheduledAt?: string
  deviceId?: string
}

export interface UpdateExamDto {
  state?: string
  startedAt?: string
  completedAt?: string
  deviceId?: string
}

export interface UserDto {
  id: string
  username: string
  fullName: string
  role: 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'
  department?: string
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateUserDto {
  username: string
  password: string
  fullName: string
  role: 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'
  department?: string
}

export interface UpdateUserDto {
  fullName?: string
  role?: 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'
  department?: string
  active?: boolean
}

export interface AppointmentDto {
  id: string
  patientId: string
  patientName: string
  doctorId?: string
  doctorName?: string
  date: string
  timeSlot: string
  status: string
  modality?: string
  notes?: string
}

export interface DeviceDto {
  id: string
  name: string
  deviceId: string
  modality: string
  status: string
  location?: string
  model?: string
  serialNumber?: string
  manufacturer?: string
  installationDate?: string
  lastMaintenance?: string
  nextMaintenance?: string
}

export interface CreateDeviceDto {
  name: string
  modality: string
  status: string
  location?: string
  model?: string
  serialNumber?: string
}

export interface UpdateDeviceDto {
  name?: string
  location?: string
  status?: string
  model?: string
  serialNumber?: string
}

export interface TemplateDto {
  id: string
  name: string
  content: string
  modality?: string
  category?: string
  isPublic?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ChargeItemDto {
  id: string
  patientId: string
  itemCode: string
  itemName: string
  amount: number
  quantity: number
  status: string
  createdAt?: string
}

export interface InvoiceDto {
  id: string
  invoiceNo: string
  patientId: string
  patientName: string
  items: ChargeItemDto[]
  totalAmount: number
  discount: number
  paidAmount: number
  status: string
  createdAt: string
}

export interface CriticalValueDto {
  id: string
  patientId: string
  patientName: string
  reportId: string
  value: string
  status: string
  severity: string
  createdAt: string
  acknowledgedAt?: string
  acknowledgedBy?: string
}

export interface ConsultationDto {
  id: string
  patientId: string
  patientName: string
  requestingDoctor: string
  consultingDoctor: string
  reason: string
  status: string
  createdAt: string
  response?: string
  respondedAt?: string
}

export interface WorkflowDefinitionDto {
  id: string
  name: string
  description?: string
  steps: WorkflowStepDto[]
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowStepDto {
  id: string
  name: string
  order: number
  assigneeRole?: string
  timeout?: number
  actions?: string[]
}

// ============ [G005 W6] 登记工作站 / 结构化患者档案 ============
export type PatientIdType = 'ID_CARD' | 'PASSPORT' | 'OFFICER_CARD' | 'BIRTH_CERT' | 'OTHER'
export type PatientIsolationFlag = 'NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE' | 'PROTECTIVE'
export type PatientPregnancyStatus = 'NONE' | 'PREGNANT' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'POSTPARTUM'
export type EgfrSource = 'LIS' | 'MANUAL' | 'CALCULATED'

export interface StructuredAllergyCodeDto {
  code: string
  display: string
  severity?: 'MILD' | 'MODERATE' | 'SEVERE' | 'UNKNOWN'
  reaction?: string
}

export interface VitalsDto {
  systolicBp?: number
  diastolicBp?: number
  heartRate?: number
  temperature?: number
  spo2?: number
  respiratoryRate?: number
  measuredAt?: string
}

export interface RenalFunctionDto {
  egfr?: number
  creatinine?: number
  egfrSource?: EgfrSource
  measuredAt?: string
}

export interface ClinicalProfileDto {
  patientId: string
  idType: PatientIdType
  documentType?: string
  documentNo?: string
  empiId: string
  insuranceNo?: string
  heightCm?: number
  weightKg?: number
  bmi?: number
  structuredAllergyCodes: StructuredAllergyCodeDto[]
  pregnancyStatus: PatientPregnancyStatus
  renalFunction: RenalFunctionDto
  isolationFlag: PatientIsolationFlag
  vitals: VitalsDto
  updatedAt: string
}

export interface RegistrationPatientDto {
  patientId: string
  name: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  birthDate: string
  age: number
  idType: PatientIdType
  documentNo: string
  empiId: string
  insuranceNo?: string
  phone?: string
  isolationFlag: PatientIsolationFlag
  structuredAllergyCodes: StructuredAllergyCodeDto[]
  pregnancyStatus: PatientPregnancyStatus
  renalFunction: RenalFunctionDto
  vitals: VitalsDto
}

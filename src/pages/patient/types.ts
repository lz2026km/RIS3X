import type { Patient } from '../../types'

export type GenderFilter = '全部' | '男' | '女'
export type PatientTypeFilter = '全部' | '门诊' | '住院' | '体检' | '急诊'
export type TabKey = 'list' | 'detail' | 'form' | 'analytics'

export interface AdvancedFilters {
  gender: GenderFilter
  ageMin: string
  ageMax: string
  patientType: PatientTypeFilter
  dateFrom: string
  dateTo: string
  modality: string
  diagnosisCategory: string
}

// [G005 W6] 结构化过敏项
export interface StructuredAllergyInput {
  code: string
  display: string
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'UNKNOWN'
}

export type StructuredIdType = 'ID_CARD' | 'PASSPORT' | 'OFFICER_CARD' | 'BIRTH_CERT' | 'OTHER'
export type StructuredPregnancyStatus = 'NONE' | 'PREGNANT' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'POSTPARTUM'
export type StructuredEgfrSource = 'LIS' | 'MANUAL' | 'CALCULATED'
export type StructuredIsolationFlag = 'NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE' | 'PROTECTIVE'

export interface PatientFormData {
  name: string
  gender: GenderFilter
  age: string
  idCard: string
  phone: string
  address: string
  emergencyContact: string
  emergencyPhone: string
  patientType: PatientTypeFilter
  insuranceType: string
  allergyHistory: string
  medicalHistory: string
  bedNumber: string
  attendingDoctor: string
  // [G005 W6] 结构化登记字段 (可选)
  idType?: StructuredIdType
  empiId?: string
  insuranceNo?: string
  heightCm?: string
  weightKg?: string
  structuredAllergyCodes?: StructuredAllergyInput[]
  pregnancyStatus?: StructuredPregnancyStatus
  egfr?: string
  creatinine?: string
  egfrSource?: StructuredEgfrSource
  isolationFlag?: StructuredIsolationFlag
}

export interface MergeRecord {
  mergedToId?: string
  mergedFromId?: string
  mergedDate: string
  reason: string
}

export interface PMISearchResult {
  patientId: string
  pmiId: string
  name: string
  gender: '男' | '女'
  age: number
  idCard: string
  phone: string
  patientType: PatientTypeFilter
  insuranceType: string
  confidence: number
  matchFields: string[]
  examStats: {
    totalExams: number
    positiveRate: number
    lastExamDate: string
  }
  hasMergeHistory: boolean
  mergeHistory: MergeRecord[]
}

export interface DuplicateMatch {
  patients: [Patient, Patient]
  score: number
  matchedFields: string[]
}

export interface TimelineEvent {
  date: string
  type: 'exam' | 'report' | 'appointment' | 'diagnosis' | 'critical'
  title: string
  description: string
  status?: string
  icon?: React.ReactNode
  // [W2-4] 360° 多源时间线: 点击事件跳转对应模块
  link?: string
  key?: string
  extra?: string
}

export interface ToastInfo {
  show: boolean
  type: 'success' | 'error' | 'info'
  message: string
}

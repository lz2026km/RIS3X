import { api } from './client'
import type { ClinicalProfileDto, RegistrationPatientDto } from '../../types/dto'

export type {
  ClinicalProfileDto,
  RegistrationPatientDto,
} from '../../types/dto'

export interface ScanResultDto {
  query: string
  type: string
  matched: RegistrationPatientDto | null
  candidates: RegistrationPatientDto[]
  source: 'db' | 'seed'
  scannedAt: string
}

export interface PrepItemDto {
  key: string
  label: string
  required: boolean
  checked: boolean
}

export interface PrepConfirmResultDto {
  visitId: string
  items: PrepItemDto[]
  allRequiredChecked: boolean
  pendingKeys: string[]
  confirmedBy?: string
  confirmedAt: string
}

export interface ConsentRecordDto {
  id: string
  visitId: string
  patientId?: string
  consentType: string
  procedure: string
  agreed: boolean
  signedBy?: string
  witnessName?: string
  signedAt: string
  status: 'signed' | 'refused' | 'pending'
}

export interface ChargeItemDto {
  code: string
  name: string
  category: string
  unitPrice: number
  quantity: number
  amount: number
  insuranceEligible: boolean
}

export interface ChargeDto {
  visitId: string
  visitNumber: string
  patientId: string
  patientName: string
  items: ChargeItemDto[]
  totalAmount: number
  insuranceAmount: number
  selfPayAmount: number
  paidAmount: number
  balance: number
  status: 'UNPAID' | 'PARTIAL' | 'PAID'
  updatedAt: string
}

export interface PayResultDto extends ChargeDto {
  method: string
  paidAt: string
  operator?: string
}

export const registrationApi = {
  // 扫码 / 检索 (条码 / 二维码 / 身份证号 / EMPI / 手机号)
  scan: (code: string, type?: string) => {
    const q = new URLSearchParams({ code })
    if (type) q.set('type', type)
    return api.get<ScanResultDto>(`/registration/scan?${q.toString()}`)
  },

  // 结构化临床档案
  getClinicalProfile: (patientId: string) =>
    api.get<ClinicalProfileDto>(`/patients/${encodeURIComponent(patientId)}/clinical-profile`),

  updateClinicalProfile: (patientId: string, patch: Partial<ClinicalProfileDto>) =>
    api.patch<ClinicalProfileDto>(`/patients/${encodeURIComponent(patientId)}/clinical-profile`, patch),

  // 准备项确认
  prepConfirm: (visitId: string, body: { items?: PrepItemDto[]; confirmedBy?: string }) =>
    api.post<PrepConfirmResultDto>(`/registration/${encodeURIComponent(visitId)}/prep-confirm`, body),

  getCharge: (visitId: string) =>
    api.get<ChargeDto>(`/registration/${encodeURIComponent(visitId)}/charge`),

  pay: (visitId: string, body: { amount?: number; method?: string; operator?: string }) =>
    api.post<PayResultDto>(`/registration/${encodeURIComponent(visitId)}/pay`, body),

  // 知情同意
  consent: (visitId: string, body: Partial<ConsentRecordDto>) =>
    api.post<ConsentRecordDto>(`/registration/${encodeURIComponent(visitId)}/consent`, body),
}

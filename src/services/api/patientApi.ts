import { api, invalidateApiCacheByPrefix } from './client'
import type { PatientQueryParams } from './types'
import type { PatientDto } from '../../types/dto'

export type { PatientDto }

// [G005 P1] 列表双形状: MSW 裸数组 / 后端 { items, total }
export type ListPayload<T> = T[] | { items: T[]; total: number }

// [W4-A] 批量导入导出
export interface ImportPatientRow {
  name: string
  gender?: string
  age?: number | string
  birthDate?: string
  idCard?: string
  phone?: string
  type?: string
  patientType?: string
}

export interface ImportResultDto {
  imported: number
  skipped: number
  errors: { index: number; message: string }[]
}

export interface ExportCsvDto {
  filename: string
  content: string
  count: number
}

// [v3.0.6.11-104 Wave 2B] 患者总览 / 年龄分布 / 综合摘要 / 就诊历史
export interface PatientOverviewDto {
  total: number
  todayNew: number
  monthlyNew: number
  active: number
  activeRate: number
  typeDistribution: Record<string, number>
  genderDistribution: Record<string, number>
}

export interface PatientAgeBucket {
  bucket: string
  count: number
  male: number
  female: number
}

export interface PatientAgeDistributionDto {
  total: number
  items: PatientAgeBucket[]
}

export interface PatientSummaryDto {
  patient: {
    id: string
    name: string
    gender: string
    birthDate: string | null
    phone: string | null
    type: string
    createdAt: string
  }
  counts: {
    exams: number
    reports: number
    followUps: number
    criticalValues: number
    invoices: number
  }
  totalCharges: number
  recentExams: { id: string; modality: string; bodyPart: string; state: string; createdAt: string }[]
  recentReports: { id: string; state: string; conclusion: string | null; createdAt: string }[]
  followUps: { id: string; nextDate: string; status: string; note?: string }[]
  criticals: { id: string; description: string; severity: string; state: string; createdAt: string }[]
}

export interface PatientVisitEvent {
  type: string
  label: string
  date: string
  detail: string
  status: string
}

export interface PatientVisitHistoryDto {
  patientId: string
  total: number
  events: PatientVisitEvent[]
}

// [W4] 对齐后端 CreatePatientSchema / UpdatePatientSchema (backend patient.controller.ts):
//   create: { name, gender: MALE|FEMALE|OTHER, birthDate?, idCard?, phone?, type? }
//   后端不接受 age/bloodType/address/diagnosis 等旧 mock 字段 → 写请求前统一剔除;
//   gender 兼容旧 'M'/'F'/'男'/'女' 输入, 归一化为后端枚举 MALE/FEMALE/OTHER。
export type PatientGender = 'MALE' | 'FEMALE' | 'OTHER'
export type PatientType = 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'PHYSICAL'

const PATIENT_GENDER_MAP: Record<string, PatientGender> = {
  M: 'MALE', MALE: 'MALE', 男: 'MALE',
  F: 'FEMALE', FEMALE: 'FEMALE', 女: 'FEMALE',
  O: 'OTHER', OTHER: 'OTHER', 其他: 'OTHER',
}

const PATIENT_TYPE_MAP: Record<string, PatientType> = {
  OUTPATIENT: 'OUTPATIENT', 门诊: 'OUTPATIENT',
  INPATIENT: 'INPATIENT', 住院: 'INPATIENT',
  EMERGENCY: 'EMERGENCY', 急诊: 'EMERGENCY',
  PHYSICAL: 'PHYSICAL', 体检: 'PHYSICAL',
}

function toPatientWritePayload(
  data: Partial<PatientDto> & Record<string, unknown>,
  opts: { requiredName: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (name) payload.name = name
  if (data.gender !== undefined && data.gender !== null && String(data.gender).trim() !== '') {
    const raw = String(data.gender).trim()
    payload.gender = PATIENT_GENDER_MAP[raw] ?? PATIENT_GENDER_MAP[raw.toUpperCase()] ?? 'OTHER'
  } else if (opts.requiredName) {
    payload.gender = 'OTHER'
  }
  if (data.birthDate) payload.birthDate = String(data.birthDate)
  if (data.idCard) payload.idCard = String(data.idCard)
  if (data.phone) payload.phone = String(data.phone)
  if (data.type) {
    const mappedType = PATIENT_TYPE_MAP[String(data.type).trim()]
    if (mappedType) payload.type = mappedType
  }
  return payload
}

export const patientApi = {
  // [W4] 列表归一化: api.getList → 消费方始终拿到 { items, total }
  // [W4] 查询参数映射 (real 模式后端 PatientListQuerySchema):
  //   - search → name (后端按 name 精确前缀筛选; 同时保留 search 兼容 MSW searchFields)
  //   - page/pageSize → skip/take (后端 resolvePagination; 同时保留 page/pageSize 兼容 MSW parseQuery)
  list: (params?: PatientQueryParams) => {
    const sp = new URLSearchParams()
    if (params) {
      const { search, page, pageSize, ...rest } = params
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
      })
      if (search) {
        sp.set('name', search)
        sp.set('search', search)
      }
      if (page !== undefined) {
        sp.set('page', String(page))
        sp.set('skip', String((page - 1) * (pageSize ?? 20)))
      }
      if (pageSize !== undefined) {
        sp.set('pageSize', String(pageSize))
        sp.set('take', String(pageSize))
      }
    }
    const qs = sp.toString()
    return api.getList<PatientDto>(`/patients${qs ? `?${qs}` : ''}`)
  },

  getById: (id: string) =>
    api.get<PatientDto>(`/patients/${id}`),

  // [W4] 创建: 载荷对齐后端 CreatePatientSchema (剔除 age/bloodType/address/diagnosis; gender 归一化枚举)
  create: async (data: Partial<PatientDto>) => {
    const res = await api.post<PatientDto>('/patients', toPatientWritePayload(data, { requiredName: true }))
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  // [W4] 更新: 同样只发送后端 UpdatePatientSchema 接受的字段
  update: async (id: string, data: Partial<PatientDto>) => {
    const res = await api.patch<PatientDto>(`/patients/${id}`, toPatientWritePayload(data, { requiredName: false }))
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  delete: async (id: string) => {
    const res = await api.delete<null>(`/patients/${id}`)
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  getReports: (id: string) =>
    api.get<unknown[]>(`/patients/${id}/reports`),

  getExams: (id: string) =>
    api.get<unknown[]>(`/patients/${id}/exams`),

  getTimeline: (id: string) =>
    api.get<any[]>(`/patients/${id}/timeline`),

  // [W2-4] 患者合并: 源患者关联 (exam/report/appointment/critical) 全部迁至目标患者后软删源患者
  merge: async (sourceId: string, targetId: string) => {
    const res = await api.post<{
      ok: boolean
      merged: {
        sourceId: string
        targetId: string
        movedExams: number
        movedReports: number
        movedAppointments: number
        movedCriticalValues: number
      }
    }>('/patients/merge', { sourceId, targetId })
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  // [W4-A] 批量导入 (JSON 数组或 { items }, 逐条创建 + 冲突跳过)
  importPatients: async (items: ImportPatientRow[]) => {
    const res = await api.post<ImportResultDto>('/patients/import', { items })
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  // [W4-A] CSV 导出 (全部或按 name/phone 筛选)
  exportPatients: (params?: { name?: string; phone?: string }) => {
    const q = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : ''
    return api.get<ExportCsvDto>(`/patients/export${q}`)
  },

  // [v3.0.6.11-104 Wave 2B] 患者总览: 总数/今日新增/月新增/活跃 + 类型与性别分布
  overview: () =>
    api.get<PatientOverviewDto>('/patients/overview'),

  // [v3.0.6.11-104 Wave 2B] 年龄分布: 分段 + 性别拆分
  ageDistribution: () =>
    api.get<PatientAgeDistributionDto>('/patients/age-distribution'),

  // [v3.0.6.11-104 Wave 2B] 患者综合摘要: 检查/报告/随访/费用/危急值
  getSummary: (id: string) =>
    api.get<PatientSummaryDto>(`/patients/${encodeURIComponent(id)}/summary`),

  // [v3.0.6.11-104 Wave 2B] 就诊历史时间线
  getVisitHistory: (id: string) =>
    api.get<PatientVisitHistoryDto>(`/patients/${encodeURIComponent(id)}/visit-history`),
}

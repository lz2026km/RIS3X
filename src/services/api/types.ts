export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
  meta?: { total: number; page: number; pageSize: number; totalPages: number }
}

export interface PageResult<T> {
  data: T[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

export interface ExamQueryParams {
  status?: string
  modality?: string
  priority?: string
  patientId?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface PatientQueryParams {
  search?: string
  birthDate?: string
  page?: number
  pageSize?: number
}

export interface ReportQueryParams {
    status?: string
    modality?: string
    priority?: string
    text?: string
    q?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    // [v3.0.6.11-70] P0: 后端 reports list 支持 skip/take/state
    take?: string
    skip?: string
    state?: string
  }

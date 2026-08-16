import { api } from './client'

// [G005 v3.0.6.11-103 Wave 18] 科研数据导出中心 API — 后端 /research (ResearchExportService)

export interface DatasetCriteriaDto {
  modality?: string
  disease?: string
  dateFrom?: string
  dateTo?: string
  doctor?: string
  result?: '阳性' | '阴性' | '全部'
}

export interface DatasetRecordDto {
  id: string
  patientId: string
  patientNameMasked: string
  age: number
  gender: string
  modality: string
  bodyPart: string
  examDate: string
  doctor: string
  disease: string
  diagnosis: string
  findingsPreview: string
  imagePath: string
  measurements: string
}

export interface DatasetInfoDto {
  id: string
  name: string
  criteria: DatasetCriteriaDto
  recordCount: number
  createdAt: string
  createdBy: string
  preview: DatasetRecordDto[]
}

export type ExportFormat = 'CSV' | 'JSON' | 'EXCEL'
export type ExportTaskStatus = 'pending' | 'running' | 'done' | 'failed'

export interface ExportFieldDto {
  key: string
  label: string
  group: '患者' | '检查' | '报告' | '影像' | '测量'
  selected: boolean
}

export interface ExportTaskDto {
  id: string
  name: string
  datasetId: string
  datasetName: string
  format: ExportFormat
  fields: string[]
  recordCount: number
  status: ExportTaskStatus
  createdAt: string
  completedAt: string
  downloadUrl: string
  createdBy: string
  error?: string
}

export interface ExportStatsDto {
  totalTasks: number
  doneTasks: number
  totalRecords: number
  byFormat: Record<ExportFormat, number>
  byStatus: Record<ExportTaskStatus, number>
  last7Days: Array<{ date: string; count: number; records: number }>
}

export interface ExportTaskContentDto {
  task: ExportTaskDto
  headers: string[]
  rows: Array<Record<string, unknown>>
  content: string
}

export const researchExportApi = {
  buildDataset: (criteria: DatasetCriteriaDto, name?: string) =>
    api.post<DatasetInfoDto>('/research/datasets/build', { name, criteria }),

  listDatasets: () =>
    api.get<DatasetInfoDto[]>('/research/datasets'),

  listFields: () =>
    api.get<ExportFieldDto[]>('/research/export-fields'),

  createTask: (dto: { name: string; datasetId: string; format: ExportFormat; fields?: string[] }) =>
    api.post<ExportTaskDto>('/research/export/tasks', dto),

  listTasks: () =>
    api.get<ExportTaskDto[]>('/research/export/tasks'),

  getTask: (id: string) =>
    api.get<ExportTaskDto>(`/research/export/tasks/${id}`),

  getTaskContent: (id: string) =>
    api.get<ExportTaskContentDto>(`/research/export/tasks/${id}/content`),

  stats: () =>
    api.get<ExportStatsDto>('/research/export/stats'),
}

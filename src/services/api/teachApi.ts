import { api } from './client'

export interface TeachLecture {
  id: string
  title: string
  duration: number
  createdAt: string
  patientId?: string
  examId?: string
  reportId?: string
  createdBy?: string
  blobs?: TeachLectureBlob[]
  _count?: { blobs: number }
}

export interface TeachLectureBlob {
  id: string
  lectureId: string
  sequence: number
  filename: string
  sizeBytes: number
}

export interface CreateLectureDto {
  title: string
  patientId?: string
  examId?: string
  reportId?: string
}

export interface LecturesQuery {
  page?: number
  pageSize?: number
  search?: string
}

export interface LecturesResult {
  items: TeachLecture[]
  total: number
  page: number
  pageSize: number
}

export const teachApi = {
  createLecture: (dto: CreateLectureDto) =>
    api.post<TeachLecture>('/teach/lecture', dto),

  uploadBlob: (id: string, blob: Blob, sequence: number) => {
    const fd = new FormData()
    fd.append('blob', blob, `chunk-${sequence}.webm`)
    return api.post<TeachLectureBlob>(`/teach/lecture/${id}/blob?sequence=${sequence}`, fd)
  },

  getLecture: (id: string) =>
    api.get<TeachLecture>(`/teach/lecture/${id}`),

  getLectures: (query?: LecturesQuery) => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    if (query?.search) params.set('search', query.search)
    return api.get<LecturesResult>(`/teach/lectures?${params}`)
  },

  deleteLecture: (id: string) =>
    api.delete(`/teach/lecture/${id}`),
}

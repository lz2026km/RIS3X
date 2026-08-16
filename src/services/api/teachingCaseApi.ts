import { api } from './client'

// [G005 v3.0.6.11-103 Wave 18] 教学病例库 API — 后端 /teach (TeachModule + TeachingCaseService)

export type CaseDifficulty = '入门' | '进阶' | '高级'

export interface TeachingCaseDto {
  id: string
  title: string
  patientId?: string
  patientName: string
  gender: string
  age: number
  examId?: string
  reportId?: string
  modality: string
  bodyPart: string
  disease: string
  difficulty: CaseDifficulty
  diagnosis: string
  findings: string
  keyPoints: string[]
  tags: string[]
  thumbnail: string
  favoriteCount: number
  viewCount: number
  shared: boolean
  shareToken: string
  createdAt: string
  createdBy: string
}

export interface TeachingCommentDto {
  id: string
  caseId: string
  user: string
  content: string
  time: string
}

export interface CategoryNodeDto {
  name: string
  count: number
  children?: CategoryNodeDto[]
}

export interface ExamQuestionDto {
  caseId: string
  title: string
  findings: string
  options: string[]
  answerIndex: number
}

export interface ExamPaperDto {
  examId: string
  difficulty: CaseDifficulty | '全部'
  total: number
  questions: ExamQuestionDto[]
}

export interface ExamResultDto {
  examId: string
  total: number
  correct: number
  score: number
  passed: boolean
  wrongQuestions: Array<{ caseId: string; title: string; selected: string; answer: string }>
}

export interface WrongBookItemDto {
  caseId: string
  title: string
  disease: string
  diagnosis: string
  wrongCount: number
  lastWrongAt: string
}

export interface TeachingCaseStatsDto {
  total: number
  shared: number
  favorites: number
  comments: number
  byDifficulty: Record<CaseDifficulty, number>
  byBodyPart: Array<{ name: string; count: number }>
}

export interface TeachingCaseQuery {
  page?: number
  pageSize?: number
  search?: string
  disease?: string
  bodyPart?: string
  difficulty?: string
  tag?: string
  sharedOnly?: boolean
}

export const teachingCaseApi = {
  list: (query?: TeachingCaseQuery) => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    if (query?.search) params.set('search', query.search)
    if (query?.disease) params.set('disease', query.disease)
    if (query?.bodyPart) params.set('bodyPart', query.bodyPart)
    if (query?.difficulty) params.set('difficulty', query.difficulty)
    if (query?.tag) params.set('tag', query.tag)
    if (query?.sharedOnly) params.set('sharedOnly', 'true')
    const qs = params.toString()
    return api.get<{ items: TeachingCaseDto[]; total: number; page: number; pageSize: number }>(`/teach/cases${qs ? `?${qs}` : ''}`)
  },

  get: (id: string) =>
    api.get<TeachingCaseDto>(`/teach/case/${id}`),

  create: (dto: Partial<TeachingCaseDto>) =>
    api.post<TeachingCaseDto>('/teach/case', dto),

  update: (id: string, dto: Partial<TeachingCaseDto>) =>
    api.patch<TeachingCaseDto>(`/teach/case/${id}`, dto),

  remove: (id: string) =>
    api.delete<{ deleted: string }>(`/teach/case/${id}`),

  categories: () =>
    api.get<CategoryNodeDto[]>('/teach/categories'),

  stats: () =>
    api.get<TeachingCaseStatsDto>('/teach/stats'),

  share: (id: string) =>
    api.post<{ id: string; shareToken: string; shareUrl: string; qrData: string }>(`/teach/case/${id}/share`),

  getShared: (token: string) =>
    api.get<TeachingCaseDto>(`/teach/share/${token}`),

  listComments: (caseId: string) =>
    api.get<TeachingCommentDto[]>(`/teach/case/${caseId}/comments`),

  addComment: (caseId: string, content: string) =>
    api.post<TeachingCommentDto>(`/teach/case/${caseId}/comments`, { content }),

  generateExam: (dto: { count?: number; difficulty?: string; category?: string }) =>
    api.post<ExamPaperDto>('/teach/exam/generate', dto),

  submitExam: (examId: string, answers: Array<{ caseId: string; selectedIndex: number }>) =>
    api.post<ExamResultDto>('/teach/exam/submit', { examId, answers }),

  wrongBook: () =>
    api.get<WrongBookItemDto[]>('/teach/wrong-book'),

  clearWrongBook: () =>
    api.delete<{ cleared: number }>('/teach/wrong-book'),
}

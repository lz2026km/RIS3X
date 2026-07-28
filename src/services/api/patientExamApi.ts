import { api } from './client'

export interface PatientInfo {
  id: string
  name: string
  gender: string
  age: number
}

export interface ExamInfo {
  id: string
  patientId: string
  modality: string
  bodyPart: string
  date: string
  description: string
}

export const patientExamApi = {
  getPatients: () => api.get<PatientInfo[]>('/ai/draft/patients'),

  getExams: (patientId: string) =>
    api.get<ExamInfo[]>(`/ai/draft/patients/${patientId}/exams`),
}

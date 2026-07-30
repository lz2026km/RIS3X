import { api } from './client'

export interface Dicom4dStudyDto { id: string; studyUid: string; patientName: string; patientId: string; studyDate: string; modality: string; seriesCount: number; frameCount: number; status: string }
export interface Dicom4dPlaybackDto { studyUid: string; frameRate?: number; loop?: boolean; windowWidth?: number; windowLevel?: number }
export interface Dicom4dMeasurementDto { frame: number; x: number; y: number; value: number; unit: string; label?: string }
export interface Dicom4dAnalysisDto { id: string; studyUid: string; measurements: Dicom4dMeasurementDto[]; summary?: string; generatedAt: string }

export const dicom4dApi = {
  list: (params?: { patientId?: string; status?: string }) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<Dicom4dStudyDto[]>(`/dicom/4d?${sp.toString()}`)
  },
  get: (studyUid: string) => api.get<Dicom4dStudyDto>(`/dicom/4d/${studyUid}`),
  play: (dto: Dicom4dPlaybackDto) => api.post<{ frames: string[]; totalFrames: number; duration: number }>('/dicom/4d/play', dto),
  analyze: (studyUid: string) => api.post<Dicom4dAnalysisDto>(`/dicom/4d/${studyUid}/analyze`, {}),
  getAnalysis: (id: string) => api.get<Dicom4dAnalysisDto>(`/dicom/4d/analysis/${id}`),
}

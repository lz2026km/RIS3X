import { api } from './client'

// [G005 W3-A] 与后端 @Controller('dicom/4d') 对齐:
//   POST /dicom/4d/list            -> list()
//   POST /dicom/4d/frames           -> frames(seriesUid)
//   GET  /dicom/4d/phase/:seriesUid -> phase(seriesUid)
// 旧 /dicom/4d、/dicom/4d/play、/dicom/4d/:uid/analyze、/dicom/4d/analysis/:id 后端无对应, 已移除。

export interface Series4D {
  seriesUid: string
  studyUid: string
  patientName: string
  patientId: string
  modality: string
  seriesDescription: string
  frameCount: number
  frameRate: number
  gatingType: 'cardiac' | 'respiratory' | 'both'
  dimensions: { width: number; height: number }
  simulated?: boolean
}

export interface FrameData4D {
  frameIndex: number
  timestamp: string
  phase: number
  dataUrl: string
}

export interface PhaseInfo4D {
  seriesUid: string
  gatingType: 'cardiac' | 'respiratory' | 'both'
  cardiacPhase: number
  respiratoryPhase: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
  frameCount: number
}

export const dicom4dApi = {
  list: () => api.post<Series4D[]>('/dicom/4d/list', {}),
  frames: (seriesUid: string) => api.post<FrameData4D[]>('/dicom/4d/frames', { seriesUid }),
  phase: (seriesUid: string) => api.get<PhaseInfo4D>(`/dicom/4d/phase/${encodeURIComponent(seriesUid)}`),
}

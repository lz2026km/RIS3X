import { api } from './client'

// [G005 W3-A] 与后端 @Controller('dicom/4d') 对齐:
//   POST /dicom/4d/list        -> list()
//   POST /dicom/4d/frames       -> frames(seriesUid)
//   GET  /dicom/4d/phase/:seriesUid -> phase(seriesUid)
// [G005 v3.0.6.11-101 Wave 1B (G-07)] 新端点:
//   POST /dicom/4d/phase-info   -> phaseInfo(seriesUid)  (序列→时相分布, cardiac 0-19 / respiratory 0-9)
//   POST /dicom/4d/movie        -> movie(seriesUid)      (帧间插值参数 + 心电/RR 间期)

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
  cardiacPhaseCount?: number
  respiratoryPhaseCount?: number
  simulated?: boolean
}

export interface FrameData4D {
  frameIndex: number
  timestamp: string
  phase: number
  dataUrl: string
  /** [G-07] cardiac 时相 0-19 */
  cardiacPhase?: number
  /** [G-07] respiratory 时相 0-9 */
  respiratoryPhase?: number
  /** [G-07] 对应 DICOM 实例 */
  sopInstanceUid?: string
  instanceId?: string
  storagePath?: string | null
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

export interface PhaseBin {
  phase: number
  count: number
}

export interface PhaseDistribution4D {
  gatingType: 'cardiac' | 'respiratory' | 'both'
  cardiac: PhaseBin[]
  respiratory: PhaseBin[]
  totalFrames: number
}

export interface PhaseInfoDetail4D extends PhaseInfo4D {
  distribution?: PhaseDistribution4D
}

export interface EcgPoint4D {
  t: number
  rr: number
}

export interface MovieData4D {
  seriesUid: string
  studyUid: string
  modality: string
  frameCount: number
  gatingType: 'cardiac' | 'respiratory' | 'both'
  frameRate: number
  cycleMs: number
  framesPerPhase: number
  interpolatedFrames: number
  interpolationMode: 'phase-bin' | 'linear'
  bpm: number
  rrIntervals: number[]
  ecgWaveform: EcgPoint4D[]
  phaseSequence: number[]
}

export const dicom4dApi = {
  list: () => api.post<Series4D[]>('/dicom/4d/list', {}),
  frames: (seriesUid: string) => api.post<FrameData4D[]>('/dicom/4d/frames', { seriesUid }),
  phase: (seriesUid: string) => api.get<PhaseInfo4D>(`/dicom/4d/phase/${encodeURIComponent(seriesUid)}`),
  // [G005 v3.0.6.11-101 Wave 1B (G-07)]
  phaseInfo: (seriesUid: string) => api.post<PhaseInfoDetail4D>('/dicom/4d/phase-info', { seriesUid }),
  movie: (seriesUid: string) => api.post<MovieData4D>('/dicom/4d/movie', { seriesUid }),
}

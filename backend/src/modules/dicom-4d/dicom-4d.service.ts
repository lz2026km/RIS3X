import { Injectable, NotFoundException } from '@nestjs/common'

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
}

export interface FrameData {
  frameIndex: number
  timestamp: string
  phase: number
  dataUrl: string
}

export interface PhaseInfo {
  seriesUid: string
  gatingType: 'cardiac' | 'respiratory' | 'both'
  cardiacPhase: number
  respiratoryPhase: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
  frameCount: number
}

@Injectable()
export class Dicom4dService {
  private readonly series: Series4D[] = [
    {
      seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.1',
      studyUid: '1.2.840.113619.2.55.3.6047.1.2',
      patientName: '张三',
      patientId: 'P001',
      modality: 'CT',
      seriesDescription: 'Cardiac 4D CT 10%',
      frameCount: 80,
      frameRate: 10,
      gatingType: 'cardiac',
      dimensions: { width: 512, height: 512 },
    },
    {
      seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.2',
      studyUid: '1.2.840.113619.2.55.3.6047.1.2',
      patientName: '张三',
      patientId: 'P001',
      modality: 'CT',
      seriesDescription: 'Respiratory 4D CT',
      frameCount: 60,
      frameRate: 8,
      gatingType: 'respiratory',
      dimensions: { width: 512, height: 512 },
    },
    {
      seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.3',
      studyUid: '1.2.840.113619.2.55.3.6047.1.2',
      patientName: '李四',
      patientId: 'P002',
      modality: 'MR',
      seriesDescription: 'Cardiac MR 4D',
      frameCount: 120,
      frameRate: 15,
      gatingType: 'cardiac',
      dimensions: { width: 256, height: 256 },
    },
  ]

  async list(): Promise<Series4D[]> {
    return this.series
  }

  async getFrames(seriesUid: string): Promise<FrameData[]> {
    const s = this.series.find(x => x.seriesUid === seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    const frames: FrameData[] = []
    for (let i = 0; i < s.frameCount; i++) {
      const phase = i / s.frameCount
      const intervalMs = 1000 / s.frameRate
      const timestamp = new Date(Date.now() + i * intervalMs).toISOString()
      frames.push({
        frameIndex: i,
        timestamp,
        phase: Math.round(phase * 100),
        dataUrl: `/mock/4d/${seriesUid}/frame/${i}`,
      })
    }
    return frames
  }

  async getPhase(seriesUid: string): Promise<PhaseInfo> {
    const s = this.series.find(x => x.seriesUid === seriesUid)
    if (!s) throw new NotFoundException(`Series ${seriesUid} not found`)
    return {
      seriesUid: s.seriesUid,
      gatingType: s.gatingType,
      cardiacPhase: s.gatingType === 'cardiac' || s.gatingType === 'both' ? Math.random() * 100 : 0,
      respiratoryPhase: s.gatingType === 'respiratory' || s.gatingType === 'both' ? Math.random() * 100 : 0,
      cardiacCycleMs: 800,
      respiratoryCycleMs: 4000,
      frameCount: s.frameCount,
    }
  }
}

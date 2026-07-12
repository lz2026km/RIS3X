import { Injectable, NotFoundException } from '@nestjs/common'

export interface CadDetection {
  type: 'nodule' | 'calcification'
  x: number
  y: number
  width: number
  height: number
  confidence: number
  size: number
}

export interface CadResult {
  instanceId: string
  findings: CadDetection[]
  heatmapUrl: string | null
  detectedAt: string
}

const mockStorage = new Map<string, CadResult>()

function mockDetect(instanceId: string): CadResult {
  const existing = mockStorage.get(instanceId)
  if (existing) return existing

  const result: CadResult = {
    instanceId,
    findings: [
      { type: 'nodule', x: 120, y: 180, width: 48, height: 42, confidence: 0.92, size: 14.5 },
      { type: 'calcification', x: 300, y: 250, width: 18, height: 16, confidence: 0.87, size: 4.2 },
      { type: 'nodule', x: 380, y: 100, width: 32, height: 30, confidence: 0.76, size: 8.1 },
      { type: 'calcification', x: 200, y: 350, width: 12, height: 10, confidence: 0.94, size: 2.8 },
    ],
    heatmapUrl: `/ai/cad/heatmap/${instanceId}`,
    detectedAt: new Date().toISOString(),
  }
  mockStorage.set(instanceId, result)
  return result
}

@Injectable()
export class CadService {
  async detect(instanceId: string): Promise<CadResult> {
    await new Promise((r) => setTimeout(r, 200))
    return mockDetect(instanceId)
  }

  async getResult(instanceId: string): Promise<CadResult> {
    const result = mockStorage.get(instanceId)
    if (!result) throw new NotFoundException(`No CAD result for ${instanceId}`)
    return result
  }
}

import { api } from './client'

// [v3.0.6.11-75] 对齐 backend/src/modules/cad/cad.controller.ts (POST /ai/cad/detect, GET /ai/cad/result/:instanceId)

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
  /** true = 内存回退 (结果未落库, 由确定性算法生成) */
  simulated: boolean
}

export const cadApi = {
  /** 触发 AI CAD 检测 (后端按 instanceId 确定性生成病灶) */
  detect: (instanceId: string) =>
    api.post<CadResult>('/ai/cad/detect', { instanceId }),

  /** 查询指定 DICOM 实例的检测结果 */
  getResult: (instanceId: string) =>
    api.get<CadResult>(
      `/ai/cad/result/${encodeURIComponent(instanceId)}`,
    ),
}

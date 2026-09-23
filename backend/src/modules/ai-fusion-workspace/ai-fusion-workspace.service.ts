/**
 * G005 放射RIS系统 - AI 融合工作站 (ai/fusion-workspace) 服务 (孤儿模块)
 *
 * 覆盖前端 aiFusionWorkspaceApi 的 4 个端点 (此前后端缺失):
 *   - GET  /ai/fusion-workspace
 *   - GET  /ai/fusion-workspace/studies
 *   - GET  /ai/fusion-workspace/insights
 *   - POST /ai/fusion-workspace/run
 *
 * 无 DB 依赖: 纯内存确定性 seed + 运行结果落内存, 可无 DB 启动。
 */
import { Injectable } from '@nestjs/common'

export interface FusionStudy {
  id: string
  patient: string
  modalities: string
  fusionScore: number
  findings: number
  aiAlerts: number
  status: 'complete' | 'pending'
  date: string
}

export type AiInsightType = 'lesion' | 'vessel' | 'measurement' | 'classification'

export interface AiInsight {
  id: string
  type: AiInsightType
  finding: string
  confidence: number
  modality: string
  source: string
  actionable: boolean
}

function dateOnly(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

@Injectable()
export class AiFusionWorkspaceService {
  private readonly studies: FusionStudy[] = [
    { id: 'FS-001', patient: '张伟', modalities: 'CT+PET', fusionScore: 0.88, findings: 3, aiAlerts: 1, status: 'complete', date: dateOnly(-1) },
    { id: 'FS-002', patient: '李娜', modalities: 'MR+CT', fusionScore: 0.92, findings: 5, aiAlerts: 2, status: 'complete', date: dateOnly(-2) },
    { id: 'FS-003', patient: '王强', modalities: 'CBCT+OPG', fusionScore: 0.81, findings: 2, aiAlerts: 0, status: 'pending', date: dateOnly(-3) },
    { id: 'FS-004', patient: '赵敏', modalities: 'SPECT+CT', fusionScore: 0.86, findings: 4, aiAlerts: 1, status: 'complete', date: dateOnly(-4) },
  ]

  private readonly insights: AiInsight[] = [
    { id: 'AI-001', type: 'lesion', finding: '右肺上叶结节 (融合 SUVmax 4.2)', confidence: 0.91, modality: 'CT+PET', source: 'lung-cad', actionable: true },
    { id: 'AI-002', type: 'vessel', finding: '左前降支近段狭窄 65%', confidence: 0.87, modality: 'CT', source: 'cardiac-ai', actionable: true },
    { id: 'AI-003', type: 'measurement', finding: '病灶体积 4.8 cm³', confidence: 0.83, modality: 'MR+CT', source: 'radiomics', actionable: false },
    { id: 'AI-004', type: 'classification', finding: '肝右叶病灶倾向恶性 (LR-5)', confidence: 0.79, modality: 'MR', source: 'fusion-v2', actionable: true },
  ]

  /** GET /ai/fusion-workspace — 工作站总览 */
  getWorkspace(modality?: string) {
    const studies = modality
      ? this.studies.filter((s) => s.modalities.toUpperCase().includes(modality.toUpperCase()))
      : this.studies
    return { success: true, data: { studies, aiInsights: this.insights } }
  }

  /** GET /ai/fusion-workspace/studies */
  listStudies() {
    return { success: true, data: this.studies }
  }

  /** GET /ai/fusion-workspace/insights */
  listInsights() {
    return { success: true, data: this.insights }
  }

  /** POST /ai/fusion-workspace/run — 融合分析 (确定性结果, 内存返回) */
  runFusion(studyId?: string) {
    const source = this.studies.find((s) => s.id === studyId) ?? this.studies[0]!
    const result: FusionStudy = {
      id: `FS-${Date.now().toString(36)}`,
      patient: source.patient,
      modalities: source.modalities,
      fusionScore: Math.min(0.99, Math.round((source.fusionScore + 0.05) * 100) / 100),
      findings: source.findings + 1,
      aiAlerts: source.aiAlerts,
      status: 'complete',
      date: dateOnly(0),
    }
    return { success: true, data: result }
  }
}

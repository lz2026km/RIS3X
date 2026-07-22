import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface AIModel {
  id: string
  name: string
  version: string
  modality: string
  description: string
  status: 'running' | 'stopped' | 'error'
  deployedAt: string
  accuracy?: number
}

@Injectable()
export class AiMarketplaceService {
  private models: AIModel[] = [
    { id: 'md-001', name: '肺结节检测', version: '2.1.0', modality: 'CT', description: '基于深度学习的肺结节自动检测与分类', status: 'running', deployedAt: '2026-06-01T00:00:00Z', accuracy: 0.94 },
    { id: 'md-002', name: '骨折识别', version: '1.3.0', modality: 'DX', description: 'X线骨折自动识别与定位', status: 'running', deployedAt: '2026-05-15T00:00:00Z', accuracy: 0.91 },
    { id: 'md-003', name: '脑出血检测', version: '3.0.0', modality: 'CT', description: '急诊CT脑出血快速检测', status: 'stopped', deployedAt: '2026-04-20T00:00:00Z', accuracy: 0.96 },
    { id: 'md-004', name: '乳腺钼靶分析', version: '1.0.0', modality: 'MG', description: '乳腺钼靶影像AI辅助诊断', status: 'error', deployedAt: '2026-07-01T00:00:00Z', accuracy: 0.88 },
    { id: 'md-005', name: '冠脉CTA分析', version: '2.0.0', modality: 'CT', description: '冠脉CTA血管狭窄自动分析', status: 'running', deployedAt: '2026-06-10T00:00:00Z', accuracy: 0.92 },
  ]

  list(): AIModel[] {
    return this.models
  }

  deploy(name: string, version: string, modality: string, description: string): AIModel {
    const model: AIModel = {
      id: `md-${uuid().slice(0, 6)}`,
      name, version, modality, description,
      status: 'running',
      deployedAt: new Date().toISOString(),
    }
    this.models.push(model)
    return model
  }

  remove(id: string): void {
    const idx = this.models.findIndex(m => m.id === id)
    if (idx < 0) throw new NotFoundException('Model not found')
    this.models.splice(idx, 1)
  }

  getStatus(id: string): AIModel | undefined {
    const model = this.models.find(m => m.id === id)
    if (!model) throw new NotFoundException('Model not found')
    return model
  }
}

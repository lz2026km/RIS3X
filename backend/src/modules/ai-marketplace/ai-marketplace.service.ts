import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'

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

const DEFAULT_MODELS: AIModel[] = [
  { id: 'md-001', name: '肺结节检测', version: '2.1.0', modality: 'CT', description: '基于深度学习的肺结节自动检测与分类', status: 'running', deployedAt: '2026-06-01T00:00:00Z', accuracy: 0.94 },
  { id: 'md-002', name: '骨折识别', version: '1.3.0', modality: 'DX', description: 'X线骨折自动识别与定位', status: 'running', deployedAt: '2026-05-15T00:00:00Z', accuracy: 0.91 },
  { id: 'md-003', name: '脑出血检测', version: '3.0.0', modality: 'CT', description: '急诊CT脑出血快速检测', status: 'stopped', deployedAt: '2026-04-20T00:00:00Z', accuracy: 0.96 },
  { id: 'md-004', name: '乳腺钼靶分析', version: '1.0.0', modality: 'MG', description: '乳腺钼靶影像AI辅助诊断', status: 'error', deployedAt: '2026-07-01T00:00:00Z', accuracy: 0.88 },
  { id: 'md-005', name: '冠脉CTA分析', version: '2.0.0', modality: 'CT', description: '冠脉CTA血管狭窄自动分析', status: 'running', deployedAt: '2026-06-10T00:00:00Z', accuracy: 0.92 },
]

@Injectable()
export class AiMarketplaceService {
  private fallbackModels: AIModel[] = [...DEFAULT_MODELS]

  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: { id: string; name: string; version: string; vendor: string | null; category: string | null; status: string; deployedAt: Date | null; config: unknown }): AIModel {
    const config = (row.config ?? {}) as { description?: string; accuracy?: number }
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      modality: row.category ?? row.vendor ?? '',
      description: config.description ?? '',
      status: (['running', 'stopped', 'error'].includes(row.status) ? row.status : 'running') as AIModel['status'],
      deployedAt: row.deployedAt?.toISOString() ?? new Date().toISOString(),
      accuracy: config.accuracy,
    }
  }

  async list(): Promise<AIModel[]> {
    try {
      const rows = await this.prisma.aiModel.findMany({ orderBy: { createdAt: 'asc' } })
      if (rows.length === 0) {
        await this.prisma.aiModel.createMany({
          data: DEFAULT_MODELS.map(m => ({
            id: m.id,
            name: m.name,
            version: m.version,
            vendor: '',
            category: m.modality,
            status: m.status,
            deployedAt: new Date(m.deployedAt),
            config: { description: m.description, accuracy: m.accuracy },
          })),
          skipDuplicates: true,
        })
        return this.fallbackModels.map(m => ({ ...m }))
      }
      return rows.map(r => this.toDto(r))
    } catch {
      return this.fallbackModels.map(m => ({ ...m }))
    }
  }

  async deploy(name: string, version: string, modality: string, description: string): Promise<AIModel> {
    const model: AIModel = {
      id: `md-${uuid().slice(0, 6)}`,
      name, version, modality, description,
      status: 'running',
      deployedAt: new Date().toISOString(),
    }
    try {
      await this.prisma.aiModel.create({
        data: {
          id: model.id,
          name, version,
          vendor: '',
          category: modality,
          status: 'running',
          deployedAt: new Date(),
          config: { description, accuracy: undefined },
        },
      })
    } catch {
      this.fallbackModels.push(model)
    }
    return model
  }

  async remove(id: string): Promise<void> {
    try {
      const result = await this.prisma.aiModel.deleteMany({ where: { id } })
      if (result.count === 0) throw new NotFoundException('Model not found')
      return
    } catch (error) {
      if (error instanceof NotFoundException) throw error
      const idx = this.fallbackModels.findIndex(m => m.id === id)
      if (idx < 0) throw new NotFoundException('Model not found')
      this.fallbackModels.splice(idx, 1)
    }
  }

  async getStatus(id: string): Promise<AIModel> {
    try {
      const row = await this.prisma.aiModel.findUnique({ where: { id } })
      if (!row) throw new NotFoundException('Model not found')
      return this.toDto(row)
    } catch (error) {
      if (error instanceof NotFoundException) throw error
      const model = this.fallbackModels.find(m => m.id === id)
      if (!model) throw new NotFoundException('Model not found')
      return model
    }
  }
}

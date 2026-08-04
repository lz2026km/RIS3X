import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { floatInRange, hashString, intInRange, hashSlice } from '../../common/utils/deterministic-hash'

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
  /** true = 内存回退 (schema 暂无 cadResult 表, 结果未落库) */
  simulated: boolean
}

const mockStorage = new Map<string, CadResult>()

/**
 * 确定性 CAD 检测: 以 instanceId + modality + patient 信息为输入,
 * 输出同一输入恒定不变的检出结果 (无 Math.random)。
 */
function deterministicDetect(instanceId: string, modality: string, patientName: string | null): CadResult {
  const seed = `${instanceId}:${modality}:${patientName ?? ''}`
  const h = hashString(seed)
  const findingCount = 2 + (h % 4) // 2-5 个病灶
  const findings: CadDetection[] = []
  for (let i = 0; i < findingCount; i++) {
    const slice = hashSlice(h, i)
    const type: CadDetection['type'] = (slice & 0x3) === 0 ? 'calcification' : 'nodule'
    findings.push({
      type,
      x: intInRange(seed, 40, 460, i * 7 + 1),
      y: intInRange(seed, 40, 460, i * 7 + 2),
      width: intInRange(seed, 10, 64, i * 7 + 3),
      height: intInRange(seed, 10, 58, i * 7 + 4),
      confidence: floatInRange(seed, 0.55, 0.98, i * 7 + 5),
      size: floatInRange(seed, 2.0, 22.0, i * 7 + 6, 1),
    })
  }
  return {
    instanceId,
    findings,
    heatmapUrl: `/ai/cad/heatmap/${instanceId}`,
    detectedAt: new Date().toISOString(),
    simulated: true,
  }
}

@Injectable()
export class CadService {
  constructor(private readonly prisma: PrismaService) {}

  private async lookupInstance(instanceId: string): Promise<{ modality: string; patientName: string | null } | null> {
    const inst = await this.prisma.dicomInstance.findFirst({
      where: { OR: [{ sopInstanceUid: instanceId }, { id: instanceId }] },
      include: { report: { include: { patient: { select: { name: true } } } } },
    })
    if (!inst) return null
    return { modality: inst.modality, patientName: inst.report?.patient?.name ?? null }
  }

  async detect(instanceId: string): Promise<CadResult> {
    await new Promise((r) => setTimeout(r, 200))
    let context: { modality: string; patientName: string | null } | null = null
    try {
      context = await this.lookupInstance(instanceId)
    } catch {
      // DB unavailable -> fallback to deterministic generation with default context
    }
    const result = deterministicDetect(instanceId, context?.modality ?? 'CT', context?.patientName ?? null)
    mockStorage.set(instanceId, result)
    return result
  }

  async getResult(instanceId: string): Promise<CadResult> {
    const existing = mockStorage.get(instanceId)
    if (existing) return existing
    // 未在内存命中时, 尝试按真实影像数据确定性生成
    try {
      const context = await this.lookupInstance(instanceId)
      if (context) {
        const result = deterministicDetect(instanceId, context.modality, context.patientName)
        mockStorage.set(instanceId, result)
        return result
      }
    } catch {
      // DB unavailable -> NotFound 保持原语义
    }
    throw new NotFoundException(`No CAD result for ${instanceId}`)
  }
}

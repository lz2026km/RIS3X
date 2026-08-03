import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface CompressTask {
  id: string
  fileId: string
  transferSyntax: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  progress: number
  originalSize: number
  compressedSize: number | null
  error?: string
  createdAt: string
  updatedAt: string
}

export interface CompressRatio {
  instanceId: string
  sopClass: string
  sopClassName: string
  originalSize: number
  compressedSize: number
  ratio: number
  transferSyntax: string
}

export interface TransferSyntax {
  uid: string
  name: string
  lossy: boolean
}

const SUPPORTED_SYNTAXES: TransferSyntax[] = [
  { uid: '1.2.840.10008.1.2.4.90', name: 'JPEG 2000 Lossless', lossy: false },
  { uid: '1.2.840.10008.1.2.4.91', name: 'JPEG 2000 Lossy', lossy: true },
  { uid: '1.2.840.10008.1.2.4.80', name: 'JPEG-LS Lossless', lossy: false },
  { uid: '1.2.840.10008.1.2.4.81', name: 'JPEG-LS Lossy', lossy: true },
  { uid: '1.2.840.10008.1.2.4.50', name: 'JPEG Baseline Lossy', lossy: true },
  { uid: '1.2.840.10008.1.2.4.70', name: 'JPEG Lossless SV1', lossy: false },
]

const SOP_CLASS_RATIO: Record<string, { name: string; ratio: number }> = {
  '1.2.840.10008.5.1.4.1.1.2': { name: 'CT Image', ratio: 0.35 },
  '1.2.840.10008.5.1.4.1.1.4': { name: 'MR Image', ratio: 0.40 },
  '1.2.840.10008.5.1.4.1.1.1': { name: 'CR Image', ratio: 0.25 },
  '1.2.840.10008.5.1.4.1.1.1.1': { name: 'DX Image', ratio: 0.20 },
  '1.2.840.10008.5.1.4.1.1.1.2': { name: 'Mammography Image', ratio: 0.30 },
  '1.2.840.10008.5.1.4.1.1.7': { name: 'Secondary Capture', ratio: 0.45 },
  '1.2.840.10008.5.1.4.1.1.128': { name: 'Ultrasound Image', ratio: 0.50 },
  '1.2.840.10008.5.1.4.1.1.130': { name: 'Ultrasound MF Image', ratio: 0.50 },
  '1.2.840.10008.5.1.4.1.1.88.33': { name: 'Comprehensive SR', ratio: 0.60 },
  '1.2.840.10008.5.1.4.1.1.481.3': { name: 'PET Image', ratio: 0.35 },
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

@Injectable()
export class DicomCompressService {
  private readonly logger = new Logger(DicomCompressService.name)
  private memTasks = new Map<string, CompressTask>()
  private taskCounter = 0

  constructor(private readonly prisma: PrismaService) {}

  getSupportedSyntaxes(): TransferSyntax[] {
    return SUPPORTED_SYNTAXES
  }

  private toDto(row: { id: string; instanceUid: string; algorithm: string; status: string; progress: number; originalSize: number; compressedSize: number | null; error: string | null; createdAt: Date; updatedAt: Date }): CompressTask {
    return {
      id: row.id,
      fileId: row.instanceUid,
      transferSyntax: row.algorithm,
      status: (['pending', 'processing', 'done', 'failed'].includes(row.status) ? row.status : 'pending') as CompressTask['status'],
      progress: row.progress,
      originalSize: row.originalSize,
      compressedSize: row.compressedSize,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  async compress(fileId: string, transferSyntax: string): Promise<CompressTask> {
    const id = `task-${++this.taskCounter}`
    const originalSize = Math.round(Math.random() * 50 + 5) * 1024 * 1024
    try {
      await this.prisma.compressTask.create({
        data: { id, instanceUid: fileId, algorithm: transferSyntax, originalSize, status: 'pending', progress: 0 },
      })
      this.simulateProgress(id, originalSize)
      const row = await this.prisma.compressTask.findUniqueOrThrow({ where: { id } })
      return this.toDto(row)
    } catch {
      const task: CompressTask = {
        id, fileId, transferSyntax,
        status: 'pending', progress: 0,
        originalSize, compressedSize: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.memTasks.set(id, task)
      this.simulateProgress(id, originalSize)
      return task
    }
  }

  private async simulateProgress(id: string, originalSize: number): Promise<void> {
    const ratio = rand(0.15, 0.55)
    const compressedSize = Math.round(originalSize * ratio)
    await sleep(800)
    await this.updateTask(id, 'processing', 40)
    await sleep(1200)
    await this.updateTask(id, 'processing', 80)
    await sleep(1000)
    await this.updateTask(id, 'done', 100, compressedSize)
  }

  private async updateTask(id: string, status: CompressTask['status'], progress: number, compressedSize?: number): Promise<void> {
    const mem = this.memTasks.get(id)
    if (mem) {
      mem.status = status
      mem.progress = progress
      mem.compressedSize = compressedSize ?? mem.compressedSize
      mem.updatedAt = new Date().toISOString()
    }
    try {
      await this.prisma.compressTask.update({
        where: { id },
        data: { status, progress, compressedSize: compressedSize ?? undefined, error: null },
      })
    } catch {
      // DB unavailable -> in-memory progress keeps working
    }
  }

  async getStatus(id: string): Promise<CompressTask | null> {
    try {
      const row = await this.prisma.compressTask.findUnique({ where: { id } })
      if (!row) return null
      return this.toDto(row)
    } catch {
      return this.memTasks.get(id) ?? null
    }
  }

  async decompress(fileId: string): Promise<CompressTask> {
    const id = `decomp-${++this.taskCounter}`
    const originalSize = Math.round(Math.random() * 20 + 1) * 1024 * 1024
    const now = new Date().toISOString()
    try {
      await this.prisma.compressTask.create({
        data: { id, instanceUid: fileId, algorithm: '1.2.840.10008.1.2', originalSize, compressedSize: originalSize, ratio: 1, status: 'done', progress: 100 },
      })
      const row = await this.prisma.compressTask.findUniqueOrThrow({ where: { id } })
      return this.toDto(row)
    } catch {
      const task: CompressTask = {
        id, fileId, transferSyntax: '1.2.840.10008.1.2',
        status: 'done', progress: 100,
        originalSize, compressedSize: null,
        createdAt: now,
        updatedAt: now,
      }
      this.memTasks.set(id, task)
      return task
    }
  }

  async getRatio(instanceId: string): Promise<CompressRatio> {
    const sopKeys = Object.keys(SOP_CLASS_RATIO)
    const sopClass = sopKeys[Math.floor(Math.random() * sopKeys.length)]!
    const info = SOP_CLASS_RATIO[sopClass]!
    const originalSize = Math.round(Math.random() * 100 + 10) * 1024 * 1024
    const ratio = rand(info.ratio - 0.1, info.ratio + 0.05)
    const compressedSize = Math.round(originalSize * ratio)
    const result: CompressRatio = {
      instanceId,
      sopClass,
      sopClassName: info.name,
      originalSize,
      compressedSize,
      ratio: Math.round(ratio * 100),
      transferSyntax: '1.2.840.10008.1.2.4.90',
    }
    try {
      await this.prisma.compressTask.create({
        data: {
          instanceUid: instanceId,
          algorithm: '1.2.840.10008.1.2.4.90',
          originalSize,
          compressedSize,
          ratio: Math.round(ratio * 100) / 100,
          status: 'done',
          progress: 100,
        },
      })
    } catch {
      // DB unavailable -> keep ratio lookup result
    }
    return result
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

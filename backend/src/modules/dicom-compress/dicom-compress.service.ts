import { Injectable, Logger } from '@nestjs/common'

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
  private tasks = new Map<string, CompressTask>()
  private taskCounter = 0

  getSupportedSyntaxes(): TransferSyntax[] {
    return SUPPORTED_SYNTAXES
  }

  async compress(fileId: string, transferSyntax: string): Promise<CompressTask> {
    const id = `task-${++this.taskCounter}`
    const originalSize = Math.round(Math.random() * 50 + 5) * 1024 * 1024
    const task: CompressTask = {
      id, fileId, transferSyntax,
      status: 'pending', progress: 0,
      originalSize, compressedSize: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.tasks.set(id, task)
    this.simulateProgress(id, originalSize)
    return task
  }

  private async simulateProgress(id: string, originalSize: number): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) return
    task.status = 'processing'
    task.progress = 10
    task.updatedAt = new Date().toISOString()

    const ratio = rand(0.15, 0.55)
    await sleep(800)
    task.progress = 40
    task.updatedAt = new Date().toISOString()

    await sleep(1200)
    task.progress = 80
    task.updatedAt = new Date().toISOString()

    await sleep(1000)
    task.status = 'done'
    task.progress = 100
    task.compressedSize = Math.round(originalSize * ratio)
    task.updatedAt = new Date().toISOString()
  }

  getStatus(id: string): CompressTask | null {
    return this.tasks.get(id) ?? null
  }

  async decompress(fileId: string): Promise<CompressTask> {
    const id = `decomp-${++this.taskCounter}`
    const task: CompressTask = {
      id, fileId, transferSyntax: '1.2.840.10008.1.2',
      status: 'done', progress: 100,
      originalSize: Math.round(Math.random() * 20 + 1) * 1024 * 1024,
      compressedSize: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.tasks.set(id, task)
    return task
  }

  getRatio(instanceId: string): CompressRatio {
    const sopKeys = Object.keys(SOP_CLASS_RATIO)
    const sopClass = sopKeys[Math.floor(Math.random() * sopKeys.length)]!
    const info = SOP_CLASS_RATIO[sopClass]!
    const originalSize = Math.round(Math.random() * 100 + 10) * 1024 * 1024
    const ratio = rand(info.ratio - 0.1, info.ratio + 0.05)
    const compressedSize = Math.round(originalSize * ratio)
    return {
      instanceId,
      sopClass,
      sopClassName: info.name,
      originalSize,
      compressedSize,
      ratio: Math.round(ratio * 100),
      transferSyntax: '1.2.840.10008.1.2.4.90',
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

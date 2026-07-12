import { Injectable, NotFoundException } from '@nestjs/common'

interface VolumeJob {
  jobId: string
  seriesUID: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  volume: { x: number; y: number; z: number } | null
  error?: string
  createdAt: Date
}

@Injectable()
export class VolumeService {
  private jobs = new Map<string, VolumeJob>()

  async reconstruct(seriesUID: string): Promise<{ jobId: string; volume: { x: number; y: number; z: number } }> {
    const jobId = `vol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const volume = { x: 512, y: 512, z: 256 }
    const job: VolumeJob = { jobId, seriesUID, status: 'processing', progress: 0, volume, createdAt: new Date() }
    this.jobs.set(jobId, job)
    this.simulateProgress(jobId)
    return { jobId, volume }
  }

  getStatus(jobId: string): { status: string; progress: number; volume: { x: number; y: number; z: number } | null } {
    const job = this.jobs.get(jobId)
    if (!job) throw new NotFoundException(`Job ${jobId} not found`)
    return { status: job.status, progress: job.progress, volume: job.volume }
  }

  generateMPR(data: { jobId: string; plane: 'axial' | 'sagittal' | 'coronal'; sliceIndex: number }) {
    const job = this.jobs.get(data.jobId)
    if (!job) throw new NotFoundException(`Job ${data.jobId} not found`)
    const v = job.volume ?? { x: 512, y: 512, z: 256 }
    const total = data.plane === 'axial' ? v.z : data.plane === 'sagittal' ? v.x : v.y
    return {
      plane: data.plane,
      sliceIndex: Math.min(data.sliceIndex, total - 1),
      totalSlices: total,
      dimensions: { width: 512, height: 512 },
      dataUrl: `/mock/volume/mpr/${data.jobId}/${data.plane}/${data.sliceIndex}`,
    }
  }

  generateMIP(data: { jobId: string; direction: 'axial' | 'sagittal' | 'coronal' }) {
    return {
      direction: data.direction,
      dimensions: { width: 512, height: 512 },
      dataUrl: `/mock/volume/mip/${data.jobId}/${data.direction}`,
    }
  }

  private simulateProgress(jobId: string) {
    const interval = setInterval(() => {
      const job = this.jobs.get(jobId)
      if (!job) { clearInterval(interval); return }
      job.progress = Math.min(100, job.progress + 10)
      if (job.progress >= 100) {
        job.status = 'completed'
        clearInterval(interval)
      }
    }, 200)
  }
}

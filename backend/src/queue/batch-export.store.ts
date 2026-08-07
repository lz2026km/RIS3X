/**
 * [W4-B] 批量报告导出任务存储 (进程内单例)
 * - POST /reports/batch-export 创建任务 → 入 BullMQ reportExport 队列
 * - 消费者逐份导出并回写进度/下载结果
 * - GET /reports/batch-export/:taskId 轮询任务状态
 */

export interface BatchExportDownload {
  reportId: string
  fileName: string
  filePath: string
  sizeBytes: number
  format: string
  downloadUrl: string
}

export interface BatchExportTask {
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  total: number
  done: number
  failedCount: number
  format: string
  downloads: BatchExportDownload[]
  error?: string
  createdAt: string
  updatedAt: string
}

class BatchExportStoreImpl {
  private readonly tasks = new Map<string, BatchExportTask>()

  get(taskId: string): BatchExportTask | undefined {
    return this.tasks.get(taskId)
  }

  create(taskId: string, total: number, format: string): BatchExportTask {
    const now = new Date().toISOString()
    const task: BatchExportTask = {
      taskId,
      status: 'pending',
      progress: 0,
      total,
      done: 0,
      failedCount: 0,
      format,
      downloads: [],
      createdAt: now,
      updatedAt: now,
    }
    this.tasks.set(taskId, task)
    return task
  }

  update(taskId: string, patch: Partial<BatchExportTask>): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    const next = { ...task, ...patch, taskId, updatedAt: new Date().toISOString() }
    this.tasks.set(taskId, next)
  }

  addDownload(taskId: string, download: BatchExportDownload): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.downloads = [...task.downloads, download]
    task.done = task.downloads.length
    task.updatedAt = new Date().toISOString()
    this.tasks.set(taskId, task)
  }

  clear(): void {
    this.tasks.clear()
  }
}

export const batchExportStore = new BatchExportStoreImpl()

export function createBatchExportTaskId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

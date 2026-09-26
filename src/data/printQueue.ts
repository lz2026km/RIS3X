// G005 DICOM Print SCP - 打印队列模拟数据 v1.0.0
// 模拟DICOM Print SCP状态变化：Pending → Printing → Completed

export type PrintStatus = 'Pending' | 'Printing' | 'Completed' | 'Failed'

export interface PrintJob {
  id: string
  filmId: string
  patientName: string
  patientId: string
  studyUid: string
  examType: string
  filmCount: number
  layout: '1×1' | '2×2' | '4×4' | '8×8'
  medium: 'Blue Film' | 'Clear Film'
  copies: number
  printer: '直连' | '洗片机1' | '洗片机2'
  status: PrintStatus
  createTime: string
  completeTime?: string
  progress?: number
  errorMsg?: string
}

// 模拟打印队列数据 - Pending/Printing/Completed各5条
export const initialPrintQueue: PrintJob[] = [
  // Pending 队列
  {
    id: 'PJ001',
    filmId: 'FLM20260504001',
    patientName: '张三',
    patientId: 'P20260501001',
    studyUid: '1.2.840.113619.2.55.3.123456',
    examType: 'CT',
    filmCount: 2,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '直连',
    status: 'Pending',
    createTime: '2026-05-04 08:30:00',
    progress: 0
  },
  {
    id: 'PJ002',
    filmId: 'FLM20260504002',
    patientName: '李四',
    patientId: 'P20260501002',
    studyUid: '1.2.840.113619.2.55.3.234567',
    examType: 'MR',
    filmCount: 4,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Pending',
    createTime: '2026-05-04 08:25:00',
    progress: 0
  },
  {
    id: 'PJ003',
    filmId: 'FLM20260504003',
    patientName: '王五',
    patientId: 'P20260501003',
    studyUid: '1.2.840.113619.2.55.3.345678',
    examType: 'DR',
    filmCount: 1,
    layout: '1×1',
    medium: 'Clear Film',
    copies: 2,
    printer: '洗片机2',
    status: 'Pending',
    createTime: '2026-05-04 08:20:00',
    progress: 0
  },
  {
    id: 'PJ004',
    filmId: 'FLM20260504004',
    patientName: '赵六',
    patientId: 'P20260501004',
    studyUid: '1.2.840.113619.2.55.3.456789',
    examType: 'CT',
    filmCount: 2,
    layout: '4×4',
    medium: 'Blue Film',
    copies: 1,
    printer: '直连',
    status: 'Pending',
    createTime: '2026-05-04 08:15:00',
    progress: 0
  },
  {
    id: 'PJ005',
    filmId: 'FLM20260504005',
    patientName: '钱七',
    patientId: 'P20260501005',
    studyUid: '1.2.840.113619.2.55.3.567890',
    examType: 'CR',
    filmCount: 1,
    layout: '1×1',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Pending',
    createTime: '2026-05-04 08:10:00',
    progress: 0
  },
  // Printing 队列
  {
    id: 'PJ006',
    filmId: 'FLM20260504006',
    patientName: '孙八',
    patientId: 'P20260501006',
    studyUid: '1.2.840.113619.2.55.3.678901',
    examType: 'CT',
    filmCount: 3,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '直连',
    status: 'Printing',
    createTime: '2026-05-04 08:05:00',
    progress: 45
  },
  {
    id: 'PJ007',
    filmId: 'FLM20260504007',
    patientName: '周九',
    patientId: 'P20260501007',
    studyUid: '1.2.840.113619.2.55.3.789012',
    examType: 'MR',
    filmCount: 4,
    layout: '4×4',
    medium: 'Clear Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Printing',
    createTime: '2026-05-04 08:00:00',
    progress: 72
  },
  {
    id: 'PJ008',
    filmId: 'FLM20260504008',
    patientName: '吴十',
    patientId: 'P20260501008',
    studyUid: '1.2.840.113619.2.55.3.890123',
    examType: 'DR',
    filmCount: 2,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机2',
    status: 'Printing',
    createTime: '2026-05-04 07:55:00',
    progress: 30
  },
  {
    id: 'PJ009',
    filmId: 'FLM20260504009',
    patientName: '郑十一',
    patientId: 'P20260501009',
    studyUid: '1.2.840.113619.2.55.3.901234',
    examType: 'CT',
    filmCount: 2,
    layout: '1×1',
    medium: 'Blue Film',
    copies: 2,
    printer: '直连',
    status: 'Printing',
    createTime: '2026-05-04 07:50:00',
    progress: 88
  },
  {
    id: 'PJ010',
    filmId: 'FLM20260504010',
    patientName: '冯十二',
    patientId: 'P20260501010',
    studyUid: '1.2.840.113619.2.55.3.012345',
    examType: 'RF',
    filmCount: 1,
    layout: '1×1',
    medium: 'Clear Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Printing',
    createTime: '2026-05-04 07:45:00',
    progress: 60
  },
  // Completed 队列
  {
    id: 'PJ011',
    filmId: 'FLM20260504011',
    patientName: '陈十三',
    patientId: 'P20260501011',
    studyUid: '1.2.840.113619.2.55.3.112345',
    examType: 'CT',
    filmCount: 2,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '直连',
    status: 'Completed',
    createTime: '2026-05-04 07:30:00',
    completeTime: '2026-05-04 07:35:00',
    progress: 100
  },
  {
    id: 'PJ012',
    filmId: 'FLM20260504012',
    patientName: '林十四',
    patientId: 'P20260501012',
    studyUid: '1.2.840.113619.2.55.3.212345',
    examType: 'MR',
    filmCount: 4,
    layout: '4×4',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Completed',
    createTime: '2026-05-04 07:20:00',
    completeTime: '2026-05-04 07:28:00',
    progress: 100
  },
  {
    id: 'PJ013',
    filmId: 'FLM20260504013',
    patientName: '黄十五',
    patientId: 'P20260501013',
    studyUid: '1.2.840.113619.2.55.3.312345',
    examType: 'DR',
    filmCount: 1,
    layout: '1×1',
    medium: 'Clear Film',
    copies: 1,
    printer: '洗片机2',
    status: 'Completed',
    createTime: '2026-05-04 07:15:00',
    completeTime: '2026-05-04 07:18:00',
    progress: 100
  },
  {
    id: 'PJ014',
    filmId: 'FLM20260504014',
    patientName: '潘十六',
    patientId: 'P20260501014',
    studyUid: '1.2.840.113619.2.55.3.412345',
    examType: 'CT',
    filmCount: 3,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 2,
    printer: '直连',
    status: 'Completed',
    createTime: '2026-05-04 07:00:00',
    completeTime: '2026-05-04 07:10:00',
    progress: 100
  },
  {
    id: 'PJ015',
    filmId: 'FLM20260504015',
    patientName: '许十七',
    patientId: 'P20260501015',
    studyUid: '1.2.840.113619.2.55.3.512345',
    examType: 'CR',
    filmCount: 1,
    layout: '1×1',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Completed',
    createTime: '2026-05-04 06:50:00',
    completeTime: '2026-05-04 06:55:00',
    progress: 100
  }
]

// 打印历史记录（最近20条，用于表格展示）
export const printHistory: PrintJob[] = [
  ...initialPrintQueue.filter(job => job.status === 'Completed' || job.status === 'Failed'),
  // 添加更多历史记录
  {
    id: 'PJ016',
    filmId: 'FLM20260504016',
    patientName: '蒋十八',
    patientId: 'P20260501016',
    studyUid: '1.2.840.113619.2.55.3.612345',
    examType: 'CT',
    filmCount: 2,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '直连',
    status: 'Completed',
    createTime: '2026-05-04 06:40:00',
    completeTime: '2026-05-04 06:45:00',
    progress: 100
  },
  {
    id: 'PJ017',
    filmId: 'FLM20260504017',
    patientName: '韩十九',
    patientId: 'P20260501017',
    studyUid: '1.2.840.113619.2.55.3.712345',
    examType: 'MR',
    filmCount: 4,
    layout: '4×4',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机2',
    status: 'Completed',
    createTime: '2026-05-04 06:30:00',
    completeTime: '2026-05-04 06:38:00',
    progress: 100
  },
  {
    id: 'PJ018',
    filmId: 'FLM20260504018',
    patientName: '杨二十',
    patientId: 'P20260501018',
    studyUid: '1.2.840.113619.2.55.3.812345',
    examType: 'DR',
    filmCount: 1,
    layout: '1×1',
    medium: 'Clear Film',
    copies: 1,
    printer: '直连',
    status: 'Completed',
    createTime: '2026-05-04 06:20:00',
    completeTime: '2026-05-04 06:25:00',
    progress: 100
  },
  {
    id: 'PJ019',
    filmId: 'FLM20260504019',
    patientName: '朱二十一',
    patientId: 'P20260501019',
    studyUid: '1.2.840.113619.2.55.3.912345',
    examType: 'CT',
    filmCount: 2,
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机1',
    status: 'Failed',
    createTime: '2026-05-04 06:10:00',
    progress: 50,
    errorMsg: '打印机缺纸'
  },
  {
    id: 'PJ020',
    filmId: 'FLM20260504020',
    patientName: '秦二十二',
    patientId: 'P20260501020',
    studyUid: '1.2.840.113619.2.55.3.022345',
    examType: 'RF',
    filmCount: 1,
    layout: '1×1',
    medium: 'Blue Film',
    copies: 1,
    printer: '洗片机2',
    status: 'Completed',
    createTime: '2026-05-04 06:00:00',
    completeTime: '2026-05-04 06:05:00',
    progress: 100
  }
]

// 打印队列状态管理器 - 模拟DICOM Print SCP状态变化
class PrintQueueManager {
  private queue: PrintJob[] = [...initialPrintQueue]
  private history: PrintJob[] = [...printHistory]
  private listeners: ((queue: PrintJob[], history: PrintJob[]) => void)[] = []
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor() {
    // 启动定时器模拟状态变化
    this.startSimulation()
  }

  // 获取当前队列
  getQueue(): PrintJob[] {
    return this.queue
  }

  // 获取历史记录
  getHistory(): PrintJob[] {
    return this.history
  }

  // 订阅队列变化
  subscribe(listener: (queue: PrintJob[], history: PrintJob[]) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  // 通知所有监听器
  private notify(): void {
    this.listeners.forEach(listener => listener(this.queue, this.history))
  }

  // 启动模拟 - 定期将Pending→Printing→Completed
  private startSimulation(): void {
    this.intervalId = setInterval(() => {
      let changed = false

      // 处理 Pending → Printing
      const pendingJobs = this.queue.filter(job => job.status === 'Pending')
      if (pendingJobs.length > 0) {
        const job = pendingJobs[0]
        if (job) {
          job.status = 'Printing'
          job.progress = 0
          changed = true
        }
      }

      // 处理 Printing 进度
      const printingJobs = this.queue.filter(job => job.status === 'Printing')
      printingJobs.forEach(job => {
        if (job.progress !== undefined && job.progress < 100) {
          job.progress += Math.floor(Math.random() * 15) + 10
          if (job.progress >= 100) {
            job.progress = 100
            job.status = 'Completed'
            job.completeTime = this.getCurrentTime()
            // 移到历史记录
            this.history = [job, ...this.history.slice(0, 19)]
            changed = true
          }
        }
      })

      if (changed) {
        this.notify()
      }
    }, 3000) // 每3秒更新一次
  }

  // 停止模拟
  stopSimulation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // 添加新打印任务
  addJob(job: Omit<PrintJob, 'id' | 'filmId' | 'status' | 'createTime' | 'progress'>): PrintJob {
    const newJob: PrintJob = {
      ...job,
      id: `PJ${String(this.queue.length + 1).padStart(3, '0')}`,
      filmId: `FLM20260504${String(this.queue.length + 1).padStart(3, '0')}`,
      status: 'Pending',
      createTime: this.getCurrentTime(),
      progress: 0
    }
    this.queue = [newJob, ...this.queue]
    this.notify()
    return newJob
  }

  // 获取当前时间字符串
  private getCurrentTime(): string {
    const now = new Date()
    return now.toISOString().replace('T', ' ').substring(0, 19)
  }

  // 重新打印失败任务
  retryJob(jobId: string): boolean {
    const job = this.queue.find(j => j.id === jobId)
    if (job && job.status === 'Failed') {
      job.status = 'Pending'
      job.progress = 0
      job.errorMsg = undefined
      this.notify()
      return true
    }
    return false
  }

  // 取消打印任务
  cancelJob(jobId: string): boolean {
    const index = this.queue.findIndex(j => j.id === jobId)
    if (index !== -1) {
      this.queue = [...this.queue.slice(0, index), ...this.queue.slice(index + 1)]
      this.notify()
      return true
    }
    return false
  }
}

// 导出单例
export const printQueueManager = new PrintQueueManager()

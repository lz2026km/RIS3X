/**
 * G005 放射RIS系统 v3.0.6.11-80 - 叫号队列服务 (W1-A, P0)
 * - GET /queue        : 候诊队列 (从 Exam/Appointment 派生 + 内存叫号状态)
 * - GET /queue/rooms  : 叫号房间列表 (从 Device 聚合)
 * - GET /queue/:roomId: 房间队列
 * - GET /queue/:roomId/status: 房间状态
 * - POST /queue/:id/call|complete|recall: 叫号操作 (内存状态)
 * DB 不可用时回退内置种子数据, 保证前端叫号流程可用。
 */
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

export type QueueStatus = 'waiting' | 'called' | 'in_service' | 'completed'
export type QueueStatusZh = '等待中' | '已呼叫' | '检查中' | '已完成'

export interface QueueCallItem {
  id: string
  examId?: string
  queueNum: string
  queueNumber: string
  patientId: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItemName: string
  examRoom: string
  roomId: string
  status: QueueStatusZh
  registerTime: string
  waitMinutes: number
  priority: '普通' | '紧急' | '危重'
  patientType: '急诊' | '住院' | '门诊' | '体检'
  calledCount: number
  lastCalledTime?: string
}

export interface ExamRoomStatus {
  id: string
  name: string
  roomNumber: string
  modality: string
  status: '空闲' | '使用中' | '暂停' | '维护中'
  currentPatient?: string
  currentQueueNum?: string
  completedToday: number
  waitCount: number
  queueCount: number
}

interface CallState {
  status: QueueStatus
  calledCount: number
  lastCalledTime?: string
  completedAt?: string
}

const STATUS_TO_ZH: Record<QueueStatus, QueueStatusZh> = {
  waiting: '等待中',
  called: '已呼叫',
  in_service: '检查中',
  completed: '已完成',
}

const PRIORITY_TO_ZH: Record<string, '普通' | '紧急' | '危重'> = {
  STAT: '危重',
  URGENT: '紧急',
  ROUTINE: '普通',
}

const TYPE_TO_ZH: Record<string, '急诊' | '住院' | '门诊' | '体检'> = {
  EMERGENCY: '急诊',
  INPATIENT: '住院',
  OUTPATIENT: '门诊',
  PHYSICAL: '体检',
}

const DEVICE_STATE_TO_ZH: Record<string, '空闲' | '使用中' | '暂停' | '维护中'> = {
  IDLE: '空闲',
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  BROKEN: '维护中',
  OFFLINE: '暂停',
}

const OPEN_EXAM_STATES = ['SCHEDULED', 'CHECKED_IN', 'REGISTERED', 'IN_PROGRESS']

// ===== 内置回退数据 (DB 不可用 / 空库时保证页面可用) =====
const SEED_ROOMS: ExamRoomStatus[] = [
  { id: 'ROOM-CT1', name: 'CT室1', roomNumber: 'CT-01', modality: 'CT', status: '使用中', currentPatient: '王芳', currentQueueNum: 'Q002', completedToday: 12, waitCount: 5, queueCount: 5 },
  { id: 'ROOM-MR1', name: 'MR室1', roomNumber: 'MR-01', modality: 'MR', status: '空闲', completedToday: 8, waitCount: 3, queueCount: 3 },
  { id: 'ROOM-DR1', name: 'DR室1', roomNumber: 'DR-01', modality: 'DR', status: '空闲', completedToday: 15, waitCount: 7, queueCount: 7 },
  { id: 'ROOM-DSA1', name: 'DSA室1', roomNumber: 'DSA-01', modality: 'DSA', status: '使用中', currentPatient: '刘洋', currentQueueNum: 'Q004', completedToday: 3, waitCount: 2, queueCount: 2 },
  { id: 'ROOM-MG1', name: '钼靶室1', roomNumber: 'MG-01', modality: 'MG', status: '空闲', completedToday: 6, waitCount: 4, queueCount: 4 },
  { id: 'ROOM-CT2', name: 'CT室2', roomNumber: 'CT-02', modality: 'CT', status: '暂停', completedToday: 10, waitCount: 0, queueCount: 0 },
]

const SEED_QUEUE: QueueCallItem[] = [
  { id: 'q-SEED-001', queueNum: 'Q001', queueNumber: 'Q001', patientId: 'RAD-P001', patientName: '张伟', gender: '男', age: 30, modality: 'DR', examItemName: '腰椎正侧位', examRoom: 'DR室1', roomId: 'ROOM-DR1', status: '等待中', registerTime: '13:10', waitMinutes: 5, priority: '普通', patientType: '住院', calledCount: 0 },
  { id: 'q-SEED-002', queueNum: 'Q002', queueNumber: 'Q002', patientId: 'RAD-P002', patientName: '王芳', gender: '女', age: 67, modality: 'MR', examItemName: '腰椎MR平扫', examRoom: 'MR室1', roomId: 'ROOM-MR1', status: '等待中', registerTime: '08:40', waitMinutes: 12, priority: '普通', patientType: '急诊', calledCount: 0 },
  { id: 'q-SEED-003', queueNum: 'Q003', queueNumber: 'Q003', patientId: 'RAD-P003', patientName: '李明', gender: '男', age: 81, modality: 'CT', examItemName: '胸部CT平扫', examRoom: 'CT室1', roomId: 'ROOM-CT1', status: '等待中', registerTime: '09:40', waitMinutes: 20, priority: '危重', patientType: '门诊', calledCount: 0 },
  { id: 'q-SEED-004', queueNum: 'Q004', queueNumber: 'Q004', patientId: 'RAD-P004', patientName: '刘洋', gender: '男', age: 45, modality: 'DSA', examItemName: '冠脉造影', examRoom: 'DSA室1', roomId: 'ROOM-DSA1', status: '已呼叫', registerTime: '10:05', waitMinutes: 30, priority: '紧急', patientType: '急诊', calledCount: 1, lastCalledTime: new Date().toLocaleString('zh-CN') },
  { id: 'q-SEED-005', queueNum: 'Q005', queueNumber: 'Q005', patientId: 'RAD-P005', patientName: '赵敏', gender: '女', age: 52, modality: 'MG', examItemName: '乳腺钼靶', examRoom: '钼靶室1', roomId: 'ROOM-MG1', status: '检查中', registerTime: '11:20', waitMinutes: 25, priority: '普通', patientType: '体检', calledCount: 1 },
  { id: 'q-SEED-006', queueNum: 'Q006', queueNumber: 'Q006', patientId: 'RAD-P006', patientName: '陈杰', gender: '男', age: 39, modality: 'CT', examItemName: '腹部CT增强', examRoom: 'CT室1', roomId: 'ROOM-CT1', status: '等待中', registerTime: '11:45', waitMinutes: 40, priority: '普通', patientType: '门诊', calledCount: 0 },
]

@Injectable()
export class QueueService {
  private readonly callStates = new Map<string, CallState>()
  private readonly roomCounters = new Map<string, number>()
  private readonly roomCurrent = new Map<string, string>()
  // [G005 W2-A P0] 叫号状态落库: DB 可用时读写 queue_states 表, 不可用回退内存 Map
  private dbAvailable: boolean | null = null
  private hydrated = false

  constructor(private readonly prisma: PrismaService) {}

  // ================= 持久化 (叫号状态落库, DB 不可用静默回退内存) =================

  private async checkDb(): Promise<boolean> {
    if (this.dbAvailable !== null) return this.dbAvailable
    try {
      await (this.prisma as any).queueState?.count()
      this.dbAvailable = true
    } catch {
      this.dbAvailable = false
    }
    return this.dbAvailable
  }

  /** 启动/首次访问时从 queue_states 恢复内存状态 (条目叫号状态 + 房间计数 + 房间当前号) */
  private async hydrateFromDb(): Promise<void> {
    if (this.dbAvailable === false || this.hydrated) return
    try {
      const rows = await (this.prisma as any).queueState?.findMany({ where: { tenantId: currentTenantId() } })
      if (!Array.isArray(rows)) return
      this.dbAvailable = true
      this.hydrated = true
      for (const row of rows) {
        if (String(row.entryId ?? '').startsWith('ROOM:')) {
          const roomId = String(row.entryId).slice(5)
          const num = Number(String(row.currentNumber ?? '').replace(/\D/g, ''))
          if (Number.isFinite(num) && num > 0) this.roomCounters.set(roomId, num)
        } else {
          const st = STATUS_TO_ZH[(row.status as QueueStatus) ?? 'waiting']
          if (!st) continue
          this.callStates.set(row.entryId, {
            status: row.status as QueueStatus,
            calledCount: row.calledCount ?? 0,
            lastCalledTime: row.lastCallAt ? new Date(row.lastCallAt).toLocaleString('zh-CN') : undefined,
            completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : undefined,
          })
        }
      }
      // 房间当前号: 每个房间最新一条 called/in_service 状态条目
      const currentByRoom = new Map<string, { entryId: string; ts: number }>()
      for (const row of rows) {
        if (String(row.entryId ?? '').startsWith('ROOM:')) continue
        const status = row.status as QueueStatus
        if (status !== 'called' && status !== 'in_service') continue
        const ts = row.lastCallAt ? new Date(row.lastCallAt).getTime() : 0
        const cur = currentByRoom.get(row.roomId)
        if (!cur || ts >= cur.ts) currentByRoom.set(row.roomId, { entryId: row.entryId, ts })
      }
      for (const [roomId, v] of currentByRoom) this.roomCurrent.set(roomId, v.entryId)
    } catch {
      this.dbAvailable = false
    }
  }

  /** 持久化单条目叫号状态 (upsert queue_states, 失败静默回退内存) */
  private async persistEntry(entry: QueueCallItem, state: CallState): Promise<void> {
    if (!(await this.checkDb())) return
    try {
      await (this.prisma as any).queueState?.upsert({
        where: { tenantId_entryId: { tenantId: currentTenantId(), entryId: entry.id } },
        create: {
          tenantId: currentTenantId(),
          roomId: entry.roomId ?? '',
          entryId: entry.id,
          status: state.status,
          currentNumber: entry.queueNum,
          lastCallAt: state.lastCalledTime ? new Date() : null,
          calledCount: state.calledCount,
          completedAt: state.completedAt ? new Date(state.completedAt) : null,
        },
        update: {
          roomId: entry.roomId ?? '',
          status: state.status,
          currentNumber: entry.queueNum,
          lastCallAt: state.lastCalledTime ? new Date() : null,
          calledCount: state.calledCount,
          completedAt: state.completedAt ? new Date(state.completedAt) : null,
        },
      })
    } catch {
      this.dbAvailable = false
    }
  }

  /** 持久化房间叫号计数 (ROOM:<roomId> 元数据行, currentNumber=最近叫号序号) */
  private async persistRoomCounter(roomId: string, queueNum: string): Promise<void> {
    if (!roomId || !(await this.checkDb())) return
    try {
      const entryId = `ROOM:${roomId}`
      await (this.prisma as any).queueState?.upsert({
        where: { tenantId_entryId: { tenantId: currentTenantId(), entryId } },
        create: { tenantId: currentTenantId(), roomId, entryId, status: 'counter', currentNumber: queueNum, lastCallAt: new Date() },
        update: { roomId, status: 'counter', currentNumber: queueNum, lastCallAt: new Date() },
      })
    } catch {
      this.dbAvailable = false
    }
  }

  // ================= 派生数据 =================

  private async fetchDevices(): Promise<any[] | null> {
    try {
      const devices = await this.prisma.device.findMany({
        where: { tenantId: currentTenantId() },
        orderBy: { name: 'asc' },
      })
      return devices.length > 0 ? devices : null
    } catch {
      return null
    }
  }

  private async fetchPendingExams(): Promise<any[] | null> {
    try {
      const exams = await this.prisma.exam.findMany({
        where: { tenantId: currentTenantId(), state: { in: OPEN_EXAM_STATES } as any },
        orderBy: { scheduledAt: 'asc' },
        include: { patient: true, device: true },
        take: 50,
      })
      return exams.length > 0 ? exams : null
    } catch {
      return null
    }
  }

  // ================= 核心派生 =================

  private statusOf(id: string, fallback: QueueStatus): { status: QueueStatusZh; calledCount: number; lastCalledTime?: string } {
    const s = this.callStates.get(id)
    if (!s) return { status: STATUS_TO_ZH[fallback], calledCount: 0 }
    return { status: STATUS_TO_ZH[s.status], calledCount: s.calledCount, lastCalledTime: s.lastCalledTime }
  }

  private queueNumberFor(id: string, roomId?: string): string {
    const counterKey = roomId ?? id
    const seq = (this.roomCounters.get(counterKey) ?? 0) + 1
    this.roomCounters.set(counterKey, seq)
    return `Q${String(seq).padStart(3, '0')}`
  }

  private toItem(exam: any): QueueCallItem {
    const id = `q-${exam.id}`
    const fallback: QueueStatus =
      exam.state === 'IN_PROGRESS' || exam.state === 'CHECKED_IN' ? 'in_service' : 'waiting'
    const st = this.statusOf(id, fallback)
    const patient = exam.patient ?? {}
    const device = exam.device ?? {}
    const scheduledAt = exam.scheduledAt ? new Date(exam.scheduledAt) : null
    const waitMinutes = scheduledAt
      ? Math.max(0, Math.round((Date.now() - scheduledAt.getTime()) / 60000))
      : 0
    const age = patient.birthDate
      ? Math.max(0, Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 86400_000)))
      : 0
    const genderZh = patient.gender === 'MALE' ? '男' : patient.gender === 'FEMALE' ? '女' : '未知'
    const roomName = device.name ?? device.location ?? '未知检查室'
    const queueNum = this.queueNumberFor(id, exam.deviceId)
    const item: QueueCallItem = {
      id,
      examId: exam.id,
      queueNum,
      queueNumber: queueNum,
      patientId: exam.patientId,
      patientName: patient.name ?? '未知患者',
      gender: genderZh,
      age,
      modality: exam.modality ?? '',
      examItemName: exam.bodyPart ?? exam.modality ?? '影像检查',
      examRoom: roomName,
      roomId: exam.deviceId ?? '',
      status: st.status,
      registerTime: scheduledAt
        ? `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`
        : '',
      waitMinutes,
      priority: PRIORITY_TO_ZH[exam.priority ?? ''] ?? '普通',
      patientType: TYPE_TO_ZH[patient.type ?? ''] ?? '门诊',
      calledCount: st.calledCount,
      lastCalledTime: st.lastCalledTime,
    }
    return item
  }

  // ================= API: 列表 =================

  async list(): Promise<QueueCallItem[]> {
    await this.hydrateFromDb()
    const exams = await this.fetchPendingExams()
    if (!exams) return SEED_QUEUE.map((s) => this.applyStateToSeed(s))
    return exams.map((e) => this.toItem(e))
  }

  private applyStateToSeed(item: QueueCallItem): QueueCallItem {
    const s = this.callStates.get(item.id)
    if (!s) return item
    return {
      ...item,
      status: STATUS_TO_ZH[s.status],
      calledCount: s.calledCount,
      lastCalledTime: s.lastCalledTime,
    }
  }

  async rooms(): Promise<ExamRoomStatus[]> {
    const devices = await this.fetchDevices()
    if (!devices) return SEED_ROOMS.map((r) => ({ ...r }))
    const exams = (await this.fetchPendingExams()) ?? []
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let todayCompleted = 0
    try {
      todayCompleted = await this.prisma.exam.count({
        where: { tenantId: currentTenantId(), completedAt: { gte: dayStart } } as any,
      })
    } catch {
      todayCompleted = 0
    }
    return devices.map((d: any) => {
      const currentEntryId = this.roomCurrent.get(d.id)
      const current = currentEntryId ? this.findSeedEntry(currentEntryId) : undefined
      const roomExams = exams.filter((e: any) => e.deviceId === d.id)
      const waitCount = roomExams.length
      const status: ExamRoomStatus['status'] = current ? '使用中' : DEVICE_STATE_TO_ZH[d.state ?? 'IDLE'] ?? '空闲'
      return {
        id: d.id,
        name: d.name ?? d.code ?? '检查室',
        roomNumber: d.code ?? d.id,
        modality: d.modality ?? '',
        status,
        currentPatient: current?.patientName,
        currentQueueNum: current?.queueNum,
        completedToday: todayCompleted,
        waitCount,
        queueCount: waitCount,
      }
    })
  }

  async roomQueue(roomId: string): Promise<{ roomId: string; roomName: string; queue: QueueCallItem[] }> {
    const all = await this.list()
    const queue = all.filter((i) => i.roomId === roomId)
    if (queue.length === 0) {
      const rooms = await this.rooms()
      if (!rooms.some((r) => r.id === roomId)) {
        throw new NotFoundException(`Room ${roomId} not found`)
      }
    }
    const rooms = await this.rooms()
    const roomName = queue[0]?.examRoom ?? rooms.find((r) => r.id === roomId)?.name ?? roomId
    return { roomId, roomName, queue }
  }

  async roomStatus(roomId: string): Promise<ExamRoomStatus> {
    const rooms = await this.rooms()
    const room = rooms.find((r) => r.id === roomId)
    if (!room) throw new NotFoundException(`Room ${roomId} not found`)
    return room
  }

  // ================= API: 叫号操作 =================

  private findSeedEntry(id: string): QueueCallItem | null {
    return SEED_QUEUE.find((s) => s.id === id) ?? null
  }

  private async resolveEntry(target: string): Promise<QueueCallItem | null> {
    const known = this.findSeedEntry(target)
    if (known) return known
    const prefixed = target.startsWith('q-') ? this.findSeedEntry(target) : this.findSeedEntry(`q-${target}`)
    if (prefixed) return prefixed
    const exams = await this.fetchPendingExams()
    if (!exams) return null
    const examId = target.startsWith('q-') ? target.slice(2) : target
    const exam = exams.find((e: any) => e.id === examId)
    if (exam) return this.toItem(exam)
    return null
  }

  async call(target: string, body: { examId?: string; patientId?: string } = {}): Promise<QueueCallItem> {
    await this.hydrateFromDb()
    let entry = await this.resolveEntry(target)
    if (!entry && body.examId) entry = await this.resolveEntry(body.examId)
    if (!entry && body.patientId) {
      const exams = await this.fetchPendingExams()
      const exam = exams?.find((e: any) => e.patientId === body.patientId)
      if (exam) entry = this.toItem(exam)
    }
    // 兜底: 视为 roomId → 叫该房间队列中下一个等待患者
    if (!entry) {
      const all = await this.list()
      entry = all.find((i) => i.roomId === target && i.status === '等待中') ?? null
    }
    if (!entry) throw new NotFoundException(`Queue entry ${target} not found`)

    const prev = this.callStates.get(entry.id)
    const state: CallState = {
      status: 'called',
      calledCount: (prev?.calledCount ?? 0) + 1,
      lastCalledTime: new Date().toLocaleString('zh-CN'),
      completedAt: undefined,
    }
    this.callStates.set(entry.id, state)
    if (entry.roomId) this.roomCurrent.set(entry.roomId, entry.id)
    await this.persistEntry(entry, state)
    if (entry.roomId) await this.persistRoomCounter(entry.roomId, entry.queueNum)
    return { ...entry, ...this.statusOf(entry.id, 'called') }
  }

  async complete(id: string): Promise<QueueCallItem> {
    await this.hydrateFromDb()
    const entry = await this.resolveEntry(id)
    if (!entry) throw new NotFoundException(`Queue entry ${id} not found`)
    const prev = this.callStates.get(entry.id)
    const state: CallState = {
      status: 'completed',
      calledCount: prev?.calledCount ?? 0,
      lastCalledTime: prev?.lastCalledTime,
      completedAt: new Date().toISOString(),
    }
    this.callStates.set(entry.id, state)
    if (entry.roomId && this.roomCurrent.get(entry.roomId) === entry.id) {
      this.roomCurrent.delete(entry.roomId)
    }
    await this.persistEntry(entry, state)
    return { ...entry, ...this.statusOf(entry.id, 'completed') }
  }

  async recall(id: string): Promise<QueueCallItem> {
    await this.hydrateFromDb()
    const entry = await this.resolveEntry(id)
    if (!entry) throw new NotFoundException(`Queue entry ${id} not found`)
    const prev = this.callStates.get(entry.id)
    const state: CallState = {
      status: 'called',
      calledCount: (prev?.calledCount ?? 0) + 1,
      lastCalledTime: new Date().toLocaleString('zh-CN'),
    }
    this.callStates.set(entry.id, state)
    if (entry.roomId) this.roomCurrent.set(entry.roomId, entry.id)
    await this.persistEntry(entry, state)
    if (entry.roomId) await this.persistRoomCounter(entry.roomId, entry.queueNum)
    return { ...entry, ...this.statusOf(entry.id, 'called') }
  }
}

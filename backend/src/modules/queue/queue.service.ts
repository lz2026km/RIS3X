/**
 * G005 放射RIS系统 v3.0.6.11-80 - 叫号队列服务 (W1-A, P0)
 * - GET /queue        : 候诊队列 (从 Exam/Appointment 派生 + 内存叫号状态)
 * - GET /queue/rooms  : 叫号房间列表 (从 Device 聚合)
 * - GET /queue/:roomId: 房间队列
 * - GET /queue/:roomId/status: 房间状态
 * - POST /queue/:id/call|complete|recall: 叫号操作 (内存状态)
 * DB 不可用时回退内置种子数据, 保证前端叫号流程可用。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ===== [W10E-3] 扩展端点 DTO (叫号总览/房间状态/趋势/候诊统计) =====

export interface QueueOverviewDto {
  date: string
  todayCalled: number
  todayCompleted: number
  waitingCount: number
  calledCount: number
  inServiceCount: number
  completedCount: number
  avgWaitMinutes: number
  maxWaitMinutes: number
  timeoutCount: number
  busyRooms: number
  idleRooms: number
  totalRooms: number
  avgQueueLength: number
  seeded: boolean
}

export interface RoomStatusSummaryDto {
  totalRooms: number
  byStatus: Record<string, number>
  waitingTotal: number
  inServiceTotal: number
  busyRate: number
  byModality: Array<{ modality: string; total: number; busy: number; waiting: number; completed: number }>
  seeded: boolean
}

export interface QueueDailyTrendPoint {
  date: string
  label: string
  called: number
  completed: number
  timeout: number
  seeded: boolean
}

export interface QueueWaitingStatsDto {
  total: number
  waitingCount: number
  calledCount: number
  avgWaitMinutes: number
  maxWaitMinutes: number
  timeoutCount: number
  distribution: Array<{ range: string; count: number; percent: number }>
  byModality: Array<{ modality: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
  byPatientType: Array<{ patientType: string; count: number }>
  seeded: boolean
}

const TIMEOUT_MINUTES = 30

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性伪随机: 同一 seedInput 永远得到同一结果 (趋势/统计回退数据可复现) */
function seededRand(min: number, max: number, seedInput: string): number {
  let a = hashString(seedInput) >>> 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return Math.round((r * (max - min) + min) * 10) / 10
}

function localDateStr(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
  // [W10E-3] 优先级调整 (内存覆盖; 无独立 DB 字段, DB 不可用时确定性回退)
  private readonly priorityOverrides = new Map<string, QueueCallItem['priority']>()
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
      priority: this.priorityOverrides.get(id) ?? PRIORITY_TO_ZH[exam.priority ?? ''] ?? '普通',
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
    const priority = this.priorityOverrides.get(item.id)
    if (!s && !priority) return item
    return {
      ...item,
      status: s ? STATUS_TO_ZH[s.status] : item.status,
      calledCount: s?.calledCount ?? item.calledCount,
      lastCalledTime: s?.lastCalledTime ?? item.lastCalledTime,
      priority: priority ?? item.priority,
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

  // ================= [W10E-3] 扩展: 叫号总览 / 房间状态 / 趋势 / 候诊统计 =================

  async getOverview(): Promise<QueueOverviewDto> {
    const [all, rooms] = await Promise.all([this.list(), this.rooms()])
    const seeded = all.length > 0 && all[0].id.startsWith('q-SEED-')
    const waiting = all.filter((i) => i.status === '等待中')
    const called = all.filter((i) => i.status === '已呼叫')
    const inService = all.filter((i) => i.status === '检查中')
    const completed = all.filter((i) => i.status === '已完成')
    const todayCalled = all.filter((i) => i.calledCount > 0).length
    const waitMins = all.map((i) => i.waitMinutes)
    const avgWaitMinutes = waitMins.length > 0 ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0
    const maxWaitMinutes = waitMins.length > 0 ? Math.max(...waitMins) : 0
    const timeoutCount = waitMins.filter((m) => m > TIMEOUT_MINUTES).length
    const busyRooms = rooms.filter((r) => r.status === '使用中').length
    const idleRooms = rooms.filter((r) => r.status === '空闲').length
    const totalWaiting = rooms.reduce((a, r) => a + r.waitCount, 0)
    const avgQueueLength = rooms.length > 0 ? Math.round((totalWaiting / rooms.length) * 10) / 10 : 0
    return {
      date: localDateStr(new Date()),
      todayCalled,
      todayCompleted: completed.length,
      waitingCount: waiting.length,
      calledCount: called.length,
      inServiceCount: inService.length,
      completedCount: completed.length,
      avgWaitMinutes,
      maxWaitMinutes,
      timeoutCount,
      busyRooms,
      idleRooms,
      totalRooms: rooms.length,
      avgQueueLength,
      seeded,
    }
  }

  async getRoomStatusSummary(): Promise<RoomStatusSummaryDto> {
    const rooms = await this.rooms()
    const seeded = rooms.length > 0 && rooms[0].id.startsWith('ROOM-')
    const byStatus: Record<string, number> = { 空闲: 0, 使用中: 0, 暂停: 0, 维护中: 0 }
    const byModality = new Map<string, { modality: string; total: number; busy: number; waiting: number; completed: number }>()
    for (const r of rooms) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      const m = byModality.get(r.modality) ?? { modality: r.modality || '未知', total: 0, busy: 0, waiting: 0, completed: 0 }
      m.total += 1
      if (r.status === '使用中') m.busy += 1
      m.waiting += r.waitCount
      m.completed += r.completedToday
      byModality.set(r.modality || '未知', m)
    }
    const waitingTotal = rooms.reduce((a, r) => a + r.waitCount, 0)
    const inServiceTotal = rooms.filter((r) => r.currentPatient).length
    return {
      totalRooms: rooms.length,
      byStatus,
      waitingTotal,
      inServiceTotal,
      busyRate: rooms.length > 0 ? Math.round(((byStatus['使用中'] ?? 0) / rooms.length) * 100) : 0,
      byModality: Array.from(byModality.values()),
      seeded,
    }
  }

  async getDailyTrend(days = 7): Promise<QueueDailyTrendPoint[]> {
    const count = Math.max(1, Math.min(Math.round(days) || 7, 30))
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1))
    try {
      const rows = await (this.prisma as any).queueState?.findMany({
        where: {
          tenantId: currentTenantId(),
          OR: [{ completedAt: { gte: start } }, { lastCallAt: { gte: start } }],
        },
      })
      if (Array.isArray(rows) && rows.length > 0) {
        const startKey = localDateStr(start)
        const byDate = new Map<string, { called: number; completed: number }>()
        for (const row of rows) {
          const calledKey = row.lastCallAt ? localDateStr(row.lastCallAt) : null
          if (calledKey && calledKey >= startKey) {
            const e = byDate.get(calledKey) ?? { called: 0, completed: 0 }
            e.called += 1
            byDate.set(calledKey, e)
          }
          const doneKey = row.completedAt ? localDateStr(row.completedAt) : null
          if (doneKey && doneKey >= startKey) {
            const e = byDate.get(doneKey) ?? { called: 0, completed: 0 }
            e.completed += 1
            byDate.set(doneKey, e)
          }
        }
        return Array.from({ length: count }, (_, i) => {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
          const key = localDateStr(d)
          const e = byDate.get(key) ?? { called: 0, completed: 0 }
          return {
            date: key,
            label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            called: e.called,
            completed: e.completed,
            timeout: 0,
            seeded: false,
          }
        })
      }
    } catch {
      // DB 不可用 → 确定性种子趋势 (可复现, 不写库)
    }
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const key = localDateStr(d)
      const called = Math.round(seededRand(40, 90, `queue-trend:${key}:called`))
      const completed = Math.round(called * seededRand(0.85, 0.98, `queue-trend:${key}:completed`))
      const timeout = Math.round(called * seededRand(0.03, 0.12, `queue-trend:${key}:timeout`))
      return {
        date: key,
        label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        called,
        completed,
        timeout,
        seeded: true,
      }
    })
  }

  async setPriority(id: string, priority: string): Promise<QueueCallItem> {
    await this.hydrateFromDb()
    if (!['普通', '紧急', '危重'].includes(priority)) {
      throw new BadRequestException('优先级必须是 普通/紧急/危重 之一')
    }
    const entry = await this.resolveEntry(id)
    if (!entry) throw new NotFoundException(`Queue entry ${id} not found`)
    this.priorityOverrides.set(entry.id, priority as QueueCallItem['priority'])
    const seed = this.findSeedEntry(entry.id)
    return { ...entry, priority: priority as QueueCallItem['priority'], status: seed?.status ?? entry.status }
  }

  async getWaitingStats(): Promise<QueueWaitingStatsDto> {
    const all = await this.list()
    const seeded = all.length > 0 && all[0].id.startsWith('q-SEED-')
    const active = all.filter((i) => i.status === '等待中' || i.status === '已呼叫')
    const waiting = all.filter((i) => i.status === '等待中')
    const called = all.filter((i) => i.status === '已呼叫')
    const waitMins = active.map((i) => i.waitMinutes)
    const avgWaitMinutes = waitMins.length > 0 ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0
    const maxWaitMinutes = waitMins.length > 0 ? Math.max(...waitMins) : 0
    const timeoutCount = waitMins.filter((m) => m > TIMEOUT_MINUTES).length
    const buckets = [
      { range: '<10分钟', test: (m: number) => m < 10 },
      { range: '10-30分钟', test: (m: number) => m >= 10 && m <= 30 },
      { range: '30-60分钟', test: (m: number) => m > 30 && m <= 60 },
      { range: '>60分钟', test: (m: number) => m > 60 },
    ]
    const distribution = buckets.map((b) => {
      const count = active.filter((i) => b.test(i.waitMinutes)).length
      return { range: b.range, count, percent: active.length > 0 ? Math.round((count / active.length) * 100) : 0 }
    })
    const group = <T extends string>(key: T, items: QueueCallItem[]) => {
      const map = new Map<string, number>()
      for (const i of items) {
        const v = String(i[key as keyof QueueCallItem] ?? '未知')
        map.set(v, (map.get(v) ?? 0) + 1)
      }
      return Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    }
    const byModality = group('modality', active).map(({ name, count }) => ({ modality: name, count }))
    const byPriority = group('priority', active).map(({ name, count }) => ({ priority: name, count }))
    const byPatientType = group('patientType', active).map(({ name, count }) => ({ patientType: name, count }))
    return {
      total: all.length,
      waitingCount: waiting.length,
      calledCount: called.length,
      avgWaitMinutes,
      maxWaitMinutes,
      timeoutCount,
      distribution,
      byModality,
      byPriority,
      byPatientType,
      seeded,
    }
  }
}

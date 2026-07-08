/**
 * G005 放射RIS系统 v3.0.6.11 - 设备状态机适配器 (English-only)
 * 把旧的中文/英文混用 status 字符串映射为 deviceMachine 状态,
 * 并用状态机做状态合法性校验。任何"裸赋值 status = ..." 都应通过此适配器。
 *
 * v3.0.6.11: 标准化为英文主键 (English-only convention),
 *            中文键通过 normalizeStatus() 兜底映射,未识别状态原样返回。
 */
import { createActor, type Actor } from 'xstate'
import { deviceMachine, type DeviceStateName } from '../machines/deviceMachine'

/** 设备页面使用的英文状态(展示层主键) */
export type DeviceDisplayStatus = 'online' | 'offline' | 'maintenance' | 'fault' | 'inUse'

/** 中文 / 旧版状态 → DeviceDisplayStatus(英文展示键) */
const LEGACY_CN_TO_DISPLAY: Record<string, DeviceDisplayStatus> = {
  '空闲': 'online',
  '在线': 'online',
  '使用中': 'inUse',
  '维护中': 'maintenance',
  '故障': 'fault',
  '停用': 'offline',
  '离线': 'offline',
}

/** 英文展示状态 → deviceMachine 起始状态 */
export const DISPLAY_TO_MACHINE: Record<DeviceDisplayStatus, DeviceStateName> = {
  online: 'idle',
  inUse: 'inUse',
  maintenance: 'maintenance',
  fault: 'broken',
  offline: 'offline',
}

/**
 * 标准化任意 status 字符串 → 英文 DeviceDisplayStatus。
 * 任何未识别的状态原样返回,作为兜底。
 */
export function normalizeStatus(raw: string): string {
  if (!raw) return raw
  // 已是英文展示键
  if (raw in DISPLAY_TO_MACHINE) return raw
  // 中文兼容
  if (raw in LEGACY_CN_TO_DISPLAY) {
    const v = LEGACY_CN_TO_DISPLAY[raw]
    return v ?? raw
  }
  // 大小写不敏感匹配
  const lower = raw.toLowerCase()
  if (lower in DISPLAY_TO_MACHINE) return lower
  if (lower in LEGACY_CN_TO_DISPLAY) {
    const v = LEGACY_CN_TO_DISPLAY[lower]
    return v ?? raw
  }
  // 兜底:原样返回
  return raw
}

/** 字符串 → deviceMachine 起始状态(英文主键 + 中文兜底) */
export const STATUS_TO_MACHINE: Record<string, DeviceStateName> = {
  online: 'idle',
  offline: 'offline',
  maintenance: 'maintenance',
  fault: 'broken',
  inUse: 'inUse',
  // 中文兼容(legacy)
  '空闲': 'idle',
  '使用中': 'inUse',
  '维护中': 'maintenance',
  '故障': 'broken',
  '停用': 'offline',
  '离线': 'offline',
  '在线': 'idle',
}

/**
 * 将任意 status 字符串(含中文)解析为 machine 状态。
 * 未识别的字符串返回 'idle' 作为兜底。
 */
export function resolveStatusToMachine(raw: string): DeviceStateName {
  const normalized = normalizeStatus(raw)
  return STATUS_TO_MACHINE[normalized] ?? 'idle'
}

/** 启动一个临时 actor,只用于校验 status 字符串是否可由 idle 出发到达。 */
export function validateDeviceStatus(status: string): boolean {
  const target = resolveStatusToMachine(status)
  const actor = createActor(deviceMachine, {
    input: { deviceId: 'validate', deviceCode: 'validate', modality: 'CT' },
  })
  actor.start()
  if (target === 'idle') { actor.stop(); return true }
  if (target === 'inUse') {
    actor.send({ type: 'START_USE', patientId: '', examId: '', by: 'system' })
  } else if (target === 'maintenance') {
    actor.send({ type: 'START_MAINTENANCE', notes: 'init', by: 'system' })
  } else if (target === 'broken') {
    actor.send({ type: 'REPORT_FAULT', reason: 'init', by: 'system' })
  } else if (target === 'offline') {
    actor.send({ type: 'GO_OFFLINE', reason: 'init', by: 'system' })
  }
  const ok = actor.getSnapshot().value === target
  actor.stop()
  return ok
}

/** 创建设备 actor 池 - 供页面级 useDeviceActors hook 使用 */
export function spawnDeviceActor(input: { deviceId: string; deviceCode: string; modality: 'CT' | 'MR' | 'DR' | 'DSA' | 'US' | 'MG' | 'PET' | 'SPECT' }): Actor<typeof deviceMachine> {
  const actor = createActor(deviceMachine, { input })
  actor.start()
  return actor
}

/** 通过临时 actor 执行一次状态转换(只用于运行时 status 字符串切换,
 *  副作用由调用方负责持久化) */
export function replayDeviceEvent(
  fromStatus: string,
  event:
    | { type: 'REPORT_FAULT'; reason: string; by: string }
    | { type: 'GO_OFFLINE'; reason: string; by: string }
    | { type: 'START_MAINTENANCE'; notes: string; by: string }
    | { type: 'COMPLETE_MAINTENANCE'; by: string }
    | { type: 'GO_ONLINE'; by: string }
    | { type: 'REPAIR_COMPLETE'; by: string }
    | { type: 'START_USE'; patientId: string; examId: string; by: string }
    | { type: 'COMPLETE_USE'; by: string }
): DeviceStateName {
  const from = resolveStatusToMachine(fromStatus)
  const actor = createActor(deviceMachine, {
    input: { deviceId: 'replay', deviceCode: 'replay', modality: 'CT' },
  })
  actor.start()
  if (from === 'inUse') {
    actor.send({ type: 'START_USE', patientId: '', examId: '', by: 'system' })
  } else if (from === 'maintenance') {
    actor.send({ type: 'START_MAINTENANCE', notes: 'init', by: 'system' })
  } else if (from === 'broken') {
    actor.send({ type: 'REPORT_FAULT', reason: 'init', by: 'system' })
  } else if (from === 'offline') {
    actor.send({ type: 'GO_OFFLINE', reason: 'init', by: 'system' })
  }
  actor.send(event as never)
  const value = actor.getSnapshot().value as DeviceStateName
  actor.stop()
  return value
}

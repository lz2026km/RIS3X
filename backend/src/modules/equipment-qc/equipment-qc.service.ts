/**
 * [G005 W9-QC] 设备质控服务 (equipment-qc): 模体检测项 / 排程 / 记录 / 统计 / 失败清单
 * 孤儿模块: 无 DB, 内存 + 确定性 seed。
 */
import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { hashString } from '../../common/utils/deterministic-hash'
import { EQUIPMENT_DEVICES, PHANTOM_TEST_ITEMS } from './equipment-qc.data'
import {
  evaluateThreshold,
  thresholdText,
  type CreateEquipmentQcRecordInput,
  type EquipmentModality,
  type EquipmentQcRecord,
  type EquipmentQcScheduleEntry,
  type EquipmentQcStats,
  type PhantomTestItem,
  type QcFrequency,
  type ThresholdRule,
} from './equipment-qc.types'

const FREQUENCIES: QcFrequency[] = ['daily', 'weekly', 'monthly']

function round(n: number, d = 2): number {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

function deviationOf(t: ThresholdRule, value: number): number {
  if (t.op === 'lte') return round(value - t.limit)
  if (t.op === 'gte') return round(t.limit - value)
  const lo = Math.min(t.limit, t.limit2 ?? t.limit)
  const hi = Math.max(t.limit, t.limit2 ?? t.limit)
  if (value < lo) return round(lo - value)
  if (value > hi) return round(value - hi)
  return 0
}

@Injectable()
export class EquipmentQcService {
  private records: EquipmentQcRecord[] = []
  private seq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.seed()
    void this.prisma
  }

  private nextId(): string {
    this.seq += 1
    return `EQC-${this.seq}`
  }

  /** 确定性生成 seed 记录: 大部分通过, 少量失败 */
  private seed(): void {
    const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
    for (const device of EQUIPMENT_DEVICES) {
      const items = PHANTOM_TEST_ITEMS.filter((i) => i.modality === device.modality)
      items.forEach((item, idx) => {
        for (const day of days) {
          const key = `${device.id}:${item.id}:${day}`
          const h = hashString(key)
          const failRoll = h % 17
          const center = item.threshold.op === 'gte' ? item.threshold.limit * 1.05 : item.threshold.limit * 0.85
          const jitter = ((h % 100) / 100 - 0.5) * Math.abs(item.threshold.limit || 1) * 0.4
          let value = round(Math.max(0, center + jitter))
          const passed = evaluateThreshold(item.threshold, value)
          // 约 1/17 失败: 强制越界
          if (failRoll === 0) {
            value = round(item.threshold.op === 'gte' ? item.threshold.limit * 0.6 : item.threshold.limit * 1.8)
          }
          const finalPassed = evaluateThreshold(item.threshold, value)
          this.records.push({
            id: this.nextId(),
            deviceId: device.id,
            deviceName: device.name,
            modality: device.modality,
            frequency: item.frequency,
            testItemId: item.id,
            testItemName: item.name,
            value,
            unit: item.threshold.unit,
            passed: finalPassed,
            deviation: deviationOf(item.threshold, value),
            testedAt: `${day}T08:${String(10 + (idx % 40)).padStart(2, '0')}:00.000Z`,
            testerId: 'u-tech-01',
            testerName: '王技师',
            note: finalPassed ? undefined : '超出阈值, 已通知医学物理师复核',
          })
          void passed
        }
      })
    }
    this.records.sort((a, b) => b.testedAt.localeCompare(a.testedAt))
  }

  listItems(modality?: EquipmentModality, frequency?: QcFrequency): PhantomTestItem[] {
    let items = PHANTOM_TEST_ITEMS
    if (modality) items = items.filter((i) => i.modality === modality)
    if (frequency) items = items.filter((i) => i.frequency === frequency)
    return items.map((i) => ({ ...i, threshold: { ...i.threshold } }))
  }

  getItem(id: string): PhantomTestItem {
    const item = PHANTOM_TEST_ITEMS.find((i) => i.id === id)
    if (!item) throw new NotFoundException(`设备质控项 ${id} 不存在`)
    return { ...item, threshold: { ...item.threshold } }
  }

  listSchedule(): EquipmentQcScheduleEntry[] {
    const entries: EquipmentQcScheduleEntry[] = []
    for (const modality of ['CT', 'DR', 'MRI', 'MG'] as EquipmentModality[]) {
      for (const frequency of FREQUENCIES) {
        const items = PHANTOM_TEST_ITEMS.filter((i) => i.modality === modality && i.frequency === frequency)
        if (items.length === 0) continue
        entries.push({
          modality,
          frequency,
          itemCount: items.length,
          deviceCount: EQUIPMENT_DEVICES.filter((d) => d.modality === modality).length,
          items: items.map((i) => ({ id: i.id, name: i.name, standard: i.standard, threshold: thresholdText(i.threshold) })),
        })
      }
    }
    return entries
  }

  listRecords(filter: { deviceId?: string; modality?: EquipmentModality; frequency?: QcFrequency; onlyFailed?: boolean } = {}): EquipmentQcRecord[] {
    let rows = this.records
    if (filter.deviceId) rows = rows.filter((r) => r.deviceId === filter.deviceId)
    if (filter.modality) rows = rows.filter((r) => r.modality === filter.modality)
    if (filter.frequency) rows = rows.filter((r) => r.frequency === filter.frequency)
    if (filter.onlyFailed) rows = rows.filter((r) => !r.passed)
    return rows.map((r) => ({ ...r }))
  }

  createRecord(input: CreateEquipmentQcRecordInput): EquipmentQcRecord {
    if (!input.deviceId?.trim()) throw new BadRequestException('deviceId 不能为空')
    if (!input.testItemId?.trim()) throw new BadRequestException('testItemId 不能为空')
    if (!Number.isFinite(input.value)) throw new BadRequestException('value 必须为有效数值')
    const item = PHANTOM_TEST_ITEMS.find((i) => i.id === input.testItemId)
    if (!item) throw new NotFoundException(`设备质控项 ${input.testItemId} 不存在`)
    if (input.modality && input.modality !== item.modality) {
      throw new BadRequestException(`检测项 ${item.id} 属于 ${item.modality}, 与提交 modality 不符`)
    }
    const passed = evaluateThreshold(item.threshold, input.value)
    const record: EquipmentQcRecord = {
      id: this.nextId(),
      deviceId: input.deviceId.trim(),
      deviceName: input.deviceName?.trim() || EQUIPMENT_DEVICES.find((d) => d.id === input.deviceId)?.name || input.deviceId,
      modality: item.modality,
      frequency: item.frequency,
      testItemId: item.id,
      testItemName: item.name,
      value: input.value,
      unit: item.threshold.unit,
      passed,
      deviation: deviationOf(item.threshold, input.value),
      testedAt: input.testedAt ?? new Date().toISOString(),
      testerId: input.testerId?.trim() || 'u-tech-01',
      testerName: input.testerName?.trim() || '王技师',
      note: input.note?.trim() || (passed ? undefined : '超出阈值, 需复核'),
    }
    this.records.unshift(record)
    return { ...record }
  }

  getStats(): EquipmentQcStats {
    const total = this.records.length
    const passed = this.records.filter((r) => r.passed).length
    const failed = total - passed
    const modalities: EquipmentModality[] = ['CT', 'DR', 'MRI', 'MG']
    const byModality = modalities.map((modality) => {
      const sub = this.records.filter((r) => r.modality === modality)
      const p = sub.filter((r) => r.passed).length
      return { modality, total: sub.length, passed: p, failed: sub.length - p, passRate: sub.length ? round((p / sub.length) * 100, 1) : 0 }
    })
    const byFrequency = FREQUENCIES.map((frequency) => {
      const sub = this.records.filter((r) => r.frequency === frequency)
      const p = sub.filter((r) => r.passed).length
      return { frequency, total: sub.length, passed: p, failed: sub.length - p, passRate: sub.length ? round((p / sub.length) * 100, 1) : 0 }
    })
    const recentFailureCount = this.records.filter((r) => !r.passed).slice(0, 20).length
    return {
      total,
      passed,
      failed,
      passRate: total ? round((passed / total) * 100, 1) : 0,
      byModality,
      byFrequency,
      recentFailureCount,
    }
  }

  listFailures(): EquipmentQcRecord[] {
    return this.records.filter((r) => !r.passed).map((r) => ({ ...r }))
  }
}

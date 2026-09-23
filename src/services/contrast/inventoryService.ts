import type { ContrastInventoryItem, StockAdjustment, LowStockThreshold, ContrastAgentType } from './types'

export interface IContrastInventoryService {
  getInventory(): Promise<ContrastInventoryItem[]>
  getItem(batchId: string): Promise<ContrastInventoryItem | null>
  receiveStock(item: Omit<ContrastInventoryItem, 'batchId' | 'remainingMl' | 'status'> & { batchId?: string }): Promise<ContrastInventoryItem>
  dispense(batchId: string, volumeMl: number, reference?: { type: 'exam' | 'order'; id: string }): Promise<ContrastInventoryItem>
  adjustStock(batchId: string, deltaMl: number, reason: string): Promise<ContrastInventoryItem>
  getLowStockAlerts(): Promise<ContrastInventoryItem[]>
  getExpiringItems(days: number): Promise<ContrastInventoryItem[]>
  getInventoryLog(batchId?: string): Promise<StockAdjustment[]>
  getLowStockThresholds(): Promise<LowStockThreshold[]>
  setLowStockThreshold(threshold: LowStockThreshold): Promise<void>
}

const MOCK_INVENTORY: ContrastInventoryItem[] = [
  { batchId: 'CT-2025001', contrastName: '碘海醇', genericName: 'Iohexol', agentType: 'iodinated', concentration: '350 mgI/mL', volumeMl: 500, remainingMl: 380, expiryDate: '2026-06-01', supplier: 'GE Healthcare', lotNumber: 'LOT-IOH-001', receivedDate: '2025-01-15', status: 'available', lowStockThresholdMl: 100, unitPrice: 45.00 },
  { batchId: 'CT-2025002', contrastName: '碘海醇', genericName: 'Iohexol', agentType: 'iodinated', concentration: '350 mgI/mL', volumeMl: 500, remainingMl: 90, expiryDate: '2026-03-01', supplier: 'GE Healthcare', lotNumber: 'LOT-IOH-002', receivedDate: '2025-03-01', status: 'low', lowStockThresholdMl: 100, unitPrice: 45.00 },
  { batchId: 'CT-2025003', contrastName: '碘克沙醇', genericName: 'Iodixanol', agentType: 'iodinated', concentration: '320 mgI/mL', volumeMl: 500, remainingMl: 450, expiryDate: '2026-08-15', supplier: 'Bracco', lotNumber: 'LOT-IDX-001', receivedDate: '2025-04-10', status: 'available', lowStockThresholdMl: 100, unitPrice: 58.00 },
  { batchId: 'MR-2025001', contrastName: '钆布醇', genericName: 'Gadobutrol', agentType: 'gadolinium', concentration: '1.0 mmol/mL', volumeMl: 100, remainingMl: 65, expiryDate: '2025-12-01', supplier: 'Bayer', lotNumber: 'LOT-GAD-001', receivedDate: '2025-02-20', status: 'available', lowStockThresholdMl: 30, unitPrice: 120.00 },
  { batchId: 'CT-2024009', contrastName: '碘海醇', genericName: 'Iohexol', agentType: 'iodinated', concentration: '350 mgI/mL', volumeMl: 500, remainingMl: 0, expiryDate: '2025-09-01', supplier: 'GE Healthcare', lotNumber: 'LOT-IOH-OLD', receivedDate: '2024-06-01', status: 'depleted', lowStockThresholdMl: 100, unitPrice: 42.00 },
]

const MOCK_LOG: StockAdjustment[] = [
  { id: 'adj-001', batchId: 'CT-2025001', type: 'receive', volumeMl: 500, balanceAfterMl: 500, operator: 'admin-wang', timestamp: '2025-01-15T08:00:00Z', reason: '新批次入库' },
  { id: 'adj-002', batchId: 'CT-2025001', type: 'dispense', volumeMl: 120, balanceAfterMl: 380, operator: 'tech-li', timestamp: '2025-06-10T10:30:00Z', reason: '检查使用', referenceType: 'exam', referenceId: 'E-20250610-001' },
  { id: 'adj-003', batchId: 'CT-2025002', type: 'receive', volumeMl: 500, balanceAfterMl: 500, operator: 'admin-wang', timestamp: '2025-03-01T08:00:00Z', reason: '新批次入库' },
]

const MOCK_THRESHOLDS: LowStockThreshold[] = [
  { contrastName: '碘海醇', agentType: 'iodinated', thresholdMl: 200 },
  { contrastName: '碘克沙醇', agentType: 'iodinated', thresholdMl: 200 },
  { contrastName: '钆布醇', agentType: 'gadolinium', thresholdMl: 50 },
]

function generateBatchId(agentType: ContrastAgentType): string {
  const prefix = agentType === 'iodinated' ? 'CT' : agentType === 'gadolinium' ? 'MR' : 'US'
  return `${prefix}-${Date.now()}`
}

function computeStatus(item: ContrastInventoryItem): ContrastInventoryItem['status'] {
  if (item.remainingMl <= 0) return 'depleted'
  if (new Date(item.expiryDate) < new Date()) return 'expired'
  if (item.remainingMl < item.lowStockThresholdMl) return 'low'
  return 'available'
}

class MockContrastInventoryService implements IContrastInventoryService {
  async getInventory(): Promise<ContrastInventoryItem[]> {
    return MOCK_INVENTORY.map(i => ({ ...i, status: computeStatus(i) }))
  }

  async getItem(batchId: string): Promise<ContrastInventoryItem | null> {
    const item = MOCK_INVENTORY.find(i => i.batchId === batchId)
    return item ? { ...item, status: computeStatus(item) } : null
  }

  async receiveStock(item: Omit<ContrastInventoryItem, 'batchId' | 'remainingMl' | 'status'> & { batchId?: string }): Promise<ContrastInventoryItem> {
    const newItem: ContrastInventoryItem = {
      ...item as any,
      batchId: item.batchId ?? generateBatchId(item.agentType),
      remainingMl: item.volumeMl,
      status: 'available',
    }
    MOCK_INVENTORY.push(newItem)
    MOCK_LOG.push({ id: `adj-${Date.now()}`, batchId: newItem.batchId, type: 'receive', volumeMl: newItem.volumeMl, balanceAfterMl: newItem.volumeMl, operator: 'admin', timestamp: new Date().toISOString(), reason: '新批次入库' })
    return { ...newItem, status: computeStatus(newItem) }
  }

  async dispense(batchId: string, volumeMl: number, reference?: { type: 'exam' | 'order'; id: string }): Promise<ContrastInventoryItem> {
    const idx = MOCK_INVENTORY.findIndex(i => i.batchId === batchId)
    if (idx === -1) throw new Error(`批次 ${batchId} 不存在`)
    const item = MOCK_INVENTORY[idx]!
    if (item.remainingMl < volumeMl) throw new Error(`库存不足 (剩余 ${item.remainingMl}mL，需要 ${volumeMl}mL)`)
    item.remainingMl -= volumeMl
    MOCK_LOG.push({ id: `adj-${Date.now()}`, batchId, type: 'dispense', volumeMl, balanceAfterMl: item.remainingMl, operator: 'system', timestamp: new Date().toISOString(), reason: '检查使用', referenceType: reference?.type, referenceId: reference?.id })
    return { ...item, status: computeStatus(item) }
  }

  async adjustStock(batchId: string, deltaMl: number, reason: string): Promise<ContrastInventoryItem> {
    const idx = MOCK_INVENTORY.findIndex(i => i.batchId === batchId)
    if (idx === -1) throw new Error(`批次 ${batchId} 不存在`)
    MOCK_INVENTORY[idx]!.remainingMl += deltaMl
    MOCK_LOG.push({ id: `adj-${Date.now()}`, batchId, type: 'adjust', volumeMl: deltaMl, balanceAfterMl: MOCK_INVENTORY[idx]!.remainingMl, operator: 'admin', timestamp: new Date().toISOString(), reason })
    return { ...MOCK_INVENTORY[idx]!, status: computeStatus(MOCK_INVENTORY[idx]!) }
  }

  async getLowStockAlerts(): Promise<ContrastInventoryItem[]> {
    return MOCK_INVENTORY.filter(i => computeStatus(i) === 'low')
  }

  async getExpiringItems(days: number): Promise<ContrastInventoryItem[]> {
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + days)
    return MOCK_INVENTORY.filter(i => {
      const st = computeStatus(i)
      return st !== 'depleted' && new Date(i.expiryDate) <= deadline
    })
  }

  async getInventoryLog(batchId?: string): Promise<StockAdjustment[]> {
    return batchId ? MOCK_LOG.filter(l => l.batchId === batchId) : MOCK_LOG
  }

  async getLowStockThresholds(): Promise<LowStockThreshold[]> { return MOCK_THRESHOLDS }

  async setLowStockThreshold(threshold: LowStockThreshold): Promise<void> {
    const idx = MOCK_THRESHOLDS.findIndex(t => t.contrastName === threshold.contrastName)
    if (idx >= 0) MOCK_THRESHOLDS[idx] = threshold
    else MOCK_THRESHOLDS.push(threshold)
  }
}

let _instance: IContrastInventoryService | null = null

export function getContrastInventoryService(): IContrastInventoryService {
  if (!_instance) _instance = new MockContrastInventoryService()
  return _instance
}

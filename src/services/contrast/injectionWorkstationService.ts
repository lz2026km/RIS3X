import type { InjectionProtocol, InjectionRecord, InjectorDeviceStatus } from './types'

export interface IInjectionWorkstationService {
  getProtocols(modality?: string): Promise<InjectionProtocol[]>
  getProtocol(id: string): Promise<InjectionProtocol | null>
  createProtocol(protocol: Omit<InjectionProtocol, 'id' | 'createdTime'>): Promise<InjectionProtocol>
  updateProtocol(id: string, updates: Partial<InjectionProtocol>): Promise<InjectionProtocol | null>
  calculateParameters(contrastName: string, weightKg: number, eGFR: number): Promise<{ volumeMl: number; flowRateMls: number; rationale: string }>
  startInjection(examId: string, protocolId: string, params: { weightKg: number; eGFR: number; adjustedVolumeMl: number }): Promise<InjectionRecord>
  completeInjection(recordId: string, actualVolumeMl: number): Promise<InjectionRecord>
  cancelInjection(recordId: string, reason: string): Promise<InjectionRecord>
  getInjectionHistory(examId?: string): Promise<InjectionRecord[]>
  getDeviceStatus(): Promise<InjectorDeviceStatus>
  getActiveInjections(): Promise<InjectionRecord[]>
}

const MOCK_PROTOCOLS: InjectionProtocol[] = [
  {
    id: 'ip-001', name: '胸部CT增强标准方案', contrastName: '碘海醇', agentType: 'iodinated',
    concentration: '350 mgI/mL', totalVolumeMl: 80, weightBased: false, egfrAdjusted: true,
    phases: [
      { phase: 'bolus', volumeMl: 70, flowRateMls: 3.5, durationSec: 20, delaySec: 0, description: '造影剂团注' },
      { phase: 'chaser', volumeMl: 20, flowRateMls: 3.5, durationSec: 6, delaySec: 5, description: '生理盐水冲洗' },
    ],
    defaultForModality: ['CT'], notes: '标准胸部增强方案', isActive: true, createdTime: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ip-002', name: '腹部CT增强双期方案', contrastName: '碘海醇', agentType: 'iodinated',
    concentration: '350 mgI/mL', totalVolumeMl: 100, weightBased: false, egfrAdjusted: true,
    phases: [
      { phase: 'bolus', volumeMl: 90, flowRateMls: 3.0, durationSec: 30, delaySec: 0, description: '造影剂团注' },
      { phase: 'delay', volumeMl: 0, flowRateMls: 0, durationSec: 0, delaySec: 30, description: '动脉期延迟' },
      { phase: 'chaser', volumeMl: 20, flowRateMls: 3.0, durationSec: 7, delaySec: 0, description: '生理盐水冲洗' },
    ],
    defaultForModality: ['CT'], notes: '腹部双期增强', isActive: true, createdTime: '2025-01-15T00:00:00Z',
  },
  {
    id: 'ip-003', name: 'MRI钆增强标准方案', contrastName: '钆布醇', agentType: 'gadolinium',
    concentration: '1.0 mmol/mL', totalVolumeMl: 15, weightBased: true, egfrAdjusted: true,
    phases: [
      { phase: 'bolus', volumeMl: 15, flowRateMls: 2.0, durationSec: 8, delaySec: 0, description: '钆剂团注' },
      { phase: 'chaser', volumeMl: 20, flowRateMls: 2.0, durationSec: 10, delaySec: 0, description: '生理盐水冲洗' },
    ],
    defaultForModality: ['MR'], notes: '0.1 mmol/kg 标准剂量', isActive: true, createdTime: '2025-02-01T00:00:00Z',
  },
]

const MOCK_INJECTIONS: InjectionRecord[] = [
  { id: 'inj-001', examId: 'E-20250610-001', patientId: 'P001', patientName: '张三', protocolId: 'ip-001', protocolName: '胸部CT增强标准方案', contrastName: '碘海醇', batchId: 'CT-2025001', totalVolumeMl: 80, flowRateMls: 3.5, actualVolumeMl: 78, startTime: '2025-06-10T10:30:00Z', endTime: '2025-06-10T10:31:00Z', operator: 'tech-li', status: 'completed', parameters: { weightKg: 70, eGFR: 85, adjustedVolumeMl: 80, rationale: 'eGFR正常，使用标准剂量' }, notes: '顺利' },
]

const MOCK_DEVICE: InjectorDeviceStatus = {
  deviceId: 'inj-dev-001', deviceName: 'MEDRAD Stellant', model: 'Stellant D',
  status: 'online', syringeLoaded: true, lastCalibration: '2025-05-01T00:00:00Z',
}

class MockInjectionWorkstationService implements IInjectionWorkstationService {
  async getProtocols(modality?: string): Promise<InjectionProtocol[]> {
    return modality ? MOCK_PROTOCOLS.filter(p => (p.defaultForModality ?? []).includes(modality)) : MOCK_PROTOCOLS
  }

  async getProtocol(id: string): Promise<InjectionProtocol | null> {
    return MOCK_PROTOCOLS.find(p => p.id === id) ?? null
  }

  async createProtocol(protocol: Omit<InjectionProtocol, 'id' | 'createdTime'>): Promise<InjectionProtocol> {
    const newProtocol: InjectionProtocol = { ...protocol, id: `ip-${Date.now()}`, createdTime: new Date().toISOString() }
    MOCK_PROTOCOLS.push(newProtocol)
    return newProtocol
  }

  async updateProtocol(id: string, updates: Partial<InjectionProtocol>): Promise<InjectionProtocol | null> {
    const idx = MOCK_PROTOCOLS.findIndex(p => p.id === id)
    if (idx === -1) return null
    const current = MOCK_PROTOCOLS[idx]!
    const updated: InjectionProtocol = { ...current, ...updates }
    MOCK_PROTOCOLS[idx] = updated
    return updated
  }

  async calculateParameters(contrastName: string, weightKg: number, eGFR: number): Promise<{ volumeMl: number; flowRateMls: number; rationale: string }> {
    const baseVolume = contrastName.includes('钆') ? weightKg * 0.15 : weightKg * 1.2
    const adjustedVolume = eGFR < 30 ? baseVolume * 0.6 : baseVolume
    const flowRate = eGFR < 30 ? 2.0 : 3.5
    return { volumeMl: Math.round(adjustedVolume), flowRateMls: flowRate, rationale: `基于体重 ${weightKg}kg 和 eGFR ${eGFR} 计算` }
  }

  async startInjection(examId: string, protocolId: string, params: { weightKg: number; eGFR: number; adjustedVolumeMl: number }): Promise<InjectionRecord> {
    const protocol = MOCK_PROTOCOLS.find(p => p.id === protocolId)
    if (!protocol) throw new Error('协议不存在')
    const record: InjectionRecord = {
      id: `inj-${Date.now()}`, examId, patientId: '', patientName: '', protocolId,
      protocolName: protocol.name, contrastName: protocol.contrastName, batchId: '',
      totalVolumeMl: protocol.totalVolumeMl, flowRateMls: protocol.phases[0]?.flowRateMls ?? 3,
      startTime: new Date().toISOString(), operator: 'current-user', status: 'in_progress',
      parameters: { weightKg: params.weightKg, eGFR: params.eGFR, adjustedVolumeMl: params.adjustedVolumeMl, rationale: '参数由系统计算' },
      notes: '',
    }
    MOCK_INJECTIONS.push(record)
    return record
  }

  async completeInjection(recordId: string, actualVolumeMl: number): Promise<InjectionRecord> {
    const record = MOCK_INJECTIONS.find(r => r.id === recordId)
    if (!record) throw new Error('记录不存在')
    record.status = 'completed'
    record.actualVolumeMl = actualVolumeMl
    record.endTime = new Date().toISOString()
    return record
  }

  async cancelInjection(recordId: string, reason: string): Promise<InjectionRecord> {
    const record = MOCK_INJECTIONS.find(r => r.id === recordId)
    if (!record) throw new Error('记录不存在')
    record.status = 'cancelled'
    record.notes = reason
    record.endTime = new Date().toISOString()
    return record
  }

  async getInjectionHistory(examId?: string): Promise<InjectionRecord[]> {
    return examId ? MOCK_INJECTIONS.filter(r => r.examId === examId) : MOCK_INJECTIONS
  }

  async getDeviceStatus(): Promise<InjectorDeviceStatus> { return MOCK_DEVICE }

  async getActiveInjections(): Promise<InjectionRecord[]> {
    return MOCK_INJECTIONS.filter(r => r.status === 'in_progress')
  }
}

let _instance: IInjectionWorkstationService | null = null

export function getInjectionWorkstationService(): IInjectionWorkstationService {
  if (!_instance) _instance = new MockInjectionWorkstationService()
  return _instance
}

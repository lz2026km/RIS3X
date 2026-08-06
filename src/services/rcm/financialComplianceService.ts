export type ComplianceStatus = 'pass' | 'warning' | 'fail'
export type AuditEventType = 'price_change' | 'claim_submit' | 'settlement_reconcile' | 'charge_create' | 'charge_update' | 'bulk_price_update'

export interface ComplianceCheckDto {
  checkId: string
  checkName: string
  category: string
  status: ComplianceStatus
  details: string
  checkedAt: string
  affectedCount: number
}

export interface AuditRecordDto {
  id: string
  eventType: AuditEventType
  userId: string
  userName: string
  timestamp: string
  entityId?: string
  entityType?: string
  description: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export const financialComplianceService = {
  runComplianceCheck: async (): Promise<ComplianceCheckDto[]> => [
    {
      checkId: 'cc-001',
      checkName: '价格与医保目录匹配',
      category: '定价合规',
      status: 'pass',
      details: '所有12个活跃收费项目均已匹配医保目录编码',
      checkedAt: new Date().toISOString(),
      affectedCount: 12,
    },
    {
      checkId: 'cc-002',
      checkName: '结算金额一致性',
      category: '结算合规',
      status: 'warning',
      details: '2笔结算的医保承担比例低于标准值(70%)，需要人工复核',
      checkedAt: new Date().toISOString(),
      affectedCount: 2,
    },
    {
      checkId: 'cc-003',
      checkName: '理赔提交时效性',
      category: '流程合规',
      status: 'fail',
      details: '3笔已结算超过15个工作日尚未提交理赔申请',
      checkedAt: new Date().toISOString(),
      affectedCount: 3,
    },
    {
      checkId: 'cc-004',
      checkName: '收费项目有效期',
      category: '目录合规',
      status: 'pass',
      details: '所有收费项目均在有效期内，无过期项目',
      checkedAt: new Date().toISOString(),
      affectedCount: 0,
    },
    {
      checkId: 'cc-005',
      checkName: '财务操作审计追踪',
      category: '审计合规',
      status: 'pass',
      details: '近30天所有财务操作均有完整审计记录',
      checkedAt: new Date().toISOString(),
      affectedCount: 156,
    },
    {
      checkId: 'cc-006',
      checkName: '自费项目告知确认',
      category: '患者权益',
      status: 'warning',
      details: '1笔自费检查缺少患者知情同意书电子记录',
      checkedAt: new Date().toISOString(),
      affectedCount: 1,
    },
  ],

  getAuditLog: async (params?: { eventType?: AuditEventType; userId?: string; from?: string; to?: string }): Promise<AuditRecordDto[]> => {
    const logs: AuditRecordDto[] = [
      { id: 'aud-001', eventType: 'price_change', userId: 'U001', userName: '管理员', timestamp: '2026-04-28T10:30:00Z', entityId: 'ci-001', entityType: 'charge_item', description: 'CT平扫(头颅)价格从400调整为450', ipAddress: '192.168.1.100' },
      { id: 'aud-002', eventType: 'claim_submit', userId: 'U002', userName: '张会计', timestamp: '2026-04-28T14:20:00Z', entityId: 'batch-001', entityType: 'claim_batch', description: '提交理赔批次CL-202604-001，共12笔，金额25,830元', ipAddress: '192.168.1.101' },
      { id: 'aud-003', eventType: 'settlement_reconcile', userId: 'U002', userName: '张会计', timestamp: '2026-04-27T09:15:00Z', entityId: 'st-001', entityType: 'settlement', description: '核销结算st-001，到账金额595元', ipAddress: '192.168.1.101' },
      { id: 'aud-004', eventType: 'bulk_price_update', userId: 'U001', userName: '管理员', timestamp: '2026-04-25T16:00:00Z', entityType: 'charge_item', description: '批量更新5个CT项目的价格为统一标准价格', ipAddress: '192.168.1.100' },
      { id: 'aud-005', eventType: 'charge_create', userId: 'U003', userName: '李主任', timestamp: '2026-04-20T11:00:00Z', entityId: 'ci-012', entityType: 'charge_item', description: '新增收费项目MR功能成像(fMRI)，定价980元', ipAddress: '192.168.1.102' },
    ]

    let filtered = [...logs]
    if (params?.eventType) filtered = filtered.filter(l => l.eventType === params.eventType)
    if (params?.userId) filtered = filtered.filter(l => l.userId === params.userId)
    if (params?.from) filtered = filtered.filter(l => l.timestamp >= params.from!)
    if (params?.to) filtered = filtered.filter(l => l.timestamp <= params.to!)
    return filtered
  },

  exportAuditTrail: async (_from: string, _to: string): Promise<Blob> => {
    const csv = 'id,eventType,userId,userName,timestamp,description\n' +
      'aud-001,price_change,U001,管理员,2026-04-28T10:30:00Z,CT平扫(头颅)价格调整\n'
    return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  },
}

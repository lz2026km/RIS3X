import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ComplianceDocsService } from '../src/modules/compliance-docs/compliance-docs.service'

describe('ComplianceDocsService', () => {
  let svc: ComplianceDocsService
  let mockPrisma: any

  const mockDoc = {
    id: 'doc-1',
    tenantId: 'default',
    title: '隐私政策',
    category: '法规文档',
    type: 'SOP',
    version: '1.0',
    content: '',
    status: 'DRAFT',
    author: null,
    approvedBy: null,
    effectiveDate: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  }

  beforeEach(() => {
    mockPrisma = {
      auditLog: { count: jest.fn() },
      loginLog: { count: jest.fn() },
      user: { count: jest.fn() },
      backupRecord: { count: jest.fn(), findFirst: jest.fn() },
      exportApproval: { findMany: jest.fn() },
      complianceDocument: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    }
    svc = new ComplianceDocsService(mockPrisma)
  })

  // ───── generateReport (既有行为) ─────
  it('generates report with passing checklist when data exists', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(120)
    mockPrisma.loginLog.count.mockResolvedValue(500)
    mockPrisma.user.count.mockResolvedValue(30)
    mockPrisma.backupRecord.count.mockResolvedValue(4)
    mockPrisma.backupRecord.findFirst.mockResolvedValue({ createdAt: new Date('2026-07-01T00:00:00Z') })
    mockPrisma.exportApproval.findMany.mockResolvedValue([
      { status: 'PENDING' },
      { status: 'APPROVED' },
    ])
    const report = await svc.generateReport()
    expect(report.systemName).toBe('G005 放射RIS系统')
    expect(report.summary.totalUsers).toBe(30)
    expect(report.summary.pendingExportApprovals).toBe(1)
    expect(report.checklist.find((c) => c.item === '身份鉴别')?.status).toBe('通过')
    expect(report.checklist).toHaveLength(10)
  })

  it('marks failed checks when counts are zero', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(0)
    mockPrisma.loginLog.count.mockResolvedValue(0)
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.backupRecord.count.mockResolvedValue(0)
    mockPrisma.backupRecord.findFirst.mockResolvedValue(null)
    mockPrisma.exportApproval.findMany.mockResolvedValue([])
    const report = await svc.generateReport()
    expect(report.summary.lastBackupAt).toBeNull()
    expect(report.checklist.find((c) => c.item === '身份鉴别')?.status).toBe('不通过')
    expect(report.checklist.find((c) => c.item === '安全审计')?.status).toBe('不通过')
    expect(report.checklist.find((c) => c.item === '数据备份恢复')?.status).toBe('不通过')
  })

  // ───── findAll ─────
  it('lists documents within tenant scope', async () => {
    mockPrisma.complianceDocument.findMany.mockResolvedValue([mockDoc])
    const docs = await svc.findAll()
    expect(mockPrisma.complianceDocument.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'default' },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    })
    expect(docs).toHaveLength(1)
  })

  it('applies category/status/search filters in findAll', async () => {
    mockPrisma.complianceDocument.findMany.mockResolvedValue([])
    await svc.findAll({ category: '法规文档', status: 'CURRENT', search: '隐私' })
    const { where } = mockPrisma.complianceDocument.findMany.mock.calls[0][0]
    expect(where.category).toBe('法规文档')
    expect(where.status).toBe('CURRENT')
    expect(where.OR).toBeDefined()
    expect(where.OR[0]).toEqual({ title: { contains: '隐私', mode: 'insensitive' } })
  })

  // ───── findOne ─────
  it('throws NotFoundException when document is missing', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue(null)
    await expect(svc.findOne('nope')).rejects.toThrow(NotFoundException)
  })

  it('returns document when found', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc)
    await expect(svc.findOne('doc-1')).resolves.toEqual(mockDoc)
  })

  // ───── create ─────
  it('creates document with defaults', async () => {
    mockPrisma.complianceDocument.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'doc-new', ...data }),
    )
    const doc = await svc.create({ title: '数据安全管理制度', category: '管理制度' })
    expect(doc.status).toBe('DRAFT')
    expect(doc.version).toBe('1.0')
    expect(doc.type).toBe('SOP')
    expect(doc.tenantId).toBe('default')
    expect(mockPrisma.complianceDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'default',
        title: '数据安全管理制度',
        category: '管理制度',
        status: 'DRAFT',
      }),
    })
  })

  it('rejects create without title or category', async () => {
    await expect(svc.create({ title: '', category: 'x' })).rejects.toThrow(BadRequestException)
    await expect(svc.create({ title: 'x', category: ' ' })).rejects.toThrow(BadRequestException)
  })

  // ───── update ─────
  it('updates only provided fields', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc)
    mockPrisma.complianceDocument.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockDoc, ...data }),
    )
    const updated = await svc.update('doc-1', { title: '隐私政策 v4', version: '4.0' })
    expect(updated.title).toBe('隐私政策 v4')
    expect(updated.version).toBe('4.0')
    expect(mockPrisma.complianceDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ title: '隐私政策 v4', version: '4.0' }),
    })
  })

  it('rejects invalid status on update', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc)
    await expect(svc.update('doc-1', { status: 'PUBLISHED' as any })).rejects.toThrow(BadRequestException)
  })

  // ───── remove ─────
  it('deletes document within tenant scope', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc)
    mockPrisma.complianceDocument.deleteMany.mockResolvedValue({ count: 1 })
    const res = await svc.remove('doc-1')
    expect(res.success).toBe(true)
    expect(res.deletedId).toBe('doc-1')
    expect(mockPrisma.complianceDocument.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'default', id: 'doc-1' },
    })
  })

  // ───── publish / archive ─────
  it('publishes DRAFT to CURRENT and sets publishedAt', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc)
    mockPrisma.complianceDocument.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockDoc, ...data }),
    )
    const doc = await svc.publish('doc-1')
    expect(doc.status).toBe('CURRENT')
    expect(doc.publishedAt).toBeInstanceOf(Date)
    expect(doc.effectiveDate).toBeInstanceOf(Date)
  })

  it('rejects publishing an archived document', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue({ ...mockDoc, status: 'ARCHIVED' })
    await expect(svc.publish('doc-1')).rejects.toThrow(BadRequestException)
  })

  it('archives a document', async () => {
    mockPrisma.complianceDocument.findFirst.mockResolvedValue({ ...mockDoc, status: 'CURRENT' })
    mockPrisma.complianceDocument.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockDoc, status: 'CURRENT', ...data }),
    )
    const doc = await svc.archive('doc-1')
    expect(doc.status).toBe('ARCHIVED')
    expect(doc.archivedAt).toBeInstanceOf(Date)
  })
})

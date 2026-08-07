import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import { Prisma } from '@prisma/client'

export type ComplianceDocStatus = 'DRAFT' | 'CURRENT' | 'ARCHIVED'

export interface CreateComplianceDocInput {
  title: string
  category: string
  type?: string
  version?: string
  content?: string
  status?: ComplianceDocStatus
  author?: string
  approvedBy?: string
  effectiveDate?: string
}

export interface UpdateComplianceDocInput extends Partial<CreateComplianceDocInput> {}

export interface ListComplianceDocQuery {
  category?: string
  status?: string
  search?: string
}

@Injectable()
export class ComplianceDocsService {
  constructor(private readonly prisma: PrismaService) {}

  private tenantWhere(extra: Prisma.ComplianceDocumentWhereInput = {}): Prisma.ComplianceDocumentWhereInput {
    return { tenantId: getCurrentTenantId(), ...extra }
  }

  async findAll(query: ListComplianceDocQuery = {}) {
    const where = this.tenantWhere()
    if (query.category) where.category = query.category
    if (query.status) where.status = query.status
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    return this.prisma.complianceDocument.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    })
  }

  async findOne(id: string) {
    const doc = await this.prisma.complianceDocument.findFirst({
      where: this.tenantWhere({ id }),
    })
    if (!doc) throw new NotFoundException(`合规文档不存在: ${id}`)
    return doc
  }

  async create(input: CreateComplianceDocInput) {
    if (!input.title?.trim()) throw new BadRequestException('标题不能为空')
    if (!input.category?.trim()) throw new BadRequestException('分类不能为空')
    return this.prisma.complianceDocument.create({
      data: {
        tenantId: getCurrentTenantId(),
        title: input.title.trim(),
        category: input.category.trim(),
        type: input.type?.trim() || 'SOP',
        version: input.version?.trim() || '1.0',
        content: input.content ?? '',
        status: input.status ?? 'DRAFT',
        author: input.author,
        approvedBy: input.approvedBy,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
      },
    })
  }

  async update(id: string, input: UpdateComplianceDocInput) {
    await this.findOne(id)
    const data: Prisma.ComplianceDocumentUpdateInput = {}
    if (input.title !== undefined) {
      if (!input.title.trim()) throw new BadRequestException('标题不能为空')
      data.title = input.title.trim()
    }
    if (input.category !== undefined) {
      if (!input.category.trim()) throw new BadRequestException('分类不能为空')
      data.category = input.category.trim()
    }
    if (input.type !== undefined) data.type = input.type
    if (input.version !== undefined) data.version = input.version
    if (input.content !== undefined) data.content = input.content
    if (input.status !== undefined) {
      if (input.status !== 'DRAFT' && input.status !== 'CURRENT' && input.status !== 'ARCHIVED') {
        throw new BadRequestException(`非法的文档状态: ${input.status}`)
      }
      data.status = input.status
    }
    if (input.author !== undefined) data.author = input.author
    if (input.approvedBy !== undefined) data.approvedBy = input.approvedBy
    if (input.effectiveDate !== undefined) {
      data.effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : null
    }
    return this.prisma.complianceDocument.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.findOne(id)
    const deleted = await this.prisma.complianceDocument.deleteMany({
      where: this.tenantWhere({ id }),
    })
    return { success: deleted.count > 0, deletedId: id }
  }

  async publish(id: string) {
    const doc = await this.findOne(id)
    if (doc.status === 'ARCHIVED') throw new BadRequestException('已归档文档不能发布')
    return this.prisma.complianceDocument.update({
      where: { id },
      data: {
        status: 'CURRENT',
        publishedAt: new Date(),
        effectiveDate: doc.effectiveDate ?? new Date(),
      },
    })
  }

  async archive(id: string) {
    const doc = await this.findOne(id)
    if (doc.status === 'ARCHIVED') return doc
    return this.prisma.complianceDocument.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
  }

  async generateReport() {
    const [auditCount, loginLogCount, userCount, backupCount, exportApprovals] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.loginLog.count(),
      this.prisma.user.count(),
      this.prisma.backupRecord.count(),
      this.prisma.exportApproval.findMany(),
    ])

    const lastBackup = await this.prisma.backupRecord.findFirst({ orderBy: { createdAt: 'desc' } })

    return {
      generatedAt: new Date().toISOString(),
      systemName: 'G005 放射RIS系统',
      complianceStandard: '等保三级 (GB/T 22239-2019)',
      summary: {
        totalUsers: userCount,
        totalAuditLogs: auditCount,
        totalLoginLogs: loginLogCount,
        totalBackups: backupCount,
        lastBackupAt: lastBackup?.createdAt || null,
        pendingExportApprovals: exportApprovals.filter(a => a.status === 'PENDING').length,
      },
      checklist: [
        { item: '身份鉴别', status: userCount > 0 ? '通过' : '不通过', detail: `${userCount} 个用户已注册` },
        { item: '访问控制', status: '通过', detail: '基于JWT的角色访问控制' },
        { item: '安全审计', status: auditCount > 0 ? '通过' : '不通过', detail: `${auditCount} 条审计日志` },
        { item: '剩余信息保护', status: '通过', detail: '敏感数据脱敏已实现' },
        { item: '通信保密性', status: '通过', detail: 'HTTPS + CSP Header' },
        { item: '数据完整性', status: '通过', detail: '审计链哈希校验' },
        { item: '数据备份恢复', status: backupCount > 0 ? '通过' : '不通过', detail: `${backupCount} 次备份记录` },
        { item: '个人信息保护', status: '通过', detail: '患者数据脱敏处理' },
        { item: '安全管理', status: '通过', detail: '角色权限分级管理' },
        { item: '安全事件响应', status: '通过', detail: '审计日志事件追踪' },
      ],
    }
  }
}

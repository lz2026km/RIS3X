import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string
    action: string
    resource: string
    resourceId?: string
    detail?: any
    ip?: string
    userAgent?: string
    success?: boolean
  }) {
    return this.prisma.auditLog.create({ data: { ...params, tenantId: getCurrentTenantId() } })
  }

  async list(query: {
    page?: number
    pageSize?: number
    userId?: string
    action?: string
    resource?: string
    startDate?: string
    endDate?: string
  }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const where: any = { tenantId: getCurrentTenantId() }
    if (query.userId) where.userId = query.userId
    if (query.action) where.action = query.action
    if (query.resource) where.resource = query.resource
    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async stats() {
    const [total, last24h] = await Promise.all([
      this.prisma.auditLog.count({ where: { tenantId: getCurrentTenantId() } }),
      this.prisma.auditLog.count({
        where: {
          tenantId: getCurrentTenantId(),
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ])
    return { total, last24h }
  }
}

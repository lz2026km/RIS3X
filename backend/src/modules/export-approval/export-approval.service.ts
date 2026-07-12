import { Injectable, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

@Injectable()
export class ExportApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  async request(params: { requesterId: string; resource: string; resourceId?: string; reason: string }) {
    return this.prisma.exportApproval.create({ data: { ...params, tenantId: getCurrentTenantId() } })
  }

  async approve(id: string, approverId: string) {
    const item = await this.prisma.exportApproval.findUnique({ where: { id } })
    if (!item) throw new ForbiddenException('请求不存在')
    if (item.status !== 'PENDING') throw new ForbiddenException('请求已处理')
    return this.prisma.exportApproval.update({
      where: { id },
      data: { status: 'APPROVED', approverId, approvedAt: new Date() },
    })
  }

  async reject(id: string, approverId: string, reason: string) {
    const item = await this.prisma.exportApproval.findUnique({ where: { id } })
    if (!item) throw new ForbiddenException('请求不存在')
    if (item.status !== 'PENDING') throw new ForbiddenException('请求已处理')
    return this.prisma.exportApproval.update({
      where: { id },
      data: { status: 'REJECTED', approverId, rejectReason: reason },
    })
  }

  async list(query: { page?: number; pageSize?: number; status?: string; requesterId?: string }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.requesterId) where.requesterId = query.requesterId

    const [items, total] = await Promise.all([
      this.prisma.exportApproval.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.exportApproval.count({ where }),
    ])
    return { items, total, page, pageSize }
  }
}

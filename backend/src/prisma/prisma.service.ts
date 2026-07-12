import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'
import { dbConnectionErrorsCounter } from '../observability/metrics.factory'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: process.env['NODE_ENV'] === 'production' ? ['error'] : ['query', 'info', 'warn', 'error'],
    })
    this.$on('error' as never, (e: unknown) => {
      dbConnectionErrorsCounter.inc()
    })
  }

  async onModuleInit() {
    try {
      await this.$connect()
    } catch {
      dbConnectionErrorsCounter.inc()
    }
  }
}

export const createPrismaWithTenant = (client: PrismaClient) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = getCurrentTenantId()
          if (!tenantId) return query(args)

          const a = args as Record<string, any>

          if (operation === 'create') {
            if (a.data && !a.data['tenantId']) a.data['tenantId'] = tenantId
          } else if (operation === 'createMany') {
            if (a.data && Array.isArray(a.data)) {
              for (const item of a.data) {
                if (!item['tenantId']) item['tenantId'] = tenantId
              }
            }
          } else if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(operation)) {
            a.where = { ...a.where, tenantId }
          } else if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
            a.where = { ...a.where, tenantId }
          } else if (operation === 'upsert') {
            a.where = { ...a.where, tenantId }
            if (a.create && !a.create['tenantId']) a.create['tenantId'] = tenantId
          }

          return query(args)
        },
      },
    },
  })
}

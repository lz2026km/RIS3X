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

export const createPrismaWithTenant = () => {
  const prisma = new PrismaClient()
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = getCurrentTenantId()
          if (!tenantId) return query(args)

          if (operation === 'create' || operation === 'createMany') {
            if (args.data) {
              const data = args.data as Record<string, unknown>
              if (!data['tenantId']) data['tenantId'] = tenantId
            }
          }

          if (operation === 'findUnique' || operation === 'findFirst' || operation === 'findMany' || operation === 'count' || operation === 'aggregate') {
            args.where = { ...args.where, tenantId }
          }

          if (operation === 'update' || operation === 'updateMany' || operation === 'delete' || operation === 'deleteMany') {
            args.where = { ...args.where, tenantId }
          }

          if (operation === 'upsert') {
            args.where = { ...args.where, tenantId }
            const createData = args.create as Record<string, unknown>
            if (createData && !createData['tenantId']) createData['tenantId'] = tenantId
          }

          return query(args)
        },
      },
    },
  })
}

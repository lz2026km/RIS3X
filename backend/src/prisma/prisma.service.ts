import { Injectable, OnModuleInit } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { getEnforcedTenantId } from '../common/interceptors/tenant-context.interceptor'
import { dbConnectionErrorsCounter } from '../observability/metrics.factory'

const TENANT_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'tenantId'))
    .map((model) => model.name),
)

function withTenantWhere(args: Record<string, unknown>, tenantId: string): void {
  const where = args['where']
  args['where'] = {
    ...(where && typeof where === 'object' ? where as Record<string, unknown> : {}),
    tenantId,
  }
}

function setTenant(data: unknown, tenantId: string): void {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    ;(data as Record<string, unknown>)['tenantId'] = tenantId
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: process.env['NODE_ENV'] === 'production' ? ['error'] : ['query', 'info', 'warn', 'error'],
    })
    this.$on('error' as never, (_event: unknown) => {
      dbConnectionErrorsCounter.inc()
    })
  }

  async onModuleInit() {
    try {
      await this.$connect()
    } catch (error) {
      dbConnectionErrorsCounter.inc()
      throw error
    }
  }
}

export const createPrismaWithTenant = (client: PrismaClient) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = getEnforcedTenantId()
          if (!tenantId || !TENANT_MODELS.has(model)) return query(args)

          const values = args as Record<string, unknown>
          if (operation === 'create') {
            setTenant(values['data'], tenantId)
          } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = values['data']
            if (Array.isArray(data)) {
              for (const item of data) setTenant(item, tenantId)
            } else {
              setTenant(data, tenantId)
            }
          } else if ([
            'findUnique',
            'findUniqueOrThrow',
            'findFirst',
            'findFirstOrThrow',
            'findMany',
            'count',
            'aggregate',
            'groupBy',
            'delete',
            'deleteMany',
          ].includes(operation)) {
            withTenantWhere(values, tenantId)
          } else if (['update', 'updateMany', 'updateManyAndReturn'].includes(operation)) {
            withTenantWhere(values, tenantId)
            setTenant(values['data'], tenantId)
          } else if (operation === 'upsert') {
            withTenantWhere(values, tenantId)
            setTenant(values['create'], tenantId)
            setTenant(values['update'], tenantId)
          }

          return query(args)
        },
      },
    },
  })
}

